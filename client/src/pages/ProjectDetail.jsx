import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, uploadDocuments } from "../lib/api.js";
import { money, moneyShort, date, pct, fromFils, CYCLES, STATUS } from "../lib/format.js";
import Modal from "../components/Modal.jsx";
import { Field, Stat } from "../components/Field.jsx";
import ProjectForm, { projectToForm } from "../components/ProjectForm.jsx";
import Attachments from "../components/Attachments.jsx";

const PROJECT_STATUS = {
  ACTIVE:    { label: "نشط",   cls: "paid" },
  COMPLETED: { label: "منتهي", cls: "pending" },
  SUSPENDED: { label: "متعثر", cls: "due" },
};

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [p, setP] = useState(null);
  const [partners, setPartners] = useState([]);
  const [banner, setBanner] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  const [payFor, setPayFor] = useState(null);
  const [payForm, setPayForm] = useState({});
  const [payFiles, setPayFiles] = useState([]);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});

  const load = () => api.project(id).then(setP).catch((e) => setBanner(e.message));

  useEffect(() => {
    load();
    api.partners().then(setPartners).catch(() => {});
  }, [id]);

  function openPay(due) {
    const remaining = fromFils(due.amountFils) - fromFils(due.paidFils);
    setPayForm({
      amount: remaining.toFixed(3),
      paidAt: new Date().toISOString().slice(0, 10),
      method: "تحويل", reference: "", notes: "",
    });
    setPayFiles([]);
    setPayFor(due);
  }

  async function savePayment() {
    setSaving(true); setBanner(null);
    try {
      const payment = await api.addPayment({ projectId: id, dueId: payFor.id, ...payForm });
      if (payFiles.length) {
        await uploadDocuments({ paymentId: payment.id, files: payFiles });
      }
      setPayFor(null);
      await load();
    } catch (e) { setBanner(e.message); }
    finally { setSaving(false); }
  }

  function openEdit() {
    setEditForm(projectToForm(p));
    setEditErrors({});
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true); setEditErrors({}); setBanner(null);
    try {
      await api.editProject(id, { ...editForm, endDate: editForm.endDate || null });
      setEditing(false);
      await load();
      setNotice("حُفظت التعديلات. الجدول لم يتغيّر — اضغط «إعادة توليد الجدول» لتطبيق الشروط الجديدة.");
    } catch (e) {
      if (e.fields) setEditErrors(Object.fromEntries(e.fields.map((f) => [f.field, f.message])));
      else setBanner(e.message);
    } finally { setSaving(false); }
  }

  async function regenerate() {
    setSaving(true); setBanner(null);
    try {
      const r = await api.regenerate(id);
      await load();
      setNotice(`أُعيد توليد ${r.regenerated} استحقاق. ${r.kept} استحقاق عليه دفعات بقي كما هو.`);
    } catch (e) { setBanner(e.message); }
    finally { setSaving(false); }
  }

  async function changeStatus(e) {
    try { await api.setStatus(id, e.target.value); await load(); }
    catch (err) { setBanner(err.message); }
  }

  async function removeProject() {
    if (!confirm("حذف المشروع نهائياً مع كل استحقاقاته ودفعاته؟")) return;
    try { await api.delProject(id); nav("/projects"); }
    catch (e) { setBanner(e.message); }
  }

  if (banner && !p) return <div className="banner error">{banner}</div>;
  if (!p) return <div className="empty">جارٍ التحميل…</div>;

  const s = p.summary;
  const setPay = (k) => (e) => setPayForm({ ...payForm, [k]: e.target.value });
  const st = PROJECT_STATUS[p.status];

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="link" to="/projects">← المشاريع</Link>
          <h2 style={{ marginTop: 6 }}>
            {p.name} <span className={"badge " + st.cls}>{st.label}</span>
          </h2>
          <p>
            {p.partner.name} · {pct(p.profitRateBp)} {CYCLES[p.cycle]} ·{" "}
            <span className="num">
              {date(p.startDate)}{p.endDate ? ` ← ${date(p.endDate)}` : " ← مفتوح المدة"}
            </span>
          </p>
        </div>
        <div className="head-actions">
          <select value={p.status} onChange={changeStatus} className="status-select">
            {Object.entries(PROJECT_STATUS).map(([k, v]) =>
              <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button className="btn ghost" onClick={openEdit}>تعديل</button>
          <button className="btn ghost" onClick={regenerate} disabled={saving}>
            إعادة توليد الجدول
          </button>
        </div>
      </div>

      {banner && <div className="banner error">{banner}</div>}
      {notice && <div className="banner info" role="status">{notice}</div>}

      <div className="stat-grid">
        <Stat variant="accent" label="رأس المال" value={moneyShort(p.capitalFils)} />
        <Stat label="إجمالي المستحقات" value={moneyShort(s.scheduledFils)} />
        <Stat label="المُحصّل" value={moneyShort(s.paidFils)} />
        {Number(BigInt(s.overdueFils)) > 0
          ? <Stat variant="alert" label="متأخر" value={moneyShort(s.overdueFils)}
                  sub={`${s.overdueCount} دفعة`} />
          : <Stat label="المتبقي" value={moneyShort(s.remainingFils)} />}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>جدول الاستحقاق</h3>
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{p.dues.length} دفعة</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>البند</th><th>التاريخ</th>
              <th>المبلغ</th><th>المدفوع</th><th>الحالة</th><th></th>
            </tr>
          </thead>
          <tbody>
            {p.dues.map((d) => {
              const ds = STATUS[d.status];
              return (
                <tr key={d.id}>
                  <td className="num" style={{ color: "var(--ink-faint)" }}>
                    {d.kind === "PRINCIPAL" ? "—" : d.seq}
                  </td>
                  <td>
                    {d.kind === "PRINCIPAL"
                      ? <span className="badge gold">رد رأس المال</span>
                      : "ربح دوري"}
                  </td>
                  <td className="num">{date(d.dueDate)}</td>
                  <td className="num ltr">{money(d.amountFils)}</td>
                  <td className="num ltr" style={{ color: "var(--ink-soft)" }}>
                    {Number(BigInt(d.paidFils)) ? money(d.paidFils) : "—"}
                  </td>
                  <td><span className={"badge " + ds.cls}>{ds.label}</span></td>
                  <td>
                    {d.status !== "PAID" && (
                      <button className="btn ghost sm" onClick={() => openPay(d)}>
                        تسجيل دفعة
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head"><h3>الدفعات المسجّلة</h3></div>
        {p.payments.length === 0 ? (
          <div className="empty"><p>لا دفعات مسجّلة بعد.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>التاريخ</th><th>المبلغ</th><th>الطريقة</th>
                <th>المرجع</th><th>الإيصال</th><th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {p.payments.map((x) => (
                <tr key={x.id}>
                  <td className="num">{date(x.paidAt)}</td>
                  <td className="num ltr">{money(x.amountFils)}</td>
                  <td>{x.method || "—"}</td>
                  <td className="num">{x.reference || "—"}</td>
                  <td style={{ minWidth: 210 }}>
                    <Attachments paymentId={x.id} documents={x.documents} onChange={load} />
                  </td>
                  <td style={{ color: "var(--ink-soft)" }}>{x.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h3>مستندات المشروع</h3></div>
        <div className="card-body">
          <Attachments projectId={p.id} documents={p.documents} onChange={load} />
        </div>
      </div>

      <div className="card danger-zone">
        <div className="card-body">
          <div>
            <strong style={{ fontSize: 14 }}>حذف المشروع</strong>
            <div className="hint">
              يُحذف معه كل الاستحقاقات والدفعات والمستندات. لا يمكن التراجع.
            </div>
          </div>
          <button className="btn danger" onClick={removeProject}>حذف المشروع</button>
        </div>
      </div>

      {payFor && (
        <Modal
          title="تسجيل دفعة"
          onClose={() => setPayFor(null)}
          footer={
            <>
              <button className="btn gold" onClick={savePayment} disabled={saving}>
                {saving ? "جارٍ الحفظ…" : "حفظ الدفعة"}
              </button>
              <button className="btn ghost" onClick={() => setPayFor(null)}>إلغاء</button>
            </>
          }
        >
          <p style={{ marginTop: 0, color: "var(--ink-soft)", fontSize: 14 }}>
            {payFor.kind === "PRINCIPAL" ? "رد رأس المال" : `ربح دورة ${payFor.seq}`} ·{" "}
            استحقاق <span className="num">{date(payFor.dueDate)}</span> ·{" "}
            <span className="num ltr">{money(payFor.amountFils)}</span>
          </p>

          <div className="grid-2">
            <Field label="المبلغ المدفوع (د.أ)" hint="يمكن تسجيل دفعة جزئية">
              <input type="number" step="0.001" value={payForm.amount} onChange={setPay("amount")} />
            </Field>
            <Field label="تاريخ الدفع">
              <input type="date" value={payForm.paidAt} onChange={setPay("paidAt")} />
            </Field>
          </div>

          <div className="grid-2">
            <Field label="طريقة الدفع">
              <select value={payForm.method} onChange={setPay("method")}>
                <option>تحويل</option><option>نقدي</option><option>شيك</option>
              </select>
            </Field>
            <Field label="رقم المرجع" hint="رقم الحوالة أو الشيك">
              <input value={payForm.reference} onChange={setPay("reference")} />
            </Field>
          </div>

          <Field label="الإيصال"
                 hint={payFiles.length
                   ? `${payFiles.length} ملف مختار`
                   : "صور أو PDF · حتى 10 ميغابايت"}>
            <input type="file" multiple
                   accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                   onChange={(e) => setPayFiles([...e.target.files])} />
          </Field>

          <Field label="ملاحظات">
            <textarea rows="2" value={payForm.notes} onChange={setPay("notes")} />
          </Field>
        </Modal>
      )}

      {editing && editForm && (
        <Modal
          title="تعديل المشروع"
          onClose={() => setEditing(false)}
          footer={
            <>
              <button className="btn gold" onClick={saveEdit} disabled={saving}>
                {saving ? "جارٍ الحفظ…" : "حفظ التعديلات"}
              </button>
              <button className="btn ghost" onClick={() => setEditing(false)}>إلغاء</button>
            </>
          }
        >
          <div className="banner info" style={{ marginBottom: 16 }}>
            تعديل رأس المال أو النسبة أو التواريخ لا يغيّر الجدول الحالي. بعد الحفظ اضغط
            «إعادة توليد الجدول» — الاستحقاقات التي عليها دفعات لن تُمس.
          </div>
          <ProjectForm form={editForm} setForm={setEditForm}
                       partners={partners} errors={editErrors} />
        </Modal>
      )}
    </>
  );
}
