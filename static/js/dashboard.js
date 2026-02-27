// ════════════════════════════════════════════════════════════════
//  Dashboard Tab
// ════════════════════════════════════════════════════════════════

async function loadDashboard() {
    try {
        const [overview, trend, zones] = await Promise.all([
            api('/api/overview'),
            api('/api/trend?days=30'),
            api('/api/danger-zones?limit=10')
        ]);

        // ── Stats cards ──────────────────────────────────────────
        document.getElementById('overview-stats').innerHTML = `
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Total Accidents</span>
                    <div class="stat-icon" style="background:rgba(6,182,212,0.15)">
                        <i class="fas fa-car-crash text-cyan"></i>
                    </div>
                </div>
                <div class="stat-value text-cyan">${overview.total_accidents.toLocaleString()}</div>
                <div class="stat-sub">All time recorded</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Total Deaths</span>
                    <div class="stat-icon" style="background:rgba(239,68,68,0.15)">
                        <i class="fas fa-skull-crossbones text-red"></i>
                    </div>
                </div>
                <div class="stat-value text-red">${overview.total_deaths.toLocaleString()}</div>
                <div class="stat-sub">Lives lost</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Total Injuries</span>
                    <div class="stat-icon" style="background:rgba(249,115,22,0.15)">
                        <i class="fas fa-user-injured text-orange"></i>
                    </div>
                </div>
                <div class="stat-value text-orange">${overview.total_injuries.toLocaleString()}</div>
                <div class="stat-sub">People injured</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Today</span>
                    <div class="stat-icon" style="background:rgba(34,197,94,0.15)">
                        <i class="fas fa-calendar-day text-green"></i>
                    </div>
                </div>
                <div class="stat-value text-green">${overview.today.accidents}</div>
                <div class="stat-sub">${overview.today.deaths} deaths, ${overview.today.injuries} injured</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Articles Scraped</span>
                    <div class="stat-icon" style="background:rgba(168,85,247,0.15)">
                        <i class="fas fa-newspaper" style="color:var(--accent-purple)"></i>
                    </div>
                </div>
                <div class="stat-value" style="color:var(--accent-purple)">${overview.total_articles.toLocaleString()}</div>
                <div class="stat-sub">News articles processed</div>
            </div>
        `;

        // ── Last update ──────────────────────────────────────────
        if (overview.last_scrape) {
            document.getElementById('last-update').textContent =
                `Last scraped: ${overview.last_scrape.finished_at || 'Running...'}`;
        }

        // ── Trend chart ──────────────────────────────────────────
        if (trend.length > 0) {
            destroyChart('trend');
            charts['trend'] = new Chart(document.getElementById('trend-chart'), {
                type: 'line',
                data: {
                    labels: trend.map(d => formatDate(d.accident_date)),
                    datasets: [
                        {
                            label: 'Accidents',
                            data: trend.map(d => d.accidents),
                            borderColor: '#06b6d4',
                            backgroundColor: 'rgba(6,182,212,0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Deaths',
                            data: trend.map(d => d.deaths || 0),
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239,68,68,0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Injuries',
                            data: trend.map(d => d.injuries || 0),
                            borderColor: '#f97316',
                            backgroundColor: 'rgba(249,115,22,0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // ── Accident-type doughnut ───────────────────────────────
        const typeData = await api('/api/monthly?year=' + new Date().getFullYear() + '&month=' + (new Date().getMonth() + 1));
        if (typeData.by_type && typeData.by_type.length > 0) {
            destroyChart('type');
            charts['type'] = new Chart(document.getElementById('type-chart'), {
                type: 'doughnut',
                data: {
                    labels: typeData.by_type.map(d => d.accident_type || 'Unknown'),
                    datasets: [{
                        data: typeData.by_type.map(d => d.count),
                        backgroundColor: COLORS,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } }
                    }
                }
            });
        }

        // ── District bar chart ───────────────────────────────────
        if (zones.length > 0) {
            destroyChart('district');
            charts['district'] = new Chart(document.getElementById('district-chart'), {
                type: 'bar',
                data: {
                    labels: zones.slice(0, 10).map(d => d.district),
                    datasets: [{
                        label: 'Accidents',
                        data: zones.slice(0, 10).map(d => d.total_accidents),
                        backgroundColor: COLORS.map(c => c + '80'),
                        borderColor: COLORS,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } }
                }
            });
        }

    } catch (err) {
        console.error('Dashboard error:', err);
    }
}
