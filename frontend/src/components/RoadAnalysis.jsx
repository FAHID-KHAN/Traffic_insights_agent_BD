import { useState, useEffect } from 'react';
import { Chart } from 'react-chartjs-2';
import { api } from '../utils/api';
import { FaRoad, FaSkullCrossbones, FaUserInjured, FaCarCrash, FaMapMarkerAlt } from 'react-icons/fa';

const SEVERITY_COLORS = { critical: '#ef4444', high: '#f97316', moderate: '#eab308', low: '#22c55e' };

export default function RoadAnalysis() {
  const [roads, setRoads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/roads?limit=50')
      .then(setRoads)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const chartData = roads.length > 0 ? {
    labels: roads.slice(0, 15).map(r => r.road_name),
    datasets: [
      { label: 'Accidents', data: roads.slice(0, 15).map(r => r.accidents), backgroundColor: 'rgba(6,182,212,0.7)', borderRadius: 4 },
      { label: 'Deaths', data: roads.slice(0, 15).map(r => r.deaths), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 },
    ],
  } : null;

  if (loading) return <div className="loading-msg">Loading road data...</div>;
  if (roads.length === 0) {
    return (
      <div className="road-analysis-section">
        <h3 className="section-title"><FaRoad /> Dangerous Roads &amp; Highways</h3>
        <div className="empty-state" style={{ padding: '2rem' }}>
          <p>No road/highway data available yet. Road names are extracted from new articles as they are scanned.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="road-analysis-section">
      <h3 className="section-title"><FaRoad /> Dangerous Roads &amp; Highways</h3>
      <p className="section-desc">Roads and highways ranked by accident frequency and fatality rate.</p>

      {chartData && (
        <div className="chart-card full-width">
          <div className="chart-title"><FaRoad /> Top 15 Dangerous Roads</div>
          <div className="chart-container" style={{ height: '350px' }}>
            <Chart type="bar" data={chartData} options={{
              responsive: true, maintainAspectRatio: false, indexAxis: 'y',
              plugins: { legend: { labels: { boxWidth: 12 } } },
            }} />
          </div>
        </div>
      )}

      <div className="road-cards">
        {roads.map((r, i) => (
          <div className="road-card" key={r.road_name}>
            <div className="road-card-header">
              <span className="road-rank">#{i + 1}</span>
              <span className="road-name">{r.road_name}</span>
              <span className="zone-severity-tag compact" style={{ background: `${SEVERITY_COLORS[r.severity]}18`, color: SEVERITY_COLORS[r.severity], borderColor: `${SEVERITY_COLORS[r.severity]}40` }}>
                {r.severity}
              </span>
            </div>
            <div className="road-card-stats">
              <span><FaCarCrash /> {r.accidents} acc</span>
              <span className="text-red"><FaSkullCrossbones /> {r.deaths} deaths</span>
              <span className="text-orange"><FaUserInjured /> {r.injuries} injuries</span>
              <span>FR: {r.fatality_rate}</span>
            </div>
            {r.district_list?.length > 0 && (
              <div className="road-districts">
                <FaMapMarkerAlt /> {r.district_list.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
