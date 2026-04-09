import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import YoYSummary from '../components/YoYSummary';
import ForecastChart from '../components/ForecastChart';
import TimeHeatmap from '../components/TimeHeatmap';
import ClusterTimeline from '../components/ClusterTimeline';
import DistrictDetail from '../components/DistrictDetail';
import RoadAnalysis from '../components/RoadAnalysis';
import BlackspotDetection from '../components/BlackspotDetection';
import VehicleAnalytics from '../components/VehicleAnalytics';
import {
  FaChartArea, FaGlobeAsia, FaCarCrash,
  FaSkullCrossbones, FaUserInjured,
} from 'react-icons/fa';

const SEVERITY_COLORS = { critical: '#ef4444', high: '#f97316', moderate: '#eab308', low: '#22c55e' };

function getSeverity(fr) {
  if (fr >= 1.5) return 'critical';
  if (fr >= 1.0) return 'high';
  if (fr >= 0.5) return 'moderate';
  return 'low';
}

export default function Insights() {
  const [summary, setSummary] = useState(null);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    api('/danger-zones/summary').then(setSummary).catch(console.error);
    api('/danger-zones?limit=64').then(setZones).catch(console.error);
  }, []);

  return (
    <div className="insights-page">
      <h2 className="page-title">
        <FaChartArea className="text-cyan" /> Analytics &amp; Insights
      </h2>
      <p className="page-subtitle">
        In-depth analysis including year-over-year comparisons, trend forecasts, time patterns, and accident clusters.
      </p>

      <YoYSummary />
      <ForecastChart />
      <TimeHeatmap />
      <ClusterTimeline />
      <DistrictDetail />
      <VehicleAnalytics />
      <RoadAnalysis />
      <BlackspotDetection />

      {/* Division-Level Breakdown */}
      {summary?.divisions?.length > 0 && (
        <div className="zones-divisions">
          <h3 className="section-title"><FaGlobeAsia /> Division-Level Breakdown</h3>
          {summary.divisions.map(div => {
            const sev = getSeverity(div.fatality_rate);
            const divDistricts = zones.filter(z => z.division === div.division).sort((a, b) => b.total_accidents - a.total_accidents);
            return (
              <div className="division-section" key={div.division}>
                <div className="division-header">
                  <div className="division-name">
                    <FaGlobeAsia /> {div.division} Division
                    <span className="zone-severity-tag compact" style={{ background: `${SEVERITY_COLORS[sev]}18`, color: SEVERITY_COLORS[sev], borderColor: `${SEVERITY_COLORS[sev]}40` }}>
                      {div.fatality_rate} deaths/acc
                    </span>
                  </div>
                  <div className="division-quick-stats">
                    <span>{div.districts} districts</span>
                    <span><FaCarCrash /> {div.total_accidents}</span>
                    <span className="text-red"><FaSkullCrossbones /> {div.total_deaths}</span>
                    <span className="text-orange"><FaUserInjured /> {div.total_injuries}</span>
                  </div>
                </div>
                <div className="division-districts">
                  {divDistricts.map((z, i) => (
                    <div className="division-district-row" key={z.district}>
                      <span className="dd-rank">{i + 1}</span>
                      <span className="dd-name">{z.district}</span>
                      <span className="dd-stat">{z.total_accidents} acc</span>
                      <span className="dd-stat text-red">{z.total_deaths || 0} deaths</span>
                      <span className="dd-stat text-orange">{z.total_injuries || 0} inj</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
