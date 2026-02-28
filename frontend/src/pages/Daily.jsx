import { useState, useEffect, useCallback } from 'react';
import { api, formatDate, COLORS } from '../utils/api';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import { FaChartPie, FaChartBar } from 'react-icons/fa';

export default function Daily() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api(`/daily?date=${date}`);
      setData(d);
    } catch (err) {
      console.error('Daily stats error:', err);
    }
  }, [date]);

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
        <ChartCard title="By District" icon={<FaChartBar />} type="bar" data={districtChartData} options={{ plugins: { legend: { labels: { boxWidth: 12 } } } }} />
      </div>
    </>
  );
}
