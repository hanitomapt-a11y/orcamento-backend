const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

dotenv.config();

const app = express();

app.use(express.json({ limit: "2mb" }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// ---------- helpers ----------
function readJson(filePath) {
  const full = path.join(__dirname, filePath);
  const txt = fs.readFileSync(full, "utf8");
  return JSON.parse(txt);
}

function euros(n) {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return `${num.toFixed(2)}€`;
}

function safeStr(v) {
  return String(v ?? "").trim();
}

// gera PDF em Buffer
function generateBudgetPdf({ payload, tecidoObj, calhaObj, totalEstimado }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];

    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Cabeçalho
    doc.fontSize(20).text("Orçamento - Guia Lar", { bold: true });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#555").text(`Data: ${new Date().toLocaleString("pt-PT")}`);
    doc.fillColor("#000");
    doc.moveDown(1);

    const { produto, tecido, tipoCortina, medidas, calha, servicos, cliente } = payload;

    // Cliente
    doc.fontSize(12).text("Dados do Cliente", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10)
      .text(`Nome: ${safeStr(cliente?.nome)}`)
      .text(`Telemóvel: ${safeStr(cliente?.telemovel)}`)
      .text(`Email: ${safeStr(cliente?.email)}`)
      .text(`Morada: ${safeStr(cliente?.rua)}`)
      .text(`Código Postal: ${safeStr(cliente?.codigoPostal)}`)
      .text(`Cidade: ${safeStr(cliente?.cidade)}`);
    doc.moveDown(1);

    // Pedido
    doc.fontSize(12).text("Detalhes do Pedido", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10)
      .text(`Produto: ${safeStr(produto)}`)
      .text(`Tecido: ${safeStr(tecidoObj?.nome || tecido)}`);

    if (produto === "cortinado") {
      doc.text(`Tipo de cortina: ${safeStr(tipoCortina)}`);
      doc.text(`Janelas: ${safeStr(medidas?.janelas)}`);
      doc.text(`Divisão: ${safeStr(medidas?.divisao)}`);
      doc.text(`Calha (suporte): ${safeStr(calha?.colocacao)}`);
      doc.text(`Tipo de calha: ${safeStr(calhaObj?.nome || calha?.tipoCalhaId)}`);
    }

    doc.text(`Largura: ${safeStr(medidas?.largura)} cm`);
    doc.text(`Comprimento: ${safeStr(medidas?.comprimento)} cm`);
    doc.text(`Serviço de tirar medidas: ${safeStr(medidas?.tirarMedidas)}`);
    doc.text(`Serviço de colocação: ${safeStr(servicos?.colocacao)}`);

    if (safeStr(cliente?.infoAdicional)) {
      doc.moveDown(0.6);
      doc.fontSize(12).text("Informações adicionais", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).text(safeStr(cliente?.infoAdicional));
    }

    doc.moveDown(1);

    // Estimativa / preços (simples e flexível)
    doc.fontSize(12).text("Estimativa", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10);

    const tecidoPreco = tecidoObj?.preco;
    const calhaPreco = calhaObj?.preco;

    doc.text(`Preço tecido (referência): ${tecidoPreco != null ? euros(tecidoPreco) : "Sob orçamento"}`);
    if (produto === "cortinado") {
      doc.text(`Preço calha (referência): ${calhaPreco != null ? euros(calhaPreco) : "Sob orçamento"}`);
    }

    if (totalEstimado != null) {
      doc.moveDown(0.3);
      doc.fontSize(12).text(`Total estimado: ${euros(totalEstimado)}`, { bold: true });
      doc.fontSize(9).fillColor("#555").text("Nota: Total estimado automático, sujeito a confirmação após validação de medidas e instalação.");
      doc.fillColor("#000");
    } else {
      doc.moveDown(0.3);
      doc.fontSize(11).text("Total: Sob orçamento (iremos confirmar por email/telefone).", { bold: true });
    }

    doc.moveDown(1.2);
    doc.fontSize(9).fillColor("#555").text("Guia Lar • Obrigado pelo seu pedido.");
    doc.end();
  });
}

// cálculo simples (podes afinar depois)
function estimateTotal(payload, tecidoObj, calhaObj) {
  // Se não houver preços, devolve null (fica “Sob orçamento”)
  const tecidoPreco = tecidoObj?.preco;
  const calhaPreco = calhaObj?.preco;

  if (tecidoPreco == null && calhaPreco == null) return null;

  const larguraCm = Number(payload?.medidas?.largura || 0);
  const compCm = Number(payload?.medidas?.comprimento || 0);

  // área em m2 (aprox) para dar um número automático
  const areaM2 = larguraCm > 0 && compCm > 0 ? (larguraCm / 100) * (compCm / 100) : 1;

  let total = 0;

  if (tecidoPreco != null) {
    // assume “preco” é €/m2 (padrão). Se não for, muda aqui.
    total += Number(tecidoPreco) * areaM2;
  }

  if (payload?.produto === "cortinado" && calhaPreco != null) {
    total += Number(calhaPreco);
  }

  // serviços (valores fixos de exemplo — muda como quiseres)
  if (payload?.medidas?.tirarMedidas === "sim") total += 20;
  if (payload?.servicos?.colocacao === "sim") total += 35;

  // arredonda
  return Math.round(total * 100) / 100;
}

// ---------- rotas ----------
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/catalog/tecidos", (req, res) => {
  const tipo = String(req.query.tipo || "").toLowerCase(); // cortinado|estore|japones
  const all = readJson("data/tecidos.json");
  const out = tipo ? all.filter((t) => String(t.tipo).toLowerCase() === tipo) : all;
  res.json(out);
});

app.get("/api/catalog/calhas", (req, res) => {
  const all = readJson("data/calhas.json");
  res.json(all);
});

app.post("/api/orcamento", async (req, res) => {
  try {
    const payload = req.body;

    // validações mínimas (o teu frontend já valida, mas aqui garante)
    const produto = safeStr(payload?.produto);
    const email = safeStr(payload?.cliente?.email);

    if (!["cortinado", "estore", "japones"].includes(produto)) {
      return res.status(400).json({ error: "Produto inválido." });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Email inválido." });
    }

    // carregar catálogos e encontrar os itens escolhidos
    const tecidos = readJson("data/tecidos.json");
    const calhas = readJson("data/calhas.json");

    const tecidoObj =
      tecidos.find((t) => String(t.id) === String(payload?.tecidoId)) ||
      tecidos.find((t) => String(t.nome) === String(payload?.tecido)) ||
      null;

    const calhaObj =
      produto === "cortinado"
        ? (calhas.find((c) => String(c.id) === String(payload?.calha?.tipoCalhaId)) || null)
        : null;

    const totalEstimado = estimateTotal(payload, tecidoObj, calhaObj);

    // gerar PDF
    const pdfBuffer = await generateBudgetPdf({ payload, tecidoObj, calhaObj, totalEstimado });

    // SMTP transport
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || "true") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // opcional: verifica ligação
    await transporter.verify();

    const nomeCliente = safeStr(payload?.cliente?.nome) || "Cliente";
    const assunto = `Orçamento Guia Lar - ${nomeCliente}`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <p>Olá <b>${nomeCliente}</b>,</p>
        <p>Em anexo segue o PDF com o seu pedido de orçamento.</p>
        <p>Se precisar de ajuda, responda a este email.</p>
        <p>— Guia Lar</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,
      bcc: process.env.MAIL_BCC || undefined,
      subject: assunto,
      html,
      attachments: [
        {
          filename: "orcamento-guialar.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return res.json({ ok: true, messageId: info.messageId || null });
  } catch (e) {
    console.error("ERRO /api/orcamento:", e);
    return res.status(500).json({ error: e?.message || "Erro interno ao gerar/enviar orçamento." });
  }
});

// ---------- start ----------
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`API a correr na porta ${PORT}`));
