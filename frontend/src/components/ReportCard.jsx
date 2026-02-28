import { useState } from 'react';
import {
  FaMapMarkerAlt, FaSkullCrossbones, FaUserInjured,
  FaThumbsUp, FaClock, FaCarCrash, FaGlobe,
  FaChevronLeft, FaChevronRight,
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

const TYPE_FATAL_TYPES = new Set([
  'Train accident', 'Pedestrian accident',
]);

/** CSS grid modifier class for N images (capped at 4-tile display) */
function photoGridClass(n) {
  if (n === 1) return 'photos-1';
  if (n === 2) return 'photos-2';
  if (n === 3) return 'photos-3';
  return 'photos-4';
}

export default function ReportCard({ report, onUpvote }) {
  const [images] = useState(() => {
    try { return JSON.parse(report.images || '[]'); } catch { return []; }
  });

  /* Lightbox: index of the open image (null = closed) */
  const [lbIndex, setLbIndex] = useState(null);

  const [upvoted, setUpvoted]   = useState(false);
  const [upvotes, setUpvotes]   = useState(report.upvotes ?? 0);
  const [upvoting, setUpvoting] = useState(false);

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

  const isFatal      = TYPE_FATAL_TYPES.has(report.accident_type) || report.fatalities > 0;
  const locationParts = [report.location_text, report.district, report.division].filter(Boolean);
  const visibleImages = images.slice(0, 4);
  const extraCount    = images.length - 4;

  const lbPrev = () => setLbIndex((i) => (i - 1 + images.length) % images.length);
  const lbNext = () => setLbIndex((i) => (i + 1) % images.length);

  return (
    <article className="report-card">

      {/* ── Post header: avatar + name + time + type tag ── */}
      <div className="report-card-header">
        <div className="report-card-author">
          <span className="report-avatar">
            {(report.reporter_name || 'A')[0].toUpperCase()}
          </span>
          <div className="report-author-info">
            <strong>{report.reporter_name || 'Anonymous'}</strong>
            <div className="report-meta-row">
              <span className="report-time">
                <FaClock style={{ fontSize: '0.6rem' }} /> {timeAgo(report.created_at)}
              </span>
              <span className="report-meta-dot">·</span>
              <FaGlobe className="report-public-icon" />
              {report.accident_type && (
                <span className={`report-type-tag${isFatal ? ' fatal' : ''}`}>
                  {report.accident_type}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Post body ── */}
      <div className="report-card-body">
        <h4 className="report-card-title">{report.title}</h4>

        {report.description && (
          <p className="report-card-desc">{report.description}</p>
        )}

        <div className="report-card-meta">
          {locationParts.length > 0 && (
            <span className="report-meta-item location">
              <FaMapMarkerAlt /> {locationParts.join(', ')}
            </span>
          )}
          <span className="report-meta-item">
            <FaCarCrash /> {formatDate(report.incident_date)}
            {report.incident_time ? ` · ${report.incident_time}` : ''}
          </span>
          {report.fatalities > 0 && (
            <span className="report-meta-item fatal-count">
              <FaSkullCrossbones /> {report.fatalities} dead
            </span>
          )}
          {report.injuries > 0 && (
            <span className="report-meta-item injury-count">
              <FaUserInjured /> {report.injuries} injured
            </span>
          )}
        </div>
      </div>

      {/* ── Facebook-style photo grid ── */}
      {visibleImages.length > 0 && (
        <div className={`report-photo-grid ${photoGridClass(visibleImages.length)}`}>
          {visibleImages.map((src, i) => {
            const isLast  = i === visibleImages.length - 1;
            const showMore = isLast && extraCount > 0;
            return (
              <div
                key={i}
                className="photo-item"
                role="button"
                tabIndex={0}
                onClick={() => setLbIndex(i)}
                onKeyDown={(e) => e.key === 'Enter' && setLbIndex(i)}
              >
                <img src={src} alt={`Incident photo ${i + 1}`} />
                {showMore ? (
                  <div className="photo-more-badge">+{extraCount + 1}</div>
                ) : (
                  <div className="photo-overlay" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Reactions count bar ── */}
      <div className="report-reactions-bar">
        <div className="report-reactions-left">
          {upvotes > 0 ? (
            <>
              <span className="reaction-thumb-icon">👍</span>
              <span>{upvotes} {upvotes === 1 ? 'person found this helpful' : 'people found this helpful'}</span>
            </>
          ) : (
            <span>Be the first to mark this as helpful</span>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="report-card-divider" />

      {/* ── Action row (full-width FB-style) ── */}
      <div className="report-card-actions">
        <button
          className={`report-action-btn${upvoted ? ' upvoted' : ''}`}
          onClick={handleUpvote}
          disabled={upvoted || upvoting}
          title={upvoted ? 'Already marked as helpful' : 'Mark as helpful'}
        >
          <FaThumbsUp /> {upvoted ? 'Helpful ✓' : 'Helpful'}
        </button>
      </div>

      {/* ── Lightbox with prev/next ── */}
      {lbIndex !== null && images.length > 0 && (
        <div
          className="lightbox-overlay"
          onClick={() => setLbIndex(null)}
          role="dialog"
          aria-label="Full image view"
        >
          {images.length > 1 && (
            <>
              <button
                className="lightbox-nav prev"
                onClick={(e) => { e.stopPropagation(); lbPrev(); }}
                aria-label="Previous image"
              >
                <FaChevronLeft />
              </button>
              <button
                className="lightbox-nav next"
                onClick={(e) => { e.stopPropagation(); lbNext(); }}
                aria-label="Next image"
              >
                <FaChevronRight />
              </button>
            </>
          )}

          <img
            src={images[lbIndex]}
            alt={`Full view ${lbIndex + 1} of ${images.length}`}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
          <button className="lightbox-close" onClick={() => setLbIndex(null)}>✕</button>

          {images.length > 1 && (
            <div className="lightbox-counter">{lbIndex + 1} / {images.length}</div>
          )}
        </div>
      )}
    </article>
  );
}
