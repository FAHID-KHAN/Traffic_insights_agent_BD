import { useState, useEffect } from 'react';
import { api, formatDate } from '../utils/api';
import { FaNewspaper, FaExternalLinkAlt, FaSpinner, FaExclamationCircle } from 'react-icons/fa';

export default function LiveNews({ limit = 12 }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api(`/articles/latest?limit=${limit}`);
        setArticles(data);
      } catch (err) {
        console.error('LiveNews error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [limit]);

  if (loading) {
    return (
      <div className="live-news-card">
        <div className="live-news-header">
          <span className="live-dot" />
          <h3><FaNewspaper /> Live News Feed</h3>
        </div>
        <div className="loading"><FaSpinner className="spin" /> Loading articles...</div>
      </div>
    );
  }

  return (
    <div className="live-news-card">
      <div className="live-news-header">
        <span className="live-dot" />
        <h3><FaNewspaper /> Live News Feed</h3>
        <span className="live-badge">LIVE</span>
      </div>

      {articles.length === 0 ? (
        <div className="empty-state">
          <FaExclamationCircle />
          <p>No articles found. Try scanning first.</p>
        </div>
      ) : (
        <ul className="news-list">
          {articles.map((a) => (
            <li key={a.id} className="news-item">
              <div className="news-meta">
                <span className="news-date">{formatDate(a.published_date)}</span>
                <span className="news-source">{a.source || 'New Age'}</span>
              </div>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-link"
              >
                {a.title}
                <FaExternalLinkAlt className="news-ext-icon" />
              </a>
              <div className="news-stats">
                {a.accident_count > 0 && (
                  <span className="badge badge-danger">{a.accident_count} accident{a.accident_count > 1 ? 's' : ''}</span>
                )}
                {a.total_deaths > 0 && (
                  <span className="badge badge-warning">{a.total_deaths} death{a.total_deaths > 1 ? 's' : ''}</span>
                )}
                {a.total_injuries > 0 && (
                  <span className="badge badge-info">{a.total_injuries} injur{a.total_injuries > 1 ? 'ies' : 'y'}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
