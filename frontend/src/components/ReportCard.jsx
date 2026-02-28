import { useState } from 'react';
import {
  FaMapMarkerAlt, FaSkullCrossbones, FaUserInjured,
  FaThumbsUp, FaClock, FaCarCrash, FaImage,
} from 'react-icons/fa';
import { formatDate } from '../utils/api';

/** How long ago a UTC date string was */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr.split('T')[0]);
}

const TYPE_BADGE = {
  'Bus accident':          'badge-warning',
  'Truck accident':        'badge-warning',
  'Motorcycle accident':   'badge-info',
  'Auto-rickshaw accident':'badge-info',
  'Train accident':        'badge-danger',
  'Pedestrian accident':   'badge-danger',
  'Multi-vehicle collision':'badge-warning',
  'Road accident':         'badge-secondary',
};

export default function ReportCard({ report, onUpvote }) {
  const [images] = useState(() => {
    try { return JSON.parse(report.images || '[]'); } catch { return []; }
  });
  const [lightbox, setLightbox]   = useState(null);
  const [upvoted, setUpvoted]     = useState(false);
  const [upvotes, setUpvotes]     = useState(report.upvotes ?? 0);
  const [upvoting, setUpvoting]   = useState(false);

  const handleUpvote = async () => {
    if (upvoted || upvoting) return;
    setUpvoting(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/upvote`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setUpvotes(data.upvotes);
        setUpvoted(true);
        onUpvote?.();
      }
    } catch { /* ignore */ } finally {
      setUpvoting(false);
    }
  };

  const typeBadge = TYPE_BADGE[report.accident_type] ?? 'badge-secondary';
  const locationParts = [report.location_text, report.district, report.division].filter(Boolean);

  return (
    <article className="report-card">

      {/* ── Header: avatar + name + time + type badge ── */}
      <div className="report-card-header">
        <div className="report-card-author">
          <span className="report-avatar">
            {(report.reporter_name || 'A')[0].toUpperCase()}
          </span>
          <div className="report-author-info">
            <strong>{report.reporter_name || 'Anonymous'}</strong>
            <span className="report-time"><FaClock style={{ fontSize: '0.65rem' }} /> {timeAgo(report.created_at)}</span>
          </div>
        </div>
        <span className={`badge ${typeBadge}`}>{report.accident_type}</span>
      </div>

      {/* ── Title ── */}
      <h4 className="report-card-title">{report.title}</h4>

      {/* ── Location ── */}
      {locationParts.length > 0 && (
        <p className="report-card-location">
          <FaMapMarkerAlt /> {locationParts.join(', ')}
        </p>
      )}

      {/* ── Incident date/time ── */}
      <p className="report-card-date">
        <FaCarCrash style={{ marginRight: 4 }} />
        Incident: {formatDate(report.incident_date)}
        {report.incident_time ? ` at ${report.incident_time}` : ''}
      </p>

      {/* ── Description ── */}
      {report.description && (
        <p className="report-card-desc">{report.description}</p>
      )}

      {/* ── Image thumbnails ── */}
      {images.length > 0 && (
        <div className="report-images">
          {images.map((src, i) => (
            <button
              key={i}
              className="report-thumb-btn"
              onClick={() => setLightbox(src)}
              title="View full image"
            >
              <img src={src} alt={`Incident photo ${i + 1}`} className="report-thumb" />
              <span className="report-thumb-overlay"><FaImage /></span>
            </button>
          ))}
        </div>
      )}

      {/* ── Footer: casualties + upvote ── */}
      <div className="report-card-footer">
        <div className="report-casualties">
          {report.fatalities > 0 && (
            <span className="badge badge-danger">
              <FaSkullCrossbones /> {report.fatalities} dead
            </span>
          )}
          {report.injuries > 0 && (
            <span className="badge badge-warning">
              <FaUserInjured /> {report.injuries} injured
            </span>
          )}
          {report.fatalities === 0 && report.injuries === 0 && (
            <span className="badge badge-secondary">No casualties reported</span>
          )}
        </div>

        <button
          className={`btn btn-sm-report ${upvoted ? 'btn-primary' : 'btn-outline'}`}
          onClick={handleUpvote}
          disabled={upvoted || upvoting}
          title={upvoted ? 'Already upvoted' : 'Mark as helpful'}
        >
          <FaThumbsUp /> {upvotes}
        </button>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label="Full image view"
        >
          <img
            src={lightbox}
            alt="Full view"
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}
    </article>
  );
}
