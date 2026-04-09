import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { FaYoutube, FaExternalLinkAlt, FaSpinner, FaPlay, FaTimes } from 'react-icons/fa';

export default function YouTubeNews({ limit = 8 }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api(`/youtube-videos?limit=${limit}`);
        setVideos(data);
      } catch (err) {
        console.error('YouTubeNews error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [limit]);

  if (loading) {
    return (
      <div className="yt-section">
        <div className="yt-section-header">
          <FaYoutube className="yt-icon" />
          <h3>Video News Coverage</h3>
        </div>
        <div className="loading"><FaSpinner className="spin" /> Loading videos...</div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="yt-section">
        <div className="yt-section-header">
          <FaYoutube className="yt-icon" />
          <h3>Video News Coverage</h3>
        </div>
        <div className="empty-state">
          <FaYoutube />
          <p>No videos available right now. Try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="yt-section">
      <div className="yt-section-header">
        <FaYoutube className="yt-icon" />
        <h3>Video News Coverage</h3>
        <span className="yt-sub">Latest accident reports from YouTube</span>
        <a
          href="https://www.youtube.com/results?search_query=bangladesh+road+accident+news"
          target="_blank"
          rel="noopener noreferrer"
          className="yt-see-all"
        >
          See all on YouTube <FaExternalLinkAlt />
        </a>
      </div>

      {/* ── Inline player modal ── */}
      {activeVideo && (
        <div className="yt-player-overlay" onClick={() => setActiveVideo(null)}>
          <div className="yt-player-wrap" onClick={(e) => e.stopPropagation()}>
            <button className="yt-player-close" onClick={() => setActiveVideo(null)}>
              <FaTimes />
            </button>
            <iframe
              className="yt-player-iframe"
              src={`https://www.youtube.com/embed/${activeVideo.video_id}?autoplay=1&rel=0`}
              title={activeVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <div className="yt-player-title">{activeVideo.title}</div>
          </div>
        </div>
      )}

      <div className="yt-grid">
        {videos.map((v) => (
          <div
            key={v.video_id}
            className="yt-card"
            onClick={() => setActiveVideo(v)}
          >
            <div className="yt-thumb-wrap">
              <img
                src={v.thumbnail}
                alt={v.title}
                className="yt-thumb"
                loading="lazy"
              />
              <div className="yt-play-btn">
                <FaPlay />
              </div>
            </div>
            <div className="yt-card-body">
              <p className="yt-card-title">{v.title}</p>
              <span className="yt-card-source">
                <FaYoutube className="yt-icon-sm" /> YouTube
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
