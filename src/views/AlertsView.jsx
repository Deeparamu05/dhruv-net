import React, { useState } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Filter, 
  ShieldAlert, 
  Cpu, 
  Info,
  Check,
  Search
} from 'lucide-react';

export default function AlertsView({ 
  alerts = [], 
  onResolveAlert 
}) {
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, resolved
  const [filterSeverity, setFilterSeverity] = useState('all'); // all, warning, critical
  const [searchQuery, setSearchQuery] = useState('');

  // Filter logic
  const filteredAlerts = alerts.filter((alert) => {
    if (filterStatus === 'active' && alert.status !== 'Active') return false;
    if (filterStatus === 'resolved' && alert.status !== 'Resolved') return false;
    if (filterSeverity !== 'all' && alert.severity.toLowerCase() !== filterSeverity.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        alert.alertType.toLowerCase().includes(q) ||
        alert.reason.toLowerCase().includes(q) ||
        alert.id.toLowerCase().includes(q) ||
        alert.currentValue.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = alerts.filter((a) => a.status === 'Active').length;
  const criticalCount = alerts.filter((a) => a.status === 'Active' && a.severity === 'Critical').length;
  const warningCount = alerts.filter((a) => a.status === 'Active' && a.severity === 'Warning').length;

  return (
    <div className="alerts-view">
      {/* Simulation Notice Banner */}
      <div className="simulation-notice-banner" style={{ marginBottom: '18px' }}>
        <div className="notice-icon">
          <Info size={18} color="var(--accent-cyan)" />
        </div>
        <div className="notice-content">
          <strong>SIMULATED ALERTS MONITOR:</strong> Displaying platform diagnostic anomalies and threshold trigger events generated from NodeMCU ESP8266 and LoRa telemetry.
        </div>
      </div>

      {/* Top Header & Alert Metrics */}
      <div className="alerts-header-row">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={20} color="var(--accent-cyan)" />
            Platform Alerts &amp; Diagnostic Notifications
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Threshold monitoring for DHRUV-01 sensor readings, power levels, and LoRa communications
          </p>
        </div>

        {/* Quick count badges */}
        <div className="alert-stats-counters">
          <div className="counter-pill active">
            <span className="counter-num">{activeCount}</span>
            <span className="counter-label">Active Alerts</span>
          </div>
          <div className="counter-pill critical">
            <span className="counter-num">{criticalCount}</span>
            <span className="counter-label">Critical</span>
          </div>
          <div className="counter-pill warning">
            <span className="counter-num">{warningCount}</span>
            <span className="counter-label">Warnings</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="alerts-control-bar glass-card">
        <div className="search-input-wrap">
          <Search size={15} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search alerts by type, reason, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="alert-search-input"
          />
        </div>

        <div className="filter-buttons-wrap">
          <div className="filter-group">
            <span className="filter-title">Status:</span>
            <button 
              className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({alerts.length})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
              onClick={() => setFilterStatus('active')}
            >
              Active ({activeCount})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'resolved' ? 'active' : ''}`}
              onClick={() => setFilterStatus('resolved')}
            >
              Resolved ({alerts.length - activeCount})
            </button>
          </div>

          <div className="filter-group">
            <span className="filter-title">Severity:</span>
            <button 
              className={`filter-btn ${filterSeverity === 'all' ? 'active' : ''}`}
              onClick={() => setFilterSeverity('all')}
            >
              All
            </button>
            <button 
              className={`filter-btn critical ${filterSeverity === 'critical' ? 'active' : ''}`}
              onClick={() => setFilterSeverity('critical')}
            >
              Critical
            </button>
            <button 
              className={`filter-btn warning ${filterSeverity === 'warning' ? 'active' : ''}`}
              onClick={() => setFilterSeverity('warning')}
            >
              Warning
            </button>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="alerts-list">
        {filteredAlerts.length === 0 ? (
          <div className="empty-alerts-card glass-card">
            <CheckCircle size={36} color="#34d399" />
            <h4 style={{ color: '#ffffff', marginTop: '10px' }}>No Alerts Found</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
              All matching sensor parameters and subsystem monitors are operating within nominal thresholds.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'Critical';
            const isActive = alert.status === 'Active';

            return (
              <div 
                key={alert.id} 
                className={`alert-card glass-card ${isCritical ? 'critical-border' : 'warning-border'} ${!isActive ? 'resolved' : ''}`}
              >
                <div className="alert-card-header">
                  <div className="alert-card-left">
                    <div className={`alert-icon-box ${isCritical ? 'critical' : 'warning'}`}>
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 className="alert-title">{alert.alertType}</h3>
                        <span className="alert-id-badge">{alert.id}</span>
                        <span className="platform-tag">ID: {alert.platformId}</span>
                      </div>
                      <div className="alert-time-meta">
                        <Clock size={12} color="var(--text-dim)" />
                        <span>{alert.date} at {alert.time}</span>
                        {alert.source && (
                          <span className="alert-source-pill">Source: {alert.source}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="alert-card-right">
                    <span className={`severity-badge ${alert.severity.toLowerCase()}`}>
                      {alert.severity}
                    </span>
                    <span className={`status-badge ${alert.status.toLowerCase()}`}>
                      {alert.status}
                    </span>
                  </div>
                </div>

                <div className="alert-card-body">
                  <div className="alert-val-row">
                    <span className="alert-val-label">Current Value:</span>
                    <span className="alert-val-highlight">{alert.currentValue}</span>
                  </div>
                  <p className="alert-reason-text">
                    <strong>Reason:</strong> {alert.reason}
                  </p>
                </div>

                <div className="alert-card-footer">
                  <span className="platform-controller-note">
                    Controller: NodeMCU ESP8266 &bull; Subsystem Monitor
                  </span>

                  {isActive ? (
                    <button 
                      className="resolve-alert-btn"
                      onClick={() => onResolveAlert(alert.id)}
                      title="Acknowledge and mark alert as resolved"
                    >
                      <Check size={14} />
                      <span>Mark as Resolved</span>
                    </button>
                  ) : (
                    <span className="resolved-check-note">
                      <CheckCircle size={14} color="#34d399" />
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
