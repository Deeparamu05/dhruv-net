import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './views/DashboardView';
import SensorDataView from './views/SensorDataView';
import LiveMapView from './views/LiveMapView';
import AnalyticsView from './views/AnalyticsView';
import AlertsView from './views/AlertsView';
import PowerSystemView from './views/PowerSystemView';
import DataSyncView from './views/DataSyncView';
import DataExportView from './views/DataExportView';
import { 
  getPlatformStatus, 
  getLatestSensorReadings, 
  getAlerts, 
  resolveAlert, 
  getSyncStatus, 
  triggerSync, 
  setLocalSyncConnection,
  setHardwareConnectedState,
  getHardwareConnectedState,
  hwWebSocket
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Platform & Telemetry state
  const [platformStatus, setPlatformStatus] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [syncState, setSyncState] = useState({
    localRecords: 248,
    uploadedRecords: 230,
    pendingRecords: 18,
    lastSuccessfulSync: new Date(Date.now() - 45000).toISOString(),
    connectionStatus: "Connected"
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [liveGpsCoords, setLiveGpsCoords] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Priority lock ref: once real WebSocket hardware packet arrives, polling CANNOT overwrite it!
  const hasRealPacketRef = useRef(false);

  // Live GPS Fix callback from LiveMapView
  const handleGpsUpdate = useCallback((gpsFix) => {
    if (gpsFix && gpsFix.lat != null && gpsFix.lng != null) {
      setLiveGpsCoords({
        lat: gpsFix.lat,
        lng: gpsFix.lng,
        formatted: gpsFix.formatted || `${gpsFix.lat.toFixed(4)}° N, ${gpsFix.lng.toFixed(4)}° E`
      });
    }
  }, []);

  // Update telemetry & platform state with incoming validated hardware packet
  const applyLiveSensorPacket = useCallback((packet, connection) => {
    if (!packet) return;
    hasRealPacketRef.current = true;
    const isConn = connection?.status === 'CONNECTED';
    const sensorStatusText = connection?.sensorStatus === 'LIVE' ? 'Normal' : (connection?.sensorStatus || 'Normal');

    setTelemetry(prev => {
      const existingSensors = prev?.sensors || {};
      return {
        platformId: packet.deviceId || "DHRUV-01",
        timestamp: packet.timestamp || new Date().toISOString(),
        displayTime: new Date(packet.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        coordinates: {
          lat: packet.latitude ?? (prev?.coordinates?.lat ?? 11.6643),
          lng: packet.longitude ?? (prev?.coordinates?.lng ?? 78.1460),
          formatted: `${(packet.latitude ?? 11.6643).toFixed(4)}° N, ${(packet.longitude ?? 78.1460).toFixed(4)}° E`
        },
        battery: packet.battery != null ? packet.battery : prev?.battery,
        batteryVoltage: packet.batteryVoltage != null ? packet.batteryVoltage : prev?.batteryVoltage,
        hardwareConnected: isConn,
        isSimulated: false,
        sensors: {
          waterTemperature: {
            name: "Water Temperature",
            value: packet.waterTemperature !== null ? packet.waterTemperature : existingSensors.waterTemperature?.value,
            unit: "°C",
            source: "DS18B20",
            status: sensorStatusText,
            trend: "steady"
          },
          airTemperature: {
            name: "Air Temperature",
            value: packet.airTemperature !== null ? packet.airTemperature : existingSensors.airTemperature?.value,
            unit: "°C",
            source: "DHT22",
            status: sensorStatusText,
            trend: "steady"
          },
          humidity: {
            name: "Humidity",
            value: packet.humidity !== null ? packet.humidity : existingSensors.humidity?.value,
            unit: "%",
            source: "DHT22",
            status: sensorStatusText,
            trend: "steady"
          },
          atmosphericPressure: {
            name: "Atmospheric Pressure",
            value: packet.pressure !== null ? packet.pressure : (packet.atmosphericPressure ?? existingSensors.atmosphericPressure?.value),
            unit: "hPa",
            source: "BMP280",
            status: sensorStatusText,
            trend: "steady"
          },
          depth: {
            name: "Ocean Depth",
            value: packet.depth !== null ? packet.depth : (existingSensors.depth?.value ?? 18.6),
            unit: "m",
            source: "Simulated / Future Sensor",
            status: "Normal",
            simulationNotice: "SIMULATED / FUTURE SENSOR"
          },
          orientation: {
            name: "Platform Orientation",
            roll: packet.roll ?? existingSensors.orientation?.roll ?? 0.0,
            pitch: packet.pitch ?? existingSensors.orientation?.pitch ?? 0.0,
            yaw: packet.yaw ?? existingSensors.orientation?.yaw ?? 0.0,
            unit: "°",
            source: "MPU6050",
            status: sensorStatusText
          },
          lora: {
            name: "LoRa Communication",
            status: "NOT CONNECTED",
            message: "Waiting for LoRa gateway (Future Uplink)",
            source: "LoRa RA-02",
            rssi: "Standby (Disconnected)",
            snr: "N/A"
          },
          gps: {
            name: "GPS Positioning",
            latitude: packet.latitude ?? 11.6643,
            longitude: packet.longitude ?? 78.1460,
            source: "GPS",
            satellites: 12,
            status: sensorStatusText
          }
        }
      };
    });

    if (connection) {
      setPlatformStatus(prev => ({
        ...(prev || {}),
        platformId: packet.deviceId || "DHRUV-01",
        hardwareConnected: isConn,
        nodeMcuStatus: connection.status,
        nodeMcuMessage: connection.message,
        sensorSystem: connection.sensorStatus,
        sensorSystemMessage: connection.message,
        lastSeen: connection.lastSeen,
        lastSeenIso: connection.lastSeenIso,
        packetsReceived: connection.packetsReceived,
        isSimulated: false,
        simulationNotice: connection.sensorStatus === 'LIVE' ? "LIVE HARDWARE TELEMETRY" : "LAST KNOWN HARDWARE DATA",
        coordinates: {
          lat: packet.latitude ?? 11.6643,
          lng: packet.longitude ?? 78.1460,
          formatted: `${(packet.latitude ?? 11.6643).toFixed(4)}° N, ${(packet.longitude ?? 78.1460).toFixed(4)}° E`
        }
      }));
    }
  }, []);

  // Fetch telemetry & system state from REST API
  const fetchTelemetryData = useCallback(async () => {
    try {
      const [statusData, sensorData, alertsData, syncData] = await Promise.all([
        getPlatformStatus(),
        getLatestSensorReadings(),
        getAlerts(),
        getSyncStatus()
      ]);
      // If a real WebSocket packet has already arrived, NEVER overwrite with polled/simulated data
      if (!hasRealPacketRef.current) {
        setPlatformStatus(statusData);
        setTelemetry(sensorData);
      }
      setAlerts(alertsData);
      if (syncData) setSyncState(syncData);
    } catch (err) {
      console.error("Telemetry fetch error:", err);
    }
  }, []);

  // Initial REST fetch on load
  useEffect(() => {
    fetchTelemetryData();
  }, [fetchTelemetryData]);

  // Establish persistent WebSocket connection & event subscription
  useEffect(() => {
    hwWebSocket.connect();

    const unsubscribe = hwWebSocket.subscribe((msg) => {
      if (msg.type === 'WS_STATUS') {
        setIsWsConnected(Boolean(msg.connected));
      } else if (msg.type === 'INIT') {
        if (msg.connection) {
          setPlatformStatus(prev => ({
            ...(prev || {}),
            ...msg.connection,
            hardwareConnected: msg.connection.status === 'CONNECTED',
            nodeMcuStatus: msg.connection.status,
            nodeMcuMessage: msg.connection.message,
            sensorSystem: msg.connection.sensorStatus,
            sensorSystemMessage: msg.connection.message,
            lastSeen: msg.connection.lastSeen,
            packetsReceived: msg.connection.packetsReceived
          }));
        }
        if (msg.data) {
          applyLiveSensorPacket(msg.data, msg.connection);
        }
      } else if (msg.type === 'SENSOR_UPDATE') {
        applyLiveSensorPacket(msg.data, msg.connection);
      } else if (msg.type === 'STATUS_UPDATE') {
        if (msg.connection) {
          setPlatformStatus(prev => ({
            ...(prev || {}),
            ...msg.connection,
            hardwareConnected: msg.connection.status === 'CONNECTED',
            nodeMcuStatus: msg.connection.status,
            nodeMcuMessage: msg.connection.message,
            sensorSystem: msg.connection.sensorStatus,
            sensorSystemMessage: msg.connection.message,
            lastSeen: msg.connection.lastSeen,
            packetsReceived: msg.connection.packetsReceived
          }));

          // When connection status transitions to STALE or OFFLINE, update badges but KEEP the sensor values!
          setTelemetry(prev => {
            if (!prev || !prev.sensors) return prev;
            const statusText = msg.connection.sensorStatus === 'LIVE' ? 'Normal' : msg.connection.sensorStatus;
            return {
              ...prev,
              sensors: {
                ...prev.sensors,
                waterTemperature: { ...prev.sensors.waterTemperature, status: statusText },
                airTemperature: { ...prev.sensors.airTemperature, status: statusText },
                humidity: { ...prev.sensors.humidity, status: statusText },
                atmosphericPressure: { ...prev.sensors.atmosphericPressure, status: statusText },
                orientation: { ...prev.sensors.orientation, status: statusText }
              }
            };
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [applyLiveSensorPacket]);

  // Fallback background polling (every 4s) when live streaming is toggled on
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      // Periodic check if WebSocket dropped
      if (!isWsConnected) {
        fetchTelemetryData();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isLiveStreaming, isWsConnected, fetchTelemetryData]);

  // Manual refresh trigger
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchTelemetryData();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const toggleLiveStream = () => {
    setIsLiveStreaming((prev) => !prev);
  };

  // Resolve Alert action
  const handleResolveAlert = async (alertId) => {
    const updated = await resolveAlert(alertId);
    setAlerts([...updated]);
  };

  // Sync Trigger action
  const handleTriggerSync = async () => {
    const updated = await triggerSync();
    setSyncState({ ...updated });
  };

  // Toggle Connection action
  const handleToggleConnection = (isConnected) => {
    const updated = setLocalSyncConnection(isConnected);
    setSyncState({ ...updated });
  };

  // Toggle Test Hardware Connection state (for verification/testing)
  const handleToggleTestHardware = async () => {
    const currentState = getHardwareConnectedState();
    setHardwareConnectedState(!currentState);
    try {
      if (import.meta.env.VITE_API_BASE_URL) {
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/hardware/toggle-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connected: !currentState })
        });
      }
    } catch (e) {
      // Backend not running
    }
    await fetchTelemetryData();
  };

  // Active alerts count calculation
  const activeAlertCount = alerts.filter((a) => a.status === 'Active').length;

  // Merge live GPS coordinates if provided
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
        activeAlertCount={activeAlertCount}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header 
          activeTab={activeTab}
          platformStatus={effectivePlatformStatus}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          onToggleMenu={() => setIsSidebarOpen((prev) => !prev)}
          activeAlertCount={activeAlertCount}
          onNavigateToAlerts={() => setActiveTab('alerts')}
          isWsConnected={isWsConnected}
        />

        <main className="view-content">
          {/* 1. Dashboard View */}
          {activeTab === 'dashboard' && (
            <DashboardView 
              telemetry={effectiveTelemetry}
              platformStatus={effectivePlatformStatus}
              onNavigateToMap={() => setActiveTab('map')}
              onNavigateToAnalytics={() => setActiveTab('analytics')}
              onNavigateToSensors={() => setActiveTab('sensors')}
              onToggleTestHardware={handleToggleTestHardware}
              isWsConnected={isWsConnected}
            />
          )}

          {/* 2. Sensor Data View */}
          {activeTab === 'sensors' && (
            <SensorDataView 
              telemetry={effectiveTelemetry}
              platformStatus={effectivePlatformStatus}
              isLiveStreaming={isLiveStreaming}
              toggleLiveStream={toggleLiveStream}
              onToggleTestHardware={handleToggleTestHardware}
            />
          )}

          {/* 3. Live Monitoring / Map View */}
          {activeTab === 'map' && (
            <LiveMapView 
              telemetry={effectiveTelemetry}
              platformStatus={effectivePlatformStatus}
              onGpsUpdate={handleGpsUpdate}
            />
          )}

          {/* 4. Analytics View */}
          {activeTab === 'analytics' && (
            <AnalyticsView />
          )}

          {/* 5. Alerts View */}
          {activeTab === 'alerts' && (
            <AlertsView 
              alerts={alerts}
              onResolveAlert={handleResolveAlert}
            />
          )}

          {/* 6. Power & System View */}
          {activeTab === 'power' && (
            <PowerSystemView 
              telemetry={effectiveTelemetry}
              platformStatus={effectivePlatformStatus}
            />
          )}

          {/* 7. Data Sync View */}
          {activeTab === 'sync' && (
            <DataSyncView 
              syncState={syncState}
              onTriggerSync={handleTriggerSync}
              onToggleConnection={handleToggleConnection}
            />
          )}

          {/* 8. Data Export View */}
          {activeTab === 'export' && (
            <DataExportView />
          )}
        </main>
      </div>
    </div>
  );
}
