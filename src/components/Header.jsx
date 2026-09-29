import React, { useState, useEffect } from 'react';
import { Bell, Settings } from 'lucide-react';

export default function Header({ platformStatus, activeAlertCount, onNavigateToAlerts, isWsConnected }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isConnected = platformStatus?.hardwareConnected || platformStatus?.nodeMcuStatus === 'CONNECTED';

  return (
    <header className="dn-header">
      <div className="dn-header-left">
        <span className="dn-wordmark">DHRUV-NET</span>
        <span className="dn-sub">Ocean Observation Platform</span>
      </div>

      <div className="dn-header-center">
        <span className={`dn-live-dot ${isWsConnected ? 'live' : ''}`} />
        <span className="dn-live-text">{isWsConnected ? 'Live Telemetry' : 'Connecting…'}</span>
      </div>

      <div className="dn-header-right">
        <div className="dn-platform-info">
          <span className="dn-platform-id">DHRUV-01</span>
          <span className={`dn-platform-status ${isConnected ? 'ok' : 'off'}`}>
            {isConnected ? '● CONNECTED' : '○ OFFLINE'}
          </span>
        </div>
        <span className="dn-clock">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <button className="dn-icon-btn" onClick={onNavigateToAlerts} style={{ position: 'relative' }}>
          <Bell size={16} strokeWidth={1.5} />
          {activeAlertCount > 0 && <span className="dn-badge">{activeAlertCount}</span>}
        </button>
        <button className="dn-icon-btn"><Settings size={16} strokeWidth={1.5} /></button>
      </div>
    </header>
  );
}
