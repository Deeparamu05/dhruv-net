import React from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  MapPin, 
  LineChart, 
  Radio, 
  Waves
} from 'lucide-react';
import { PLATFORM_INFO } from '../services/mockData';

export default function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sensors', label: 'Sensor Data', icon: Activity },
    { id: 'map', label: 'Live Map', icon: MapPin },
    { id: 'analytics', label: 'Analytics', icon: LineChart }
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-icon">
          <Waves size={22} />
        </div>
        <div className="brand-title">
          <span className="brand-name">DHRUV-NET</span>
          <span className="brand-sub">Ocean Observer</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                if (setIsOpen) setIsOpen(false);
              }}
            >
              <Icon className="nav-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="platform-badge">
          <span style={{ color: 'var(--text-secondary)' }}>ID:</span>
          <span className="platform-badge-id">{PLATFORM_INFO.id}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
          <Radio size={14} color="var(--accent-teal)" />
          <span>Telemetry Protocol: UDP/MQTT</span>
        </div>
      </div>
    </aside>
  );
}
