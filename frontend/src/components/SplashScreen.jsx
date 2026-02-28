import { useState, useEffect } from 'react';
import BDLogo from './BDLogo';

/**
 * Branded splash screen shown while the app initializes.
 * Displays the BD logo with a pulse animation, app name,
 * a gradient progress bar, and fades out after data is ready.
 */
export default function SplashScreen({ onFinished }) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Animate progress bar 0→100 over ~1.8s
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Ease-out: start fast, slow near end
        const increment = Math.max(1, Math.floor((100 - prev) / 8));
        return Math.min(prev + increment, 100);
      });
    }, 50);

    // Minimum display time ensures the splash isn't just a flash
    const minTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2000);

    const exitTimer = setTimeout(() => {
      onFinished?.();
    }, 2600); // 2s display + 0.6s fade-out

    return () => {
      clearInterval(interval);
      clearTimeout(minTimer);
      clearTimeout(exitTimer);
    };
  }, [onFinished]);

  return (
    <div className={`splash-screen ${fadeOut ? 'splash-fade-out' : ''}`}>
      <div className="splash-content">
        {/* Animated logo */}
        <div className="splash-logo">
          <BDLogo size={80} />
        </div>

        {/* App name */}
        <h1 className="splash-title">
          Traffic Insight <span className="splash-title-accent">BD</span>
        </h1>

        {/* Tagline */}
        <p className="splash-tagline">Bangladesh Road Safety Analytics</p>

        {/* Progress bar */}
        <div className="splash-progress-track">
          <div
            className="splash-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="splash-status">
          {progress < 30 ? 'Initializing...' :
           progress < 70 ? 'Loading dashboard...' :
           progress < 100 ? 'Almost ready...' : 'Welcome'}
        </p>
      </div>

      {/* Background decoration */}
      <div className="splash-bg-circle splash-bg-circle-1" />
      <div className="splash-bg-circle splash-bg-circle-2" />
      <div className="splash-bg-circle splash-bg-circle-3" />
    </div>
  );
}
