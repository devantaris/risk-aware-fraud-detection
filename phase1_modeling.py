import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, roc_auc_score

# ==============================
# Phase 1 – Baseline Model Setup
# ==============================

# 1. Load cleaned dataset
df = pd.read_csv("creditcard_phase0_clean.csv")

# 2. Log-transform Amount (handle skew)
df["Amount"] = np.log1p(df["Amount"])

# 3. Separate features and target
X = df.drop(columns=["Class"])
y = df["Class"]

# 4. Stratified 80/20 split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# 5. Scale features
scaler = StandardScaler()

X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# 6. Train baseline Logistic Regression
model = LogisticRegression(max_iter=1000)

model.fit(X_train_scaled, y_train)

# 7. Predictions
y_pred = model.predict(X_test_scaled)
y_prob = model.predict_proba(X_test_scaled)[:, 1]

# 8. Evaluation
print("ROC-AUC:", roc_auc_score(y_test, y_prob))
print("\nClassification Report:\n")
print(classification_report(y_test, y_pred))
