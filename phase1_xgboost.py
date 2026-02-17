import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    roc_auc_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    f1_score
)
from xgboost import XGBClassifier
from sklearn.calibration import CalibratedClassifierCV

# ====================================
# Phase 1 – Calibrated XGBoost
# ====================================

# 1️⃣ Load dataset
df = pd.read_csv("creditcard_phase0_clean.csv")

# 2️⃣ Log-transform skewed feature
df["Amount"] = np.log1p(df["Amount"])

# 3️⃣ Split features / target
X = df.drop(columns=["Class"])
y = df["Class"]

# 4️⃣ Stratified split
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# 5️⃣ Class imbalance handling
scale_pos_weight = (len(y_train) - y_train.sum()) / y_train.sum()

# 6️⃣ Base XGBoost model
base_model = XGBClassifier(
    n_estimators=300,
    max_depth=4,
    learning_rate=0.05,
    scale_pos_weight=scale_pos_weight,
    eval_metric="logloss",
    random_state=42,
    tree_method="hist",
    device="cuda"   # GPU active
)

# 7️⃣ Isotonic Calibration
model = CalibratedClassifierCV(
    base_model,
    method="isotonic",
    cv=3
)

model.fit(X_train, y_train)

# 8️⃣ Calibrated probabilities
y_prob = model.predict_proba(X_test)[:, 1]

# ====================================
# 🔹 Baseline Evaluation (Threshold = 0.5)
# ====================================

print("===== CALIBRATED XGBOOST (0.5) =====")
print("ROC-AUC:", roc_auc_score(y_test, y_prob))

y_pred_05 = (y_prob >= 0.5).astype(int)
print(classification_report(y_test, y_pred_05))

# ====================================
# 🔹 Precision-Recall Curve
# ====================================

precision, recall, thresholds = precision_recall_curve(y_test, y_prob)

plt.figure(figsize=(8,6))
plt.plot(recall, precision)
plt.xlabel("Recall")
plt.ylabel("Precision")
plt.title("Precision-Recall Curve (Calibrated XGBoost)")
plt.grid(True)
plt.show()

# ====================================
# 🔹 Final Selected Threshold (Recall ≥ 0.85 Optimized)
# ====================================

best_t = None
best_p = 0
best_r = 0

for p, r, t in zip(precision, recall, thresholds):
    if r >= 0.85 and p > best_p:
        best_p = p
        best_r = r
        best_t = t

print("\n===== FINAL OPERATING POINT =====")
print("Threshold:", best_t)
print("Precision:", best_p)
print("Recall:", best_r)
print("F1:", 2 * (best_p * best_r) / (best_p + best_r))

# ====================================
# 🔹 Final 3-Tier Risk System
# ====================================

T_block = 0.8
T_review = best_t

auto_block = y_prob >= T_block
manual_review = (y_prob >= T_review) & (y_prob < T_block)
auto_approve = y_prob < T_review

print("\n===== FINAL 3-TIER SYSTEM =====")

print("\nAuto Block")
print("Count:", auto_block.sum())
print("Fraud:", y_test[auto_block].sum())

print("\nManual Review")
print("Count:", manual_review.sum())
print("Fraud:", y_test[manual_review].sum())

print("\nAuto Approve")
print("Count:", auto_approve.sum())
print("Fraud:", y_test[auto_approve].sum())
