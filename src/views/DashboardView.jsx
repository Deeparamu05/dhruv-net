import React, { useState, useEffect, useRef } from 'react';
import LiveMap from '../components/LiveMap';
import HardwareGuideModal from '../components/HardwareGuideModal';
import { sendTestSensorData } from '../services/api';
import { hwWebSocket } from '../services/websocket';
import { 
  Compass, 
  Battery, 
  Wifi, 
  Radio, 
  Cpu, 
  Activity, 
  ExternalLink, 
  Zap, 
  Thermometer, 
  Droplets, 
  Gauge, 
  Anchor 
} from 'lucide-react';

// ─── Sparkline canvas for sensor cards ─────────────────────────
function Sparkline({ data, color = '#79E6FF', width = 100, height = 28 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Draw smooth line
    const points = data.map((v, i) => [
      (i / (data.length - 1)) * (w - 6) + 3,
      h - ((v - min) / range) * (h - 8) - 4
    ]);

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Subtle area fill
    ctx.lineTo(points[points.length - 1][0], h);
    ctx.lineTo(points[0][0], h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color.replace(')', ', 0.18)').replace('rgb', 'rgba').replace('#79E6FF', 'rgba(121,230,255,0.18)'));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();
  }, [data, color]);

  return <canvas ref={canvasRef} width={width} height={height} className="sparkline-canvas" />;
}

// ─── Rich Telemetry Card ───────────────────────────────────────
function TelemetryCard({ label, value, unit, sensor, icon: Icon, color, sparkData, isLive, isReal }) {
  const isNoData = value === null || value === undefined;
  const displayVal = isNoData ? '—' : (typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value);

  return (
    <div className="telemetry-card">
      <div className="tc-header">
        <div className="tc-title-wrap">
          <Icon size={16} className="tc-icon" style={{ color }} />
          <span className="tc-label">{label}</span>
        </div>
        <span className="tc-sensor">{sensor}</span>
      </div>

      <div className="tc-body">
        <div className="tc-value-group">
          <span className="tc-value" style={{ color: isNoData ? 'var(--t2)' : 'var(--val)' }}>
            {displayVal}
          </span>
          <span className="tc-unit">{unit}</span>
        </div>
      </div>

      <div className="tc-footer">
        <div className="tc-spark-wrap">
          {sparkData && sparkData.length > 1 ? (
            <Sparkline data={sparkData} color={color} />
          ) : (
            <div className="tc-spark-placeholder">
              <span className="tc-spark-line" />
            </div>
          )}
        </div>
        <div className={`tc-status-badge ${isReal && isLive ? 'live' : 'waiting'}`}>
          <span className="tc-status-dot" />
          <span>{isReal ? (isLive ? 'LIVE' : 'STALE') : 'WAITING'}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Attitude Horizon Gyro ────────────────────────────────────
function AttitudeGyro({ roll = 0, pitch = 0, yaw = 0 }) {
  const clampedPitch = Math.max(-25, Math.min(25, pitch));

  return (
    <div className="attitude-gyro-widget">
      <div className="gyro-outer-ring">
        {/* Horizon Disc that tilts and pitches */}
        <div 
          className="gyro-horizon-disc" 
          style={{ transform: `rotate(${-roll}deg)` }}
        >
          <div className="gyro-sky" />
          <div className="gyro-sea" />
          <div 
            className="gyro-pitch-line" 
            style={{ transform: `translateY(${clampedPitch * 1.5}px)` }}
          />
        </div>

        {/* Static crosshair reticle overlay */}
        <div className="gyro-overlay">
          <div className="gyro-reticle-h" />
          <div className="gyro-reticle-v" />
          <div className="gyro-center-dot" />
          <div className="gyro-cross-wings" />
        </div>
        
        {/* Bezel glass highlight ring */}
        <div className="gyro-glass-rim" />
      </div>

      <div className="gyro-readouts">
        <div className="gyro-readout-item">
          <span className="gri-label">ROLL</span>
          <span className="gri-val">{roll >= 0 ? `+${roll.toFixed(1)}°` : `${roll.toFixed(1)}°`}</span>
        </div>
        <div className="gyro-readout-item">
          <span className="gri-label">PITCH</span>
          <span className="gri-val">{pitch >= 0 ? `+${pitch.toFixed(1)}°` : `${pitch.toFixed(1)}°`}</span>
        </div>
        <div className="gyro-readout-item">
          <span className="gri-label">YAW</span>
          <span className="gri-val">{yaw.toFixed(1)}°</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard View ───────────────────────────────────────
export default function DashboardView({
  telemetry: propTelemetry,
  platformStatus: propPlatformStatus,
  onNavigateToMap,
  onNavigateToAnalytics,
  onNavigateToSensors,
  onToggleTestHardware
}) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const hasRealDataRef = useRef(false);
  const [hasRealData, setHasRealData] = useState(false);
  const [packetStream, setPacketStream] = useState([]);
  const [trends, setTrends] = useState({ water: [], air: [], humidity: [], pressure: [] });

  const [hardwareState, setHardwareState] = useState({
    nodeMcuStatus: 'DISCONNECTED',
    sensorSystem: 'OFFLINE',
    isSimulated: true,
    lastSeen: '—',
    packetsReceived: 0,
    message: ''
  });

  const [sensorValues, setSensorValues] = useState({
    deviceId: 'DHRUV-01',
    waterTemperature: null,
    airTemperature: null,
    humidity: null,
    pressure: null,
    depth: null,
    latitude: 11.6643,
    longitude: 78.1460,
    battery: null,
    batteryVoltage: null,
    roll: 0.0,
    pitch: 0.0,
    yaw: 0.0,
    timestamp: null
  });

  const pushTrend = (data) => {
    setTrends(prev => ({
      water:    [...prev.water.slice(-24),    data.waterTemperature].filter(v => v != null),
      air:      [...prev.air.slice(-24),      data.airTemperature].filter(v => v != null),
      humidity: [...prev.humidity.slice(-24), data.humidity].filter(v => v != null),
      pressure: [...prev.pressure.slice(-24), (data.pressure ?? data.atmosphericPressure)].filter(v => v != null),
    }));
  };

  useEffect(() => {
    hwWebSocket.connect();

    // Initial fetch from REST API
    fetch('http://localhost:5000/api/sensor-data/latest')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data && !hasRealDataRef.current) {
          hasRealDataRef.current = true;
          setHasRealData(true);
          const d = res.data;
          const conn = res.connection;
          setSensorValues(prev => ({
            ...prev,
            ...d,
            pressure: d.pressure ?? d.atmosphericPressure,
            roll: d.roll ?? 0,
            pitch: d.pitch ?? 0,
            yaw: d.yaw ?? 0,
            latitude: d.latitude ?? 11.6643,
            longitude: d.longitude ?? 78.1460
          }));
          pushTrend(d);
          if (conn) {
            setHardwareState({
              nodeMcuStatus: conn.status || 'CONNECTED',
              sensorSystem: conn.sensorStatus || 'LIVE',
              isSimulated: false,
              lastSeen: conn.lastSeen || 'Just now',
              packetsReceived: conn.packetsReceived || 1,
              message: conn.message || ''
            });
          }
        }
      })
      .catch(() => {});

    // WebSocket subscription for live updates
    const unsub = hwWebSocket.subscribe((payload) => {
      if (payload.type === 'WS_STATUS') {
        setIsWsConnected(Boolean(payload.connected));
      } else if (payload.type === 'INIT' || payload.type === 'SENSOR_UPDATE') {
        hasRealDataRef.current = true;
        setHasRealData(true);
        if (payload.connection) {
          setHardwareState(prev => ({
            ...prev,
            nodeMcuStatus: payload.connection.status || 'CONNECTED',
            sensorSystem: payload.connection.sensorStatus || 'LIVE',
            lastSeen: payload.connection.lastSeen || new Date().toLocaleTimeString(),
            packetsReceived: payload.connection.packetsReceived || prev.packetsReceived,
            isSimulated: false
          }));
        }
        if (payload.data) {
          const d = payload.data;
          setSensorValues(prev => ({
            ...prev,
            ...d,
            pressure: d.pressure ?? d.atmosphericPressure,
            latitude: d.latitude ?? prev.latitude,
            longitude: d.longitude ?? prev.longitude,
            roll: d.roll ?? prev.roll,
            pitch: d.pitch ?? prev.pitch,
            yaw: d.yaw ?? prev.yaw
          }));
          pushTrend(d);
          setPacketStream(prev => [
            { time: new Date().toLocaleTimeString(), ...d },
            ...prev
          ].slice(0, 10));
        }
      } else if (payload.type === 'STATUS_UPDATE') {
        if (payload.connection) {
          setHardwareState(prev => ({
            ...prev,
            nodeMcuStatus: payload.connection.status || prev.nodeMcuStatus,
            sensorSystem: payload.connection.sensorStatus || prev.sensorSystem,
            lastSeen: payload.connection.lastSeen || prev.lastSeen,
            packetsReceived: payload.connection.packetsReceived ?? prev.packetsReceived,
            isSimulated: !hasRealDataRef.current
          }));
        }
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const isReal = hasRealDataRef.current || hasRealData;
  const sv = sensorValues;
  const hs = hardwareState;
  const isLive = hs.sensorSystem === 'LIVE';
  const isConnected = hs.nodeMcuStatus === 'CONNECTED';
  const batteryPct = sv.battery != null ? sv.battery : null;
  const batteryVoltage = sv.batteryVoltage != null ? `${sv.batteryVoltage} V` : '— V';

  return (
    <div className="db-root-container">

      {/* ═══════════════════════════════════════════════════
          TIER 1: HERO MAP + COMPACT PLATFORM STATUS
          ═══════════════════════════════════════════════════ */}
      <div className="db-tier-hero">
        
        {/* Left Map Panel (68% width) */}
        <div className="db-map-card">
          <div className="db-card-header">
            <div className="dch-left">
              <span className={`dch-status-dot ${isReal && isLive ? 'live' : 'waiting'}`} />
              <span className="dch-title">LIVE PLATFORM TRACKING</span>
              <span className="dch-badge">OCEAN BUOY · DHRUV-01</span>
            </div>
            <button className="dch-action-btn" onClick={onNavigateToMap} title="Open Full Screen Tactical Map">
              <span>Full View</span>
              <ExternalLink size={12} />
            </button>
          </div>

          <div className="db-map-viewport">
            <LiveMap
              coordinates={{ lat: sv.latitude ?? 11.6643, lng: sv.longitude ?? 78.1460 }}
              platformId="DHRUV-01"
              waterTemp={sv.waterTemperature != null ? `${sv.waterTemperature}°C` : '—'}
              depth={sv.depth != null ? `${sv.depth}m` : '—'}
              isFull={false}
            />

            {/* Small floating DHRUV-01 GPS chip inside map */}
            <div className="db-map-floating-chip">
              <div className="dmfc-top">
                <span className="dmfc-id">DHRUV-01</span>
                <span className={`dmfc-badge ${isReal && isLive ? 'live' : 'offline'}`}>
                  {isReal ? (isLive ? '● LIVE' : '○ ' + hs.sensorSystem) : '○ OFFLINE'}
                </span>
              </div>
              <div className="dmfc-coords">
                <div className="dmfc-coord-row">
                  <span className="dmfc-coord-label">LAT</span>
                  <span className="dmfc-coord-val">{(sv.latitude ?? 11.6643).toFixed(4)}° N</span>
                </div>
                <div className="dmfc-coord-row">
                  <span className="dmfc-coord-label">LNG</span>
                  <span className="dmfc-coord-val">{(sv.longitude ?? 78.1460).toFixed(4)}° E</span>
                </div>
              </div>
              <div className="dmfc-time-row">
                <span className="dmfc-time-label">LAST UPDATE</span>
                <span className="dmfc-time-val">{hs.lastSeen || 'Waiting...'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Platform Status Panel (32% width, full height of map) */}
        <div className="db-status-card">
          <div className="db-card-header">
            <div className="dch-left">
              <Activity size={14} className="dch-icon" />
              <span className="dch-title">PLATFORM STATUS</span>
            </div>
            <span className={`dch-pill ${isConnected ? 'online' : 'offline'}`}>
              {isConnected ? 'NODE CONNECTED' : 'STANDBY'}
            </span>
          </div>

          <div className="db-status-sections">
            {/* Sub-Section 1: Orientation Overview */}
            <div className="dss-group">
              <div className="dss-group-title">
                <Compass size={12} />
                <span>ORIENTATION</span>
              </div>
              <div className="dss-tri-readout">
                <div className="dss-tri-item">
                  <span className="dss-tri-label">ROLL</span>
                  <span className="dss-tri-val">{(sv.roll ?? 0) >= 0 ? `+${(sv.roll ?? 0).toFixed(1)}°` : `${(sv.roll ?? 0).toFixed(1)}°`}</span>
                </div>
                <div className="dss-tri-item">
                  <span className="dss-tri-label">PITCH</span>
                  <span className="dss-tri-val">{(sv.pitch ?? 0) >= 0 ? `+${(sv.pitch ?? 0).toFixed(1)}°` : `${(sv.pitch ?? 0).toFixed(1)}°`}</span>
                </div>
                <div className="dss-tri-item">
                  <span className="dss-tri-label">YAW</span>
                  <span className="dss-tri-val">{(sv.yaw ?? 0).toFixed(1)}°</span>
                </div>
              </div>
            </div>

            <div className="dss-divider" />

            {/* Sub-Section 2: Power */}
            <div className="dss-group">
              <div className="dss-group-title">
                <Battery size={12} />
                <span>POWER SUBSYSTEM</span>
              </div>
              <div className="dss-power-row">
                <div className="dss-power-stat">
                  <span className="dss-power-label">BATTERY</span>
                  <span className="dss-power-val" style={{ color: batteryPct == null ? 'var(--t2)' : batteryPct > 40 ? 'var(--green)' : 'var(--amber)' }}>
                    {batteryPct != null ? `${batteryPct}%` : '— %'}
                  </span>
                </div>
                <div className="dss-power-stat right">
                  <span className="dss-power-label">VOLTAGE</span>
                  <span className="dss-power-val">{batteryVoltage}</span>
                </div>
              </div>
              {/* Battery progress bar */}
              <div className="dss-bat-track">
                <div 
                  className="dss-bat-fill" 
                  style={{ 
                    width: `${batteryPct ?? 0}%`,
                    background: (batteryPct ?? 0) > 40 ? 'var(--green)' : (batteryPct ?? 0) > 15 ? 'var(--amber)' : 'var(--red)'
                  }} 
                />
              </div>
            </div>

            <div className="dss-divider" />

            {/* Sub-Section 3: Communication */}
            <div className="dss-group">
              <div className="dss-group-title">
                <Radio size={12} />
                <span>COMMUNICATION</span>
              </div>
              <div className="dss-comm-list">
                <div className="dss-comm-item">
                  <span className="dss-comm-name">NodeMCU ESP8266</span>
                  <span className={`dss-comm-status ${isConnected ? 'ok' : 'off'}`}>
                    {isConnected ? '● CONNECTED' : '● OFFLINE'}
                  </span>
                </div>
                <div className="dss-comm-item">
                  <span className="dss-comm-name">Wi-Fi Telemetry</span>
                  <span className={`dss-comm-status ${isWsConnected ? 'ok' : 'off'}`}>
                    {isWsConnected ? '● CONNECTED' : '● OFFLINE'}
                  </span>
                </div>
                <div className="dss-comm-item">
                  <span className="dss-comm-name">LoRa RA-02</span>
                  <span className="dss-comm-status standby">○ STANDBY</span>
                </div>
              </div>
              <div className="dss-packets-meta">
                <span>INGESTED PACKETS</span>
                <strong>{hs.packetsReceived.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          TIER 2: LIVE OCEAN TELEMETRY (5 BALANCED CARDS)
          ═══════════════════════════════════════════════════ */}
      <div className="db-tier-telemetry">
        <div className="db-section-header">
          <div className="dsh-left">
            <span className="dsh-dot" />
            <span className="dsh-title">LIVE OCEAN TELEMETRY</span>
          </div>
          <span className="dsh-sub">
            {isReal ? (isLive ? 'Physical Sensors Online · Real-time Stream' : hs.sensorSystem) : 'WAITING FOR HARDWARE TELEMETRY'}
          </span>
        </div>

        <div className="db-telemetry-grid">
          <TelemetryCard
            label="WATER TEMP"
            value={sv.waterTemperature}
            unit="°C"
            sensor="DS18B20"
            icon={Thermometer}
            color="#79E6FF"
            sparkData={trends.water}
            isLive={isLive}
            isReal={isReal}
          />
          <TelemetryCard
            label="AIR TEMP"
            value={sv.airTemperature}
            unit="°C"
            sensor="DHT22"
            icon={Thermometer}
            color="#93C5FD"
            sparkData={trends.air}
            isLive={isLive}
            isReal={isReal}
          />
          <TelemetryCard
            label="HUMIDITY"
            value={sv.humidity}
            unit="%"
            sensor="DHT22"
            icon={Droplets}
            color="#6EE7B7"
            sparkData={trends.humidity}
            isLive={isLive}
            isReal={isReal}
          />
          <TelemetryCard
            label="ATM PRESSURE"
            value={sv.pressure}
            unit="hPa"
            sensor="BMP280"
            icon={Gauge}
            color="#A5B4FC"
            sparkData={trends.pressure}
            isLive={isLive}
            isReal={isReal}
          />
          <TelemetryCard
            label="OCEAN DEPTH"
            value={sv.depth}
            unit="m"
            sensor="DEPTH SENSOR"
            icon={Anchor}
            color="#67E8F9"
            sparkData={[]}
            isLive={false}
            isReal={isReal}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          TIER 3: ORIENTATION (LEFT) + POWER & COMM (RIGHT)
          ═══════════════════════════════════════════════════ */}
      <div className="db-tier-diagnostics">
        {/* Left: Platform Orientation with Circular Attitude Indicator */}
        <div className="db-diag-card">
          <div className="db-card-header">
            <div className="dch-left">
              <Compass size={14} className="dch-icon" />
              <span className="dch-title">PLATFORM ORIENTATION</span>
            </div>
            <span className="dch-pill-sub">MPU6050 6-DOF IMU</span>
          </div>

          <div className="db-diag-body orientation-body">
            <AttitudeGyro 
              roll={sv.roll ?? 0} 
              pitch={sv.pitch ?? 0} 
              yaw={sv.yaw ?? 0} 
            />
          </div>
        </div>

        {/* Right: Power & Communication Health */}
        <div className="db-diag-card">
          <div className="db-card-header">
            <div className="dch-left">
              <Zap size={14} className="dch-icon" />
              <span className="dch-title">POWER & COMMUNICATIONS</span>
            </div>
            <span className="dch-pill-sub">CORE TELEMETRY LINK</span>
          </div>

          <div className="db-diag-body power-comm-body">
            {/* Power block */}
            <div className="pc-power-block">
              <div className="pc-block-header">
                <span className="pc-label">BATTERY STORAGE</span>
                <span className="pc-voltage">{batteryVoltage}</span>
              </div>
              <div className="pc-battery-display">
                <span className="pc-bat-large" style={{ color: batteryPct == null ? 'var(--t2)' : batteryPct > 40 ? 'var(--green)' : 'var(--amber)' }}>
                  {batteryPct != null ? `${batteryPct}%` : '— %'}
                </span>
                <div className="pc-bat-bar-track">
                  <div 
                    className="pc-bat-bar-fill" 
                    style={{ 
                      width: `${batteryPct ?? 0}%`,
                      background: (batteryPct ?? 0) > 40 ? 'var(--green)' : (batteryPct ?? 0) > 15 ? 'var(--amber)' : 'var(--red)'
                    }} 
                  />
                </div>
              </div>
            </div>

            <div className="pc-divider" />

            {/* Comm grid */}
            <div className="pc-comm-grid">
              <div className="pc-comm-cell">
                <div className="pc-comm-cell-label">NodeMCU ESP8266</div>
                <div className={`pc-comm-cell-status ${isConnected ? 'online' : 'offline'}`}>
                  {isConnected ? '● CONNECTED' : '● OFFLINE'}
                </div>
              </div>
              <div className="pc-comm-cell">
                <div className="pc-comm-cell-label">Wi-Fi WebSocket</div>
                <div className={`pc-comm-cell-status ${isWsConnected ? 'online' : 'offline'}`}>
                  {isWsConnected ? '● CONNECTED' : '● OFFLINE'}
                </div>
              </div>
              <div className="pc-comm-cell">
                <div className="pc-comm-cell-label">LoRa RA-02 Gateway</div>
                <div className="pc-comm-cell-status standby">
                  ○ STANDBY (433MHz)
                </div>
              </div>
              <div className="pc-comm-cell">
                <div className="pc-comm-cell-label">Packet Counter</div>
                <div className="pc-comm-cell-val">
                  {hs.packetsReceived.toLocaleString()} PKTS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          TIER 4: RECENT TELEMETRY / SYSTEM ACTIVITY (COMPACT 100-140px)
          ═══════════════════════════════════════════════════ */}
      <div className="db-tier-activity">
        <div className="db-card-header">
          <div className="dch-left">
            <Activity size={14} className="dch-icon" />
            <span className="dch-title">RECENT TELEMETRY / SYSTEM ACTIVITY</span>
          </div>
          <span className="dsh-sub">
            {packetStream.length > 0 ? `${packetStream.length} PACKETS LOGGED` : 'STREAM STANDBY'}
          </span>
        </div>

        <div className="db-activity-table-wrap">
          {packetStream.length === 0 ? (
            <div className="db-activity-empty">
              <span>Waiting for telemetry from DHRUV-01...</span>
              <button 
                className="db-test-btn" 
                onClick={() => {
                  sendTestSensorData().catch(() => {});
                }}
              >
                Send Test Packet
              </button>
            </div>
          ) : (
            <div className="db-activity-rows">
              {packetStream.map((p, i) => (
                <div key={i} className={`db-activity-row ${i === 0 ? 'new-row' : ''}`}>
                  <span className="dar-time">{p.time}</span>
                  <span className="dar-id">{p.deviceId || 'DHRUV-01'}</span>
                  <span className="dar-metric">TEMP: <strong>{p.waterTemperature != null ? `${p.waterTemperature}°C` : '—'}</strong></span>
                  <span className="dar-metric">AIR: <strong>{p.airTemperature != null ? `${p.airTemperature}°C` : '—'}</strong></span>
                  <span className="dar-metric">HUM: <strong>{p.humidity != null ? `${p.humidity}%` : '—'}</strong></span>
                  <span className="dar-metric">PRESS: <strong>{p.pressure != null ? `${Math.round(p.pressure)} hPa` : '—'}</strong></span>
                  <span className="dar-badge">● LIVE</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <HardwareGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        isHardwareConnected={isConnected}
        onToggleTestHardware={onToggleTestHardware}
      />
    </div>
  );
}
