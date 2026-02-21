# 🎓 Beginner's Guide to the Risk-Aware Fraud Decision System

> **Who is this for?** Anyone new to the project — students, new developers, or curious people who want to understand how this fraud detection system works from the ground up.

---

## 📌 What Does This System Do?

Imagine you're a bank. Thousands of credit card transactions happen every second. Some are legit, some are fraudulent. You need a system that can:

1. **Detect fraud** — Figure out which transactions look suspicious
2. **Say how confident it is** — Does the system really know, or is it guessing?
3. **Handle unknowns** — What if a transaction looks completely different from anything it's seen before?
4. **Make smart decisions** — Not just "fraud" or "not fraud", but nuanced actions like "block it", "let it through", "ask for more verification", or "send it to a human analyst"

This system does all four.

---

## 🧠 The Three Detection Axes

Instead of a single fraud/not-fraud score, this system evaluates every transaction along **three independent axes**:

### Axis 1: Risk Score (How fraudulent does it look?)

An **ensemble of 5 XGBoost models** each independently predicts "what's the probability this is fraud?" We take the **average** of all 5 predictions.

```
Risk Score = average probability from 5 models
Range: 0.0 (definitely safe) → 1.0 (definitely fraud)
```

**Tiers:**
| Tier | Score Range | Meaning |
|------|-----------|---------|
| 🟢 Low Risk | < 0.30 | Looks safe |
| 🟡 Medium Risk | 0.30 – 0.79 | Suspicious |
| 🔴 High Risk | ≥ 0.80 | Strong fraud indicators |

### Axis 2: Uncertainty (How much do the models agree?)

Since we have 5 models, we can measure how much they **disagree**. If all 5 say "fraud", we're confident. If 3 say "fraud" and 2 say "safe", we're uncertain.

```
Uncertainty = standard deviation of the 5 predictions
Threshold: 0.02
```

- **Low uncertainty** (< 0.02) → Models agree → System is confident
- **High uncertainty** (≥ 0.02) → Models disagree → System should be cautious

### Axis 3: Novelty (Has the system seen this before?)

An **Isolation Forest** model was trained on legitimate transactions only. When a new transaction comes in, it checks: "Does this look like the normal transactions I was trained on?"

```
Anomaly Score from Isolation Forest
Threshold: -0.08
```

- **Positive score** → Looks normal (seen this kind of transaction before)
- **Negative score below threshold** → Novel pattern (never seen anything like this)

---

## 🚦 The 5 Decision States

Based on the three axes, every transaction is routed to one of **5 decisions**:

```
                    ┌─────────────────────────────────────────┐
                    │          DECISION ROUTING RULES          │
                    ├─────────────────────────────────────────┤
                    │                                         │
                    │  Risk ≥ 0.80 AND Uncertainty < 0.02     │
                    │  ──→ 🔴 DECLINE (Auto Block)           │
                    │                                         │
                    │  Risk ≥ 0.60 AND Uncertainty ≥ 0.02     │
                    │  ──→ 🟠 ESCALATE INVESTIGATION         │
                    │                                         │
                    │  0.30 ≤ Risk < 0.80                     │
                    │  ──→ 🟡 STEP UP AUTHENTICATION         │
                    │                                         │
                    │  Risk < 0.30 AND Uncertainty ≥ 0.02     │
                    │  ──→ ⚪ ABSTAIN                        │
                    │                                         │
                    │  Novelty Flag = True                    │
                    │  ──→ 🟠 ESCALATE INVESTIGATION         │
                    │                                         │
                    │  Otherwise                              │
                    │  ──→ 🟢 APPROVE (Auto Approve)         │
                    └─────────────────────────────────────────┘
```

### What each decision means in the real world:

| Decision | Icon | What happens | Real-world analogy |
|----------|------|-------------|-------------------|
| **APPROVE** | ✓ | Transaction goes through automatically | Cashier accepts your card instantly |
| **STEP UP AUTH** | ⚡ | Ask the cardholder for extra verification | "Please enter your OTP or fingerprint" |
| **ABSTAIN** | ◇ | System isn't sure — hold and wait for human | "We're not confident enough to decide either way" |
| **ESCALATE INVESTIGATION** | ⚑ | Send to a human fraud analyst for review | "This looks suspicious, let an expert check" |
| **DECLINE** | ✕ | Block the transaction automatically | "Sorry, your card has been declined" |

---

## 🏗️ How the Architecture Works

Here's how transaction data flows through the system:

```
┌──────────────┐     HTTP POST /predict      ┌──────────────────┐
│              │  ─────────────────────────→  │                  │
│  Frontend    │    { features: [31 floats] } │   FastAPI Server │
│  (Browser)   │  ←─────────────────────────  │   (Port 8000)    │
│              │    JSON response             │                  │
└──────────────┘                              └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Decision Engine │
                                              │                  │
                                              │  1. XGBoost ×5   │
                                              │     → risk_score │
                                              │     → uncertainty│
                                              │                  │
                                              │  2. Isolation    │
                                              │     Forest       │
                                              │     → novelty    │
                                              │                  │
                                              │  3. Router       │
                                              │     → decision   │
                                              │                  │
                                              │  4. Cost Sim     │
                                              │     → costs      │
                                              └──────────────────┘
```

### The Components

| Component | File | What It Does |
|-----------|------|-------------|
| **FastAPI Server** | `api/main.py` | Receives HTTP requests, validates input (31 features), forwards to engine |
| **Decision Engine** | `backend/engine/decision_engine.py` | The brain — runs all 3 axes + routing + cost simulation |
| **XGBoost Ensemble** | `artifacts/xgb_ensemble.pkl` | 5 pre-trained fraud detection models (serialized) |
| **Isolation Forest** | `artifacts/isolation_forest.pkl` | Pre-trained novelty detector (serialized) |
| **Glass Lens UI** | `frontend-glass/` | Beautiful glassmorphism frontend (Vite + JS) |
| **Streamlit UI** | `frontend/app.py` | Simpler demo frontend |

---

## 📊 The 31 Features

Each transaction is represented as a vector of **31 numbers**:

| # | Feature | Description |
|---|---------|------------|
| 1 | Time | Seconds since first transaction in dataset |
| 2–30 | V1 to V29 | PCA-transformed features (anonymized for privacy) |
| 31 | Amount | Transaction amount in dollars |

> **Why PCA?** The original credit card features (merchant name, location, etc.) are anonymized using Principal Component Analysis. V1–V29 are mathematical transformations that preserve the patterns while hiding the raw data.

---

## 💰 Cost Simulation

The engine doesn't just decide — it estimates the **financial impact**:

| Metric | Formula | Meaning |
|--------|---------|---------|
| Expected Loss | `risk_score × $1,000` | How much money we'd lose if this is fraud |
| Manual Review Cost | `$20` if review needed, `$0` if auto-decided | Cost of a human analyst reviewing this transaction |
| Net Utility | `−expected_loss − review_cost` | Total financial impact of this decision |

---

## 🚀 How to Run the System

### Prerequisites
- Python 3.11+ with `pip`
- Node.js 18+ with `npm`

### Step 1: Start the Backend
```bash
cd "Risk Aware Fraud Transaction Decision System"

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Start the API server
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

You should see:
```
INFO: Application startup complete.
INFO: Uvicorn running on http://0.0.0.0:8000
```

### Step 2: Start the Frontend
```bash
cd frontend-glass
npm install    # first time only
npm run dev
```

You should see:
```
VITE v6.x ready in Xms
➜ Local: http://localhost:5173/
```

### Step 3: Open and Use
1. Open `http://localhost:5173` in your browser
2. The "API Connected" indicator should turn green
3. Click **"Generate Random"** to analyze a random transaction
4. Or click any of the 5 preset buttons to target a specific decision

---

## 🔬 How Glass Lens Visualizes the Engine

The Glass Lens frontend shows the transaction passing through **4 layers**:

| Panel | What you see | Maps to engine step |
|-------|-------------|-------------------|
| **Layer 1: Ensemble Risk** | Risk score bar + tier badge | `predict_proba()` → mean of 5 model outputs |
| **Layer 2: Uncertainty** | Std dev + 5 ensemble bar chart | `predict_proba()` → std of 5 model outputs |
| **Layer 3: Novelty** | Anomaly score + novelty badge | `anomaly_score()` → Isolation Forest |
| **Verdict Card** | Decision + routing rule + cost breakdown | `decide()` + `estimate_cost()` |
| **Decision Landscape** | 2D plot with colored regions | Risk (x) × Uncertainty (y) routing topology |

---

## 🔁 The Research Pipeline (How the Models Were Built)

The models weren't built in one step. The project went through **6 phases**:

| Phase | Script | What It Does |
|-------|--------|-------------|
| 0 | `phase0_cleaning.py` + `phase0_exploration.py` | Clean raw data, explore distributions |
| 1 | `phase1_modeling.py` + `phase1_xgboost.py` | Train baseline LogisticRegression, then calibrated XGBoost |
| 2 | `phase2_uncertainty.py` | Bootstrap 5 XGBoost models, measure uncertainty, 2D routing |
| 3 | `phase3_explainability.py` | SHAP analysis — which features drive predictions? |
| 4 | `phase4_outlier.py` | Train Isolation Forest on legit transactions for novelty detection |
| 5 | `phase5_reliability.py` | Calibration curves — are predicted probabilities trustworthy? |

> You don't need to re-run these scripts. The trained models are saved in `artifacts/` and loaded automatically.

---

## 📁 Key Project Folders

```
Risk Aware Fraud Transaction Decision System/
├── api/                  ← FastAPI server (receives transactions)
├── backend/engine/       ← Decision Engine (the brain)
├── artifacts/            ← Trained models (.pkl files)
├── frontend-glass/       ← Glass Lens UI (Vite + JS)
├── frontend/             ← Streamlit demo UI
├── PROJECT_DOCUMENTATION/ ← Architecture diagrams, this guide
├── phase0–5 scripts      ← Research pipeline (offline)
└── Dockerfile            ← Docker deployment config
```

---

## ❓ Common Questions

**Q: Why 5 models instead of 1?**
A: One model gives you a prediction but no way to know if it's confident. Five models let us measure disagreement (uncertainty), which is critical for knowing when to escalate to a human.

**Q: What if the system has never seen a type of transaction before?**
A: The Isolation Forest catches this. It was trained only on normal transactions, so anything truly different gets flagged as "novel" and escalated.

**Q: Why not just block everything suspicious?**
A: False positives are expensive! Blocking a legitimate $5,000 transaction costs the bank customer trust and revenue. The 5-state system lets us take graduated actions based on confidence.

**Q: Can I test with real credit card data?**
A: The system was trained on the [Kaggle Credit Card Fraud Dataset](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud). You can download `creditcard.csv` and place it in the project root to re-run the training pipeline.
