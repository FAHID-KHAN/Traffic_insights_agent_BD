import { Link } from 'react-router-dom';
import { FaMapSigns } from 'react-icons/fa';

/**
 * 404 Not Found page — shown for unrecognised routes.
 */
export default function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <FaMapSigns className="not-found-icon" />
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">Page Not Found</h2>
        <p className="not-found-message">
          The road you're looking for doesn't exist — maybe it was re-routed.
        </p>
        <Link to="/" className="not-found-btn">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
