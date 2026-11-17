// FraudGuard frontend — works with the existing Flask /predict and /sample endpoints.
const API = (["localhost", "127.0.0.1"].includes(window.location.hostname))
  ? "http://127.0.0.1:5000"
  : "https://fraud-backend-app.onrender.com";

const FEATURE_NAMES = ["Time", "Amount", ...Array.from({ length: 28 }, (_, i) => `V${i + 1}`)];
let historyItems = [];
let batchResults = [];
let selectedCsvText = "";

document.addEventListener("DOMContentLoaded", () => {
  buildFeatureFields();
  bindEvents();
  checkAPIStatus();
  updateDashboardStats();
});

function buildFeatureFields() {
  const container = document.getElementById("feature-fields");
  for (let i = 1; i <= 28; i++) {
    const label = document.createElement("label");
    label.className = "input-field";
    const caption = document.createElement("span");
    caption.textContent = `V${i}`;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.id = `V${i}`;
    input.name = `V${i}`;
    input.placeholder = "0.000000";
    input.required = true;
    label.append(caption, input);
    container.appendChild(label);
  }
}

function bindEvents() {
  document.getElementById("transaction-form").addEventListener("submit", analyzeTransaction);
  document.getElementById("load-sample-btn").addEventListener("click", loadSample);
  document.getElementById("clear-form-btn").addEventListener("click", clearForm);
  document.getElementById("csv-file").addEventListener("change", handleCsvSelection);
  document.getElementById("run-batch-btn").addEventListener("click", runBatchAnalysis);
  document.getElementById("download-results").addEventListener("click", exportBatchResults);
  document.getElementById("clear-history-btn").addEventListener("click", clearHistory);
  document.getElementById("mobile-menu").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));
      link.classList.add("active");
      document.getElementById("sidebar").classList.remove("open");
    });
  });

  const dropZone = document.querySelector(".drop-zone");
  ["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
  }));
  dropZone.addEventListener("drop", event => {
    const file = event.dataTransfer.files[0];
    if (file) loadCsvFile(file);
  });
}

async function checkAPIStatus() {
  const dot = document.getElementById("api-status-dot");
  const text = document.getElementById("api-status-text");
  const sideDot = document.getElementById("sidebar-status-dot");
  const sideText = document.getElementById("sidebar-status-text");
  try {
    const response = await fetch(`${API}/`, { method: "GET" });
    if (!response.ok) throw new Error("API unavailable");
    dot.className = "status-dot online";
    sideDot.className = "status-dot online";
    text.textContent = "API connected";
    sideText.textContent = "Detection engine online";
  } catch {
    dot.className = "status-dot offline";
    sideDot.className = "status-dot offline";
    text.textContent = "API offline";
    sideText.textContent = "Detection engine offline";
  }
}

async function loadSample() {
  const button = document.getElementById("load-sample-btn");
  setButtonBusy(button, true, "Loading features…");
  try {
    const response = await fetch(`${API}/sample`);
    if (!response.ok) throw new Error("Could not load sample");
    const sample = await response.json();
    FEATURE_NAMES.forEach(name => {
      const input = document.getElementById(name);
      if (input && sample[name] !== undefined) input.value = sample[name];
    });
    showToast("Sample features loaded into all 30 fields. Select Analyze transaction to view the SHAP explanation.");
  } catch (error) {
    showToast("Could not load sample. Check that the Flask API is running.");
  } finally {
    setButtonBusy(button, false, "↧ Load sample features");
  }
}

function clearForm() {
  document.getElementById("transaction-form").reset();
  document.getElementById("single-result").classList.add("hidden");
}

function getFormData() {
  const data = {};
  for (const name of FEATURE_NAMES) {
    const input = document.getElementById(name);
    if (!input || input.value.trim() === "") {
      throw new Error(`Please enter a value for ${name}.`);
    }
    const value = Number(input.value);
    if (!Number.isFinite(value)) throw new Error(`${name} must be a valid finite number.`);
    data[name] = value;
  }
  return data;
}

async function requestPrediction(payload) {
  const response = await fetch(`${API}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    const detail = result.error || `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return result;
}

async function analyzeTransaction(event) {
  event.preventDefault();
  const button = document.getElementById("analyze-btn");
  let payload;
  try {
    payload = getFormData();
  } catch (error) {
    showToast(error.message);
    return;
  }

  setButtonBusy(button, true, "Analyzing…");
  document.getElementById("single-result").classList.add("hidden");
  try {
    const result = await requestPrediction(payload);
    displayResult(result);
    addHistory(result, payload.Amount, "Manual");
  } catch (error) {
    showToast(`Analysis failed: ${error.message}`);
  } finally {
    setButtonBusy(button, false, "⌕ Analyze transaction");
  }
}

function displayResult(result) {
  const isFraud = Number(result.prediction) === 1;
  const panel = document.getElementById("single-result");
  const main = document.getElementById("result-main");

  panel.classList.remove("hidden");
  main.classList.toggle("flagged", isFraud);
  document.getElementById("single-result-icon").textContent = isFraud ? "!" : "✓";
  document.getElementById("single-result-label").textContent = result.label || (isFraud ? "Potential fraud" : "Legitimate");
  document.getElementById("single-result-description").textContent = isFraud
    ? "The model score met or exceeded the configured decision threshold. Review this transaction."
    : "The model score was below the configured decision threshold.";
  document.getElementById("single-fraud-score").textContent = `${formatPercent(result.fraud_probability)}%`;
  document.getElementById("single-legit-pct").textContent = `${formatPercent(result.legit_probability)}%`;
  document.getElementById("single-fraud-pct").textContent = `${formatPercent(result.fraud_probability)}%`;
  document.getElementById("result-time").textContent = new Date().toLocaleString();

  const legitBar = document.getElementById("single-legit-bar");
  const fraudBar = document.getElementById("single-fraud-bar");
  legitBar.style.width = "0%";
  fraudBar.style.width = "0%";
  requestAnimationFrame(() => {
    legitBar.style.width = `${clampPercent(result.legit_probability)}%`;
    fraudBar.style.width = `${clampPercent(result.fraud_probability)}%`;
  });

  renderShap(result.explanation);
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderShap(explanation) {
  const container = document.getElementById("shap-features");
  container.replaceChildren();
  const features = explanation && Array.isArray(explanation.top_features)
    ? explanation.top_features
    : [];

  if (!features.length) {
    const message = document.createElement("p");
    message.className = "muted-small";
    message.textContent = "No SHAP explanation was returned for this prediction.";
    container.appendChild(message);
    return;
  }

  const maxMagnitude = Math.max(...features.map(item => Math.abs(Number(item.contribution) || 0)), 0.000001);
  features.forEach(item => {
    const contribution = Number(item.contribution) || 0;
    const positive = contribution >= 0;
    const row = document.createElement("div");
    row.className = "shap-row";

    const name = document.createElement("span");
    name.className = "shap-feature-name";
    name.textContent = String(item.feature || "Feature");

    const track = document.createElement("div");
    track.className = "shap-bar-track";
    const bar = document.createElement("div");
    bar.className = `shap-bar ${positive ? "positive" : "negative"}`;
    bar.style.width = `${Math.max(3, Math.abs(contribution) / maxMagnitude * 100)}%`;
    track.appendChild(bar);

    const value = document.createElement("span");
    value.className = "shap-value";
    value.textContent = `${positive ? "+" : ""}${contribution.toFixed(5)}`;

    row.append(name, track, value);
    container.appendChild(row);
  });
}

function addHistory(result, amount, source) {
  historyItems.unshift({
    time: new Date(),
    source,
    amount: Number(amount) || 0,
    prediction: Number(result.prediction),
    fraudProbability: Number(result.fraud_probability) || 0
  });
  renderHistory();
  updateDashboardStats();
}

function renderHistory() {
  const body = document.getElementById("history-table-body");
  body.replaceChildren();
  if (!historyItems.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.className = "empty-state";
    cell.textContent = "No transactions analyzed yet.";
    return;
  }
  historyItems.slice(0, 100).forEach(item => {
    const row = body.insertRow();
    addCell(row, item.time.toLocaleTimeString());
    addCell(row, item.source);
    addCell(row, formatAmount(item.amount));
    const statusCell = row.insertCell();
    const status = document.createElement("span");
    status.className = `table-status ${item.prediction === 1 ? "fraud" : "legit"}`;
    status.textContent = item.prediction === 1 ? "POTENTIAL FRAUD" : "LEGITIMATE";
    statusCell.appendChild(status);
    addCell(row, `${formatPercent(item.fraudProbability)}%`);
  });
}

function updateDashboardStats() {
  const total = historyItems.length;
  const fraud = historyItems.filter(item => item.prediction === 1).length;
  const legit = total - fraud;
  document.getElementById("stat-total").textContent = total.toLocaleString();
  document.getElementById("stat-fraud").textContent = fraud.toLocaleString();
  document.getElementById("stat-legit").textContent = legit.toLocaleString();
  document.getElementById("stat-rate").textContent = `${total ? (fraud / total * 100).toFixed(1) : "0.0"}%`;
}

function clearHistory() {
  historyItems = [];
  renderHistory();
  updateDashboardStats();
  showToast("Session history cleared.");
}

function handleCsvSelection(event) {
  const file = event.target.files[0];
  if (file) loadCsvFile(file);
}

function loadCsvFile(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showBatchMessage("Please choose a .csv file.", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    selectedCsvText = String(reader.result || "");
    document.getElementById("file-name").textContent = file.name;
    document.getElementById("run-batch-btn").disabled = false;
    showBatchMessage("CSV loaded. Start batch analysis when ready.", "success");
  };
  reader.onerror = () => showBatchMessage("Could not read the selected file.", "error");
  reader.readAsText(file);
}

async function runBatchAnalysis() {
  if (!selectedCsvText.trim()) {
    showBatchMessage("Choose a CSV file first.", "error");
    return;
  }

  let parsed;
  try {
    parsed = parseCsv(selectedCsvText);
  } catch (error) {
    showBatchMessage(error.message, "error");
    return;
  }
  if (!parsed.rows.length) {
    showBatchMessage("The CSV contains no transaction rows.", "error");
    return;
  }

  const missing = FEATURE_NAMES.filter(name => !parsed.headers.includes(name));
  if (missing.length) {
    showBatchMessage(`Missing required columns: ${missing.join(", ")}`, "error");
    return;
  }

  const button = document.getElementById("run-batch-btn");
  button.disabled = true;
  batchResults = [];
  const progressWrap = document.getElementById("batch-progress-wrap");
  progressWrap.classList.remove("hidden");
  document.getElementById("batch-results").classList.add("hidden");

  let failed = 0;
  for (let index = 0; index < parsed.rows.length; index++) {
    const row = parsed.rows[index];
    const payload = {};
    try {
      FEATURE_NAMES.forEach(name => {
        const value = Number(row[parsed.headers.indexOf(name)]);
        if (!Number.isFinite(value)) throw new Error(`Row ${index + 2}: invalid ${name}`);
        payload[name] = value;
      });
      const result = await requestPrediction(payload);
      const item = {
        row: index + 2,
        amount: payload.Amount,
        prediction: Number(result.prediction),
        fraudProbability: Number(result.fraud_probability) || 0,
        label: result.label || (Number(result.prediction) === 1 ? "Potential fraud" : "Legitimate")
      };
      batchResults.push(item);
      addHistory({ prediction: item.prediction, fraud_probability: item.fraudProbability }, item.amount, "CSV");
    } catch (error) {
      failed++;
      batchResults.push({ row: index + 2, amount: row[parsed.headers.indexOf("Amount")] || "", prediction: null, fraudProbability: null, error: error.message });
    }

    const completed = index + 1;
    document.getElementById("batch-progress-text").textContent = "Analyzing transactions…";
    document.getElementById("batch-progress-count").textContent = `${completed} / ${parsed.rows.length}`;
    document.getElementById("batch-progress-bar").style.width = `${completed / parsed.rows.length * 100}%`;
  }

  renderBatchResults();
  document.getElementById("batch-results").classList.remove("hidden");
  document.getElementById("batch-summary").textContent =
    `${batchResults.length - failed} analyzed · ${batchResults.filter(item => item.prediction === 1).length} flagged · ${failed} failed`;
  showBatchMessage(failed ? `Batch completed with ${failed} row(s) that could not be analyzed.` : "Batch analysis completed successfully.", failed ? "error" : "success");
  button.disabled = false;
}

function parseCsv(text) {
  const lines = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field.trim()); field = ""; }
    else if (char === "\n") { row.push(field.trim()); lines.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  if (field.length || row.length) { row.push(field.trim()); lines.push(row); }

  const nonEmpty = lines.filter(line => line.some(value => value !== ""));
  if (nonEmpty.length < 2) throw new Error("CSV must contain a header and at least one data row.");
  const headers = nonEmpty[0].map(value => value.replace(/^\uFEFF/, ""));
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate column names.");
  const rows = nonEmpty.slice(1);
  if (rows.some(line => line.length !== headers.length)) throw new Error("CSV rows do not all have the same number of columns.");
  return { headers, rows };
}

function renderBatchResults() {
  const body = document.getElementById("batch-table-body");
  body.replaceChildren();
  batchResults.forEach(item => {
    const row = body.insertRow();
    addCell(row, item.row);
    addCell(row, item.amount);
    const statusCell = row.insertCell();
    if (item.prediction === null) {
      statusCell.textContent = "FAILED";
      statusCell.className = "failed-cell";
    } else {
      const status = document.createElement("span");
      status.className = `table-status ${item.prediction === 1 ? "fraud" : "legit"}`;
      status.textContent = item.prediction === 1 ? "POTENTIAL FRAUD" : "LEGITIMATE";
      statusCell.appendChild(status);
    }
    addCell(row, item.fraudProbability === null ? "—" : `${formatPercent(item.fraudProbability)}%`);
  });
}

function exportBatchResults() {
  if (!batchResults.length) return;
  const rows = [["Row", "Amount", "Prediction", "Fraud Probability"]];
  batchResults.forEach(item => rows.push([
    item.row,
    item.amount,
    item.prediction === null ? "FAILED" : (item.prediction === 1 ? "POTENTIAL FRAUD" : "LEGITIMATE"),
    item.fraudProbability === null ? "" : item.fraudProbability
  ]));
  const csv = rows.map(row => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "fraudguard-analysis-results.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function addCell(row, value) {
  const cell = row.insertCell();
  cell.textContent = String(value ?? "");
  return cell;
}

function showBatchMessage(message, type) {
  const box = document.getElementById("batch-message");
  box.textContent = message;
  box.className = `inline-message ${type}`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function setButtonBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function formatAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : String(value);
}
