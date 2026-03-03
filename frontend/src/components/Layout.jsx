import { NavLink, Link, Outlet } from 'react-router-dom';
import { FaChartLine, FaCalendarDay, FaCalendarAlt, FaMapMarkedAlt, FaExclamationTriangle, FaList, FaSyncAlt, FaSpinner, FaGithub, FaEnvelope, FaBalanceScale, FaSearch, FaSun, FaMoon, FaDownload, FaUsers } from 'react-icons/fa';
import { useState } from 'react';
import { postApi } from '../utils/api';
import ToastContainer from './ToastContainer';
import AlertBanner from './AlertBanner';
import { useToast } from '../utils/useToast';
import { useTheme } from '../utils/useTheme';
import BDLogo from './BDLogo';

const tabs = [
  { to: '/', icon: <FaChartLine />, label: 'Dashboard', end: true },
  { to: '/daily', icon: <FaCalendarDay />, label: 'Daily' },
  { to: '/monthly', icon: <FaCalendarAlt />, label: 'Monthly' },
  { to: '/map', icon: <FaMapMarkedAlt />, label: 'Danger Map' },
  { to: '/zones', icon: <FaExclamationTriangle />, label: 'Danger Zones' },
  { to: '/compare', icon: <FaBalanceScale />, label: 'Compare' },
  { to: '/search', icon: <FaSearch />, label: 'Search' },
  { to: '/records', icon: <FaList />, label: 'Records' },
  { to: '/community', icon: <FaUsers />, label: 'Community' },
];

export default function Layout() {
  const [scraping, setScraping] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const { toasts, addToast } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();

  const handleScrape = async () => {
    setScraping(true);
    addToast('Scraping started... This may take a few minutes.', 'info');
    try {
      const data = await postApi('/scrape');
      if (data.result) {
        addToast(`Scrape complete! Found ${data.result.total_found} articles, ${data.result.total_new} new.`, 'success');
        setLastUpdate(new Date().toLocaleString());
      } else if (data.detail) {
        addToast(`Scrape failed: ${data.detail}`, 'error');
      }
    } catch (err) {
      addToast(`Scrape error: ${err.message}`, 'error');
    } finally {
      setScraping(false);
    }
  };

  const handleExport = () => {
    window.open('/api/export/csv', '_blank');
  };

  return (
    <div className="app-layout">
      <ToastContainer toasts={toasts} />
      <AlertBanner />

      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <BDLogo size={44} />
            <div>
              <h1>Traffic Insight <span className="bd-accent">BD</span></h1>
              <p>Real-time road accident intelligence • Bangladesh</p>
            </div>
          </Link>
          <div className="header-actions">
            {lastUpdate && <span className="last-update">Last scraped: {lastUpdate}</span>}
            <button className="btn btn-icon theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <FaSun /> : <FaMoon />}
            </button>
            <button className="btn btn-outline" onClick={handleExport} title="Export all data as CSV">
              <FaDownload /> Export
            </button>
            <button className="btn btn-primary" onClick={handleScrape} disabled={scraping}>
              {scraping ? <><FaSpinner className="spin" /> Scraping...</> : <><FaSyncAlt /> Scrape Now</>}
            </button>
          </div>
        </div>
      </header>

      <div className="nav-wrapper">
        <nav className="nav-tabs">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
            >
              {tab.icon} {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="main">
        <Outlet context={{ addToast, setLastUpdate }} />
      </main>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-about">
            <div className="footer-brand">
              <BDLogo size={32} />
              <div>
                <h4>Traffic Insight <span className="bd-accent">BD</span></h4>
                <p>Real-time road accident intelligence for Bangladesh</p>
              </div>
            </div>
            <p className="footer-desc">
              Traffic Insight BD aggregates and analyses road accident data scraped from
              leading Bangladeshi newspapers. Our goal is to bring visibility to the road
              safety crisis and empower researchers, journalists, and policymakers with
              actionable data.
            </p>
          </div>

          <div className="footer-links">
            <h5>Quick Links</h5>
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/daily">Daily Analysis</NavLink>
            <NavLink to="/monthly">Monthly Analysis</NavLink>
            <NavLink to="/map">Danger Map</NavLink>
            <NavLink to="/zones">Danger Zones</NavLink>
            <NavLink to="/records">All Records</NavLink>
          </div>

          <div className="footer-links">
            <h5>Data Sources</h5>
            <a href="https://www.thedailystar.net/tags/road-accident" target="_blank" rel="noopener noreferrer">
              The Daily Star
            </a>
            <a href="https://nirapad.org.bd/" target="_blank" rel="noopener noreferrer">
              NIRAPAD Bangladesh
            </a>
            <a href="https://www.rhd.gov.bd/" target="_blank" rel="noopener noreferrer">
              Roads &amp; Highways Division
            </a>
          </div>

          <div className="footer-links">
            <h5>About the Creators</h5>
            <div className="footer-creators">
              <div className="creator">
                <span className="creator-name">Rafeed Chowdhury</span>
                <span className="creator-role">AI Software Developer</span>
              </div>
              <div className="creator">
                <span className="creator-name">Fahid Khan</span>
                <span className="creator-role">Software Developer</span>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Traffic Insight BD</p>
        </div>
      </footer>
    </div>
  );
}
