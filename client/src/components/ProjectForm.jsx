import { CYCLES } from "../lib/format.js";
import { Field } from "./Field.jsx";

export const blankProject = {
  name: "", partnerId: "", capital: "", profitRatePct: "",
  cycle: "MONTHLY", startDate: "", endDate: "", notes: "",
};

/** يحوّل سجل مشروع من الخادم إلى قيم النموذج */
export function projectToForm(p) {
  return {
    name: p.name,
    partnerId: p.partnerId,
    capital: String(Number(BigInt(p.capitalFils)) / 1000),
    profitRatePct: String(p.profitRateBp / 100),
    cycle: p.cycle,
    startDate: p.startDate.slice(0, 10),
    endDate: p.endDate ? p.endDate.slice(0, 10) : "",
    notes: p.notes || "",
  };
}

export default function ProjectForm({ form, setForm, partners, errors = {} }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <Field label="اسم المشروع" error={errors.name}>
        <input value={form.name} onChange={set("name")} placeholder="مشروع الأسفلت" />
      </Field>

      <Field label="الشريك" error={errors.partnerId}
             hint={partners.length ? null : "أضف شريكاً أولاً من صفحة الشركاء"}>
        <select value={form.partnerId} onChange={set("partnerId")}>
          <option value="">اختر الشريك</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.company ? ` — ${p.company}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid-2">
        <Field label="رأس المال (د.أ)" error={errors.capital}>
          <input type="number" step="0.001" value={form.capital}
                 onChange={set("capital")} placeholder="75000" />
        </Field>
        <Field label="نسبة الربح للدورة (%)" error={errors.profitRatePct}
               hint="7.5 تعني 7.5% لكل دورة">
          <input type="number" step="0.01" value={form.profitRatePct}
                 onChange={set("profitRatePct")} placeholder="7.5" />
        </Field>
      </div>

      <Field label="الدورة">
        <select value={form.cycle} onChange={set("cycle")}>
          {Object.entries(CYCLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>

      <div className="grid-2">
        <Field label="تاريخ البدء" error={errors.startDate}>
          <input type="date" value={form.startDate} onChange={set("startDate")} />
        </Field>
        <Field label="تاريخ النهاية" error={errors.endDate}
               hint="اتركه فارغاً للمشروع مفتوح المدة">
          <input type="date" value={form.endDate} onChange={set("endDate")} />
        </Field>
      </div>

      <Field label="ملاحظات">
        <textarea rows="2" value={form.notes} onChange={set("notes")} />
      </Field>
    </>
  );
}
