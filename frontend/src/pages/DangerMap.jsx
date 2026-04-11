import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import 'leaflet.heat';
import { api, formatDate } from '../utils/api';
import { FaMapPin, FaFire, FaBuilding, FaSkullCrossbones, FaCarCrash, FaUserInjured, FaChevronDown, FaChevronUp } from 'react-icons/fa';

const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};
const safeUrl = (url) => (url && (url.startsWith('http://') || url.startsWith('https://'))) ? url : null;

function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    // Force Leaflet to recalculate tile coverage after the container fully paints
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function MapLayers({ data, mode }) {
  const map = useMap();
  const clusterRef = useRef(null);
  const heatRef = useRef(null);

  useEffect(() => {
    if (clusterRef.current) { map.removeLayer(clusterRef.current); clusterRef.current = null; }
    if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }
    if (!data || data.length === 0) return;

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        let size = 'small';
        if (count > 10) size = 'medium';
        if (count > 50) size = 'large';
        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `marker-cluster marker-cluster-${size}`,
          iconSize: L.point(40, 40),
        });
      },
    });

    const heatPoints = [];

    data.forEach((acc) => {
      if (!acc.latitude || !acc.longitude) return;
      const markerColor = acc.deaths > 0 ? '#ef4444' : acc.injuries > 0 ? '#f97316' : '#06b6d4';
      const marker = L.circleMarker([acc.latitude, acc.longitude], {
        radius: Math.min(6 + (acc.deaths || 0) * 2, 20),
        fillColor: markerColor, color: markerColor, weight: 1, fillOpacity: 0.7,
      });
      marker.bindPopup(`
        <div style="font-family:Inter;min-width:200px">
          <strong style="font-size:13px">${escapeHtml(acc.accident_type || 'Accident')}</strong><br>
          <span style="color:#666;font-size:12px">${escapeHtml(formatDate(acc.accident_date))}</span><br>
          <hr style="margin:6px 0;border-color:#eee">
          <b>Location:</b> ${escapeHtml(acc.district || acc.location_raw || 'Unknown')}<br>
          <b>Deaths:</b> <span style="color:red">${acc.deaths || 0}</span> |
          <b>Injured:</b> <span style="color:orange">${acc.injuries || 0}</span><br>
          ${acc.summary ? `<p style="margin-top:6px;font-size:11px;color:#555">${escapeHtml(acc.summary.substring(0, 150))}${acc.summary.length > 150 ? '...' : ''}</p>` : ''}
          ${safeUrl(acc.article_url) ? `<a href="${escapeHtml(acc.article_url)}" target="_blank" rel="noopener noreferrer" style="font-size:11px">Read article →</a>` : ''}
        </div>
      `);
      cluster.addLayer(marker);
      const intensity = 0.5 + (acc.deaths || 0) * 0.3 + (acc.injuries || 0) * 0.1;
      heatPoints.push([acc.latitude, acc.longitude, intensity]);
    });

    const heat = L.heatLayer(heatPoints, {
      radius: 30, blur: 20, maxZoom: 12,
      gradient: { 0.2: '#22c55e', 0.4: '#eab308', 0.6: '#f97316', 0.8: '#ef4444', 1.0: '#7f1d1d' },
    });

    clusterRef.current = cluster;
    heatRef.current = heat;
    if (mode === 'markers') map.addLayer(cluster);
    else map.addLayer(heat);

    return () => {
      if (clusterRef.current) { map.removeLayer(clusterRef.current); clusterRef.current = null; }
      if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }
    };
  }, [data, mode, map]);

  return null;
}

export default function DangerMap() {
  const { addToast } = useOutletContext();
  const [mode, setMode] = useState('markers');
  const [data, setData] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api('/map-data')
      .then((d) => { setData(d); addToast(`Loaded ${d.length} accident locations on map`, 'success'); })
      .catch((err) => console.error('Map error:', err));
    api('/divisions')
      .then(setDivisions)
      .catch((err) => console.error('Division error:', err));
  }, [addToast]);

  const toggle = (div) => setExpanded(expanded === div ? null : div);

  const sevColor = (rate) => {
    if (rate >= 1.5) return 'var(--accent-red)';
    if (rate >= 1.0) return 'var(--accent-orange)';
    if (rate >= 0.5) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
  };

  return (
    <>
      <div className="map-controls">
        <button className={`btn btn-outline${mode === 'markers' ? ' active' : ''}`} onClick={() => setMode('markers')}>
          <FaMapPin /> Markers
        </button>
        <button className={`btn btn-outline${mode === 'heatmap' ? ' active' : ''}`} onClick={() => setMode('heatmap')}>
          <FaFire /> Heatmap
        </button>
      </div>
      <div className="map-wrapper">
        <MapContainer center={[23.8103, 90.4125]} zoom={7} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap, &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={18}
            updateWhenIdle={false}
          />
          <MapInvalidator />
          <MapLayers data={data} mode={mode} />
        </MapContainer>
      </div>

      {/* ── Division Stats ── */}
      {divisions.length > 0 && (
        <div className="division-section">
          <h3 className="division-section-title">
            <FaBuilding className="text-green" /> Division-Level Breakdown
          </h3>
          <div className="division-grid">
            {divisions.map((dv) => (
              <div key={dv.division} className={`division-card${expanded === dv.division ? ' expanded' : ''}`}>
                <div className="division-card-header" onClick={() => toggle(dv.division)}>
                  <div className="division-name">
                    <span className="division-dot" style={{ background: sevColor(dv.fatality_rate) }} />
                    {dv.division}
                  </div>
                  <div className="division-quick-stats">
                    <span className="dqs"><FaCarCrash /> {dv.total_accidents}</span>
                    <span className="dqs text-red"><FaSkullCrossbones /> {dv.total_deaths}</span>
                    <span className="dqs text-orange"><FaUserInjured /> {dv.total_injuries}</span>
                    <span className="dqs-rate" style={{ color: sevColor(dv.fatality_rate) }}>
                      {dv.fatality_rate} FR
                    </span>
                  </div>
                  <span className="division-toggle">
                    {expanded === dv.division ? <FaChevronUp /> : <FaChevronDown />}
                  </span>
                </div>

                {expanded === dv.division && dv.districts?.length > 0 && (
                  <div className="division-districts">
                    <table>
                      <thead>
                        <tr>
                          <th>District</th>
                          <th>Accidents</th>
                          <th>Deaths</th>
                          <th>Injuries</th>
                          <th>FR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dv.districts.map((dist) => (
                          <tr key={dist.district}>
                            <td>{dist.district}</td>
                            <td>{dist.accidents}</td>
                            <td className="text-red">{dist.deaths}</td>
                            <td className="text-orange">{dist.injuries}</td>
                            <td style={{ color: sevColor(dist.accidents ? dist.deaths / dist.accidents : 0) }}>
                              {dist.accidents ? (dist.deaths / dist.accidents).toFixed(2) : '0.00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
