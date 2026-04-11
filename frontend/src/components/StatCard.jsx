export default function StatCard({ label, value, sub, icon, color }) {
  const bgMap = {
    cyan: 'rgba(6,182,212,0.15)',
    red: 'rgba(239,68,68,0.15)',
    orange: 'rgba(249,115,22,0.15)',
    green: 'rgba(34,197,94,0.15)',
    purple: 'rgba(168,85,247,0.15)',
    blue: 'rgba(59,130,246,0.15)',
  };

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
        {value == null ? '—' : typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
