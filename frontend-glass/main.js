/* ========================================================
   Glass Lens — Main Application Logic
   Handles API calls, rendering, animations, and UI state
   ======================================================== */

import { initLandscape, plotTransaction, clearHistory } from './landscape.js';

// ---- Config ----
const API_URL = '/api/predict';
const DIRECT_API_URL = 'http://localhost:8000/predict';

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

// ---- Preset Scenarios ----
// These are tuned feature vectors designed to trigger specific decisions
const PRESETS = {
    safe: () => {
        // Low risk: small amount, normal PCA features, safe time
        const pca = Array.from({ length: 29 }, () => gaussRand() * 0.3);
        return [36000, ...pca, 25.0];
    },
    medium: () => {
        // Medium risk: moderate anomaly in some PCA features
        const pca = Array.from({ length: 29 }, (_, i) =>
            i < 5 ? gaussRand() * 2.5 + 1.5 : gaussRand() * 0.5
        );
        return [72000, ...pca, 800.0];
    },
    uncertain: () => {
        // Uncertain: features that cause ensemble disagreement
        const pca = Array.from({ length: 29 }, (_, i) =>
            i < 3 ? gaussRand() * 3 + 0.5 : gaussRand() * 1.2
        );
        return [10000, ...pca, 50.0];
    },
    novel: () => {
        // Novel: extreme values in uncommon PCA dimensions
        const pca = Array.from({ length: 29 }, (_, i) =>
            i > 20 ? gaussRand() * 6 + 4 : gaussRand() * 0.4
        );
        return [150000, ...pca, 3500.0];
    },
    fraud: () => {
        // Fraud: strong fraud-like PCA signature
        const pca = Array.from({ length: 29 }, (_, i) =>
            i < 10 ? gaussRand() * 3 - 2 : gaussRand() * 2 + 1
        );
        return [3600, ...pca, 4999.0];
    },
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
    // Try proxy first (Vite dev), fall back to direct
    let lastErr;
    for (const url of [API_URL, DIRECT_API_URL]) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ features }),
            });
            if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data.result || data;
        } catch (e) {
            lastErr = e;
            continue;
        }
    }
    throw lastErr || new Error('API not reachable');
}

async function checkHealth() {
    const status = $('#apiStatus');
    // Try proxy first (avoids CORS), then direct
    for (const url of ['/api/', 'http://localhost:8000/']) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                status.className = 'status-indicator online';
                status.querySelector('.status-text').textContent = 'API Connected';
                return true;
            }
        } catch {
            continue;
        }
    }
    status.className = 'status-indicator offline';
    status.querySelector('.status-text').textContent = 'API Offline';
    return false;
}

// ---- Generate for specific decision (retry loop) ----
async function generateForDecision(presetName, maxAttempts = 300) {
    for (let i = 0; i < maxAttempts; i++) {
        const features = PRESETS[presetName]();
        try {
            const payload = await callAPI(features);
            // Map presets to expected decisions
            const targetDecisions = {
                safe: 'APPROVE',
                medium: 'STEP_UP_AUTH',
                uncertain: 'ABSTAIN',
                novel: 'ESCALATE_INVEST',
                fraud: 'DECLINE',
            };
            if (payload.decision === targetDecisions[presetName]) {
                return { features, payload };
            }
        } catch {
            throw new Error('API not reachable');
        }
    }
    // If we can't match exactly, return the last result
    const features = PRESETS[presetName]();
    const payload = await callAPI(features);
    return { features, payload };
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

        if (isPreset && presetName) {
            const result = await generateForDecision(presetName);
            features = result.features;
            payload = result.payload;
        } else {
            payload = await callAPI(features);
        }

        showState('analysis');
        renderAnalysis(features, payload);
    } catch (err) {
        showState('empty');
        // Show inline error
        const empty = $('#emptyState');
        empty.querySelector('h2').textContent = 'Connection Error';
        empty.querySelector('p').innerHTML =
            `Could not reach the API at <code>localhost:8000</code>.<br/>Make sure the FastAPI backend is running.`;
        setTimeout(() => {
            empty.querySelector('h2').textContent = 'Transaction X-Ray';
            empty.querySelector('p').innerHTML =
                'Generate or select a transaction to see it pass through<br/>the three detection layers.';
        }, 5000);
    } finally {
        isAnalyzing = false;
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

    // Handle window resize for canvas
    window.addEventListener('resize', () => {
        initLandscape($('#landscapeCanvas'));
    });
}

document.addEventListener('DOMContentLoaded', init);
