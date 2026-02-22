# Risk-Aware Financial Transaction Decision System

A production-grade fraud detection and decision intelligence engine combining ensemble machine learning, predictive uncertainty, novelty detection, and cost-aware routing — deployed as a Dockerized FastAPI service.

## 🚀 Overview

This project moves beyond binary fraud classification.

It implements a risk-aware financial decision engine that integrates:

- Bootstrap XGBoost ensemble modeling
- Predictive uncertainty estimation (epistemic)
- Isolation Forest novelty detection
- Two-axis routing logic (Risk × Uncertainty)
- Cost-aware decision optimization
- 5-state fraud control architecture
- Containerized REST API deployment

The system is designed as a deployable backend service, not just a research notebook.

## 🧠 System Architecture

```
Client / UI
      ↓
FastAPI API Layer (/predict)
      ↓
DecisionEngine
      ├── XGBoost Bootstrap Ensemble
      ├── Ensemble Std (Uncertainty)
      ├── Isolation Forest (Novelty Layer)
      ├── Cost Simulation Layer
      └── 5-State Routing Logic
              • APPROVE
              • STEP_UP_AUTH
              • ESCALATE_INVEST
              • DECLINE
              • ABSTAIN
```

## 📊 Decision Framework (2-Axis Logic)

The system makes decisions using two dimensions:

- **Risk Score** → Mean probability from ensemble
- **Uncertainty** → Standard deviation across bootstrap models

### Routing Strategy

| Risk Level | Uncertainty | Decision           |
|------------|-------------|--------------------|
| High       | Low         | DECLINE            |
| High       | High        | ESCALATE_INVEST    |
| Medium     | Any         | STEP_UP_AUTH       |
| Low        | High        | ABSTAIN            |
| Low        | Low         | APPROVE            |

Isolation Forest can override to ESCALATE_INVEST if novel behavior is detected.

## 🔬 Model Validation

- ROC-AUC ≈ 0.986
- Reliability curve verified calibration
- Brier score improved post-calibration
- Bootstrap uncertainty validated
- Cost-based threshold optimization tested
- SHAP explainability implemented during research phase

## 🏗 Project Structure

```
backend/
    engine/
        decision_engine.py
    config/

api/
    main.py

artifacts/
    xgb_ensemble.pkl
    isolation_forest.pkl

Dockerfile
requirements.txt
```

Research phase scripts are preserved separately and remain untouched.

## 🔌 API Usage

### POST /predict

**Request body:**

```json
{
  "features": [ ... 31 numerical features ... ]
}
```

**Example response:**

```json
{
  "decision": "STEP_UP_AUTH",
  "risk_score": 0.42,
  "uncertainty": 0.01,
  "novelty_flag": false,
  "tier": "medium_risk",
  "costs": {
    "expected_loss": 420.0,
    "manual_review_cost": 20.0,
    "net_utility": -440.0
  }
}
```

**Swagger UI available at:**

http://localhost:8000/docs

## 🐳 Running Locally (Docker)

**Build the image:**

```bash
docker build -t fraud-api .
```

**Run the container:**

```bash
docker run -p 8000:8000 fraud-api
```

**Access API:**

http://localhost:8000/docs

## 🎯 Key Contributions

- Ensemble-based fraud probability estimation
- Uncertainty-aware routing
- Novelty detection layer for unseen behavior
- Cost-sensitive decision modeling
- Production-ready REST API
- Fully Dockerized deployment pipeline

## 📦 Dataset

- Kaggle Credit Card Fraud Detection Dataset
- 284,807 transactions
- 0.172% fraud rate
- Severe class imbalance

## 🔮 Future Extensions

- Live monitoring endpoint
- Threshold auto-optimization via expected utility
- Zone-specific uncertainty thresholds
- Real-time transaction streaming
- Public cloud deployment

## 🏁 Status

- ✅ Research validated
- ✅ Production inference engine
- ✅ FastAPI wrapper
- ✅ Dockerized backend
- ✅ Cloud deployment: Vercel (frontend) + Railway (backend)

---

## ☁️ Cloud Deployment (Vercel + Railway)

The Glass Lens frontend is deployed to **Vercel** (static CDN).  
The FastAPI backend is deployed to **Railway** (Docker container).

### Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `VITE_API_URL` | Vercel dashboard | Your Railway backend URL, e.g. `https://your-app.up.railway.app` |
| `ALLOWED_ORIGINS` | Railway dashboard | Your Vercel URL, e.g. `https://your-app.vercel.app` |
| `PORT` | Railway (auto-injected) | Railway sets this automatically |

---

### Step 1 — Deploy Backend to Railway

1. Push this repo to GitHub (if not already).
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Select this repository. Railway auto-detects the `Dockerfile`.
4. In **Variables**, add:
   ```
   ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   ```
   *(You can update this after you get the Vercel URL.)*
5. Railway will build and deploy. Copy the public URL shown in the Railway dashboard (e.g. `https://your-app.up.railway.app`).
6. Verify: `https://your-app.up.railway.app/health` → should return `{"status":"ok","model":"xgb_ensemble_v2"}`

---

### Step 2 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your GitHub repo.
2. Set **Root Directory** to `frontend-glass`.
3. Vercel auto-detects Vite. Confirm:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   ```
   VITE_API_URL = https://your-app.up.railway.app
   ```
5. Click **Deploy**. Vercel gives you a URL like `https://your-app.vercel.app`.
6. Go back to Railway → update `ALLOWED_ORIGINS` to `https://your-app.vercel.app` → redeploy.

---

### Post-Deploy Checklist

- [ ] `GET /health` on Railway URL returns `{"status":"ok"}`
- [ ] Vercel URL loads Glass Lens UI
- [ ] "API Connected" indicator is green
- [ ] "Generate Random" returns a result
- [ ] All 5 preset buttons work (APPROVE, STEP_UP_AUTH, ESCALATE, DECLINE, ABSTAIN)
- [ ] Decision Landscape canvas renders
- [ ] No CORS errors in browser console
