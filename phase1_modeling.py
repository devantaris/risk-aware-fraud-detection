import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split

# ==============================
# Phase 1 – Train/Test Split
# ==============================

# 1. Load cleaned dataset
df = pd.read_csv("creditcard_phase0_clean.csv")

# 2. Separate features and target
X = df.drop(columns=["Class"])
y = df["Class"]

# 3. Stratified 80/20 split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# 4. Print shapes
print("Train shape:", X_train.shape)
print("Test shape:", X_test.shape)

# 5. Verify class distribution in splits
print("\nTrain fraud percentage:", y_train.mean() * 100)
print("Test fraud percentage:", y_test.mean() * 100)
