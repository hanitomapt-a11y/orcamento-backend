const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const fs = require("fs");

const app = express();

app.use(cors({
  origin: ["https://guialar.net", "https://www.guialar.net"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.options("*", cors());
app.use(express.json());

app.get("/", (req, res) => res.send("API de Orçamentos a funcionar ✅"));

function assertEnv() {
  const missing = [];
  if (!process.env.EMAIL_USER) missing.push("EMAIL_USER");
  if (!process.env.EMAIL_PASS) missing.push("EMAIL_PASS");
  return missing;
}

app.post("/api/orcamento", async (req, res) => {
  try {
    const missingEnv = assertEnv();
    if (missingEnv.length) {
      return res.status(500).json({
        success: false,
        error: `Faltam variáveis de ambiente: ${missingEnv.join(", ")}`
      });
    }

    const { largura, altura, total, email } = req.body;

    if (typeof largura !== "number" || typeof altura !== "number" || typeof total !== "number") {
      return res.status(400).json({ success: false, error: "largura/altura/total têm de ser números" });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Email inválido" });
    }

    // 1) Gerar PDF para /tmp
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
      doc.text(`Total: €${total.toFixed(2)}`);
      doc.end();
    });

    // 2) SMTP Hostinger (recomendado 587 + STARTTLS)
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Testar SMTP (se falhar, apanhas aqui com mensagem clara)
    await transporter.verify();

    // 3) Enviar email com anexo
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor ativo na porta", PORT));
