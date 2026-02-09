const express = require("express");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

const app = express();

/** CORS robusto */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = new Set(["https://guialar.net", "https://www.guialar.net"]);
  if (origin && allowed.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.use(express.json());

app.get("/", (req, res) => res.send("API OK ✅"));

function buildPdfBuffer({ largura, altura, total, email }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];

    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Orçamento de Cortinados", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Email do cliente: ${email}`);
    doc.text(`Largura: ${largura} m`);
    doc.text(`Altura: ${altura} m`);
    doc.text(`Total: €${total.toFixed(2)}`);
    doc.moveDown();
    doc.text("Obrigado, Guia Lar");
    doc.end();
  });
}

app.post("/api/orcamento", async (req, res) => {
  try {
    const { largura, altura, total, email } = req.body;

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ success: false, error: "Faltam EMAIL_USER/EMAIL_PASS" });
    }

    if (typeof largura !== "number" || typeof altura !== "number" || typeof total !== "number") {
      return res.status(400).json({ success: false, error: "largura/altura/total inválidos" });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Email inválido" });
    }

    // ✅ gerar PDF em memória
    const pdfBuffer = await buildPdfBuffer({ largura, altura, total, email });
    const fileName = `orcamento-${Date.now()}.pdf`;

    // ✅ SMTP Hostinger
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"Guia Lar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "O seu orçamento de cortinados",
      text: "Segue em anexo o seu orçamento em PDF.",
      attachments: [
        { filename: fileName, content: pdfBuffer }
      ]
    });

    // (opcional) enviar cópia para ti:
    // await transporter.sendMail({ to: "teuemail@...", ... });

    return res.json({ success: true });
  } catch (err) {
    console.error("ERRO /api/orcamento:", err);
    return res.status(500).json({ success: false, error: err.message || "Erro interno" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API a correr na porta", PORT));
