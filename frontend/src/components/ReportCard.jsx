import { useState, useCallback } from 'react';
import {
  FaMapMarkerAlt, FaSkullCrossbones, FaUserInjured,
  FaThumbsUp, FaClock, FaCarCrash, FaGlobe,
  FaChevronLeft, FaChevronRight, FaComment, FaPaperPlane, FaSpinner,
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

  /* Comments */
  const [showComments,    setShowComments]    = useState(false);
  const [comments,        setComments]        = useState([]);
  const [commentCount,    setCommentCount]    = useState(0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsFetched, setCommentsFetched] = useState(false);
  const [commenterName,   setCommenterName]   = useState('');
  const [commentBody,     setCommentBody]     = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError,    setCommentError]    = useState('');

  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.items);
        setCommentCount(data.total);
      }
    } catch { /* ignore */ } finally {
      setLoadingComments(false);
      setCommentsFetched(true);
    }
  }, [report.id]);

  const toggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentsFetched) fetchComments();
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const body = commentBody.trim();
    if (!body) { setCommentError('Write something before posting.'); return; }
    setCommentError('');
    setSubmittingComment(true);
    try {
      const fd = new FormData();
      fd.append('body', body);
      fd.append('author_name', commenterName.trim() || 'Anonymous');
      const res = await fetch(`/api/reports/${report.id}/comments`, { method: 'POST', body: fd });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setCommentCount((n) => n + 1);
        setCommentBody('');
        setCommenterName('');
      } else {
        const err = await res.json().catch(() => ({}));
        setCommentError(err.detail || 'Failed to post comment.');
      }
    } catch { setCommentError('Network error. Please try again.'); }
    finally { setSubmittingComment(false); }
  };

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

  const isFatal       = TYPE_FATAL_TYPES.has(report.accident_type) || report.fatalities > 0;
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
            const isLast   = i === visibleImages.length - 1;
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
        {commentCount > 0 && (
          <button className="comment-count-btn" onClick={toggleComments}>
            <FaComment style={{ fontSize: '0.7rem' }} />
            {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
          </button>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="report-card-divider" />

      {/* ── Action row (Helpful + Comment) ── */}
      <div className="report-card-actions">
        <button
          className={`report-action-btn${upvoted ? ' upvoted' : ''}`}
          onClick={handleUpvote}
          disabled={upvoted || upvoting}
          title={upvoted ? 'Already marked as helpful' : 'Mark as helpful'}
        >
          <FaThumbsUp /> {upvoted ? 'Helpful ✓' : 'Helpful'}
        </button>

        <button
          className={`report-action-btn${showComments ? ' active' : ''}`}
          onClick={toggleComments}
          title="View or add comments"
        >
          <FaComment /> Comment
          {commentCount > 0 && <span className="action-comment-count">{commentCount}</span>}
        </button>
      </div>

      {/* ── Comments section ── */}
      {showComments && (
        <div className="report-comments">
          <div className="report-comments-divider" />

          {loadingComments && (
            <div className="comments-loading">
              <FaSpinner className="spin" /> Loading comments…
            </div>
          )}

          {!loadingComments && comments.length === 0 && (
            <p className="comments-empty">No comments yet. Be the first to help!</p>
          )}

          {!loadingComments && comments.length > 0 && (
            <div className="comment-list">
              {comments.map((c) => (
                <div key={c.id} className="comment-item">
                  <span className="comment-avatar">
                    {(c.author_name || 'A')[0].toUpperCase()}
                  </span>
                  <div className="comment-bubble">
                    <div className="comment-header">
                      <strong>{c.author_name || 'Anonymous'}</strong>
                      <span className="comment-time">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="comment-body">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Write a comment ── */}
          <form className="comment-form" onSubmit={handleSubmitComment}>
            {commentError && <p className="comment-error">{commentError}</p>}
            <div className="comment-form-row">
              <span className="comment-avatar comment-avatar-you">Y</span>
              <div className="comment-input-wrap">
                <input
                  type="text"
                  className="comment-name-input"
                  placeholder="Your name (optional)"
                  maxLength={80}
                  value={commenterName}
                  onChange={(e) => setCommenterName(e.target.value)}
                />
                <div className="comment-body-row">
                  <textarea
                    className="comment-textarea"
                    placeholder="Write a comment, tip, or update about this incident…"
                    rows={2}
                    maxLength={1000}
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment(e);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="comment-submit-btn"
                    disabled={submittingComment || !commentBody.trim()}
                    title="Post comment"
                  >
                    {submittingComment
                      ? <FaSpinner className="spin" />
                      : <FaPaperPlane />
                    }
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

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
