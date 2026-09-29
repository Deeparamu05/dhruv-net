import React from 'react';
import { 
  Thermometer, 
  Droplet, 
  Gauge, 
  ArrowDownCircle, 
  Wind,
  Compass,
  Cpu,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles
} from 'lucide-react';

/**
 * Circular Arc Visual Gauge for Bioluminescent Abyss Theme
 */
function BioCircularGauge({ value, min, max, color = '#00f2fe', unit = '' }) {
  const numVal = typeof value === 'number' ? value : parseFloat(value);
  const valid = !isNaN(numVal);
  const percentage = valid ? Math.min(Math.max((numVal - min) / (max - min), 0), 1) : 0;
  
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  // 240 degree sweep arc
  const sweepFraction = 0.75;
  const strokeDasharray = `${circumference * sweepFraction} ${circumference * (1 - sweepFraction)}`;
  const strokeDashoffset = (circumference * sweepFraction) * (1 - percentage);

  return (
    <div className="bio-gauge-wrap" title={`${valid ? Math.round(percentage * 100) : 0}% of range (${min}–${max}${unit})`}>
      <svg className="bio-gauge-svg" width="56" height="56" viewBox="0 0 60 60">
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
          <filter id={`glow-${color.replace('#', '')}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx="30"
          cy="30"
          r={radius}
          strokeWidth="4"
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          transform="rotate(135 30 30)"
        />

        {/* Luminous active arc */}
        {valid && (
          <circle
            cx="30"
            cy="30"
            r={radius}
            strokeWidth="4.5"
            fill="none"
            stroke={`url(#grad-${color.replace('#', '')})`}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(135 30 30)"
            filter={`url(#glow-${color.replace('#', '')})`}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        )}
      </svg>
      <div className="bio-gauge-inner-val">
        <span className="bio-gauge-percent">{valid ? `${Math.round(percentage * 100)}%` : '--'}</span>
      </div>
    </div>
  );
}

export default function SensorCard({ 
  id, 
  label, 
  value, 
  unit = '', 
  source = '', 
  status = 'Normal', 
  trend = 'steady', 
  timestamp,
  isOrientation = false,
  orientationData = null,
  isSimulated = false
}) {
  const iconMap = {
    waterTemperature: Thermometer,
    airTemperature: Thermometer,
    humidity: Droplet,
    pressure: Gauge,
    depth: ArrowDownCircle,
    orientation: Compass,
    lora: Wind
  };

  // Color configurations for the Bioluminescent Abyss palette
  const sensorTheme = {
    waterTemperature: {
      color: '#00f2fe',
      glow: 'rgba(0, 242, 254, 0.4)',
      bgLight: 'rgba(0, 242, 254, 0.07)',
      min: 15,
      max: 40
    },
    airTemperature: {
      color: '#c084fc',
      glow: 'rgba(192, 132, 252, 0.4)',
      bgLight: 'rgba(192, 132, 252, 0.07)',
      min: 15,
      max: 45
    },
    humidity: {
      color: '#10e7b2',
      glow: 'rgba(16, 231, 178, 0.4)',
      bgLight: 'rgba(16, 231, 178, 0.07)',
      min: 0,
      max: 100
    },
    pressure: {
      color: '#818cf8',
      glow: 'rgba(129, 140, 248, 0.4)',
      bgLight: 'rgba(129, 140, 248, 0.07)',
      min: 960,
      max: 1040
    },
    depth: {
      color: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.4)',
      bgLight: 'rgba(56, 189, 248, 0.07)',
      min: 0,
      max: 100
    },
    orientation: {
      color: '#f472b6',
      glow: 'rgba(244, 114, 182, 0.4)',
      bgLight: 'rgba(244, 114, 182, 0.07)',
      min: -90,
      max: 90
    }
  };

  const theme = sensorTheme[id] || {
    color: '#00f2fe',
    glow: 'rgba(0, 242, 254, 0.4)',
    bgLight: 'rgba(0, 242, 254, 0.07)',
    min: 0,
    max: 100
  };

  const Icon = iconMap[id] || Gauge;

  const renderTrend = () => {
    if (trend === 'up') {
      return (
        <span className="sensor-trend up">
          <TrendingUp size={12} />
          <span>Rising</span>
        </span>
      );
    }
    if (trend === 'down') {
      return (
        <span className="sensor-trend down">
          <TrendingDown size={12} />
          <span>Falling</span>
        </span>
      );
    }
    return (
      <span className="sensor-trend steady">
        <Minus size={12} />
        <span>Steady</span>
      </span>
    );
  };

  return (
    <div 
      className={`sensor-card ${id} ${isSimulated ? 'simulated-card' : ''}`}
      style={{
        '--card-accent-color': theme.color,
        '--card-accent-glow': theme.glow,
        '--card-bg-light': theme.bgLight
      }}
    >
      {/* Bioluminescent Top Edge Beam */}
      <div className="bio-card-glow-beam" />

      {/* Top row: Name, Icon, Status */}
      <div className="sensor-header">
        <div className="sensor-label-group">
          <div 
            className="sensor-icon-box"
            style={{ 
              borderColor: theme.glow,
              boxShadow: `0 0 12px ${theme.glow}`,
              color: theme.color,
              background: theme.bgLight
            }}
          >
            <Icon size={17} />
          </div>
          <div>
            <span className="sensor-name">{label}</span>
            {isSimulated && (
              <span className="simulated-pill-tag">
                {id === 'depth' ? 'SIMULATED / FUTURE SENSOR' : 'SIMULATED DATA'}
              </span>
            )}
          </div>
        </div>

        <span className={`sensor-badge ${status.toLowerCase()}`}>
          <span className={`badge-pulse-dot ${status.toLowerCase()}`} />
          {status}
        </span>
      </div>

      {/* Main Value Row + Luminous Circular HUD Gauge */}
      {isOrientation && orientationData ? (
        <div className="sensor-orientation-container">
          <div className="orientation-horizon-widget">
            <div 
              className="attitude-crosshair" 
              style={{
                transform: `rotate(${orientationData.roll || 0}deg) translateY(${Math.min(Math.max((orientationData.pitch || 0) * 0.8, -15), 15)}px)`
              }}
            />
            <div className="attitude-center-pip" />
          </div>

          <div className="sensor-orientation-grid">
            <div className="orientation-axis">
              <span className="axis-label">Roll</span>
              <span className="axis-value">{orientationData.roll ?? '--'}°</span>
            </div>
            <div className="orientation-axis">
              <span className="axis-label">Pitch</span>
              <span className="axis-value">{orientationData.pitch ?? '--'}°</span>
            </div>
            <div className="orientation-axis">
              <span className="axis-label">Yaw</span>
              <span className="axis-value">{orientationData.yaw ?? '--'}°</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="sensor-display-body">
          <div className="sensor-value-group">
            <div className="sensor-value-row">
              <span className="sensor-value">{value !== undefined && value !== null ? value : '--'}</span>
              <span className="sensor-unit">{unit}</span>
            </div>
            
            {/* Calibrated Range Scale Bar */}
            <div className="bio-scale-bar-track">
              <div 
                className="bio-scale-bar-fill"
                style={{
                  width: `${typeof value === 'number' ? Math.min(Math.max(((value - theme.min) / (theme.max - theme.min)) * 100, 0), 100) : 0}%`,
                  background: `linear-gradient(90deg, ${theme.color}40, ${theme.color})`,
                  boxShadow: `0 0 8px ${theme.glow}`
                }}
              />
            </div>
            <div className="bio-scale-limits">
              <span>{theme.min}{unit}</span>
              <span>{theme.max}{unit}</span>
            </div>
          </div>

          {/* Bioluminescent Circular Gauge */}
          <BioCircularGauge 
            value={value} 
            min={theme.min} 
            max={theme.max} 
            color={theme.color}
            unit={unit}
          />
        </div>
      )}

      {/* Hardware Source & Telemetry Source Indicator */}
      <div className="sensor-hardware-source">
        <Cpu size={13} style={{ color: theme.color }} />
        <span className="source-label">Source:</span>
        <span className="source-value">{source || 'NodeMCU ESP8266'}</span>
      </div>

      {/* Footer: Last updated & Trend */}
      <div className="sensor-footer">
        <div className="sensor-time-wrap">
          <Clock size={12} color="var(--text-dim)" />
          <span className="sensor-timestamp">
            {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
          </span>
        </div>
        {!isOrientation && renderTrend()}
      </div>
    </div>
  );
}
