import React, { useState, useEffect, useRef, useCallback } from 'react';
import LiveMap from '../components/LiveMap';
import { 
  Radio, 
  Cpu, 
  Smartphone, 
  Compass, 
  Terminal, 
  Play, 
  Square, 
  ChevronDown, 
  ChevronUp, 
  Sliders 
} from 'lucide-react';
import { 
  SerialGPSModule, 
  DeviceGPSTracker, 
  SimulatedGPSModule, 
  isWebSerialSupported,
  decimalToDMS 
} from '../services/gpsService';

const BAUD_RATES = [4800, 9600, 19200, 38400, 57600, 115200];

export default function LiveMapView({ 
  telemetry, 
  platformStatus,
  onGpsUpdate
}) {
  // GPS Source Mode: 'hardware' | 'device' | 'buoy' | 'simulator'
  const [gpsSource, setGpsSource] = useState('device');

  // Serial Hardware Configuration
  const [baudRate, setBaudRate] = useState(9600);
  const [serialStatus, setSerialStatus] = useState('disconnected'); // disconnected, requesting, connected, error
  const [serialError, setSerialError] = useState(null);

  // Device GPS Status
  const [deviceStatus, setDeviceStatus] = useState('idle'); // idle, acquiring, active, error
  const [deviceError, setDeviceError] = useState(null);

  // Simulator Status
  const [isSimRunning, setIsSimRunning] = useState(false);

  // NMEA Terminal Feed
  const [nmeaLogs, setNmeaLogs] = useState([]);
  const [showNmeaConsole, setShowNmeaConsole] = useState(false);

  // Active GPS State
  const [activeGps, setActiveGps] = useState({
    lat: telemetry?.coordinates?.lat || 15.2993,
    lng: telemetry?.coordinates?.lng || 73.8243,
    accuracy: 5,
    altitude: '12.4 m',
    speedKmh: 0,
    speedKnots: 0,
    heading: 0,
    satellites: '12 Sats',
    fixType: 'GNSS 3D Fix',
    isValid: true,
    lastUpdated: null
  });

  // Service Instance Refs
  const serialModuleRef = useRef(null);
  const deviceTrackerRef = useRef(null);
  const simulatorRef = useRef(null);

  // Log NMEA sentence to terminal buffer (up to 80 lines)
  const appendNmeaLog = useCallback((sentence) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setNmeaLogs((prev) => {
      const next = [...prev, { id: Math.random().toString(), time, text: sentence }];
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
  }, []);

  // Update App-wide GPS telemetry if available
  const handleFixReceived = useCallback((fix) => {
    setActiveGps((prev) => ({
      ...prev,
      lat: fix.lat != null ? fix.lat : prev.lat,
      lng: fix.lng != null ? fix.lng : prev.lng,
      accuracy: fix.accuracy != null ? fix.accuracy : (fix.hdop ? Math.round(fix.hdop * 5) : 5),
      altitude: fix.altitude || prev.altitude,
      speedKmh: fix.speedKmh != null ? fix.speedKmh : prev.speedKmh,
      speedKnots: fix.speedKnots != null ? fix.speedKnots : prev.speedKnots,
      heading: fix.heading != null ? fix.heading : prev.heading,
      satellites: fix.satellites != null ? (typeof fix.satellites === 'number' ? `${fix.satellites} Sats` : fix.satellites) : prev.satellites,
      fixType: fix.fixType || prev.fixType,
      isValid: fix.isValid ?? true,
      lastUpdated: new Date().toISOString()
    }));

    if (onGpsUpdate && fix.lat != null && fix.lng != null) {
      onGpsUpdate({
        lat: fix.lat,
        lng: fix.lng,
        formatted: decimalToDMS(fix.lat, fix.lng),
        source: gpsSource
      });
    }
  }, [gpsSource, onGpsUpdate]);

  // Sync with Buoy Telemetry when source is 'buoy'
  useEffect(() => {
    if (gpsSource === 'buoy' && telemetry?.coordinates) {
      setActiveGps((prev) => ({
        ...prev,
        lat: telemetry.coordinates.lat,
        lng: telemetry.coordinates.lng,
        accuracy: 8,
        speedKmh: 0.4,
        heading: 195,
        satellites: '12 Sats',
        fixType: 'Buoy Moored GNSS Fix'
      }));
    }
  }, [gpsSource, telemetry?.coordinates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (serialModuleRef.current) {
        serialModuleRef.current.disconnect();
      }
      if (deviceTrackerRef.current) {
        deviceTrackerRef.current.stop();
      }
      if (simulatorRef.current) {
        simulatorRef.current.stop();
      }
    };
  }, []);

  // --- SOURCE TOGGLING HANDLERS ---

  // 1. Device GPS Handler
  const startDeviceGps = () => {
    setDeviceError(null);
    if (!deviceTrackerRef.current) {
      deviceTrackerRef.current = new DeviceGPSTracker({
        onPosition: (fix) => {
          handleFixReceived(fix);
          appendNmeaLog(`$GNPOS,${fix.lat},${fix.lng},ACC=${fix.accuracy}m,SPD=${fix.speedKmh}kmh`);
        },
        onError: (err) => {
          setDeviceError(err.message || "Failed to access device GPS");
          setDeviceStatus('error');
        },
        onStatusChange: (status) => {
          setDeviceStatus(status);
        }
      });
    }
    deviceTrackerRef.current.start();
  };

  const stopDeviceGps = () => {
    if (deviceTrackerRef.current) {
      deviceTrackerRef.current.stop();
      setDeviceStatus('idle');
    }
  };

  // 2. Hardware Serial GPS Handler
  const connectSerialGps = async () => {
    setSerialError(null);
    try {
      const serialModule = new SerialGPSModule({
        baudRate,
        onSentence: (raw) => {
          appendNmeaLog(raw);
        },
        onFixUpdate: (fix) => {
          handleFixReceived(fix);
        },
        onError: (err) => {
          setSerialError(err.message);
          setSerialStatus('error');
        },
        onStatusChange: (st) => {
          setSerialStatus(st);
        }
      });

      serialModuleRef.current = serialModule;
      await serialModule.connect(baudRate);
    } catch (err) {
      console.warn("Serial connect error:", err);
      setSerialError(err.message);
    }
  };

  const disconnectSerialGps = async () => {
    if (serialModuleRef.current) {
      await serialModuleRef.current.disconnect();
      serialModuleRef.current = null;
      setSerialStatus('disconnected');
    }
  };

  // 3. Simulator Handler
  const toggleSimulator = () => {
    if (isSimRunning) {
      if (simulatorRef.current) {
        simulatorRef.current.stop();
        simulatorRef.current = null;
      }
      setIsSimRunning(false);
    } else {
      simulatorRef.current = new SimulatedGPSModule({
        startLat: activeGps.lat,
        startLng: activeGps.lng,
        onSentence: (sentence) => {
          appendNmeaLog(sentence);
        },
        onFixUpdate: (fix) => {
          handleFixReceived(fix);
        }
      });
      simulatorRef.current.start();
      setIsSimRunning(true);
    }
  };

  // Switch GPS Source Tab
  const handleSourceChange = (newSource) => {
    if (newSource === gpsSource) return;

    // Stop previous active streams if needed
    if (gpsSource === 'device') stopDeviceGps();
    if (gpsSource === 'hardware' && serialStatus === 'connected') disconnectSerialGps();
    if (gpsSource === 'simulator' && isSimRunning) toggleSimulator();

    setGpsSource(newSource);

    // Auto-start device GPS when tab is selected
    if (newSource === 'device') {
      startDeviceGps();
    }
  };

  const hasWebSerial = isWebSerialSupported();

  return (
    <div className="live-map-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Header & Overview */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={22} color="var(--accent-cyan)" />
            Live GPS Module & Geolocation Hub
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Real-time GNSS telemetry ingestion from physical USB GPS modules (NEO-6M/NMEA), device geolocation, and buoy platform
          </p>
        </div>

        {/* Global Satellite Lock Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="gps-pill-status">
            <Radio size={14} className="pulse-icon" />
            <span style={{ fontWeight: 600 }}>{activeGps.fixType}</span>
            <span style={{ opacity: 0.7 }}>&bull; {activeGps.satellites}</span>
          </span>
        </div>
      </div>

      {/* GPS Source Selector Deck */}
      <div className="gps-control-deck glass-card">
        <div className="gps-source-tabs">
          <button 
            className={`gps-tab-btn ${gpsSource === 'device' ? 'active' : ''}`}
            onClick={() => handleSourceChange('device')}
          >
            <Smartphone size={16} />
            <span>Device GPS (Live)</span>
          </button>

          <button 
            className={`gps-tab-btn ${gpsSource === 'hardware' ? 'active' : ''}`}
            onClick={() => handleSourceChange('hardware')}
          >
            <Cpu size={16} />
            <span>Hardware GPS Module (Serial)</span>
          </button>

          <button 
            className={`gps-tab-btn ${gpsSource === 'buoy' ? 'active' : ''}`}
            onClick={() => handleSourceChange('buoy')}
          >
            <Radio size={16} />
            <span>Ocean Buoy Telemetry</span>
          </button>

          <button 
            className={`gps-tab-btn ${gpsSource === 'simulator' ? 'active' : ''}`}
            onClick={() => handleSourceChange('simulator')}
          >
            <Sliders size={16} />
            <span>NMEA Simulator Feed</span>
          </button>
        </div>

        {/* Dynamic Source Control Toolbar */}
        <div className="gps-source-actions">
          {/* 1. Device GPS Controls */}
          {gpsSource === 'device' && (
            <div className="source-action-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {deviceStatus === 'active' ? (
                  <button className="action-pill-btn stop" onClick={stopDeviceGps}>
                    <Square size={14} /> Stop Geolocation
                  </button>
                ) : (
                  <button className="action-pill-btn start" onClick={startDeviceGps}>
                    <Play size={14} /> Start Live Geolocation
                  </button>
                )}
                <span className="source-hint">
                  {deviceStatus === 'active' && '🟢 Streaming real-time position from device GNSS module'}
                  {deviceStatus === 'acquiring' && '🟡 Requesting browser location permission & locking satellites...'}
                  {deviceStatus === 'idle' && 'Click Start to track your device in real-time'}
                  {deviceStatus === 'error' && `⚠️ ${deviceError}`}
                </span>
              </div>
            </div>
          )}

          {/* 2. Hardware GPS Module Controls */}
          {gpsSource === 'hardware' && (
            <div className="source-action-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Baud Rate:</label>
                  <select 
                    value={baudRate} 
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    disabled={serialStatus === 'connected'}
                    className="baud-select"
                  >
                    {BAUD_RATES.map((rate) => (
                      <option key={rate} value={rate}>{rate} baud {rate === 9600 ? '(Default NEO-6M)' : ''}</option>
                    ))}
                  </select>
                </div>

                {serialStatus === 'connected' ? (
                  <button className="action-pill-btn stop" onClick={disconnectSerialGps}>
                    <Square size={14} /> Disconnect Port
                  </button>
                ) : (
                  <button 
                    className="action-pill-btn start" 
                    onClick={connectSerialGps}
                    disabled={!hasWebSerial || serialStatus === 'requesting'}
                  >
                    <Play size={14} /> Connect Serial GPS (USB)
                  </button>
                )}

                <span className="source-hint">
                  {serialStatus === 'connected' && '🟢 Serial Port Open. Parsing live NMEA sentences ($GPGGA, $GPRMC)'}
                  {serialStatus === 'requesting' && '🟡 Waiting for COM/USB port authorization in browser modal...'}
                  {serialStatus === 'disconnected' && (hasWebSerial 
                    ? 'Connect physical GPS module (e.g. NEO-6M, U-blox, ESP32 via USB)' 
                    : '⚠️ Web Serial requires Chrome, Edge, or Brave')}
                  {serialStatus === 'error' && `⚠️ ${serialError || 'Serial communication failed'}`}
                </span>
              </div>
            </div>
          )}

          {/* 3. Ocean Buoy Telemetry Controls */}
          {gpsSource === 'buoy' && (
            <div className="source-action-row">
              <span className="source-hint" style={{ color: 'var(--accent-cyan)' }}>
                🌊 Moored ocean observer platform in Arabian Sea corridor (Sector-4, 15°17'N 73°49'E). Ocean drift simulation active.
              </span>
            </div>
          )}

          {/* 4. Simulator Controls */}
          {gpsSource === 'simulator' && (
            <div className="source-action-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  className={`action-pill-btn ${isSimRunning ? 'stop' : 'start'}`} 
                  onClick={toggleSimulator}
                >
                  {isSimRunning ? <Square size={14} /> : <Play size={14} />}
                  {isSimRunning ? 'Stop Simulator' : 'Start NMEA Stream Simulation'}
                </button>
                <span className="source-hint">
                  {isSimRunning ? '🟢 Transmitting synthetic $GPGGA and $GPRMC NMEA frames at 1 Hz' : 'Generate realistic marine navigation feed to test hardware parser'}
                </span>
              </div>
            </div>
          )}

          {/* Toggle NMEA Console Button */}
          <button 
            className={`action-pill-btn ${showNmeaConsole ? 'active' : ''}`}
            onClick={() => setShowNmeaConsole(prev => !prev)}
            style={{ marginLeft: 'auto' }}
            title="Inspect incoming raw NMEA sentences"
          >
            <Terminal size={14} />
            <span>Raw NMEA Feed ({nmeaLogs.length})</span>
            {showNmeaConsole ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Collapsible Raw NMEA Terminal Drawer */}
        {showNmeaConsole && (
          <div className="nmea-console-drawer">
            <div className="nmea-console-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={14} color="var(--accent-cyan)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f8fafc' }}>
                  Raw NMEA 0183 Ingestion Console
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="nmea-btn-mini" 
                  onClick={() => setNmeaLogs([])}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="nmea-terminal-body">
              {nmeaLogs.length === 0 ? (
                <div style={{ color: '#64748b', fontStyle: 'italic' }}>
                  No NMEA sentences received yet. Connect a hardware GPS module, start device GPS, or launch the simulator...
                </div>
              ) : (
                nmeaLogs.map((log) => (
                  <div key={log.id} className="nmea-line">
                    <span className="nmea-time">[{log.time}]</span>
                    <span className={`nmea-text ${log.text.startsWith('$GPGGA') ? 'gga' : log.text.startsWith('$GPRMC') ? 'rmc' : ''}`}>
                      {log.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Live Map Element */}
      <div style={{ flex: 1, minHeight: '520px', marginTop: '12px' }}>
        <LiveMap 
          coordinates={{ lat: activeGps.lat, lng: activeGps.lng }}
          platformId={platformStatus?.platformId || 'DHRUV-NET-OBS-01'}
          waterTemp={`${telemetry?.sensors?.temperature?.value || 22.6}°C`}
          depth={`${telemetry?.sensors?.depth?.value || 12.8}m`}
          isFull={true}
          accuracy={activeGps.accuracy}
          speedKmh={activeGps.speedKmh}
          heading={activeGps.heading}
          satellites={activeGps.satellites}
          fixType={activeGps.fixType}
          gpsSource={gpsSource}
        />
      </div>
    </div>
  );
}
