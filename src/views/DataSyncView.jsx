import React, { useState } from 'react';
import { 
  RefreshCw, 
  Database, 
  Cloud, 
  HardDrive, 
  Cpu, 
  Activity, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  ArrowDown, 
  ArrowRight,
  Clock, 
  Layers, 
  Info,
  Server,
  Radio,
  FileCheck
} from 'lucide-react';

export default function DataSyncView({ 
  syncState = {
    localRecords: 248,
    uploadedRecords: 230,
    pendingRecords: 18,
    lastSuccessfulSync: new Date().toISOString(),
    connectionStatus: "Connected"
  },
  onTriggerSync,
  onToggleConnection
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState(null); // 'Data stored locally' | 'Syncing...' | 'Sync Complete'
  const [syncProgress, setSyncProgress] = useState(0);

  const isConnected = syncState.connectionStatus === 'Connected';

  const handleSyncNow = async () => {
    if (!isConnected) {
      setSyncStatusMessage('Data stored locally');
      return;
    }

    setIsSyncing(true);
    setSyncStatusMessage('Syncing...');
    setSyncProgress(25);

    setTimeout(() => {
      setSyncProgress(65);
    }, 400);

    setTimeout(async () => {
      setSyncProgress(100);
      if (onTriggerSync) {
        await onTriggerSync();
      }
      setIsSyncing(false);
      setSyncStatusMessage('Sync Complete');
      setTimeout(() => {
        setSyncProgress(0);
      }, 2500);
    }, 1000);
  };

  const handleToggleConn = () => {
    if (onToggleConnection) {
      const nextConnected = !isConnected;
      onToggleConnection(nextConnected);
      if (!nextConnected) {
        setSyncStatusMessage('Data stored locally');
      } else {
        setSyncStatusMessage(null);
      }
    }
  };

  return (
    <div className="data-sync-view">
      {/* Simulation Notice Banner */}
      <div className="simulation-notice-banner" style={{ marginBottom: '18px' }}>
        <div className="notice-icon">
          <Info size={18} color="var(--accent-cyan)" />
        </div>
        <div className="notice-content">
          <strong>SIMULATED DATA BUFFER &amp; SYNCHRONIZATION:</strong> Visualizing the edge buffer on the NodeMCU ESP8266 (SPIFFS flash memory) and transmission to cloud storage.
        </div>
      </div>

      {/* Top Header & Simulation Controls */}
      <div className="sync-header-row">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={20} color="var(--accent-cyan)" className={isSyncing ? 'animate-spin' : ''} />
            Data Synchronization &amp; Edge Buffer
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            NodeMCU ESP8266 local SPIFFS log storage &bull; LoRa RA-02 transmission &bull; Cloud database ingestion
          </p>
        </div>

        {/* Action Buttons to test Connected/Offline & Sync */}
        <div className="sync-action-buttons">
          <button 
            className={`btn-connection-toggle ${isConnected ? 'connected' : 'offline'}`}
            onClick={handleToggleConn}
            title="Toggle between Online LoRa link and Offline edge mode"
          >
            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>Link: {isConnected ? 'Connected' : 'Offline'}</span>
          </button>

          <button 
            className="btn-sync-trigger"
            onClick={handleSyncNow}
            disabled={isSyncing || syncState.pendingRecords === 0}
            title="Trigger synchronization of local pending records"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Status Banner for offline/syncing/complete */}
      {syncStatusMessage && (
        <div className={`sync-status-alert-banner ${syncStatusMessage === 'Data stored locally' ? 'offline' : 'complete'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {syncStatusMessage === 'Data stored locally' && <HardDrive size={18} color="#f59e0b" />}
            {syncStatusMessage === 'Syncing...' && <RefreshCw size={18} color="#38bdf8" className="animate-spin" />}
            {syncStatusMessage === 'Sync Complete' && <CheckCircle2 size={18} color="#34d399" />}
            <strong>Status: {syncStatusMessage}</strong>
          </div>
          {syncStatusMessage === 'Data stored locally' && (
            <span>LoRa uplink disconnected. Sensor packets safely stored in NodeMCU local flash memory.</span>
          )}
          {syncStatusMessage === 'Syncing...' && (
            <span>Uploading {syncState.pendingRecords} queued sensor packets to central database...</span>
          )}
          {syncStatusMessage === 'Sync Complete' && (
            <span>All local edge records successfully uploaded and verified in cloud database.</span>
          )}
        </div>
      )}

      {/* Progress Bar when syncing */}
      {isSyncing && (
        <div className="sync-progress-bar-wrap">
          <div className="sync-progress-bar-fill" style={{ width: `${syncProgress}%` }}></div>
        </div>
      )}

      {/* Required Section 10: 5 Core Telemetry Counters */}
      <div className="sync-metrics-grid">
        <div className="glass-card sync-metric-box">
          <div className="sync-box-top">
            <span className="sync-box-label">Local Records</span>
            <HardDrive size={18} color="#38bdf8" />
          </div>
          <div className="sync-box-val" style={{ color: '#38bdf8' }}>
            {syncState.localRecords}
          </div>
          <span className="sync-box-sub">Cached on NodeMCU Flash</span>
        </div>

        <div className="glass-card sync-metric-box">
          <div className="sync-box-top">
            <span className="sync-box-label">Uploaded Records</span>
            <Cloud size={18} color="#34d399" />
          </div>
          <div className="sync-box-val" style={{ color: '#34d399' }}>
            {syncState.uploadedRecords}
          </div>
          <span className="sync-box-sub">Synced to Cloud Database</span>
        </div>

        <div className="glass-card sync-metric-box">
          <div className="sync-box-top">
            <span className="sync-box-label">Pending Records</span>
            <Database size={18} color={syncState.pendingRecords > 0 ? '#f59e0b' : '#94a3b8'} />
          </div>
          <div className="sync-box-val" style={{ color: syncState.pendingRecords > 0 ? '#f59e0b' : '#94a3b8' }}>
            {syncState.pendingRecords}
          </div>
          <span className="sync-box-sub">Awaiting Gateway Upload</span>
        </div>

        <div className="glass-card sync-metric-box">
          <div className="sync-box-top">
            <span className="sync-box-label">Connection Status</span>
            {isConnected ? <Wifi size={18} color="#34d399" /> : <WifiOff size={18} color="#f87171" />}
          </div>
          <div className="sync-box-val" style={{ color: isConnected ? '#34d399' : '#f87171', fontSize: '1.25rem' }}>
            {syncState.connectionStatus}
          </div>
          <span className="sync-box-sub">LoRa RA-02 Gateway Link</span>
        </div>

        <div className="glass-card sync-metric-box">
          <div className="sync-box-top">
            <span className="sync-box-label">Last Successful Sync</span>
            <Clock size={18} color="var(--accent-teal)" />
          </div>
          <div className="sync-box-val" style={{ fontSize: '1rem', color: '#f8fafc' }}>
            {new Date(syncState.lastSuccessfulSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <span className="sync-box-sub">{new Date(syncState.lastSuccessfulSync).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Visual Workflow Diagram Required by Section 10 */}
      <div className="glass-card workflow-visualizer-card">
        <h3 className="section-subtitle" style={{ marginBottom: '22px' }}>
          <Layers size={18} color="var(--accent-cyan)" />
          DHRUV-NET End-to-End Data Pipeline Architecture
        </h3>

        <div className="workflow-flowchart-container">
          {/* Node 1: Sensors */}
          <div className="workflow-step-node">
            <div className="node-icon-box">
              <Activity size={22} color="var(--accent-cyan)" />
            </div>
            <div className="node-title">Sensors</div>
            <div className="node-desc">DHT22, DS18B20, BMP280, MPU6050, GPS</div>
          </div>

          <div className="workflow-connector">
            <div className="conn-line active"></div>
            <ArrowDown size={18} className="conn-arrow" />
          </div>

          {/* Node 2: NodeMCU ESP8266 */}
          <div className="workflow-step-node highlight">
            <div className="node-icon-box">
              <Cpu size={22} color="#00f2fe" />
            </div>
            <div className="node-title">NodeMCU ESP8266</div>
            <div className="node-desc">Main Microcontroller &amp; Packeting</div>
          </div>

          <div className="workflow-connector">
            <div className="conn-line active"></div>
            <ArrowDown size={18} className="conn-arrow" />
          </div>

          {/* Node 3: Local Storage */}
          <div className="workflow-step-node">
            <div className="node-icon-box">
              <HardDrive size={22} color="#38bdf8" />
            </div>
            <div className="node-title">Local Storage</div>
            <div className="node-desc">SPIFFS Flash Ring Buffer (4MB)</div>
          </div>

          <div className="workflow-connector">
            <div className={`conn-line ${isConnected ? 'active' : 'dormant'}`}></div>
            <ArrowDown size={18} className="conn-arrow" />
          </div>

          {/* Node 4: Connection Available? Decision */}
          <div className={`workflow-decision-diamond ${isConnected ? 'available' : 'offline'}`}>
            <div className="diamond-text">
              <Radio size={16} />
              <span>Connection Available?</span>
              <strong className="status-label">{isConnected ? 'YES (Connected)' : 'NO (Offline)'}</strong>
            </div>
          </div>

          <div className="workflow-connector">
            <div className={`conn-line ${isConnected ? 'active' : 'dormant'}`}></div>
            <ArrowDown size={18} className="conn-arrow" />
          </div>

          {/* Node 5: Cloud Upload via LoRa RA-02 */}
          <div className="workflow-step-node">
            <div className="node-icon-box">
              <Cloud size={22} color="#34d399" />
            </div>
            <div className="node-title">Cloud Upload</div>
            <div className="node-desc">LoRa RA-02 &rarr; Coastal Gateway</div>
          </div>

          <div className="workflow-connector">
            <div className="conn-line active"></div>
            <ArrowDown size={18} className="conn-arrow" />
          </div>

          {/* Node 6: Database */}
          <div className="workflow-step-node">
            <div className="node-icon-box">
              <Database size={22} color="#a855f7" />
            </div>
            <div className="node-title">Database</div>
            <div className="node-desc">Timeseries &amp; Persistent Telemetry</div>
          </div>

          <div className="workflow-connector">
            <div className="conn-line active"></div>
            <ArrowDown size={18} className="conn-arrow" />
          </div>

          {/* Node 7: Dashboard */}
          <div className="workflow-step-node final">
            <div className="node-icon-box">
              <Server size={22} color="#34d399" />
            </div>
            <div className="node-title">DHRUV-NET Dashboard</div>
            <div className="node-desc">Live Telemetry &amp; Analytics UI</div>
          </div>
        </div>
      </div>

      {/* Edge Offline Strategy Explanation */}
      <div className="api-readiness-banner" style={{ marginTop: '20px' }}>
        <div className="api-icon-wrap">
          <HardDrive size={24} />
        </div>
        <div className="api-content">
          <h4>Resilient Edge Storage &amp; Future LoRa Hardware Integration</h4>
          <p>
            When autonomous ocean buoys encounter temporary LoRa RF attenuation or storm squalls, 
            the <strong>NodeMCU ESP8266</strong> automatically switches to local logging in its onboard 
            <strong>SPIFFS flash storage</strong>. When the LoRa receiver gateway acknowledges contact, 
            backlogged records are flushed in chronological order.
          </p>
          <div className="api-code-snippet">
            {"// Firmware logic: if (!lora.isAckReceived()) { spiffs.write(packet); pendingCount++; }"}
          </div>
        </div>
      </div>
    </div>
  );
}
