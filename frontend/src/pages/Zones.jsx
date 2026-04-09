import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import {
  FaExclamationTriangle, FaMapMarkerAlt, FaSkullCrossbones,
  FaCarCrash, FaUserInjured, FaThList, FaChartBar,
  FaSortAmountDown,
} from 'react-icons/fa';

const SEVERITY_COLORS = { critical: '#ef4444', high: '#f97316', moderate: '#eab308', low: '#22c55e' };
const SEVERITY_LABELS = { critical: 'Critical', high: 'High Risk', moderate: 'Moderate', low: 'Low' };

function getSeverity(fatality_rate) {
  if (fatality_rate >= 1.5) return 'critical';
  if (fatality_rate >= 1.0) return 'high';
  if (fatality_rate >= 0.5) return 'moderate';
  return 'low';
}

export default function Zones() {
  const [dangerIdx, setDangerIdx] = useState([]);
  const [summary, setSummary] = useState(null);
  const [view, setView] = useState('index'); // 'index' | 'table'
  const [sortKey, setSortKey] = useState('fatality_rate');

  useEffect(() => {
    api('/danger-index?limit=64').then(setDangerIdx).catch(console.error);
    api('/danger-zones/summary').then(setSummary).catch(console.error);
  }, []);

  const maxDeaths = Math.max(...(dangerIdx.map(d => d.total_deaths) || [1]), 1);
  const maxAccidents = Math.max(...(dangerIdx.map(d => d.total_accidents) || [1]), 1);

  const sorted = [...dangerIdx].sort((a, b) => {
    if (sortKey === 'fatality_rate') return b.fatality_rate - a.fatality_rate;
    if (sortKey === 'total_deaths') return b.total_deaths - a.total_deaths;
    if (sortKey === 'total_accidents') return b.total_accidents - a.total_accidents;
    return b.total_injuries - a.total_injuries;
  });

  return (
    <div className="zones-page">
      <div className="zones-header">
        <h2 className="page-title">
          <FaExclamationTriangle className="text-red" /> Danger Zones Analysis
        </h2>
        <p className="page-subtitle">
          District-level risk assessment based on accident frequency and fatality rates
        </p>
      </div>

      {/* Summary Stats Bar */}
      {summary ? (
        <div className="zones-summary">
          <div className="zones-summary-stat">
            <span className="zones-summary-num">{summary.totals.total_districts}</span>
            <span className="zones-summary-label">Districts Affected</span>
          </div>
          <div className="zones-summary-stat">
            <span className="zones-summary-num text-cyan">{summary.totals.total_accidents}</span>
            <span className="zones-summary-label">Total Accidents</span>
          </div>
          <div className="zones-summary-stat">
            <span className="zones-summary-num text-red">{summary.totals.total_deaths}</span>
            <span className="zones-summary-label">Total Deaths</span>
          </div>
          <div className="zones-summary-stat">
            <span className="zones-summary-num text-orange">{summary.totals.total_injuries}</span>
            <span className="zones-summary-label">Total Injuries</span>
          </div>
        </div>
      ) : null}

      {/* View Toggle + Sort */}
      <div className="zones-toolbar">
        <div className="zone-toggle">
          <button className={`btn btn-sm${view === 'index' ? ' active' : ''}`} onClick={() => setView('index')}>
            <FaChartBar /> Risk Index
          </button>
          <button className={`btn btn-sm${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')}>
            <FaThList /> Table View
          </button>
        </div>

        {(view === 'index' || view === 'table') && (
          <div className="zones-sort">
            <FaSortAmountDown />
            <select value={sortKey} onChange={e => setSortKey(e.target.value)}>
              <option value="fatality_rate">Fatality Rate</option>
              <option value="total_deaths">Total Deaths</option>
              <option value="total_accidents">Total Accidents</option>
              <option value="total_injuries">Total Injuries</option>
            </select>
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <FaMapMarkerAlt />
          <p>No danger zone data yet. Run a scrape first!</p>
        </div>
      ) : view === 'index' ? (
        /* ── Risk Index View ── */
        <div className="zones-grid">
          {sorted.map((d, i) => {
            const sev = d.severity || getSeverity(d.fatality_rate);
            const deathBar = (d.total_deaths / maxDeaths) * 100;
            const accBar = (d.total_accidents / maxAccidents) * 100;
            return (
              <div className={`zone-card severity-${sev}`} key={d.district}>
                <div className="zone-card-rank" style={{ borderColor: SEVERITY_COLORS[sev] }}>
                  {i + 1}
                </div>
                <div className="zone-card-body">
                  <div className="zone-card-top">
                    <div className="zone-card-name">
                      <h4>{d.district}</h4>
                      {d.division && <span className="zone-division">{d.division} Division</span>}
                    </div>
                    <span className="zone-severity-tag" style={{ background: `${SEVERITY_COLORS[sev]}18`, color: SEVERITY_COLORS[sev], borderColor: `${SEVERITY_COLORS[sev]}40` }}>
                      {SEVERITY_LABELS[sev]}
                    </span>
                  </div>

                  <div className="zone-card-metrics">
                    <div className="zone-metric">
                      <div className="zone-metric-header">
                        <span><FaCarCrash /> Accidents</span>
                        <strong>{d.total_accidents}</strong>
                      </div>
                      <div className="zone-bar">
                        <div className="zone-bar-fill" style={{ width: `${accBar}%`, background: '#06b6d4' }} />
                      </div>
                    </div>
                    <div className="zone-metric">
                      <div className="zone-metric-header">
                        <span><FaSkullCrossbones /> Deaths</span>
                        <strong className="text-red">{d.total_deaths}</strong>
                      </div>
                      <div className="zone-bar">
                        <div className="zone-bar-fill" style={{ width: `${deathBar}%`, background: SEVERITY_COLORS[sev] }} />
                      </div>
                    </div>
                  </div>

                  <div className="zone-card-footer">
                    <span className="zone-rate" style={{ color: SEVERITY_COLORS[sev] }}>
                      <FaSkullCrossbones /> {d.fatality_rate} deaths/accident
                    </span>
                    <span className="zone-injuries">
                      <FaUserInjured /> {d.total_injuries} injuries
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : view === 'table' ? (
        /* ── Table View ── */
        <div className="zones-table-wrap">
          <table className="zones-table">
            <thead>
              <tr>
                <th>#</th>
                <th>District</th>
                <th>Division</th>
                <th>Accidents</th>
                <th>Deaths</th>
                <th>Injuries</th>
                <th>Fatality Rate</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => {
                const sev = d.severity || getSeverity(d.fatality_rate);
                return (
                  <tr key={d.district} className={sev === 'critical' ? 'row-critical' : ''}>
                    <td>{i + 1}</td>
                    <td><strong>{d.district}</strong></td>
                    <td>{d.division || '—'}</td>
                    <td>{d.total_accidents}</td>
                    <td className="text-red">{d.total_deaths}</td>
                    <td className="text-orange">{d.total_injuries}</td>
                    <td style={{ color: SEVERITY_COLORS[sev], fontWeight: 600 }}>{d.fatality_rate}</td>
                    <td>
                      <span className="zone-severity-tag compact" style={{ background: `${SEVERITY_COLORS[sev]}18`, color: SEVERITY_COLORS[sev], borderColor: `${SEVERITY_COLORS[sev]}40` }}>
                        {SEVERITY_LABELS[sev]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
