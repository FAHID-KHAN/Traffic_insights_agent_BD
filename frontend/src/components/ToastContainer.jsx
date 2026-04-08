import { FaCheckCircle, FaExclamationCircle, FaInfoCircle } from 'react-icons/fa';

const icons = {
  success: <FaCheckCircle style={{ color: 'var(--accent-green)' }} />,
  error: <FaExclamationCircle style={{ color: 'var(--accent-red)' }} />,
  info: <FaInfoCircle style={{ color: 'var(--accent-blue)' }} />,
};

export default function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {icons[t.type] || icons.info}
          <span style={{ flex: 1 }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
