// الخادم يرسل BigInt كنص — نحوّله للعرض فقط، لا للحساب
export const fromFils = (v) => Number(BigInt(v ?? 0)) / 1000;

export const money = (fils) =>
  new Intl.NumberFormat("ar-JO-u-nu-latn", {
    style: "currency", currency: "JOD", minimumFractionDigits: 3,
  }).format(fromFils(fils));

export const moneyShort = (fils) =>
  new Intl.NumberFormat("ar-JO-u-nu-latn", { maximumFractionDigits: 0 }).format(fromFils(fils)) + " د.أ";

// ISO مقصود: صيغة التاريخ العربية تحمل علامات اتجاه تنقلب داخل خلية LTR
// (‏01/02/2026 تُعرض 012026/02/). ISO خالٍ من ذلك، ويُقرأ ويُقارن بلا لبس.
export const date = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(d));

export const pct = (bp) => (bp / 100).toLocaleString("en-US") + "%";

export const CYCLES = {
  MONTHLY: "شهري", QUARTERLY: "ربع سنوي",
  SEMIANNUAL: "نصف سنوي", ANNUAL: "سنوي",
};

export const STATUS = {
  PAID:    { label: "مسدد",   cls: "paid" },
  DUE:     { label: "مستحق",  cls: "due" },
  PARTIAL: { label: "جزئي",   cls: "partial" },
  PENDING: { label: "قادم",   cls: "pending" },
};

export const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);
