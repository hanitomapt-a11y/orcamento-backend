const express = require("express");
const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ["https://guialar.net", "https://www.guialar.net"];

  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.use(express.json());

app.get("/", (req, res) => res.send("API OK ✅"));

app.post("/api/orcamento", (req, res) => {
  res.json({ success: true, received: req.body });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on", PORT));
