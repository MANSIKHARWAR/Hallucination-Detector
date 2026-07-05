const API_BASE = ""; // same origin

const askBtn = document.getElementById("askBtn");
const questionInput = document.getElementById("questionInput");
const loading = document.getElementById("loading");
const resultBox = document.getElementById("result");

let chart = null;

askBtn.addEventListener("click", handleAsk);
questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleAsk();
});
document.getElementById("refreshHistory").addEventListener("click", loadHistory);

async function handleAsk() {
  const question = questionInput.value.trim();
  if (!question) return;

  resultBox.classList.add("hidden");
  loading.classList.remove("hidden");

  try {
    // Step 1: get raw LLM answer
    const chatRes = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const chatData = await chatRes.json();

    // Step 2: verify the answer against trusted sources
    const verifyRes = await fetch(`${API_BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatData.chat_id }),
    });
    const verifyData = await verifyRes.json();

    renderResult(verifyData);
    loadHistory();
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    loading.classList.add("hidden");
  }
}

function renderResult(data) {
  document.getElementById("qText").textContent = data.question;
  document.getElementById("aText").textContent = data.answer;

  const score = data.overall_hallucination_score;
  document.getElementById("meterFill").style.width = `${score}%`;
  document.getElementById("scoreLabel").textContent = `${score}%`;
  document.getElementById("overallStatus").textContent = `Overall: ${data.overall_status}`;

  const claimsList = document.getElementById("claimsList");
  claimsList.innerHTML = "";

  data.claims.forEach((c) => {
    const div = document.createElement("div");
    div.className = `claim-item ${c.status}`;

    const evidenceHtml = c.evidence
      .map(
        (e) =>
          `<div>• <a href="${e.url || "#"}" target="_blank">${e.source}</a></div>`
      )
      .join("");

    div.innerHTML = `
      <div class="claim-text">${c.claim}</div>
      <div class="claim-meta">Status: <b>${c.status}</b> | Confidence: ${(c.confidence * 100).toFixed(1)}% | Hallucination score: ${c.hallucination_score}%</div>
      <div class="claim-explanation">${c.explanation}</div>
      <div class="evidence-list">${evidenceHtml}</div>
    `;
    claimsList.appendChild(div);
  });

  renderChart(data.claims);
  resultBox.classList.remove("hidden");
}

function renderChart(claims) {
  const ctx = document.getElementById("claimChart").getContext("2d");
  const labels = claims.map((c, i) => `Claim ${i + 1}`);
  const scores = claims.map((c) => 100 - c.hallucination_score); // "correctness" %

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Estimated Correctness %",
          data: scores,
          backgroundColor: scores.map((s) =>
            s >= 70 ? "#22c55e" : s >= 40 ? "#eab308" : "#ef4444"
          ),
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { color: "#9aa0ac" } },
        x: { ticks: { color: "#9aa0ac" } },
      },
      plugins: { legend: { labels: { color: "#e6e6e6" } } },
    },
  });
}

async function loadHistory() {
  const res = await fetch(`${API_BASE}/history`);
  const items = await res.json();
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  items.forEach((h) => {
    const div = document.createElement("div");
    div.className = "history-item";
    const score = h.overall_hallucination_score;
    div.innerHTML = `${h.question} ${score !== null ? `<span class="h-score">${score}%</span>` : ""}`;
    list.appendChild(div);
  });
}

// Load history on first page load
loadHistory();
