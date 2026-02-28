import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import ReportCard from '../components/ReportCard';
import {
  FaUsers, FaPlus, FaTimes, FaExclamationTriangle,
  FaSpinner, FaUpload, FaImage, FaChevronDown, FaCamera, FaFlag,
} from 'react-icons/fa';

/* ── Constants ─────────────────────────────────────────────── */
const DIVISIONS = [
  'Dhaka', 'Chittagong', 'Rajshahi', 'Khulna',
  'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh',
];

const ACCIDENT_TYPES = [
  'Road accident', 'Bus accident', 'Truck accident',
  'Motorcycle accident', 'Auto-rickshaw accident',
  'Train accident', 'Pedestrian accident', 'Multi-vehicle collision',
];

const PAGE_SIZE = 12;

/* ── Helpers ────────────────────────────────────────────────── */
function today() {
  return new Date().toISOString().split('T')[0];
}

/* ── ReportForm (modal) ──────────────────────────────────────── */
function ReportForm({ districts, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [previewUrls, setPreviewUrls] = useState([]);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    reporter_name: '',
    title: '',
    description: '',
    incident_date: today(),
    incident_time: '',
    location_text: '',
    district: '',
    division: '',
    accident_type: 'Road Accident',
    fatalities: 0,
    injuries: 0,
  });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleFiles = (e) => {
    const files = Array.from(e.target.files).slice(0, 5);
    setPreviewUrls(files.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.incident_date) { setError('Incident date is required.'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (fileRef.current?.files) {
        Array.from(fileRef.current.files).slice(0, 5).forEach((f) => fd.append('images', f));
      }

      const res = await fetch('/api/reports', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || `Server error ${res.status}`);
        return;
      }
      onSuccess(data.id);
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box report-modal">
        <div className="modal-header">
          <h3><FaExclamationTriangle style={{ color: 'var(--accent-red)' }} /> Report an Incident</h3>
          <button className="modal-close" onClick={onClose}><FaTimes /></button>
        </div>

        <form className="report-form" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          {/* ── Reporter + Title ── */}
          <div className="form-row">
            <div className="form-group">
              <label>Your Name <span className="form-optional">(optional)</span></label>
              <input
                type="text"
                placeholder="Anonymous"
                maxLength={80}
                value={form.reporter_name}
                onChange={set('reporter_name')}
              />
            </div>
            <div className="form-group form-group-grow">
              <label>Incident Title <span className="form-required">*</span></label>
              <input
                type="text"
                placeholder="e.g. Bus crash on Dhaka-Chittagong highway"
                maxLength={200}
                required
                value={form.title}
                onChange={set('title')}
              />
            </div>
          </div>

          {/* ── Date + Time ── */}
          <div className="form-row">
            <div className="form-group">
              <label>Date of Incident <span className="form-required">*</span></label>
              <input
                type="date"
                required
                max={today()}
                value={form.incident_date}
                onChange={set('incident_date')}
              />
            </div>
            <div className="form-group">
              <label>Time <span className="form-optional">(optional)</span></label>
              <input
                type="time"
                value={form.incident_time}
                onChange={set('incident_time')}
              />
            </div>
            <div className="form-group form-group-grow">
              <label>Accident Type</label>
              <select value={form.accident_type} onChange={set('accident_type')}>
                {ACCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Location ── */}
          <div className="form-row">
            <div className="form-group form-group-grow">
              <label>Location / Address <span className="form-optional">(optional)</span></label>
              <input
                type="text"
                placeholder="e.g. Meghna Bridge, near Comilla"
                value={form.location_text}
                onChange={set('location_text')}
              />
            </div>
            <div className="form-group">
              <label>District</label>
              <select value={form.district} onChange={set('district')}>
                <option value="">— Any —</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Division</label>
              <select value={form.division} onChange={set('division')}>
                <option value="">— Any —</option>
                {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* ── Casualties ── */}
          <div className="form-row">
            <div className="form-group">
              <label>Deaths</label>
              <input
                type="number"
                min={0}
                value={form.fatalities}
                onChange={set('fatalities')}
              />
            </div>
            <div className="form-group">
              <label>Injuries</label>
              <input
                type="number"
                min={0}
                value={form.injuries}
                onChange={set('injuries')}
              />
            </div>
          </div>

          {/* ── Description ── */}
          <div className="form-group">
            <label>Description <span className="form-optional">(optional)</span></label>
            <textarea
              placeholder="Describe what happened, vehicle types, road conditions, eyewitness details…"
              rows={4}
              value={form.description}
              onChange={set('description')}
            />
          </div>

          {/* ── Image upload ── */}
          <div className="form-group">
            <label><FaImage /> Photos <span className="form-optional">(up to 5, max 8 MB each)</span></label>
            <div
              className="file-drop-zone"
              onClick={() => fileRef.current?.click()}
            >
              <FaUpload />
              <span>Click to upload photos</span>
              <span className="file-hint">JPEG, PNG, WebP, GIF</span>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleFiles}
              />
            </div>
            {previewUrls.length > 0 && (
              <div className="file-previews">
                {previewUrls.map((url, i) => (
                  <img key={i} src={url} alt={`Preview ${i + 1}`} className="file-preview-thumb" />
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <><FaSpinner className="spin" /> Submitting…</> : <><FaPlus /> Submit Report</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── CommunityFeed page ─────────────────────────────────────── */
export default function CommunityFeed() {
  const [reports, setReports]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [offset, setOffset]       = useState(0);
  const [loading, setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [successId, setSuccessId] = useState(null);
  const [districts, setDistricts] = useState([]);

  /* filters */
  const [filterDistrict,  setFilterDistrict]  = useState('');
  const [filterDivision,  setFilterDivision]  = useState('');
  const [filterType,      setFilterType]      = useState('');

  /* Load district list from existing danger-zones endpoint */
  useEffect(() => {
    api('/danger-zones?limit=100')
      .then((data) => {
        const list = [...new Set(data.map((d) => d.district).filter(Boolean))].sort();
        setDistricts(list);
      })
      .catch(() => {});
  }, []);

  /* Fetch page of reports */
  const loadReports = useCallback(async (newOffset = 0, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: newOffset });
      if (filterDistrict) params.set('district', filterDistrict);
      if (filterDivision) params.set('division', filterDivision);
      if (filterType)     params.set('accident_type', filterType);

      const data = await api(`/reports?${params.toString()}`);
      setTotal(data.total ?? 0);
      setReports((prev) => append ? [...prev, ...data.items] : data.items);
      setOffset(newOffset);
    } catch (err) {
      console.error('Feed error:', err);
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, [filterDistrict, filterDivision, filterType]);

  /* Initial load + reload on filter change */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadReports(0, false); }, [loadReports]);

  const handleLoadMore = () => loadReports(offset + PAGE_SIZE, true);

  const handleFilterReset = () => {
    setFilterDistrict('');
    setFilterDivision('');
    setFilterType('');
  };

  const handleSuccess = (id) => {
    setSuccessId(id);
    setShowForm(false);
    loadReports(0, false);
  };

  const hasMore = reports.length < total;
  const hasFilters = filterDistrict || filterDivision || filterType;

  return (
    <div className="community-feed">
      {/* ── Page heading ── */}
      <h2 className="feed-page-title"><FaUsers style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} /> Community Feed</h2>

      {/* ── Compose box ── */}
      <div className="feed-compose">
        <div className="feed-compose-row">
          <span className="feed-compose-avatar">Y</span>
          <button
            className="feed-compose-btn"
            onClick={() => { setSuccessId(null); setShowForm(true); }}
          >
            Share an incident near you…
          </button>
        </div>
        <div className="feed-compose-divider" />
        <div className="feed-compose-actions">
          <button className="feed-compose-action photo" onClick={() => { setSuccessId(null); setShowForm(true); }}>
            <FaCamera /> Photo
          </button>
          <button className="feed-compose-action report" onClick={() => { setSuccessId(null); setShowForm(true); }}>
            <FaFlag /> Report Incident
          </button>
          <button className="feed-compose-action" onClick={() => { setSuccessId(null); setShowForm(true); }}>
            <FaPlus /> Report
          </button>
        </div>
      </div>

      {/* ── Success toast ── */}
      {successId && (
        <div className="form-success">
          ✅ Report #{successId} submitted successfully! It will appear in the feed shortly.
          <button className="form-success-close" onClick={() => setSuccessId(null)}>✕</button>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="feed-filters-bar">
        <select
          className="feed-filter-select"
          value={filterDivision}
          onChange={(e) => setFilterDivision(e.target.value)}
        >
          <option value="">All Divisions</option>
          {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          className="feed-filter-select"
          value={filterDistrict}
          onChange={(e) => setFilterDistrict(e.target.value)}
        >
          <option value="">All Districts</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          className="feed-filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          {ACCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {hasFilters && (
          <button className="btn btn-outline btn-xs" onClick={handleFilterReset}>
            <FaTimes /> Clear
          </button>
        )}
        <span className="feed-stats-label">{total} report{total !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Feed ── */}
      {loading ? (
        <div className="feed-loading">
          <FaSpinner className="spin" style={{ fontSize: '2rem', color: 'var(--bd-green-bright)' }} />
          <p>Loading reports…</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="feed-empty">
          <FaUsers style={{ fontSize: '3rem', color: 'var(--text-muted)' }} />
          <h4>No reports yet{hasFilters ? ' matching your filters' : ''}</h4>
          <p>Be the first to report an incident in your area.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <FaPlus /> Report an Incident
          </button>
        </div>
      ) : (
        <>
          <div className="feed-grid">
            {reports.map((r) => (
              <ReportCard key={r.id} report={r} onUpvote={() => {}} />
            ))}
          </div>

          {hasMore && (
            <div className="feed-load-more">
              <button
                className="btn btn-outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <><FaSpinner className="spin" /> Loading…</>
                  : <><FaChevronDown /> Load More ({total - reports.length} remaining)</>
                }
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Submit form modal ── */}
      {showForm && (
        <ReportForm
          districts={districts}
          onClose={() => setShowForm(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
