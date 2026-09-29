import React, { useState } from 'react';
import SensorCard from '../components/SensorCard';
import HardwareGuideModal from '../components/HardwareGuideModal';
import { 
  Activity, 
  Cpu, 
  Radio, 
  MapPin, 
  Compass, 
  Gauge, 
  Thermometer, 
  Droplet, 
  ArrowDownCircle, 
  CheckCircle2, 
  Play, 
  Pause, 
  Terminal,
  Server,
  Layers,
  Info,
  BookOpen,
  Sliders,
  AlertTriangle
} from 'lucide-react';

export default function SensorDataView({ 
  telemetry, 
  platformStatus,
  isLiveStreaming, 
  toggleLiveStream,
  onToggleTestHardware
}) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const sensors = telemetry?.sensors || {};
  const coordinates = telemetry?.coordinates || { lat: 11.1271, lng: 79.0755 };
  const orientation = sensors.orientation || { roll: 1.8, pitch: -0.7, yaw: 42.5 };
  const timestamp = telemetry?.timestamp || new Date().toISOString();

  // Dynamic Hardware Status Tracking
  const isHardwareConnected = platformStatus?.nodeMcuStatus === 'CONNECTED' || Boolean(platformStatus?.hardwareConnected);
  const nodeMcuStatus = platformStatus?.nodeMcuStatus || (isHardwareConnected ? 'CONNECTED' : 'DISCONNECTED');
  const nodeMcuMessage = platformStatus?.nodeMcuMessage || (isHardwareConnected ? 'Hardware connected & transmitting' : 'Waiting for hardware connection');
  const loraStatus = platformStatus?.loraStatus || 'NOT CONNECTED';
  const loraMessage = platformStatus?.loraMessage || 'Waiting for LoRa gateway (Future Uplink)';
  const sensorSystemStatus = platformStatus?.sensorSystem || (isHardwareConnected ? 'LIVE' : (platformStatus?.packetsReceived > 0 ? 'OFFLINE' : 'SIMULATED'));
  const sensorSystemMessage = platformStatus?.sensorSystemMessage || (isHardwareConnected ? 'Streaming live physical sensor telemetry' : 'Using simulated sensor data');
  const hasEverReceivedData = (platformStatus?.packetsReceived ?? 0) > 0;

  // Dynamic tag for cards
  const getSensorTag = () => {
    if (sensorSystemStatus === 'LIVE') return "LIVE TELEMETRY";
    if (sensorSystemStatus === 'STALE') return "STALE TELEMETRY";
    if (sensorSystemStatus === 'OFFLINE') return "OFFLINE (PRESERVED)";
    return "SIMULATED DATA";
  };

  // All 7 required hardware units & future depth sensor
  const sensorList = [
    {
      id: "ds18b20",
      hardware: "Waterproof DS18B20",
      probeRole: "Water Temperature Sensor",
      readings: [
        { label: "Water Temperature", value: sensors.waterTemperature?.value ?? '--', unit: "°C" }
      ],
      source: "DS18B20 (1-Wire Bus)",
      interface: "1-Wire (GPIO0 / Pin D3)",
      status: sensorSystemStatus === 'LIVE' ? "Normal" : sensorSystemStatus,
      isSimulated: !hasEverReceivedData,
      simulationLabel: getSensorTag(),
      icon: Thermometer
    },
    {
      id: "dht22",
      hardware: "DHT22 (AM2302)",
      probeRole: "Air Temperature & Humidity",
      readings: [
        { label: "Air Temperature", value: sensors.airTemperature?.value ?? '--', unit: "°C" },
        { label: "Relative Humidity", value: sensors.humidity?.value ?? '--', unit: "%" }
      ],
      source: "DHT22 Digital",
      interface: "Digital GPIO (GPIO2 / Pin D4)",
      status: sensorSystemStatus === 'LIVE' ? "Normal" : sensorSystemStatus,
      isSimulated: !hasEverReceivedData,
      simulationLabel: getSensorTag(),
      icon: Droplet
    },
    {
      id: "bmp280",
      hardware: "BMP280 Barometer",
      probeRole: "Barometric Atmospheric Pressure",
      readings: [
        { label: "Atmospheric Pressure", value: sensors.atmosphericPressure?.value ?? '--', unit: "hPa" }
      ],
      source: "BMP280 (I2C Bus)",
      interface: "I2C (SCL D1 / SDA D2)",
      status: sensorSystemStatus === 'LIVE' ? "Normal" : sensorSystemStatus,
      isSimulated: !hasEverReceivedData,
      simulationLabel: getSensorTag(),
      icon: Gauge
    },
    {
      id: "mpu6050",
      hardware: "MPU6050 6-Axis IMU",
      probeRole: "Buoy Orientation (Roll, Pitch, Yaw)",
      readings: [
        { label: "Platform Roll", value: orientation.roll ?? 0.0, unit: "°" },
        { label: "Platform Pitch", value: orientation.pitch ?? 0.0, unit: "°" },
        { label: "Platform Yaw", value: orientation.yaw ?? 0.0, unit: "°" }
      ],
      source: "MPU6050 (I2C Bus 0x68)",
      interface: "I2C (SCL D1 / SDA D2)",
      status: sensorSystemStatus === 'LIVE' ? "Normal" : sensorSystemStatus,
      isSimulated: !hasEverReceivedData,
      simulationLabel: getSensorTag(),
      icon: Compass
    },
    {
      id: "gps",
      hardware: "NEO-6M GPS Module",
      probeRole: "Geographic Navigation & Drift",
      readings: [
        { label: "Platform Latitude", value: coordinates.lat.toFixed(4), unit: "° N" },
        { label: "Platform Longitude", value: coordinates.lng.toFixed(4), unit: "° E" },
        { label: "Tracking Fix", value: isHardwareConnected ? "3D Fix (12 Sats)" : "Fix Standby", unit: "" }
      ],
      source: "GPS Module (UART)",
      interface: "UART Serial (Rx D7 / Tx D8)",
      status: sensorSystemStatus === 'LIVE' ? "Normal" : sensorSystemStatus,
      isSimulated: !hasEverReceivedData,
      simulationLabel: hasEverReceivedData ? "3D GNSS FIX" : "SIMULATED DATA",
      icon: MapPin
    },
    {
      id: "lora",
      hardware: "LoRa RA-02 (SX1278)",
      probeRole: "Long-Range Wireless RF Telemetry",
      readings: [
        { label: "Communication Status", value: loraStatus, unit: "" },
        { label: "Gateway Link Status", value: loraMessage, unit: "" },
        { label: "Primary Protocol", value: "Wi-Fi (Active Ingestion)", unit: "" }
      ],
      source: "LoRa RA-02",
      interface: "SPI Bus (MOSI D7, MISO D6, SCK D5, NSS D8)",
      status: loraStatus,
      isSimulated: false,
      simulationLabel: "NOT CONNECTED",
      icon: Radio
    },
    {
      id: "depth",
      hardware: "Simulated / Future Depth Sensor",
      probeRole: "Ocean Subsurface Bathymetry",
      readings: [
        { label: "Subsurface Ocean Depth", value: sensors.depth?.value ?? 18.6, unit: "m" }
      ],
      source: "Simulated / Future Sensor",
      interface: "Analog / Hydrostatic Future Port",
      status: "Normal",
      isSimulated: true,
      simulationLabel: "SIMULATED / FUTURE SENSOR",
      icon: ArrowDownCircle
    }
  ];

  return (
    <div className="sensor-data-view">
      {/* Top Banner and Streaming Controller */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="var(--accent-cyan)" />
            DHRUV-NET Dedicated Sensor Array
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Direct sensor telemetry acquired by <strong>NodeMCU ESP8266</strong> and transmitted via <strong>LoRa RA-02</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            className="btn-secondary-action"
            onClick={() => setIsGuideOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '0.8rem' }}
          >
            <BookOpen size={14} />
            <span>Hardware Wiring Guide</span>
          </button>

          <button 
            onClick={toggleLiveStream}
            className={`stream-toggle-btn ${isLiveStreaming ? 'active' : ''}`}
          >
            {isLiveStreaming ? <Pause size={14} /> : <Play size={14} />}
            <span>{isLiveStreaming ? 'Live Polling Active (2.5s)' : 'Polling Paused'}</span>
          </button>
        </div>
      </div>

      {/* Hardware Connection Policy Banner */}
      <div className={`simulation-notice-banner ${isHardwareConnected ? 'live-mode' : 'standby-mode'}`} style={{ marginBottom: '20px' }}>
        <div className="notice-icon">
          {isHardwareConnected ? (
            <CheckCircle2 size={18} color="#34d399" />
          ) : (
            <AlertTriangle size={18} color="#f59e0b" />
          )}
        </div>
        <div className="notice-content">
          <strong>HARDWARE STATUS NOTICE: </strong> 
          {isHardwareConnected ? (
            <span>Physical NodeMCU ESP8266 and LoRa RA-02 gateway are connected. Real sensor readings are being parsed into the telemetry buffer.</span>
          ) : (
            <span>NodeMCU ESP8266 and LoRa RA-02 are <strong>NOT currently connected</strong>. All sensor metrics shown below are computed via realistic oceanographic simulation. When physical hardware is connected, live telemetry will automatically replace simulation.</span>
          )}
        </div>
      </div>

      {/* Grid of All 7 Sensors */}
      <div className="dedicated-sensor-grid">
        {sensorList.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="sensor-detail-card glass-card">
              <div className="card-top-row">
                <div className="sensor-identity">
                  <div className="sensor-icon-box">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="hardware-name">{item.hardware}</h3>
                    <span className="probe-role">{item.probeRole}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span className={`status-pill ${item.status.toLowerCase() === 'connected' || item.status.toLowerCase() === 'normal' ? (isHardwareConnected ? 'online' : 'not-connected') : 'not-connected'}`}>
                    {item.status}
                  </span>
                  <span className="simulated-pill-tag">
                    {item.simulationLabel}
                  </span>
                </div>
              </div>

              {/* Parameter Readouts */}
              <div className="sensor-metrics-list">
                {item.readings.map((reading, idx) => (
                  <div key={idx} className="metric-row">
                    <span className="metric-name">{reading.label}</span>
                    <span className="metric-val">
                      {reading.value} {reading.unit}
                    </span>
                  </div>
                ))}
              </div>

              {/* Hardware Spec Footnotes */}
              <div className="sensor-spec-footer">
                <div className="spec-item">
                  <span className="spec-label">Bus:</span>
                  <span className="spec-val">{item.interface}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Source:</span>
                  <span className="spec-val">{item.source}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* NodeMCU ESP8266 Pinout & Wiring Specifications */}
      <div className="pinout-section glass-card" style={{ marginTop: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
              NodeMCU ESP8266 Microcontroller Hardware Pinout &amp; Wiring
            </h3>
          </div>
          <button 
            className="link-button"
            onClick={() => setIsGuideOpen(true)}
          >
            View Complete Wiring &amp; Code &rarr;
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 14px' }}>Sensor / Module</th>
                <th style={{ padding: '10px 14px' }}>Function</th>
                <th style={{ padding: '10px 14px' }}>NodeMCU ESP8266 Pin</th>
                <th style={{ padding: '10px 14px' }}>Protocol</th>
                <th style={{ padding: '10px 14px' }}>Voltage</th>
                <th style={{ padding: '10px 14px' }}>Hardware Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>DS18B20 (Waterproof)</td>
                <td style={{ padding: '12px 14px' }}>Water Temperature</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>D3 (GPIO0)</td>
                <td style={{ padding: '12px 14px' }}>1-Wire (4.7kΩ pull-up)</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>3.3V</td>
                <td style={{ padding: '12px 14px', color: isHardwareConnected ? '#34d399' : '#818cf8' }}>
                  {isHardwareConnected ? 'Active / Polling' : 'SIMULATED (Using simulated data)'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>DHT22 (AM2302)</td>
                <td style={{ padding: '12px 14px' }}>Air Temp &amp; Humidity</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>D4 (GPIO2)</td>
                <td style={{ padding: '12px 14px' }}>Single-Wire Digital</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>3.3V</td>
                <td style={{ padding: '12px 14px', color: isHardwareConnected ? '#34d399' : '#818cf8' }}>
                  {isHardwareConnected ? 'Active / Polling' : 'SIMULATED (Using simulated data)'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>BMP280 Barometer</td>
                <td style={{ padding: '12px 14px' }}>Atmospheric Pressure</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>D1 (SCL / GPIO5), D2 (SDA / GPIO4)</td>
                <td style={{ padding: '12px 14px' }}>I2C (Addr: 0x76)</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>3.3V</td>
                <td style={{ padding: '12px 14px', color: isHardwareConnected ? '#34d399' : '#818cf8' }}>
                  {isHardwareConnected ? 'Active / Polling' : 'SIMULATED (Using simulated data)'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>MPU6050 6-Axis IMU</td>
                <td style={{ padding: '12px 14px' }}>Platform Attitude (Roll/Pitch/Yaw)</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>D1 (SCL / GPIO5), D2 (SDA / GPIO4)</td>
                <td style={{ padding: '12px 14px' }}>I2C (Addr: 0x68)</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>3.3V</td>
                <td style={{ padding: '12px 14px', color: isHardwareConnected ? '#34d399' : '#818cf8' }}>
                  {isHardwareConnected ? 'Active / Polling' : 'SIMULATED (Using simulated data)'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>NEO-6M GPS</td>
                <td style={{ padding: '12px 14px' }}>Lat, Lng, UTC Clock</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>D7 (Rx / GPIO13), D8 (Tx / GPIO15)</td>
                <td style={{ padding: '12px 14px' }}>UART (9600 Baud)</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>3.3V</td>
                <td style={{ padding: '12px 14px', color: isHardwareConnected ? '#34d399' : '#818cf8' }}>
                  {isHardwareConnected ? '3D Fix Acquired' : 'SIMULATED (Using simulated data)'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>LoRa RA-02 (SX1278)</td>
                <td style={{ padding: '12px 14px' }}>Wireless Ocean Telemetry</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>D5(SCK), D6(MISO), D7(MOSI), D8(CS)</td>
                <td style={{ padding: '12px 14px' }}>Hardware SPI (433MHz)</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>3.3V</td>
                <td style={{ padding: '12px 14px', color: isHardwareConnected ? '#34d399' : '#f59e0b' }}>
                  {isHardwareConnected ? 'Connected' : 'NOT CONNECTED (Waiting for LoRa gateway)'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>Future Depth Sensor</td>
                <td style={{ padding: '12px 14px' }}>Ocean Depth</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>A0 (ADC) or I2C Extender</td>
                <td style={{ padding: '12px 14px' }}>Analog / Digital</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>3.3V</td>
                <td style={{ padding: '12px 14px', color: '#f59e0b' }}>Simulated / Reserved</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* NodeMCU ESP8266 + LoRa RA-02 Architecture Banner */}
      <div className="api-readiness-banner">
        <div className="api-icon-wrap">
          <Server size={24} />
        </div>
        <div className="api-content">
          <h4>NodeMCU ESP8266 &amp; LoRa RA-02 Ingestion Architecture</h4>
          <p>
            The telemetry pipeline is architected to ingest live packets from the <strong>NodeMCU ESP8266</strong>. 
            When real hardware packets are transmitted over <strong>LoRa RA-02</strong> and received at the coastal Gateway, 
            they are forwarded to <code>POST /api/telemetry</code> and immediately replace the simulated data stream.
          </p>
          <div className="api-code-snippet">
            // Gateway endpoint: POST http://&lt;gateway-ip&gt;:5000/api/telemetry (Receives LoRa packets from NodeMCU ESP8266)
          </div>
        </div>
      </div>

      {/* Hardware Integration Modal */}
      <HardwareGuideModal 
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        isHardwareConnected={isHardwareConnected}
        onToggleTestHardware={onToggleTestHardware}
      />
    </div>
  );
}
