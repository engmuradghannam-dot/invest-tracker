import cron from "node-cron";
import nodemailer from "nodemailer";
import { fmtJOD } from "./schedule.js";

const DAYS_BEFORE = Number(process.env.REMINDER_DAYS_BEFORE || 3);

function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const fmtDate = (d) =>
  new Intl.DateTimeFormat("ar-JO-u-nu-latn", { dateStyle: "long" }).format(new Date(d));

/**
 * يبحث عن استحقاقات خلال DAYS_BEFORE ولم يُرسل لها تنبيه بعد.
 * reminderSentAt يمنع تكرار الإرسال لو دار الـ cron أكثر من مرة.
 */
export async function sendDueReminders(prisma) {
  const until = new Date(Date.now() + DAYS_BEFORE * 86400000);

  const dues = await prisma.due.findMany({
    where: {
      dueDate: { lte: until, gte: new Date(Date.now() - 86400000) },
      status: { in: ["PENDING", "DUE", "PARTIAL"] },
      reminderSentAt: null,
    },
    include: { project: { include: { partner: true } } },
  });

  if (!dues.length) return { sent: 0 };

  const to = process.env.REMINDER_TO;
  if (!to) {
    console.warn("REMINDER_TO غير مضبوط — تخطّي الإرسال");
    return { sent: 0 };
  }

  const rows = dues.map((d) => `
    <tr>
      <td>${d.project.name}</td>
      <td>${d.project.partner.name}</td>
      <td>${d.kind === "PRINCIPAL" ? "رد رأس المال" : `ربح دورة ${d.seq}`}</td>
      <td>${fmtDate(d.dueDate)}</td>
      <td><strong>${fmtJOD(d.amountFils)}</strong></td>
    </tr>`).join("");

  const html = `
    <div dir="rtl" style="font-family:system-ui,sans-serif;color:#1a2340">
      <h2 style="margin:0 0 4px">استحقاقات خلال ${DAYS_BEFORE} أيام</h2>
      <p style="color:#5a6280;margin:0 0 16px">${dues.length} دفعة</p>
      <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">
        <thead>
          <tr style="background:#1a2340;color:#c9a961;text-align:right">
            <th>المشروع</th><th>الشريك</th><th>البند</th><th>التاريخ</th><th>المبلغ</th>
          </tr>
        </thead>
        <tbody style="text-align:right">${rows}</tbody>
      </table>
    </div>`;

  await transport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `استحقاقات قادمة — ${dues.length} دفعة`,
    html,
  });

  await prisma.due.updateMany({
    where: { id: { in: dues.map((d) => d.id) } },
    data: { reminderSentAt: new Date() },
  });

  return { sent: dues.length };
}

export function startReminderJob(prisma) {
  // كل يوم 8:00 صباحاً بتوقيت عمّان
  cron.schedule("0 8 * * *", async () => {
    try {
      const r = await sendDueReminders(prisma);
      if (r.sent) console.log(`تنبيهات مُرسلة: ${r.sent}`);
    } catch (e) {
      console.error("فشل إرسال التنبيهات:", e.message);
    }
  }, { timezone: "Asia/Amman" });

  console.log("مجدول التنبيهات يعمل — 8:00 صباحاً يومياً");
}
