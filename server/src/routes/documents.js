import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve("uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// أنواع الإيصالات المقبولة — لا نقبل أي ملف تنفيذي
const ALLOWED = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // اسم عشوائي على القرص: يمنع تصادم الأسماء ومحاولات اجتياز المسار
    const ext = path.extname(file.originalname).slice(0, 10).replace(/[^.\w]/g, "");
    cb(null, crypto.randomUUID() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error("نوع الملف غير مدعوم — الصور و PDF فقط"));
    }
    cb(null, true);
  },
});

export default function documentRoutes(prisma) {
  const r = Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  /** رفع إيصال أو مستند — يُربط بمشروع أو بدفعة */
  r.post("/documents", upload.array("files", 5), wrap(async (req, res) => {
    const { projectId, paymentId, title } = req.body;
    if (!projectId && !paymentId) {
      return res.status(400).json({ error: "حدّد المشروع أو الدفعة" });
    }
    if (!req.files?.length) {
      return res.status(400).json({ error: "لم يُرفَع أي ملف" });
    }

    const created = await prisma.$transaction(
      req.files.map((f) => prisma.document.create({
        data: {
          title: title || Buffer.from(f.originalname, "latin1").toString("utf8"),
          storage: "local",
          fileRef: f.filename,
          mimeType: f.mimetype,
          sizeBytes: f.size,
          projectId: projectId || null,
          paymentId: paymentId || null,
        },
      }))
    );
    res.status(201).json(created);
  }));

  /** تنزيل — المسار يُبنى من السجل، لا من مدخلات المستخدم */
  r.get("/documents/:id/file", wrap(async (req, res) => {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: "المستند غير موجود" });

    const full = path.join(UPLOAD_DIR, path.basename(doc.fileRef));
    if (!fs.existsSync(full)) return res.status(410).json({ error: "الملف مفقود من التخزين" });

    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(doc.title)}`
    );
    fs.createReadStream(full).pipe(res);
  }));

  r.delete("/documents/:id", wrap(async (req, res) => {
    const doc = await prisma.document.delete({ where: { id: req.params.id } });
    fs.rm(path.join(UPLOAD_DIR, path.basename(doc.fileRef)), { force: true }, () => {});
    res.status(204).end();
  }));

  return r;
}

export { upload };
