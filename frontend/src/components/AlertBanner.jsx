import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { FaExclamationTriangle, FaTimes, FaSkullCrossbones } from 'react-icons/fa';

export default function AlertBanner() {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('tibd-dismissed-alerts') || '[]');
    } catch { return []; }
  });

  useEffect(() => {
    const check = async () => {
      try {
        const data = await api('/alerts/high-severity');
        if (Array.isArray(data) && data.length > 0) {
          setAlerts(data.filter((a) => !dismissed.includes(a.id)));
        }
      } catch {
        // endpoint may not exist yet; silently ignore
      }
    };
    check();
    const interval = setInterval(check, 5 * 60 * 1000); // check every 5 min
    return () => clearInterval(interval);
  }, [dismissed]);

  const dismiss = (id) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    sessionStorage.setItem('tibd-dismissed-alerts', JSON.stringify(updated));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="alert-banner-stack">
      {alerts.map((a) => (
        <div key={a.id} className="alert-banner">
          <div className="alert-banner-icon">
            <FaExclamationTriangle />
          </div>
          <div className="alert-banner-content">
            <strong className="alert-banner-title">
              <FaSkullCrossbones /> High-Severity Accident Alert
            </strong>
            <p className="alert-banner-text">
              {a.deaths} deaths{a.injuries > 0 ? `, ${a.injuries} injuries` : ''} —{' '}
              {a.district || a.location_raw || 'Unknown location'}{' '}
              ({a.accident_type || 'Road accident'})
              {a.accident_date ? ` on ${a.accident_date}` : ''}
            </p>
          </div>
          <button className="alert-banner-close" onClick={() => dismiss(a.id)} aria-label="Dismiss">
            <FaTimes />
          </button>
        </div>
      ))}
    </div>
  );
}
