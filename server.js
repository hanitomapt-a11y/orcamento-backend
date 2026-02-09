app.post("/api/orcamento", async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Guia Lar" <${process.env.EMAIL_USER}>`,
      to: req.body.email,
      subject: "Teste SMTP",
      text: "Se recebeste isto, o email está configurado."
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
