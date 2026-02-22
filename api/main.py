from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import sys
import os

# Make backend importable
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(PROJECT_ROOT)

from backend.engine.decision_engine import DecisionEngine

app = FastAPI(title="Risk-Aware Fraud Decision API")

# ── CORS ──────────────────────────────────────────────────────────────────
# In production, set ALLOWED_ORIGINS to your Vercel deployment URL.
# Example: ALLOWED_ORIGINS=https://your-app.vercel.app
# For local development, defaults to allow all origins.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
if _raw_origins == "*":
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Engine (loaded once at startup, not per request) ──────────────────────
engine = DecisionEngine()


# ── Models ────────────────────────────────────────────────────────────────
class TransactionInput(BaseModel):
    features: list[float]  # must be length 31


# ── Endpoints ─────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Fraud Decision API is running"}


@app.get("/health")
def health():
    """Health check endpoint used by Railway and the Glass Lens status indicator."""
    return {"status": "ok", "model": "xgb_ensemble_v2"}


@app.post("/predict")
def predict(txn: TransactionInput):
    if len(txn.features) != 31:
        return {"error": "Expected 31 features"}

    features = np.array(txn.features).reshape(1, -1)
    result = engine.evaluate_transaction(features)
    return result