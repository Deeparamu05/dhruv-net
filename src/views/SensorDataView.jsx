import React from 'react';
import SensorCard from '../components/SensorCard';
import { 
  Activity, 
  Cpu, 
  CheckCircle2, 
  Play, 
  Pause, 
  Terminal,
  Server
} from 'lucide-react';

export default function SensorDataView({ 
  telemetry, 
  isLiveStreaming, 
  toggleLiveStream 
}) {
  const sensors = telemetry?.sensors || {};

  return (
    <div className="sensor-data-view">
      {/* Top action & status banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#ffffff' }}>
            Oceanographic & Atmospheric Sensor Stream
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Calibrated CTD (Conductivity, Temperature, Depth) and barometric sensors sampling marine environment
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={toggleLiveStream}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: isLiveStreaming ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: isLiveStreaming ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
              color: isLiveStreaming ? '#34d399' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.84rem',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            {isLiveStreaming ? <Pause size={14} /> : <Play size={14} />}
            <span>{isLiveStreaming ? 'Live Stream Active (2s)' : 'Stream Paused'}</span>
          </button>
        </div>
      </div>

      {/* Grid of 5 Main Sensor Cards */}
      <div className="sensor-cards-grid">
        <SensorCard 
          id="temperature"
          label={sensors.temperature?.label || "Water Temperature"}
          value={sensors.temperature?.value}
          unit={sensors.temperature?.unit || "°C"}
          status={sensors.temperature?.status || "Normal"}
          trend={sensors.temperature?.trend || "steady"}
          timestamp={telemetry?.timestamp}
        />
        <SensorCard 
          id="salinity"
          label={sensors.salinity?.label || "Salinity"}
          value={sensors.salinity?.value}
          unit={sensors.salinity?.unit || "PSU"}
          status={sensors.salinity?.status || "Normal"}
          trend={sensors.salinity?.trend || "steady"}
          timestamp={telemetry?.timestamp}
        />
        <SensorCard 
          id="pressure"
          label={sensors.pressure?.label || "Pressure"}
          value={sensors.pressure?.value}
          unit={sensors.pressure?.unit || "dbar"}
          status={sensors.pressure?.status || "Optimal"}
          trend={sensors.pressure?.trend || "steady"}
          timestamp={telemetry?.timestamp}
        />
        <SensorCard 
          id="depth"
          label={sensors.depth?.label || "Depth"}
          value={sensors.depth?.value}
          unit={sensors.depth?.unit || "m"}
          status={sensors.depth?.status || "Normal"}
          trend={sensors.depth?.trend || "steady"}
          timestamp={telemetry?.timestamp}
        />
        <SensorCard 
          id="humidity"
          label={sensors.humidity?.label || "Humidity"}
          value={sensors.humidity?.value}
          unit={sensors.humidity?.unit || "% RH"}
          status={sensors.humidity?.status || "Nominal"}
          trend={sensors.humidity?.trend || "up"}
          timestamp={telemetry?.timestamp}
        />
      </div>

      {/* Sensor Specifications & Operational Thresholds Table */}
      <div className="glass-card" style={{ marginTop: '16px' }}>
        <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#ffffff', marginBottom: '16px' }}>
          Sensor Calibration & Operational Thresholds
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Sensor Parameter</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Standard Unit</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Calibrated Range</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Accuracy</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Hardware Probe</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>Water Temperature</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>°C (Celsius)</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>-2.00 to +35.00 °C</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>&plusmn; 0.005 °C</td>
                <td style={{ padding: '12px 14px' }}>PT100 Platinum RTD</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>Salinity</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>PSU</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>0.00 to 42.00 PSU</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>&plusmn; 0.01 PSU</td>
                <td style={{ padding: '12px 14px' }}>Inductive Toroidal Cell</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>Hydrostatic Pressure</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>dbar / hPa</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>0.0 to 2000.0 dbar</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>&plusmn; 0.05% FS</td>
                <td style={{ padding: '12px 14px' }}>Piezoresistive Diaphragm</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>Subsurface Depth</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>m (Meters)</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>0.00 to 500.00 m</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>&plusmn; 0.1 m</td>
                <td style={{ padding: '12px 14px' }}>Hydrostatic Conversion</td>
              </tr>
              <tr>
                <td style={{ padding: '12px 14px', color: '#ffffff', fontWeight: 500 }}>Atmospheric Humidity</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>% RH</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>0.0% to 100.0% RH</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>&plusmn; 1.5% RH</td>
                <td style={{ padding: '12px 14px' }}>Capacitive Marine SHT45</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Raspberry Pi / Node.js Express Backend Integration Card */}
      <div className="api-readiness-banner">
        <div className="api-icon-wrap">
          <Server size={24} />
        </div>
        <div className="api-content">
          <h4>Raspberry Pi & Node.js/Express API Connection Architecture</h4>
          <p>
            The frontend service layer in <code>src/services/api.js</code> is ready for real hardware ingestion. 
            To stream live readings from a Raspberry Pi attached to your marine sensor payload, configure the API target:
          </p>
          <div className="api-code-snippet">
            // Set in .env or docker-compose: VITE_API_BASE_URL=http://&lt;raspberry-pi-ip&gt;:5000/api
          </div>
        </div>
      </div>
    </div>
  );
}
