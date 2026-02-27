// ════════════════════════════════════════════════════════════════
//  Records Tab  –  Table & Search
// ════════════════════════════════════════════════════════════════

async function loadRecords(query = '') {
    try {
        let data;
        if (query && query.length >= 2) {
            data = await api(`/api/search?q=${encodeURIComponent(query)}&limit=100`);
        } else {
            data = await api('/api/recent?limit=100');
        }

        const tbody = document.getElementById('records-tbody');

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">No records found</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(r => {
            const typeBadge = r.accident_type ? `<span class="badge badge-info">${r.accident_type}</span>` : '—';
            const deathColor = r.deaths > 0 ? 'text-red' : '';
            const injuryColor = r.injuries > 0 ? 'text-orange' : '';
            return `<tr>
                <td>${formatDate(r.accident_date)}</td>
                <td>${typeBadge}</td>
                <td>${r.location_raw || '—'}</td>
                <td><strong>${r.district || '—'}</strong></td>
                <td class="${deathColor}">${r.deaths || 0}</td>
                <td class="${injuryColor}">${r.injuries || 0}</td>
                <td style="font-size:0.78rem">${r.vehicles_involved || '—'}</td>
                <td>${r.article_url ? `<a href="${r.article_url}" target="_blank" style="color:var(--accent-cyan);text-decoration:none;font-size:0.78rem"><i class="fas fa-external-link-alt"></i></a>` : '—'}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error('Records error:', err);
    }
}

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadRecords(document.getElementById('search-input').value);
    }, 400);
}
