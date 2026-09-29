import React from 'react';
import {
  LayoutDashboard, Activity, MapPin, LineChart,
  Bell, Zap, Download, Settings
} from 'lucide-react';

const NAV = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'sensors',   icon: Activity,        label: 'Sensors'   },
  { id: 'map',       icon: MapPin,          label: 'Live Map'  },
  { id: 'analytics', icon: LineChart,       label: 'Analytics' },
  { id: 'alerts',    icon: Bell,            label: 'Alerts', badge: true },
  { id: 'power',     icon: Zap,             label: 'Power'     },
  { id: 'export',    icon: Download,        label: 'Export'    },
];

export default function Sidebar({ activeTab, setActiveTab, activeAlertCount }) {
  return (
    <aside className="dn-sidebar">
      {/* Logo mark */}
      <div className="dn-sb-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
          <path d="M2 10c2 0 4-4 6-4s4 4 6 4 4-4 6-4" strokeLinecap="round"/>
          <path d="M2 17c2 0 4-4 6-4s4 4 6 4 4-4 6-4" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Nav */}
      <nav className="dn-sb-nav">
        {NAV.map(({ id, icon: Icon, label, badge }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              className={`dn-sb-btn${active ? ' active' : ''}`}
              onClick={() => setActiveTab(id)}
              title={label}
              aria-label={label}
            >
              {active && <span className="dn-sb-indicator" />}
              <Icon size={17} strokeWidth={active ? 2 : 1.5} />
              {badge && activeAlertCount > 0 && (
                <span className="dn-sb-badge">{activeAlertCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="dn-sb-foot">
        <button className="dn-sb-btn" title="Settings" onClick={() => setActiveTab('settings')}>
          <Settings size={17} strokeWidth={1.5} />
        </button>
        <div className="dn-sb-online" title="System online" />
      </div>
    </aside>
  );
}
