import React, { useState, useEffect, useMemo } from 'react';
import AnalyticsChart from '../components/AnalyticsChart';
import { getHistoricalTelemetry } from '../services/api';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  SlidersHorizontal,
  Download,
  Info,
  Activity,
  Layers
} from 'lucide-react';

const PARAMETERS = {
  waterTemperature: {
    key: 'waterTemperature',
    label: 'Water Temperature',
    source: 'DS18B20',
    unit: '°C',
    stroke: '#00d2ff',
    description: 'Subsurface water temperature monitored by waterproof DS18B20 probe.'
  },
  airTemperature: {
    key: 'airTemperature',
    label: 'Air Temperature',
    source: 'DHT22',
    unit: '°C',
    stroke: '#f97316',
    description: 'Ambient air temperature measured by DHT22 digital sensor.'
  },
  humidity: {
    key: 'humidity',
    label: 'Relative Humidity',
    source: 'DHT22',
    unit: '%',
    stroke: '#34d399',
    description: 'Marine boundary atmospheric humidity measured by DHT22.'
  },
  atmosphericPressure: {
    key: 'atmosphericPressure',
    label: 'Atmospheric Pressure',
    source: 'BMP280',
    unit: 'hPa',
    stroke: '#818cf8',
    description: 'Barometric pressure measured by BMP280 precision barometer.'
  },
  depth: {
    key: 'depth',
    label: 'Ocean Depth',
    source: 'Simulated / Future Sensor',
    unit: 'm',
    stroke: '#38bdf8',
    description: 'Subsurface depth marked as Simulated / Future Depth Sensor Data.'
  },
  roll: {
    key: 'roll',
    label: 'Platform Roll',
    source: 'MPU6050',
    unit: '°',
    stroke: '#e879f9',
    description: 'Transverse wave-induced roll angle measured by MPU6050 6-DOF IMU.'
  },
  pitch: {
    key: 'pitch',
    label: 'Platform Pitch',
    source: 'MPU6050',
    unit: '°',
    stroke: '#fbbf24',
    description: 'Longitudinal wave-induced pitch angle measured by MPU6050 6-DOF IMU.'
  }
};

export default function AnalyticsView() {
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedParam, setSelectedParam] = useState('waterTemperature');
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Custom date range state
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [customStart, setCustomStart] = useState(yesterday.toISOString().slice(0, 16));
  const [customEnd, setCustomEnd] = useState(now.toISOString().slice(0, 16));

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const hist = await getHistoricalTelemetry(
          timeRange, 
          timeRange === 'custom' ? customStart : null, 
          timeRange === 'custom' ? customEnd : null
        );
        setData(hist);
      } catch (err) {
        console.error("Failed to load historical analytics:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [timeRange]);

  const handleApplyCustomRange = async () => {
    if (timeRange !== 'custom') {
      setTimeRange('custom');
    }
    setIsLoading(true);
    try {
      const hist = await getHistoricalTelemetry('custom', customStart, customEnd);
      setData(hist);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate summary metrics: Min, Max, Avg, and Current Value
  const stats = useMemo(() => {
    if (!data || data.length === 0) return { min: 0, max: 0, avg: 0, current: 0 };
    const values = data.map((d) => d[selectedParam]).filter((v) => typeof v === 'number');
    if (values.length === 0) return { min: 0, max: 0, avg: 0, current: 0 };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const current = values[values.length - 1];

    return {
      min: +min.toFixed(2),
      max: +max.toFixed(2),
      avg: +avg.toFixed(2),
      current: +current.toFixed(2)
    };
  }, [data, selectedParam]);

  const activeParamObj = PARAMETERS[selectedParam] || PARAMETERS.waterTemperature;

  return (
    <div className="analytics-view">
      {/* Simulation Banner */}
      <div className="simulation-notice-banner" style={{ marginBottom: '18px' }}>
        <div className="notice-icon">
          <Info size={18} color="var(--accent-cyan)" />
        </div>
        <div className="notice-content">
          <strong>SIMULATED TIME SERIES DATA:</strong> Visualizing historical oceanographic cycles (diurnal atmospheric flux, tidal oscillations, and wave attitude variations).
        </div>
      </div>

      {/* Time Filters & Custom Controls */}
      <div className="analytics-header-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Time Window:
          </span>
          <div className="time-filter-group">
            <button 
              className={`time-filter-btn ${timeRange === '1h' ? 'active' : ''}`}
              onClick={() => setTimeRange('1h')}
            >
              Last 1 Hour
            </button>
            <button 
              className={`time-filter-btn ${timeRange === '24h' ? 'active' : ''}`}
              onClick={() => setTimeRange('24h')}
            >
              Last 24 Hours
            </button>
            <button 
              className={`time-filter-btn ${timeRange === '7d' ? 'active' : ''}`}
              onClick={() => setTimeRange('7d')}
            >
              Last 7 Days
            </button>
            <button 
              className={`time-filter-btn ${timeRange === 'custom' ? 'active' : ''}`}
              onClick={() => setTimeRange('custom')}
            >
              Custom Range
            </button>
          </div>
        </div>

        {timeRange === 'custom' && (
          <div className="custom-date-inputs">
            <input 
              type="datetime-local" 
              className="custom-input"
              value={customStart} 
              onChange={(e) => setCustomStart(e.target.value)} 
            />
            <span>to</span>
            <input 
              type="datetime-local" 
              className="custom-input"
              value={customEnd} 
              onChange={(e) => setCustomEnd(e.target.value)} 
            />
            <button 
              className="refresh-button"
              onClick={handleApplyCustomRange}
              style={{ background: 'var(--accent-blue)', color: '#ffffff', borderColor: 'transparent' }}
            >
              Apply Filter
            </button>
          </div>
        )}
      </div>

      {/* 7 Parameter Selector Tabs */}
      <div className="parameter-tabs">
        {Object.values(PARAMETERS).map((param) => {
          const isActive = selectedParam === param.key;
          return (
            <button
              key={param.key}
              className={`param-tab ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedParam(param.key)}
            >
              <span className="param-tab-label">{param.label}</span>
              <span className="param-tab-source">[{param.source}]</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Summary Cards: Current, Minimum, Maximum, Average */}
      <div className="analytics-stats-row">
        <div className="stat-metric-card">
          <div className="stat-metric-info">
            <span className="stat-metric-title">Current Value</span>
            <span className="stat-metric-num" style={{ color: activeParamObj.stroke }}>
              {stats.current} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>{activeParamObj.unit}</span>
            </span>
          </div>
          <span className="stat-metric-badge current">LIVE</span>
        </div>

        <div className="stat-metric-card">
          <div className="stat-metric-info">
            <span className="stat-metric-title">Minimum Reading</span>
            <span className="stat-metric-num" style={{ color: '#38bdf8' }}>
              {stats.min} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>{activeParamObj.unit}</span>
            </span>
          </div>
          <span className="stat-metric-badge min">MIN</span>
        </div>

        <div className="stat-metric-card">
          <div className="stat-metric-info">
            <span className="stat-metric-title">Average Value</span>
            <span className="stat-metric-num" style={{ color: '#34d399' }}>
              {stats.avg} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>{activeParamObj.unit}</span>
            </span>
          </div>
          <span className="stat-metric-badge avg">AVG</span>
        </div>

        <div className="stat-metric-card">
          <div className="stat-metric-info">
            <span className="stat-metric-title">Maximum Reading</span>
            <span className="stat-metric-num" style={{ color: '#fb923c' }}>
              {stats.max} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>{activeParamObj.unit}</span>
            </span>
          </div>
          <span className="stat-metric-badge max">MAX</span>
        </div>
      </div>

      {/* Recharts Line Chart Box */}
      <div className="chart-box">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">
              {activeParamObj.label} Time Series ({activeParamObj.unit})
            </h3>
            <span className="chart-subtitle">
              Hardware Source: <strong>{activeParamObj.source}</strong> &bull; Displaying {data.length} sample points for {timeRange === 'custom' ? 'custom duration' : timeRange}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Processing oceanographic timeseries data...
          </div>
        ) : (
          <AnalyticsChart 
            data={data}
            parameterKey={selectedParam}
            parameterLabel={activeParamObj.label}
            unit={activeParamObj.unit}
            strokeColor={activeParamObj.stroke}
          />
        )}
      </div>

      {/* Summary Matrix Across All 7 Parameters */}
      <div className="glass-card" style={{ marginTop: '24px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={16} color="var(--accent-cyan)" />
          All 7 Parameters Summary Matrix ({timeRange})
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 14px' }}>Parameter</th>
                <th style={{ padding: '10px 14px' }}>Hardware Source</th>
                <th style={{ padding: '10px 14px' }}>Unit</th>
                <th style={{ padding: '10px 14px' }}>Current</th>
                <th style={{ padding: '10px 14px' }}>Minimum</th>
                <th style={{ padding: '10px 14px' }}>Average</th>
                <th style={{ padding: '10px 14px' }}>Maximum</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(PARAMETERS).map((param) => {
                const vals = data.map((d) => d[param.key]).filter((v) => typeof v === 'number');
                const pMin = vals.length ? Math.min(...vals).toFixed(2) : '--';
                const pMax = vals.length ? Math.max(...vals).toFixed(2) : '--';
                const pAvg = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : '--';
                const pCur = vals.length ? vals[vals.length - 1].toFixed(2) : '--';

                return (
                  <tr key={param.key} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '10px 14px', color: '#ffffff', fontWeight: 500 }}>{param.label}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--accent-teal)' }}>{param.source}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{param.unit}</td>
                    <td style={{ padding: '10px 14px', color: '#f8fafc', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{pCur}</td>
                    <td style={{ padding: '10px 14px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{pMin}</td>
                    <td style={{ padding: '10px 14px', color: '#34d399', fontFamily: 'var(--font-mono)' }}>{pAvg}</td>
                    <td style={{ padding: '10px 14px', color: '#fb923c', fontFamily: 'var(--font-mono)' }}>{pMax}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
