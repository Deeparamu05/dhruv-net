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
  Sliders,
  Battery,
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle,
  MapPin
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
  // GPS Source Mode: 'buoy' | 'device' | 'hardware' | 'simulator'
  const [gpsSource, setGpsSource] = useState('buoy');

  // Serial Hardware Configuration
  const [baudRate, setBaudRate] = useState(9600);
  const [serialStatus, setSerialStatus] = useState('disconnected');
  const [serialError, setSerialError] = useState(null);

  // Device GPS Status
  const [deviceStatus, setDeviceStatus] = useState('idle');
  const [deviceError, setDeviceError] = useState(null);

  // Simulator Status
  const [isSimRunning, setIsSimRunning] = useState(false);

  // Hardware Connection & Status Tracking
  const isHardwareConnected = platformStatus?.nodeMcuStatus === 'CONNECTED' || Boolean(platformStatus?.hardwareConnected);
  const nodeMcuStatus = platformStatus?.nodeMcuStatus || (isHardwareConnected ? 'CONNECTED' : 'DISCONNECTED');
  const nodeMcuMessage = platformStatus?.nodeMcuMessage || (isHardwareConnected ? 'Hardware connected & transmitting' : 'Waiting for hardware connection');
  const loraStatus = platformStatus?.loraStatus || 'NOT CONNECTED';
  const loraMessage = platformStatus?.loraMessage || 'Waiting for LoRa gateway (Future Uplink)';
  const sensorSystemStatus = platformStatus?.sensorSystem || (isHardwareConnected ? 'LIVE' : (platformStatus?.packetsReceived > 0 ? 'OFFLINE' : 'SIMULATED'));
  const sensorSystemMessage = platformStatus?.sensorSystemMessage || (isHardwareConnected ? 'Streaming live physical sensor telemetry' : 'Using simulated sensor data');


  // NMEA Terminal Feed
  const [nmeaLogs, setNmeaLogs] = useState([]);
  const [showNmeaConsole, setShowNmeaConsole] = useState(false);

  // Active GPS State (defaults to Bay of Bengal Coromandel Coast)
  const [activeGps, setActiveGps] = useState({
    lat: telemetry?.coordinates?.lat || 11.1271,
    lng: telemetry?.coordinates?.lng || 79.0755,
    accuracy: 5,
    altitude: '0.8 m',
    speedKmh: 0.3,
    speedKnots: 0.16,
    heading: 142,
    satellites: '12 Sats',
    fixType: '3D GNSS Fix',
    isValid: true,
    lastUpdated: null
  });

  const serialModuleRef = useRef(null);
  const deviceTrackerRef = useRef(null);
  const simulatorRef = useRef(null);

  const appendNmeaLog = useCallback((sentence) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setNmeaLogs((prev) => {
      const next = [...prev, { id: Math.random().toString(), time, text: sentence }];
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
  }, []);

  const handleFixReceived = useCallback((fix) => {
    setActiveGps((prev) => ({
      ...prev,
      lat: fix.lat != null ? fix.lat : prev.lat,
      lng: fix.lng != null ? fix.lng : prev.lng,
      accuracy: fix.accuracy != null ? fix.accuracy : 5,
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
        lat: telemetry.coordinates.lat || 11.1271,
        lng: telemetry.coordinates.lng || 79.0755,
        accuracy: 4,
        speedKmh: 0.3,
        heading: 142,
        satellites: '12 Sats',
        fixType: 'NodeMCU GNSS Fix'
      }));
    }
  }, [gpsSource, telemetry?.coordinates]);

  useEffect(() => {
    return () => {
      if (serialModuleRef.current) serialModuleRef.current.disconnect();
      if (deviceTrackerRef.current) deviceTrackerRef.current.stop();
      if (simulatorRef.current) simulatorRef.current.stop();
    };
  }, []);

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
        onStatusChange: (status) => setDeviceStatus(status)
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

  const connectSerialGps = async () => {
    setSerialError(null);
    try {
      const serialModule = new SerialGPSModule({
        baudRate,
        onSentence: (raw) => appendNmeaLog(raw),
        onFixUpdate: (fix) => handleFixReceived(fix),
        onError: (err) => {
          setSerialError(err.message);
          setSerialStatus('error');
        },
        onStatusChange: (st) => setSerialStatus(st)
      });
      serialModuleRef.current = serialModule;
      await serialModule.connect(baudRate);
    } catch (err) {
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
        onSentence: (sentence) => appendNmeaLog(sentence),
        onFixUpdate: (fix) => handleFixReceived(fix)
      });
      simulatorRef.current.start();
      setIsSimRunning(true);
    }
  };

  const handleSourceChange = (newSource) => {
    if (newSource === gpsSource) return;
    if (gpsSource === 'device') stopDeviceGps();
    if (gpsSource === 'hardware' && serialStatus === 'connected') disconnectSerialGps();
    if (gpsSource === 'simulator' && isSimRunning) toggleSimulator();
    setGpsSource(newSource);
    if (newSource === 'device') startDeviceGps();
  };

  const hasWebSerial = isWebSerialSupported();

  return (
    <div className="live-map-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Required Section 5: Live Monitoring Telemetry Bar */}
      <div className="live-monitoring-summary-bar">
        <div className="live-mon-card">
          <span className="live-mon-label">Platform ID</span>
          <span className="live-mon-val highlight">DHRUV-01</span>
        </div>

        <div className="live-mon-card">
          <span className="live-mon-label">Platform Status</span>
          <span className="live-mon-val online">
            <span className="mon-dot"></span>
            Online
          </span>
        </div>

        <div className="live-mon-card">
          <span className="live-mon-label">Battery Level</span>
          <span className="live-mon-val warning">
            {telemetry?.battery || 82}%
          </span>
        </div>

        <div className="live-mon-card">
          <span className="live-mon-label">Battery Voltage</span>
          <span className="live-mon-val">
            {telemetry?.batteryVoltage || '3.9'} V
          </span>
        </div>

        <div className="live-mon-card">
          <span className="live-mon-label">GPS Latitude</span>
          <span className="live-mon-val code-font">
            {activeGps.lat.toFixed(4)}° N
          </span>
        </div>

        <div className="live-mon-card">
          <span className="live-mon-label">GPS Longitude</span>
          <span className="live-mon-val code-font">
            {activeGps.lng.toFixed(4)}° E
          </span>
        </div>

        <div className="live-mon-card">
          <span className="live-mon-label">Last Data Received</span>
          <span className="live-mon-val small-val">
            {telemetry?.displayTime || 'Just now'}
          </span>
        </div>

        <div className="live-mon-card" title={`LoRa RA-02: ${loraMessage}`}>
          <span className="live-mon-label">LoRa RA-02</span>
          <span className={`live-mon-val ${isHardwareConnected ? 'lora-val' : 'not-connected'}`}>
            {loraStatus}
          </span>
          <span className="live-mon-sub-msg">{loraMessage}</span>
        </div>

        <div className="live-mon-card" title={`NodeMCU ESP8266: ${nodeMcuMessage}`}>
          <span className="live-mon-label">NodeMCU ESP8266</span>
          <span className={`live-mon-val ${isHardwareConnected ? 'online' : 'not-connected'}`}>
            {nodeMcuStatus}
          </span>
          <span className="live-mon-sub-msg">{nodeMcuMessage}</span>
        </div>

        <div className="live-mon-card" title={`Sensor System: ${sensorSystemMessage}`}>
          <span className="live-mon-label">Sensor System</span>
          <span className={`live-mon-val ${isHardwareConnected ? 'online' : 'simulated'}`}>
            {sensorSystemStatus}
          </span>
          <span className="live-mon-sub-msg">{sensorSystemMessage}</span>
        </div>
      </div>

      {/* GPS Source Selector Deck */}
      <div className="gps-control-deck glass-card">
        <div className="gps-source-tabs">
          <button 
            className={`gps-tab-btn ${gpsSource === 'buoy' ? 'active' : ''}`}
            onClick={() => handleSourceChange('buoy')}
          >
            <Radio size={16} />
            <span>Platform LoRa GPS (DHRUV-01)</span>
          </button>

          <button 
            className={`gps-tab-btn ${gpsSource === 'device' ? 'active' : ''}`}
            onClick={() => handleSourceChange('device')}
          >
            <Smartphone size={16} />
            <span>Device Geolocation (Live)</span>
          </button>

          <button 
            className={`gps-tab-btn ${gpsSource === 'hardware' ? 'active' : ''}`}
            onClick={() => handleSourceChange('hardware')}
          >
            <Cpu size={16} />
            <span>Serial GPS Module (NEO-6M USB)</span>
          </button>

          <button 
            className={`gps-tab-btn ${gpsSource === 'simulator' ? 'active' : ''}`}
            onClick={() => handleSourceChange('simulator')}
          >
            <Sliders size={16} />
            <span>Ocean Drift Simulator</span>
          </button>
        </div>

        {/* Dynamic Source Control Toolbar */}
        <div className="gps-source-actions">
          {gpsSource === 'buoy' && (
            <div className="source-action-row">
              <span className="source-hint" style={{ color: 'var(--accent-cyan)' }}>
                🌊 DHRUV-01 Moored Ocean Observation Platform in Bay of Bengal (Lat: 11.1271° N, Lng: 79.0755° E). {isHardwareConnected ? 'NodeMCU ESP8266 + LoRa RA-02 link active.' : 'Simulated buoy telemetry • Waiting for hardware connection.'}
              </span>
            </div>
          )}

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
                  {serialStatus === 'requesting' && '🟡 Waiting for COM/USB port authorization...'}
                  {serialStatus === 'disconnected' && (hasWebSerial 
                    ? 'Connect physical GPS module (e.g. NEO-6M, U-blox via USB COM port)' 
                    : '⚠️ Web Serial requires Chrome, Edge, or Brave')}
                  {serialStatus === 'error' && `⚠️ ${serialError || 'Serial communication failed'}`}
                </span>
              </div>
            </div>
          )}

          {gpsSource === 'simulator' && (
            <div className="source-action-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  className={`action-pill-btn ${isSimRunning ? 'stop' : 'start'}`} 
                  onClick={toggleSimulator}
                >
                  {isSimRunning ? <Square size={14} /> : <Play size={14} />}
                  {isSimRunning ? 'Stop Simulator' : 'Start Ocean Drift Simulation'}
                </button>
                <span className="source-hint">
                  {isSimRunning ? '🟢 Transmitting synthetic $GPGGA and $GPRMC marine NMEA frames at 1 Hz' : 'Generate realistic marine navigation feed to test platform tracking'}
                </span>
              </div>
            </div>
          )}

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
              <button 
                className="nmea-btn-mini" 
                onClick={() => setNmeaLogs([])}
              >
                Clear
              </button>
            </div>

            <div className="nmea-terminal-body">
              {nmeaLogs.length === 0 ? (
                <div style={{ color: '#64748b', fontStyle: 'italic' }}>
                  No NMEA sentences received yet. Connect a hardware GPS module or start the simulator...
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
          platformId="DHRUV-01"
          waterTemp={`${telemetry?.sensors?.waterTemperature?.value ?? 27.4}°C`}
          depth={`${telemetry?.sensors?.depth?.value ?? 18.6}m`}
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
