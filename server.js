const express = require("express");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "https://guialar.net" }));
app.use(express.json());

app.get("/", (req, res) => res.send("API de Orçamentos a funcionar ✅"));

app.post("/api/orcamento", async (req, res) => {
  try {
    const { largura, altura, total, email } = req.body;

    if (!largura || !altura || !email || typeof total !== "number") {
      return res.status(400).json({ success: false, error: "Dados inválidos" });
    }

    const fileName = `orcamento-${Date.now()}.pdf`;
    const filePath = `/tmp/${fileName}`;

    // Gerar PDF
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

    // SMTP (Hostinger)
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
