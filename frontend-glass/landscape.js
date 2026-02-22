/* ========================================================
   Glass Lens — Decision Landscape Canvas
   2D Risk × Uncertainty visualization with decision regions
   ======================================================== */

// ---- State ----
let canvas, ctx;
let transactionHistory = [];
let currentPoint = null;
let isDark = true;

// ---- Decision Region Colors ----
const REGION_COLORS = {
    dark: {
        APPROVE: { fill: 'rgba(52, 211, 153, 0.18)', border: 'rgba(52, 211, 153, 0.4)' },
        ABSTAIN: { fill: 'rgba(167, 139, 250, 0.18)', border: 'rgba(167, 139, 250, 0.4)' },
        STEP_UP_AUTH: { fill: 'rgba(251, 191, 36, 0.18)', border: 'rgba(251, 191, 36, 0.4)' },
        ESCALATE_INVEST: { fill: 'rgba(251, 146, 60, 0.18)', border: 'rgba(251, 146, 60, 0.4)' },
        DECLINE: { fill: 'rgba(248, 113, 113, 0.18)', border: 'rgba(248, 113, 113, 0.4)' },
    },
    light: {
        APPROVE: { fill: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.5)' },
        ABSTAIN: { fill: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.5)' },
        STEP_UP_AUTH: { fill: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.5)' },
        ESCALATE_INVEST: { fill: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.5)' },
        DECLINE: { fill: 'rgba(248, 113, 113, 0.15)', border: 'rgba(248, 113, 113, 0.5)' },
    },
};

const DOT_COLORS = {
    APPROVE: '#34d399',
    ABSTAIN: '#a78bfa',
    STEP_UP_AUTH: '#fbbf24',
    ESCALATE_INVEST: '#fb923c',
    DECLINE: '#f87171',
};

// ---- Thresholds from decision_engine.py ----
const T_DECLINE = 0.80;
const T_ESCALATE = 0.60;
const T_AUTH = 0.30;
const U_THRESHOLD = 0.02;

// ---- Canvas coordinate system ----
// X-axis: Risk Score  [0.0, 1.0]
// Y-axis: Uncertainty [0.0, 0.10] (displayed top=high, bottom=low)
const RISK_MIN = 0, RISK_MAX = 1;
const UNC_MIN = 0, UNC_MAX = 0.10;

// Margins
const MARGIN = { top: 16, right: 16, bottom: 40, left: 52 };

function getPlotArea() {
    const w = canvas.width - MARGIN.left - MARGIN.right;
    const h = canvas.height - MARGIN.top - MARGIN.bottom;
    return { x: MARGIN.left, y: MARGIN.top, w, h };
}

function riskToX(risk) {
    const { x, w } = getPlotArea();
    return x + ((risk - RISK_MIN) / (RISK_MAX - RISK_MIN)) * w;
}

function uncToY(unc) {
    const { y, h } = getPlotArea();
    // Invert: high uncertainty at top
    return y + h - ((unc - UNC_MIN) / (UNC_MAX - UNC_MIN)) * h;
}

// ---- Drawing ----
function drawRegions() {
    const theme = isDark ? 'dark' : 'light';
    const colors = REGION_COLORS[theme];
    const { y, h } = getPlotArea();

    const regions = [
        // APPROVE: risk < 0.30, uncertainty < 0.02
        {
            decision: 'APPROVE',
            path: () => {
                ctx.beginPath();
                ctx.moveTo(riskToX(0), uncToY(0));
                ctx.lineTo(riskToX(T_AUTH), uncToY(0));
                ctx.lineTo(riskToX(T_AUTH), uncToY(U_THRESHOLD));
                ctx.lineTo(riskToX(0), uncToY(U_THRESHOLD));
                ctx.closePath();
            },
        },
        // ABSTAIN: risk < 0.30, uncertainty >= 0.02
        {
            decision: 'ABSTAIN',
            path: () => {
                ctx.beginPath();
                ctx.moveTo(riskToX(0), uncToY(U_THRESHOLD));
                ctx.lineTo(riskToX(T_AUTH), uncToY(U_THRESHOLD));
                ctx.lineTo(riskToX(T_AUTH), uncToY(UNC_MAX));
                ctx.lineTo(riskToX(0), uncToY(UNC_MAX));
                ctx.closePath();
            },
        },
        // STEP_UP_AUTH: 0.30 <= risk < 0.60, any uncertainty
        // and 0.60 <= risk < 0.80, uncertainty < 0.02
        {
            decision: 'STEP_UP_AUTH',
            path: () => {
                ctx.beginPath();
                // Left block: 0.30 to 0.60, full height
                ctx.moveTo(riskToX(T_AUTH), uncToY(0));
                ctx.lineTo(riskToX(T_ESCALATE), uncToY(0));
                ctx.lineTo(riskToX(T_ESCALATE), uncToY(UNC_MAX));
                ctx.lineTo(riskToX(T_AUTH), uncToY(UNC_MAX));
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Right block: 0.60 to 0.80, uncertainty < 0.02
                ctx.beginPath();
                ctx.moveTo(riskToX(T_ESCALATE), uncToY(0));
                ctx.lineTo(riskToX(T_DECLINE), uncToY(0));
                ctx.lineTo(riskToX(T_DECLINE), uncToY(U_THRESHOLD));
                ctx.lineTo(riskToX(T_ESCALATE), uncToY(U_THRESHOLD));
                ctx.closePath();
            },
        },
        // ESCALATE_INVEST: risk >= 0.60, uncertainty >= 0.02
        {
            decision: 'ESCALATE_INVEST',
            path: () => {
                ctx.beginPath();
                ctx.moveTo(riskToX(T_ESCALATE), uncToY(U_THRESHOLD));
                ctx.lineTo(riskToX(RISK_MAX), uncToY(U_THRESHOLD));
                ctx.lineTo(riskToX(RISK_MAX), uncToY(UNC_MAX));
                ctx.lineTo(riskToX(T_ESCALATE), uncToY(UNC_MAX));
                ctx.closePath();
            },
        },
        // DECLINE: risk >= 0.80, uncertainty < 0.02
        {
            decision: 'DECLINE',
            path: () => {
                ctx.beginPath();
                ctx.moveTo(riskToX(T_DECLINE), uncToY(0));
                ctx.lineTo(riskToX(RISK_MAX), uncToY(0));
                ctx.lineTo(riskToX(RISK_MAX), uncToY(U_THRESHOLD));
                ctx.lineTo(riskToX(T_DECLINE), uncToY(U_THRESHOLD));
                ctx.closePath();
            },
        },
    ];

    regions.forEach(r => {
        const c = colors[r.decision];
        ctx.fillStyle = c.fill;
        ctx.strokeStyle = c.border;
        ctx.lineWidth = 1;
        r.path();
        ctx.fill();
        ctx.stroke();
    });
}

function drawAxes() {
    const { x, y, w, h } = getPlotArea();
    const textColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.60)';
    const lineColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    // X-axis labels
    ctx.fillStyle = textColor;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let r = 0; r <= 1; r += 0.2) {
        const px = riskToX(r);
        ctx.fillText(r.toFixed(1), px, y + h + 6);

        // Grid line
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px, y + h);
        ctx.stroke();
    }

    // X-axis title
    ctx.fillStyle = textColor;
    ctx.font = 'bold 11px "Inter", sans-serif';
    ctx.fillText('Risk Score →', x + w / 2, y + h + 24);

    // Y-axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = textColor;

    for (let u = 0; u <= 0.10; u += 0.02) {
        const py = uncToY(u);
        ctx.fillText(u.toFixed(2), x - 8, py);

        // Grid line
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x + w, py);
        ctx.stroke();
    }

    // Y-axis title
    ctx.save();
    ctx.translate(14, y + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px "Inter", sans-serif';
    ctx.fillStyle = textColor;
    ctx.fillText('Uncertainty ↑', 0, 0);
    ctx.restore();
}

function drawZoneLabels() {
    const theme = isDark ? 'dark' : 'light';

    // Label definitions: [decision key, display name, center x, center y in data coords]
    const labels = [
        { key: 'APPROVE', name: 'APPROVE', rx: [0, T_AUTH], uy: [0, U_THRESHOLD] },
        { key: 'ABSTAIN', name: 'ABSTAIN', rx: [0, T_AUTH], uy: [U_THRESHOLD, UNC_MAX] },
        { key: 'STEP_UP_AUTH', name: 'STEP-UP', rx: [T_AUTH, T_ESCALATE], uy: [0, UNC_MAX] },
        { key: 'ESCALATE_INVEST', name: 'ESCALATE', rx: [T_ESCALATE, RISK_MAX], uy: [U_THRESHOLD, UNC_MAX] },
        { key: 'DECLINE', name: 'DECLINE', rx: [T_DECLINE, RISK_MAX], uy: [0, U_THRESHOLD] },
    ];

    labels.forEach(({ key, name, rx, uy }) => {
        const cx = (riskToX(rx[0]) + riskToX(rx[1])) / 2;
        const cy = (uncToY(uy[0]) + uncToY(uy[1])) / 2;

        const dotColor = DOT_COLORS[key] || '#818cf8';

        ctx.save();
        ctx.font = 'bold 9px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = dotColor;
        ctx.globalAlpha = isDark ? 0.55 : 0.60;
        ctx.fillText(name, cx, cy);
        ctx.restore();
    });
}

function drawThresholdLines() {
    const { x, y, w, h } = getPlotArea();
    const color = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
    const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    // Vertical threshold lines (risk) with value labels
    [T_AUTH, T_ESCALATE, T_DECLINE].forEach(t => {
        const px = riskToX(t);
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px, y + h);
        ctx.stroke();

        // Label at top
        ctx.setLineDash([]);
        ctx.save();
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = labelColor;
        ctx.fillText(t.toFixed(2), px, y - 2);
        ctx.restore();
        ctx.setLineDash([4, 4]);
    });

    // Horizontal threshold (uncertainty) with value label
    ctx.beginPath();
    ctx.moveTo(x, uncToY(U_THRESHOLD));
    ctx.lineTo(x + w, uncToY(U_THRESHOLD));
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.save();
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = labelColor;
    ctx.fillText('σ ' + U_THRESHOLD.toFixed(2), x + 2, uncToY(U_THRESHOLD) - 2);
    ctx.restore();

    ctx.setLineDash([]);
}

function drawPoints() {
    // History points (faded)
    transactionHistory.forEach((pt, i) => {
        const alpha = Math.max(0.15, 1 - (i / transactionHistory.length) * 0.8);
        const color = DOT_COLORS[pt.decision] || '#818cf8';
        const px = riskToX(pt.risk);
        const py = uncToY(Math.min(pt.uncertainty, UNC_MAX));

        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    // Current point (glowing, with double ring)
    if (currentPoint) {
        const color = DOT_COLORS[currentPoint.decision] || '#818cf8';
        const px = riskToX(currentPoint.risk);
        const py = uncToY(Math.min(currentPoint.uncertainty, UNC_MAX));

        // Outer soft glow
        ctx.beginPath();
        ctx.arc(px, py, 18, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(px, py, 3, px, py, 18);
        grad.addColorStop(0, color + 'aa');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();

        // Outer ring
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Dot
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}


function render() {
    isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Clear
    ctx.clearRect(0, 0, rect.width, rect.height);

    drawRegions();
    drawAxes();
    drawZoneLabels();
    drawThresholdLines();
    drawPoints();
}

// ---- Public API ----
export function initLandscape(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    render();
}

export function plotTransaction(risk, uncertainty, decision) {
    // Add previous current to history
    if (currentPoint) {
        transactionHistory.unshift(currentPoint);
        if (transactionHistory.length > 30) transactionHistory.pop();
    }
    currentPoint = { risk, uncertainty, decision };
    render();
}

export function clearHistory() {
    transactionHistory = [];
    currentPoint = null;
    render();
}
