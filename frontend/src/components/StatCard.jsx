import { useState, useEffect, useRef } from 'react';

function useCountUp(target, duration = 1200) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    if (typeof target !== 'number' || target === prev.current) return;
    const start = prev.current;
    const diff = target - start;
    const startTime = performance.now();

    let raf;
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prev.current = target;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

export default function StatCard({ label, value, sub, icon, color }) {
  const bgMap = {
    cyan: 'rgba(6,182,212,0.15)',
    red: 'rgba(239,68,68,0.15)',
    orange: 'rgba(249,115,22,0.15)',
    green: 'rgba(34,197,94,0.15)',
    purple: 'rgba(168,85,247,0.15)',
    blue: 'rgba(59,130,246,0.15)',
  };

  const isNum = typeof value === 'number';
  const animated = useCountUp(isNum ? value : 0);

  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        {icon && (
          <div className="stat-icon" style={{ background: bgMap[color] || bgMap.cyan }}>
            {icon}
          </div>
        )}
      </div>
      <div className={`stat-value text-${color || 'cyan'}`}>
        {isNum ? animated.toLocaleString() : value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
