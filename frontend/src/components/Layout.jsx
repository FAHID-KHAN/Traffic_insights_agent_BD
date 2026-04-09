import { NavLink, Link, Outlet } from 'react-router-dom';
import { FaChartLine, FaCalendarDay, FaCalendarAlt, FaMapMarkedAlt, FaExclamationTriangle, FaList, FaGithub, FaEnvelope, FaBalanceScale, FaSearch, FaSun, FaMoon, FaLinkedin, FaChartArea, FaNewspaper } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { api } from '../utils/api';
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
  { to: '/insights', icon: <FaChartArea />, label: 'Insights' },
  { to: '/search', icon: <FaSearch />, label: 'Search' },
  { to: '/news', icon: <FaNewspaper />, label: 'News' },
  { to: '/records', icon: <FaList />, label: 'Records' },
];

export default function Layout() {
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
              <h1>Traffic Insight <span className="bd-accent">BD</span></h1>
              <p>Real-time road accident intelligence • Bangladesh</p>
            </div>
          </Link>
          <div className="header-actions">
            {extractionMode && (
              <span className={`extraction-badge ${extractionMode}`} title={extractionMode === 'advanced' ? 'AI-powered extraction' : 'Pattern-based extraction'}>
                {extractionMode === 'advanced' ? '⚡ Advanced' : '🔧 Standard'}
              </span>
            )}
            {lastUpdate && <span className="last-update">Last scraped: {lastUpdate}</span>}
            <button className="btn btn-icon theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <FaSun /> : <FaMoon />}
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
            <a href="https://www.newagebd.net/tags/Road%20accident" target="_blank" rel="noopener noreferrer">
              New Age Bangladesh
            </a>
          </div>

          <div className="footer-links">
            <h5>Legal</h5>
            <NavLink to="/privacy">Privacy Policy</NavLink>
            <NavLink to="/terms">Terms &amp; Disclaimer</NavLink>
          </div>

          <div className="footer-links">
            <h5>About the Creators</h5>
            <div className="footer-creators">
              <div className="creator">
                <span className="creator-name">Rafeed Chowdhury</span>
                <span className="creator-role">Software Engineer</span>
                <a href="https://www.linkedin.com/in/rafeedcse94/" target="_blank" rel="noopener noreferrer" className="creator-linkedin"><FaLinkedin /> LinkedIn</a>
              </div>
              <div className="creator">
                <span className="creator-name">Fahid Khan</span>
                <span className="creator-role">Software Engineer</span>
                <a href="https://www.linkedin.com/in/fahid-a-khan-46758819b/" target="_blank" rel="noopener noreferrer" className="creator-linkedin"><FaLinkedin /> LinkedIn</a>
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
