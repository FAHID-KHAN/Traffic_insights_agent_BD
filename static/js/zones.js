// ════════════════════════════════════════════════════════════════
//  Danger Zones Tab
// ════════════════════════════════════════════════════════════════

async function loadDangerZones() {
    try {
        const zones = await api('/api/danger-zones?limit=20');
        const container = document.getElementById('danger-zones-list');

        if (zones.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-map-marker-alt"></i><p>No danger zone data yet. Run a scrape first!</p></div>';
            return;
        }

        container.innerHTML = zones.map((z, i) => `
            <div class="danger-zone-card">
                <div class="danger-rank">#${i + 1}</div>
                <div class="danger-info">
                    <h4>${z.district}</h4>
                    <p>${z.division || ''} Division • ${z.total_deaths || 0} deaths, ${z.total_injuries || 0} injuries</p>
                </div>
                <div class="danger-stats">
                    <div class="count">${z.total_accidents}</div>
                    <div class="label">accidents</div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Danger zones error:', err);
    }
}
