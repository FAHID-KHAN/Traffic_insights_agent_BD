import { useState, useEffect, useCallback } from 'react';
import { api, formatDate, COLORS } from '../utils/api';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import { FaChartArea, FaChartPie, FaChartBar } from 'react-icons/fa';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Monthly() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(y);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const load = useCallback(async () => {
    try {
      const d = await api(`/monthly?year=${year}&month=${month}`);
      setData(d);
    } catch (err) {
      console.error('Monthly stats error:', err);
    }
  }, [year, month]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const dailyChart = data?.daily_breakdown?.length > 0
    ? {
        labels: data.daily_breakdown.map((d) => formatDate(d.accident_date)),
        datasets: [
          { label: 'Accidents', data: data.daily_breakdown.map((d) => d.count), backgroundColor: '#06b6d480', borderColor: '#06b6d4', borderWidth: 1 },
          { label: 'Deaths', data: data.daily_breakdown.map((d) => d.deaths || 0), backgroundColor: '#ef444480', borderColor: '#ef4444', borderWidth: 1 },
          { label: 'Injuries', data: data.daily_breakdown.map((d) => d.injuries || 0), backgroundColor: '#eab30880', borderColor: '#eab308', borderWidth: 1 },
        ],
      }
    : null;

  const typeChart = data?.by_type?.length > 0
    ? { labels: data.by_type.map((d) => d.accident_type), datasets: [{ data: data.by_type.map((d) => d.count), backgroundColor: COLORS, borderWidth: 0 }] }
    : null;

  const districtChart = data?.by_district?.length > 0
    ? {
        labels: data.by_district.slice(0, 15).map((d) => d.district),
        datasets: [{ label: 'Accidents', data: data.by_district.slice(0, 15).map((d) => d.count), backgroundColor: COLORS.map((c) => c + '80'), borderColor: COLORS, borderWidth: 1 }],
      }
    : null;

  const dailyAvg = data?.daily_breakdown?.length > 0
    ? (data.total_accidents / data.daily_breakdown.length).toFixed(1)
    : 0;

  return (
    <>
      <div className="date-controls">
        <label>Year:</label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <label>Month:</label>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {data && (
        <div className="stats-grid">
          <StatCard label="Total Accidents" value={data.total_accidents} color="cyan" />
          <StatCard label="Total Deaths" value={data.total_deaths} color="red" />
          <StatCard label="Total Injuries" value={data.total_injuries} color="orange" />
          <StatCard label="Daily Average" value={dailyAvg} sub="accidents/day" color="blue" />
        </div>
      )}

      <div className="charts-grid">
        <ChartCard title="Daily Breakdown" icon={<FaChartArea />} type="bar" data={dailyChart} fullWidth options={{ plugins: { legend: { labels: { boxWidth: 12 } } } }} />
        <ChartCard title="Accident Types" icon={<FaChartPie />} type="doughnut" data={typeChart} options={{ plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }} />
        <ChartCard title="By District" icon={<FaChartBar />} type="bar" data={districtChart} options={{ indexAxis: 'y', plugins: { legend: { display: false } } }} />
      </div>
    </>
  );
}
