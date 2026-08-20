const BASE = "/api";

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "تعذّر إتمام الطلب");
    err.fields = data.fields;
    throw err;
  }
  return data;
}

export const api = {
  dashboard:  ()      => req("/dashboard"),
  partners:   ()      => req("/partners"),
  addPartner: (b)     => req("/partners", { method: "POST", body: JSON.stringify(b) }),
  projects:   ()      => req("/projects"),
  project:    (id)    => req(`/projects/${id}`),
  addProject: (b)     => req("/projects", { method: "POST", body: JSON.stringify(b) }),
  editProject:(id,b)  => req(`/projects/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  setStatus:  (id,s)  => req(`/projects/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: s }) }),
  regenerate: (id)    => req(`/projects/${id}/regenerate`, { method: "POST" }),
  delProject: (id)    => req(`/projects/${id}`, { method: "DELETE" }),
  dues:       (d=30)  => req(`/dues?days=${d}`),
  addPayment: (b)     => req("/payments", { method: "POST", body: JSON.stringify(b) }),
  delPayment: (id)    => req(`/payments/${id}`, { method: "DELETE" }),
  delDocument:(id)    => req(`/documents/${id}`, { method: "DELETE" }),
};

/** رفع الملفات: FormData بلا Content-Type — المتصفح يضبط الـ boundary بنفسه */
export async function uploadDocuments({ projectId, paymentId, files, title }) {
  const fd = new FormData();
  if (projectId) fd.append("projectId", projectId);
  if (paymentId) fd.append("paymentId", paymentId);
  if (title) fd.append("title", title);
  for (const f of files) fd.append("files", f);

  const res = await fetch("/api/documents", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "تعذّر رفع الملف");
  return data;
}

export const fileUrl = (id) => `/api/documents/${id}/file`;
