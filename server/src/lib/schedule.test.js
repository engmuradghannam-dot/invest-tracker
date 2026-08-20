import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toFils, profitPerCycle, addMonths, generateSchedule, dueStatus, projectSummary,
} from "./schedule.js";

const iso = (d) => d.toISOString().slice(0, 10);

test("toFils يحوّل بدقة بلا انحراف عائم", () => {
  assert.equal(toFils(75000), 75000000n);
  assert.equal(toFils(0.1) + toFils(0.2), toFils(0.3)); // النقطة الحرجة
});

test("ربح الدورة: 75,000 × 7.5% = 5,625", () => {
  assert.equal(profitPerCycle(toFils(75000), 750), toFils(5625));
});

test("ربح الدورة: 500,000 × 10% = 50,000", () => {
  assert.equal(profitPerCycle(toFils(500000), 1000), toFils(50000));
});

test("addMonths يثبّت اليوم عند نهايات الشهور", () => {
  assert.equal(iso(addMonths(new Date("2026-01-31"), 1)), "2026-02-28");
  assert.equal(iso(addMonths(new Date("2024-01-31"), 1)), "2024-02-29"); // كبيسة
  assert.equal(iso(addMonths(new Date("2026-03-31"), 1)), "2026-04-30");
  assert.equal(iso(addMonths(new Date("2026-01-15"), 3)), "2026-04-15");
});

test("جدول مغلق: 12 دفعة ربح + رد رأس المال", () => {
  const p = {
    capitalFils: toFils(75000), profitRateBp: 750, cycle: "MONTHLY",
    startDate: new Date("2026-01-01"), endDate: new Date("2027-01-01"),
  };
  const dues = generateSchedule(p);
  const profits = dues.filter((d) => d.kind === "PROFIT");
  const principal = dues.filter((d) => d.kind === "PRINCIPAL");

  assert.equal(profits.length, 12);
  assert.equal(principal.length, 1);
  assert.equal(principal[0].amountFils, toFils(75000));
  assert.equal(iso(profits[0].dueDate), "2026-02-01"); // بعد دورة، لا يوم البدء
  assert.equal(iso(profits[11].dueDate), "2027-01-01");
});

test("جدول مفتوح المدة: أفق محدود وبلا رد رأس مال", () => {
  const dues = generateSchedule({
    capitalFils: toFils(80000), profitRateBp: 500, cycle: "MONTHLY",
    startDate: new Date("2026-01-01"), endDate: null,
  }, { horizonCycles: 6 });

  assert.equal(dues.length, 6);
  assert.equal(dues.some((d) => d.kind === "PRINCIPAL"), false);
});

test("الدورة الربعية تتقدم 3 شهور", () => {
  const dues = generateSchedule({
    capitalFils: toFils(100000), profitRateBp: 2000, cycle: "QUARTERLY",
    startDate: new Date("2026-01-10"), endDate: new Date("2027-01-10"),
  });
  const profits = dues.filter((d) => d.kind === "PROFIT");
  assert.equal(profits.length, 4);
  assert.equal(iso(profits[0].dueDate), "2026-04-10");
});

test("حالة الاستحقاق تميّز الجزئي عن غير المستحق", () => {
  const today = new Date("2026-06-15");
  const past = { dueDate: new Date("2026-06-01"), amountFils: toFils(1000) };
  const future = { dueDate: new Date("2026-07-01"), amountFils: toFils(1000) };

  assert.equal(dueStatus(past, 0n, today), "DUE");
  assert.equal(dueStatus(past, toFils(400), today), "PARTIAL");
  assert.equal(dueStatus(past, toFils(1000), today), "PAID");
  assert.equal(dueStatus(future, 0n, today), "PENDING");
  assert.equal(dueStatus(future, toFils(1000), today), "PAID"); // دفع مبكر
});

test("الملخص يحسب المتأخر والمتبقي", () => {
  const project = { capitalFils: toFils(75000) };
  const dues = [
    { id: "d1", dueDate: new Date("2026-01-01"), amountFils: toFils(5625) },
    { id: "d2", dueDate: new Date("2026-02-01"), amountFils: toFils(5625) },
    { id: "d3", dueDate: new Date("2099-01-01"), amountFils: toFils(5625) },
  ];
  const payments = [{ dueId: "d1", amountFils: toFils(5625) }];
  const s = projectSummary(project, dues, payments);

  assert.equal(s.scheduledFils, toFils(16875));
  assert.equal(s.paidFils, toFils(5625));
  assert.equal(s.remainingFils, toFils(11250));
  assert.equal(s.overdueFils, toFils(5625)); // d2 فقط
  assert.equal(s.overdueCount, 1);
  assert.equal(s.nextDue.id, "d3");
});
