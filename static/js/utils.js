// ════════════════════════════════════════════════════════════════
//  Global State & Shared Utilities
// ════════════════════════════════════════════════════════════════

/* Shared chart instances, map layers, and UI state */
let charts = {};
let map = null;
let markerLayer = null;
let heatLayer = null;
let mapMode = 'markers';
let searchTimeout = null;

/* Chart.js global defaults */
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(51, 65, 85, 0.5)';
Chart.defaults.font.family = 'Inter';

const COLORS = [
    '#06b6d4', '#3b82f6', '#a855f7', '#f97316', '#22c55e',
    '#ef4444', '#eab308', '#ec4899', '#14b8a6', '#8b5cf6',
    '#f43f5e', '#84cc16', '#6366f1', '#d946ef', '#0ea5e9'
];

// ── Helpers ──────────────────────────────────────────────────────

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
    toast.innerHTML = `<i class="fas fa-${icons[type]}" style="color: var(--accent-${type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue'})"></i>
                       <span style="flex:1; font-size: 0.85rem">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function api(endpoint) {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

function destroyChart(id) {
    if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    } catch { return dateStr; }
}
