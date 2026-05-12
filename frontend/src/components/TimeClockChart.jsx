import { useState, useEffect } from 'react';
import { PolarArea } from 'react-chartjs-2';
import { api } from '../utils/api';
import { TIME_BANDS } from '../utils/timeColors';
import { FaClock } from 'react-icons/fa';

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const suffix = i < 12 ? 'am' : 'pm';
  const h = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return `${h}${suffix}`;
});

function hourToBand(h) {
  if (h === 0)              return 'midnight';
  if (h >= 1  && h <= 5)   return 'dawn';
  if (h >= 6  && h <= 10)  return 'morning';
  if (h >= 11 && h <= 12)  return 'noon';
  if (h >= 13 && h <= 16)  return 'afternoon';
  if (h >= 17 && h <= 19)  return 'evening';
  return 'night';
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
  const bandColors = Array.from({ length: 24 }, (_, h) => TIME_BANDS[hourToBand(h)].color);

  const chartData = {
    labels: HOUR_LABELS,
    datasets: [{
      data: values,
      backgroundColor: bandColors.map(c => c + 'aa'),
      borderColor: bandColors,
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
