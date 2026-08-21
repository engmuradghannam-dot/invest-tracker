import { createRequire } from "module";
const require = createRequire(import.meta.url);

console.log("🚀 Starting Invest Tracker...");
console.log("📁 CWD:", process.cwd());
console.log("🔌 PORT:", process.env.PORT || 4000);
console.log("🗄️  DATABASE_URL exists:", !!process.env.DATABASE_URL);

try {
  // Try to import and start the main app
  await import("./src/index.js");
} catch (e) {
  console.error("❌ Fatal error during startup:", e.message);
  console.error(e.stack);

  // Start a minimal fallback server
  const express = require("express");
  const app = express();

  app.get("/health", (_req, res) => res.json({ status: "error", error: e.message }));
  app.get("*", (_req, res) => res.status(500).json({ 
    error: "Server startup failed", 
    details: e.message,
    stack: e.stack 
  }));

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`⚠️  Fallback server running on port ${PORT}`);
  });
}
