import pandas as pd
import numpy as np
import matplotlib.pyplot as plt #visualization
import seaborn as sns #visualization

# Load dataset
df = pd.read_csv("creditcard.csv")

# Basic inspection
print("Dataset loaded successfully.\n")

print("Shape of dataset:")
print(df.shape)

print("\nFirst 5 rows:")
print(df.head())
print("Dataset shape (rows, columns):")
print(df.shape)

#measure fraud percentage
print("\nClass distribution:")
print(df["Class"].value_counts())

print("\nFraud percentage:")
fraud_percentage = df["Class"].mean() * 100
print(f"{fraud_percentage:.4f}%")


#visulaization of class distribution
'''plt.figure(figsize=(6,4))
sns.countplot(x="Class", data=df)
plt.title("Class Distribution (0 = Legit, 1 = Fraud)")
plt.show()
'''
#analyze amount distribution
print("\n=== Amount Statistics ===")
print(df["Amount"].describe())

plt.figure(figsize=(8,5))
sns.histplot(df["Amount"], bins=50, kde=True)
plt.title("Transaction Amount Distribution (All)")
plt.show()

#isolate behaviour
'''print("\n=== Amount Stats by Class ===")
print(df.groupby("Class")["Amount"].describe())

plt.figure(figsize=(8,5))
sns.boxplot(x="Class", y="Amount", data=df)
plt.ylim(0, 1000)  # limit for visibility
plt.title("Amount Distribution by Class (Zoomed)")
plt.show()
'''

'''print("\n=== Time Statistics ===")
print(df["Time"].describe())

plt.figure(figsize=(8,5))
sns.histplot(data=df, x="Time", hue="Class", bins=50, element="step")
plt.title("Transaction Time Distribution by Class")
plt.show()
'''

#hour of day feature 
df["hour"] = (df["Time"] / 3600) % 24

print("\n=== Hour Feature Preview ===")
print(df["hour"].head())

print("\nHour range:")
print("Min:", df["hour"].min())
print("Max:", df["hour"].max())


plt.figure(figsize=(8,5))
sns.histplot(data=df, x="hour", hue="Class", bins=24, element="step")
plt.title("Fraud vs Legit by Hour of Day")
plt.show()


# Create hour bins
df["hour_bin"] = df["hour"].astype(int)

fraud_rate_by_hour = df.groupby("hour_bin")["Class"].mean() * 100

print("\n=== Fraud Rate by Hour (%) ===")
print(fraud_rate_by_hour)

plt.figure(figsize=(8,5))
fraud_rate_by_hour.plot(kind="bar")
plt.title("Fraud Rate (%) by Hour of Day")
plt.ylabel("Fraud Rate (%)")
plt.show()


df = df.sort_values("Time")

df["delta_time"] = df["Time"].diff()

print("\n=== Delta Time Stats ===")
print(df["delta_time"].describe())

print("\n=== Delta Time by Class ===")
print(df.groupby("Class")["delta_time"].describe())
