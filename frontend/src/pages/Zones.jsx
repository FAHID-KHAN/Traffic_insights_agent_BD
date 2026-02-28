import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { FaExclamationTriangle, FaMapMarkerAlt, FaSkullCrossbones, FaCarCrash, FaUserInjured } from 'react-icons/fa';

const SEVERITY_COLORS = { critical: '#ef4444', high: '#f97316', moderate: '#eab308', low: '#22c55e' };
const SEVERITY_LABELS = { critical: 'Critical', high: 'High', moderate: 'Moderate', low: 'Low' };

export default function Zones() {
  const [zones, setZones] = useState([]);
  const [dangerIdx, setDangerIdx] = useState([]);
  const [view, setView] = useState('danger'); // 'danger' or 'classic'

  useEffect(() => {
    api('/danger-zones?limit=30').then(setZones).catch(console.error);
    api('/danger-index?limit=30').then(setDangerIdx).catch(console.error);
  }, []);

  const list = view === 'danger' ? dangerIdx : zones;

  return (
    <>
      <h2 className="page-title">
        <FaExclamationTriangle className="text-red" /> Danger Zones &amp; Fatality Index
      </h2>

      <div className="zone-toggle">
        <button className={`btn btn-outline${view === 'danger' ? ' active' : ''}`} onClick={() => setView('danger')}>
          <FaSkullCrossbones /> Fatality Index
        </button>
        <button className={`btn btn-outline${view === 'classic' ? ' active' : ''}`} onClick={() => setView('classic')}>
          <FaCarCrash /> Classic Ranking
        </button>
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <FaMapMarkerAlt />
          <p>No danger zone data yet. Run a scrape first!</p>
        </div>
      ) : view === 'danger' ? (
        <div className="danger-index-list">
          {dangerIdx.map((d, i) => {
            const fill = Math.min(d.danger_index * 40, 100);
            return (
              <div className="danger-index-card" key={d.district}>
                <div className="di-rank">#{i + 1}</div>
                <div className="di-body">
                  <div className="di-header">
                    <span className="di-name">{d.district}</span>
                    <span className="severity-badge" style={{ background: SEVERITY_COLORS[d.severity], color: '#fff' }}>
                      {SEVERITY_LABELS[d.severity]}
                    </span>
                  </div>
                  <div className="di-stats">
                    <span><FaCarCrash /> {d.total_accidents}</span>
                    <span className="text-red"><FaSkullCrossbones /> {d.total_deaths}</span>
                    <span className="text-orange"><FaUserInjured /> {d.total_injuries}</span>
                  </div>
                  <div className="danger-meter">
                    <div className="danger-meter-fill" style={{ width: `${fill}%`, background: SEVERITY_COLORS[d.severity] }} />
                  </div>
                  <div className="di-score">
                    Fatality Rate: <strong style={{ color: SEVERITY_COLORS[d.severity] }}>{d.danger_index}</strong> deaths/accident
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="danger-zone-list">
          {zones.map((z, i) => (
            <div className="danger-zone-card" key={z.district}>
              <div className="danger-rank">#{i + 1}</div>
              <div className="danger-info">
                <h4>{z.district}</h4>
                <p>{z.division || ''} Division &bull; {z.total_deaths || 0} deaths, {z.total_injuries || 0} injuries</p>
              </div>
              <div className="danger-stats">
                <div className="count">{z.total_accidents}</div>
                <div className="label">accidents</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
