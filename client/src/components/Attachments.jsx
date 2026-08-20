import { useRef, useState } from "react";
import { uploadDocuments, fileUrl, api } from "../lib/api.js";

const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " م.ب" : Math.round(n / 1024) + " ك.ب");

export default function Attachments({ projectId, paymentId, documents = [], onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function pick(e) {
    const files = [...e.target.files];
    if (!files.length) return;
    setBusy(true); setError(null);
    try {
      await uploadDocuments({ projectId, paymentId, files });
      await onChange();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  async function remove(id) {
    setBusy(true); setError(null);
    try { await api.delDocument(id); await onChange(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {error && <div className="banner error" style={{ marginBottom: 12 }}>{error}</div>}

      {documents.length > 0 && (
        <ul className="doc-list">
          {documents.map((d) => (
            <li key={d.id}>
              <a className="link" href={fileUrl(d.id)} target="_blank" rel="noreferrer">
                {d.title}
              </a>
              <span className="doc-meta num">{d.sizeBytes ? kb(d.sizeBytes) : ""}</span>
              <button className="btn ghost sm" onClick={() => remove(d.id)} disabled={busy}>
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}

      <input ref={input} type="file" multiple hidden onChange={pick}
             accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" />
      <button className="btn ghost sm" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? "جارٍ الرفع…" : "إرفاق إيصال"}
      </button>
      <div className="hint" style={{ marginTop: 6 }}>صور أو PDF · حتى 10 ميغابايت</div>
    </div>
  );
}
