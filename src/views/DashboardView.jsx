import React from 'react';
import SensorCard from '../components/SensorCard';
import LiveMap from '../components/LiveMap';
import { 
  ShieldCheck, 
  Battery, 
  MapPin, 
  Radio, 
  Compass, 
  Clock, 
  Layers 
} from 'lucide-react';

export default function DashboardView({ 
  telemetry, 
  platformStatus, 
  onNavigateToMap,
  onNavigateToAnalytics
}) {
  const sensors = telemetry?.sensors || {};
  const coordinates = telemetry?.coordinates || { lat: 15.2993, lng: 73.8243 };

  return (
    <div className="dashboard-container">
      {/* 4 Quick Stat Overview Cards */}
      <div className="status-overview-row">
        <div className="stat-item">
          <div className="stat-item-label">Platform Identifier</div>
          <div className="stat-item-value" style={{ color: 'var(--accent-cyan)' }}>
            {platformStatus?.platformId || 'DHRUV-NET-01'}
          </div>
          <div className="stat-item-sub">Autonomous Moored Buoy</div>
        </div>

        <div className="stat-item">
          <div className="stat-item-label">System Status</div>
          <div className="stat-item-value" style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }}></span>
            {platformStatus?.status || 'ONLINE'}
          </div>
          <div className="stat-item-sub">All sensors communicating</div>
        </div>

        <div className="stat-item">
          <div className="stat-item-label">Power & Storage</div>
          <div className="stat-item-value" style={{ color: '#fbbf24' }}>
            {telemetry?.battery || 89}%
          </div>
          <div className="stat-item-sub">Solar Array Active (Nominal)</div>
        </div>

        <div className="stat-item">
          <div className="stat-item-label">Current Coordinates</div>
          <div className="stat-item-value" style={{ fontSize: '1rem' }}>
            {coordinates.lat ? `${coordinates.lat.toFixed(3)}°N, ${coordinates.lng.toFixed(3)}°E` : '--'}
          </div>
          <div className="stat-item-sub">Arabian Sea Sector-4</div>
        </div>
      </div>

      {/* Latest Sensor Readings Grid (The 5 parameters) */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff' }}>
          Latest Telemetry Readings
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Updated {telemetry?.displayTime || 'Just now'}
        </span>
      </div>

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

      {/* Map Preview and Telemetry Health Grid */}
      <div className="dashboard-grid">
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#ffffff' }}>
                Platform GPS Location
              </h3>
            </div>
            <button 
              onClick={onNavigateToMap}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Expand Full Map &rarr;
            </button>
          </div>

          <LiveMap 
            coordinates={coordinates}
            platformId={platformStatus?.platformId}
            waterTemp={`${sensors.temperature?.value || 22.6}°C`}
            depth={`${sensors.depth?.value || 12.8}m`}
            isFull={false}
          />
        </div>

        {/* Platform Diagnostics & Quick Telemetry Info */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--accent-teal)" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#ffffff' }}>
              Observation Diagnostics
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'space-around' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(6, 13, 29, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Deployment Zone:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: '#ffffff' }}>Arabian Sea (15°17'N, 73°49'E)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(6, 13, 29, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Transceiver Status:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: '#34d399' }}>Uplink Nominal (UDP Stream)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(6, 13, 29, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Subsurface Sensor Array:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: '#38bdf8' }}>CTD & Barometric Operational</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(6, 13, 29, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Sampling Rate:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: '#ffffff' }}>1.0 Hz Continuous Ingestion</span>
            </div>
          </div>

          <button 
            onClick={onNavigateToAnalytics}
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 210, 255, 0.12)',
              border: '1px solid var(--border-glow)',
              color: 'var(--accent-cyan)',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s'
            }}
          >
            View Detailed Historical Analytics &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
