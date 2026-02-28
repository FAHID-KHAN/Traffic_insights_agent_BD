import { useState, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './utils/useTheme';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import SplashScreen from './components/SplashScreen';

/* ── Lazy-loaded pages (code-split into separate chunks) ────── */
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Daily      = lazy(() => import('./pages/Daily'));
const Monthly    = lazy(() => import('./pages/Monthly'));
const DangerMap  = lazy(() => import('./pages/DangerMap'));
const Zones      = lazy(() => import('./pages/Zones'));
const Records    = lazy(() => import('./pages/Records'));
const Compare    = lazy(() => import('./pages/Compare'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const NotFound   = lazy(() => import('./pages/NotFound'));

/* ── Inline fallback shown while a lazy chunk loads ─────────── */
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-spinner" />
      <p>Loading...</p>
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinished = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        {showSplash && <SplashScreen onFinished={handleSplashFinished} />}
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="daily" element={<Daily />} />
                <Route path="monthly" element={<Monthly />} />
                <Route path="map" element={<DangerMap />} />
                <Route path="zones" element={<Zones />} />
                <Route path="compare" element={<Compare />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="records" element={<Records />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
