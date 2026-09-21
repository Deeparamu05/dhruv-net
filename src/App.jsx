import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './views/DashboardView';
import SensorDataView from './views/SensorDataView';
import LiveMapView from './views/LiveMapView';
import AnalyticsView from './views/AnalyticsView';
import { getPlatformStatus, getLatestSensorReadings } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Platform & Telemetry state
  const [platformStatus, setPlatformStatus] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [liveGpsCoords, setLiveGpsCoords] = useState(null);

  // Handle GPS module / Geolocation live update
  const handleGpsUpdate = useCallback((gpsFix) => {
    if (gpsFix && gpsFix.lat != null && gpsFix.lng != null) {
      setLiveGpsCoords({
        lat: gpsFix.lat,
        lng: gpsFix.lng,
        formatted: gpsFix.formatted || `${gpsFix.lat.toFixed(4)}° N, ${gpsFix.lng.toFixed(4)}° E`
      });
    }
  }, []);

  // Fetch telemetry
  const fetchTelemetryData = useCallback(async () => {
    try {
      const [statusData, sensorData] = await Promise.all([
        getPlatformStatus(),
        getLatestSensorReadings()
      ]);
      setPlatformStatus(statusData);
      setTelemetry(sensorData);
    } catch (err) {
      console.error("Telemetry fetch error:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTelemetryData();
  }, [fetchTelemetryData]);

  // Live polling stream (every 2.5s when active)
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      fetchTelemetryData();
    }, 2500);
    return () => clearInterval(interval);
  }, [isLiveStreaming, fetchTelemetryData]);

  // Manual refresh trigger
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchTelemetryData();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const toggleLiveStream = () => {
    setIsLiveStreaming((prev) => !prev);
  };

  // Merge live GPS coordinates if active
  const effectivePlatformStatus = liveGpsCoords && platformStatus ? {
    ...platformStatus,
    coordinates: liveGpsCoords
  } : platformStatus;

  const effectiveTelemetry = liveGpsCoords && telemetry ? {
    ...telemetry,
    coordinates: liveGpsCoords
  } : telemetry;

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header 
          activeTab={activeTab}
          platformStatus={effectivePlatformStatus}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          onToggleMenu={() => setIsSidebarOpen((prev) => !prev)}
        />

        <main className="view-content">
          {activeTab === 'dashboard' && (
            <DashboardView 
              telemetry={effectiveTelemetry}
              platformStatus={effectivePlatformStatus}
              onNavigateToMap={() => setActiveTab('map')}
              onNavigateToAnalytics={() => setActiveTab('analytics')}
            />
          )}

          {activeTab === 'sensors' && (
            <SensorDataView 
              telemetry={effectiveTelemetry}
              isLiveStreaming={isLiveStreaming}
              toggleLiveStream={toggleLiveStream}
            />
          )}

          {activeTab === 'map' && (
            <LiveMapView 
              telemetry={effectiveTelemetry}
              platformStatus={effectivePlatformStatus}
              onGpsUpdate={handleGpsUpdate}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView />
          )}
        </main>
      </div>
    </div>
  );
}
