// ════════════════════════════════════════════════════════════════
//  Map Tab  –  Markers / Heatmap
// ════════════════════════════════════════════════════════════════

async function loadMap() {
    // Initialize map once
    if (!map) {
        map = L.map('accident-map').setView([23.8103, 90.4125], 7);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap, &copy; CARTO',
            maxZoom: 18
        }).addTo(map);
    }

    try {
        const data = await api('/api/map-data');

        // Clear existing layers
        if (markerLayer) { map.removeLayer(markerLayer); markerLayer = null; }
        if (heatLayer)   { map.removeLayer(heatLayer);   heatLayer = null; }

        // Build marker cluster group
        markerLayer = L.markerClusterGroup({
            maxClusterRadius: 50,
            iconCreateFunction: function(cluster) {
                const count = cluster.getChildCount();
                let size = 'small';
                if (count > 10) size = 'medium';
                if (count > 50) size = 'large';
                return L.divIcon({
                    html: `<div><span>${count}</span></div>`,
                    className: `marker-cluster marker-cluster-${size}`,
                    iconSize: L.point(40, 40)
                });
            }
        });

        const heatData = [];

        data.forEach(acc => {
            if (!acc.latitude || !acc.longitude) return;

            const popup = `
                <div style="font-family:Inter;min-width:200px">
                    <strong style="font-size:13px">${acc.accident_type || 'Accident'}</strong><br>
                    <span style="color:#666;font-size:12px">${formatDate(acc.accident_date)}</span><br>
                    <hr style="margin:6px 0;border-color:#eee">
                    <b>Location:</b> ${acc.district || acc.location_raw || 'Unknown'}<br>
                    <b>Deaths:</b> <span style="color:red">${acc.deaths || 0}</span> |
                    <b>Injured:</b> <span style="color:orange">${acc.injuries || 0}</span><br>
                    ${acc.summary ? `<p style="margin-top:6px;font-size:11px;color:#555">${acc.summary.substring(0, 150)}...</p>` : ''}
                    ${acc.article_url ? `<a href="${acc.article_url}" target="_blank" style="font-size:11px">Read article →</a>` : ''}
                </div>`;

            const markerColor = acc.deaths > 0 ? '#ef4444' : (acc.injuries > 0 ? '#f97316' : '#06b6d4');
            const marker = L.circleMarker([acc.latitude, acc.longitude], {
                radius: Math.min(6 + (acc.deaths || 0) * 2, 20),
                fillColor: markerColor,
                color: markerColor,
                weight: 1,
                fillOpacity: 0.7
            }).bindPopup(popup);

            markerLayer.addLayer(marker);

            const intensity = 0.5 + (acc.deaths || 0) * 0.3 + (acc.injuries || 0) * 0.1;
            heatData.push([acc.latitude, acc.longitude, intensity]);
        });

        heatLayer = L.heatLayer(heatData, {
            radius: 30, blur: 20, maxZoom: 12,
            gradient: { 0.2: '#22c55e', 0.4: '#eab308', 0.6: '#f97316', 0.8: '#ef4444', 1.0: '#7f1d1d' }
        });

        setMapMode(mapMode);
        showToast(`Loaded ${data.length} accident locations on map`, 'success');
    } catch (err) {
        console.error('Map error:', err);
    }
}

function setMapMode(mode) {
    mapMode = mode;
    document.getElementById('btn-markers').classList.toggle('active', mode === 'markers');
    document.getElementById('btn-heatmap').classList.toggle('active', mode === 'heatmap');

    if (map) {
        if (mode === 'markers') {
            if (heatLayer)   map.removeLayer(heatLayer);
            if (markerLayer) map.addLayer(markerLayer);
        } else {
            if (markerLayer) map.removeLayer(markerLayer);
            if (heatLayer)   map.addLayer(heatLayer);
        }
    }
}
