import { useState, useEffect } from 'react';
import BDLogo from './BDLogo';

/**
 * Branded splash screen shown while the app initializes.
 * AI-themed with neural network node animation, progress bar,
 * and fades out after data is ready.
 */
export default function SplashScreen({ onFinished }) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Animate progress bar 0→100 over ~2.8s
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Ease-out: start fast, slow near end
        const increment = Math.max(1, Math.floor((100 - prev) / 12));
        return Math.min(prev + increment, 100);
      });
    }, 60);

    // Minimum display time ensures the splash isn't just a flash
    const minTimer = setTimeout(() => {
      setFadeOut(true);
    }, 3200);

    const exitTimer = setTimeout(() => {
      onFinished?.();
    }, 4000); // 3.2s display + 0.8s fade-out

    return () => {
      clearInterval(interval);
      clearTimeout(minTimer);
      clearTimeout(exitTimer);
    };
  }, [onFinished]);

  return (
    <div className={`splash-screen ${fadeOut ? 'splash-fade-out' : ''}`}>
      {/* Neural network background nodes */}
      <svg className="splash-neural-bg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
        {/* Connection lines */}
        <line x1="60" y1="80" x2="180" y2="160" stroke="#00b882" strokeWidth="0.5" opacity="0.15"><animate attributeName="opacity" values="0.08;0.2;0.08" dur="3s" repeatCount="indefinite" /></line>
        <line x1="340" y1="60" x2="220" y2="160" stroke="#00b882" strokeWidth="0.5" opacity="0.15"><animate attributeName="opacity" values="0.08;0.2;0.08" dur="4s" repeatCount="indefinite" /></line>
        <line x1="50" y1="320" x2="180" y2="240" stroke="#00b882" strokeWidth="0.5" opacity="0.15"><animate attributeName="opacity" values="0.08;0.2;0.08" dur="3.5s" repeatCount="indefinite" /></line>
        <line x1="350" y1="340" x2="220" y2="240" stroke="#00b882" strokeWidth="0.5" opacity="0.15"><animate attributeName="opacity" values="0.08;0.2;0.08" dur="4.5s" repeatCount="indefinite" /></line>
        <line x1="180" y1="160" x2="220" y2="240" stroke="#00b882" strokeWidth="0.5" opacity="0.12"><animate attributeName="opacity" values="0.06;0.18;0.06" dur="2.5s" repeatCount="indefinite" /></line>
        <line x1="220" y1="160" x2="180" y2="240" stroke="#00b882" strokeWidth="0.5" opacity="0.12"><animate attributeName="opacity" values="0.06;0.18;0.06" dur="3s" repeatCount="indefinite" /></line>
        {/* Nodes */}
        <circle cx="60" cy="80" r="3" fill="#00b882" opacity="0.3"><animate attributeName="opacity" values="0.15;0.4;0.15" dur="3s" repeatCount="indefinite" /></circle>
        <circle cx="340" cy="60" r="2.5" fill="#00b882" opacity="0.25"><animate attributeName="opacity" values="0.12;0.35;0.12" dur="4s" repeatCount="indefinite" /></circle>
        <circle cx="50" cy="320" r="2.5" fill="#00b882" opacity="0.25"><animate attributeName="opacity" values="0.12;0.35;0.12" dur="3.5s" repeatCount="indefinite" /></circle>
        <circle cx="350" cy="340" r="3" fill="#00b882" opacity="0.3"><animate attributeName="opacity" values="0.15;0.4;0.15" dur="4.5s" repeatCount="indefinite" /></circle>
        <circle cx="180" cy="160" r="4" fill="#00b882" opacity="0.35"><animate attributeName="opacity" values="0.2;0.5;0.2" dur="2.5s" repeatCount="indefinite" /></circle>
        <circle cx="220" cy="240" r="4" fill="#00b882" opacity="0.35"><animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" /></circle>
        <circle cx="200" cy="50" r="2" fill="#F42A41" opacity="0.2"><animate attributeName="opacity" values="0.1;0.3;0.1" dur="3.8s" repeatCount="indefinite" /></circle>
        <circle cx="200" cy="350" r="2" fill="#F42A41" opacity="0.2"><animate attributeName="opacity" values="0.1;0.3;0.1" dur="4.2s" repeatCount="indefinite" /></circle>
      </svg>

      <div className="splash-content">
        <div className="splash-logo">
          <BDLogo size={80} />
        </div>

        <h1 className="splash-title">
          Traffic Insight <span className="splash-title-accent">BD</span>
        </h1>

        <p className="splash-tagline">AI-Powered Road Safety Intelligence</p>
        <p className="splash-mission">Because every life on the road matters.</p>

        <div className="splash-progress-track">
          <div
            className="splash-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="splash-status">
          {progress < 20 ? 'Connecting to data sources...' :
           progress < 45 ? 'Loading AI models...' :
           progress < 70 ? 'Analyzing accident patterns...' :
           progress < 100 ? 'Generating insights...' : 'Ready'}
        </p>
      </div>
    </div>
  );
}
