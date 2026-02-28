import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, formatDate, COLORS } from '../utils/api';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import { FaCarCrash, FaSkullCrossbones, FaUserInjured, FaCalendarDay, FaNewspaper, FaChartArea, FaChartPie, FaChartBar, FaFilter } from 'react-icons/fa';
import LiveNews from '../components/LiveNews';
import YouTubeNews from '../components/YouTubeNews';
import ForecastChart from '../components/ForecastChart';
import TimeHeatmap from '../components/TimeHeatmap';
import ClusterTimeline from '../components/ClusterTimeline';
import YoYSummary from '../components/YoYSummary';

const TIMEFRAMES = [
  { key: '7d',    label: 'Last 7 Days' },
  { key: '30d',   label: 'Last 30 Days' },
  { key: '90d',   label: 'Last 90 Days' },
  { key: '6m',    label: 'Last 6 Months' },
  { key: 'year',  label: 'This Year' },
  { key: 'all',   label: 'All Time' },
  { key: 'custom', label: 'Custom Range' },
];

function getDateRange(key) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const end = fmt(today);
  switch (key) {
    case '7d':   return { start: fmt(new Date(today.getTime() - 7  * 86400000)), end };
    case '30d':  return { start: fmt(new Date(today.getTime() - 30 * 86400000)), end };
    case '90d':  return { start: fmt(new Date(today.getTime() - 90 * 86400000)), end };
    case '6m':   return { start: fmt(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())), end };
    case 'year': return { start: `${today.getFullYear()}-01-01`, end };
    case 'all':  return null;
    default:     return null;
  }
}

export default function Dashboard() {
  const { setLastUpdate } = useOutletContext();
  const [overview, setOverview] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [typeData, setTypeData] = useState(null);
  const [districtData, setDistrictData] = useState(null);
  const [timeframe, setTimeframe] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const load = useCallback(async () => {
    try {
      // Build date-range query string
      let rangeQS = '';
      let trendQS = '';
      if (timeframe === 'custom' && customStart && customEnd) {
        rangeQS = `&start=${customStart}&end=${customEnd}`;
        trendQS = `?start=${customStart}&end=${customEnd}`;
      } else if (timeframe !== 'custom') {
        const range = getDateRange(timeframe);
        if (range) {
          rangeQS = `&start=${range.start}&end=${range.end}`;
          trendQS = `?start=${range.start}&end=${range.end}`;
        } else {
          trendQS = '';
        }
      }

      const overviewURL = rangeQS ? `/overview?${rangeQS.slice(1)}` : '/overview';
      const trendURL = trendQS ? `/trend${trendQS}` : '/trend';
      const zonesURL = rangeQS ? `/danger-zones?limit=10${rangeQS}` : '/danger-zones?limit=10';

      const [ov, trend, zones] = await Promise.all([
        api(overviewURL),
        api(trendURL),
        api(zonesURL),
      ]);
      setOverview(ov);

      if (ov.last_scrape) {
        setLastUpdate(ov.last_scrape.finished_at || 'Running...');
      }

      // Trend chart data
      if (trend.length > 0) {
        setTrendData({
          labels: trend.map((d) => formatDate(d.accident_date)),
          datasets: [
            { label: 'Accidents', data: trend.map((d) => d.accidents), borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4 },
            { label: 'Deaths', data: trend.map((d) => d.deaths || 0), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 },
            { label: 'Injuries', data: trend.map((d) => d.injuries || 0), borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', fill: true, tension: 0.4 },
          ],
        });
      } else {
        setTrendData(null);
      }

      // Type breakdown from trend data
      if (trend.length > 0) {
        const range = getDateRange(timeframe);
        let monthData;
        if (timeframe === 'custom' && customStart && customEnd) {
          // For custom ranges use a monthly query for the start month as a proxy,
          // but better: compute by-type from the overview's date range
          const dt = new Date(customStart);
          monthData = await api(`/monthly?year=${dt.getFullYear()}&month=${dt.getMonth() + 1}`);
        } else if (range) {
          const dt = new Date(range.start);
          monthData = await api(`/monthly?year=${dt.getFullYear()}&month=${dt.getMonth() + 1}`);
        } else {
          const now = new Date();
          monthData = await api(`/monthly?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
        }
        if (monthData.by_type?.length > 0) {
          setTypeData({
            labels: monthData.by_type.map((d) => d.accident_type || 'Unknown'),
            datasets: [{ data: monthData.by_type.map((d) => d.count), backgroundColor: COLORS, borderWidth: 0 }],
          });
        } else {
          setTypeData(null);
        }
      } else {
        setTypeData(null);
      }

      // District chart
      if (zones.length > 0) {
        setDistrictData({
          labels: zones.slice(0, 10).map((d) => d.district),
          datasets: [{
            label: 'Accidents',
            data: zones.slice(0, 10).map((d) => d.total_accidents),
            backgroundColor: COLORS.map((c) => c + '80'),
            borderColor: COLORS,
            borderWidth: 1,
          }],
        });
      } else {
        setDistrictData(null);
      }
    } catch (err) {
      console.error('Dashboard error:', err);
    }
  }, [setLastUpdate, timeframe, customStart, customEnd]);

  useEffect(() => {
    if (timeframe === 'custom' && (!customStart || !customEnd)) return;
    load();
  }, [load, timeframe, customStart, customEnd]);

  const trendLabel = TIMEFRAMES.find((t) => t.key === timeframe)?.label || '';

  return (
    <>
      {/* ── Timeframe Toolbar ── */}
      <div className="timeframe-bar">
        <div className="timeframe-label"><FaFilter /> Timeframe</div>
        <div className="timeframe-chips">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.key}
              className={`tf-chip${timeframe === tf.key ? ' active' : ''}`}
              onClick={() => setTimeframe(tf.key)}
            >
              {tf.label}
            </button>
          ))}
        </div>
        {timeframe === 'custom' && (
          <div className="timeframe-custom">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <span>to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        )}
      </div>

      <div className="stats-grid">
        {overview && (
          <>
            <StatCard label="Accidents" value={overview.total_accidents} sub={trendLabel} icon={<FaCarCrash />} color="cyan" />
            <StatCard label="Deaths" value={overview.total_deaths} sub={trendLabel} icon={<FaSkullCrossbones />} color="red" />
            <StatCard label="Injuries" value={overview.total_injuries} sub={trendLabel} icon={<FaUserInjured />} color="orange" />
            <StatCard label="Today" value={overview.today.accidents} sub={`${overview.today.deaths} deaths, ${overview.today.injuries} injured`} icon={<FaCalendarDay />} color="green" />
            <StatCard label="Articles" value={overview.total_articles} sub={trendLabel} icon={<FaNewspaper />} color="purple" />
          </>
        )}
      </div>

      <div className="charts-grid">
        <ChartCard title={`Accident Trend (${trendLabel})`} icon={<FaChartArea />} type="line" data={trendData} fullWidth />
        <ChartCard
          title="Accidents by Type"
          icon={<FaChartPie />}
          type="doughnut"
          data={typeData}
          options={{ plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } } }}
        />
        <ChartCard
          title="Top Danger Districts"
          icon={<FaChartBar />}
          type="bar"
          data={districtData}
          options={{ indexAxis: 'y', plugins: { legend: { display: false } } }}
        />
      </div>

      {/* ── Year-over-Year Summary ── */}
      <YoYSummary />

      {/* ── Trend Forecast ── */}
      <ForecastChart />

      {/* ── Time Patterns Heatmap ── */}
      <TimeHeatmap />

      {/* ── Accident Clusters ── */}
      <ClusterTimeline />

      {/* ── YouTube Video News ── */}
      <YouTubeNews limit={8} />

      {/* ── Live News Feed ── */}
      <LiveNews limit={12} />
    </>
  );
}
