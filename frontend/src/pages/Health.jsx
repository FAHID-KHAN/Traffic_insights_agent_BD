import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api, adminPost } from '../utils/api';
import {
  FaHeartbeat, FaDatabase, FaRobot, FaClock, FaSync, FaKey,
  FaPlay, FaCalendarAlt, FaHdd, FaCheckCircle, FaTimesCircle,
  FaExclamationTriangle, FaSignOutAlt, FaShieldAlt, FaFileDownload, FaDownload,
  FaLock, FaSpinner,
} from 'react-icons/fa';

const ADMIN_KEY_STORAGE = 'tibd-admin-key';

function StatusDot({ status }) {
  const color = status === 'completed' ? '#22c55e' : status === 'running' ? '#eab308' : '#ef4444';
  return <span className="admin-status-dot" style={{ background: color }} />;
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
    setChecking(true);
    setError('');
    try {
      // Validate key by hitting health-check (public) then try a lightweight admin call
      await adminPost('/scrape', key.trim());
      // If we get here the key was valid (scrape started)
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
      onAuth(key.trim());
    } catch (err) {
      if (err.message.includes('Invalid admin key') || err.message.includes('403')) {
        setError(t('health.invalidKey'));
      } else {
        // Key might be valid but scrape had other issues — still authenticate
        sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
        onAuth(key.trim());
      }
    } finally {
      setChecking(false);
    }
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
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t('health.enterKey')}
              className="admin-input"
              autoFocus
            />
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

/* ── Admin Dashboard ───────────────────────────────────────── */
export default function Health() {
  const { t } = useTranslation();
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || '');
  const [overview, setOverview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const [ov, lg, hl] = await Promise.all([
        api('/overview'),
        api('/scrape-logs?limit=20'),
        api('/health-check'),
      ]);
      setOverview(ov);
      setLogs(lg);
      setHealth(hl);
    } catch (err) {
      console.error('Health page error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [adminKey, load]);

  const handleScrape = async () => {
    setScraping(true);
    setActionResult(null);
    try {
      await adminPost('/scrape', adminKey);
      setActionResult({ type: 'success', msg: t('health.scrapeTriggered') });
      setTimeout(load, 2000);
    } catch (err) {
      setActionResult({ type: 'error', msg: err.message });
    } finally {
      setScraping(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    setActionResult(null);
    try {
      await adminPost('/backfill-published-dates', adminKey);
      setActionResult({ type: 'success', msg: t('health.backfillTriggered') });
      setTimeout(load, 2000);
    } catch (err) {
      setActionResult({ type: 'error', msg: err.message });
    } finally {
      setBackfilling(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey('');
  };

  const downloadPdf = (year, month) => {
    window.open(`/api/reports/monthly-pdf?year=${year}&month=${month}`, '_blank');
  };

  const downloadCsv = () => {
    window.open('/api/export/csv', '_blank');
  };

  if (!adminKey) return <AdminLogin onAuth={setAdminKey} />;
  if (loading) return <div className="page-loader"><div className="page-loader-spinner" /><p>{t('app.loading')}</p></div>;

  const lastScrape = overview?.last_scrape;
  const successLogs = logs.filter(l => l.status === 'completed');
  const failedLogs = logs.filter(l => l.status === 'failed');
  const successRate = logs.length > 0 ? Math.round((successLogs.length / logs.length) * 100) : 0;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <div className="health-page admin-panel">
      {/* Admin Header Bar */}
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

      {/* Action Result Toast */}
      {actionResult && (
        <div className={`admin-toast admin-toast-${actionResult.type}`}>
          {actionResult.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
          <span>{actionResult.msg}</span>
          <button onClick={() => setActionResult(null)}>×</button>
        </div>
      )}

      {/* ── Admin Actions ────────────────────────────────────── */}
      <div className="admin-actions-bar">
        <h3><FaPlay /> {t('health.adminActions')}</h3>
        <div className="admin-actions-grid">
          <button className="admin-action-btn admin-action-scrape" onClick={handleScrape} disabled={scraping}>
            {scraping ? <FaSpinner className="spin" /> : <FaSync />}
            <div>
              <strong>{t('health.triggerScrape')}</strong>
              <small>{t('health.triggerScrapeDesc')}</small>
            </div>
          </button>
          <button className="admin-action-btn admin-action-backfill" onClick={handleBackfill} disabled={backfilling}>
            {backfilling ? <FaSpinner className="spin" /> : <FaCalendarAlt />}
            <div>
              <strong>{t('health.backfillDates')}</strong>
              <small>{t('health.backfillDatesDesc')}</small>
            </div>
          </button>
          <button className="admin-action-btn admin-action-pdf" onClick={() => downloadPdf(currentYear, currentMonth)}>
            <FaFileDownload />
            <div>
              <strong>{t('health.downloadReport')}</strong>
              <small>{t('health.downloadReportDesc', { month: currentMonth, year: currentYear })}</small>
            </div>
          </button>
          <button className="admin-action-btn admin-action-csv" onClick={downloadCsv}>
            <FaDownload />
            <div>
              <strong>{t('health.exportCsv')}</strong>
              <small>{t('health.exportCsvDesc')}</small>
            </div>
          </button>
        </div>
      </div>

      {/* ── System Metrics ───────────────────────────────────── */}
      <div className="health-grid">
        {/* Pipeline Status */}
        <div className="health-card">
          <h3><FaSync /> {t('health.scrapeStatus')}</h3>
          <div className="health-stats">
            <div className="health-stat">
              <span className="health-stat-label">{t('health.lastScrape')}</span>
              <span className="health-stat-value">
                {lastScrape ? (
                  <><StatusDot status={lastScrape.status} /> {lastScrape.finished_at ? new Date(lastScrape.finished_at).toLocaleString() : t('health.running')}</>
                ) : '—'}
              </span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">{t('health.totalScrapes')}</span>
              <span className="health-stat-value">{health?.total_scrapes || 0}</span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">{t('health.successRate')}</span>
              <span className="health-stat-value" style={{ color: successRate >= 80 ? '#22c55e' : successRate >= 50 ? '#eab308' : '#ef4444' }}>
                {successRate}%
              </span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">{t('health.failedScrapes')}</span>
              <span className="health-stat-value" style={{ color: failedLogs.length > 0 ? '#ef4444' : '#22c55e' }}>
                {failedLogs.length}
              </span>
            </div>
          </div>
        </div>

        {/* Data & Storage */}
        <div className="health-card">
          <h3><FaDatabase /> {t('health.dataFreshness')}</h3>
          <div className="health-stats">
            <div className="health-stat">
              <span className="health-stat-label">{t('health.totalRecords')}</span>
              <span className="health-stat-value">{health?.total_accidents || 0}</span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">{t('health.articlesCollected')}</span>
              <span className="health-stat-value">{health?.total_articles || 0}</span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">{t('health.extractionMode')}</span>
              <span className="health-stat-value">
                <FaRobot style={{ marginRight: 4 }} />
                {health?.extraction_mode === 'advanced' ? t('app.aiPowered') : t('app.standard')}
              </span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">{t('health.dbSize')}</span>
              <span className="health-stat-value"><FaHdd style={{ marginRight: 4 }} /> {health?.db_size_mb || 0} MB</span>
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div className="health-card">
          <h3><FaCalendarAlt /> {t('health.dateRange')}</h3>
          <div className="health-stats">
            <div className="health-stat">
              <span className="health-stat-label">{t('health.lastArticleDate')}</span>
              <span className="health-stat-value">{health?.latest_article_date || '—'}</span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">{t('health.oldestArticle')}</span>
              <span className="health-stat-value">{health?.oldest_article_date || '—'}</span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">{t('health.todayAccidents')}</span>
              <span className="health-stat-value">{overview?.today?.accidents || 0}</span>
            </div>
            <div className="health-stat">
              <span className="health-stat-label">{t('health.todayDeaths')}</span>
              <span className="health-stat-value" style={{ color: (overview?.today?.deaths || 0) > 0 ? '#ef4444' : '#22c55e' }}>
                {overview?.today?.deaths || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Scrape Logs ───────────────────────────────── */}
      <div className="health-card" style={{ marginTop: '1.5rem' }}>
        <div className="admin-card-header">
          <h3><FaClock /> {t('health.recentScrapes')}</h3>
          <button className="admin-refresh-btn" onClick={load}><FaSync /> {t('health.refresh')}</button>
        </div>
        <div className="health-table-wrap">
          <table className="health-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('health.status')}</th>
                <th>{t('health.started')}</th>
                <th>{t('health.finished')}</th>
                <th>{t('health.found')}</th>
                <th>{t('health.new')}</th>
                <th>{t('health.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                let duration = '—';
                if (log.started_at && log.finished_at) {
                  const ms = new Date(log.finished_at) - new Date(log.started_at);
                  const mins = Math.floor(ms / 60000);
                  const secs = Math.floor((ms % 60000) / 1000);
                  duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                }
                return (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td><StatusDot status={log.status} /> {log.status}</td>
                    <td>{log.started_at ? new Date(log.started_at).toLocaleString() : '—'}</td>
                    <td>{log.finished_at ? new Date(log.finished_at).toLocaleString() : '—'}</td>
                    <td>{log.articles_found}</td>
                    <td>{log.articles_new}</td>
                    <td>{duration}</td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.5 }}>{t('common.noData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
