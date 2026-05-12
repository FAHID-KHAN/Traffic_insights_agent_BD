import { useState, useEffect, useCallback, useRef } from 'react';
import { api, formatDate } from '../utils/api';
import { FaDatabase, FaSearch, FaExternalLinkAlt, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const PAGE_SIZE = 50;

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
  if (!meta) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
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

export default function Records() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const timerRef = useRef(null);

  const load = useCallback(async (q, p) => {
    try {
      const offset = p * PAGE_SIZE;
      const qParam = q && q.length >= 2 ? `&q=${encodeURIComponent(q)}` : '';
      const data = await api(`/records?limit=${PAGE_SIZE}&offset=${offset}${qParam}`);
      setRecords(data.records);
      setTotal(data.total);
    } catch (err) {
      console.error('Records error:', err);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load('', 0); }, [load]);

  const handleSearch = (val) => {
    setQuery(val);
    setPage(0);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => load(val, 0), 400);
  };

  const goPage = (p) => {
    setPage(p);
    load(query, p);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="table-container">
      <div className="table-header">
        <h3><FaDatabase /> Accident Records</h3>
        <div className="records-meta">
          <span className="records-count">{total.toLocaleString()} total records</span>
        </div>
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
              <th>Time</th>
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
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No records found
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <tr key={i}>
                  <td>{formatDate(r.accident_date)}</td>
                  <td><TimeBadge part={r.part_of_day} time={r.accident_time} /></td>
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
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm" disabled={page === 0} onClick={() => goPage(page - 1)}>
            <FaChevronLeft /> Prev
          </button>
          <span className="pagination-info">
            Page {page + 1} of {totalPages}
          </span>
          <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => goPage(page + 1)}>
            Next <FaChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
