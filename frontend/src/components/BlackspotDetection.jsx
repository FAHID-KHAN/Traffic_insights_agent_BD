import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../utils/api';
import { FaLayerGroup, FaSkullCrossbones, FaUserInjured, FaCarCrash, FaMapMarkerAlt, FaSlidersH } from 'react-icons/fa';

const SEVERITY_COLORS = { critical: '#ef4444', high: '#f97316', moderate: '#eab308', low: '#22c55e' };

const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

export default function BlackspotDetection() {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [epsKm, setEpsKm] = useState(45);
  const [minSamples, setMinSamples] = useState(3);
  const [expanded, setExpanded] = useState(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    api(`/blackspots?eps_km=${epsKm}&min_samples=${minSamples}`)
      .then(data => {
        if (Array.isArray(data)) setClusters(data);
        else throw new Error(data?.detail || 'Unexpected response');
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Failed to load cluster data');
        setClusters([]);
      })
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [epsKm, minSamples]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      center: [23.81, 90.41],
      zoom: 7,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(mapInstance.current);
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    clusters.forEach((cluster, i) => {
      const color = SEVERITY_COLORS[cluster.severity] || '#22c55e';
      const radius = Math.max(18, Math.min(50, cluster.accident_count * 2));

      const circle = L.circleMarker([cluster.center_lat, cluster.center_lon], {
        radius,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.3,
      }).addTo(mapInstance.current);

      circle.bindPopup(`
        <div style="min-width:200px">
          <strong>Region #${i + 1}</strong><br/>
          <span>${escapeHtml(cluster.districts.join(' · '))}</span><br/>
          <strong>${cluster.accident_count}</strong> accidents &middot;
          <span style="color:${SEVERITY_COLORS.critical}">${cluster.total_deaths}</span> deaths &middot;
          <span style="color:${SEVERITY_COLORS.moderate}">${cluster.total_injuries}</span> injuries<br/>
          <em>${escapeHtml(cluster.severity)} severity</em>
        </div>
      `);

      markersRef.current.push(circle);
    });

    if (clusters.length > 0) {
      const bounds = clusters.map(c => [c.center_lat, c.center_lon]);
      mapInstance.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [clusters]);

  return (
    <div className="blackspot-section">
      <h3 className="section-title"><FaLayerGroup /> Regional Accident Clusters</h3>
      <p className="section-desc">
        Groups neighboring districts into accident-dense regions using DBSCAN spatial clustering
        on district centroids. Increase the radius to merge more distant districts into larger regions.
      </p>

      <div className="blackspot-controls">
        <label>
          <FaSlidersH /> Radius (km)
          <input type="range" min="20" max="120" step="5" value={epsKm} onChange={e => setEpsKm(+e.target.value)} />
          <span>{epsKm} km</span>
        </label>
        <label>
          Min accidents
          <input type="range" min="2" max="10" step="1" value={minSamples} onChange={e => setMinSamples(+e.target.value)} />
          <span>{minSamples}</span>
        </label>
        <button className="btn btn-sm" onClick={fetchData}>Recalculate</button>
      </div>

      {loading && <div className="loading-msg">Calculating regional clusters...</div>}
      {error && <div className="loading-msg" style={{ color: '#ef4444' }}>⚠ {error}</div>}

      <div className="blackspot-map-container" ref={mapRef} style={{ height: '400px', borderRadius: '8px', marginBottom: '1rem' }}></div>

      <div className="blackspot-summary">
        <span><FaLayerGroup /> {clusters.length} regional clusters</span>
        <span><FaCarCrash /> {clusters.reduce((s, c) => s + c.accident_count, 0)} total accidents</span>
        <span className="text-red"><FaSkullCrossbones /> {clusters.reduce((s, c) => s + c.total_deaths, 0)} deaths</span>
        <span className="text-orange"><FaUserInjured /> {clusters.reduce((s, c) => s + c.total_injuries, 0)} injuries</span>
      </div>

      <div className="blackspot-cards">
        {clusters.map((cluster, i) => (
          <div
            className={`blackspot-card ${expanded === i ? 'expanded' : ''}`}
            key={cluster.cluster_id}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="blackspot-card-header">
              <span className="blackspot-rank">#{i + 1}</span>
              <span className="blackspot-location">
                <FaMapMarkerAlt /> {cluster.districts.join(' · ')}
              </span>
              <span
                className="zone-severity-tag compact"
                style={{
                  background: `${SEVERITY_COLORS[cluster.severity]}18`,
                  color: SEVERITY_COLORS[cluster.severity],
                  borderColor: `${SEVERITY_COLORS[cluster.severity]}40`,
                }}
              >
                {cluster.severity}
              </span>
            </div>
            <div className="blackspot-card-stats">
              <span><FaCarCrash /> {cluster.accident_count} accidents</span>
              <span className="text-red"><FaSkullCrossbones /> {cluster.total_deaths} deaths</span>
              <span className="text-orange"><FaUserInjured /> {cluster.total_injuries} injuries</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {cluster.district_count} district{cluster.district_count !== 1 ? 's' : ''}
              </span>
            </div>
            {expanded === i && cluster.accidents?.length > 0 && (
              <div className="blackspot-accidents">
                {cluster.accidents.map(a => (
                  <div className="blackspot-acc-row" key={a.id}>
                    <span>{a.accident_date}</span>
                    <span>{a.accident_type || '—'}</span>
                    <span>{a.district}</span>
                    <span className="text-red">{a.deaths}D</span>
                    <span className="text-orange">{a.injuries}I</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
