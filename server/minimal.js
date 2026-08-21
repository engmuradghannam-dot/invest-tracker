import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/test", (_req, res) => {
  res.json({ message: "Server is running!" });
});

app.get("*", (_req, res) => {
  res.json({ message: "Invest Tracker API", endpoints: ["/health", "/api/test", "/api/setup"] });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Minimal server running on port ${PORT}`);
});
