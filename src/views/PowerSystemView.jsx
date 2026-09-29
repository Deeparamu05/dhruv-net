import React, { useState } from 'react';
import { 
  Zap, 
  Battery, 
  Sun, 
  Cpu, 
  Radio, 
  ShieldCheck, 
  Clock, 
  Activity, 
  Moon, 
  Layers, 
  TrendingUp, 
  CheckCircle2, 
  Info,
  Power
} from 'lucide-react';

export default function PowerSystemView({ 
  telemetry, 
  platformStatus 
}) {
  const [platformState, setPlatformState] = useState('Active'); // Active, Charging, Sleeping, Low Power

  // Hardware Status Tracking
  const isHardwareConnected = platformStatus?.nodeMcuStatus === 'CONNECTED' || Boolean(platformStatus?.hardwareConnected);
  const nodeMcuStatus = platformStatus?.nodeMcuStatus || (isHardwareConnected ? 'CONNECTED' : 'DISCONNECTED');
  const nodeMcuMessage = platformStatus?.nodeMcuMessage || (isHardwareConnected ? 'Hardware streaming' : 'Waiting for hardware connection');
  const loraStatus = platformStatus?.loraStatus || 'NOT CONNECTED';
  const loraMessage = platformStatus?.loraMessage || 'Waiting for LoRa gateway (Future Uplink)';
  const sensorSystemStatus = platformStatus?.sensorSystem || (isHardwareConnected ? 'LIVE' : (platformStatus?.packetsReceived > 0 ? 'OFFLINE' : 'SIMULATED'));
  const sensorSystemMessage = platformStatus?.sensorSystemMessage || (isHardwareConnected ? 'Live sensor stream' : 'Using simulated sensor data');

  const batteryPct = telemetry?.battery || 82;
  const batteryVoltage = telemetry?.batteryVoltage || 3.9;
  const solarGen = telemetry?.solarGeneration || 4.8;
  const powerCons = telemetry?.powerConsumption || 1.7;
  const netPower = +(solarGen - powerCons).toFixed(1);

  // States
  const states = ['Active', 'Charging', 'Sleeping', 'Low Power'];

  return (
    <div className="power-system-view">
      {/* Simulation Notice */}
      <div className="simulation-notice-banner" style={{ marginBottom: '18px' }}>
        <div className="notice-icon">
          <Info size={18} color="var(--accent-cyan)" />
        </div>
        <div className="notice-content">
          <strong>SIMULATED POWER TELEMETRY:</strong> Visualizing real-time power management and solar generation for the NodeMCU ESP8266 autonomous buoy platform.
        </div>
      </div>

      {/* Top Header */}
      <div className="power-header-row">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={20} color="var(--accent-cyan)" />
            Platform Power &amp; Subsystem Health
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Photovoltaic generation, 3.7V–4.2V Li-ion battery health, and NodeMCU ESP8266 power budget
          </p>
        </div>

        {/* Platform State Selector */}
        <div className="platform-state-selector">
          <span className="state-label">Platform State:</span>
          <div className="state-pills-row">
            {states.map((st) => (
              <button
                key={st}
                className={`state-pill-btn ${platformState === st ? 'active' : ''}`}
                onClick={() => setPlatformState(st)}
              >
                {st === 'Sleeping' ? <Moon size={12} /> : <Zap size={12} />}
                <span>{st}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 4 Quick Metric Cards */}
      <div className="power-overview-grid">
        {/* Battery Card */}
        <div className="glass-card power-stat-card">
          <div className="stat-card-header">
            <span className="card-sub-title">Battery Level</span>
            <Battery size={20} color="#34d399" />
          </div>
          <div className="stat-card-value-row">
            <span className="large-stat" style={{ color: '#34d399' }}>{batteryPct}%</span>
            <span className="stat-unit">{batteryVoltage} V</span>
          </div>
          <div className="stat-card-footer-text">
            Nominal Li-ion Cell (Full: 4.2V, Cutoff: 3.3V)
          </div>
        </div>

        {/* Solar Generation Card */}
        <div className="glass-card power-stat-card">
          <div className="stat-card-header">
            <span className="card-sub-title">Solar Generation</span>
            <Sun size={20} color="#fbbf24" />
          </div>
          <div className="stat-card-value-row">
            <span className="large-stat" style={{ color: '#fbbf24' }}>{solarGen} W</span>
            <span className="stat-unit">Solar: Active</span>
          </div>
          <div className="stat-card-footer-text">
            MPPT Monocrystalline Marine Solar Array
          </div>
        </div>

        {/* Power Consumption Card */}
        <div className="glass-card power-stat-card">
          <div className="stat-card-header">
            <span className="card-sub-title">Power Consumption</span>
            <Activity size={20} color="#38bdf8" />
          </div>
          <div className="stat-card-value-row">
            <span className="large-stat" style={{ color: '#38bdf8' }}>{powerCons} W</span>
            <span className="stat-unit">~515 mA</span>
          </div>
          <div className="stat-card-footer-text">
            NodeMCU ESP8266 + LoRa RA-02 + Sensor Array
          </div>
        </div>

        {/* Net Energy Balance */}
        <div className="glass-card power-stat-card">
          <div className="stat-card-header">
            <span className="card-sub-title">Net Power Balance</span>
            <TrendingUp size={20} color={netPower > 0 ? '#34d399' : '#fb923c'} />
          </div>
          <div className="stat-card-value-row">
            <span className="large-stat" style={{ color: netPower > 0 ? '#34d399' : '#fb923c' }}>
              {netPower > 0 ? `+${netPower}` : netPower} W
            </span>
            <span className="stat-unit">Net Charging</span>
          </div>
          <div className="stat-card-footer-text">
            Surplus solar energy recharging buffer pack
          </div>
        </div>
      </div>

      {/* Deep Battery & Subsystem Diagnostics Grid */}
      <div className="power-diagnostics-grid">
        {/* Left Column: Battery Visualization & Solar Flow */}
        <div className="glass-card battery-viz-card">
          <h3 className="section-subtitle">
            <Battery size={18} color="var(--accent-cyan)" />
            Battery Bank &amp; Energy Storage Visualization
          </h3>

          <div className="battery-graphic-wrap">
            <div className="battery-shell">
              <div className="battery-terminal"></div>
              <div 
                className="battery-level-liquid"
                style={{ width: `${batteryPct}%` }}
              >
                <div className="liquid-bubble b1"></div>
                <div className="liquid-bubble b2"></div>
              </div>
              <div className="battery-level-text">
                <strong>{batteryPct}%</strong>
                <span>{batteryVoltage} Volts</span>
              </div>
            </div>
          </div>

          {/* Voltage vs Capacity Scale */}
          <div className="voltage-scale-bar">
            <div className="scale-stop">
              <span className="stop-v">3.3 V</span>
              <span className="stop-pct">0% (Cutoff)</span>
            </div>
            <div className="scale-stop">
              <span className="stop-v">3.7 V</span>
              <span className="stop-pct">50% (Nominal)</span>
            </div>
            <div className="scale-stop active">
              <span className="stop-v">{batteryVoltage} V</span>
              <span className="stop-pct">{batteryPct}% (Current)</span>
            </div>
            <div className="scale-stop">
              <span className="stop-v">4.2 V</span>
              <span className="stop-pct">100% (Float)</span>
            </div>
          </div>

          {/* Energy Specs Summary */}
          <div className="battery-specs-grid">
            <div className="b-spec">
              <span className="spec-label">Cell Chemistry:</span>
              <span className="spec-val">Li-ion 18650 2S2P</span>
            </div>
            <div className="b-spec">
              <span className="spec-label">Nominal Capacity:</span>
              <span className="spec-val">6800 mAh / 25.1 Wh</span>
            </div>
            <div className="b-spec">
              <span className="spec-label">Autonomous Runtime:</span>
              <span className="spec-val">~14.7 hrs without sun</span>
            </div>
            <div className="b-spec">
              <span className="spec-label">Cycle Count:</span>
              <span className="spec-val">142 Cycles (Health: 98%)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Subsystem Power Consumption Breakdown */}
        <div className="glass-card power-budget-card">
          <h3 className="section-subtitle">
            <Cpu size={18} color="var(--accent-teal)" />
            Subsystem Power Consumption Breakdown (1.7 W Total)
          </h3>

          <div className="subsystem-bars-list">
            {/* 1. NodeMCU ESP8266 */}
            <div className="subsystem-item">
              <div className="subsystem-info-row">
                <span className="subsystem-name">NodeMCU ESP8266 (WiFi OFF, CPU Active 80MHz)</span>
                <span className="subsystem-watts">0.25 W (75 mA)</span>
              </div>
              <div className="subsystem-meter">
                <div className="subsystem-fill" style={{ width: '15%', background: '#00d2ff' }}></div>
              </div>
            </div>

            {/* 2. LoRa RA-02 Transceiver */}
            <div className="subsystem-item">
              <div className="subsystem-info-row">
                <span className="subsystem-name">LoRa RA-02 (SX1278 433MHz TX Bursts + RX Listen)</span>
                <span className="subsystem-watts">0.42 W (128 mA)</span>
              </div>
              <div className="subsystem-meter">
                <div className="subsystem-fill" style={{ width: '25%', background: '#34d399' }}></div>
              </div>
            </div>

            {/* 3. Sensor Array (DS18B20, DHT22, BMP280, MPU6050, GPS) */}
            <div className="subsystem-item">
              <div className="subsystem-info-row">
                <span className="subsystem-name">Sensor Array (DS18B20, DHT22, BMP280, MPU6050)</span>
                <span className="subsystem-watts">0.28 W (85 mA)</span>
              </div>
              <div className="subsystem-meter">
                <div className="subsystem-fill" style={{ width: '17%', background: '#fbbf24' }}></div>
              </div>
            </div>

            {/* 4. NEO-6M GPS Receiver */}
            <div className="subsystem-item">
              <div className="subsystem-info-row">
                <span className="subsystem-name">NEO-6M GPS Tracking Engine</span>
                <span className="subsystem-watts">0.45 W (136 mA)</span>
              </div>
              <div className="subsystem-meter">
                <div className="subsystem-fill" style={{ width: '27%', background: '#a855f7' }}></div>
              </div>
            </div>

            {/* 5. DC-DC Converter & Quiescent */}
            <div className="subsystem-item">
              <div className="subsystem-info-row">
                <span className="subsystem-name">Buck Regulator &amp; Standby Quiescent</span>
                <span className="subsystem-watts">0.30 W (91 mA)</span>
              </div>
              <div className="subsystem-meter">
                <div className="subsystem-fill" style={{ width: '16%', background: '#64748b' }}></div>
              </div>
            </div>
          </div>

          {/* Subsystem Health Check Status Matrix */}
          <div className="hardware-health-box">
            <h4 style={{ fontSize: '0.85rem', color: '#ffffff', marginBottom: '10px' }}>Subsystem Health Matrix</h4>
            <div className="health-tags-grid">
              <div className="health-tag" title={`NodeMCU ESP8266: ${nodeMcuMessage}`}>
                <span className={`h-dot ${isHardwareConnected ? 'online' : 'standby'}`}></span>
                <span>NodeMCU: <strong>{nodeMcuStatus}</strong></span>
              </div>
              <div className="health-tag" title={`LoRa RA-02: ${loraMessage}`}>
                <span className={`h-dot ${isHardwareConnected ? 'online' : 'standby'}`}></span>
                <span>LoRa RA-02: <strong>{loraStatus}</strong></span>
              </div>
              <div className="health-tag" title={`Sensor System: ${sensorSystemMessage}`}>
                <span className={`h-dot ${isHardwareConnected ? 'online' : 'simulated'}`}></span>
                <span>Sensor System: <strong>{sensorSystemStatus}</strong></span>
              </div>
              <div className="health-tag">
                <span className="h-dot normal"></span>
                <span>Deep Sleep: <strong>Inactive</strong></span>
              </div>
              <div className="health-tag">
                <span className="h-dot online"></span>
                <span>Solar MPPT: <strong>Active (4.8W)</strong></span>
              </div>
              <div className="health-tag">
                <span className="h-dot normal"></span>
                <span>Platform State: <strong>{platformState}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Update Notice */}
      <div className="power-footer-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={14} color="var(--text-dim)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Power telemetry sampled continuously by NodeMCU ESP8266 ADC via resistor divider.
          </span>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--accent-teal)' }}>
          Last updated: {telemetry?.displayTime || 'Just now'}
        </span>
      </div>
    </div>
  );
}
