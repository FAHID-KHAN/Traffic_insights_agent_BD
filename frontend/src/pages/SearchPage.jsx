import { useState, useCallback, useEffect } from 'react';
import { api, formatDate, COLORS } from '../utils/api';
import {
  FaSearch, FaFilter, FaTimes, FaExternalLinkAlt,
  FaSkullCrossbones, FaUserInjured, FaCarCrash,
  FaMapMarkerAlt, FaClock,
} from 'react-icons/fa';

const TIME_OF_DAY_OPTIONS = [
  { label: 'Any time', value: '' },
  { label: '🌑 Midnight', value: 'midnight' },
  { label: '🌅 Dawn',     value: 'dawn' },
  { label: '☀️ Morning',  value: 'morning' },
  { label: '🌞 Noon',     value: 'noon' },
  { label: '🌤️ Afternoon',value: 'afternoon' },
  { label: '🌆 Evening',  value: 'evening' },
  { label: '🌙 Night',    value: 'night' },
];

const TIME_BADGE_META = {
  midnight:  { emoji: '🌑', color: '#6366f1' },
  dawn:      { emoji: '🌅', color: '#f97316' },
  morning:   { emoji: '☀️', color: '#ca8a04' },
  noon:      { emoji: '🌞', color: '#d97706' },
  afternoon: { emoji: '🌤️', color: '#0891b2' },
  evening:   { emoji: '🌆', color: '#7c3aed' },
  night:     { emoji: '🌙', color: '#2563eb' },
};

function TimeBadge({ part, time }) {
  const meta = TIME_BADGE_META[part];
  if (!meta) return null;
  return (
    <span
      title={time ? `${part} (${time})` : part}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        fontSize: '0.72rem', padding: '1px 6px', borderRadius: '999px',
        background: meta.color + '22', color: meta.color,
        border: `1px solid ${meta.color}44`, whiteSpace: 'nowrap',
      }}
    >
      {meta.emoji} {time || part}
    </span>
  );
}

const SEVERITY_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Fatal (1+ deaths)', value: 'fatal' },
  { label: 'Critical (5+ deaths)', value: 'critical' },
  { label: 'Mass casualty (10+)', value: 'mass' },
  { label: 'Injury only', value: 'injury' },
  { label: 'No casualties', value: 'none' },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('');
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [partOfDay, setPartOfDay] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [types, setTypes] = useState([]);

  // Load district and type lists from DB
  useEffect(() => {
    api('/search/districts')
      .then(setDistricts)
      .catch(() => {});
    api('/search/types')
      .then(setTypes)
      .catch(() => {});
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (district) params.set('district', district);
      if (type) params.set('type', type);
      if (severity) params.set('severity', severity);
      if (partOfDay) params.set('part_of_day', partOfDay);
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      params.set('limit', '100');

      const data = await api(`/search/advanced?${params.toString()}`);
      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, district, type, severity, partOfDay, startDate, endDate]);

  const clearFilters = () => {
    setQuery(''); setDistrict(''); setType('');
    setSeverity(''); setPartOfDay(''); setStartDate(''); setEndDate('');
    setResults([]); setSearched(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') search();
  };

  const totalDeaths = results.reduce((s, r) => s + (r.deaths || 0), 0);
  const totalInjuries = results.reduce((s, r) => s + (r.injuries || 0), 0);
  const hasFilters = query || district || type || severity || partOfDay || startDate || endDate;

  return (
    <div className="search-page">
      <h2 className="page-title">
        <FaSearch className="text-green" /> Advanced Search
      </h2>
      <p className="page-subtitle">
        Search across all accident records with powerful filters. Export results for research.
      </p>

      {/* ── Filter Panel ── */}
      <div className="search-filters">
        <div className="search-main-row">
          <div className="search-input-wrap">
            <FaSearch className="search-input-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by location, vehicle type, keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button className="btn btn-primary" onClick={search} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="search-filter-row">
          <div className="filter-group">
            <label><FaMapMarkerAlt /> District</label>
            <select value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">All districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label><FaCarCrash /> Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label><FaSkullCrossbones /> Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label><FaClock /> Time of Day</label>
            <select value={partOfDay} onChange={(e) => setPartOfDay(e.target.value)}>
              {TIME_OF_DAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="filter-group">
            <label>To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          {hasFilters && (
            <button className="btn btn-outline filter-clear" onClick={clearFilters}>
              <FaTimes /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Results Summary ── */}
      {searched && (
        <div className="search-results-header">
          <div className="search-results-count">
            <span className="search-count-num">{results.length}</span> results found
            {totalDeaths > 0 && (
              <span className="search-stat text-red"><FaSkullCrossbones /> {totalDeaths} deaths</span>
            )}
            {totalInjuries > 0 && (
              <span className="search-stat text-orange"><FaUserInjured /> {totalInjuries} injuries</span>
            )}
          </div>
        </div>
      )}

      {/* ── Results Table ── */}
      {results.length > 0 && (
        <div className="search-results-table">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>District</th>
                  <th>Location</th>
                  <th>Deaths</th>
                  <th>Injuries</th>
                  <th>Summary</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.id || i} className={r.deaths >= 5 ? 'row-critical' : ''}>
                    <td className="td-nowrap">{formatDate(r.accident_date)}</td>
                    <td>
                      {r.part_of_day
                        ? <TimeBadge part={r.part_of_day} time={r.accident_time} />
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {r.accident_type ? (
                        <span className="badge badge-info">{r.accident_type}</span>
                      ) : '—'}
                    </td>
                    <td><strong>{r.district || '—'}</strong></td>
                    <td className="td-location">{r.location_raw || '—'}</td>
                    <td className={r.deaths > 0 ? 'text-red' : ''}>{r.deaths || 0}</td>
                    <td className={r.injuries > 0 ? 'text-orange' : ''}>{r.injuries || 0}</td>
                    <td className="td-summary">{r.summary ? r.summary.substring(0, 90) + '...' : '—'}</td>
                    <td>
                      {r.article_url && (
                        <a href={r.article_url} target="_blank" rel="noreferrer" className="text-cyan">
                          <FaExternalLinkAlt />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {searched && results.length === 0 && !loading && (
        <div className="search-empty-state">
          <FaSearch />
          <h3>No results found</h3>
          <p>No accidents match your filters. Try broadening your search or adjusting the date range.</p>
        </div>
      )}

      {!searched && (
        <div className="search-empty-state">
          <FaSearch />
          <h3>Search accident records</h3>
          <p>Use the filters above to search across {'\u2014'} by district, accident type, severity, date range, or keywords.</p>
        </div>
      )}
    </div>
  );
}
