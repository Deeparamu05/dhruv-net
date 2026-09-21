import React from 'react';
import { 
  Menu, 
  RefreshCw, 
  MapPin, 
  Clock, 
  Battery, 
  ShieldCheck 
} from 'lucide-react';

export default function Header({ 
  activeTab, 
  platformStatus, 
  onRefresh, 
  isRefreshing, 
  onToggleMenu 
}) {
  const titles = {
    dashboard: 'Live Monitoring Dashboard',
    sensors: 'Sensor Data Collection',
    map: 'Live Ocean Tracking Map',
    analytics: 'Graphs & Historical Analytics'
  };

  const battery = platformStatus?.battery || 89;
  const isBatteryLow = battery < 25;
  const isBatteryWarning = battery >= 25 && battery < 50;

  let batteryFillClass = '';
  if (isBatteryLow) batteryFillClass = 'danger';
  else if (isBatteryWarning) batteryFillClass = 'warning';

  return (
    <header className="top-header">
      <div className="header-left">
        <button 
          className="menu-toggle-btn" 
          onClick={onToggleMenu}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="page-title">{titles[activeTab] || 'Dashboard'}</h1>
        
        <div className={`status-pill ${platformStatus?.status?.toLowerCase() === 'online' ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          <span>{platformStatus?.status || 'ONLINE'}</span>
        </div>
      </div>

      <div className="header-right">
        {/* GPS Coordinates */}
        <div className="telemetry-item coords" title="Current GPS Position">
          <MapPin size={15} color="var(--accent-cyan)" />
          <span className="telemetry-value">
            {platformStatus?.coordinates?.formatted || '15.2993° N, 73.8243° E'}
          </span>
        </div>

        {/* Battery */}
        <div className="telemetry-item" title="Platform Power Source">
          <div className="battery-bar-container">
            <div className="battery-meter">
              <div 
                className={`battery-fill ${batteryFillClass}`} 
                style={{ width: `${battery}%` }}
              ></div>
            </div>
            <span className="telemetry-value">{battery}%</span>
          </div>
        </div>

        {/* Last received time */}
        <div className="telemetry-item" title="Last Telemetry Ingestion Time">
          <Clock size={15} color="var(--accent-teal)" />
          <span>Last sync:</span>
          <span className="telemetry-value">
            {platformStatus?.displayTime || 'Just now'}
          </span>
        </div>

        {/* Quick Refresh */}
        <button 
          className="refresh-button" 
          onClick={onRefresh} 
          disabled={isRefreshing}
          title="Poll platform sensors"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Sync</span>
        </button>
      </div>
    </header>
  );
}
