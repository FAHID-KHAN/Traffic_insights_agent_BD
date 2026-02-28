import { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { api } from '../utils/api';
import { FaChartLine, FaBrain } from 'react-icons/fa';

ChartJS.register(...registerables);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonth(monthStr) {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

export default function ForecastChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('accidents');

  useEffect(() => {
    api('/forecast?months=12&forecast_months=3')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="chart-card full-width"><div className="loading-pulse">Loading forecast...</div></div>;
  if (!data || !data.history?.length) return null;

  const { history, moving_avg, forecast } = data;

  // Labels: history months + forecast months
  const labels = [
    ...history.map(h => formatMonth(h.month)),
    ...forecast.map(f => formatMonth(f.month)),
  ];

  const histLength = history.length;

  // Actual data (with nulls for forecast zone)
  const actualData = [
    ...history.map(h => h[metric]),
    ...forecast.map(() => null),
  ];

  // Moving average line (with nulls for forecast zone)
  const maData = [
    ...moving_avg.map(m => m ? m[metric] : null),
    ...forecast.map(() => null),
  ];

  // Forecast line: bridge from last actual point into forecast
  const forecastData = [
    ...history.map((_, i) => i === histLength - 1 ? history[histLength - 1][metric] : null),
    ...forecast.map(f => f[metric]),
  ];

  const colorMap = {
    accidents: { border: '#10b981', bg: 'rgba(16,185,129,0.08)' },
    deaths: { border: '#F42A41', bg: 'rgba(244,42,65,0.08)' },
    injuries: { border: '#f97316', bg: 'rgba(249,115,22,0.08)' },
  };
  const c = colorMap[metric];

  const chartData = {
    labels,
    datasets: [
      {
        label: `${metric.charAt(0).toUpperCase() + metric.slice(1)} (Actual)`,
        data: actualData,
        borderColor: c.border,
        backgroundColor: c.bg,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2.5,
      },
      {
        label: '3-Month Moving Avg',
        data: maData,
        borderColor: '#eab308',
        borderDash: [6, 3],
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
        fill: false,
      },
      {
        label: 'Forecast (Projected)',
        data: forecastData,
        borderColor: c.border,
        backgroundColor: `${c.border}15`,
        borderDash: [8, 4],
        tension: 0.4,
        pointRadius: 5,
        pointStyle: 'triangle',
        pointHoverRadius: 8,
        borderWidth: 2.5,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { usePointStyle: true, padding: 16, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.label || '',
          label: (ctx) => {
            const idx = ctx.dataIndex;
            const isForecast = idx >= histLength;
            return `${ctx.dataset.label}: ${ctx.parsed.y}${isForecast ? ' (projected)' : ''}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(51,65,85,0.3)' },
        ticks: { maxRotation: 45 },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(51,65,85,0.3)' },
      },
    },
  };

  // Summary stats for forecast
  const lastActual = history[histLength - 1];
  const firstForecast = forecast[0];
  const fcDelta = firstForecast && lastActual
    ? (((firstForecast[metric] - lastActual[metric]) / (lastActual[metric] || 1)) * 100).toFixed(1)
    : 0;

  return (
    <div className="chart-card full-width forecast-card">
      <div className="chart-title">
        <FaBrain /> Trend Forecast &amp; Moving Average
      </div>

      <div className="forecast-controls">
        <div className="forecast-metric-chips">
          {['accidents', 'deaths', 'injuries'].map(m => (
            <button
              key={m}
              className={`fc-chip${metric === m ? ' active' : ''}`}
              onClick={() => setMetric(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        {firstForecast && (
          <div className="forecast-badge">
            <FaChartLine />
            <span>
              Next month projection: <strong>{firstForecast[metric]}</strong>{' '}
              {metric} ({fcDelta > 0 ? '+' : ''}{fcDelta}%)
            </span>
          </div>
        )}
      </div>

      <div className="chart-container" style={{ height: '350px' }}>
        <Chart type="line" data={chartData} options={options} />
      </div>
    </div>
  );
}
