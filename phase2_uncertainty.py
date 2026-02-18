import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
from xgboost import XGBClassifier
from sklearn.calibration import CalibratedClassifierCV

# ======================================================
# Phase 2 – Bootstrap Ensemble + 2D Risk Decision Engine
# ======================================================

# -----------------------------
# 1️⃣ Load and Prepare Data
# -----------------------------
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

# -----------------------------
# 2️⃣ Bootstrap Ensemble
# -----------------------------
n_models = 5
probs = []

for seed in range(n_models):

    np.random.seed(seed)

    # Bootstrap sampling
    indices = np.random.choice(len(X_train), len(X_train), replace=True)
    X_boot = X_train.iloc[indices]
    y_boot = y_train.iloc[indices]

    base_model = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        scale_pos_weight=scale_pos_weight,
        eval_metric="logloss",
        random_state=seed,
        tree_method="hist",
        device="cpu"
    )

    model = CalibratedClassifierCV(
        base_model,
        method="isotonic",
        cv=3
    )

    model.fit(X_boot, y_boot)

    prob = model.predict_proba(X_test)[:, 1]
    probs.append(prob)

probs = np.array(probs)

# -----------------------------
# 3️⃣ Mean Risk + Uncertainty
# -----------------------------
mean_prob = probs.mean(axis=0)
uncertainty = probs.std(axis=0)

print("ROC-AUC (Mean Ensemble):", roc_auc_score(y_test, mean_prob))

print("\nUncertainty Statistics:")
print(pd.Series(uncertainty).describe())

# -----------------------------
# 4️⃣ 2D Risk × Uncertainty Engine
# -----------------------------
T_block = 0.8
T_review = 0.1164
U_threshold = 0.015   # Balanced configuration

decision = []

for p, u in zip(mean_prob, uncertainty):

    # High Risk Zone
    if p >= T_block:
        if u < U_threshold:
            decision.append("AUTO_BLOCK")
        else:
            decision.append("ESCALATE_INVEST")

    # Medium Risk Zone
    elif p >= T_review:
        if u < U_threshold:
            decision.append("MANUAL_REVIEW")
        else:
            decision.append("ABSTAIN")

    # Low Risk Zone
    else:
        if u < U_threshold:
            decision.append("AUTO_APPROVE")
        else:
            decision.append("STEP_UP_AUTH")

# -----------------------------
# 5️⃣ Final Output
# -----------------------------
results = pd.DataFrame({
    "probability": mean_prob,
    "uncertainty": uncertainty,
    "decision": decision,
    "true_label": y_test.values
})

print("\n===== DECISION DISTRIBUTION =====")
print(results["decision"].value_counts())

print("\n===== FRAUD BY DECISION =====")
print(results.groupby("decision")["true_label"].sum())


# ====================================
# 🔹 Business Cost Simulation
# ====================================

C_FN = 5000
C_FP_block = 200
C_manual = 50
C_step_up = 10
C_escalate = 100

total_cost = 0

for _, row in results.iterrows():

    decision = row["decision"]
    true = row["true_label"]

    # AUTO BLOCK
    if decision == "AUTO_BLOCK":
        if true == 0:
            total_cost += C_FP_block

    # AUTO APPROVE
    elif decision == "AUTO_APPROVE":
        if true == 1:
            total_cost += C_FN

    # MANUAL REVIEW
    elif decision == "MANUAL_REVIEW":
        total_cost += C_manual

    # STEP UP
    elif decision == "STEP_UP_AUTH":
        total_cost += C_step_up

    # ESCALATE
    elif decision == "ESCALATE_INVEST":
        total_cost += C_escalate

    # ABSTAIN (treated as manual)
    elif decision == "ABSTAIN":
        total_cost += C_manual

print("\n===== TOTAL SYSTEM COST =====")
print("Total Cost:", total_cost)
print("Average Cost per Transaction:", total_cost / len(results))
