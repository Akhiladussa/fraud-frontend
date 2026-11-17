# FraudGuard – Frontend

FraudGuard is a web-based transaction intelligence dashboard for a credit card fraud detection prototype. It allows users to submit individual transactions or upload CSV files for fraud screening, view model predictions, and understand the model's decisions through SHAP-based feature explanations.

The frontend communicates with a Flask backend that serves the trained machine learning model.

## Live Application

**Frontend:** https://creditcard-fraud-detection-app.netlify.app/

**Backend API:** https://fraud-backend-app.onrender.com

## Features

### 1. Overview Dashboard
- Displays the number of transactions analyzed during the current browser session.
- Shows potential fraud and legitimate transaction counts.
- Displays the flag rate based on session analysis.
- Provides navigation to individual analysis, batch analysis, and history.

### 2. Single Transaction Analysis
- Accepts transaction features through a form.
- Supports all 30 model input features: `Time`, `Amount`, and `V1`–`V28`.
- Provides synthetic sample values for interface testing.
- Validates the transaction inputs before sending them to the backend.
- Displays the predicted class, fraud score, and legitimate score.

### 3. SHAP-Based Explainability
- Displays the top five feature contributions for an individual prediction.
- Shows whether each feature increases or decreases the model's fraud score.
- Helps users understand how the model arrived at its prediction.

**Note:** SHAP explanations describe the model's behavior. They do not establish the real-world cause of a transaction.

### 4. Batch CSV Analysis
- Supports uploading transaction data through a CSV file.
- Validates the required column headers and transaction rows.
- Processes transactions individually through the prediction API.
- Displays processing progress and prediction results.
- Reports failed rows and provides a results table.
- Allows users to export the analysis results as a CSV file.

### 5. Analysis History
- Maintains a history of analyzed transactions during the current browser session.
- Displays transaction source, amount, prediction, and fraud probability.
- Allows users to clear the session history.

**Note:** Analysis history is stored in browser-session JavaScript memory. It is not permanently saved in a database.

### 6. Responsive User Interface
- Dark-themed dashboard with a sidebar navigation layout.
- Responsive layouts for desktop, tablet, and mobile screens.
- Transaction status indicators and interactive result panels.
- Reduced-motion accessibility support.

## Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | Dashboard styling and responsive design |
| JavaScript | Form handling, API communication, validation, and dynamic updates |
| Fetch API | Communication with the Flask backend |
| CSV / Blob APIs | CSV upload, processing, and result export |
| SHAP | Model explanation data displayed in the interface |

The frontend uses vanilla HTML, CSS, and JavaScript. No frontend framework or build process is required.

## Backend Integration

The frontend communicates with the Flask backend using HTTP requests.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Checks backend availability |
| GET | `/sample` | Retrieves synthetic sample transaction features |
| POST | `/predict` | Submits a transaction and receives its prediction and SHAP explanation |

The application automatically selects the appropriate backend address for local development or the deployed environment.

### Prediction Request

The `/predict` endpoint expects a JSON object containing all 30 model features:

- `Time`
- `Amount`
- `V1` through `V28`

The frontend validates the inputs and sends the transaction to the backend for prediction.

## CSV Upload Format

The uploaded CSV must contain the following headers:

```csv
Time,Amount,V1,V2,V3,V4,V5,V6,V7,V8,V9,V10,V11,V12,V13,V14,V15,V16,V17,V18,V19,V20,V21,V22,V23,V24,V25,V26,V27,V28
```

Each row represents one transaction.

- All 30 feature columns are required.
- The `Class` target column is not required.
- Values must be valid numeric inputs.
- Do not upload real card numbers, CVVs, PINs, credentials, or confidential cardholder information.

## Project Structure

```text
frontend/
│
├── index.html
├── style.css
├── script.js
└── README.md
```

- `index.html` – Dashboard structure and application sections.
- `style.css` – Dark theme, components, layouts, and responsive styling.
- `script.js` – Form validation, API requests, batch processing, history, and CSV export.
- `README.md` – Frontend documentation.

## Running Locally

### Prerequisites

- A modern web browser.
- Python and the Flask backend environment.
- The FraudGuard backend running locally.

### Steps

1. Clone the frontend repository:

```bash
git clone https://github.com/Akhiladussa/fraud-frontend.git
```

2. Open the project folder:

```bash
cd fraud-frontend
```

3. Start the Flask backend separately using its setup instructions.

4. Open `index.html` in a browser, preferably through the VS Code Live Server extension.

5. Use the dashboard to analyze individual transactions or upload a CSV file.

No frontend package installation or compilation is required.

## Limitations

- This is a fraud detection prototype, not a production banking system.
- It is not connected to a live bank or payment network.
- It does not automatically block or approve transactions.
- Batch transactions are submitted individually to the backend.
- Analysis history is temporary and is not stored in a persistent database.
- The model's fraud score should not be interpreted as a calibrated real-world probability.
- SHAP explanations describe model behavior, not causation.
- Synthetic sample values are intended for interface testing, not as verified examples of real fraud.

## Author

**Akhila Dussa**

GitHub: https://github.com/Akhiladussa

Frontend Repository: https://github.com/Akhiladussa/fraud-frontend

Backend Repository: https://github.com/Akhiladussa/fraud-backend

---

*FraudGuard – Transaction Intelligence | Version 1.0.0*