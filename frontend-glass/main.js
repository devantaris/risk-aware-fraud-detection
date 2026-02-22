/* ========================================================
   Glass Lens — Main Application Logic
   Handles API calls, rendering, animations, and UI state
   ======================================================== */

import { initLandscape, plotTransaction, clearHistory } from './landscape.js';

// ---- Config ----
// In development (npm run dev): VITE_API_URL is undefined → API_BASE is ''
//   → API_URL becomes '/predict', routed to localhost:8000 via Vite proxy.
// In production (Vercel): VITE_API_URL = 'https://your-app.up.railway.app'
//   → API_URL becomes 'https://your-app.up.railway.app/predict' (direct CORS call).
const API_BASE = import.meta.env.VITE_API_URL || '';
const API_URL = `${API_BASE}/predict`;

// ---- Decision Metadata ----
const DECISION_META = {
    APPROVE: {
        icon: '✓', class: 'verdict-approve',
        label: 'Approved',
        explanation: 'Transaction is safe. Low risk with high model confidence.',
    },
    ABSTAIN: {
        icon: '◌', class: 'verdict-abstain',
        label: 'Abstain — Deferred',
        explanation: 'Low risk but the ensemble models disagree. Decision deferred for safety.',
    },
    STEP_UP_AUTH: {
        icon: '⚿', class: 'verdict-stepup',
        label: 'Step-Up Authentication',
        explanation: 'Medium risk detected. Additional authentication required (e.g., OTP, biometric).',
    },
    ESCALATE_INVEST: {
        icon: '⚑', class: 'verdict-escalate',
        label: 'Escalate to Analyst',
        explanation: 'High risk with model uncertainty, or novel behavior detected. Routed to human fraud analyst.',
    },
    DECLINE: {
        icon: '✕', class: 'verdict-decline',
        label: 'Declined',
        explanation: 'High risk with high model confidence. Transaction auto-blocked.',
    },
};

// ---- Preset Demo Payloads ----
// Instead of brute-forcing (random features never trigger high fraud scores),
// presets construct realistic demo responses that show what each decision looks like.
// "Generate Random" still calls the real API.
function buildDemoPayload(decision, riskScore, uncertainty, noveltyFlag, anomalyScore) {
    const tier = riskScore >= 0.80 ? 'high_risk' : riskScore >= 0.30 ? 'medium_risk' : 'low_risk';
    const reviewDecisions = ['STEP_UP_AUTH', 'ESCALATE_INVEST', 'ABSTAIN'];
    const manualCost = reviewDecisions.includes(decision) ? 20.0 : 0.0;
    const expectedLoss = riskScore * 1000;

    return {
        decision,
        risk_score: riskScore,
        uncertainty,
        novelty_flag: noveltyFlag,
        tier,
        costs: {
            expected_loss: expectedLoss,
            manual_review_cost: manualCost,
            net_utility: -expectedLoss - manualCost,
        },
        explanations: {
            anomaly_score: anomalyScore,
            top_features: [],
        },
        meta: {
            model_version: 'xgb_ensemble_v2',
            uncertainty_method: 'bootstrap_std',
            timestamp: new Date().toISOString(),
        },
    };
}

const PRESET_DEMOS = {
    approve: () => ({
        features: [36000 + Math.random() * 10000, ...Array.from({ length: 29 }, () => gaussRand() * 0.3), 25 + Math.random() * 50],
        payload: buildDemoPayload('APPROVE', 0.0003 + Math.random() * 0.005, 0.0001 + Math.random() * 0.001, false, 0.22 + Math.random() * 0.1),
    }),
    stepup: () => ({
        features: [50000 + Math.random() * 20000, ...Array.from({ length: 29 }, () => gaussRand() * 1.5), 400 + Math.random() * 600],
        payload: buildDemoPayload('STEP_UP_AUTH', 0.45 + Math.random() * 0.15, 0.008 + Math.random() * 0.008, false, 0.10 + Math.random() * 0.08),
    }),
    abstain: () => ({
        features: [10000 + Math.random() * 5000, ...Array.from({ length: 29 }, () => gaussRand() * 1.2), 50 + Math.random() * 200],
        payload: buildDemoPayload('ABSTAIN', 0.12 + Math.random() * 0.10, 0.025 + Math.random() * 0.02, false, 0.15 + Math.random() * 0.1),
    }),
    escalate: () => ({
        features: [3600 + Math.random() * 3000, ...Array.from({ length: 29 }, () => gaussRand() * 2.5), 1500 + Math.random() * 2000],
        payload: buildDemoPayload('ESCALATE_INVEST', 0.72 + Math.random() * 0.10, 0.035 + Math.random() * 0.03, true, -0.15 + Math.random() * 0.05),
    }),
    decline: () => ({
        features: [1800 + Math.random() * 2000, ...Array.from({ length: 29 }, () => gaussRand() * 3), 3000 + Math.random() * 2000],
        payload: buildDemoPayload('DECLINE', 0.88 + Math.random() * 0.10, 0.005 + Math.random() * 0.01, false, 0.05 + Math.random() * 0.08),
    }),
};

// ---- State ----
let history = [];
let isAnalyzing = false;

// ---- DOM Refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- Helpers ----
function gaussRand() {
    // Box-Muller transform for normal distribution
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateRandomTransaction() {
    const time = Math.random() * 172800;
    const amount = Math.random() * 4999 + 1;
    const pca = Array.from({ length: 29 }, () => gaussRand());
    return [time, ...pca, amount];
}

function formatCurrency(val) {
    if (val == null) return '—';
    const sign = val < 0 ? '−' : '';
    return `${sign}$${Math.abs(val).toFixed(2)}`;
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
}

// ---- API ----

async function callAPI(features) {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ features }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data.result || data;
    } catch (e) {
        throw e || new Error('API not reachable');
    }
}

async function checkHealth() {
    const status = $('#apiStatus');
    const healthUrl = `${API_BASE}/health`;
    try {
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            status.className = 'status-indicator online';
            status.querySelector('.status-text').textContent = 'API Connected';
            return true;
        }
    } catch {
        // fall through
    }
    status.className = 'status-indicator offline';
    status.querySelector('.status-text').textContent = 'API Offline';
    return false;
}

// ---- Rendering ----
function showState(state) {
    const empty = $('#emptyState');
    const loading = $('#loadingState');
    const layers = $('#layersContainer');

    empty.classList.toggle('hidden', state !== 'empty');
    loading.classList.toggle('hidden', state !== 'loading');
    layers.classList.toggle('hidden', state !== 'analysis');
}

function renderAnalysis(features, payload) {
    // Transaction Summary
    $('#txnAmount').textContent = `$${features[features.length - 1].toFixed(2)}`;
    $('#txnTime').textContent = formatTime(features[0]);

    // Layer 1: Risk
    const risk = payload.risk_score || 0;
    const tier = payload.tier || 'low_risk';
    $('#riskScore').textContent = risk.toFixed(6);
    const riskProg = $('#riskProgress');
    riskProg.style.width = `${Math.min(risk * 100, 100)}%`;

    // Color the progress bar based on tier
    if (tier === 'high_risk') {
        riskProg.style.background = `linear-gradient(90deg, var(--color-stepup), var(--color-decline))`;
        riskProg.style.color = 'var(--color-decline)';
    } else if (tier === 'medium_risk') {
        riskProg.style.background = `linear-gradient(90deg, var(--color-approve), var(--color-stepup))`;
        riskProg.style.color = 'var(--color-stepup)';
    } else {
        riskProg.style.background = `linear-gradient(90deg, #6366f1, var(--color-approve))`;
        riskProg.style.color = 'var(--color-approve)';
    }

    // Tier badge
    const tierBadge = $('#tierBadge');
    tierBadge.textContent = tier.replace('_', ' ');
    tierBadge.className = 'tier-badge ' + (
        tier === 'high_risk' ? 'tier-high' :
            tier === 'medium_risk' ? 'tier-medium' : 'tier-low'
    );

    // Risk explanation
    const riskExpl = risk >= 0.8 ? 'The ensemble of 5 models strongly agrees this transaction shows fraud patterns.' :
        risk >= 0.3 ? 'The ensemble detects suspicious signals. Some fraud indicators are present.' :
            'The 5-model ensemble finds no significant fraud indicators in this transaction.';
    $('#riskExplanation').textContent = riskExpl;

    // Layer 2: Uncertainty
    const uncertainty = payload.uncertainty || 0;
    const isHighUncertainty = uncertainty >= 0.02;
    $('#uncertaintyValue').textContent = uncertainty.toFixed(6);

    const confBadge = $('#confidenceBadge');
    confBadge.textContent = isHighUncertainty ? 'High Disagreement' : 'Models Agree';
    confBadge.className = 'confidence-badge ' + (isHighUncertainty ? 'confidence-low' : 'confidence-high');

    // Simulate ensemble bars (we don't have individual model probs, so simulate around the mean)
    for (let i = 0; i < 5; i++) {
        const bar = $(`#ebar${i}`);
        const simulated = Math.max(0, Math.min(1, risk + (gaussRand() * uncertainty)));
        bar.style.height = `${Math.max(5, simulated * 100)}%`;

        // Color based on individual probability
        if (simulated > 0.6) {
            bar.style.background = `linear-gradient(to top, rgba(248, 113, 113, 0.3), rgba(248, 113, 113, 0.7))`;
        } else if (simulated > 0.3) {
            bar.style.background = `linear-gradient(to top, rgba(251, 191, 36, 0.3), rgba(251, 191, 36, 0.7))`;
        } else {
            bar.style.background = `linear-gradient(to top, rgba(99, 102, 241, 0.3), rgba(99, 102, 241, 0.7))`;
        }
    }

    const uncExpl = isHighUncertainty
        ? `Standard deviation of ${uncertainty.toFixed(4)} across the 5 bootstrap models indicates significant disagreement. The models are not confident in their assessment.`
        : `Standard deviation of ${uncertainty.toFixed(4)} shows strong consensus among all 5 models. The assessment is reliable.`;
    $('#uncertaintyExplanation').textContent = uncExpl;

    // Layer 3: Novelty
    const anomalyScore = payload.explanations?.anomaly_score;
    const noveltyFlag = payload.novelty_flag || false;
    $('#anomalyScore').textContent = anomalyScore != null ? anomalyScore.toFixed(6) : 'N/A';

    const novBadge = $('#noveltyBadge');
    novBadge.textContent = noveltyFlag ? 'Novel Pattern' : 'Known Pattern';
    novBadge.className = 'novelty-badge ' + (noveltyFlag ? 'novelty-novel' : 'novelty-normal');

    // Position anomaly dot: map score range roughly [-0.3, 0.1] to [0%, 100%]
    const anomalyDot = $('#anomalyDot');
    if (anomalyScore != null) {
        const mapped = Math.min(100, Math.max(0, ((anomalyScore + 0.3) / 0.4) * 100));
        anomalyDot.style.left = `${mapped}%`;
        anomalyDot.style.display = 'block';
    } else {
        anomalyDot.style.display = 'none';
    }

    const novExpl = noveltyFlag
        ? 'The Isolation Forest (trained solely on legitimate transactions) flags this transaction as having an unseen behavioral pattern.'
        : 'This transaction matches known legitimate behavioral patterns. No novel anomalies detected.';
    $('#noveltyExplanation').textContent = novExpl;

    // Verdict
    const decision = payload.decision || 'APPROVE';
    const meta = DECISION_META[decision] || DECISION_META.APPROVE;
    const verdictCard = $('#verdictCard');

    // Remove old classes
    verdictCard.className = 'verdict-card glass-card layer-hidden ' + meta.class;

    $('#verdictIcon').textContent = meta.icon;
    $('#verdictDecision').textContent = decision.replace(/_/g, ' ');
    $('#verdictExplanation').textContent = meta.explanation;

    // Routing rule
    const rule = buildRoutingRule(risk, uncertainty, noveltyFlag, decision);
    $('#verdictRule').textContent = rule;

    // Cost
    const costs = payload.costs || {};
    $('#costLoss').textContent = formatCurrency(costs.expected_loss);
    $('#costReview').textContent = formatCurrency(costs.manual_review_cost);
    $('#costUtility').textContent = formatCurrency(costs.net_utility);

    // Meta
    const pmeta = payload.meta || {};
    $('#metaModel').textContent = pmeta.model_version || '—';
    $('#metaMethod').textContent = pmeta.uncertainty_method || '—';
    $('#metaTimestamp').textContent = pmeta.timestamp || '—';

    // Plot on landscape
    plotTransaction(risk, uncertainty, decision);

    // Animate layers sequentially
    animateLayers();

    // Add to history
    addToHistory(features, payload);
}

function buildRoutingRule(risk, uncertainty, noveltyFlag, decision) {
    const r = risk.toFixed(2);
    const u = uncertainty.toFixed(4);
    switch (decision) {
        case 'DECLINE':
            return `Rule 1: risk(${r}) ≥ 0.80 AND uncertainty(${u}) < 0.02 → DECLINE`;
        case 'ESCALATE_INVEST':
            if (noveltyFlag)
                return `Rule 5: novelty_flag=true → ESCALATE_INVEST`;
            return `Rule 2: risk(${r}) ≥ 0.60 AND uncertainty(${u}) ≥ 0.02 → ESCALATE_INVEST`;
        case 'STEP_UP_AUTH':
            return `Rule 3: 0.30 ≤ risk(${r}) < 0.80 → STEP_UP_AUTH`;
        case 'ABSTAIN':
            return `Rule 4: risk(${r}) < 0.30 AND uncertainty(${u}) ≥ 0.02 → ABSTAIN`;
        case 'APPROVE':
            return `Rule 6: Default — low risk, low uncertainty, not novel → APPROVE`;
        default:
            return '—';
    }
}

function animateLayers() {
    const layers = ['txnSummary', 'layer1', 'layer2', 'layer3', 'flowConnector', 'verdictCard'];
    const delays = [0, 200, 500, 800, 1100, 1300];

    // First reset all to hidden
    layers.forEach(id => {
        const el = $(`#${id}`);
        el.classList.remove('layer-visible');
        el.classList.add('layer-hidden');
    });

    // Then reveal sequentially
    layers.forEach((id, i) => {
        setTimeout(() => {
            const el = $(`#${id}`);
            el.classList.remove('layer-hidden');
            el.classList.add('layer-visible');
        }, delays[i]);
    });
}

function addToHistory(features, payload) {
    const entry = {
        decision: payload.decision,
        risk: payload.risk_score,
        amount: features[features.length - 1],
        features,
        payload,
    };
    history.unshift(entry);
    if (history.length > 20) history.pop();
    renderHistory();
}

function renderHistory() {
    const list = $('#historyList');
    if (history.length === 0) {
        list.innerHTML = '<p class="history-empty">No transactions yet</p>';
        return;
    }

    list.innerHTML = history.map((h, i) => {
        const meta = DECISION_META[h.decision] || DECISION_META.APPROVE;
        const colorVar = `var(--color-${h.decision === 'APPROVE' ? 'approve' :
            h.decision === 'ABSTAIN' ? 'abstain' :
                h.decision === 'STEP_UP_AUTH' ? 'stepup' :
                    h.decision === 'ESCALATE_INVEST' ? 'escalate' : 'decline'})`;
        const bgVar = `var(--color-${h.decision === 'APPROVE' ? 'approve' :
            h.decision === 'ABSTAIN' ? 'abstain' :
                h.decision === 'STEP_UP_AUTH' ? 'stepup' :
                    h.decision === 'ESCALATE_INVEST' ? 'escalate' : 'decline'}-bg)`;

        return `<div class="history-item" data-index="${i}">
      <span class="history-risk">${h.risk.toFixed(4)}</span>
      <span class="history-decision" style="background:${bgVar};color:${colorVar}">${h.decision.replace(/_/g, ' ')}</span>
    </div>`;
    }).join('');

    // Click to re-render
    list.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index);
            const h = history[idx];
            showState('analysis');
            renderAnalysis(h.features, h.payload);
        });
    });
}

// ---- Main Event Handlers ----
async function handleGenerate(features, isPreset = false, presetName = null) {
    if (isAnalyzing) return;
    isAnalyzing = true;

    showState('loading');

    try {
        let payload;

        if (isPreset && presetName && PRESET_DEMOS[presetName]) {
            // Presets use instant demo payloads — no API call needed
            const demo = PRESET_DEMOS[presetName]();
            features = demo.features;
            payload = demo.payload;
        } else {
            // Generate Random uses the real API
            payload = await callAPI(features);
        }

        showState('analysis');
        renderAnalysis(features, payload);
    } catch (err) {
        showState('empty');
        const empty = $('#emptyState');
        empty.querySelector('h2').textContent = 'Connection Error';
        const target = API_BASE || 'the backend';
        empty.querySelector('p').innerHTML =
            `Could not reach the API at <code>${target}</code>.<br/>Make sure the backend is running and <code>VITE_API_URL</code> is set correctly.`;
        setTimeout(() => {
            empty.querySelector('h2').textContent = 'Transaction X-Ray';
            empty.querySelector('p').innerHTML =
                'Generate or select a transaction to see it pass through<br/>the three detection layers.';
        }, 5000);
    } finally {
        isAnalyzing = false;
        // Reset loading text for next use
        const loadingText = document.querySelector('#loadingState p');
        if (loadingText) loadingText.textContent = 'Analyzing transaction…';
    }
}

// ---- Theme Toggle ----
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    $('#themeToggle .theme-icon').textContent = next === 'dark' ? '☀' : '☾';
    localStorage.setItem('glass-lens-theme', next);
    // Re-render landscape canvas
    initLandscape($('#landscapeCanvas'));
}

// ---- Init ----
function init() {
    // Restore theme
    const saved = localStorage.getItem('glass-lens-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        $('#themeToggle .theme-icon').textContent = saved === 'dark' ? '☀' : '☾';
    }

    // Init landscape canvas
    initLandscape($('#landscapeCanvas'));

    // Check API health
    checkHealth();
    setInterval(checkHealth, 15000);

    // Generate Random button
    $('#btnGenerate').addEventListener('click', () => {
        const features = generateRandomTransaction();
        handleGenerate(features);
    });

    // Preset buttons
    $$('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            handleGenerate(null, true, preset);
        });
    });

    // Theme toggle
    $('#themeToggle').addEventListener('click', toggleTheme);

    // Tab switching for about section
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            // Deactivate all tabs and contents
            $$('.tab-btn').forEach(b => b.classList.remove('active'));
            $$('.tab-content').forEach(c => c.classList.remove('active'));
            // Activate clicked tab
            btn.classList.add('active');
            const contentId = 'content' + tab.charAt(0).toUpperCase() + tab.slice(1);
            const content = document.getElementById(contentId);
            if (content) content.classList.add('active');
        });
    });

    // Handle window resize for canvas
    window.addEventListener('resize', () => {
        initLandscape($('#landscapeCanvas'));
    });
}

document.addEventListener('DOMContentLoaded', init);
