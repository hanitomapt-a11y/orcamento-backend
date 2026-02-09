const express = require("express");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const fs = require("fs");

const app = express();

/**
 * ✅ CORS manual (mais fiável em alojamentos que mexem com headers)
 * Permite guialar.net chamar a API.
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  const allowed = new Set([
    "https://guialar.net",
    "https://www.guialar.net",
  ]);

  if (origin && allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Responder ao preflight SEMPRE
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("API de Orçamentos a funcionar ✅");
});

app.post("/api/orcamento", async (req, res) => {
  try {
    const { largura, altura, total, email } = req.body;

    // Validar env
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        success: false,
        error: "Faltam variáveis EMAIL_USER / EMAIL_PASS"
      });
    }

    // Validar dados
    if (typeof largura !== "number" || typeof altura !== "number" || typeof total !== "number") {
      return res.status(400).json({ success: false, error: "largura/altura/total têm de ser números" });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Email inválido" });
    }

    // Gerar PDF em /tmp
    const fileName = `orcamento-${Date.now()}.pdf`;
    const filePath = `/tmp/${fileName}`;

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);
      stream.on("finish", resolve);
      stream.on("error", reject);

      doc.pipe(stream);
      doc.fontSize(20).text("Orçamento de Cortinados", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Largura: ${largura} m`);
      doc.text(`Altura: ${altura} m`);
      doc.text(`Total: €${Number(total).toFixed(2)}`);
      doc.end();
    });

    // SMTP Hostinger
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Se isto falhar, apanhas erro legível
    await transporter.verify();

    await transporter.sendMail({
      from: `"Guia Lar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "O seu orçamento de cortinados",
      text: "Segue em anexo o seu orçamento.",
      attachments: [{ filename: fileName, path: filePath }]
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("ERRO /api/orcamento:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Erro interno"
    });
  }
});

// Para evitar crash silencioso
process.on("unhandledRejection", (err) => console.error("unhandledRejection", err));
process.on("uncaughtException", (err) => console.error("uncaughtException", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor ativo na porta", PORT));
