import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { FaCrosshairs, FaSkullCrossbones, FaUserInjured, FaCarCrash, FaMapMarkerAlt, FaSlidersH } from 'react-icons/fa';

const SEVERITY_COLORS = { critical: '#ef4444', high: '#f97316', moderate: '#eab308', low: '#22c55e' };

const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

export default function BlackspotDetection() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [epsKm, setEpsKm] = useState(5);
  const [minSamples, setMinSamples] = useState(3);
  const [expanded, setExpanded] = useState(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  const fetchData = () => {
    setLoading(true);
    api(`/blackspots?eps_km=${epsKm}&min_samples=${minSamples}`)
      .then(setSpots)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [epsKm, minSamples]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const L = window.L;
    if (!L) return;

    mapInstance.current = L.map(mapRef.current, {
      center: [23.81, 90.41],
      zoom: 7,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(mapInstance.current);
  }, []);

  // Update markers when spots change
  useEffect(() => {
    const L = window.L;
    if (!L || !mapInstance.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    spots.forEach(spot => {
      const color = SEVERITY_COLORS[spot.severity] || '#22c55e';
      const radius = Math.max(12, Math.min(30, spot.accident_count * 3));

      const circle = L.circleMarker([spot.center_lat, spot.center_lon], {
        radius,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.35,
      }).addTo(mapInstance.current);

      circle.bindPopup(`
        <div style="min-width: 180px">
          <strong>Blackspot #${spot.cluster_id + 1}</strong><br/>
          <span>${escapeHtml(spot.districts.join(', '))}</span><br/>
          <strong>${spot.accident_count}</strong> accidents &middot;
          <span style="color:${SEVERITY_COLORS.critical}">${spot.total_deaths}</span> deaths &middot;
          <span style="color:${SEVERITY_COLORS.moderate}">${spot.total_injuries}</span> injuries<br/>
          <em>${escapeHtml(spot.severity)} severity</em>
        </div>
      `);

      markersRef.current.push(circle);
    });

    if (spots.length > 0) {
      const bounds = spots.map(s => [s.center_lat, s.center_lon]);
      mapInstance.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [spots]);

  return (
    <div className="blackspot-section">
      <h3 className="section-title"><FaCrosshairs /> Geographic Blackspot Detection</h3>
      <p className="section-desc">Identifies physical accident hotspots using DBSCAN spatial clustering on GPS coordinates.</p>

      <div className="blackspot-controls">
        <label>
          <FaSlidersH /> Radius (km)
          <input type="range" min="1" max="20" step="0.5" value={epsKm} onChange={e => setEpsKm(+e.target.value)} />
          <span>{epsKm} km</span>
        </label>
        <label>
          Min accidents
          <input type="range" min="2" max="10" step="1" value={minSamples} onChange={e => setMinSamples(+e.target.value)} />
          <span>{minSamples}</span>
        </label>
        <button className="btn btn-sm" onClick={fetchData}>Detect</button>
      </div>

      {loading && <div className="loading-msg">Running DBSCAN clustering...</div>}

      <div className="blackspot-map-container" ref={mapRef} style={{ height: '400px', borderRadius: '8px', marginBottom: '1rem' }}></div>

      <div className="blackspot-summary">
        <span><FaCrosshairs /> {spots.length} blackspots detected</span>
        <span><FaCarCrash /> {spots.reduce((s, b) => s + b.accident_count, 0)} total accidents</span>
        <span className="text-red"><FaSkullCrossbones /> {spots.reduce((s, b) => s + b.total_deaths, 0)} deaths</span>
        <span className="text-orange"><FaUserInjured /> {spots.reduce((s, b) => s + b.total_injuries, 0)} injuries</span>
      </div>

      <div className="blackspot-cards">
        {spots.map((spot, i) => (
          <div className={`blackspot-card ${expanded === i ? 'expanded' : ''}`} key={spot.cluster_id}
               onClick={() => setExpanded(expanded === i ? null : i)}>
            <div className="blackspot-card-header">
              <span className="blackspot-rank">#{i + 1}</span>
              <span className="blackspot-location"><FaMapMarkerAlt /> {spot.districts.join(', ')}</span>
              <span className="zone-severity-tag compact" style={{ background: `${SEVERITY_COLORS[spot.severity]}18`, color: SEVERITY_COLORS[spot.severity], borderColor: `${SEVERITY_COLORS[spot.severity]}40` }}>
                {spot.severity}
              </span>
            </div>
            <div className="blackspot-card-stats">
              <span><FaCarCrash /> {spot.accident_count} acc</span>
              <span className="text-red"><FaSkullCrossbones /> {spot.total_deaths} deaths</span>
              <span className="text-orange"><FaUserInjured /> {spot.total_injuries} inj</span>
              <span>({spot.center_lat.toFixed(3)}°, {spot.center_lon.toFixed(3)}°)</span>
            </div>
            {expanded === i && spot.accidents?.length > 0 && (
              <div className="blackspot-accidents">
                {spot.accidents.map(a => (
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
