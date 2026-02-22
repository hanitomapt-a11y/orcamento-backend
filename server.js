const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

const app = express();

// IMPORTANT: CORS para permitir chamadas do guialar.net
app.use(cors({
  origin: ["https://guialar.net", "https://www.guialar.net"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.status(200).send("API Guia Lar a funcionar ✅");
});

// Helper: cria PDF em memória (Buffer)
function gerarPdfTeste({ largura, altura, email }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text("Orçamento (Teste) — Guia Lar", { align: "left" });
      doc.moveDown(0.8);

      doc.fontSize(12).fillColor("#111827");
      doc.text(`Cliente: ${email}`);
      doc.text(`Largura da janela: ${largura} cm`);
      doc.text(`Altura da janela: ${altura} cm`);
      doc.moveDown(1);

      // Exemplo de cálculo simples (apenas para teste)
      const areaM2 = (largura / 100) * (altura / 100);
      const precoBase = 45; // €/m2 (exemplo)
      const total = Math.round(areaM2 * precoBase * 100) / 100;

      doc.text(`Área (aprox.): ${areaM2.toFixed(2)} m²`);
      doc.text(`Preço base (exemplo): ${precoBase.toFixed(2)} €/m²`);
      doc.moveDown(0.6);
      doc.fontSize(14).text(`TOTAL (exemplo): ${total.toFixed(2)} €`, { underline: true });

      doc.moveDown(2);
      doc.fontSize(10).fillColor("#6b7280");
      doc.text("Nota: Este PDF é um teste automático. O preço é meramente ilustrativo.");

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

// Endpoint de teste
app.post("/orcamento/teste", async (req, res) => {
  try {
    const { largura, altura, email } = req.body || {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email inválido." });
    }
    const w = Number(largura);
    const h = Number(altura);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
      return res.status(400).json({ error: "Medidas inválidas. Usa números > 0." });
    }

    // 1) gerar PDF
    const pdfBuffer = await gerarPdfTeste({ largura: w, altura: h, email });

    // 2) configurar transporte SMTP (ENV VARS)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true", // true se 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    // 3) enviar email com anexo
    await transporter.sendMail({
      from,
      to: email,
      subject: "Orçamento (Teste) — Guia Lar",
      text: `Olá! Segue em anexo o PDF de teste com as medidas (${w}cm x ${h}cm).`,
      attachments: [
        {
          filename: "orcamento-teste-guialar.pdf",
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    });

    return res.json({ message: "Email enviado com sucesso ✅ (verifica a caixa de entrada/spam)" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao gerar/enviar o orçamento. Vê os logs do Node." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API a correr na porta", PORT));
