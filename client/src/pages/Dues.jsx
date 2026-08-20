import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { money, date, daysUntil, STATUS } from "../lib/format.js";

const RANGES = [
  { d: 7,   label: "٧ أيام" },
  { d: 30,  label: "٣٠ يوم" },
  { d: 90,  label: "٣ شهور" },
  { d: 365, label: "سنة" },
];

export default function Dues() {
  const [days, setDays] = useState(30);
  const [dues, setDues] = useState([]);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    api.dues(days).then(setDues).catch((e) => setBanner(e.message));
  }, [days]);

  const total = dues.reduce((s, d) => s + BigInt(d.amountFils), 0n);
  const late = dues.filter((d) => daysUntil(d.dueDate) < 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>الاستحقاقات</h2>
          <p>
            {dues.length} دفعة بقيمة <span className="num">{money(total)}</span>
            {late.length > 0 && ` · ${late.length} متأخرة`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {RANGES.map((r) => (
            <button key={r.d}
                    className={"btn sm " + (days === r.d ? "" : "ghost")}
                    onClick={() => setDays(r.d)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {banner && <div className="banner error">{banner}</div>}

      <div className="card">
        {dues.length === 0 ? (
          <div className="empty"><p>لا استحقاقات في هذه الفترة.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>التاريخ</th><th>المشروع</th><th>الشريك</th>
                <th>البند</th><th>المبلغ</th><th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {dues.map((d) => {
                const n = daysUntil(d.dueDate);
                const st = STATUS[d.status];
                return (
                  <tr key={d.id}>
                    <td>
                      <span className="num">{date(d.dueDate)}</span>
                      <div style={{
                        fontSize: 11.5,
                        color: n < 0 ? "var(--danger)" : "var(--ink-faint)",
                        fontWeight: n < 0 ? 600 : 400,
                      }}>
                        {n < 0 ? `متأخر ${Math.abs(n)} يوم` : n === 0 ? "اليوم" : `بعد ${n} يوم`}
                      </div>
                    </td>
                    <td>
                      <Link className="link" to={`/projects/${d.project.id}`}>
                        {d.project.name}
                      </Link>
                    </td>
                    <td>{d.partner.name}</td>
                    <td>
                      {d.kind === "PRINCIPAL"
                        ? <span className="badge gold">رد رأس المال</span>
                        : `ربح دورة ${d.seq}`}
                    </td>
                    <td className="num ltr">{money(d.amountFils)}</td>
                    <td><span className={"badge " + st.cls}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
