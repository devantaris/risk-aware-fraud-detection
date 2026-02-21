# PROJECT BIBLE — Risk-Aware Financial Transaction Decision System

## IMMUTABLE DOCUMENT — READ-ONLY FORENSIC EXTRACTION
### Generated: 2026-02-21T03:49:57+05:30
### Source: Complete codebase analysis — zero modifications made

---

# TABLE OF CONTENTS

1. [Executive Overview](#1-executive-overview)
2. [Problem Definition](#2-problem-definition)
3. [Original Vision](#3-original-vision)
4. [Evolution Timeline](#4-evolution-timeline)
5. [Architectural Philosophy](#5-architectural-philosophy)
6. [Folder-by-Folder Breakdown](#6-folder-by-folder-breakdown)
7. [File-by-File Breakdown](#7-file-by-file-breakdown)
8. [Line-Level Explanation: Critical Components](#8-line-level-explanation-critical-components)
9. [Configuration Explanation](#9-configuration-explanation)
10. [Environment Variables](#10-environment-variables)
11. [API Endpoints](#11-api-endpoints)
12. [Models](#12-models)
13. [Hyperparameters](#13-hyperparameters)
14. [Numeric Constants](#14-numeric-constants)
15. [Scripts](#15-scripts)
16. [Logging Logic](#16-logging-logic)
17. [Error Handling](#17-error-handling)
18. [Failure Modes](#18-failure-modes)
19. [Security Decisions](#19-security-decisions)
20. [Deployment Strategy](#20-deployment-strategy)
21. [Scaling Strategy](#21-scaling-strategy)
22. [Technical Debt](#22-technical-debt)
23. [Inferred Design Decisions](#23-inferred-design-decisions)
24. [Image Placeholders](#24-image-placeholders)
25. [Glass Lens Frontend](#25-glass-lens-frontend)

---

# 1. EXECUTIVE OVERVIEW

This project is a **Risk-Aware Financial Transaction Decision System** — a production-grade fraud detection and decision intelligence engine. It goes beyond binary fraud classification (fraud/not-fraud) by implementing a **multi-axis decision routing engine** that considers three independent dimensions:

1. **Risk Score** — the mean probability of fraud from a bootstrap ensemble of 5 independently-trained, isotonically-calibrated XGBoost classifiers.
2. **Predictive Uncertainty** — the standard deviation across those 5 ensemble members, representing epistemic uncertainty (model disagreement).
3. **Novelty Detection** — an Isolation Forest anomaly detector trained exclusively on legitimate transactions, designed to catch previously-unseen behavioral patterns.

These three dimensions feed into a **5-state routing logic** that produces one of five actionable decisions:

| Decision | Meaning |
|----------|---------|
| `APPROVE` | Transaction is safe. Auto-approve. |
| `STEP_UP_AUTH` | Medium risk. Require additional authentication (e.g., OTP, biometric). |
| `ESCALATE_INVEST` | High risk with high uncertainty, or novel behavior. Route to human fraud analyst. |
| `DECLINE` | High risk with high confidence. Auto-block. |
| `ABSTAIN` | Low risk but high model disagreement. Defer decision. |

The system is deployed as a **Dockerized FastAPI REST API** (`POST /predict`) that accepts 31 numerical features and returns a structured JSON response containing the decision, risk score, uncertainty, novelty flag, risk tier, cost simulation, and metadata.

A **Streamlit frontend** provides a demonstration interface where synthetic transactions are generated in real-time and routed through the engine to visualize each of the 5 decision states.

The research pipeline (Phases 0–5) was developed iteratively and is preserved as standalone Python scripts. These scripts are NOT part of the production runtime — they were used during development to explore data, train models, validate calibration, compute SHAP explanations, train the Isolation Forest, and verify reliability. The trained model artifacts (`xgb_ensemble.pkl` and `isolation_forest.pkl`) are the only bridge between research and production.

**Key validated metric**: ROC-AUC ≈ 0.986 on the Kaggle Credit Card Fraud Detection dataset (284,807 transactions, 0.172% fraud rate).

---

# 2. PROBLEM DEFINITION

**Domain**: Financial transaction fraud detection.

**Core Problem**: Credit card fraud detection is inherently an extreme class-imbalance problem. In the Kaggle dataset used here, only 492 out of 284,807 transactions (0.172%) are fraudulent. Traditional binary classification approaches face several fundamental limitations:

1. **False Positive Cost**: Blocking a legitimate transaction angers the customer and costs the business revenue. A system that simply flags everything above a threshold generates excessive false positives.
2. **False Negative Cost**: Missing a fraudulent transaction costs the business the full transaction amount plus chargeback fees.
3. **Model Confidence Blindness**: A standard classifier outputs a single probability. It cannot distinguish between "I'm 80% sure this is fraud" (high confidence) and "my 5 models disagree wildly but average to 80%" (low confidence). These two scenarios should be handled differently.
4. **Novel Behavior Blindness**: Supervised classifiers can only detect patterns present in training data. A completely new fraud pattern may receive a low fraud probability simply because it doesn't match known fraud signatures.
5. **Binary Output Limitation**: Real-world fraud operations need more than approve/decline. They need a spectrum of actions: auto-approve, step-up authentication, manual review, escalation, and auto-decline.

**Solution**: This system addresses all five limitations through a multi-layer architecture that combines ensemble uncertainty estimation, novelty detection, cost-aware routing, and a 5-state decision framework.

---

# 3. ORIGINAL VISION

**[INFERRED]** Based on the project structure, README.md, and the phased research scripts, the original vision was:

1. Start with a classical ML approach to fraud detection (Phase 0–1: exploration, cleaning, baseline logistic regression, XGBoost).
2. Evolve beyond binary classification by adding uncertainty quantification (Phase 2: bootstrap ensemble).
3. Add explainability (Phase 3: SHAP) for understanding model decisions.
4. Add a novelty detection layer (Phase 4: Isolation Forest) for unseen patterns.
5. Validate model reliability (Phase 5: calibration curves, Brier scores).
6. Package everything into a production-ready system (DecisionEngine + FastAPI + Docker).
7. Build a demonstration frontend (Streamlit).

The README explicitly states: *"This project moves beyond binary fraud classification"* and *"The system is designed as a deployable backend service, not just a research notebook."*

**[INFERRED]** The developer's journal/notes were not found in the repository. Vision is reconstructed entirely from code evolution and README content.

---

# 4. EVOLUTION TIMELINE

**[INFERRED]** Based on file naming conventions and logical dependencies:

| Phase | Script | Purpose | Key Output |
|-------|--------|---------|------------|
| **Phase 0a** | `phase0_exploration.py` | Data exploration, visualization, feature analysis | Understanding of dataset characteristics |
| **Phase 0b** | `phase0_cleaning.py` | Feature engineering (hour, delta_time), cleaning | `creditcard_phase0_clean.csv` |
| **Phase 1a** | `phase1_modeling.py` | Baseline Logistic Regression with class balancing | ROC-AUC baseline, tier analysis |
| **Phase 1b** | `phase1_xgboost.py` | Calibrated XGBoost with isotonic calibration, GPU training | Improved ROC-AUC, optimal threshold, 3-tier system |
| **Phase 2** | `phase2_uncertainty.py` | Bootstrap ensemble (5 models), uncertainty estimation, 2D routing, cost simulation | `artifacts/xgb_ensemble.pkl`, `phase2_results.csv` |
| **Phase 3** | `phase3_explainability.py` | SHAP TreeExplainer for global/local feature importance | SHAP plots for fraud/legit/abstain cases |
| **Phase 4** | `phase4_outlier.py` | Isolation Forest trained on legitimate-only data | `artifacts/isolation_forest.pkl` |
| **Phase 5** | `phase5_reliability.py` | Calibration verification (raw vs calibrated Brier scores, reliability curves) | Validation of calibration quality |
| **Production** | `backend/engine/decision_engine.py` | Production inference engine combining all layers | 5-state routing with cost estimation |
| **API** | `api/main.py` | FastAPI REST wrapper | `POST /predict` endpoint |
| **Frontend** | `frontend/app.py` | Streamlit demonstration UI | Interactive routing visualization |
| **Deployment** | `Dockerfile` | Containerization | Docker image `fraud-api` |

---

# 5. ARCHITECTURAL PHILOSOPHY

The system follows a **layered architecture** with clear separation between:

1. **Research Layer** (offline, one-time execution): Phase scripts that explore, train, and validate. These produce serialized artifacts but are NOT imported by production code.
2. **Artifact Layer** (bridge): Serialized `.pkl` files that transfer trained models from research to production.
3. **Engine Layer** (core business logic): `DecisionEngine` class that encapsulates all inference logic — ensemble prediction, anomaly detection, routing, cost estimation, and tier classification.
4. **API Layer** (interface): FastAPI application that wraps the engine in a RESTful HTTP interface.
5. **Frontend Layer** (demonstration): Streamlit app that consumes the API via HTTP.
6. **Deployment Layer** (infrastructure): Dockerfile for containerization.

**Key Design Principles [INFERRED]**:
- **Single Responsibility**: Each phase script does one thing. The engine class encapsulates all inference logic. The API is a thin wrapper.
- **Loose Coupling**: The frontend communicates with the backend only via HTTP — no shared imports.
- **Artifact-Based Handoff**: Research and production are decoupled through serialized model files.
- **Configuration Over Code**: Thresholds and costs are instance variables, not hardcoded in logic branches.

[IMAGE_PLACEHOLDER: SYSTEM_ARCHITECTURE]

---

# 6. FOLDER-BY-FOLDER BREAKDOWN

## 6.1 Root Directory (`/`)

The root directory contains:
- **Research phase scripts** (`phase0_*.py` through `phase5_*.py`): 8 standalone Python scripts executed sequentially during development.
- **Data files** (`creditcard.csv`, `creditcard_phase0_clean.csv`, `phase2_results.csv`): Raw dataset, cleaned dataset, and intermediate results.
- **Infrastructure files** (`Dockerfile`, `requirements.txt`, `.gitignore`, `README.md`).
- **Virtual environment** (`venv/`): Python 3.11 virtualenv with all dependencies installed.

## 6.2 `api/` Directory

Contains the FastAPI application entry point. Single file: `main.py` (864 bytes, 32 lines). Also contains a `__pycache__/` directory with compiled bytecode (`main.cpython-311.pyc`), confirming the API has been executed at least once with Python 3.11.

## 6.3 `artifacts/` Directory

Contains two serialized model files:
- `xgb_ensemble.pkl` (6,803,689 bytes / ~6.8 MB): A Python list of 5 `CalibratedClassifierCV` objects, each wrapping an `XGBClassifier`. Produced by `phase2_uncertainty.py` line 183.
- `isolation_forest.pkl` (1,803,497 bytes / ~1.8 MB): A single `IsolationForest` object trained on legitimate-only transactions. Produced by `phase4_outlier.py` line 106.

## 6.4 `backend/` Directory

Contains the core business logic:
- `engine/decision_engine.py` (6,229 bytes, 188 lines): The production inference engine.
- `engine/__pycache__/`: Compiled bytecode confirming execution.
- `config/logger.py` (195 bytes, 9 lines): Logging configuration. **NOTE: This module is defined but NOT imported by any production code.** See Technical Debt section.
- `models/`: **Empty directory.** Appears to be a placeholder for future model-related code. No `__init__.py` present.
- `test_engine.py` (1,225 bytes, 41 lines): Smoke test for the DecisionEngine.

## 6.5 `frontend/` Directory

Contains a single Streamlit application:
- `app.py` (5,637 bytes, 180 lines): Interactive demo UI for the fraud decision system.

## 6.6 `venv/` Directory

Standard Python 3.11 virtual environment. Contains all installed packages including FastAPI, uvicorn, numpy, scikit-learn, xgboost (v3.2.0), joblib, pydantic, pandas, matplotlib, seaborn, shap, streamlit, requests, and their transitive dependencies.

## 6.7 `.git/` Directory

Git repository metadata. The project is version-controlled.

---

# 7. FILE-BY-FILE BREAKDOWN

## 7.1 `phase0_exploration.py` (105 lines)

**Purpose**: Initial data exploration and visualization of the raw Kaggle dataset.

**What it does**:
- Line 7: Loads `creditcard.csv` via pandas.
- Lines 9–18: Prints basic dataset shape (284,807 rows × 31 columns) and first 5 rows.
- Lines 20–26: Computes class distribution (fraud vs legitimate) and fraud percentage (0.172%).
- Lines 29–33: Contains a commented-out class distribution countplot (likely disabled after initial exploration).
- Lines 35–42: Computes and plots transaction amount distribution with KDE.
- Lines 44–52: Plots amount distribution by class (box plot, zoomed to $0–$1000).
- Lines 55–61: Plots transaction time distribution by class.
- Lines 64–78: Engineers `hour` feature (`(Time / 3600) % 24`) and plots fraud vs legit by hour.
- Lines 81–93: Computes fraud rate by hour bin and plots as bar chart.
- Lines 96–104: Computes `delta_time` (time between consecutive transactions) and prints stats by class.

**Key Finding [INFERRED]**: The hour-of-day and delta-time features were found useful enough to be incorporated into the cleaning pipeline (`phase0_cleaning.py`).

## 7.2 `phase0_cleaning.py` (36 lines)

**Purpose**: Data cleaning and feature engineering pipeline.

**What it does**:
- Line 9: Loads raw `creditcard.csv`.
- Line 12: Sorts by `Time` column (prerequisite for delta calculation).
- Line 15: Creates `hour` feature: `(Time / 3600) % 24` — converts elapsed seconds to cyclic hour-of-day.
- Line 18: Creates `delta_time` feature: `Time.diff()` — time between consecutive transactions.
- Line 21: Fills NaN in first row of `delta_time` with 0.
- Line 24: Drops raw `Time` column (replaced by engineered features).
- Lines 27–28: Integrity assertions — no missing values, exactly 284,807 rows.
- Line 31: Saves cleaned dataset as `creditcard_phase0_clean.csv`.

**Output Features**: The cleaned dataset has 31 columns: V1–V28 (PCA features), Amount, hour, delta_time, and Class (target). The raw `Time` column is removed.

## 7.3 `phase1_modeling.py` (103 lines)

**Purpose**: Baseline model using Logistic Regression.

**What it does**:
- Line 20: Loads cleaned dataset.
- Line 23: Applies `log1p` transform to `Amount` (reduces right skew).
- Lines 26–36: Stratified 80/20 train/test split with `random_state=42`.
- Lines 39–41: StandardScaler normalization.
- Lines 44–49: Logistic Regression with `max_iter=1000` and `class_weight="balanced"` (addresses class imbalance by upweighting minority class).
- Lines 52–58: Evaluates at default threshold 0.5: ROC-AUC and classification report.
- Lines 60–76: Three-tier risk analysis (high ≥0.8, medium 0.3–0.8, low <0.3) with fraud counts per tier.
- Lines 83–102: Precision-recall curve and probability distribution visualization.

**Role in Pipeline**: Establishes a baseline performance benchmark. The system later moves to XGBoost for improved performance.

## 7.4 `phase1_xgboost.py` (134 lines)

**Purpose**: Calibrated XGBoost model with isotonic calibration and threshold optimization.

**What it does**:
- Lines 22–37: Same data loading and splitting as phase1_modeling.
- Line 40: Computes `scale_pos_weight = (negatives / positives)` for class imbalance handling.
- Lines 43–52: XGBClassifier with `n_estimators=300`, `max_depth=4`, `learning_rate=0.05`, GPU acceleration (`device="cuda"`).
- Lines 55–59: Wraps in `CalibratedClassifierCV` with isotonic calibration and 3-fold CV.
- Lines 70–74: Baseline evaluation at threshold 0.5.
- Lines 80–88: Precision-recall curve visualization.
- Lines 94–108: Threshold optimization: Finds optimal threshold where `recall >= 0.85` and precision is maximized.
- Lines 114–133: Final 3-tier system using `T_block = 0.8` and optimized threshold.

**Key Design Decision**: Isotonic calibration was chosen over Platt scaling (sigmoid). Isotonic calibration is non-parametric and handles the non-linear probability distribution of gradient-boosted models better. This is validated in Phase 5.

## 7.5 `phase2_uncertainty.py` (185 lines)

**Purpose**: Bootstrap ensemble for uncertainty estimation + 2D routing logic + cost simulation.

**This is the most critical research script** — it produces the primary production artifact (`xgb_ensemble.pkl`).

**What it does**:
- Lines 17–28: Data loading and splitting (same parameters as all phases).
- Lines 35–69: **Bootstrap Ensemble Training**:
  - 5 models (`n_models = 5`), each trained on a bootstrap sample of the training data.
  - Each model: XGBClassifier(300 trees, depth 4, lr 0.05, **CPU** — note: switched from GPU in phase1) → CalibratedClassifierCV(isotonic, 3-fold).
  - Seeds 0–4 for reproducibility.
  - Each model predicts on X_test independently.
- Lines 76–82: Computes `mean_prob` (ensemble mean) and `uncertainty` (ensemble standard deviation).
- Lines 87–114: **2D Risk × Uncertainty Routing** (6 decisions in research, refined to 5 in production):
  - `T_block = 0.8`, `T_review = 0.1164`, `U_threshold = 0.015`
  - High risk + low uncertainty → AUTO_BLOCK
  - High risk + high uncertainty → ESCALATE_INVEST
  - Medium risk + low uncertainty → MANUAL_REVIEW
  - Medium risk + high uncertainty → ABSTAIN
  - Low risk + low uncertainty → AUTO_APPROVE
  - Low risk + high uncertainty → STEP_UP_AUTH
- Lines 137–178: **Business Cost Simulation** with: C_FN=$5000, C_FP_block=$200, C_manual=$50, C_step_up=$10, C_escalate=$100.
- Lines 180–184: Saves ensemble models to `artifacts/xgb_ensemble.pkl`.

**Critical Note**: The research phase uses 6 decision states (AUTO_BLOCK, ESCALATE_INVEST, MANUAL_REVIEW, ABSTAIN, AUTO_APPROVE, STEP_UP_AUTH) while the production engine uses 5 states (DECLINE, ESCALATE_INVEST, STEP_UP_AUTH, ABSTAIN, APPROVE). The naming was refined and MANUAL_REVIEW was consolidated into STEP_UP_AUTH in production.

## 7.6 `phase3_explainability.py` (107 lines)

**Purpose**: SHAP (SHapley Additive exPlanations) explainability analysis.

**What it does**:
- Lines 14–25: Data loading and splitting.
- Lines 30–41: Trains a base XGBClassifier (NOT calibrated — SHAP requires direct access to tree structure).
- Lines 44–45: Creates SHAP TreeExplainer and computes SHAP values for entire test set.
- Lines 50–51: Generates global SHAP summary plot (feature importance).
- Lines 58–66: Explains one fraud case with SHAP force plot.
- Lines 72–80: Explains one legitimate case with SHAP force plot.
- Lines 86–106: Loads `phase2_results.csv`, finds an ABSTAIN case, and explains it with SHAP.

**Key Design Decision**: Uses `TreeExplainer` (not `KernelExplainer`) because XGBoost is tree-based. This is exact (not approximate) and fast.

**Note**: The SHAP analysis is NOT integrated into the production engine. The `top_features` field in the API response is always an empty list (`[]`) — see `decision_engine.py` line 181. This is a deliberate simplification for production speed.

## 7.7 `phase4_outlier.py` (109 lines)

**Purpose**: Isolation Forest novelty detection training.

**What it does**:
- Lines 13–24: Data loading and splitting.
- Lines 30–39: **Trains Isolation Forest ONLY on legitimate transactions** (`y_train == 0`). This is the key design decision — the model learns what "normal" looks like, so anything that doesn't fit is flagged as novel.
  - `n_estimators=200`, `contamination=0.001` (approximates true fraud rate), `n_jobs=-1` (all CPU cores).
- Lines 46–54: Computes anomaly scores using `decision_function()`. NOTE: Line 49 negates the score (`anomaly_score = -anomaly_score`) so that higher = more anomalous. However, this negation is NOT used in the production engine — the engine uses the raw `decision_function()` output directly and compares against a negative threshold (`-0.08`).
- Lines 60–68: Compares fraud vs legitimate anomaly score distributions.
- Lines 84–94: Simple threshold detection test using 99.9th percentile of legitimate scores.
- Lines 102–108: Saves Isolation Forest to `artifacts/isolation_forest.pkl`.

## 7.8 `phase5_reliability.py` (99 lines)

**Purpose**: Calibration verification — comparing raw vs calibrated XGBoost.

**What it does**:
- Lines 35–48: Trains raw XGBClassifier (no calibration) and predicts probabilities.
- Lines 54–62: Trains calibrated XGBClassifier (isotonic, 3-fold CV) and predicts probabilities.
- Lines 68–73: Computes Brier scores for both models. Lower Brier score = better calibration.
- Lines 79–97: Plots reliability curves for both models against perfect calibration diagonal.

**Key Finding**: Calibrated model has a lower Brier score than the raw model, confirming that isotonic calibration improves probability reliability. This validates the decision to use `CalibratedClassifierCV` in the production ensemble.

## 7.9 `backend/engine/decision_engine.py` (188 lines)

**Purpose**: The production inference engine. This is the heart of the system.

**Detailed breakdown in Section 8 (Line-Level Explanation).**

## 7.10 `api/main.py` (32 lines)

**Purpose**: FastAPI REST API wrapper around the DecisionEngine.

**What it does**:
- Lines 1–5: Imports FastAPI, Pydantic, numpy, sys, os.
- Lines 7–9: **sys.path hack** — adds project root to Python path so `backend.engine.decision_engine` can be imported. This is necessary because the project is NOT structured as an installable Python package.
- Line 11: Imports `DecisionEngine`.
- Line 13: Creates FastAPI application with title "Risk-Aware Fraud Decision API".
- Line 16: **Instantiates DecisionEngine at module level** — this means model loading happens ONCE at startup, not per-request. This is a critical performance decision.
- Lines 18–19: Defines `TransactionInput` Pydantic model with a single field: `features: list[float]` with comment "must be length 31".
- Lines 21–23: `GET /` — health check endpoint returning `{"message": "Fraud Decision API is running"}`.
- Lines 25–32: `POST /predict` — main prediction endpoint:
  - Validates feature count (returns error dict if ≠ 31, NOT an HTTP error).
  - Reshapes features to numpy array (1, 31).
  - Calls `engine.evaluate_transaction()`.
  - Returns result dict directly.

## 7.11 `backend/config/logger.py` (9 lines)

**Purpose**: Logging configuration.

**What it does**:
- Lines 3–7: Configures Python's `logging` module to write to `logs/system.log` at `INFO` level with timestamp-level-message format.
- Line 9: Creates a logger instance.

**CRITICAL NOTE**: This logger is **dead code**. It is NOT imported by `decision_engine.py`, `api/main.py`, `test_engine.py`, or any other production module. The `DecisionEngine` uses `print()` statements for its logging instead (lines 33, 39, 43, 46). The `logs/` directory does not exist in the repository.

## 7.12 `backend/test_engine.py` (41 lines)

**Purpose**: Smoke test for the DecisionEngine.

**What it does**:
- Lines 7–8: Adds project root to sys.path.
- Line 10: Imports DecisionEngine.
- Lines 13–36: `main()` function:
  - Instantiates DecisionEngine (loads models).
  - Infers expected feature count from first ensemble member's `n_features_in_` attribute.
  - Creates a zero-vector dummy input.
  - Runs `evaluate_transaction()`.
  - Prints JSON output.
- Lines 39–40: Standard `if __name__ == "__main__"` guard.

## 7.13 `frontend/app.py` (180 lines)

**Purpose**: Streamlit demonstration frontend.

**What it does**:
- Line 5: Hardcoded API URL: `http://localhost:8000/predict`.
- Line 7: Page config: title "Fraud Decision Engine", wide layout.
- Lines 21–36: `generate_random_transaction()` — creates synthetic 31-feature vectors with random time (0–172800s), random amount ($1–$5000), and 28 random PCA features (standard normal).
- Lines 42–45: `call_model(features)` — POSTs to API and returns response.
- Lines 51–60: `generate_for_decision(target, max_attempts=500)` — repeatedly generates random transactions and calls the model until the target decision is produced or 500 attempts are exhausted.
- Lines 66–93: Left panel with 5 routing buttons (APPROVE, ABSTAIN, STEP_UP_AUTH, ESCALATE_INVEST, DECLINE).
- Lines 98–180: Right panel displaying: Transaction Summary, Risk Analysis (with progress bar), Uncertainty Analysis, Novelty Detection, Routing Explanation (with conditional logic), Cost Simulation (JSON), and Full Engine Output (JSON).

**Design Note**: The routing explanation logic in `frontend/app.py` (lines 157–166) uses different tier names than the engine. The frontend checks for `tier == "high"` but the engine returns `tier == "high_risk"`. This means the routing explanation text will never match for high-risk cases — it falls through all conditions and displays an empty rule. This is a bug.

## 7.14 `Dockerfile` (13 lines)

**Purpose**: Docker containerization for the API.

- Line 1: `FROM python:3.11` — official Python 3.11 base image.
- Line 3: `WORKDIR /app`.
- Line 5: `COPY requirements.txt .` — copies requirements first for Docker layer caching.
- Line 7: `RUN pip install --no-cache-dir -r requirements.txt` — installs dependencies without pip cache.
- Line 9: `COPY . .` — copies entire project into container.
- Line 11: `EXPOSE 8000` — documents port (does not actually publish it).
- Line 13: `CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]` — starts uvicorn server.

**Note**: `COPY . .` copies EVERYTHING including `creditcard.csv` (~150 MB), `venv/`, and `.git/`. This creates an unnecessarily large Docker image. A `.dockerignore` file is missing.

## 7.15 `requirements.txt` (7 lines)

Lists 7 dependencies without version pinning: fastapi, uvicorn, numpy, scikit-learn, xgboost, joblib, pydantic.

**Missing from requirements.txt but needed**:
- `streamlit` — required for `frontend/app.py`
- `requests` — required for `frontend/app.py`
- `pandas` — required for all research phase scripts
- `matplotlib` — required for research phase scripts
- `seaborn` — required for research phase scripts
- `shap` — required for `phase3_explainability.py`

**[INFERRED]**: `requirements.txt` intentionally lists only production API dependencies. Research and frontend dependencies are installed separately in the venv.

## 7.16 `.gitignore` (5 lines)

Ignores: `venv/`, `__pycache__/`, `*.pyc`, `creditcard.csv`, `creditcard_phase0_clean.csv`.

**Note**: `phase2_results.csv` (3.5 MB) is NOT in `.gitignore` and would be committed to git. The `artifacts/` directory with `.pkl` files (8.6 MB total) is also NOT ignored — this is intentional, as these artifacts are needed for production deployment.

## 7.17 `README.md` (171 lines)

Comprehensive project documentation covering overview, architecture, decision framework, model validation, project structure, API usage, Docker deployment, key contributions, dataset description, future extensions, and current status. See Section 3 (Original Vision) for inferred intent from this file.

---

# 8. LINE-LEVEL EXPLANATION: CRITICAL COMPONENTS

## 8.1 `backend/engine/decision_engine.py` — Complete Line-Level Breakdown

### Lines 1–7: Imports
```
import os                          # File path resolution
from datetime import datetime      # Timestamp generation for response metadata
from typing import Any, List, Tuple  # Type annotations
import joblib                      # Model deserialization
import numpy as np                 # Numerical operations
```

### Lines 9–18: Class Definition and Docstring
The `DecisionEngine` class is the sole production inference component. The docstring explicitly lists the 5 subsystems: Bootstrap XGBoost ensemble, uncertainty estimation, Isolation Forest novelty detection, 2-axis routing, and 5 decision states.

### Lines 20–62: `__init__` — Constructor and Configuration

**Lines 22–23**: Parameters `model_path` and `anomaly_path` use the `str | None` union type (Python 3.10+ syntax). Both default to `None`, meaning the engine will auto-resolve paths relative to its own file location.

**Lines 26–28**: Path resolution strategy:
- `engine_dir` = directory containing `decision_engine.py` (i.e., `backend/engine/`)
- `project_root` = two levels up from `engine_dir` (i.e., project root)
- `artifacts_dir` = `project_root/artifacts/`

This relative path resolution means the engine works regardless of where it's invoked from, as long as the directory structure is preserved.

**Lines 30–31**: Resolves actual file paths using provided arguments or defaults.

**Lines 35–36**: Raises `FileNotFoundError` if ensemble model is missing. This is a hard failure — the engine cannot function without the ensemble.

**Lines 38–39**: Loads ensemble models via `joblib.load()`. The loaded object is a Python `list` of 5 `CalibratedClassifierCV` instances.

**Lines 41–46**: Loads Isolation Forest. Unlike the ensemble, this is a **soft dependency** — if the file doesn't exist, the engine continues with `anomaly_model = None` and novelty detection is disabled.

**Lines 48–57**: Hardcoded threshold configuration:
- `decline_threshold = 0.80` — above this risk score with low uncertainty → DECLINE
- `escalate_threshold = 0.60` — above this risk score with high uncertainty → ESCALATE_INVEST
- `auth_threshold = 0.30` — above this risk score (any uncertainty) → STEP_UP_AUTH
- `uncertainty_threshold = 0.02` — standard deviation above this = "high uncertainty"
- `anomaly_threshold = -0.08` — Isolation Forest score above this = "novel"

**Lines 59–62**: Cost configuration:
- `fraud_cost = 1000` — expected loss per fraudulent transaction
- `review_cost = 20` — cost of manual human review
- `false_positive_cost = 50` — defined but **never used in any method**

### Lines 68–80: `predict_proba` — Ensemble Prediction

This method iterates over all 5 ensemble models, collects their individual fraud probabilities, and computes the mean (risk score) and standard deviation (uncertainty).

**Line 72**: `model.predict_proba(X)[:, 1]` — extracts probability of class 1 (fraud) from each calibrated model.
**Line 75**: `np.vstack(probs)` — stacks into a 5×N matrix (5 models × N samples).
**Line 77–78**: Computes mean and std across models (axis 0 by default since it's a flat array for single-sample inference).
**Return type**: Tuple of (mean_probability, standard_deviation), both as Python floats.

### Lines 86–94: `anomaly_score` — Novelty Detection

**Line 88–89**: If no Isolation Forest is loaded, returns `(None, False)` — graceful degradation.
**Line 91**: `decision_function(X)[0]` returns a single score. In scikit-learn's Isolation Forest, more negative scores indicate more anomalous samples.
**Line 92**: `novelty_flag = score > self.anomaly_threshold` — NOTE: This compares the raw (negative-trending) score against `-0.08`. A score ABOVE `-0.08` (i.e., closer to zero or positive) means the sample is MORE normal, making `novelty_flag = True` for NORMAL samples. **This appears to be inverted logic.** See Technical Debt section.

### Lines 100–123: `decide` — 5-State Routing Logic

This method implements the 2-axis decision table:

**Line 103–104**: Rule 1: `prob >= 0.80 AND uncertainty < 0.02` → `DECLINE`. High confidence fraud.
**Line 107–108**: Rule 2: `prob >= 0.60 AND uncertainty >= 0.02` → `ESCALATE_INVEST`. High risk but model disagrees — send to human analyst.
**Line 111–112**: Rule 3: `0.30 <= prob < 0.80` → `STEP_UP_AUTH`. Medium risk — require additional authentication.
**Line 115–116**: Rule 4: `prob < 0.30 AND uncertainty >= 0.02` → `ABSTAIN`. Low risk but uncertain — defer.
**Line 119–120**: Rule 5: `novelty_flag` → `ESCALATE_INVEST`. Novel behavior override.
**Line 123**: Default: `APPROVE`. Low risk, low uncertainty, not novel.

**Gap Analysis**: There is a coverage gap in the routing logic. If `prob >= 0.80 AND uncertainty >= 0.02`, Rule 1 fails (requires uncertainty < 0.02), and Rule 2 also requires `prob >= 0.60` which is satisfied but checks `uncertainty >= 0.02` which is also satisfied. So Rule 2 catches it → `ESCALATE_INVEST`. This is correct behavior — high risk + high uncertainty should escalate, not auto-decline.

However, if `0.60 <= prob < 0.80 AND uncertainty < 0.02`: Rule 1 fails (prob < 0.80), Rule 2 fails (uncertainty < 0.02), Rule 3 catches it (0.30 <= prob). → `STEP_UP_AUTH`. This is appropriate.

### Lines 129–140: `estimate_cost` — Cost Simulation

**Line 131**: `expected_loss = prob * fraud_cost` — simple expected value calculation.
**Lines 133–136**: Manual review cost of $20 is applied for STEP_UP_AUTH, ESCALATE_INVEST, and ABSTAIN. APPROVE and DECLINE are fully automated (cost = $0).
**Line 138**: `net_utility = -expected_loss - manual_cost` — always negative, representing total cost of this transaction. More negative = worse.

**Note**: The `false_positive_cost` of $50 defined in `__init__` is never used in `estimate_cost()`. This is dead configuration.

### Lines 146–152: `tier` — Risk Tier Classification

Simple 3-tier classification: `high_risk` (≥0.80), `medium_risk` (≥0.30), `low_risk` (<0.30).

### Lines 158–188: `evaluate_transaction` — Main Orchestrator

**Lines 160–162**: Calls `predict_proba()`, `anomaly_score()`.
**Line 164**: Calls `decide()` with all three inputs.
**Line 166**: Calls `estimate_cost()`.
**Lines 168–188**: Assembles response dictionary with:
- `decision`: One of 5 routing states.
- `risk_score`: Mean ensemble probability.
- `uncertainty`: Standard deviation across ensemble.
- `novelty_flag`: Boolean from Isolation Forest.
- `tier`: Risk tier string.
- `costs`: Dict with expected_loss, manual_review_cost, net_utility.
- `explanations`: Dict with anomaly_score and empty `top_features` list.
- `meta`: Dict with model_version ("xgb_ensemble_v2"), uncertainty_method ("bootstrap_std"), and UTC timestamp.

---

# 9. CONFIGURATION EXPLANATION

All configuration is hardcoded as instance variables in `DecisionEngine.__init__()`. There are NO configuration files, NO environment variable overrides, and NO command-line argument parsing.

See `metrics_tables.md` for the complete tabulation of all configuration values with exact source locations.

---

# 10. ENVIRONMENT VARIABLES

**There are NO environment variables used anywhere in this project.** All configuration is hardcoded. The API URL in the frontend is hardcoded to `http://localhost:8000/predict`. The Dockerfile does not set any environment variables. The logging path is hardcoded to `logs/system.log`.

---

# 11. API ENDPOINTS

### `GET /`
- **File**: `api/main.py` line 21–23
- **Purpose**: Health check
- **Request**: None
- **Response**: `{"message": "Fraud Decision API is running"}`

### `POST /predict`
- **File**: `api/main.py` lines 25–32
- **Purpose**: Transaction fraud evaluation
- **Request Body**: `{"features": [float, float, ..., float]}` (exactly 31 floats)
- **Request Model**: `TransactionInput(BaseModel)` — validates type only, not length
- **Response** (success):
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
  },
  "explanations": {
    "anomaly_score": -0.12,
    "top_features": []
  },
  "meta": {
    "model_version": "xgb_ensemble_v2",
    "uncertainty_method": "bootstrap_std",
    "timestamp": "2026-02-21 00:00:00.000000"
  }
}
```
- **Response** (invalid feature count): `{"error": "Expected 31 features"}` — NOTE: This returns HTTP 200 with an error field, NOT HTTP 400/422.

### Swagger UI
- **URL**: `http://localhost:8000/docs`
- **Source**: Auto-generated by FastAPI from the app definition.

---

# 12. MODELS

## 12.1 XGBoost Bootstrap Ensemble (`xgb_ensemble.pkl`)

- **Type**: Python list of 5 `sklearn.calibration.CalibratedClassifierCV` objects
- **Base estimator**: `xgboost.XGBClassifier` (300 trees, depth 4, learning rate 0.05)
- **Calibration**: Isotonic calibration with 3-fold cross-validation
- **Training**: Each model trained on a different bootstrap sample of the training data (seeds 0–4)
- **Training device**: CPU (`device="cpu"` in phase2_uncertainty.py)
- **File size**: 6,803,689 bytes (~6.8 MB)
- **Producer**: `phase2_uncertainty.py` line 183
- **Consumer**: `DecisionEngine.__init__()` line 38
- **Input**: 31 numerical features (after cleaning/engineering)
- **Output**: Probability of fraud (class 1) per model

## 12.2 Isolation Forest (`isolation_forest.pkl`)

- **Type**: `sklearn.ensemble.IsolationForest`
- **Training data**: Legitimate transactions only (`y_train == 0`)
- **Hyperparameters**: 200 estimators, contamination=0.001, all CPU cores
- **File size**: 1,803,497 bytes (~1.8 MB)
- **Producer**: `phase4_outlier.py` line 106
- **Consumer**: `DecisionEngine.__init__()` line 42
- **Input**: Same 31 features
- **Output**: Anomaly score (decision_function) — more negative = more anomalous

---

# 13. HYPERPARAMETERS

See `metrics_tables.md` Section 4 (XGBoost), Section 5 (Logistic Regression), and Section 6 (Isolation Forest) for complete tabulation.

---

# 14. NUMERIC CONSTANTS

See `metrics_tables.md` for exhaustive tables covering all:
- Decision engine thresholds (Sections 1, 8)
- Cost configuration values (Sections 2, 3)
- Port numbers (Section 9)
- Dataset metrics (Section 10)
- Generator parameters (Section 12)
- Display thresholds (Section 13)
- Docker configuration (Section 14)
- Model metadata (Section 17)

---

# 15. SCRIPTS

### Production Scripts
| Script | Command | Purpose |
|--------|---------|---------|
| API server | `python -m uvicorn api.main:app --host 0.0.0.0 --port 8000` | Start FastAPI server |
| Frontend | `streamlit run frontend/app.py` | Start Streamlit UI |
| Smoke test | `python backend/test_engine.py` | Verify engine loads and evaluates |
| Docker build | `docker build -t fraud-api .` | Build container |
| Docker run | `docker run -p 8000:8000 fraud-api` | Run container |

### Research Scripts (Offline, Sequential Execution)
| Script | Purpose |
|--------|---------|
| `python phase0_exploration.py` | Data exploration and visualization |
| `python phase0_cleaning.py` | Data cleaning and feature engineering |
| `python phase1_modeling.py` | Baseline Logistic Regression |
| `python phase1_xgboost.py` | Calibrated XGBoost with threshold optimization |
| `python phase2_uncertainty.py` | Bootstrap ensemble + 2D routing + cost simulation |
| `python phase3_explainability.py` | SHAP explainability analysis |
| `python phase4_outlier.py` | Isolation Forest training |
| `python phase5_reliability.py` | Calibration verification |

### Cron Jobs / Schedulers
**None.** There are no scheduled tasks, background jobs, or periodic retraining pipelines.

---

# 16. LOGGING LOGIC

### Configured (but unused) Logger
- **File**: `backend/config/logger.py`
- **Destination**: `logs/system.log`
- **Level**: INFO
- **Format**: `%(asctime)s - %(levelname)s - %(message)s`
- **Status**: **DEAD CODE** — never imported by any module

### Actual Logging (print statements)
The `DecisionEngine` uses `print()` for startup diagnostics:
- Line 33: `[DecisionEngine] Project root: {project_root}`
- Line 39: `[DecisionEngine] Loaded ensemble with {N} members.`
- Line 43: `[DecisionEngine] Isolation Forest loaded.`
- Line 46: `[DecisionEngine] Isolation Forest not found. Novelty disabled.`

These print statements go to stdout, which is captured by Docker logs and uvicorn's output.

---

# 17. ERROR HANDLING

### Explicit Error Handling
1. **`DecisionEngine.__init__`** (line 35–36): `FileNotFoundError` if ensemble model file is missing. This is a fatal startup error.
2. **`api/main.py`** (lines 27–28): Returns `{"error": "Expected 31 features"}` if feature count ≠ 31. NOTE: Returns HTTP 200, not 4xx.
3. **`test_engine.py`** (lines 22–26): `RuntimeError` if `n_features_in_` cannot be inferred from the first model.

### Implicit Error Handling (no try/catch)
- `joblib.load()` can raise various exceptions if the pickle file is corrupted.
- `model.predict_proba()` can raise if feature dimensions don't match training dimensions.
- `requests.post()` in the frontend can raise `ConnectionError`, `Timeout`, etc.
- `np.array().reshape()` can raise on invalid input.
- `anomaly_model.decision_function()` can raise on dimension mismatch.

### Missing Error Handling
- No input sanitization beyond feature count check (NaN, Inf, extreme values not caught).
- No timeout handling on the API.
- No rate limiting.
- No request logging.
- No graceful shutdown handling.

---

# 18. FAILURE MODES

| Failure | Cause | Behavior |
|---------|-------|----------|
| **Startup crash** | `xgb_ensemble.pkl` missing | `FileNotFoundError` — server does not start |
| **Degraded startup** | `isolation_forest.pkl` missing | Engine loads, novelty detection disabled (`novelty_flag` always `False`) |
| **Wrong feature count** | Client sends ≠ 31 features | Returns `{"error": "..."}` with HTTP 200 (not 400) |
| **Model dimension mismatch** | Feature engineering changed | `predict_proba()` crashes with sklearn ValueError |
| **Frontend cannot connect** | API not running on port 8000 | `requests.post()` raises `ConnectionError` — Streamlit shows stack trace |
| **Out of memory** | Large batch inference (not currently supported) | Process killed by OS |
| **Corrupt pickle** | Model file corrupted | `joblib.load()` raises `UnpicklingError` at startup |
| **Stale models** | Data drift over time | Silent — model produces increasingly unreliable predictions |
| **Docker image too large** | No `.dockerignore` | ~150 MB CSV + venv included in image — slow build and deploy |
| **Logger failure** | `logs/` directory doesn't exist | Would raise `FileNotFoundError` if logger were imported (currently dead code) |

---

# 19. SECURITY DECISIONS

### Current Security Posture
- **No authentication**: API is open — anyone with network access can call `/predict`.
- **No authorization**: No role-based access control.
- **No HTTPS**: Server runs on plain HTTP.
- **No input validation beyond count**: No sanitization for NaN, Inf, or adversarial inputs.
- **No rate limiting**: API can be flooded with requests.
- **No CORS configuration**: FastAPI's default CORS (no CORS headers) is used.
- **No secrets management**: No API keys, tokens, or environment-based secrets.
- **Pickle deserialization**: `joblib.load()` uses pickle under the hood, which is inherently unsafe if model files could be tampered with.
- **sys.path manipulation**: `api/main.py` line 9 modifies `sys.path` at runtime — functional but not a security best practice.

**[INFERRED]**: Security is minimal because this is currently a local/development deployment, not a public-facing service. The README's "Future Extensions" section lists "Public cloud deployment" as a next step, at which point security would need to be addressed.

---

# 20. DEPLOYMENT STRATEGY

### Current Deployment
- **Local Docker**: `docker build -t fraud-api . && docker run -p 8000:8000 fraud-api`
- **Base image**: `python:3.11` (full image, not slim/alpine)
- **Server**: uvicorn (single worker, no gunicorn)
- **Port**: 8000 (HTTP)
- **Frontend**: Run separately via `streamlit run frontend/app.py` (not containerized)

### Deployment Issues
1. No `.dockerignore` — Docker context includes 150+ MB of CSV data and the entire venv.
2. Single uvicorn worker — no parallelism.
3. Frontend is not dockerized — requires separate local setup.
4. No docker-compose for orchestrating API + frontend.
5. No health check in Dockerfile.
6. No production WSGI server (e.g., gunicorn with uvicorn workers).

---

# 21. SCALING STRATEGY

**There is no scaling strategy implemented.** The current architecture is:

- Single-process uvicorn server
- Models loaded into memory once at startup
- Synchronous request handling
- No horizontal scaling configuration
- No load balancing
- No caching
- No batching support
- No async processing
- No message queue
- No database

**[INFERRED]** Scaling is listed in "Future Extensions" as "Real-time transaction streaming" and "Public cloud deployment."

---

# 22. TECHNICAL DEBT

### Critical
1. **Potential Anomaly Score Inversion Bug**: In `decision_engine.py` line 92, `novelty_flag = score > self.anomaly_threshold` where `anomaly_threshold = -0.08`. The `decision_function()` of Isolation Forest returns MORE NEGATIVE scores for MORE anomalous samples. Therefore `score > -0.08` is True for NORMAL samples, making `novelty_flag = True` for normal transactions. This is potentially inverted — it means novelty is flagged for normal behavior, not anomalous behavior. Compare with `phase4_outlier.py` line 49 where the score is explicitly negated. **Severity: HIGH — may cause incorrect routing decisions.**

2. **Frontend Tier Name Mismatch**: `frontend/app.py` lines 157–166 check for `tier == "high"` but the engine returns `tier == "high_risk"`. The routing explanation UI text will never display for high-risk cases.

### High
3. **No Version Pinning**: `requirements.txt` has no version constraints. A future `pip install` could pull breaking changes.
4. **Dead Logger Module**: `backend/config/logger.py` is defined but never imported. Production code uses `print()` statements.
5. **Empty `backend/models/` Directory**: Exists as a placeholder but serves no purpose.
6. **Missing `.dockerignore`**: Docker build context includes ~310+ MB of unnecessary data.
7. **API Error Response as HTTP 200**: Invalid feature count returns `{"error": "..."}` with HTTP 200 instead of HTTP 400/422.

### Medium
8. **`false_positive_cost = 50` Never Used**: Defined in constructor but never referenced in `estimate_cost()`.
9. **`top_features` Always Empty**: `explanations.top_features` is always `[]` — SHAP is not integrated into production.
10. **Frontend Uncertainty Threshold Mismatch**: Frontend uses `0.01` for display vs engine's `0.02` for routing.
11. **Research Scripts Use GPU, Production Uses CPU**: Research phases use `device="cuda"`, production ensemble was trained with `device="cpu"`. This is fine for model portability but undocumented.
12. **sys.path Manipulation**: Both `api/main.py` and `test_engine.py` modify `sys.path` at runtime instead of using proper package structure.
13. **`phase2_results.csv` Not in `.gitignore`**: 3.5 MB intermediate file would be committed to git.
14. **No `__init__.py` Files**: `backend/`, `backend/engine/`, `backend/config/`, `api/` directories lack `__init__.py` files, preventing proper Python package imports without sys.path hacks.

### Low
15. **`datetime.utcnow()` Deprecated**: Python 3.12+ deprecates `datetime.utcnow()` in favor of `datetime.now(timezone.utc)`.
16. **Hardcoded API URL in Frontend**: `http://localhost:8000/predict` should be configurable.
17. **No Type Annotations on `X` Parameters**: `predict_proba(self, X)`, `anomaly_score(self, X)`, and `evaluate_transaction(self, X)` lack type hints for the input parameter.

---

# 23. INFERRED DESIGN DECISIONS

All items in this section are marked as **[INFERRED]** — they are deduced from code analysis, not from explicit documentation.

1. **[INFERRED]** The decision to use 5 bootstrap models (not 3 or 10) was likely a pragmatic trade-off between uncertainty estimation quality and inference speed. 5 models provide reasonable variance estimates while keeping prediction time manageable.

2. **[INFERRED]** The switch from GPU (`device="cuda"`) in research phases to CPU (`device="cpu"`) in the production ensemble training (phase2_uncertainty.py) suggests the developer's production deployment target does not have GPU access.

3. **[INFERRED]** The Isolation Forest being trained exclusively on legitimate transactions (not the full dataset) is an intentional semi-supervised approach — the model learns the distribution of "normal" and flags anything outside it as novel.

4. **[INFERRED]** The `false_positive_cost = 50` was likely intended for a more sophisticated cost model that was planned but not implemented. It remains as a vestigial configuration.

5. **[INFERRED]** The empty `backend/models/` directory suggests plans for a models module (perhaps Pydantic response models or data models) that was never implemented.

6. **[INFERRED]** The `logger.py` module was likely created early in development but the developer switched to `print()` statements during rapid iteration and never migrated back.

7. **[INFERRED]** The threshold values in the production engine (`auth_threshold = 0.30`, `uncertainty_threshold = 0.02`) differ from research thresholds (`T_review = 0.1164`, `U_threshold = 0.015`) because the developer deliberately tuned them for production use after observing research results.

8. **[INFERRED]** The decision names were deliberately renamed from research (AUTO_BLOCK, MANUAL_REVIEW, AUTO_APPROVE) to production-friendly terms (DECLINE, STEP_UP_AUTH, APPROVE) for clarity in a business context.

9. **[INFERRED]** The project evolved from bottom-up (data exploration → modeling → uncertainty → explainability → deployment) rather than top-down architecture-first development. Each phase script was written, validated, and then the next phase was built on its outputs.

10. **[INFERRED]** The lack of a `setup.py` or `pyproject.toml` indicates this project was not intended to be distributed as an installable Python package — it's a standalone application.

---

# 24. IMAGE PLACEHOLDERS

[IMAGE_PLACEHOLDER: SYSTEM_ARCHITECTURE]
See: `PROJECT_DOCUMENTATION/architecture_graph.mmd`

[IMAGE_PLACEHOLDER: DATA_FLOW]
See: `PROJECT_DOCUMENTATION/architecture_graph.mmd` (data flow arrows included in architecture graph)

[IMAGE_PLACEHOLDER: SEQUENCE_FLOW]
See: `PROJECT_DOCUMENTATION/sequence_diagrams.mmd`

[IMAGE_PLACEHOLDER: MODEL_ARCHITECTURE]
See: `PROJECT_DOCUMENTATION/architecture_graph.mmd` (Ensemble Prediction Subsystem and Anomaly Detection Subsystem sections)

[IMAGE_PLACEHOLDER: DEPENDENCY_GRAPH]
See: `PROJECT_DOCUMENTATION/dependency_graph.mmd`

---

# 25. GLASS LENS FRONTEND

A new glassmorphism-styled frontend that visualizes each transaction as a layered "X-Ray" through all three detection axes.

### Location
`frontend-glass/` — standalone Vite project, decoupled from the existing Streamlit demo.

### Tech Stack
- **Build:** Vite 6.x (dev server + production bundler)
- **Language:** Vanilla JavaScript (ES modules)
- **Styling:** Vanilla CSS with custom properties for theming
- **Canvas:** HTML5 Canvas 2D API for the Decision Landscape
- **API:** Browser Fetch API, proxied through Vite (`/api/predict` → `localhost:8000/predict`)

### Key Files
| File | Purpose |
|---|---|
| `index.html` | 3-panel layout: Controls, X-Ray Analysis, Decision Landscape |
| `style.css` | Complete design system — glassmorphism, dark/light themes, animations |
| `main.js` | API integration, sequential layer rendering, presets, history |
| `landscape.js` | Canvas 2D: Risk×Uncertainty decision region topology with transaction dots |
| `vite.config.js` | Dev proxy config forwarding `/api/*` → `localhost:8000/*` |

### UI Components
1. **Header:** Logo, API health indicator (polling every 15s), dark/light toggle
2. **Controls Panel (left):** Generate Random button, 5 preset scenario buttons, transaction history list
3. **Analysis Panel (center):** Sequential reveal of 4 layer cards:
   - Layer 1: **Ensemble Risk** — score, progress bar, tier badge, explanation
   - Layer 2: **Uncertainty** — std dev, confidence badge, simulated ensemble bar chart
   - Layer 3: **Novelty** — anomaly score, flag badge, anomaly ruler
   - Verdict: **Decision** — icon, label, routing rule, cost breakdown
4. **Landscape Panel (right):** 2D canvas plot of Risk (x-axis) × Uncertainty (y-axis) with color-coded decision regions matching exact engine thresholds

### How It Connects
- All communication with the backend is via HTTP POST to `/api/predict` (same endpoint as Streamlit)
- In development, Vite's proxy avoids CORS by forwarding `/api/*` requests to `localhost:8000`
- Feature vectors are generated client-side (31 floats: Time + 29 PCA + Amount)
- No shared code with the Streamlit frontend — fully independent

### How to Run
```bash
# Terminal 1: Backend
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Glass Lens Frontend
cd frontend-glass
npm install   # first time only
npm run dev   # → http://localhost:5173
```

---

# END OF PROJECT BIBLE
### Total source files analyzed: 13 Python files + 4 config/infra files + 4 JavaScript/HTML/CSS files
### Total lines of source code analyzed: ~5,000+ lines
### Last updated: 2026-02-21T21:18:00+05:30
