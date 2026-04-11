import { useState, useCallback, useEffect } from 'react';
import { api, COLORS } from '../utils/api';
import ChartCard from '../components/ChartCard';
import {
  FaBalanceScale, FaArrowUp, FaArrowDown, FaMinus,
  FaChartBar, FaChartLine, FaExchangeAlt, FaCalendarAlt,
  FaSkullCrossbones, FaCarCrash, FaUserInjured, FaHeartbeat,
} from 'react-icons/fa';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function Delta({ val, inverse }) {
  if (val === 0) return <span className="delta neutral"><FaMinus /> 0%</span>;
  const up = val > 0;
  const cls = inverse ? (up ? 'worse' : 'better') : (up ? 'better' : 'worse');
  return (
    <span className={`delta ${cls}`}>
      {up ? <FaArrowUp /> : <FaArrowDown />} {Math.abs(val)}%
    </span>
  );
}

const CARD_META = [
  { key: 'accidents', label: 'Accidents', icon: <FaCarCrash />, color: 'var(--accent-blue)', colorClass: '' },
  { key: 'deaths', label: 'Deaths', icon: <FaSkullCrossbones />, color: 'var(--accent-red)', colorClass: 'text-red' },
  { key: 'injuries', label: 'Injuries', icon: <FaUserInjured />, color: 'var(--accent-orange)', colorClass: 'text-orange' },
  { key: 'fr', label: 'Fatality Rate', icon: <FaHeartbeat />, color: 'var(--accent-purple)', colorClass: 'text-purple' },
];

export default function Compare() {
  const now = new Date();
  const [mode, setMode] = useState('monthly');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year1, setYear1] = useState(now.getFullYear() - 1);
  const [year2, setYear2] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'monthly') {
        const d = await api(`/compare/monthly?month=${month}&year1=${year1}&year2=${year2}`);
        setData(d);
      } else {
        const d = await api(`/compare/yearly?year1=${year1}&year2=${year2}`);
        setData(d);
      }
    } catch (e) {
      console.error('Compare error:', e);
    } finally {
      setLoading(false);
    }
  }, [mode, month, year1, year2]);

  useEffect(() => { load(); }, [load]);

  const pct = (a, b) => {
    if (b === 0) return a > 0 ? 100 : 0;
    return Math.round(((a - b) / b) * 100);
  };

  const d1 = data?.[String(year1)];
  const d2 = data?.[String(year2)];

  // Build values for cards
  const cardValues = d1 && d2 ? CARD_META.map((c) => {
    if (c.key === 'fr') {
      const v1 = d1.accidents ? (d1.deaths / d1.accidents).toFixed(2) : '—';
      const v2 = d2.accidents ? (d2.deaths / d2.accidents).toFixed(2) : '—';
      return { ...c, v1, v2, delta: null };
    }
    return { ...c, v1: d1[c.key], v2: d2[c.key], delta: pct(d2[c.key], d1[c.key]) };
  }) : [];

  // Build comparison charts
  let trendChart = null;
  let typeChart = null;
  let districtChart = null;

  if (d1 && d2) {
    if (mode === 'monthly' && d1.daily && d2.daily) {
      const days = Array.from({ length: 31 }, (_, i) => i + 1);
      const map1 = Object.fromEntries(d1.daily.map((r) => [r.day, r]));
      const map2 = Object.fromEntries(d2.daily.map((r) => [r.day, r]));
      trendChart = {
        labels: days.map((d) => d),
        datasets: [
          {
            label: `${MONTHS[month - 1]} ${year1}`,
            data: days.map((d) => map1[d]?.accidents || 0),
            borderColor: COLORS[0], backgroundColor: COLORS[0] + '20',
            fill: true, tension: 0.3,
          },
          {
            label: `${MONTHS[month - 1]} ${year2}`,
            data: days.map((d) => map2[d]?.accidents || 0),
            borderColor: COLORS[1], backgroundColor: COLORS[1] + '20',
            fill: true, tension: 0.3,
          },
        ],
      };
    } else if (mode === 'yearly' && d1.by_month && d2.by_month) {
      const map1 = Object.fromEntries(d1.by_month.map((r) => [r.month, r]));
      const map2 = Object.fromEntries(d2.by_month.map((r) => [r.month, r]));
      trendChart = {
        labels: MONTHS.map((m) => m.substring(0, 3)),
        datasets: [
          {
            label: String(year1),
            data: MONTHS.map((_, i) => map1[i + 1]?.accidents || 0),
            borderColor: COLORS[0], backgroundColor: COLORS[0] + '20',
            fill: true, tension: 0.3,
          },
          {
            label: String(year2),
            data: MONTHS.map((_, i) => map2[i + 1]?.accidents || 0),
            borderColor: COLORS[1], backgroundColor: COLORS[1] + '20',
            fill: true, tension: 0.3,
          },
        ],
      };
    }

    if (mode === 'monthly' && d1.by_type?.length && d2.by_type?.length) {
      const allTypes = [...new Set([...d1.by_type.map((t) => t.accident_type), ...d2.by_type.map((t) => t.accident_type)])].slice(0, 8);
      const m1 = Object.fromEntries(d1.by_type.map((t) => [t.accident_type, t.count]));
      const m2 = Object.fromEntries(d2.by_type.map((t) => [t.accident_type, t.count]));
      typeChart = {
        labels: allTypes.map((t) => t || 'Unknown'),
        datasets: [
          { label: String(year1), data: allTypes.map((t) => m1[t] || 0), backgroundColor: COLORS[0] + '90', borderColor: COLORS[0], borderWidth: 1 },
          { label: String(year2), data: allTypes.map((t) => m2[t] || 0), backgroundColor: COLORS[1] + '90', borderColor: COLORS[1], borderWidth: 1 },
        ],
      };
    }

    if (mode === 'monthly' && d1.by_district?.length && d2.by_district?.length) {
      const allD = [...new Set([...d1.by_district.map((d) => d.district), ...d2.by_district.map((d) => d.district)])].slice(0, 8);
      const m1 = Object.fromEntries(d1.by_district.map((d) => [d.district, d.deaths]));
      const m2 = Object.fromEntries(d2.by_district.map((d) => [d.district, d.deaths]));
      districtChart = {
        labels: allD,
        datasets: [
          { label: `${year1} Deaths`, data: allD.map((d) => m1[d] || 0), backgroundColor: COLORS[0] + '90', borderColor: COLORS[0], borderWidth: 1 },
          { label: `${year2} Deaths`, data: allD.map((d) => m2[d] || 0), backgroundColor: COLORS[1] + '90', borderColor: COLORS[1], borderWidth: 1 },
        ],
      };
    }
  }

  const periodLabel = mode === 'monthly'
    ? `${MONTHS[month - 1]}`
    : 'Full Year';

  return (
    <div className="compare-page">
      <h2 className="page-title">
        <FaBalanceScale className="text-green" /> Comparative Analytics
      </h2>
      <p className="page-subtitle">
        Compare accident statistics across different time periods to identify trends and changes.
      </p>

      {/* ── Controls ── */}
      <div className="compare-controls">
        <div className="compare-mode">
          <button className={`tf-chip${mode === 'monthly' ? ' active' : ''}`} onClick={() => setMode('monthly')}>
            <FaCalendarAlt /> Month vs Month
          </button>
          <button className={`tf-chip${mode === 'yearly' ? ' active' : ''}`} onClick={() => setMode('yearly')}>
            <FaChartBar /> Year vs Year
          </button>
        </div>

        <div className="compare-divider" />

        <div className="compare-selectors">
          {mode === 'monthly' && (
            <select value={month} onChange={(e) => setMonth(+e.target.value)}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          )}
          <div className="compare-years">
            <input type="number" value={year1} onChange={(e) => setYear1(+e.target.value)} min={2015} max={2030} />
            <span className="compare-vs">VS</span>
            <input type="number" value={year2} onChange={(e) => setYear2(+e.target.value)} min={2015} max={2030} />
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {cardValues.length > 0 && (
        <div className="compare-summary">
          {cardValues.map((c) => (
            <div className="compare-card" key={c.key}>
              <div className="compare-card-icon" style={{ color: c.color }}>{c.icon}</div>
              <div className="compare-card-label">{c.label}</div>
              <div className="compare-card-body">
                <div className="compare-side">
                  <span className="compare-year-tag">{year1}</span>
                  <span className={`compare-num ${c.colorClass}`}>{c.v1}</span>
                </div>
                <div className="compare-vs-divider">
                  <FaExchangeAlt />
                </div>
                <div className="compare-side">
                  <span className="compare-year-tag">{year2}</span>
                  <span className={`compare-num ${c.colorClass}`}>{c.v2}</span>
                </div>
              </div>
              <div className="compare-card-footer">
                {c.delta !== null ? (
                  <>Change: <Delta val={c.delta} inverse /></>
                ) : (
                  <span className="compare-fr-label">Deaths per accident</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts ── */}
      {!loading && d1 && d2 && (
        <div className="compare-charts">
          {trendChart && (
            <ChartCard
              title={`${periodLabel} Accident Trend: ${year1} vs ${year2}`}
              icon={<FaChartLine />} type="line" data={trendChart} fullWidth
            />
          )}
          {(typeChart || districtChart) && (
            <div className="compare-charts-row">
              {typeChart && (
                <ChartCard
                  title={`Accident Type Comparison`}
                  icon={<FaChartBar />} type="bar" data={typeChart}
                  options={{ plugins: { legend: { position: 'top' } } }}
                />
              )}
              {districtChart && (
                <ChartCard
                  title={`Deaths by District`}
                  icon={<FaChartBar />} type="bar" data={districtChart}
                  options={{ indexAxis: 'y', plugins: { legend: { position: 'top' } } }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {loading && <div className="loading"><FaChartLine className="spin" /> Loading comparison data...</div>}
    </div>
  );
}
