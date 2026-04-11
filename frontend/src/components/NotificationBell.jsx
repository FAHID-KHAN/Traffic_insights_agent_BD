import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBell, FaBellSlash, FaSkullCrossbones, FaCog, FaArrowLeft, FaNewspaper, FaLayerGroup, FaChartBar, FaTimes } from 'react-icons/fa';
import { api } from '../utils/api';

const POLL_INTERVAL = 5 * 60 * 1000;
const PREFS_KEY = 'tibd-notif-prefs';
const SEEN_KEY = 'tibd-notif-seen';

const DEFAULT_PREFS = {
  highSeverity: true,
  newScrape: false,
  clusters: false,
  dailySummary: false,
};

function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY)) }; } catch { return { ...DEFAULT_PREFS }; }
}

function savePrefs(p) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }

function isAnyEnabled(p) { return Object.values(p).some(Boolean); }

function getSeenIds() {
  try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'settings'
  const [seenIds, setSeenIds] = useState(getSeenIds);
  const [lastScrapeId, setLastScrapeId] = useState(null);
  const ref = useRef(null);
  const active = isAnyEnabled(prefs);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setView('list'); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch alerts based on enabled categories
  const fetchAlerts = useCallback(async () => {
    if (!active) return;
    const items = [];
    try {
      if (prefs.highSeverity) {
        const data = await api('/alerts/high-severity');
        if (Array.isArray(data)) {
          data.forEach(a => items.push({ ...a, _type: 'severity', _key: `sev-${a.id}` }));
        }
      }
      if (prefs.newScrape) {
        const logs = await api('/scrape-logs?limit=1');
        if (Array.isArray(logs) && logs.length) {
          const latest = logs[0];
          if (latest.status === 'completed' && latest.id !== lastScrapeId) {
            setLastScrapeId(latest.id);
            items.push({
              _type: 'scrape', _key: `scrape-${latest.id}`,
              id: `scrape-${latest.id}`,
              articles_found: latest.articles_found,
              articles_new: latest.articles_new,
              finished_at: latest.finished_at,
            });
          }
        }
      }
      if (prefs.clusters) {
        const clusters = await api('/clusters?window_days=7&min_accidents=3');
        if (Array.isArray(clusters)) {
          clusters.slice(0, 3).forEach(c => items.push({
            _type: 'cluster', _key: `cluster-${c.cluster_id}`,
            id: `cluster-${c.cluster_id}`,
            district: c.district, accidents_count: c.accidents_count,
            total_deaths: c.total_deaths, date_start: c.date_start, date_end: c.date_end,
            severity: c.severity,
          }));
        }
      }
      if (prefs.dailySummary) {
        const ov = await api('/overview');
        if (ov?.today) {
          items.push({
            _type: 'daily', _key: 'daily-today', id: 'daily-today',
            date: ov.today.date, accidents: ov.today.accidents,
            deaths: ov.today.deaths, injuries: ov.today.injuries,
          });
        }
      }
    } catch { /* silent */ }
    setAlerts(items);
  }, [active, prefs, lastScrapeId]);

  useEffect(() => {
    if (!active) return;
    fetchAlerts(); // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(fetchAlerts, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [active, fetchAlerts]);

  // Browser push for unseen
  useEffect(() => {
    if (!active || !('Notification' in window) || Notification.permission !== 'granted') return;
    const current = getSeenIds();
    alerts.forEach((a) => {
      if (current.includes(a._key)) return;
      let body = '';
      if (a._type === 'severity') body = `${a.deaths} ${t('common.deaths')} — ${a.district || a.location_raw || t('map.unknown')}`;
      else if (a._type === 'scrape') body = t('notifications.scrapeBody', { found: a.articles_found, newCount: a.articles_new });
      else if (a._type === 'cluster') body = t('notifications.clusterBody', { district: a.district, count: a.accidents_count });
      else if (a._type === 'daily') body = t('notifications.dailyBody', { accidents: a.accidents, deaths: a.deaths });
      new Notification(t(`notifications.${a._type}Title`), { body, icon: '/icon-192.png', tag: a._key });
    });
    const updated = [...new Set([...current, ...alerts.map(a => a._key)])];
    setSeenIds(updated); // eslint-disable-line react-hooks/set-state-in-effect
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(updated));
  }, [alerts, active, t]);

  const togglePref = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    // Request permission on first enable
    if (!prefs[key] && 'Notification' in window && Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm === 'denied') return;
    }
    setPrefs(next);
    savePrefs(next);
  };

  const unseen = alerts.filter(a => !seenIds.includes(a._key));

  const PREF_OPTIONS = [
    { key: 'highSeverity', icon: <FaSkullCrossbones className="pref-icon pref-red" />, label: t('notifications.prefSeverity'), desc: t('notifications.prefSeverityDesc') },
    { key: 'newScrape', icon: <FaNewspaper className="pref-icon pref-green" />, label: t('notifications.prefScrape'), desc: t('notifications.prefScrapeDesc') },
    { key: 'clusters', icon: <FaLayerGroup className="pref-icon pref-orange" />, label: t('notifications.prefClusters'), desc: t('notifications.prefClustersDesc') },
    { key: 'dailySummary', icon: <FaChartBar className="pref-icon pref-blue" />, label: t('notifications.prefDaily'), desc: t('notifications.prefDailyDesc') },
  ];

  return (
    <div className="notif-bell-wrapper" ref={ref}>
      <button className="btn btn-icon notif-bell" onClick={() => { setOpen(!open); setView('list'); }} title={t('notifications.title')}>
        {active ? <FaBell /> : <FaBellSlash />}
        {unseen.length > 0 && <span className="notif-badge">{unseen.length}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          {/* Header */}
          <div className="notif-header">
            {view === 'settings' && (
              <button className="notif-back-btn" onClick={() => setView('list')}><FaArrowLeft /></button>
            )}
            <strong>{view === 'settings' ? t('notifications.settings') : t('notifications.title')}</strong>
            <button className="notif-gear-btn" onClick={() => setView(view === 'settings' ? 'list' : 'settings')}>
              {view === 'settings' ? <FaTimes /> : <FaCog />}
            </button>
          </div>

          {/* Settings View */}
          {view === 'settings' && (
            <div className="notif-prefs">
              {PREF_OPTIONS.map(opt => (
                <div key={opt.key} className="notif-pref-row">
                  <div className="notif-pref-left">
                    {opt.icon}
                    <div className="notif-pref-text">
                      <span className="notif-pref-label">{opt.label}</span>
                      <span className="notif-pref-desc">{opt.desc}</span>
                    </div>
                  </div>
                  <label className="notif-toggle">
                    <input
                      type="checkbox"
                      checked={prefs[opt.key]}
                      onChange={() => togglePref(opt.key)}
                    />
                    <span className="toggle-track" />
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* Alerts List View */}
          {view === 'list' && (
            <>
              {!active && <p className="notif-hint">{t('notifications.setupHint')}</p>}

              {active && alerts.length === 0 && <p className="notif-empty">{t('notifications.noAlerts')}</p>}

              {active && alerts.map(a => (
                <div key={a._key} className="notif-item">
                  {a._type === 'severity' && (
                    <>
                      <FaSkullCrossbones className="notif-icon-danger" />
                      <div>
                        <strong>{a.deaths} {t('common.deaths')}</strong>
                        {a.injuries > 0 && <>, {a.injuries} {t('common.injured')}</>}
                        <br />
                        <span className="notif-location">{a.district || a.location_raw || t('map.unknown')}</span>
                        {a.accident_date && <span className="notif-date"> · {a.accident_date}</span>}
                      </div>
                    </>
                  )}
                  {a._type === 'scrape' && (
                    <>
                      <FaNewspaper className="notif-icon-green" />
                      <div>
                        <strong>{t('notifications.scrapeTitle')}</strong><br />
                        <span className="notif-location">{t('notifications.scrapeBody', { found: a.articles_found, newCount: a.articles_new })}</span>
                        {a.finished_at && <span className="notif-date"> · {new Date(a.finished_at).toLocaleString()}</span>}
                      </div>
                    </>
                  )}
                  {a._type === 'cluster' && (
                    <>
                      <FaLayerGroup className={`notif-icon-${a.severity === 'critical' ? 'danger' : 'orange'}`} />
                      <div>
                        <strong>{a.district}</strong> — {a.accidents_count} {t('notifications.accidentsInCluster')}<br />
                        <span className="notif-location">{a.total_deaths} {t('common.deaths')}</span>
                        <span className="notif-date"> · {a.date_start} → {a.date_end}</span>
                      </div>
                    </>
                  )}
                  {a._type === 'daily' && (
                    <>
                      <FaChartBar className="notif-icon-blue" />
                      <div>
                        <strong>{t('notifications.dailyTitle')}</strong><br />
                        <span className="notif-location">{a.accidents} {t('stats.accidents').toLowerCase()}, {a.deaths} {t('common.deaths')}, {a.injuries} {t('common.injured')}</span>
                        <span className="notif-date"> · {a.date}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
