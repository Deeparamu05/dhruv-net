import React, { useState } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  FileCode, 
  Calendar, 
  CheckSquare, 
  Square, 
  CheckCircle2, 
  Info,
  Clock,
  Layers,
  Database,
  Cpu
} from 'lucide-react';
import { generateExportDataset } from '../services/api';

const AVAILABLE_PARAMETERS = [
  { id: 'waterTemperature', label: 'Water Temperature (DS18B20, °C)', defaultChecked: true },
  { id: 'airTemperature', label: 'Air Temperature (DHT22, °C)', defaultChecked: true },
  { id: 'humidity', label: 'Relative Humidity (DHT22, %)', defaultChecked: true },
  { id: 'atmosphericPressure', label: 'Atmospheric Pressure (BMP280, hPa)', defaultChecked: true },
  { id: 'depth', label: 'Ocean Depth (Simulated / Future Sensor, m)', defaultChecked: true },
  { id: 'roll', label: 'Platform Roll (MPU6050, °)', defaultChecked: true },
  { id: 'pitch', label: 'Platform Pitch (MPU6050, °)', defaultChecked: true },
  { id: 'gps', label: 'GPS Latitude & Longitude (NEO-6M)', defaultChecked: true },
  { id: 'battery', label: 'Battery Percentage (%)', defaultChecked: true },
  { id: 'batteryVoltage', label: 'Battery Voltage (V)', defaultChecked: true },
  { id: 'loraStatus', label: 'LoRa RA-02 Status & RSSI', defaultChecked: true },
  { id: 'nodeMcuStatus', label: 'NodeMCU ESP8266 Online Status', defaultChecked: true }
];

export default function DataExportView() {
  const [selectedPlatform, setSelectedPlatform] = useState('DHRUV-01');
  const [dateRange, setDateRange] = useState('24h'); // 1h, 24h, 7d, 30d, custom
  const [customStart, setCustomStart] = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 16));
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 16));

  const [selectedParams, setSelectedParams] = useState(
    AVAILABLE_PARAMETERS.reduce((acc, p) => ({ ...acc, [p.id]: p.defaultChecked }), {})
  );

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);

  const toggleParam = (id) => {
    setSelectedParams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAll = (select) => {
    const updated = {};
    AVAILABLE_PARAMETERS.forEach((p) => {
      updated[p.id] = select;
    });
    setSelectedParams(updated);
  };

  // Generate and download client-side file
  const handleExport = async (format) => {
    setIsExporting(true);
    setExportSuccess(null);

    try {
      const activeIds = Object.keys(selectedParams).filter((k) => selectedParams[k]);
      const dataset = await generateExportDataset({
        platformId: selectedPlatform,
        selectedParams: activeIds,
        range: dateRange
      });

      const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      let fileName = `dhruv-net_${selectedPlatform}_${format.toLowerCase()}_${timestampStr}.${format.toLowerCase()}`;
      let mimeType = 'text/csv;charset=utf-8;';
      let content = '';

      if (format === 'CSV') {
        // Build CSV header matching required fields
        const headers = [
          'Timestamp',
          'Platform ID',
          'GPS Latitude',
          'GPS Longitude',
          'Water Temperature (°C)',
          'Air Temperature (°C)',
          'Humidity (%)',
          'Atmospheric Pressure (hPa)',
          'Depth (m)',
          'Roll (°)',
          'Pitch (°)',
          'Battery (%)',
          'Battery Voltage (V)',
          'LoRa Status',
          'NodeMCU Status'
        ];

        const rows = dataset.map((d) => [
          `"${d.timestamp}"`,
          `"${d.platformId}"`,
          d.gpsLatitude.toFixed(5),
          d.gpsLongitude.toFixed(5),
          d.waterTemperature,
          d.airTemperature,
          d.humidity,
          d.atmosphericPressure,
          d.depth,
          d.roll,
          d.pitch,
          d.battery,
          d.batteryVoltage,
          `"${d.loraStatus}"`,
          `"${d.nodeMcuStatus}"`
        ]);

        content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      } else {
        // JSON format
        mimeType = 'application/json;charset=utf-8;';
        content = JSON.stringify(dataset, null, 2);
      }

      // Trigger browser download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess({
        fileName,
        format,
        recordsCount: dataset.length,
        timestamp: new Date().toLocaleTimeString(),
        fileSizeKb: +(blob.size / 1024).toFixed(1)
      });
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="data-export-view">
      {/* Simulation Notice Banner */}
      <div className="simulation-notice-banner" style={{ marginBottom: '18px' }}>
        <div className="notice-icon">
          <Info size={18} color="var(--accent-cyan)" />
        </div>
        <div className="notice-content">
          <strong>DATA EXPORT FACILITY:</strong> Generates real standard CSV &amp; JSON telemetry archives formatted for oceanographic scientific tools (MATLAB, Python pandas, Ocean Data View).
        </div>
      </div>

      {/* Top Header */}
      <div className="export-header-row">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={20} color="var(--accent-cyan)" />
            Oceanographic Telemetry Data Export
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Select observation platform, target sensor parameters, and time interval for download
          </p>
        </div>
      </div>

      {/* Success Banner if exported */}
      {exportSuccess && (
        <div className="export-success-card glass-card">
          <div className="success-icon-wrap">
            <CheckCircle2 size={24} color="#34d399" />
          </div>
          <div className="success-content">
            <h4>Dataset Export Completed Successfully!</h4>
            <p>
              Generated <strong>{exportSuccess.fileName}</strong> containing <strong>{exportSuccess.recordsCount}</strong> calibrated records ({exportSuccess.fileSizeKb} KB) at {exportSuccess.timestamp}.
            </p>
          </div>
        </div>
      )}

      {/* Main Export Configuration Deck */}
      <div className="export-config-grid">
        {/* Step 1: Platform & Date Range Card */}
        <div className="glass-card config-card">
          <h3 className="section-subtitle">
            <Cpu size={18} color="var(--accent-cyan)" />
            1. Select Platform &amp; Time Window
          </h3>

          <div className="form-group">
            <label className="form-label">Observation Platform:</label>
            <select 
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="export-select"
            >
              <option value="DHRUV-01">DHRUV-01 &mdash; Coromandel Coast Platform (NodeMCU ESP8266)</option>
              <option value="DHRUV-02" disabled>DHRUV-02 &mdash; Deep Arabian Sea (Scheduled Q1)</option>
            </select>
            <span className="form-helper">Platform architecture: NodeMCU ESP8266 + LoRa RA-02</span>
          </div>

          <div className="form-group" style={{ marginTop: '18px' }}>
            <label className="form-label">Date &amp; Time Range:</label>
            <div className="range-pills-row">
              <button 
                className={`range-pill ${dateRange === '1h' ? 'active' : ''}`}
                onClick={() => setDateRange('1h')}
              >
                Last 1 Hour
              </button>
              <button 
                className={`range-pill ${dateRange === '24h' ? 'active' : ''}`}
                onClick={() => setDateRange('24h')}
              >
                Last 24 Hours
              </button>
              <button 
                className={`range-pill ${dateRange === '7d' ? 'active' : ''}`}
                onClick={() => setDateRange('7d')}
              >
                Last 7 Days
              </button>
              <button 
                className={`range-pill ${dateRange === '30d' ? 'active' : ''}`}
                onClick={() => setDateRange('30d')}
              >
                Last 30 Days
              </button>
              <button 
                className={`range-pill ${dateRange === 'custom' ? 'active' : ''}`}
                onClick={() => setDateRange('custom')}
              >
                Custom Range
              </button>
            </div>
          </div>

          {dateRange === 'custom' && (
            <div className="custom-range-box">
              <div className="range-input-item">
                <span className="input-sub">Start Timestamp:</span>
                <input 
                  type="datetime-local" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="custom-input"
                />
              </div>
              <div className="range-input-item">
                <span className="input-sub">End Timestamp:</span>
                <input 
                  type="datetime-local" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="custom-input"
                />
              </div>
            </div>
          )}

          {/* Download Action Buttons */}
          <div className="export-actions-row">
            <button 
              className="btn-download csv"
              onClick={() => handleExport('CSV')}
              disabled={isExporting}
            >
              <FileSpreadsheet size={16} />
              <span>{isExporting ? 'Generating...' : 'Download CSV'}</span>
            </button>

            <button 
              className="btn-download json"
              onClick={() => handleExport('JSON')}
              disabled={isExporting}
            >
              <FileCode size={16} />
              <span>{isExporting ? 'Generating...' : 'Download JSON'}</span>
            </button>
          </div>
        </div>

        {/* Step 2: Sensor Parameters Checklist */}
        <div className="glass-card config-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 className="section-subtitle" style={{ margin: 0 }}>
              <Layers size={18} color="var(--accent-teal)" />
              2. Sensor Parameters to Include
            </h3>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="select-helper-btn"
                onClick={() => handleSelectAll(true)}
              >
                Select All
              </button>
              <button 
                className="select-helper-btn"
                onClick={() => handleSelectAll(false)}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="params-checklist">
            {AVAILABLE_PARAMETERS.map((p) => {
              const isChecked = !!selectedParams[p.id];
              return (
                <div 
                  key={p.id}
                  className={`param-check-item ${isChecked ? 'checked' : ''}`}
                  onClick={() => toggleParam(p.id)}
                >
                  {isChecked ? (
                    <CheckSquare size={16} color="var(--accent-cyan)" />
                  ) : (
                    <Square size={16} color="var(--text-dim)" />
                  )}
                  <span className="param-check-label">{p.label}</span>
                </div>
              );
            })}
          </div>

          <div className="export-fields-preview-note">
            <strong>Export Schema Fields:</strong> Timestamp, Platform ID, GPS Latitude, GPS Longitude, Water Temperature, Air Temperature, Humidity, Atmospheric Pressure, Depth, Roll, Pitch, Battery, Battery Voltage, LoRa Status, NodeMCU Status.
          </div>
        </div>
      </div>
    </div>
  );
}
