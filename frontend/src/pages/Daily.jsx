import { useState, useEffect, useCallback } from 'react';
import { api, formatDate, COLORS } from '../utils/api';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import { FaChartPie, FaChartBar, FaCar } from 'react-icons/fa';

const VEHICLE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#a855f7', '#ec4899', '#6366f1',
];

export default function Daily() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [vehicleData, setVehicleData] = useState(null);

  const load = useCallback(async () => {
    try {
      const [d, vehicles] = await Promise.all([
        api(`/daily?date=${date}`),
        api(`/vehicle-analytics?start=${date}&end=${date}`),
      ]);
      setData(d);

      if (vehicles?.length > 0) {
        const top = vehicles.slice(0, 8);
        setVehicleData({
          labels: top.map(v => v.vehicle),
          datasets: [{
            label: 'Accidents',
            data: top.map(v => v.accidents),
            backgroundColor: VEHICLE_COLORS.map(c => c + 'cc'),
            borderColor: VEHICLE_COLORS,
            borderWidth: 1,
          }],
        });
      } else {
        setVehicleData(null);
      }
    } catch (err) {
      console.error('Daily stats error:', err);
    }
  }, [date]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const typeChartData = data?.by_type?.length > 0
    ? { labels: data.by_type.map((d) => d.accident_type), datasets: [{ data: data.by_type.map((d) => d.count), backgroundColor: COLORS, borderWidth: 0 }] }
    : null;

  const districtChartData = data?.by_district?.length > 0
    ? {
        labels: data.by_district.map((d) => d.district),
        datasets: [
          { label: 'Accidents', data: data.by_district.map((d) => d.count), backgroundColor: '#06b6d480', borderColor: '#06b6d4', borderWidth: 1 },
          { label: 'Deaths', data: data.by_district.map((d) => d.deaths || 0), backgroundColor: '#ef444480', borderColor: '#ef4444', borderWidth: 1 },
        ],
      }
    : null;

  return (
    <>
      <div className="date-controls">
        <label>Select Date:</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {data && (
        <div className="stats-grid">
          <StatCard label="Accidents" value={data.total_accidents} sub={formatDate(data.date)} color="cyan" />
          <StatCard label="Deaths" value={data.total_deaths} color="red" />
          <StatCard label="Injuries" value={data.total_injuries} color="orange" />
        </div>
      )}

      <div className="charts-grid">
        <ChartCard
          title="Accident Types"
          icon={<FaChartPie />}
          type="pie"
          data={typeChartData}
          options={{ plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }}
        />
        <ChartCard
          title="By District"
          icon={<FaChartBar />}
          type="bar"
          data={districtChartData}
          options={{ plugins: { legend: { labels: { boxWidth: 12 } } } }}
        />
        <ChartCard
          title="Vehicles Involved"
          icon={<FaCar />}
          type="bar"
          data={vehicleData}
          fullWidth
          options={{
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } },
          }}
        />
      </div>
    </>
  );
}
