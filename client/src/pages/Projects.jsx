import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { money, moneyShort, date, pct, CYCLES } from "../lib/format.js";
import Modal from "../components/Modal.jsx";
import ProjectForm, { blankProject as blank } from "../components/ProjectForm.jsx";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [partners, setPartners] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    Promise.all([api.projects(), api.partners()])
      .then(([p, pa]) => { setProjects(p); setPartners(pa); })
      .catch((e) => setBanner(e.message));

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true); setErrors({}); setBanner(null);
    try {
      await api.addProject({ ...form, endDate: form.endDate || null });
      setOpen(false); setForm(blank); await load();
    } catch (e) {
      if (e.fields) setErrors(Object.fromEntries(e.fields.map((f) => [f.field, f.message])));
      else setBanner(e.message);
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>المشاريع</h2>
          <p>{projects.length} مشروع</p>
        </div>
        <button className="btn gold" onClick={() => setOpen(true)}>مشروع جديد</button>
      </div>

      {banner && <div className="banner error">{banner}</div>}

      <div className="card">
        {projects.length === 0 ? (
          <div className="empty">
            <p>لا مشاريع بعد. أضف مشروعاً ليبدأ توليد جدول الاستحقاق تلقائياً.</p>
            <button className="btn gold" onClick={() => setOpen(true)}>مشروع جديد</button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>المشروع</th><th>الشريك</th><th>رأس المال</th>
                <th>الربح</th><th>الدورة</th><th>المُحصّل</th><th>متأخر</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const s = p.summary;
                const sched = Number(BigInt(s.scheduledFils));
                const paid = Number(BigInt(s.paidFils));
                const ratio = sched ? (paid / sched) * 100 : 0;
                const late = Number(BigInt(s.overdueFils));
                return (
                  <tr key={p.id}>
                    <td>
                      <Link className="link" to={`/projects/${p.id}`}>{p.name}</Link>
                      <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }} className="num">
                        {date(p.startDate)}{p.endDate ? ` ← ${date(p.endDate)}` : " ← مفتوح"}
                      </div>
                    </td>
                    <td>{p.partner.name}</td>
                    <td className="num ltr">{moneyShort(p.capitalFils)}</td>
                    <td className="num">{pct(p.profitRateBp)}</td>
                    <td>{CYCLES[p.cycle]}</td>
                    <td style={{ minWidth: 130 }}>
                      <span className="num ltr">{moneyShort(s.paidFils)}</span>
                      <div className="progress">
                        <div style={{ width: `${Math.min(ratio, 100)}%` }} />
                      </div>
                    </td>
                    <td className="num ltr">
                      {late > 0
                        ? <span style={{ color: "var(--danger)", fontWeight: 600 }}>
                            {moneyShort(s.overdueFils)}
                          </span>
                        : <span style={{ color: "var(--ink-faint)" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal
          title="مشروع جديد"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn gold" onClick={save} disabled={saving}>
                {saving ? "جارٍ الحفظ…" : "حفظ المشروع"}
              </button>
              <button className="btn ghost" onClick={() => setOpen(false)}>إلغاء</button>
            </>
          }
        >
          <ProjectForm form={form} setForm={setForm}
                       partners={partners} errors={errors} />
        </Modal>
      )}
    </>
  );
}
