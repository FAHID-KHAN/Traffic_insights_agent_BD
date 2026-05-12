import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, formatDate, COLORS } from '../utils/api';
import { TIME_BANDS, PART_ORDER } from '../utils/timeColors';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import { FaCarCrash, FaSkullCrossbones, FaUserInjured, FaCalendarDay, FaNewspaper, FaChartArea, FaChartPie, FaChartBar, FaFilter, FaCar, FaClock } from 'react-icons/fa';

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
    case '6m':   { const d = new Date(today); d.setMonth(d.getMonth() - 6); return { start: fmt(d), end }; }
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
  const [vehicleData, setVehicleData] = useState(null);
  const [timeInsights, setTimeInsights] = useState(null);
  const [timePodData, setTimePodData] = useState(null);
  const [timeHourData, setTimeHourData] = useState(null);
  const [timeframe, setTimeframe] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const load = useCallback(async () => {
    try {
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

      const vehicleURL = rangeQS ? `/vehicle-analytics?${rangeQS.slice(1)}` : '/vehicle-analytics';
      const timePatternsURL = trendQS ? `/time-patterns${trendQS}` : '/time-patterns';

      const [ov, trend, zones, vehicles, timePatterns] = await Promise.all([
        api(overviewURL),
        api(trendURL),
        api(zonesURL),
        api(vehicleURL),
        api(timePatternsURL),
      ]);
      setOverview(ov);

      if (ov.last_scrape) {
        setLastUpdate(ov.last_scrape.finished_at || 'Running...');
      }

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

      if (trend.length > 0) {
        const range = getDateRange(timeframe);
        let monthData;
        if (timeframe === 'custom' && customStart && customEnd) {
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

      // Vehicle chart — now filtered by selected timeframe
      if (vehicles?.length > 0) {
        const top = vehicles.slice(0, 8);
        const vehicleColors = [
          '#ef4444', '#f97316', '#eab308', '#22c55e',
          '#06b6d4', '#a855f7', '#ec4899', '#6366f1',
        ];
        setVehicleData({
          labels: top.map(v => v.vehicle),
          datasets: [
            {
              label: 'Accidents',
              data: top.map(v => v.accidents),
              backgroundColor: vehicleColors.map(c => c + 'cc'),
              borderColor: vehicleColors,
              borderWidth: 1,
            },
            {
              label: 'Deaths',
              data: top.map(v => v.deaths),
              backgroundColor: '#ef444433',
              borderColor: '#ef4444',
              borderWidth: 1,
            },
          ],
        });
      } else {
        setVehicleData(null);
      }

      // Time-of-day patterns — build chart data + insight badges
      const pod = timePatterns?.by_part_of_day || [];
      const byHour = timePatterns?.by_hour || [];

      if (pod.length > 0) {
        const ordered = PART_ORDER.map(p => pod.find(r => r.part_of_day === p) || { part_of_day: p, accidents: 0, deaths: 0 });
        setTimePodData({
          labels: ordered.map(r => `${TIME_BANDS[r.part_of_day].emoji} ${TIME_BANDS[r.part_of_day].label}`),
          datasets: [
            {
              label: 'Accidents',
              data: ordered.map(r => r.accidents),
              backgroundColor: ordered.map(r => TIME_BANDS[r.part_of_day].color + 'cc'),
              borderColor: ordered.map(r => TIME_BANDS[r.part_of_day].color),
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: 'Deaths',
              data: ordered.map(r => r.deaths),
              backgroundColor: '#ef444455',
              borderColor: '#ef4444',
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        });

        const worstPart = pod.reduce((a, b) => (b.accidents > (a?.accidents || 0) ? b : a), null);
        const nightAcc = pod.filter(p => ['night','midnight'].includes(p.part_of_day)).reduce((s, p) => s + p.accidents, 0);
        const totalAcc = pod.reduce((s, p) => s + p.accidents, 0);
        const fmtHour = h => { const s = h < 12 ? 'am' : 'pm'; const l = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${l}${s}`; };
        const peakHour = byHour.length > 0 ? byHour.reduce((a, b) => (b.accidents > (a?.accidents || 0) ? b : a), null) : null;
        setTimeInsights({
          worstPart: worstPart?.part_of_day,
          worstColor: worstPart ? TIME_BANDS[worstPart.part_of_day].color : null,
          worstEmoji: worstPart ? TIME_BANDS[worstPart.part_of_day].emoji : '',
          worstPartCount: worstPart?.accidents || 0,
          peakHour: peakHour ? fmtHour(peakHour.hour) : null,
          peakHourCount: peakHour?.accidents || 0,
          nightPct: totalAcc > 0 ? Math.round((nightAcc / totalAcc) * 100) : 0,
          totalWithTime: totalAcc,
        });
      } else {
        setTimePodData(null);
        setTimeInsights(null);
      }

      if (byHour.length > 0) {
        const allHours = Array.from({ length: 24 }, (_, h) => {
          const entry = byHour.find(r => r.hour === h) || { hour: h, accidents: 0, deaths: 0 };
          const s = h < 12 ? 'am' : 'pm'; const l = h === 0 ? 12 : h > 12 ? h - 12 : h;
          return { ...entry, label: `${l}${s}` };
        });
        const maxAcc = Math.max(...allHours.map(h => h.accidents), 1);
        setTimeHourData({
          labels: allHours.map(h => h.label),
          datasets: [{
            label: 'Accidents by Hour',
            data: allHours.map(h => h.accidents),
            backgroundColor: allHours.map(h => {
              const r = h.accidents / maxAcc;
              if (r > 0.7) return '#ef4444cc';
              if (r > 0.4) return '#f97316cc';
              if (r > 0.15) return '#eab308cc';
              return '#06b6d455';
            }),
            borderWidth: 0,
            borderRadius: 3,
          }],
        });
      } else {
        setTimeHourData(null);
      }
    } catch (err) {
      console.error('Dashboard error:', err);
    }
  }, [setLastUpdate, timeframe, customStart, customEnd]);

  useEffect(() => {
    if (timeframe === 'custom' && (!customStart || !customEnd)) return;
    load(); // eslint-disable-line react-hooks/set-state-in-effect
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

      <div className="charts-grid" style={{ marginTop: '1rem' }}>
        <ChartCard
          title={`Vehicles Involved in Accidents (${trendLabel})`}
          icon={<FaCar />}
          type="bar"
          data={vehicleData}
          fullWidth
          options={{
            indexAxis: 'y',
            plugins: {
              legend: { position: 'top', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
              tooltip: {
                callbacks: {
                  afterLabel: (ctx) => {
                    const v = vehicleData?.datasets[0]?.data;
                    const total = v?.reduce((a, b) => a + b, 0) || 1;
                    return `${((ctx.parsed.x / total) * 100).toFixed(1)}% of total`;
                  },
                },
              },
            },
            scales: {
              x: { stacked: false },
              y: { stacked: false },
            },
          }}
        />
      </div>

      {(timePodData || timeHourData) && (
        <div className="chart-card full-width" style={{ marginTop: '1rem' }}>
          <div className="chart-title">
            <FaClock /> Accidents by Time of Day — {trendLabel}
          </div>

          {/* Insight badges */}
          {timeInsights && (
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
              {timeInsights.worstPart && timeInsights.worstColor && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 12px', borderRadius: '999px', fontSize: '0.78rem',
                  background: timeInsights.worstColor + '22', color: timeInsights.worstColor,
                  border: `1px solid ${timeInsights.worstColor}44`,
                }}>
                  {timeInsights.worstEmoji} <strong style={{ textTransform: 'capitalize' }}>{timeInsights.worstPart}</strong> is worst — {timeInsights.worstPartCount} accidents
                </span>
              )}
              {timeInsights.peakHour && (
                <span className="time-insight-badge">
                  🕐 Peak hour: <strong>{timeInsights.peakHour}</strong> ({timeInsights.peakHourCount} accidents)
                </span>
              )}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '4px 12px', borderRadius: '999px', fontSize: '0.78rem',
                background: TIME_BANDS.night.color + '22', color: TIME_BANDS.night.color,
                border: `1px solid ${TIME_BANDS.night.color}44`,
              }}>
                🌙 <strong>{timeInsights.nightPct}%</strong> of timed accidents occur at night/midnight
              </span>
              <span className="time-insight-badge" style={{ opacity: 0.6 }}>
                {timeInsights.totalWithTime} accidents with time data
              </span>
            </div>
          )}

          {/* Part-of-day grouped bar chart */}
          {timePodData && (
            <div style={{ marginTop: '0.5rem' }}>
              <ChartCard
                title=""
                type="bar"
                data={timePodData}
                fullWidth
                options={{
                  plugins: {
                    legend: { position: 'top', labels: { boxWidth: 10, padding: 8, font: { size: 11 } } },
                  },
                  scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true },
                  },
                }}
              />
            </div>
          )}

          {/* Hour-of-day bar chart */}
          {timeHourData && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                🕐 Accidents by Hour (24h)
              </div>
              <ChartCard
                title=""
                type="bar"
                data={timeHourData}
                fullWidth
                options={{
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { beginAtZero: true },
                  },
                }}
              />
            </div>
          )}

          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            Only accidents where time of occurrence was explicitly reported in the article are included.
          </p>
        </div>
      )}
    </>
  );
}
