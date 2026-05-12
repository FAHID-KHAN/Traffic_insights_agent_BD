import VehicleAnalytics from '../components/VehicleAnalytics';
import RoadAnalysis from '../components/RoadAnalysis';
import BlackspotDetection from '../components/BlackspotDetection';
import { FaCar } from 'react-icons/fa';

export default function VehiclesRoads() {
  return (
    <div className="insights-page">
      <h2 className="page-title">
        <FaCar className="text-cyan" /> Vehicles &amp; Roads
      </h2>
      <p className="page-subtitle">
        Breakdown of accident fatality by vehicle type, analysis of the most dangerous roads and
        highways, and geographic blackspot detection across Bangladesh.
      </p>

      <VehicleAnalytics />
      <RoadAnalysis />
      <BlackspotDetection />
    </div>
  );
}
