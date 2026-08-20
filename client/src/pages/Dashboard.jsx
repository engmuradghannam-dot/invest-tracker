import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { money, moneyShort, date, daysUntil, STATUS } from "../lib/format.js";
import { Stat } from "../components/Field.jsx";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [dues, setDues] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.dashboard(), api.dues(30)])
      .then(([s, d]) => { setStats(s); setDues(d); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="banner error">{error}</div>;
  if (!stats) return <div className="empty">جارٍ التحميل…</div>;

  const collected = Number(BigInt(stats.scheduledFils))
    ? Number(BigInt(stats.paidFils)) / Number(BigInt(stats.scheduledFils)) * 100
    : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>لوحة المتابعة</h2>
          <p>{stats.activeCount} مشروع نشط من أصل {stats.projectCount}</p>
        </div>
      </div>

      <div className="stat-grid">
        <Stat variant="accent" label="رأس المال المستثمر"
              value={moneyShort(stats.capitalFils)}
              sub="المشاريع النشطة فقط" />
        <Stat label="إجمالي المستحقات"
              value={moneyShort(stats.scheduledFils)}
              sub="أرباح ورد رأس مال" />
        <Stat label="المُحصّل"
              value={moneyShort(stats.paidFils)}
              sub={`${collected.toFixed(1)}% من المجدول`} />
        {Number(BigInt(stats.overdueFils)) > 0 ? (
          <Stat variant="alert" label="متأخر"
                value={moneyShort(stats.overdueFils)}
                sub={`${stats.overdueCount} دفعة`} />
        ) : (
          <Stat label="متأخر" value="لا يوجد" sub="كل الدفعات في موعدها" />
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>استحقاقات الثلاثين يوماً القادمة</h3>
          <Link className="link" to="/dues">عرض الكل</Link>
        </div>

        {dues.length === 0 ? (
          <div className="empty"><p>لا استحقاقات خلال الشهر القادم.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>المشروع</th><th>الشريك</th><th>البند</th>
                <th>التاريخ</th><th>المبلغ</th><th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {dues.slice(0, 10).map((d) => {
                const days = daysUntil(d.dueDate);
                const st = STATUS[d.status];
                return (
                  <tr key={d.id}>
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
                    <td>
                      <span className="num">{date(d.dueDate)}</span>
                      <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                        {days < 0 ? `متأخر ${Math.abs(days)} يوم`
                          : days === 0 ? "اليوم" : `بعد ${days} يوم`}
                      </div>
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
