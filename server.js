const express = require("express");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const fs = require("fs");

const app = express();

/** ✅ CORS robusto + preflight */
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

app.post("/api/orcamento", async (req, res) => {
  try {
    // 1) Validar variáveis
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        success: false,
        error: "Faltam variáveis EMAIL_USER e/ou EMAIL_PASS"
      });
    }

    // 2) Ler e validar body
    const { largura, altura, total, email } = req.body;

    if (typeof largura !== "number" || typeof altura !== "number" || typeof total !== "number") {
      return res.status(400).json({
        success: false,
        error: "largura/altura/total têm de ser números"
      });
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        error: "Email inválido"
      });
    }

    // 3) Gerar PDF (em /tmp)
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
      doc.text(`Total: €${Number(total).toFixed(2)}`);

      doc.moveDown();
      doc.text("Obrigado por escolher a Guia Lar.");
      doc.end();
    });

    // 4) SMTP Hostinger
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // (opcional) ajuda a falhar com mensagem clara se credenciais estiverem erradas
    await transporter.verify();

    // 5) Enviar email com PDF
    await transporter.sendMail({
      from: `"Guia Lar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "O seu orçamento (PDF em anexo)",
      text: "Segue em anexo o seu orçamento. Obrigado!",
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on", PORT));
