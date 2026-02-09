const express = require("express");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const fs = require("fs");

const app = express();

/* =======================
   CORS (guialar.net)
======================= */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "https://guialar.net",
    "https://www.guialar.net"
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

app.use(express.json());

/* =======================
   HEALTH CHECK
======================= */
app.get("/", (req, res) => {
  res.send("API GUIALAR OK ✅");
});

/* =======================
   ORÇAMENTO
======================= */
app.post("/api/orcamento", async (req, res) => {
  try {
    console.log("BODY RECEBIDO:", req.body);

    const { largura, altura, email } = req.body;

    // validações básicas
    if (
      typeof largura !== "number" ||
      typeof altura !== "number" ||
      !email ||
      !email.includes("@")
    ) {
      return res.status(400).json({
        success: false,
        error: "Dados inválidos"
      });
    }

    // cálculo simples (podes mudar depois)
    const precoPorMetroQuadrado = 10;
    const total = largura * altura * precoPorMetroQuadrado;

    // gerar PDF
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

      doc.moveDown();
      doc.text("Obrigado por escolher a Guia Lar.");

      doc.end();
    });

    // transporter Hostinger
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Guia Lar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "O seu orçamento – Guia Lar",
      text: "Segue em anexo o seu orçamento em PDF.",
      attachments: [
        {
          filename: fileName,
          path: filePath
        }
      ]
    });

    res.json({ success: true });
  } catch (err) {
    console.error("ERRO API:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Erro interno"
    });
  }
});

/* =======================
   START
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("API a correr na porta", PORT);
});
