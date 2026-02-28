import { useState, useCallback, useEffect } from 'react';
import { api, formatDate, COLORS } from '../utils/api';
import {
  FaSearch, FaFilter, FaTimes, FaExternalLinkAlt,
  FaSkullCrossbones, FaUserInjured, FaCarCrash,
  FaDownload, FaMapMarkerAlt,
} from 'react-icons/fa';

const TYPES = [
  '', 'Bus accident', 'Truck accident', 'Motorcycle accident',
  'Auto-rickshaw accident', 'Train accident', 'Pedestrian accident',
  'Multi-vehicle collision', 'Road accident',
];

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [districts, setDistricts] = useState([]);

  // Load district list
  useEffect(() => {
    api('/danger-zones?limit=100')
      .then((data) => {
        const dList = [...new Set(data.map((d) => d.district).filter(Boolean))].sort();
        setDistricts(dList);
      })
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
  }, [query, district, type, severity, startDate, endDate]);

  const clearFilters = () => {
    setQuery(''); setDistrict(''); setType('');
    setSeverity(''); setStartDate(''); setEndDate('');
    setResults([]); setSearched(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') search();
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    const headers = ['Date', 'Type', 'District', 'Division', 'Location', 'Deaths', 'Injuries', 'Vehicles', 'Summary'];
    const rows = results.map((r) => [
      r.accident_date || '', r.accident_type || '', r.district || '',
      r.division || '', r.location_raw || '', r.deaths || 0,
      r.injuries || 0, r.vehicles_involved || '', (r.summary || '').replace(/,/g, ';'),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traffic_insight_bd_search_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalDeaths = results.reduce((s, r) => s + (r.deaths || 0), 0);
  const totalInjuries = results.reduce((s, r) => s + (r.injuries || 0), 0);
  const hasFilters = query || district || type || severity || startDate || endDate;

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
              {TYPES.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label><FaSkullCrossbones /> Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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
          {results.length > 0 && (
            <button className="btn btn-outline" onClick={exportCSV}>
              <FaDownload /> Export CSV
            </button>
          )}
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
        <div className="empty-state">
          <FaSearch />
          <p>No accidents match your filters. Try broadening your search.</p>
        </div>
      )}
    </div>
  );
}
