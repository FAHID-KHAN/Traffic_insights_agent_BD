import { useState, useEffect } from 'react';
import { api, COLORS } from '../utils/api';
import { FaThermometerHalf, FaCalendarAlt, FaExchangeAlt } from 'react-icons/fa';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getHeatColor(value, max) {
  if (max === 0) return 'rgba(0,106,78,0.05)';
  const ratio = value / max;
  if (ratio > 0.8) return '#F42A41';
  if (ratio > 0.6) return '#ef6c00';
  if (ratio > 0.4) return '#f9a825';
  if (ratio > 0.2) return '#00a878';
  return 'rgba(0,106,78,0.15)';
}

function getHeatOpacity(value, max) {
  if (max === 0) return 0.1;
  return 0.2 + (value / max) * 0.8;
}

export default function TimeHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month-dow'); // 'month-dow' | 'week-dow' | 'dow-bar'
  const [metric, setMetric] = useState('accidents');

  useEffect(() => {
    api('/time-patterns')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="chart-card full-width"><div className="loading-pulse">Loading heatmap...</div></div>;
  if (!data) return null;

  const { by_dow, by_month, grid, week_grid } = data;

  // Build Month x DOW heatmap
  const renderMonthDowGrid = () => {
    // Build a lookup: grid[month][dow] = value
    const lookup = {};
    let maxVal = 0;
    grid.forEach(g => {
      const key = `${g.month}-${g.dow}`;
      const val = metric === 'deaths' ? g.deaths : g.accidents;
      lookup[key] = val;
      if (val > maxVal) maxVal = val;
    });

    return (
      <div className="heatmap-grid-wrapper">
        <div className="heatmap-grid month-dow-grid">
          {/* Header row: day names */}
          <div className="hm-corner"></div>
          {DAY_NAMES.map(d => <div key={d} className="hm-header">{d}</div>)}

          {/* Rows: each month */}
          {MONTH_NAMES.map((mName, mi) => (
            <div key={mi} className="hm-row" role="row">
              <div className="hm-label">{mName}</div>
              {DAY_NAMES.map((_, di) => {
                const val = lookup[`${mi + 1}-${di}`] || 0;
                return (
                  <div
                    key={di}
                    className="hm-cell"
                    style={{
                      backgroundColor: getHeatColor(val, maxVal),
                      opacity: getHeatOpacity(val, maxVal),
                    }}
                    title={`${mName} ${DAY_NAMES[di]}: ${val} ${metric}`}
                  >
                    <span className="hm-val">{val || ''}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="hm-legend">
          <span className="hm-legend-label">Less</span>
          <div className="hm-legend-cell" style={{ backgroundColor: 'rgba(0,106,78,0.15)' }}></div>
          <div className="hm-legend-cell" style={{ backgroundColor: '#00a878' }}></div>
          <div className="hm-legend-cell" style={{ backgroundColor: '#f9a825' }}></div>
          <div className="hm-legend-cell" style={{ backgroundColor: '#ef6c00' }}></div>
          <div className="hm-legend-cell" style={{ backgroundColor: '#F42A41' }}></div>
          <span className="hm-legend-label">More</span>
        </div>
      </div>
    );
  };

  // Week-of-month x DOW grid
  const renderWeekDowGrid = () => {
    const lookup = {};
    let maxVal = 0;
    week_grid.forEach(g => {
      const val = metric === 'deaths' ? g.deaths : g.accidents;
      lookup[`${g.week}-${g.dow}`] = val;
      if (val > maxVal) maxVal = val;
    });

    const weeks = [1, 2, 3, 4, 5];

    return (
      <div className="heatmap-grid-wrapper">
        <div className="heatmap-grid week-dow-grid">
          <div className="hm-corner"></div>
          {DAY_NAMES.map(d => <div key={d} className="hm-header">{d}</div>)}

          {weeks.map(w => (
            <div key={w} className="hm-row" role="row">
              <div className="hm-label">Week {w}</div>
              {DAY_NAMES.map((_, di) => {
                const val = lookup[`${w}-${di}`] || 0;
                return (
                  <div
                    key={di}
                    className="hm-cell"
                    style={{
                      backgroundColor: getHeatColor(val, maxVal),
                      opacity: getHeatOpacity(val, maxVal),
                    }}
                    title={`Week ${w}, ${DAY_NAMES[di]}: ${val} ${metric}`}
                  >
                    <span className="hm-val">{val || ''}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="hm-legend">
          <span className="hm-legend-label">Less</span>
          <div className="hm-legend-cell" style={{ backgroundColor: 'rgba(0,106,78,0.15)' }}></div>
          <div className="hm-legend-cell" style={{ backgroundColor: '#00a878' }}></div>
          <div className="hm-legend-cell" style={{ backgroundColor: '#f9a825' }}></div>
          <div className="hm-legend-cell" style={{ backgroundColor: '#ef6c00' }}></div>
          <div className="hm-legend-cell" style={{ backgroundColor: '#F42A41' }}></div>
          <span className="hm-legend-label">More</span>
        </div>
      </div>
    );
  };

  // Day-of-week bar summary
  const renderDowBar = () => {
    const maxVal = Math.max(...by_dow.map(d => metric === 'deaths' ? d.deaths : d.accidents), 1);
    return (
      <div className="dow-bars">
        {DAY_NAMES.map((name, i) => {
          const entry = by_dow.find(d => d.dow === i) || { accidents: 0, deaths: 0, injuries: 0 };
          const val = metric === 'deaths' ? entry.deaths : entry.accidents;
          const pct = (val / maxVal) * 100;
          return (
            <div key={i} className="dow-bar-row">
              <span className="dow-bar-label">{name}</span>
              <div className="dow-bar-track">
                <div
                  className="dow-bar-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: getHeatColor(val, maxVal),
                  }}
                />
              </div>
              <span className="dow-bar-value">{val}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Monthly bar
  const renderMonthBar = () => {
    const maxVal = Math.max(...by_month.map(d => metric === 'deaths' ? d.deaths : d.accidents), 1);
    return (
      <div className="dow-bars">
        {MONTH_NAMES.map((name, i) => {
          const entry = by_month.find(d => d.month === i + 1) || { accidents: 0, deaths: 0, injuries: 0 };
          const val = metric === 'deaths' ? entry.deaths : entry.accidents;
          const pct = (val / maxVal) * 100;
          return (
            <div key={i} className="dow-bar-row">
              <span className="dow-bar-label">{name}</span>
              <div className="dow-bar-track">
                <div
                  className="dow-bar-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: getHeatColor(val, maxVal),
                  }}
                />
              </div>
              <span className="dow-bar-value">{val}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="chart-card full-width heatmap-card">
      <div className="chart-title">
        <FaThermometerHalf /> Accident Patterns — When Do Accidents Happen?
      </div>

      <div className="heatmap-controls">
        <div className="hm-view-chips">
          <button className={`fc-chip${view === 'month-dow' ? ' active' : ''}`} onClick={() => setView('month-dow')}>
            <FaCalendarAlt /> Month × Day
          </button>
          <button className={`fc-chip${view === 'week-dow' ? ' active' : ''}`} onClick={() => setView('week-dow')}>
            <FaCalendarAlt /> Week × Day
          </button>
          <button className={`fc-chip${view === 'dow-bar' ? ' active' : ''}`} onClick={() => setView('dow-bar')}>
            <FaExchangeAlt /> By Day
          </button>
          <button className={`fc-chip${view === 'month-bar' ? ' active' : ''}`} onClick={() => setView('month-bar')}>
            <FaExchangeAlt /> By Month
          </button>
        </div>
        <div className="forecast-metric-chips">
          {['accidents', 'deaths'].map(m => (
            <button key={m} className={`fc-chip${metric === m ? ' active' : ''}`} onClick={() => setMetric(m)}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="heatmap-content">
        {view === 'month-dow' && renderMonthDowGrid()}
        {view === 'week-dow' && renderWeekDowGrid()}
        {view === 'dow-bar' && renderDowBar()}
        {view === 'month-bar' && renderMonthBar()}
      </div>
    </div>
  );
}
