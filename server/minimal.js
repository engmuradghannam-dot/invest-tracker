import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

// Fix BigInt serialization for JSON
BigInt.prototype.toJSON = function() { return this.toString(); };


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// ── Database: Prisma with in-memory fallback ──
let prisma = null;
let useMemory = false;

// In-memory storage fallback
const memory = {
  partners: [],
  projects: [],
  dues: [],
  payments: [],
};

async function initDB() {
  try {
    prisma = new PrismaClient();
    await prisma.$connect();
    console.log("✅ Connected to PostgreSQL database");

    // Push schema
    const { execSync } = await import("child_process");
    try {
      execSync("npx prisma db push --accept-data-loss", { timeout: 30000 });
      console.log("✅ Database schema synced");
    } catch (e) {
      console.log("⚠️ Schema push failed, trying to continue...");
    }

    return true;
  } catch (e) {
    console.log("⚠️ Database unavailable, using in-memory storage");
    console.log("   Reason:", e.message);
    useMemory = true;
    return false;
  }
}

// Helper: get next ID
function nextId() { return Math.random().toString(36).substring(2, 15); }

// ── Health check ──
app.get("/health", (_req, res) => {
  res.json({ status: "ok", db: useMemory ? "memory" : "postgres", time: new Date().toISOString() });
});

// ── Partners API ──
app.get("/api/partners", async (_req, res) => {
  try {
    if (useMemory) {
      res.json(memory.partners.map(p => ({ ...p, _count: { projects: 0 } })));
    } else {
      const partners = await prisma.partner.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { projects: true } } } });
      res.json(partners);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/partners", async (req, res) => {
  try {
    const { name, company, phone, email, notes } = req.body;
    if (!name) return res.status(400).json({ error: "الاسم مطلوب" });

    if (useMemory) {
      const partner = { id: nextId(), name, company: company || null, phone: phone || null, email: email || null, notes: notes || null, createdAt: new Date(), updatedAt: new Date() };
      memory.partners.push(partner);
      res.status(201).json(partner);
    } else {
      const partner = await prisma.partner.create({ data: { name, company, phone, email, notes } });
      res.status(201).json(partner);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Projects API ──
app.get("/api/projects", async (_req, res) => {
  try {
    if (useMemory) {
      res.json(memory.projects.map(p => ({
        ...p,
        partner: memory.partners.find(pa => pa.id === p.partnerId) || { name: "—" },
        summary: { scheduledFils: 0n, paidFils: 0n, remainingFils: BigInt(p.capitalFils), collectionPct: 0 }
      })));
    } else {
      const projects = await prisma.project.findMany({
        include: { partner: true, dues: true, payments: true },
        orderBy: { createdAt: "desc" }
      });
      res.json(projects.map(p => {
        const { dues, payments, ...rest } = p;
        const paid = payments.reduce((s, x) => s + x.amountFils, 0n);
        const scheduled = dues.reduce((s, d) => s + d.amountFils, 0n);
        return {
          ...rest,
          summary: {
            scheduledFils: scheduled,
            paidFils: paid,
            remainingFils: p.capitalFils - paid,
            collectionPct: scheduled > 0n ? Number(paid) / Number(scheduled) * 100 : 0
          }
        };
      }));
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/projects", async (req, res) => {
  try {
    const { name, partnerId, capital, profitRatePct, cycle, startDate, endDate, notes } = req.body;
    if (!name || !partnerId) return res.status(400).json({ error: "اسم المشروع والشريك مطلوبان" });

    const capitalFils = BigInt(Math.round((capital || 0) * 1000));

    if (useMemory) {
      const project = {
        id: nextId(), name, partnerId,
        capitalFils: capitalFils.toString(),
        profitRateBp: Math.round((profitRatePct || 0) * 100),
        cycle: cycle || "MONTHLY",
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: "ACTIVE",
        currency: "JOD",
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memory.projects.push(project);
      res.status(201).json(project);
    } else {
      const project = await prisma.project.create({
        data: {
          name, partnerId,
          capitalFils,
          profitRateBp: Math.round((profitRatePct || 0) * 100),
          cycle: cycle || "MONTHLY",
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          notes
        }
      });
      res.status(201).json(project);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (useMemory) {
      const p = memory.projects.find(x => x.id === id);
      if (!p) return res.status(404).json({ error: "المشروع غير موجود" });
      res.json({
        ...p,
        partner: memory.partners.find(pa => pa.id === p.partnerId) || { name: "—" },
        dues: [], payments: [],
        summary: { scheduledFils: 0n, paidFils: 0n, remainingFils: BigInt(p.capitalFils), collectionPct: 0 }
      });
    } else {
      const p = await prisma.project.findUnique({
        where: { id },
        include: { partner: true, dues: true, payments: true, documents: true }
      });
      if (!p) return res.status(404).json({ error: "المشروع غير موجود" });
      res.json(p);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (useMemory) {
      const idx = memory.projects.findIndex(x => x.id === id);
      if (idx === -1) return res.status(404).json({ error: "المشروع غير موجود" });
      memory.projects[idx] = { ...memory.projects[idx], ...req.body, updatedAt: new Date() };
      res.json(memory.projects[idx]);
    } else {
      const project = await prisma.project.update({ where: { id }, data: req.body });
      res.json(project);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/projects/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (useMemory) {
      const idx = memory.projects.findIndex(x => x.id === id);
      if (idx === -1) return res.status(404).json({ error: "المشروع غير موجود" });
      memory.projects[idx].status = status;
      res.json(memory.projects[idx]);
    } else {
      const project = await prisma.project.update({ where: { id }, data: { status } });
      res.json(project);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (useMemory) {
      memory.projects = memory.projects.filter(x => x.id !== id);
      res.status(204).end();
    } else {
      await prisma.project.delete({ where: { id } });
      res.status(204).end();
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Dues API ──
app.get("/api/dues", async (req, res) => {
  try {
    const days = Number(req.query.days || 30);
    if (useMemory) {
      res.json([]);
    } else {
      const until = new Date(Date.now() + days * 86400000);
      const dues = await prisma.due.findMany({
        where: { dueDate: { lte: until } },
        include: { project: { include: { partner: true } } },
        orderBy: { dueDate: "asc" }
      });
      res.json(dues);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Dashboard API ──
app.get("/api/dashboard", async (_req, res) => {
  try {
    if (useMemory) {
      const active = memory.projects.filter(p => p.status === "ACTIVE");
      const capital = active.reduce((s, p) => s + BigInt(p.capitalFils || 0), 0n);
      res.json({
        projectCount: memory.projects.length,
        activeCount: active.length,
        capitalFils: capital.toString(),
        scheduledFils: "0",
        paidFils: "0",
        overdueFils: "0",
        overdueCount: 0
      });
    } else {
      const projects = await prisma.project.findMany({ include: { dues: true, payments: true } });
      let capital = 0n, scheduled = 0n, paid = 0n;
      for (const p of projects) {
        if (p.status === "ACTIVE") capital += p.capitalFils;
        scheduled += p.dues.reduce((s, d) => s + d.amountFils, 0n);
        paid += p.payments.reduce((s, x) => s + x.amountFils, 0n);
      }
      res.json({
        projectCount: projects.length,
        activeCount: projects.filter(p => p.status === "ACTIVE").length,
        capitalFils: capital.toString(),
        scheduledFils: scheduled.toString(),
        paidFils: paid.toString(),
        overdueFils: "0",
        overdueCount: 0
      });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Payments API ──
app.post("/api/payments", async (req, res) => {
  try {
    const { projectId, dueId, amount, paidAt, method, reference, notes } = req.body;
    const amountFils = BigInt(Math.round((amount || 0) * 1000));

    if (useMemory) {
      const payment = {
        id: nextId(), projectId, dueId: dueId || null,
        amountFils: amountFils.toString(),
        paidAt: new Date(paidAt || Date.now()),
        method, reference, notes,
        createdAt: new Date()
      };
      memory.payments.push(payment);
      res.status(201).json(payment);
    } else {
      const payment = await prisma.payment.create({
        data: { projectId, dueId, amountFils, paidAt: new Date(paidAt || Date.now()), method, reference, notes }
      });
      res.status(201).json(payment);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/payments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (useMemory) {
      memory.payments = memory.payments.filter(x => x.id !== id);
      res.status(204).end();
    } else {
      await prisma.payment.delete({ where: { id } });
      res.status(204).end();
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Setup endpoint ──
app.get("/api/setup", async (_req, res) => {
  try {
    if (!useMemory && prisma) {
      const { execSync } = await import("child_process");
      execSync("npx prisma db push --accept-data-loss", { timeout: 60000 });
      res.json({ success: true, message: "Database tables created successfully" });
    } else {
      res.json({ success: true, message: "Running in memory mode (no database needed)" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Static files ──
const staticDir = path.resolve(process.cwd(), "client/dist");
app.use(express.static(staticDir));

app.get("*", (_req, res) => {
  const indexPath = path.join(staticDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: "Invest Tracker API", db: useMemory ? "memory" : "postgres" });
  }
});

// ── Start ──
const PORT = process.env.PORT || 4000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT} (${useMemory ? "memory" : "postgres"} mode)`);
  });
});
