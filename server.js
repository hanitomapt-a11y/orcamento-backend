const express = require("express");
const fs = require("fs");

const app = express();

/* ===== logs para apanhar crashes ===== */
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

/* ===== CORS manual robusto ===== */
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

/* ===== health ===== */
app.get("/", (req, res) => {
  res.send("API GUIALAR OK ✅");
});

/* ===== orçamento ===== */
app.post("/api/orcamento", async (req, res) => {
  try {
    // ✅ Importar só aqui (evita crash no arranque)
    const PDFDocument = require("pdfkit");
    const nodemailer = require("nodemailer");

    const { largura, altura, email } = req.body;

    if (typeof largura !== "number" || typeof altura !== "number") {
      return res.status(400).json({ success: false, error: "largura/altura inválidos" });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "email inválido" });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ success: false, error: "Faltam EMAIL_USER/EMAIL_PASS" });
    }

    // total simples (podes mudar depois)
    const total = largura * altura * 10;

    // PDF em /tmp
    const fileName = `orcamento-${Date.now()}.pdf`;
    const filePath = `/tmp/${fileName}`;

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const stream = fs.createWriteStream(filePath);

      stream.on("finish", resolve);
      stream.on("error", reject);

      doc.pipe(stream);
      doc.fontSize(20).text("Orçamento de Cortinados", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Largura: ${largura} m`);
      doc.text(`Altura: ${altura} m`);
      doc.moveDown();
      doc.text(`Total estimado: €${total.toFixed(2)}`);
      doc.end();
    });

    // SMTP Hostinger
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Guia Lar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "O seu orçamento – Guia Lar",
      text: "Segue em anexo o seu orçamento em PDF.",
      attachments: [{ filename: fileName, path: filePath }]
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("ERRO /api/orcamento:", err);
    return res.status(500).json({ success: false, error: err.message || "Erro interno" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API a correr na porta", PORT));
