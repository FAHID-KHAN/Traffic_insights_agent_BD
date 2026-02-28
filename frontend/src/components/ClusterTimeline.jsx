import { useState, useEffect } from 'react';
import { api, formatDate } from '../utils/api';
import { FaLayerGroup, FaExclamationTriangle, FaSkullCrossbones, FaMapMarkerAlt, FaCalendarAlt, FaSlidersH, FaChevronDown, FaChevronUp } from 'react-icons/fa';

const SEVERITY_CONFIG = {
  critical: { color: '#F42A41', bg: 'rgba(244,42,65,0.12)', label: 'Critical', icon: <FaSkullCrossbones /> },
  high:     { color: '#ef6c00', bg: 'rgba(239,108,0,0.12)', label: 'High', icon: <FaExclamationTriangle /> },
  moderate: { color: '#f9a825', bg: 'rgba(249,168,37,0.12)', label: 'Moderate', icon: <FaExclamationTriangle /> },
  low:      { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Low', icon: <FaLayerGroup /> },
};

export default function ClusterTimeline() {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState(7);
  const [minAccidents, setMinAccidents] = useState(3);
  const [expanded, setExpanded] = useState(new Set());
  const [showSettings, setShowSettings] = useState(false);

  const load = () => {
    setLoading(true);
    api(`/clusters?window_days=${windowDays}&min_accidents=${minAccidents}`)
      .then(setClusters)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [windowDays, minAccidents]);

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="chart-card full-width"><div className="loading-pulse">Detecting clusters...</div></div>;

  const totalClusters = clusters.length;
  const criticalCount = clusters.filter(c => c.severity === 'critical').length;
  const highCount = clusters.filter(c => c.severity === 'high').length;

  return (
    <div className="chart-card full-width cluster-card">
      <div className="chart-title">
        <FaLayerGroup /> Accident Clusters — Repeat Incident Zones
      </div>

      {/* Controls */}
      <div className="cluster-header">
        <div className="cluster-summary-pills">
          <span className="cluster-pill">{totalClusters} Clusters</span>
          {criticalCount > 0 && <span className="cluster-pill critical">{criticalCount} Critical</span>}
          {highCount > 0 && <span className="cluster-pill high">{highCount} High</span>}
        </div>
        <button className="fc-chip" onClick={() => setShowSettings(!showSettings)}>
          <FaSlidersH /> Settings
        </button>
      </div>

      {showSettings && (
        <div className="cluster-settings">
          <label>
            Window (days):
            <input
              type="range" min="2" max="30" value={windowDays}
              onChange={e => setWindowDays(Number(e.target.value))}
            />
            <span className="cluster-range-val">{windowDays}d</span>
          </label>
          <label>
            Min accidents:
            <input
              type="range" min="2" max="10" value={minAccidents}
              onChange={e => setMinAccidents(Number(e.target.value))}
            />
            <span className="cluster-range-val">{minAccidents}</span>
          </label>
        </div>
      )}

      {clusters.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No clusters detected with current settings.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Try increasing the window or decreasing minimum accidents.</p>
        </div>
      ) : (
        <div className="cluster-timeline">
          {clusters.map((cluster) => {
            const sev = SEVERITY_CONFIG[cluster.severity] || SEVERITY_CONFIG.low;
            const isOpen = expanded.has(cluster.cluster_id);
            return (
              <div
                key={cluster.cluster_id}
                className={`cluster-item severity-${cluster.severity}`}
                style={{ borderLeftColor: sev.color }}
              >
                <div className="cluster-item-header" onClick={() => toggleExpand(cluster.cluster_id)}>
                  <div className="cluster-item-left">
                    <span className="cluster-sev-badge" style={{ background: sev.bg, color: sev.color }}>
                      {sev.icon} {sev.label}
                    </span>
                    <span className="cluster-district">
                      <FaMapMarkerAlt /> {cluster.district}
                      {cluster.division && <span className="cluster-division">, {cluster.division}</span>}
                    </span>
                  </div>
                  <div className="cluster-item-right">
                    <span className="cluster-stat">{cluster.accidents_count} accidents</span>
                    <span className="cluster-stat deaths">{cluster.total_deaths} deaths</span>
                    <span className="cluster-date">
                      <FaCalendarAlt /> {formatDate(cluster.date_start)}
                      {cluster.date_end !== cluster.date_start && <> — {formatDate(cluster.date_end)}</>}
                      {cluster.span_days > 0 && <span className="cluster-span">({cluster.span_days}d)</span>}
                    </span>
                    {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                  </div>
                </div>

                {isOpen && (
                  <div className="cluster-detail">
                    <table className="cluster-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Location</th>
                          <th>Deaths</th>
                          <th>Injuries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cluster.accidents.map((acc, i) => (
                          <tr key={i}>
                            <td>{formatDate(acc.accident_date)}</td>
                            <td>{acc.accident_type || '—'}</td>
                            <td>{acc.location_raw || acc.district}</td>
                            <td className={acc.deaths > 0 ? 'text-red' : ''}>{acc.deaths || 0}</td>
                            <td className={acc.injuries > 0 ? 'text-orange' : ''}>{acc.injuries || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
