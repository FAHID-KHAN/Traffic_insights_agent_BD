/**
 * Bangladesh-themed Traffic Insight BD logo.
 * Combines the BD flag palette (bottle-green + red circle)
 * with a perspective road vanishing toward the "sun".
 */
export default function BDLogo({ size = 42 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Traffic Insight BD logo"
    >
      {/* ── background ─────────────────────────── */}
      <defs>
        <linearGradient id="bd-bg" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#008c5e" />
          <stop offset="100%" stopColor="#004d3a" />
        </linearGradient>
        <linearGradient id="road-grad" x1="24" y1="26" x2="24" y2="47">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      <rect
        x="1" y="1" width="46" height="46"
        rx="12" fill="url(#bd-bg)"
        stroke="#00b87a" strokeWidth="0.6"
      />

      {/* ── red circle (BD flag, offset left of centre) ── */}
      <circle cx="22" cy="17" r="9.5" fill="#F42A41" />

      {/* white inner glow on circle */}
      <circle cx="21" cy="15.5" r="5" fill="white" opacity="0.08" />

      {/* ── road in perspective ────────────────── */}
      <polygon
        points="17,47 31,47 26.5,26 21.5,26"
        fill="url(#road-grad)" opacity="0.85"
      />

      {/* road edge lines */}
      <line x1="17" y1="47" x2="21.5" y2="26" stroke="#334155" strokeWidth="0.5" />
      <line x1="31" y1="47" x2="26.5" y2="26" stroke="#334155" strokeWidth="0.5" />

      {/* centre-line dashes (yellow, widening toward viewer) */}
      <line x1="24" y1="28" x2="24" y2="31"
        stroke="#fbbf24" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="24" y1="34" x2="24" y2="37.5"
        stroke="#fbbf24" strokeWidth="1.35" strokeLinecap="round" />
      <line x1="24" y1="40.5" x2="24" y2="45"
        stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round" />

      {/* subtle horizon line */}
      <line x1="4" y1="26" x2="44" y2="26"
        stroke="white" strokeWidth="0.3" opacity="0.25" />
    </svg>
  );
}
