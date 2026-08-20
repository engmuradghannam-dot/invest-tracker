import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  toFils, generateSchedule, dueStatus, projectSummary,
} from "./lib/schedule.js";
import { startReminderJob } from "./lib/reminders.js";
import documentRoutes from "./routes/documents.js";

const prisma = new PrismaClient();

/** كم دورة تُولَّد للمشاريع مفتوحة المدة (بلا تاريخ نهاية) */
const HORIZON = Number(process.env.OPEN_ENDED_CYCLES || 24);
const app = express();
app.use(cors());
app.use(express.json());

// BigInt لا يُسلسل إلى JSON افتراضياً — نحوّله لنص ونعيد بناءه في الواجهة
BigInt.prototype.toJSON = function () { return this.toString(); };

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use("/api", documentRoutes(prisma));

// ── الشركاء ────────────────────────────────────────────
const partnerSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("بريد غير صالح").optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
});

app.get("/api/partners", wrap(async (_req, res) => {
  res.json(await prisma.partner.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  }));
}));

app.post("/api/partners", wrap(async (req, res) => {
  const data = partnerSchema.parse(req.body);
  res.status(201).json(await prisma.partner.create({ data }));
}));

app.put("/api/partners/:id", wrap(async (req, res) => {
  const data = partnerSchema.partial().parse(req.body);
  res.json(await prisma.partner.update({ where: { id: req.params.id }, data }));
}));

// ── المشاريع ───────────────────────────────────────────
const projectSchema = z.object({
  name: z.string().min(1, "اسم المشروع مطلوب"),
  partnerId: z.string().min(1, "اختر الشريك"),
  capital: z.coerce.number().positive("رأس المال يجب أن يكون أكبر من صفر"),
  profitRatePct: z.coerce.number().min(0).max(100),
  cycle: z.enum(["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"], {
    errorMap: () => ({ message: "دورة غير معروفة" }),
  }).default("MONTHLY"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine((d) => !d.endDate || d.endDate > d.startDate, {
  message: "تاريخ النهاية يجب أن يكون بعد تاريخ البدء", path: ["endDate"],
});

app.get("/api/projects", wrap(async (_req, res) => {
  const projects = await prisma.project.findMany({
    include: { partner: true, dues: true, payments: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects.map((p) => {
    const { dues, payments, ...rest } = p;
    return { ...rest, summary: projectSummary(p, dues, payments) };
  }));
}));

app.get("/api/projects/:id", wrap(async (req, res) => {
  const p = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      partner: true,
      payments: { orderBy: { paidAt: "desc" }, include: { documents: true } },
      dues: { orderBy: [{ dueDate: "asc" }] },
      documents: true,
    },
  });
  if (!p) return res.status(404).json({ error: "المشروع غير موجود" });

  const paidByDue = new Map();
  for (const pay of p.payments) {
    if (pay.dueId) paidByDue.set(pay.dueId, (paidByDue.get(pay.dueId) || 0n) + pay.amountFils);
  }
  const dues = p.dues.map((d) => {
    const paid = paidByDue.get(d.id) || 0n;
    return { ...d, paidFils: paid, status: dueStatus(d, paid) };
  });

  res.json({ ...p, dues, summary: projectSummary(p, p.dues, p.payments) });
}));

app.post("/api/projects", wrap(async (req, res) => {
  const d = projectSchema.parse(req.body);
  const project = await prisma.project.create({
    data: {
      name: d.name,
      partnerId: d.partnerId,
      capitalFils: toFils(d.capital),
      profitRateBp: Math.round(d.profitRatePct * 100),
      cycle: d.cycle,
      startDate: d.startDate,
      endDate: d.endDate ?? null,
      notes: d.notes ?? null,
    },
  });
  await prisma.due.createMany({
    data: generateSchedule(project, { horizonCycles: HORIZON })
      .map((x) => ({ ...x, projectId: project.id })),
  });
  res.status(201).json(project);
}));

/**
 * إعادة توليد الجدول بعد تعديل شروط المشروع.
 * الاستحقاقات التي عليها دفعات لا تُمس — حذفها يعني فقدان سجل دفع حقيقي.
 */
app.post("/api/projects/:id/regenerate", wrap(async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { dues: { include: { payments: true } } },
  });
  if (!project) return res.status(404).json({ error: "المشروع غير موجود" });

  const locked = new Set(
    project.dues.filter((d) => d.payments.length > 0).map((d) => `${d.kind}:${d.seq}`)
  );

  await prisma.due.deleteMany({
    where: { projectId: project.id, payments: { none: {} } },
  });

  const fresh = generateSchedule(project, { horizonCycles: HORIZON })
    .filter((d) => !locked.has(`${d.kind}:${d.seq}`))
    .map((d) => ({ ...d, projectId: project.id }));

  await prisma.due.createMany({ data: fresh, skipDuplicates: true });
  res.json({ regenerated: fresh.length, kept: locked.size });
}));

app.put("/api/projects/:id", wrap(async (req, res) => {
  const d = projectSchema.parse(req.body);
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      name: d.name,
      partnerId: d.partnerId,
      capitalFils: toFils(d.capital),
      profitRateBp: Math.round(d.profitRatePct * 100),
      cycle: d.cycle,
      startDate: d.startDate,
      endDate: d.endDate ?? null,
      notes: d.notes ?? null,
    },
  });
  res.json(project);
}));

app.patch("/api/projects/:id/status", wrap(async (req, res) => {
  const { status } = z.object({
    status: z.enum(["ACTIVE", "COMPLETED", "SUSPENDED"], {
      errorMap: () => ({ message: "حالة غير معروفة" }),
    }),
  }).parse(req.body);
  res.json(await prisma.project.update({ where: { id: req.params.id }, data: { status } }));
}));

app.delete("/api/projects/:id", wrap(async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// ── الدفعات ────────────────────────────────────────────
const paymentSchema = z.object({
  projectId: z.string().min(1),
  dueId: z.string().optional().nullable(),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  paidAt: z.coerce.date().default(() => new Date()),
  method: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

app.post("/api/payments", wrap(async (req, res) => {
  const d = paymentSchema.parse(req.body);
  const payment = await prisma.payment.create({
    data: {
      projectId: d.projectId,
      dueId: d.dueId || null,
      amountFils: toFils(d.amount),
      paidAt: d.paidAt,
      method: d.method ?? null,
      reference: d.reference ?? null,
      notes: d.notes ?? null,
    },
  });

  if (d.dueId) {
    const due = await prisma.due.findUnique({
      where: { id: d.dueId }, include: { payments: true },
    });
    const paid = due.payments.reduce((s, p) => s + p.amountFils, 0n);
    await prisma.due.update({
      where: { id: d.dueId }, data: { status: dueStatus(due, paid) },
    });
  }
  res.status(201).json(payment);
}));

app.delete("/api/payments/:id", wrap(async (req, res) => {
  const p = await prisma.payment.delete({ where: { id: req.params.id } });
  if (p.dueId) {
    const due = await prisma.due.findUnique({
      where: { id: p.dueId }, include: { payments: true },
    });
    const paid = due.payments.reduce((s, x) => s + x.amountFils, 0n);
    await prisma.due.update({ where: { id: p.dueId }, data: { status: dueStatus(due, paid) } });
  }
  res.status(204).end();
}));

// ── لوحة الاستحقاقات ───────────────────────────────────
app.get("/api/dues", wrap(async (req, res) => {
  const days = Number(req.query.days ?? 30);
  const until = new Date(Date.now() + days * 86400000);

  const dues = await prisma.due.findMany({
    where: { dueDate: { lte: until }, status: { in: ["PENDING", "DUE", "PARTIAL"] } },
    include: { project: { include: { partner: true } }, payments: true },
    orderBy: { dueDate: "asc" },
  });

  res.json(dues.map((d) => {
    const paid = d.payments.reduce((s, p) => s + p.amountFils, 0n);
    return {
      id: d.id, kind: d.kind, seq: d.seq, dueDate: d.dueDate,
      amountFils: d.amountFils, paidFils: paid, status: dueStatus(d, paid),
      project: { id: d.project.id, name: d.project.name },
      partner: { id: d.project.partner.id, name: d.project.partner.name },
    };
  }));
}));

app.get("/api/dashboard", wrap(async (_req, res) => {
  const projects = await prisma.project.findMany({ include: { dues: true, payments: true } });
  let capital = 0n, scheduled = 0n, paid = 0n, overdue = 0n, overdueCount = 0;

  for (const p of projects) {
    const s = projectSummary(p, p.dues, p.payments);
    if (p.status === "ACTIVE") capital += s.capitalFils;
    scheduled += s.scheduledFils;
    paid += s.paidFils;
    overdue += s.overdueFils;
    overdueCount += s.overdueCount;
  }

  res.json({
    projectCount: projects.length,
    activeCount: projects.filter((p) => p.status === "ACTIVE").length,
    capitalFils: capital, scheduledFils: scheduled, paidFils: paid,
    overdueFils: overdue, overdueCount,
  });
}));

// ── معالج الأخطاء ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: "بيانات غير صالحة",
      fields: err.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
    });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "حجم الملف يتجاوز 10 ميغابايت" });
  }
  if (err.message?.startsWith("نوع الملف")) return res.status(415).json({ error: err.message });
  if (err.code === "P2025") return res.status(404).json({ error: "السجل غير موجود" });
  if (err.code === "P2003") return res.status(400).json({ error: "مرجع غير موجود" });
  console.error(err);
  res.status(500).json({ error: "خطأ في الخادم" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API على المنفذ ${PORT}`);
  if (process.env.SMTP_HOST) startReminderJob(prisma);
});
