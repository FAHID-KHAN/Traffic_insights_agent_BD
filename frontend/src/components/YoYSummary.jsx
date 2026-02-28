import { useState, useEffect } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { api } from '../utils/api';
import { FaCalendarCheck, FaArrowUp, FaArrowDown, FaMinus, FaSkullCrossbones, FaUserInjured, FaCarCrash, FaExclamationTriangle } from 'react-icons/fa';

ChartJS.register(...registerables);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function DeltaBadge({ value, invert = false }) {
  // invert: for deaths/accidents, positive = bad (red), negative = good (green)
  const isUp = value > 0;
  const isDown = value < 0;
  const color = invert
    ? (isUp ? '#F42A41' : isDown ? '#10b981' : 'var(--text-muted)')
    : (isUp ? '#10b981' : isDown ? '#F42A41' : 'var(--text-muted)');
  const Icon = isUp ? FaArrowUp : isDown ? FaArrowDown : FaMinus;
  return (
    <span className="yoy-delta" style={{ color }}>
      <Icon /> {Math.abs(value)}%
    </span>
  );
}

export default function YoYSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/yoy-summary')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="chart-card full-width"><div className="loading-pulse">Loading year summary...</div></div>;
  if (!data) return null;

  const { current_year, previous_year, data: yearData, ytd_delta, current_month } = data;
  const curr = yearData[String(current_year)];
  const prev = yearData[String(previous_year)];

  if (!curr || !prev) return null;

  // Monthly comparison chart
  const allMonths = MONTH_NAMES.slice(0, 12);
  const currMonthData = new Array(12).fill(0);
  const prevMonthData = new Array(12).fill(0);
  curr.by_month.forEach(m => { currMonthData[m.month - 1] = m.accidents; });
  prev.by_month.forEach(m => { prevMonthData[m.month - 1] = m.accidents; });

  const chartData = {
    labels: allMonths,
    datasets: [
      {
        label: String(current_year),
        data: currMonthData,
        borderColor: '#00a878',
        backgroundColor: 'rgba(0,168,120,0.15)',
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 3,
      },
      {
        label: String(previous_year),
        data: prevMonthData,
        borderColor: '#F42A41',
        backgroundColor: 'rgba(244,42,65,0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        borderDash: [5, 3],
        pointRadius: 3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { usePointStyle: true, padding: 14, font: { size: 11 } },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.3)' } },
      y: { beginAtZero: true, grid: { color: 'rgba(51,65,85,0.3)' } },
    },
  };

  const currWorst = curr.worst_month;
  const prevWorst = prev.worst_month;

  return (
    <div className="yoy-section">
      <div className="section-header">
        <FaCalendarCheck /> Year-over-Year Report — {current_year} vs {previous_year}
      </div>

      {/* YTD Summary Cards */}
      <div className="yoy-cards">
        <div className="yoy-card">
          <div className="yoy-card-icon" style={{ background: 'rgba(6,182,212,0.15)' }}>
            <FaCarCrash />
          </div>
          <div className="yoy-card-body">
            <span className="yoy-card-label">Accidents (YTD)</span>
            <div className="yoy-card-values">
              <span className="yoy-val current">{curr.ytd.accidents}</span>
              <span className="yoy-vs">vs</span>
              <span className="yoy-val prev">{prev.ytd.accidents}</span>
            </div>
            <DeltaBadge value={ytd_delta.accidents} invert />
          </div>
        </div>

        <div className="yoy-card">
          <div className="yoy-card-icon" style={{ background: 'rgba(244,42,65,0.15)' }}>
            <FaSkullCrossbones />
          </div>
          <div className="yoy-card-body">
            <span className="yoy-card-label">Deaths (YTD)</span>
            <div className="yoy-card-values">
              <span className="yoy-val current">{curr.ytd.deaths}</span>
              <span className="yoy-vs">vs</span>
              <span className="yoy-val prev">{prev.ytd.deaths}</span>
            </div>
            <DeltaBadge value={ytd_delta.deaths} invert />
          </div>
        </div>

        <div className="yoy-card">
          <div className="yoy-card-icon" style={{ background: 'rgba(249,115,22,0.15)' }}>
            <FaUserInjured />
          </div>
          <div className="yoy-card-body">
            <span className="yoy-card-label">Injuries (YTD)</span>
            <div className="yoy-card-values">
              <span className="yoy-val current">{curr.ytd.injuries}</span>
              <span className="yoy-vs">vs</span>
              <span className="yoy-val prev">{prev.ytd.injuries}</span>
            </div>
            <DeltaBadge value={ytd_delta.injuries} invert />
          </div>
        </div>

        <div className="yoy-card">
          <div className="yoy-card-icon" style={{ background: 'rgba(234,179,8,0.15)' }}>
            <FaExclamationTriangle />
          </div>
          <div className="yoy-card-body">
            <span className="yoy-card-label">Worst Month</span>
            <div className="yoy-card-values">
              {currWorst ? (
                <span className="yoy-val current">{MONTH_NAMES[currWorst.month - 1]} ({currWorst.accidents})</span>
              ) : (
                <span className="yoy-val current">—</span>
              )}
              <span className="yoy-vs">vs</span>
              {prevWorst ? (
                <span className="yoy-val prev">{MONTH_NAMES[prevWorst.month - 1]} ({prevWorst.accidents})</span>
              ) : (
                <span className="yoy-val prev">—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Comparison Chart */}
      <div className="yoy-chart-wrap">
        <div className="chart-container" style={{ height: '300px' }}>
          <Chart type="line" data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
