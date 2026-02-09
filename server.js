const express = require("express");
const app = express();

// ✅ CORS robusto + preflight
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ["https://guialar.net", "https://www.guialar.net"];

  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end(); // ✅ responde ao preflight
  }

  next();
});

app.use(express.json());


const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("API OK — servidor arrancou ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor a correr na porta", PORT);
});

