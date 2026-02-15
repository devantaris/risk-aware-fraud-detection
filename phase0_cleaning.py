import pandas as pd
import numpy as np

# ==============================
# Phase 0 Cleaning Pipeline
# ==============================

# 1. Load raw dataset
df = pd.read_csv("creditcard.csv")

# 2. Sort by Time (important before delta calculation)
df = df.sort_values("Time").reset_index(drop=True)

# 3. Create hour-of-day feature (cyclic representation)
df["hour"] = (df["Time"] / 3600) % 24

# 4. Create delta_time feature
df["delta_time"] = df["Time"].diff()

# First row will have NaN after diff → replace with 0
df["delta_time"] = df["delta_time"].fillna(0)

# 5. Drop raw Time column
df_model = df.drop(columns=["Time"])

# 6. Final integrity checks
assert df_model.isnull().sum().sum() == 0, "Missing values detected"
assert df_model.shape[0] == 284807, "Row count mismatch"

# 7. Save cleaned dataset
df_model.to_csv("creditcard_phase0_clean.csv", index=False)

print("Phase 0 cleaning complete.")
print("Clean dataset saved as: creditcard_phase0_clean.csv")
print("Final shape:", df_model.shape)
