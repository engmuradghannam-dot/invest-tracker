import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { toFils, generateSchedule } from "../src/lib/schedule.js";

const prisma = new PrismaClient();

const DATA = [
  {
    partner: { name: "د. خير", company: null },
    project: {
      name: "مشروع الدكتور خير", capital: 75000, ratePct: 7.5,
      cycle: "MONTHLY", start: "2026-01-01", end: "2027-01-01",
    },
  },
  {
    partner: { name: "أحمد عياد", company: null },
    project: {
      name: "مشروع أحمد عياد", capital: 500000, ratePct: 10,
      cycle: "MONTHLY", start: "2026-02-01", end: "2027-02-01",
    },
  },
  {
    partner: { name: "شركة الأسفلت", company: "شركة الأسفلت" },
    project: {
      name: "مشروع الأسفلت", capital: 80000, ratePct: 5,
      cycle: "MONTHLY", start: "2026-03-01", end: null,
    },
  },
];

async function main() {
  for (const { partner, project } of DATA) {
    const p = await prisma.partner.findFirst({ where: { name: partner.name } })
      ?? await prisma.partner.create({ data: partner });

    const exists = await prisma.project.findFirst({ where: { name: project.name } });
    if (exists) { console.log(`موجود مسبقاً: ${project.name}`); continue; }

    const created = await prisma.project.create({
      data: {
        name: project.name,
        partnerId: p.id,
        capitalFils: toFils(project.capital),
        profitRateBp: Math.round(project.ratePct * 100),
        cycle: project.cycle,
        startDate: new Date(project.start),
        endDate: project.end ? new Date(project.end) : null,
      },
    });

    const dues = generateSchedule(created).map((d) => ({ ...d, projectId: created.id }));
    await prisma.due.createMany({ data: dues });
    console.log(`${project.name} — ${dues.length} استحقاق`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
