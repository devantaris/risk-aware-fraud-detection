import streamlit as st
import requests
import numpy as np

API_URL = "http://localhost:8000/predict"

st.set_page_config(page_title="Fraud Decision Engine", layout="wide")

st.title("💳 Risk-Aware Fraud Decision System")

st.markdown("""
This system demonstrates a **Risk × Uncertainty × Novelty** routing engine.

Synthetic transactions are generated in real-time to trigger specific routing decisions.
""")

# ----------------------------------------
# Feature Generator
# ----------------------------------------

def generate_random_transaction():
    """
    Generate simple synthetic transaction.
    """
    time = np.random.uniform(0, 172800)  # ~2 days in seconds
    amount = np.random.uniform(1, 5000)

    pca_features = np.random.normal(0, 1, 28)

    features = [time] + pca_features.tolist() + [amount]

    # Ensure 31 features if your model expects it
    if len(features) == 30:
        features.append(0.0)

    return features

# ----------------------------------------
# Call Model
# ----------------------------------------

def call_model(features):
    response = requests.post(API_URL, json={"features": features})
    payload = response.json()
    return payload.get("result", payload)

# ----------------------------------------
# Generate Transaction For Specific Decision
# ----------------------------------------

def generate_for_decision(target_decision, max_attempts=500):

    for _ in range(max_attempts):
        features = generate_random_transaction()
        payload = call_model(features)

        if payload.get("decision") == target_decision:
            return features, payload

    return None, None

# ----------------------------------------
# Layout
# ----------------------------------------

col_left, col_right = st.columns([1,2])

# ===============================
# LEFT PANEL – Routing Buttons
# ===============================
with col_left:

    st.header("Routing Controls")

    decision_buttons = [
        "APPROVE",
        "ABSTAIN",
        "STEP_UP_AUTH",
        "ESCALATE_INVEST",
        "DECLINE"
    ]

    for decision in decision_buttons:
        if st.button(f"Generate {decision}"):

            with st.spinner(f"Generating {decision} example..."):
                features, payload = generate_for_decision(decision)

            if payload is None:
                st.warning("Could not generate example in 500 attempts.")
            else:
                st.session_state["features"] = features
                st.session_state["payload"] = payload

# ===============================
# RIGHT PANEL – Intelligence
# ===============================
with col_right:

    st.header("Decision Intelligence Panel")

    if "payload" not in st.session_state:
        st.info("Click a routing button on the left.")
    else:

        features = st.session_state["features"]
        payload = st.session_state["payload"]

        risk = payload.get("risk_score", 0)
        tier = payload.get("tier")
        uncertainty = payload.get("uncertainty", 0)
        novelty = payload.get("novelty_flag")

        uncertainty_level = "High" if uncertainty > 0.01 else "Low"

        # --------------------------------
        # Transaction Summary
        # --------------------------------
        st.subheader("Transaction Summary")
        st.write(f"Time: {round(features[0],2)} seconds")
        st.write(f"Amount: ${round(features[-1],2)}")

        # --------------------------------
        # Risk Analysis
        # --------------------------------
        st.subheader("Risk Analysis")
        st.progress(min(risk,1.0))
        st.write("Risk Score:", round(risk,6))
        st.write("Risk Tier:", tier)

        # --------------------------------
        # Uncertainty
        # --------------------------------
        st.subheader("Uncertainty Analysis")
        st.write("Ensemble Std:", round(uncertainty,6))
        st.write("Uncertainty Level:", uncertainty_level)

        # --------------------------------
        # Novelty
        # --------------------------------
        st.subheader("Novelty Detection")
        st.write("Novelty Flag:", novelty)

        # --------------------------------
        # Routing Explanation
        # --------------------------------
        st.subheader("Routing Explanation")

        explanation = f"""
Risk Tier: {tier}  
Uncertainty Level: {uncertainty_level}  
Novelty Flag: {novelty}  

Routing Rule Applied:
"""

        if tier == "high" and uncertainty_level == "Low":
            explanation += "High Risk + Low Uncertainty → DECLINE"
        elif tier == "high" and uncertainty_level == "High":
            explanation += "High Risk + High Uncertainty → ESCALATE_INVEST"
        elif tier == "medium":
            explanation += "Medium Risk → STEP_UP_AUTH"
        elif tier == "low" and uncertainty_level == "High":
            explanation += "Low Risk + High Uncertainty → ABSTAIN"
        elif tier == "low" and uncertainty_level == "Low":
            explanation += "Low Risk + Low Uncertainty → APPROVE"

        st.write(explanation)

        # --------------------------------
        # Cost Simulation
        # --------------------------------
        st.subheader("Cost Simulation")
        st.json(payload.get("costs"))

        # --------------------------------
        # Full Output
        # --------------------------------
        st.subheader("Full Engine Output")
        st.json(payload)