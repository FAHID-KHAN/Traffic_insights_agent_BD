import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api, adminGet, adminPost } from '../utils/api';
import {
  FaHeartbeat, FaDatabase, FaRobot, FaClock, FaSync, FaKey,
  FaPlay, FaCalendarAlt, FaHdd, FaCheckCircle, FaTimesCircle,
  FaExclamationTriangle, FaSignOutAlt, FaShieldAlt, FaFileDownload,
  FaDownload, FaLock, FaSpinner, FaFilter, FaCodeBranch,
  FaEdit, FaQuestionCircle,
} from 'react-icons/fa';

const ADMIN_KEY_STORAGE = 'tibd-admin-key';

const DECISION_META = {
  inserted_no_same_district_candidate: { label: 'Inserted (New)',      color: '#22c55e', short: 'New' },
  updated_existing:                    { label: 'Updated (Merged)',     color: '#06b6d4', short: 'Updated' },
  inserted_ambiguous_possible_duplicate:{ label: 'Ambiguous Insert',   color: '#f97316', short: 'Ambiguous' },
};

const REASON_META = {
  outside_bangladesh:    { label: 'Outside BD',    color: '#3b82f6' },
  non_incident_report:   { label: 'Non-Incident',  color: '#eab308' },
  time_window_roundup:   { label: 'Time Roundup',  color: '#a855f7' },
  aggregate_or_historical:{ label: 'Aggregate',    color: '#6366f1' },
  empty_payload:         { label: 'Empty',          color: '#94a3b8' },
  casualty_outlier:      { label: 'Outlier',        color: '#ef4444' },
  no_concrete_incident:  { label: 'No Incident',   color: '#6b7280' },
};

function StatusDot({ status }) {
  const color = status === 'completed' ? '#22c55e' : status === 'running' ? '#eab308' : '#ef4444';
  return <span className="admin-status-dot" style={{ background: color }} />;
}

function ReasonBadge({ reason }) {
  const m = REASON_META[reason] || { label: reason, color: '#94a3b8' };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
      background: m.color + '22', color: m.color, border: `1px solid ${m.color}44`,
    }}>
      {m.label}
    </span>
  );
}

function DecisionBadge({ decision }) {
  const m = DECISION_META[decision] || { label: decision, color: '#94a3b8', short: decision };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
      background: m.color + '22', color: m.color, border: `1px solid ${m.color}44`,
    }}>
      {m.short}
    </span>
  );
}

function SignalBadges({ signals }) {
  if (!signals?.length) return <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
      {signals.map(s => (
        <span key={s} style={{
          padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem',
          background: 'rgba(6,182,212,0.1)', color: 'var(--accent-cyan)',
          border: '1px solid rgba(6,182,212,0.2)',
        }}>
          {s.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function duration(a, b) {
  if (!a || !b) return '—';
  const ms = new Date(b) - new Date(a);
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/* ── Auth Gate ─────────────────────────────────────────────── */
function AdminLogin({ onAuth }) {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setChecking(true); setError('');
    try {
      await adminPost('/scrape', key.trim());
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
      onAuth(key.trim());
    } catch (err) {
      if (err.message.includes('Invalid admin key') || err.message.includes('403')) {
        setError(t('health.invalidKey'));
      } else {
        sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
        onAuth(key.trim());
      }
    } finally { setChecking(false); }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-icon"><FaShieldAlt /></div>
        <h2>{t('health.adminTitle')}</h2>
        <p className="admin-login-desc">{t('health.adminDesc')}</p>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-input-group">
            <FaKey className="admin-input-icon" />
            <input type="password" value={key} onChange={e => setKey(e.target.value)}
              placeholder={t('health.enterKey')} className="admin-input" autoFocus />
          </div>
          {error && <p className="admin-error"><FaExclamationTriangle /> {error}</p>}
          <button type="submit" className="admin-login-btn" disabled={checking || !key.trim()}>
            {checking ? <><FaSpinner className="spin" /> {t('health.verifying')}</> : <><FaLock /> {t('health.authenticate')}</>}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Tab Bar ───────────────────────────────────────────────── */
const TABS = [
  { key: 'overview',    label: 'Overview',      icon: <FaHeartbeat /> },
  { key: 'scan-logs',   label: 'Scan Logs',     icon: <FaClock /> },
  { key: 'discard-log', label: 'Discard Log',   icon: <FaTimesCircle /> },
  { key: 'dedupe-log',  label: 'Dedupe Decisions', icon: <FaCodeBranch /> },
  { key: 'update-events',label: 'Update Events', icon: <FaEdit /> },
  { key: 'ambiguity',   label: 'Ambiguity',     icon: <FaQuestionCircle /> },
];

/* ── Admin Dashboard ───────────────────────────────────────── */
export default function Health() {
  const { t } = useTranslation();
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || '');
  const [activeTab, setActiveTab] = useState('overview');

  // Overview data
  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [logStats, setLogStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  // Per-tab data (lazy loaded)
  const [scanLogs, setScanLogs] = useState(null);
  const [discardLog, setDiscardLog] = useState(null);
  const [dedupeLog, setDedupeLog] = useState(null);
  const [updateEvents, setUpdateEvents] = useState(null);
  const [ambiguityLog, setAmbiguityLog] = useState(null);

  // Per-tab filters
  const [discardReason, setDiscardReason] = useState('');
  const [dedupeDecision, setDedupeDecision] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      const [ov, hl, ls] = await Promise.all([
        api('/overview'),
        api('/health-check'),
        adminGet('/admin/log-stats', adminKey),
      ]);
      setOverview(ov);
      setHealth(hl);
      setLogStats(ls);
    } catch (err) {
      console.error('Health overview error:', err);
    } finally { setLoading(false); }
  }, [adminKey]);

  const loadTab = useCallback(async (tab) => {
    try {
      if (tab === 'scan-logs' && !scanLogs) {
        setScanLogs(await adminGet('/scrape-logs?limit=50', adminKey));
      }
      if (tab === 'discard-log') {
        const qs = discardReason ? `&reason=${discardReason}` : '';
        setDiscardLog(await adminGet(`/admin/discard-log?limit=100${qs}`, adminKey));
      }
      if (tab === 'dedupe-log') {
        const qs = dedupeDecision ? `&decision=${encodeURIComponent(dedupeDecision)}` : '';
        setDedupeLog(await adminGet(`/admin/dedupe-decisions?limit=100${qs}`, adminKey));
      }
      if (tab === 'update-events' && !updateEvents) {
        setUpdateEvents(await adminGet('/admin/update-events?limit=100', adminKey));
      }
      if (tab === 'ambiguity' && !ambiguityLog) {
        setAmbiguityLog(await adminGet('/admin/dedupe-ambiguity?limit=100', adminKey));
      }
    } catch (err) {
      console.error(`Tab ${tab} load error:`, err);
    }
  }, [adminKey, scanLogs, updateEvents, ambiguityLog, discardReason, dedupeDecision]);

  useEffect(() => {
    if (!adminKey) return;
    loadOverview();
    const id = setInterval(loadOverview, 30000);
    return () => clearInterval(id);
  }, [adminKey, loadOverview]);

  useEffect(() => {
    if (!adminKey) return;
    loadTab(activeTab);
  }, [activeTab, adminKey, loadTab]);

  // Re-fetch filtered logs when filters change
  useEffect(() => {
    if (activeTab === 'discard-log' && adminKey) loadTab('discard-log');
  }, [discardReason]);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'dedupe-log' && adminKey) loadTab('dedupe-log');
  }, [dedupeDecision]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleScrape = async () => {
    setScraping(true); setActionResult(null);
    try {
      await adminPost('/scrape', adminKey);
      setActionResult({ type: 'success', msg: t('health.scrapeTriggered') });
      setTimeout(loadOverview, 2000);
    } catch (err) { setActionResult({ type: 'error', msg: err.message }); }
    finally { setScraping(false); }
  };

  const handleBackfill = async () => {
    setBackfilling(true); setActionResult(null);
    try {
      await adminPost('/backfill-published-dates', adminKey);
      setActionResult({ type: 'success', msg: t('health.backfillTriggered') });
    } catch (err) { setActionResult({ type: 'error', msg: err.message }); }
    finally { setBackfilling(false); }
  };

  const handleLogout = () => { sessionStorage.removeItem(ADMIN_KEY_STORAGE); setAdminKey(''); };

  if (!adminKey) return <AdminLogin onAuth={setAdminKey} />;
  if (loading) return <div className="page-loader"><div className="page-loader-spinner" /><p>{t('app.loading')}</p></div>;

  const lastScrape = overview?.last_scrape;
  const now = new Date();

  return (
    <div className="health-page admin-panel">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-left">
          <h2 className="page-title"><FaShieldAlt className="text-green" /> {t('health.adminTitle')}</h2>
          <span className="admin-badge"><FaCheckCircle /> {t('health.authenticated')}</span>
        </div>
        <button className="admin-logout-btn" onClick={handleLogout}>
          <FaSignOutAlt /> {t('health.logout')}
        </button>
      </div>
      <p className="page-subtitle">{t('health.adminSubtitle')}</p>

      {actionResult && (
        <div className={`admin-toast admin-toast-${actionResult.type}`}>
          {actionResult.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
          <span>{actionResult.msg}</span>
          <button onClick={() => setActionResult(null)}>×</button>
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div className="admin-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`admin-tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ════ OVERVIEW ════ */}
      {activeTab === 'overview' && (
        <>
          {/* Actions */}
          <div className="admin-actions-bar">
            <h3><FaPlay /> {t('health.adminActions')}</h3>
            <div className="admin-actions-grid">
              <button className="admin-action-btn admin-action-scrape" onClick={handleScrape} disabled={scraping}>
                {scraping ? <FaSpinner className="spin" /> : <FaSync />}
                <div><strong>{t('health.triggerScrape')}</strong><small>{t('health.triggerScrapeDesc')}</small></div>
              </button>
              <button className="admin-action-btn admin-action-backfill" onClick={handleBackfill} disabled={backfilling}>
                {backfilling ? <FaSpinner className="spin" /> : <FaCalendarAlt />}
                <div><strong>{t('health.backfillDates')}</strong><small>{t('health.backfillDatesDesc')}</small></div>
              </button>
              <button className="admin-action-btn admin-action-pdf" onClick={() => window.open(`/api/reports/monthly-pdf?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, '_blank')}>
                <FaFileDownload />
                <div><strong>{t('health.downloadReport')}</strong><small>{t('health.downloadReportDesc', { month: now.getMonth() + 1, year: now.getFullYear() })}</small></div>
              </button>
              <button className="admin-action-btn admin-action-csv" onClick={() => window.open('/api/export/csv', '_blank')}>
                <FaDownload />
                <div><strong>{t('health.exportCsv')}</strong><small>{t('health.exportCsvDesc')}</small></div>
              </button>
            </div>
          </div>

          {/* System Metrics */}
          <div className="health-grid">
            <div className="health-card">
              <h3><FaSync /> {t('health.scrapeStatus')}</h3>
              <div className="health-stats">
                <div className="health-stat"><span className="health-stat-label">{t('health.lastScrape')}</span>
                  <span className="health-stat-value">{lastScrape ? <><StatusDot status={lastScrape.status} /> {lastScrape.finished_at ? fmt(lastScrape.finished_at) : t('health.running')}</> : '—'}</span>
                </div>
                <div className="health-stat"><span className="health-stat-label">{t('health.totalScrapes')}</span>
                  <span className="health-stat-value">{health?.total_scrapes || 0}</span>
                </div>
                <div className="health-stat"><span className="health-stat-label">{t('health.successRate')}</span>
                  <span className="health-stat-value" style={{ color: (health?.success_rate || 0) >= 80 ? '#22c55e' : '#eab308' }}>
                    {health?.success_rate || 0}%
                  </span>
                </div>
                <div className="health-stat"><span className="health-stat-label">{t('health.failedScrapes')}</span>
                  <span className="health-stat-value">{health?.total_scrapes - health?.successful_scrapes || 0}</span>
                </div>
              </div>
            </div>

            <div className="health-card">
              <h3><FaDatabase /> {t('health.dataFreshness')}</h3>
              <div className="health-stats">
                <div className="health-stat"><span className="health-stat-label">{t('health.totalRecords')}</span>
                  <span className="health-stat-value">{health?.total_accidents || 0}</span>
                </div>
                <div className="health-stat"><span className="health-stat-label">{t('health.articlesCollected')}</span>
                  <span className="health-stat-value">{health?.total_articles || 0}</span>
                </div>
                <div className="health-stat"><span className="health-stat-label">{t('health.extractionMode')}</span>
                  <span className="health-stat-value"><FaRobot style={{ marginRight: 4 }} />
                    {health?.extraction_mode === 'advanced' ? t('app.aiPowered') : t('app.standard')}
                  </span>
                </div>
                <div className="health-stat"><span className="health-stat-label">{t('health.dbSize')}</span>
                  <span className="health-stat-value"><FaHdd style={{ marginRight: 4 }} />{health?.db_size_mb || 0} MB</span>
                </div>
              </div>
            </div>

            <div className="health-card">
              <h3><FaCalendarAlt /> {t('health.dateRange')}</h3>
              <div className="health-stats">
                <div className="health-stat"><span className="health-stat-label">{t('health.lastArticleDate')}</span>
                  <span className="health-stat-value">{health?.latest_article_date || '—'}</span>
                </div>
                <div className="health-stat"><span className="health-stat-label">{t('health.oldestArticle')}</span>
                  <span className="health-stat-value">{health?.oldest_article_date || '—'}</span>
                </div>
                <div className="health-stat"><span className="health-stat-label">{t('health.todayAccidents')}</span>
                  <span className="health-stat-value">{overview?.today?.accidents || 0}</span>
                </div>
                <div className="health-stat"><span className="health-stat-label">{t('health.todayDeaths')}</span>
                  <span className="health-stat-value" style={{ color: (overview?.today?.deaths || 0) > 0 ? '#ef4444' : '#22c55e' }}>
                    {overview?.today?.deaths || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Log Stats Summary */}
          {logStats && (
            <div className="health-card" style={{ marginTop: '1.5rem' }}>
              <h3><FaFilter /> Pipeline Log Summary</h3>
              <div className="health-grid" style={{ marginTop: '1rem' }}>
                <div className="health-card" style={{ background: 'var(--bg-secondary)' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Discarded Articles ({logStats.total_discards})</h4>
                  {Object.entries(logStats.discard_by_reason || {}).map(([r, n]) => (
                    <div key={r} className="health-stat">
                      <span className="health-stat-label"><ReasonBadge reason={r} /></span>
                      <span className="health-stat-value">{n}</span>
                    </div>
                  ))}
                </div>
                <div className="health-card" style={{ background: 'var(--bg-secondary)' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Dedupe Decisions ({logStats.total_dedupe_decisions})</h4>
                  {Object.entries(logStats.decision_by_type || {}).map(([d, n]) => (
                    <div key={d} className="health-stat">
                      <span className="health-stat-label"><DecisionBadge decision={d} /></span>
                      <span className="health-stat-value">{n}</span>
                    </div>
                  ))}
                </div>
                <div className="health-card" style={{ background: 'var(--bg-secondary)' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Other Events</h4>
                  <div className="health-stat"><span className="health-stat-label">Ambiguous inserts</span>
                    <span className="health-stat-value" style={{ color: '#f97316' }}>{logStats.ambiguous_count}</span>
                  </div>
                  <div className="health-stat"><span className="health-stat-label">Records updated</span>
                    <span className="health-stat-value" style={{ color: '#06b6d4' }}>{logStats.update_count}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════ SCAN LOGS ════ */}
      {activeTab === 'scan-logs' && (
        <div className="health-card" style={{ marginTop: '1rem' }}>
          <div className="admin-card-header">
            <h3><FaClock /> {t('health.recentScrapes')}</h3>
            <button className="admin-refresh-btn" onClick={() => { setScanLogs(null); loadTab('scan-logs'); }}>
              <FaSync /> {t('health.refresh')}
            </button>
          </div>
          <div className="health-table-wrap">
            <table className="health-table">
              <thead><tr>
                <th>#</th><th>Status</th><th>Started</th><th>Finished</th>
                <th>Found</th><th>New</th><th>Duration</th>
              </tr></thead>
              <tbody>
                {(scanLogs || []).map(log => (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td><StatusDot status={log.status} /> {log.status}</td>
                    <td>{fmt(log.started_at)}</td>
                    <td>{fmt(log.finished_at)}</td>
                    <td>{log.articles_found}</td>
                    <td>{log.articles_new}</td>
                    <td>{duration(log.started_at, log.finished_at)}</td>
                  </tr>
                ))}
                {!scanLogs?.length && <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.5 }}>{t('common.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ DISCARD LOG ════ */}
      {activeTab === 'discard-log' && (
        <div className="health-card" style={{ marginTop: '1rem' }}>
          <div className="admin-card-header">
            <h3><FaTimesCircle /> Discard Log <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>Articles filtered out by the AI pipeline</span></h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select value={discardReason} onChange={e => setDiscardReason(e.target.value)}
                style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>
                <option value="">All reasons</option>
                {Object.entries(REASON_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button className="admin-refresh-btn" onClick={() => setDiscardLog(null)}><FaSync /></button>
            </div>
          </div>
          <div className="health-table-wrap">
            <table className="health-table">
              <thead><tr>
                <th>Time</th><th>Reason</th><th>Title</th><th>Skip Reason</th>
              </tr></thead>
              <tbody>
                {(discardLog || []).map((row, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{fmt(row.timestamp)}</td>
                    <td><ReasonBadge reason={row.reason} /></td>
                    <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}
                      title={row.title}>{row.title || row.event?.summary || '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={row.skip_reason}>{row.skip_reason || '—'}</td>
                  </tr>
                ))}
                {!discardLog?.length && <tr><td colSpan={4} style={{ textAlign: 'center', opacity: 0.5 }}>No discards logged yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ DEDUPE DECISIONS ════ */}
      {activeTab === 'dedupe-log' && (
        <div className="health-card" style={{ marginTop: '1rem' }}>
          <div className="admin-card-header">
            <h3><FaCodeBranch /> Dedupe Decisions <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>Every insert / update / ambiguous decision</span></h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select value={dedupeDecision} onChange={e => setDedupeDecision(e.target.value)}
                style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>
                <option value="">All decisions</option>
                {Object.entries(DECISION_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button className="admin-refresh-btn" onClick={() => setDedupeLog(null)}><FaSync /></button>
            </div>
          </div>
          <div className="health-table-wrap">
            <table className="health-table">
              <thead><tr>
                <th>Time</th><th>Decision</th><th>Score</th><th>District</th><th>Summary</th><th>Signals</th>
              </tr></thead>
              <tbody>
                {(dedupeLog || []).map((row, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{fmt(row.timestamp)}</td>
                    <td><DecisionBadge decision={row.decision} /></td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: row.score >= 80 ? '#22c55e' : row.score >= 50 ? '#f97316' : 'var(--text-muted)' }}>
                      {row.score ?? '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{row.current_event?.district || '—'}</td>
                    <td style={{ fontSize: '0.75rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={row.current_event?.summary}>{row.current_event?.summary || '—'}</td>
                    <td><SignalBadges signals={row.matched_signals} /></td>
                  </tr>
                ))}
                {!dedupeLog?.length && <tr><td colSpan={6} style={{ textAlign: 'center', opacity: 0.5 }}>No decisions logged yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ UPDATE EVENTS ════ */}
      {activeTab === 'update-events' && (
        <div className="health-card" style={{ marginTop: '1rem' }}>
          <div className="admin-card-header">
            <h3><FaEdit /> Update Events <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>Records merged by the dedupe pipeline</span></h3>
            <button className="admin-refresh-btn" onClick={() => setUpdateEvents(null)}><FaSync /></button>
          </div>
          <div className="health-table-wrap">
            <table className="health-table">
              <thead><tr>
                <th>Time</th><th>Accident #</th><th>District</th><th>Score</th>
                <th>Before Deaths / Injuries</th><th>After Deaths / Injuries</th><th>Signals</th>
              </tr></thead>
              <tbody>
                {(updateEvents || []).map((row, i) => {
                  const before = row.merge_result?.before;
                  const after = row.merge_result?.after;
                  return (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{fmt(row.timestamp)}</td>
                      <td style={{ fontWeight: 700 }}>#{row.merge_result?.accident_id ?? '—'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{row.current_event?.district || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#22c55e' }}>{row.score ?? '—'}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <span className="text-red">{before?.deaths ?? '—'}</span> / <span className="text-orange">{before?.injuries ?? '—'}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <span className="text-red">{after?.deaths ?? '—'}</span> / <span className="text-orange">{after?.injuries ?? '—'}</span>
                      </td>
                      <td><SignalBadges signals={row.matched_signals} /></td>
                    </tr>
                  );
                })}
                {!updateEvents?.length && <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.5 }}>No update events yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ AMBIGUITY LOG ════ */}
      {activeTab === 'ambiguity' && (
        <div className="health-card" style={{ marginTop: '1rem' }}>
          <div className="admin-card-header">
            <h3><FaQuestionCircle /> Ambiguity Log <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>Possible duplicates inserted with low confidence — review manually</span></h3>
            <button className="admin-refresh-btn" onClick={() => setAmbiguityLog(null)}><FaSync /></button>
          </div>
          <div className="health-table-wrap">
            <table className="health-table">
              <thead><tr>
                <th>Time</th><th>Score</th><th>District</th>
                <th>New Summary</th><th>Existing Summary</th><th>Signals</th>
              </tr></thead>
              <tbody>
                {(ambiguityLog || []).map((row, i) => (
                  <tr key={i} style={{ background: 'rgba(249,115,22,0.04)' }}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{fmt(row.timestamp)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#f97316' }}>{row.score ?? '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{row.current_event?.district || '—'}</td>
                    <td style={{ fontSize: '0.75rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={row.current_event?.summary}>{row.current_event?.summary || '—'}</td>
                    <td style={{ fontSize: '0.75rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={row.existing_candidate?.summary}>{row.existing_candidate?.summary || '—'}</td>
                    <td><SignalBadges signals={row.matched_signals} /></td>
                  </tr>
                ))}
                {!ambiguityLog?.length && <tr><td colSpan={6} style={{ textAlign: 'center', opacity: 0.5 }}>No ambiguous decisions logged</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
