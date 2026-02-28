import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './utils/useTheme';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import Dashboard from './pages/Dashboard';
import Daily from './pages/Daily';
import Monthly from './pages/Monthly';
import DangerMap from './pages/DangerMap';
import Zones from './pages/Zones';
import Records from './pages/Records';
import Compare from './pages/Compare';
import SearchPage from './pages/SearchPage';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinished = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <ThemeProvider>
      {showSplash && <SplashScreen onFinished={handleSplashFinished} />}
      <BrowserRouter>
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
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
