import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import Modal from "../components/Modal.jsx";
import { Field } from "../components/Field.jsx";

const blank = { name: "", company: "", phone: "", email: "", notes: "" };

export default function Partners() {
  const [partners, setPartners] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.partners().then(setPartners).catch((e) => setBanner(e.message));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true); setErrors({}); setBanner(null);
    try {
      await api.addPartner(form);
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
          <h2>الشركاء</h2>
          <p>{partners.length} شريك</p>
        </div>
        <button className="btn gold" onClick={() => setOpen(true)}>شريك جديد</button>
      </div>

      {banner && <div className="banner error">{banner}</div>}

      <div className="card">
        {partners.length === 0 ? (
          <div className="empty">
            <p>لا شركاء بعد. أضف شريكاً قبل إنشاء أول مشروع.</p>
            <button className="btn gold" onClick={() => setOpen(true)}>شريك جديد</button>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>الاسم</th><th>الشركة</th><th>الهاتف</th><th>البريد</th><th>المشاريع</th></tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td>{p.company || "—"}</td>
                  <td className="num ltr">{p.phone || "—"}</td>
                  <td className="ltr">{p.email || "—"}</td>
                  <td className="num">{p._count?.projects ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal
          title="شريك جديد"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn gold" onClick={save} disabled={saving}>
                {saving ? "جارٍ الحفظ…" : "حفظ الشريك"}
              </button>
              <button className="btn ghost" onClick={() => setOpen(false)}>إلغاء</button>
            </>
          }
        >
          <Field label="الاسم" error={errors.name}>
            <input value={form.name} onChange={set("name")} />
          </Field>
          <Field label="الشركة">
            <input value={form.company} onChange={set("company")} />
          </Field>
          <div className="grid-2">
            <Field label="الهاتف">
              <input value={form.phone} onChange={set("phone")} dir="ltr" />
            </Field>
            <Field label="البريد الإلكتروني" error={errors.email}>
              <input type="email" value={form.email} onChange={set("email")} dir="ltr" />
            </Field>
          </div>
          <Field label="ملاحظات">
            <textarea rows="2" value={form.notes} onChange={set("notes")} />
          </Field>
        </Modal>
      )}
    </>
  );
}
