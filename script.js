const API = "http://127.0.0.1:5000";

// ── Build V1–V28 input fields dynamically ──────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  buildVFields("v1-v14",  1,  14);
  buildVFields("v15-v28", 15, 28);
  checkAPIStatus();
});

function buildVFields(containerId, start, end) {
  const container = document.getElementById(containerId);
  for (let i = start; i <= end; i++) {
    const div = document.createElement("div");
    div.className = "auto-field";
    div.innerHTML = `
      <label>V${i}</label>
      <input type="number" step="any" id="V${i}" name="V${i}"
             placeholder="0.000000" required />
    `;
    container.appendChild(div);
  }
}

// ── Check API health on load ───────────────────────────────────────
async function checkAPIStatus() {
  const bar = document.getElementById("api-status");
  try {
    const res = await fetch(`${API}/`);
    if (res.ok) {
      bar.textContent = "✅ Detection engine connected";
      bar.className = "status-bar connected";
    } else {
      throw new Error();
    }
  } catch {
    bar.textContent = "❌ API offline — start Flask server: python app.py";
    bar.className = "status-bar error";
  }
}

// ── Load a sample transaction from the backend ────────────────────
async function loadSample() {
  const btn = document.getElementById("load-sample-btn");
  btn.textContent = "⏳ Loading...";
  btn.disabled = true;
  try {
    const res  = await fetch(`${API}/sample`);
    const data = await res.json();
    for (const [key, value] of Object.entries(data)) {
      const el = document.getElementById(key);
      if (el) el.value = value;
    }
  } catch {
    alert("Could not load sample — is the Flask server running?");
  } finally {
    btn.textContent = "📥 Load Sample Transaction";
    btn.disabled = false;
  }
}

// ── Clear the form ────────────────────────────────────────────────
function clearForm() {
  document.getElementById("transaction-form").reset();
  const panel = document.getElementById("result-panel");
  panel.classList.add("hidden");
  panel.className = "result-panel hidden";
}

// ── Collect form values ────────────────────────────────────────────
function getFormData() {
  const data = {};
  const fields = ["Time", "Amount", ...Array.from({length: 28}, (_, i) => `V${i+1}`)];
  for (const name of fields) {
    const el = document.getElementById(name);
    if (!el) { alert(`Field ${name} not found`); return null; }
    data[name] = parseFloat(el.value);
  }
  return data;
}

// ── Analyze transaction ───────────────────────────────────────────
async function analyzeTransaction(event) {
  event.preventDefault();
  const btn   = document.getElementById("analyze-btn");
  const panel = document.getElementById("result-panel");

  const payload = getFormData();
  if (!payload) return;

  btn.disabled    = true;
  btn.textContent = "⏳ Analyzing...";
  panel.classList.add("hidden");

  try {
    const res    = await fetch(`${API}/predict`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.error) {
      alert("API Error: " + result.error);
      return;
    }

    displayResult(result);

  } catch (err) {
    alert("Connection failed. Make sure Flask is running on port 5000.");
  } finally {
    btn.disabled    = false;
    btn.textContent = "🔍 Analyze Transaction";
  }
}

// ── Display result ─────────────────────────────────────────────────
function displayResult(result) {
  const panel      = document.getElementById("result-panel");
  const icon       = document.getElementById("result-icon");
  const label      = document.getElementById("result-label");
  const barLegit   = document.getElementById("bar-legit");
  const barFraud   = document.getElementById("bar-fraud");
  const pctLegit   = document.getElementById("pct-legit");
  const pctFraud   = document.getElementById("pct-fraud");

  const isFraud = result.prediction === 1;

  icon.textContent  = isFraud ? "🚨" : "✅";
  label.textContent = result.label;

  panel.className   = `result-panel ${isFraud ? "fraud" : "legit"}`;

  // Animate bars (set to 0 first, then update after paint)
  barLegit.style.width = "0%";
  barFraud.style.width = "0%";

  requestAnimationFrame(() => {
    setTimeout(() => {
      barLegit.style.width = result.legit_probability + "%";
      barFraud.style.width = result.fraud_probability + "%";
    }, 50);
  });

  pctLegit.textContent = result.legit_probability + "%";
  pctFraud.textContent = result.fraud_probability + "%";

  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}