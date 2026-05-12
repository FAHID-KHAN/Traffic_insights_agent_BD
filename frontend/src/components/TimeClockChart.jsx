import { useState, useEffect } from 'react';
import { PolarArea } from 'react-chartjs-2';
import { api } from '../utils/api';
import { FaClock } from 'react-icons/fa';

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const suffix = i < 12 ? 'am' : 'pm';
  const h = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return `${h}${suffix}`;
});

function hourColor(value, max) {
  if (max === 0) return 'rgba(0,106,78,0.2)';
  const ratio = value / max;
  if (ratio > 0.8) return 'rgba(244,42,65,0.75)';
  if (ratio > 0.6) return 'rgba(239,108,0,0.7)';
  if (ratio > 0.4) return 'rgba(249,168,37,0.65)';
  if (ratio > 0.2) return 'rgba(0,168,120,0.6)';
  return 'rgba(0,106,78,0.25)';
}

export default function TimeClockChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('accidents');

  useEffect(() => {
    api('/time-patterns')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="chart-card">
      <div className="loading-pulse">Loading clock chart...</div>
    </div>
  );
  if (!data?.by_hour?.length) return null;

  const byHour = data.by_hour;
  const values = Array.from({ length: 24 }, (_, h) => {
    const entry = byHour.find(r => r.hour === h);
    return entry ? (metric === 'deaths' ? entry.deaths : entry.accidents) : 0;
  });
  const maxVal = Math.max(...values, 1);
  const colors = values.map(v => hourColor(v, maxVal));

  const chartData = {
    labels: HOUR_LABELS,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderColor: colors.map(c => c.replace(/[\d.]+\)$/, '1)')),
      borderWidth: 1,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.r} ${metric} at ${HOUR_LABELS[ctx.dataIndex]}`,
        },
      },
    },
    scales: {
      r: {
        ticks: { display: false },
        grid: { color: 'rgba(148,163,184,0.15)' },
      },
    },
  };

  const peakHour = values.indexOf(Math.max(...values));
  const peakLabel = HOUR_LABELS[peakHour];

  return (
    <div className="chart-card">
      <div className="chart-title"><FaClock /> 24-Hour Accident Clock</div>

      <div className="forecast-metric-chips" style={{ marginBottom: '0.75rem' }}>
        {['accidents', 'deaths'].map(m => (
          <button
            key={m}
            className={`fc-chip${metric === m ? ' active' : ''}`}
            onClick={() => setMetric(m)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div className="chart-container" style={{ height: '280px' }}>
        <PolarArea data={chartData} options={options} />
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        Peak hour: <strong style={{ color: 'var(--accent-cyan)' }}>{peakLabel}</strong>
        &nbsp;·&nbsp;Outer = more {metric}. Hover for details.
      </p>
    </div>
  );
}
