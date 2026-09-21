import React, { useState, useEffect, useMemo } from 'react';
import AnalyticsChart from '../components/AnalyticsChart';
import { getHistoricalTelemetry } from '../services/api';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  SlidersHorizontal,
  Download
} from 'lucide-react';

const PARAMETERS = {
  temperature: {
    key: 'temperature',
    label: 'Water Temperature',
    unit: '°C',
    stroke: '#f97316'
  },
  salinity: {
    key: 'salinity',
    label: 'Salinity',
    unit: 'PSU',
    stroke: '#10e7b2'
  },
  pressure: {
    key: 'pressure',
    label: 'Hydrostatic Pressure',
    unit: 'dbar',
    stroke: '#818cf8'
  },
  depth: {
    key: 'depth',
    label: 'Subsurface Depth',
    unit: 'm',
    stroke: '#38bdf8'
  },
  humidity: {
    key: 'humidity',
    label: 'Atmospheric Humidity',
    unit: '% RH',
    stroke: '#34d399'
  }
};

export default function AnalyticsView() {
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedParam, setSelectedParam] = useState('temperature');
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

  // Calculate stats for current parameter
  const stats = useMemo(() => {
    if (!data || data.length === 0) return { min: 0, max: 0, avg: 0 };
    const values = data.map((d) => d[selectedParam]).filter((v) => typeof v === 'number');
    if (values.length === 0) return { min: 0, max: 0, avg: 0 };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

    return {
      min: +min.toFixed(2),
      max: +max.toFixed(2),
      avg: +avg.toFixed(2)
    };
  }, [data, selectedParam]);

  const activeParamObj = PARAMETERS[selectedParam];

  return (
    <div className="analytics-view">
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
              Last 1 hour
            </button>
            <button 
              className={`time-filter-btn ${timeRange === '24h' ? 'active' : ''}`}
              onClick={() => setTimeRange('24h')}
            >
              Last 24 hours
            </button>
            <button 
              className={`time-filter-btn ${timeRange === '7d' ? 'active' : ''}`}
              onClick={() => setTimeRange('7d')}
            >
              Last 7 days
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
              Filter
            </button>
          </div>
        )}
      </div>

      {/* Parameter Selector Tabs */}
      <div className="parameter-tabs" style={{ marginBottom: '20px' }}>
        {Object.values(PARAMETERS).map((param) => {
          const isActive = selectedParam === param.key;
          return (
            <button
              key={param.key}
              className={`param-tab ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedParam(param.key)}
            >
              {param.label} ({param.unit})
            </button>
          );
        })}
      </div>

      {/* Dynamic Statistics Cards: Min, Max, Average */}
      <div className="analytics-stats-row">
        <div className="stat-metric-card">
          <div className="stat-metric-info">
            <span className="stat-metric-title">Minimum Reading</span>
            <span className="stat-metric-num">{stats.min} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>{activeParamObj.unit}</span></span>
          </div>
          <span className="stat-metric-badge min">MIN</span>
        </div>

        <div className="stat-metric-card">
          <div className="stat-metric-info">
            <span className="stat-metric-title">Average Value</span>
            <span className="stat-metric-num">{stats.avg} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>{activeParamObj.unit}</span></span>
          </div>
          <span className="stat-metric-badge avg">AVG</span>
        </div>

        <div className="stat-metric-card">
          <div className="stat-metric-info">
            <span className="stat-metric-title">Maximum Reading</span>
            <span className="stat-metric-num">{stats.max} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>{activeParamObj.unit}</span></span>
          </div>
          <span className="stat-metric-badge max">MAX</span>
        </div>
      </div>

      {/* Recharts Line Chart Box */}
      <div className="chart-box">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">
              {activeParamObj.label} Time Series
            </h3>
            <span className="chart-subtitle">
              Displaying {data.length} sample points for {timeRange === 'custom' ? 'custom duration' : timeRange}
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

      {/* Statistical Summary Across All 5 Parameters */}
      <div className="glass-card" style={{ marginTop: '24px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff', marginBottom: '14px' }}>
          Parameter Summary Matrix ({timeRange})
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 14px' }}>Parameter</th>
                <th style={{ padding: '10px 14px' }}>Unit</th>
                <th style={{ padding: '10px 14px' }}>Observed Min</th>
                <th style={{ padding: '10px 14px' }}>Mean / Avg</th>
                <th style={{ padding: '10px 14px' }}>Observed Max</th>
                <th style={{ padding: '10px 14px' }}>Variance Span</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(PARAMETERS).map((param) => {
                const vals = data.map((d) => d[param.key]).filter((v) => typeof v === 'number');
                const pMin = vals.length ? Math.min(...vals).toFixed(2) : '--';
                const pMax = vals.length ? Math.max(...vals).toFixed(2) : '--';
                const pAvg = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : '--';
                const span = vals.length ? (Math.max(...vals) - Math.min(...vals)).toFixed(2) : '--';

                return (
                  <tr key={param.key} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '10px 14px', color: '#ffffff', fontWeight: 500 }}>{param.label}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{param.unit}</td>
                    <td style={{ padding: '10px 14px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{pMin}</td>
                    <td style={{ padding: '10px 14px', color: '#34d399', fontFamily: 'var(--font-mono)' }}>{pAvg}</td>
                    <td style={{ padding: '10px 14px', color: '#fb923c', fontFamily: 'var(--font-mono)' }}>{pMax}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>&plusmn; {span}</td>
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
