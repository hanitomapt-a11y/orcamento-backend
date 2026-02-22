const express = require("express");
const fs = require("fs");

const app = express();

// logs para apanhar crashes
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

// CORS manual robusto
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

app.get("/", (req, res) => res.send("API GUIALAR OK ✅"));

// ===== Preçário (ajusta como quiseres) =====
function getPrecoBaseM2(tipo, acabamento) {
  const premium = acabamento === "premium";
  if (tipo === "cortinado") return premium ? 35 : 25;
  if (tipo === "estore") return premium ? 45 : 35;
  if (tipo === "japones") return premium ? 55 : 45;
  return premium ? 35 : 25;
}

function getMinimo(tipo) {
  if (tipo === "cortinado") return 80;
  if (tipo === "estore") return 120;
  if (tipo === "japones") return 150;
  return 80;
}

function calcTotal({ tipo, acabamento, largura, altura, instalacao, urgencia, calha, blackout }) {
  const area = Math.max(0, Number(largura) * Number(altura));
  let total = area * getPrecoBaseM2(tipo, acabamento);

  // extras
  if (instalacao === "com") total += 40;
  if (urgencia === "rapida") total += 25;
  if (blackout === "sim") total += area * 8;
  if (tipo === "cortinado" && calha && calha !== "nenhuma") total += 30;

  total = Math.max(total, getMinimo(tipo));
  return { area, total: Number(total.toFixed(2)) };
}

app.post("/orcamento", async (req, res) => {
  try {
    // lazy-load para evitar 503 no arranque
    const PDFDocument = require("pdfkit");
    const nodemailer = require("nodemailer");

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ success: false, error: "Faltam EMAIL_USER/EMAIL_PASS" });
    }

    const {
      tipo, acabamento, largura, altura,
      instalacao, urgencia, calha, blackout,
      cliente
    } = req.body || {};

    const email = cliente?.email;

    // validações mínimas
    if (!["cortinado", "estore", "japones"].includes(tipo)) {
      return res.status(400).json({ success: false, error: "Tipo inválido" });
    }
    if (typeof largura !== "number" || typeof altura !== "number" || largura <= 0 || altura <= 0) {
      return res.status(400).json({ success: false, error: "Medidas inválidas" });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Email inválido" });
    }

    const { area, total } = calcTotal({ tipo, acabamento, largura, altura, instalacao, urgencia, calha, blackout });

    // gerar PDF
    const fileName = `orcamento-${Date.now()}.pdf`;
    const filePath = `/tmp/${fileName}`;

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const stream = fs.createWriteStream(filePath);

      stream.on("finish", resolve);
      stream.on("error", reject);

      doc.pipe(stream);

      doc.fontSize(20).text("Orçamento — Guia Lar", { align: "center" });
      doc.moveDown();

      doc.fontSize(12).text(`Data: ${new Date().toLocaleString("pt-PT")}`);
      doc.moveDown();

      doc.fontSize(14).text("Cliente");
      doc.fontSize(12).text(`Nome: ${cliente?.nome || "-"}`);
      doc.text(`Email: ${email}`);
      doc.text(`Telefone: ${cliente?.telefone || "-"}`);
      doc.text(`Localidade: ${cliente?.localidade || "-"}`);

      doc.moveDown();
      doc.fontSize(14).text("Pedido");
      doc.fontSize(12).text(`Tipo: ${tipo}`);
      doc.text(`Acabamento: ${acabamento || "standard"}`);
      doc.text(`Medidas: ${largura.toFixed(2)} m × ${altura.toFixed(2)} m`);
      doc.text(`Área: ${area.toFixed(2)} m²`);
      doc.text(`Instalação: ${instalacao || "sem"}`);
      doc.text(`Urgência: ${urgencia || "normal"}`);
      doc.text(`Calha/Varão: ${calha || "nenhuma"}`);
      doc.text(`Blackout: ${blackout || "nao"}`);

      doc.moveDown();
      doc.fontSize(16).text(`Total estimado: €${total.toFixed(2)}`);

      doc.moveDown();
      doc.fontSize(10).fillColor("#444")
        .text("Nota: Este valor é estimativo. A confirmação final pode depender de validação no local e materiais escolhidos.");

      doc.end();
    });

    // enviar email
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.verify();

    const mailOptions = {
      from: `"Guia Lar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "O seu orçamento — Guia Lar (PDF em anexo)",
      text: "Segue em anexo o seu orçamento em PDF. Obrigado!",
      attachments: [{ filename: fileName, path: filePath }]
    };

    await transporter.sendMail(mailOptions);

    // (opcional) cópia para ti (ativa se quiseres)
    if (process.env.EMAIL_CC && process.env.EMAIL_CC.includes("@")) {
      await transporter.sendMail({
        ...mailOptions,
        to: process.env.EMAIL_CC,
        subject: "CÓPIA — Pedido de Orçamento (PDF)"
      });
    }

    return res.json({ success: true, total });
  } catch (err) {
    console.error("ERRO /orcamento:", err);
    return res.status(500).json({ success: false, error: err.message || "Erro interno" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API a correr na porta", PORT));
