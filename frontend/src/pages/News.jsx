import YouTubeNews from '../components/YouTubeNews';
import LiveNews from '../components/LiveNews';
import { FaNewspaper } from 'react-icons/fa';

export default function News() {
  return (
    <div className="news-page">
      <h2 className="page-title">
        <FaNewspaper className="text-cyan" /> News &amp; Media
      </h2>
      <p className="page-subtitle">
        Latest road accident coverage from video reports and live news feeds across Bangladesh.
      </p>

      <YouTubeNews limit={12} />
      <LiveNews limit={20} />
    </div>
  );
}
