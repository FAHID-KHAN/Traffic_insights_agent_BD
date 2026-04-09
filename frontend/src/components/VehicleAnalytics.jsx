import { useState, useEffect } from 'react';
import { Chart } from 'react-chartjs-2';
import { api } from '../utils/api';
import { FaCar, FaSkullCrossbones, FaUserInjured, FaCarCrash, FaChartLine, FaMapMarkerAlt } from 'react-icons/fa';

const VEHICLE_COLORS = {
  'Bus': '#ef4444',
  'Truck': '#f97316',
  'Motorcycle': '#eab308',
  'CNG/Auto-rickshaw': '#22c55e',
  'Car/Microbus': '#06b6d4',
  'Van/Pickup': '#a855f7',
  'Rickshaw': '#ec4899',
  'Train': '#6366f1',
  'Watercraft': '#14b8a6',
};

function getColor(vehicle, idx) {
  return VEHICLE_COLORS[vehicle] || `hsl(${(idx * 37) % 360}, 60%, 55%)`;
}

export default function VehicleAnalytics() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  useEffect(() => {
    api('/vehicle-analytics')
      .then(setVehicles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Overview chart — accidents by vehicle type
  const overviewChart = vehicles.length > 0 ? {
    labels: vehicles.map(v => v.vehicle),
    datasets: [{
      data: vehicles.map(v => v.accidents),
      backgroundColor: vehicles.map((v, i) => getColor(v.vehicle, i)),
    }],
  } : null;

  // Fatality rate comparison
  const frChart = vehicles.length > 0 ? {
    labels: vehicles.filter(v => v.accidents >= 2).map(v => v.vehicle),
    datasets: [{
      label: 'Fatality Rate (deaths/accident)',
      data: vehicles.filter(v => v.accidents >= 2).map(v => v.fatality_rate),
      backgroundColor: vehicles.filter(v => v.accidents >= 2).map((v, i) => getColor(v.vehicle, i)),
      borderRadius: 4,
    }],
  } : null;

  // Selected vehicle trend
  const detail = selectedVehicle ? vehicles.find(v => v.vehicle === selectedVehicle) : null;
  const trendChart = detail?.trend?.length > 0 ? {
    labels: detail.trend.map(t => t.month),
    datasets: [{
      label: detail.vehicle,
      data: detail.trend.map(t => t.count),
      borderColor: getColor(detail.vehicle, 0),
      backgroundColor: getColor(detail.vehicle, 0) + '22',
      fill: true,
      tension: 0.4,
    }],
  } : null;

  if (loading) return <div className="loading-msg">Loading vehicle analytics...</div>;
  if (vehicles.length === 0) return null;

  return (
    <div className="vehicle-analytics-section">
      <h3 className="section-title"><FaCar /> Vehicle Type Analysis</h3>
      <p className="section-desc">Accidents, fatalities, and trends broken down by vehicle type involved.</p>

      <div className="va-overview-grid">
        {overviewChart && (
          <div className="chart-card">
            <div className="chart-title"><FaCarCrash /> Accidents by Vehicle Type</div>
            <div className="chart-container">
              <Chart type="doughnut" data={overviewChart} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } },
              }} />
            </div>
          </div>
        )}
        {frChart && (
          <div className="chart-card">
            <div className="chart-title"><FaSkullCrossbones /> Fatality Rate by Vehicle</div>
            <div className="chart-container">
              <Chart type="bar" data={frChart} options={{
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } },
              }} />
            </div>
          </div>
        )}
      </div>

      <div className="va-vehicle-cards">
        {vehicles.map((v, i) => (
          <div className={`va-card ${selectedVehicle === v.vehicle ? 'active' : ''}`} key={v.vehicle}
               onClick={() => setSelectedVehicle(selectedVehicle === v.vehicle ? null : v.vehicle)}
               style={{ borderLeftColor: getColor(v.vehicle, i) }}>
            <div className="va-card-name">{v.vehicle}</div>
            <div className="va-card-stats">
              <span><FaCarCrash /> {v.accidents}</span>
              <span className="text-red"><FaSkullCrossbones /> {v.deaths}</span>
              <span className="text-orange"><FaUserInjured /> {v.injuries}</span>
              <span>FR: {v.fatality_rate}</span>
            </div>
          </div>
        ))}
      </div>

      {detail && (
        <div className="va-detail">
          <div className="va-detail-grid">
            {trendChart && (
              <div className="chart-card full-width">
                <div className="chart-title"><FaChartLine /> {detail.vehicle} — Monthly Trend</div>
                <div className="chart-container">
                  <Chart type="line" data={trendChart} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
              </div>
            )}
            {detail.top_districts?.length > 0 && (
              <div className="va-top-districts">
                <h4><FaMapMarkerAlt /> Top Districts for {detail.vehicle}</h4>
                {detail.top_districts.map((d, i) => (
                  <div className="va-district-row" key={d.district}>
                    <span className="dd-rank">{i + 1}</span>
                    <span className="dd-name">{d.district}</span>
                    <span className="dd-stat">{d.count} accidents</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
