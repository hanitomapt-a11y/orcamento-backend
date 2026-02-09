<script>
document.getElementById("orcamentoForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const largura = Number(document.getElementById("largura").value) / 100;
  const altura  = Number(document.getElementById("altura").value) / 100;
  const email   = document.getElementById("email").value.trim();
  const total   = (largura * altura) * 25;

  const out = document.getElementById("resultado");
  out.innerText = "A enviar por email...";

  try {
    const res = await fetch("https://api.guialar.net/api/orcamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ largura, altura, total, email })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || ("HTTP " + res.status));

    out.innerText = "Orçamento enviado ✅ (confere spam)";
  } catch (err) {
    out.innerText = "Erro ❌: " + err.message;
  }
});
</script>
