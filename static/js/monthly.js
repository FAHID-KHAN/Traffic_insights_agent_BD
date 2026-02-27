// ════════════════════════════════════════════════════════════════
//  Monthly Analysis Tab
// ════════════════════════════════════════════════════════════════

async function loadMonthlyStats() {
    const yearSelect = document.getElementById('monthly-year');
    const monthSelect = document.getElementById('monthly-month');

    // Populate year dropdown if empty
    if (yearSelect.options.length === 0) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= currentYear - 5; y--) {
            const opt = new Option(y, y);
            yearSelect.add(opt);
        }
        monthSelect.value = new Date().getMonth() + 1;
    }

    try {
        const data = await api(`/api/monthly?year=${yearSelect.value}&month=${monthSelect.value}`);

        document.getElementById('monthly-stats').innerHTML = `
            <div class="stat-card">
                <div class="stat-header"><span class="stat-label">Total Accidents</span></div>
                <div class="stat-value text-cyan">${data.total_accidents}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><span class="stat-label">Total Deaths</span></div>
                <div class="stat-value text-red">${data.total_deaths}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><span class="stat-label">Total Injuries</span></div>
                <div class="stat-value text-orange">${data.total_injuries}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header"><span class="stat-label">Daily Average</span></div>
                <div class="stat-value text-blue">${data.daily_breakdown.length > 0 ? (data.total_accidents / data.daily_breakdown.length).toFixed(1) : 0}</div>
                <div class="stat-sub">accidents/day</div>
            </div>
        `;

        // Daily breakdown chart
        destroyChart('monthlyDaily');
        if (data.daily_breakdown && data.daily_breakdown.length > 0) {
            charts['monthlyDaily'] = new Chart(document.getElementById('monthly-daily-chart'), {
                type: 'bar',
                data: {
                    labels: data.daily_breakdown.map(d => formatDate(d.accident_date)),
                    datasets: [
                        { label: 'Accidents', data: data.daily_breakdown.map(d => d.count), backgroundColor: '#06b6d480', borderColor: '#06b6d4', borderWidth: 1 },
                        { label: 'Deaths', data: data.daily_breakdown.map(d => d.deaths || 0), backgroundColor: '#ef444480', borderColor: '#ef4444', borderWidth: 1 },
                        { label: 'Injuries', data: data.daily_breakdown.map(d => d.injuries || 0), backgroundColor: '#f9731680', borderColor: '#f97316', borderWidth: 1 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } } } }
            });
        }

        // Type chart
        destroyChart('monthlyType');
        if (data.by_type && data.by_type.length > 0) {
            charts['monthlyType'] = new Chart(document.getElementById('monthly-type-chart'), {
                type: 'doughnut',
                data: {
                    labels: data.by_type.map(d => d.accident_type),
                    datasets: [{ data: data.by_type.map(d => d.count), backgroundColor: COLORS, borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
            });
        }

        // District chart
        destroyChart('monthlyDistrict');
        if (data.by_district && data.by_district.length > 0) {
            charts['monthlyDistrict'] = new Chart(document.getElementById('monthly-district-chart'), {
                type: 'bar',
                data: {
                    labels: data.by_district.slice(0, 15).map(d => d.district),
                    datasets: [{ label: 'Accidents', data: data.by_district.slice(0, 15).map(d => d.count), backgroundColor: COLORS.map(c => c + '80'), borderColor: COLORS, borderWidth: 1 }]
                },
                options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
            });
        }
    } catch (err) {
        console.error('Monthly stats error:', err);
    }
}
