import { NavLink, Link, Outlet } from 'react-router-dom';
import {
  FaChartLine, FaCalendarDay, FaCalendarAlt, FaMapMarkedAlt,
  FaExclamationTriangle, FaList, FaBalanceScale, FaSearch,
  FaSun, FaMoon, FaChartArea, FaNewspaper, FaCoffee,
  FaMapMarkerAlt, FaCar,
} from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import ToastContainer from './ToastContainer';
import AlertBanner from './AlertBanner';
import LangSwitch from './LangSwitch';
import NotificationBell from './NotificationBell';
import { useToast } from '../utils/useToast';
import { useTheme } from '../utils/useTheme';
import BDLogo from './BDLogo';

// Two-row nav: primary (always prominent) + secondary (smaller, grouped)
const PRIMARY_NAV = [
  { to: '/',        icon: <FaChartLine />,   key: 'nav.dashboard',  end: true },
  { to: '/insights',icon: <FaChartArea />,   key: 'nav.insights' },
  { to: '/map',     icon: <FaMapMarkedAlt />,key: 'nav.dangerMap' },
  { to: '/search',  icon: <FaSearch />,      key: 'nav.search' },
];

const SECONDARY_GROUPS = [
  {
    label: 'Analysis',
    items: [
      { to: '/daily',   icon: <FaCalendarDay />, key: 'nav.daily' },
      { to: '/monthly', icon: <FaCalendarAlt />, key: 'nav.monthly' },
      { to: '/compare', icon: <FaBalanceScale />,key: 'nav.compare' },
    ],
  },
  {
    label: 'Deep Dive',
    items: [
      { to: '/districts', icon: <FaMapMarkerAlt />,        key: 'nav.districts' },
      { to: '/vehicles',  icon: <FaCar />,                 key: 'nav.vehicles' },
      { to: '/zones',     icon: <FaExclamationTriangle />, key: 'nav.dangerZones' },
    ],
  },
  {
    label: 'Data',
    items: [
      { to: '/records', icon: <FaList />,      key: 'nav.records' },
      { to: '/news',    icon: <FaNewspaper />, key: 'nav.news' },
    ],
  },
];

export default function Layout() {
  const { t } = useTranslation();
  const [lastUpdate, setLastUpdate] = useState('');
  const [extractionMode, setExtractionMode] = useState('');
  const { toasts, addToast } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    api('/overview').then(d => {
      if (d.extraction_mode) setExtractionMode(d.extraction_mode);
    }).catch(() => {});
  }, []);

  return (
    <div className="app-layout">
      <ToastContainer toasts={toasts} />
      <AlertBanner />

      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <BDLogo size={44} />
            <div>
              <h1>{t('app.title')} <span className="bd-accent">{t('app.titleAccent')}</span></h1>
              <p>{t('app.tagline')}</p>
            </div>
          </Link>
          <div className="header-actions">
            {extractionMode && (
              <span
                className={`extraction-badge ${extractionMode}`}
                title={extractionMode === 'advanced' ? 'AI-powered extraction (GPT)' : 'Pattern-based extraction'}
              >
                {extractionMode === 'advanced'
                  ? (<><span className="ai-dot" />{t('app.aiPowered')}</>)
                  : `🔧 ${t('app.standard')}`}
              </span>
            )}
            {lastUpdate && <span className="last-update">{t('app.lastScraped')} {lastUpdate}</span>}
            <NotificationBell />
            <LangSwitch />
            <button
              className="btn btn-icon theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <FaSun /> : <FaMoon />}
            </button>
          </div>
        </div>
      </header>

      <div className="nav-wrapper">
        {/* ── Primary row ── */}
        <nav className="nav-primary">
          {PRIMARY_NAV.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `nav-tab nav-tab-primary${isActive ? ' active' : ''}`}
            >
              {tab.icon} {t(tab.key)}
            </NavLink>
          ))}
        </nav>

        {/* ── Secondary row ── */}
        <nav className="nav-secondary">
          {SECONDARY_GROUPS.map((group, gi) => (
            <div key={group.label} className="nav-group">
              {gi > 0 && <div className="nav-group-divider" />}
              <span className="nav-group-label">{group.label}</span>
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-tab nav-tab-secondary${isActive ? ' active' : ''}`}
                >
                  {item.icon} {t(item.key)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <main className="main">
        <Outlet context={{ addToast, setLastUpdate }} />
      </main>

      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-about">
            <div className="footer-brand">
              <BDLogo size={32} />
              <div>
                <h4>{t('app.title')} <span className="bd-accent">{t('app.titleAccent')}</span></h4>
                <p>{t('app.tagline').split('•')[0].trim()}</p>
              </div>
            </div>
            <p className="footer-desc">{t('app.footerDesc')}</p>
          </div>

          <div className="footer-links">
            <h5>{t('footer.quickLinks')}</h5>
            <NavLink to="/">{t('nav.dashboard')}</NavLink>
            <NavLink to="/daily">{t('footer.dailyAnalysis')}</NavLink>
            <NavLink to="/monthly">{t('footer.monthlyAnalysis')}</NavLink>
            <NavLink to="/map">{t('nav.dangerMap')}</NavLink>
            <NavLink to="/zones">{t('nav.dangerZones')}</NavLink>
            <NavLink to="/records">{t('footer.allRecords')}</NavLink>
          </div>

          <div className="footer-links">
            <h5>{t('footer.dataSources')}</h5>
            <a href="https://www.newagebd.net/tags/Road%20accident" target="_blank" rel="noopener noreferrer">
              New Age Bangladesh
            </a>
          </div>

          <div className="footer-links">
            <h5>{t('footer.legal')}</h5>
            <NavLink to="/about">{t('footer.about')}</NavLink>
            <NavLink to="/privacy">{t('footer.privacy')}</NavLink>
            <NavLink to="/terms">{t('footer.terms')}</NavLink>
          </div>

          <div className="footer-links">
            <h5>{t('footer.support')}</h5>
            <a href="https://buymeacoffee.com/trafficinsightbd" target="_blank" rel="noopener noreferrer" className="support-link">
              <FaCoffee /> {t('footer.buyMeCoffee')}
            </a>
            <p className="footer-support-note">{t('footer.supportNote')}</p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>{t('app.copyright', { year: new Date().getFullYear() })}</p>
          <p className="footer-mission">{t('app.mission')}</p>
        </div>
      </footer>
    </div>
  );
}
