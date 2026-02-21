import pandas as pd
import numpy as np
import shap
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

# ====================================
# Phase 3 – SHAP Explainability
# ====================================

# 1️⃣ Load Data
df = pd.read_csv("creditcard_phase0_clean.csv")
df["Amount"] = np.log1p(df["Amount"])

X = df.drop(columns=["Class"])
y = df["Class"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

scale_pos_weight = (len(y_train) - y_train.sum()) / y_train.sum()

# 2️⃣ Train Base XGBoost (no calibration here)
model = XGBClassifier(
    n_estimators=300,
    max_depth=4,
    learning_rate=0.05,
    scale_pos_weight=scale_pos_weight,
    eval_metric="logloss",
    random_state=42,
    tree_method="hist",
    device="cuda"
)

model.fit(X_train, y_train)

# 3️⃣ SHAP Explainer
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

# ====================================
# 🔹 Global Feature Importance
# ====================================
print("\nGenerating SHAP Summary Plot...")
shap.summary_plot(shap_values, X_test)

# ====================================
# 🔹 Explain One Fraud Case
# ====================================

# Find first fraud case in test set
fraud_index = np.where(y_test.values == 1)[0][0]

print("\nExplaining a Fraud Case...")
shap.force_plot(
    explainer.expected_value,
    shap_values[fraud_index],
    X_test.iloc[fraud_index],
    matplotlib=True
)

# ====================================
# 🔹 Explain One Legit Case
# ====================================

legit_index = np.where(y_test.values == 0)[0][0]

print("\nExplaining a Legit Case...")
shap.force_plot(
    explainer.expected_value,
    shap_values[legit_index],
    X_test.iloc[legit_index],
    matplotlib=True
)
# ====================================
# 🔹 Explain One ABSTAIN Case
# ====================================

# Load Phase 2 decision results
phase2_results = pd.read_csv("phase2_results.csv")

# Find one ABSTAIN case
abstain_indices = phase2_results.index[
    phase2_results["decision"] == "ABSTAIN"
]

if len(abstain_indices) > 0:

    idx = abstain_indices[0]
    print("\nExplaining an ABSTAIN case...")

    shap.force_plot(
        explainer.expected_value,
        shap_values[idx],
        X_test.iloc[idx],
        matplotlib=True
    )

else:
    print("No ABSTAIN cases found.")
