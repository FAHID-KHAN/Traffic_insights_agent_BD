import { useRef } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(...registerables);

// Set global defaults
ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.borderColor = 'rgba(51, 65, 85, 0.5)';
ChartJS.defaults.font.family = 'Inter';

export default function ChartCard({ title, icon, type, data, options, fullWidth }) {
  const chartRef = useRef(null);

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    ...options,
  };

  return (
    <div className={`chart-card${fullWidth ? ' full-width' : ''}`}>
      <div className="chart-title">
        {icon} {title}
      </div>
      <div className="chart-container">
        {data && data.labels && data.labels.length > 0 ? (
          <Chart ref={chartRef} type={type} data={data} options={defaultOptions} />
        ) : (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p>No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
