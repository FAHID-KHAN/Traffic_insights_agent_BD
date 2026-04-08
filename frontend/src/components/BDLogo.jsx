/**
 * Bangladesh-themed Traffic Insight BD logo.
 * BD flag palette: bottle-green + red circle. Road + data motif.
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
      <defs>
        <linearGradient id="bd-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00875a" />
          <stop offset="100%" stopColor="#004d38" />
        </linearGradient>
        <linearGradient id="road-g" x1="24" y1="30" x2="24" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a2e25" />
          <stop offset="100%" stopColor="#0d1a14" />
        </linearGradient>
        <radialGradient id="circle-g" cx="45%" cy="42%" r="55%" fx="38%" fy="36%">
          <stop offset="0%" stopColor="#ff4d63" />
          <stop offset="100%" stopColor="#d41430" />
        </radialGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#bd-bg)" />

      {/* Subtle inner border */}
      <rect x="1" y="1" width="46" height="46" rx="13" stroke="#00c47a" strokeWidth="0.8" strokeOpacity="0.4" fill="none" />

      {/* BD flag red circle — large, centered slightly left-up */}
      <circle cx="22" cy="20" r="11" fill="url(#circle-g)" filter="url(#glow)" />

      {/* Sheen on circle */}
      <ellipse cx="19" cy="16.5" rx="4.5" ry="2.8" fill="white" opacity="0.12" />

      {/* Road surface at bottom */}
      <path d="M8 47 L14 30 L34 30 L40 47 Z" fill="url(#road-g)" />

      {/* Road edge lines */}
      <line x1="8" y1="47" x2="14" y2="30" stroke="#2d4a3c" strokeWidth="0.6" />
      <line x1="40" y1="47" x2="34" y2="30" stroke="#2d4a3c" strokeWidth="0.6" />

      {/* Horizon line */}
      <line x1="4" y1="30" x2="44" y2="30" stroke="white" strokeWidth="0.35" strokeOpacity="0.18" />

      {/* Center-line dashes — widening toward viewer */}
      <line x1="24" y1="32.5" x2="24" y2="35" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="24" y1="37.5" x2="24" y2="40.5" stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="24" y1="43" x2="24" y2="46.5" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />

      {/* White chart / trend arrow on red circle — 3 bars rising */}
      <rect x="16" y="23" width="2.5" height="4" rx="0.7" fill="white" opacity="0.88" />
      <rect x="20" y="20.5" width="2.5" height="6.5" rx="0.7" fill="white" opacity="0.88" />
      <rect x="24" y="17.5" width="2.5" height="9.5" rx="0.7" fill="white" opacity="0.88" />
    </svg>
  );
}
