import YoYSummary from '../components/YoYSummary';
import ForecastChart from '../components/ForecastChart';
import TimeHeatmap from '../components/TimeHeatmap';
import ClusterTimeline from '../components/ClusterTimeline';
import TimeClockChart from '../components/TimeClockChart';
import { FaChartArea } from 'react-icons/fa';

export default function Insights() {
  return (
    <div className="insights-page">
      <h2 className="page-title">
        <FaChartArea className="text-cyan" /> Analytics &amp; Insights
      </h2>
      <p className="page-subtitle">
        Year-over-year comparisons, trend forecasts, time-pattern heatmaps, and accident cluster
        detection across Bangladesh.
      </p>

      <YoYSummary />
      <ForecastChart />
      <TimeHeatmap />
      <div className="charts-grid" style={{ marginTop: '1.5rem' }}>
        <TimeClockChart />
      </div>
      <ClusterTimeline />
    </div>
  );
}
