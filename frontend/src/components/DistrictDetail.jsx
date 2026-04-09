import { useState, useEffect } from 'react';
import { Chart as ChartJS } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { api } from '../utils/api';
import {
  FaMapMarkerAlt, FaSkullCrossbones, FaUserInjured, FaCarCrash,
  FaChartLine, FaChartPie, FaChartBar, FaCalendarDay, FaExternalLinkAlt,
} from 'react-icons/fa';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DistrictDetail() {
  const [districts, setDistricts] = useState([]);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('/search/districts').then(setDistricts).catch(console.error);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selected) { setData(null); return; }
    setLoading(true);
    api(`/district/${encodeURIComponent(selected)}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selected]);

  const trendChart = data?.trend?.length > 0 ? {
    labels: data.trend.map(t => t.month),
    datasets: [
      { label: 'Accidents', data: data.trend.map(t => t.accidents), borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4 },
      { label: 'Deaths', data: data.trend.map(t => t.deaths), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 },
    ],
  } : null;

  const typeChart = data?.by_type?.length > 0 ? {
    labels: data.by_type.map(t => t.accident_type || 'Unknown'),
    datasets: [{
      data: data.by_type.map(t => t.count),
      backgroundColor: ['#06b6d4', '#ef4444', '#eab308', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#6366f1'],
    }],
  } : null;

  const vehicleChart = data?.top_vehicles?.length > 0 ? {
    labels: data.top_vehicles.map(v => v.vehicle),
    datasets: [{
      label: 'Involvements',
      data: data.top_vehicles.map(v => v.count),
      backgroundColor: 'rgba(6,182,212,0.7)',
      borderRadius: 4,
    }],
  } : null;

  const dowChart = data?.by_dow?.length > 0 ? {
    labels: DOW_LABELS,
    datasets: [{
      label: 'Accidents',
      data: DOW_LABELS.map((_, i) => {
        const match = data.by_dow.find(d => d.dow === i);
        return match ? match.accidents : 0;
      }),
      backgroundColor: DOW_LABELS.map((_, i) => {
        const match = data.by_dow.find(d => d.dow === i);
        return match && match.accidents > 0 ? 'rgba(239,68,68,0.6)' : 'rgba(100,116,139,0.3)';
      }),
      borderRadius: 4,
    }],
  } : null;

  const frChart = data?.fatality_trend?.length > 0 ? {
    labels: data.fatality_trend.map(f => f.month),
    datasets: [{
      label: 'Fatality Rate',
      data: data.fatality_trend.map(f => f.fatality_rate),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.1)',
      fill: true,
      tension: 0.4,
    }],
  } : null;

  return (
    <div className="district-detail-section">
      <h3 className="section-title"><FaMapMarkerAlt /> District Deep Dive</h3>
      <p className="section-desc">Select a district to view its complete accident profile, trends, vehicle breakdown, and seasonal patterns.</p>

      <select className="district-selector" value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">— Select a district —</option>
        {districts.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      {loading && <div className="loading-msg">Loading district data...</div>}

      {data && (
        <div className="dd-content">
          <div className="dd-header">
            <h4>{data.district} <span className="dd-division">{data.division} Division</span></h4>
            <div className="dd-stat-bar">
              <span className="dd-stat"><FaCarCrash /> {data.totals.accidents} accidents</span>
              <span className="dd-stat text-red"><FaSkullCrossbones /> {data.totals.deaths} deaths</span>
              <span className="dd-stat text-orange"><FaUserInjured /> {data.totals.injuries} injuries</span>
              <span className="dd-stat">Fatality rate: {data.fatality_rate}</span>
              <span className="dd-stat">{data.totals.first_date} — {data.totals.last_date}</span>
            </div>
          </div>

          <div className="dd-charts-grid">
            {trendChart && (
              <div className="chart-card full-width">
                <div className="chart-title"><FaChartLine /> Monthly Trend</div>
                <div className="chart-container">
                  <Chart type="line" data={trendChart} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { maxRotation: 45 } } } }} />
                </div>
              </div>
            )}
            {typeChart && (
              <div className="chart-card">
                <div className="chart-title"><FaChartPie /> By Accident Type</div>
                <div className="chart-container">
                  <Chart type="doughnut" data={typeChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }} />
                </div>
              </div>
            )}
            {vehicleChart && (
              <div className="chart-card">
                <div className="chart-title"><FaChartBar /> Top Vehicles</div>
                <div className="chart-container">
                  <Chart type="bar" data={vehicleChart} options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }} />
                </div>
              </div>
            )}
            {dowChart && (
              <div className="chart-card">
                <div className="chart-title"><FaCalendarDay /> Day of Week</div>
                <div className="chart-container">
                  <Chart type="bar" data={dowChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                </div>
              </div>
            )}
            {frChart && (
              <div className="chart-card">
                <div className="chart-title"><FaSkullCrossbones /> Fatality Rate Over Time</div>
                <div className="chart-container">
                  <Chart type="line" data={frChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} />
                </div>
              </div>
            )}
          </div>

          {data.recent?.length > 0 && (
            <div className="dd-recent">
              <h4 className="dd-recent-title">Recent Accidents</h4>
              <div className="dd-recent-list">
                {data.recent.map(a => (
                  <div className="dd-recent-item" key={a.id}>
                    <span className="dd-recent-date">{a.accident_date}</span>
                    <span className="dd-recent-type">{a.accident_type || '—'}</span>
                    <span className="dd-recent-casualties">
                      {a.deaths > 0 && <span className="text-red">{a.deaths}D</span>}
                      {a.injuries > 0 && <span className="text-orange"> {a.injuries}I</span>}
                    </span>
                    <span className="dd-recent-summary">{a.summary || a.location_raw || '—'}</span>
                    {a.article_url && <a href={a.article_url} target="_blank" rel="noreferrer"><FaExternalLinkAlt /></a>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
