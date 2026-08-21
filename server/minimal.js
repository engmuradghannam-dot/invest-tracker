import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// Determine static directory
const staticDir = path.resolve(process.cwd(), "client/dist");
console.log("📁 CWD:", process.cwd());
console.log("📁 Static dir:", staticDir);
console.log("📁 Exists:", fs.existsSync(staticDir));

if (fs.existsSync(staticDir)) {
  const files = fs.readdirSync(staticDir);
  console.log("📁 Files:", files);
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API routes (mock data until DB is ready)
const mockData = {
  dashboard: {
    projectCount: 0,
    activeCount: 0,
    capitalFils: "0",
    scheduledFils: "0",
    paidFils: "0",
    overdueFils: "0",
    overdueCount: 0
  },
  projects: [],
  partners: [],
  dues: []
};

app.get("/api/dashboard", (_req, res) => res.json(mockData.dashboard));
app.get("/api/projects", (_req, res) => res.json(mockData.projects));
app.get("/api/partners", (_req, res) => res.json(mockData.partners));
app.get("/api/dues", (_req, res) => res.json(mockData.dues));

// Setup endpoint
app.get("/api/setup", (_req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running. Database setup needs to be done via Render Shell or local migration."
  });
});

// Serve static files
app.use(express.static(staticDir));

// SPA fallback
app.get("*", (_req, res) => {
  const indexPath = path.join(staticDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ 
      message: "Invest Tracker API", 
      endpoints: ["/health", "/api/test", "/api/setup"],
      error: "Static files not found"
    });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
