// ════════════════════════════════════════════════════════════════
//  Application Bootstrap  –  Tab switching, scrape trigger, init
// ════════════════════════════════════════════════════════════════

function switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    switch (tabId) {
        case 'dashboard': loadDashboard(); break;
        case 'daily':     loadDailyStats(); break;
        case 'monthly':   loadMonthlyStats(); break;
        case 'map':       loadMap(); break;
        case 'zones':     loadDangerZones(); break;
        case 'records':   loadRecords(); break;
    }
}

async function triggerScrape() {
    const btn = document.getElementById('scrape-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scraping...';
    showToast('Scraping started... This may take a few minutes.', 'info');

    try {
        const result = await fetch('/api/scrape', { method: 'POST' });
        const data = await result.json();

        if (result.ok) {
            showToast(`Scrape complete! Found ${data.result.total_found} articles, ${data.result.total_new} new.`, 'success');
            loadDashboard();
        } else {
            showToast(`Scrape failed: ${data.detail}`, 'error');
        }
    } catch (err) {
        showToast(`Scrape error: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Scrape Now';
    }
}

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});
