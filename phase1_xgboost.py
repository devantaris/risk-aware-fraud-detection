import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    roc_auc_score,
    precision_recall_curve
)
from xgboost import XGBClassifier
from sklearn.calibration import CalibratedClassifierCV


# ====================================
# Phase 1 – XGBoost Model (Clean)
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
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# 5️⃣ Compute imbalance ratio
scale_pos_weight = (len(y_train) - y_train.sum()) / y_train.sum()

# 6️⃣ Train base XGBoost
base_model = XGBClassifier(
    n_estimators=300,
    max_depth=4,
    learning_rate=0.05,
    scale_pos_weight=scale_pos_weight,
    eval_metric="logloss",
    random_state=42,
    tree_method="hist",
    device="cuda"
)

# 7️⃣ Calibrate using Isotonic Regression
model = CalibratedClassifierCV(
    base_model,
    method="isotonic",
    cv=3
)

model.fit(X_train, y_train)

# 8️⃣ Predict calibrated probabilities
y_prob = model.predict_proba(X_test)[:, 1]


model.fit(X_train, y_train)

# 7️⃣ Predict probabilities
y_prob = model.predict_proba(X_test)[:, 1]

# ====================================
# 🔹 Default Threshold Evaluation (0.5)
# ====================================

y_pred_default = (y_prob >= 0.5).astype(int)

print("===== XGBOOST (Threshold = 0.5) =====")
print("ROC-AUC:", roc_auc_score(y_test, y_prob))
print(classification_report(y_test, y_pred_default))

# ====================================
# 🔹 Precision-Recall Curve
# ====================================

precision, recall, thresholds = precision_recall_curve(y_test, y_prob)

plt.figure(figsize=(8,6))
plt.plot(recall, precision)
plt.xlabel("Recall")
plt.ylabel("Precision")
plt.title("Precision-Recall Curve (XGBoost)")
plt.grid(True)
plt.show()

# Find best threshold where recall >= 0.85 and precision is maximized
best_t = None
best_p = 0
best_r = 0

for p, r, t in zip(precision, recall, thresholds):
    if r >= 0.85 and p > best_p:
        best_p = p
        best_r = r
        best_t = t

print("\nBest threshold with Recall >= 0.85")
print("Threshold:", best_t)
print("Precision:", best_p)
print("Recall:", best_r)


# ====================================
# 🔹 Controlled Recall Target (>= 0.90)
# ====================================

for p, r, t in zip(precision, recall, thresholds):
    if r >= 0.90:
        print("\nThreshold achieving Recall >= 0.90")
        print("Threshold:", t)
        print("Precision:", p)
        print("Recall:", r)
        break

# ====================================
# 🔹 Tier Analysis (0.8 / 0.3 split)
# ====================================

high_risk = y_prob >= 0.8
medium_risk = (y_prob >= 0.3) & (y_prob < 0.8)
low_risk = y_prob < 0.3

print("\n===== Tier Analysis =====")

print("\nHigh Risk (>=0.8)")
print("Count:", high_risk.sum())
print("Fraud:", y_test[high_risk].sum())

print("\nMedium Risk (0.3–0.8)")
print("Count:", medium_risk.sum())
print("Fraud:", y_test[medium_risk].sum())

print("\nLow Risk (<0.3)")
print("Count:", low_risk.sum())
print("Fraud:", y_test[low_risk].sum())
