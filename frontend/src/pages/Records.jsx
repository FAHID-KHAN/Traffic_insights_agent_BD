import { useState, useEffect, useCallback, useRef } from 'react';
import { api, formatDate } from '../utils/api';
import { FaDatabase, FaSearch, FaExternalLinkAlt } from 'react-icons/fa';

export default function Records() {
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState('');
  const timerRef = useRef(null);

  const load = useCallback(async (q) => {
    try {
      const data = q && q.length >= 2
        ? await api(`/search?q=${encodeURIComponent(q)}&limit=100`)
        : await api('/recent?limit=100');
      setRecords(data);
    } catch (err) {
      console.error('Records error:', err);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(''); }, [load]);

  const handleSearch = (val) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => load(val), 400);
  };

  return (
    <div className="table-container">
      <div className="table-header">
        <h3><FaDatabase /> Accident Records</h3>
        <div className="search-box">
          <FaSearch />
          <input
            type="text"
            placeholder="Search by location, type..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Location</th>
              <th>District</th>
              <th>Deaths</th>
              <th>Injuries</th>
              <th>Vehicles</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No records found
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <tr key={i}>
                  <td>{formatDate(r.accident_date)}</td>
                  <td>{r.accident_type ? <span className="badge badge-info">{r.accident_type}</span> : '—'}</td>
                  <td>{r.location_raw || '—'}</td>
                  <td><strong>{r.district || '—'}</strong></td>
                  <td className={r.deaths > 0 ? 'text-red' : ''}>{r.deaths || 0}</td>
                  <td className={r.injuries > 0 ? 'text-orange' : ''}>{r.injuries || 0}</td>
                  <td style={{ fontSize: '0.78rem' }}>{r.vehicles_involved || '—'}</td>
                  <td>
                    {r.article_url ? (
                      <a href={r.article_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontSize: '0.78rem' }}>
                        <FaExternalLinkAlt />
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
