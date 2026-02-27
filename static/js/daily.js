// ════════════════════════════════════════════════════════════════
//  Daily Analysis Tab
// ════════════════════════════════════════════════════════════════

async function loadDailyStats() {
    const dateInput = document.getElementById('daily-date');
    if (!dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];

    try {
        const data = await api(`/api/daily?date=${dateInput.value}`);

        document.getElementById('daily-stats').innerHTML = `
            <div class="stat-card">
                <div class="stat-header"><span class="stat-label">Accidents</span></div>
                <div class="stat-value text-cyan">${data.total_accidents}</div>
                <div class="stat-sub">${formatDate(data.date)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><span class="stat-label">Deaths</span></div>
                <div class="stat-value text-red">${data.total_deaths}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><span class="stat-label">Injuries</span></div>
                <div class="stat-value text-orange">${data.total_injuries}</div>
            </div>
        `;

        // Type chart
        destroyChart('dailyType');
        if (data.by_type && data.by_type.length > 0) {
            charts['dailyType'] = new Chart(document.getElementById('daily-type-chart'), {
                type: 'pie',
                data: {
                    labels: data.by_type.map(d => d.accident_type),
                    datasets: [{ data: data.by_type.map(d => d.count), backgroundColor: COLORS, borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
            });
        }

        // District chart
        destroyChart('dailyDistrict');
        if (data.by_district && data.by_district.length > 0) {
            charts['dailyDistrict'] = new Chart(document.getElementById('daily-district-chart'), {
                type: 'bar',
                data: {
                    labels: data.by_district.map(d => d.district),
                    datasets: [
                        { label: 'Accidents', data: data.by_district.map(d => d.count), backgroundColor: '#06b6d480', borderColor: '#06b6d4', borderWidth: 1 },
                        { label: 'Deaths', data: data.by_district.map(d => d.deaths || 0), backgroundColor: '#ef444480', borderColor: '#ef4444', borderWidth: 1 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } } } }
            });
        }
    } catch (err) {
        console.error('Daily stats error:', err);
    }
}
