// ── المال ──────────────────────────────────────────────
// كل المبالغ تُخزَّن بالفلس كأعداد صحيحة (BigInt).
// لا تُستخدم الأعداد العائمة في أي حساب مالي إطلاقاً.

export const FILS_PER_JOD = 1000n;

export const toFils = (jod) => BigInt(Math.round(Number(jod) * 1000));
export const toJOD  = (fils) => Number(fils) / 1000;

export const fmtJOD = (fils) =>
  new Intl.NumberFormat("ar-JO-u-nu-latn", {
    style: "currency", currency: "JOD", minimumFractionDigits: 3,
  }).format(toJOD(fils));

// ── الدورات ────────────────────────────────────────────
const MONTHS_PER_CYCLE = {
  MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12,
};

/**
 * يضيف عدد شهور لتاريخ مع تثبيت اليوم.
 * 31 يناير + شهر = 28/29 فبراير (وليس 3 مارس كما يفعل Date الافتراضي).
 */
export function addMonths(date, months) {
  const d = new Date(date);
  const targetDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(targetDay, lastDay));
  return d;
}

/**
 * ربح الدورة الواحدة = رأس المال × النسبة.
 * النسبة بالنقاط الأساسية (750 = 7.5%) لتفادي كسور الفاصلة العائمة.
 * القسمة على 10000n تقرّب لأسفل — الفرق أقل من فلس واحد.
 */
export function profitPerCycle(capitalFils, profitRateBp) {
  return (BigInt(capitalFils) * BigInt(profitRateBp)) / 10000n;
}

/**
 * يولّد جدول الاستحقاق الكامل لمشروع.
 *
 * - دفعات ربح دورية من startDate حتى endDate
 * - دفعة رد رأس المال في endDate (seq = 0، kind = PRINCIPAL)
 * - بلا endDate: يولّد `horizonCycles` دورة فقط، بلا رد رأس مال
 *
 * أول استحقاق بعد دورة كاملة من البدء، لا في يوم البدء نفسه.
 */
export function generateSchedule(project, { horizonCycles = 24 } = {}) {
  const { capitalFils, profitRateBp, cycle, startDate, endDate } = project;
  const step = MONTHS_PER_CYCLE[cycle];
  if (!step) throw new Error(`دورة غير معروفة: ${cycle}`);

  const amount = profitPerCycle(capitalFils, profitRateBp);
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  const dues = [];
  let seq = 1;

  while (true) {
    const dueDate = addMonths(start, step * seq);
    if (end && dueDate > end) break;
    if (!end && seq > horizonCycles) break;
    if (seq > 600) break; // حاجز أمان

    dues.push({ kind: "PROFIT", seq, dueDate, amountFils: amount });
    seq++;
  }

  if (end) {
    dues.push({
      kind: "PRINCIPAL",
      seq: 0,
      dueDate: end,
      amountFils: BigInt(capitalFils),
    });
  }

  return dues;
}

/**
 * يحسب حالة الاستحقاق من مجموع ما دُفع عليه.
 * PARTIAL يظهر فقط عند دفع جزء — لا يُخلط مع PENDING.
 */
export function dueStatus(due, paidFils, today = new Date()) {
  const amount = BigInt(due.amountFils);
  const paid = BigInt(paidFils || 0);

  if (paid >= amount) return "PAID";
  if (paid > 0n) return "PARTIAL";
  return new Date(due.dueDate) <= today ? "DUE" : "PENDING";
}

/** ملخص مالي لمشروع: المستحق، المدفوع، المتبقي، والمتأخر. */
export function projectSummary(project, dues, payments) {
  const today = new Date();
  const paidByDue = new Map();
  let totalPaid = 0n;

  for (const p of payments) {
    totalPaid += BigInt(p.amountFils);
    if (p.dueId) {
      paidByDue.set(p.dueId, (paidByDue.get(p.dueId) || 0n) + BigInt(p.amountFils));
    }
  }

  let scheduled = 0n, overdue = 0n, overdueCount = 0;
  let nextDue = null;

  for (const d of dues) {
    const amount = BigInt(d.amountFils);
    scheduled += amount;
    const paid = paidByDue.get(d.id) || 0n;
    const st = dueStatus(d, paid, today);

    if ((st === "DUE" || st === "PARTIAL") && new Date(d.dueDate) <= today) {
      overdue += amount - paid;
      overdueCount++;
    }
    if (st === "PENDING" && (!nextDue || new Date(d.dueDate) < new Date(nextDue.dueDate))) {
      nextDue = d;
    }
  }

  return {
    capitalFils: BigInt(project.capitalFils),
    scheduledFils: scheduled,
    paidFils: totalPaid,
    remainingFils: scheduled - totalPaid,
    overdueFils: overdue,
    overdueCount,
    nextDue,
  };
}
