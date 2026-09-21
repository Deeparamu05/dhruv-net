import React from 'react';
import { 
  Thermometer, 
  Droplet, 
  Gauge, 
  ArrowDownCircle, 
  CloudRain,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

export default function SensorCard({ 
  id, 
  label, 
  value, 
  unit, 
  status = 'Normal', 
  trend = 'steady', 
  timestamp 
}) {
  const iconMap = {
    temperature: Thermometer,
    salinity: Droplet,
    pressure: Gauge,
    depth: ArrowDownCircle,
    humidity: CloudRain
  };

  const Icon = iconMap[id] || Gauge;

  const renderTrend = () => {
    if (trend === 'up') {
      return (
        <span className="sensor-trend up">
          <TrendingUp size={13} />
          <span>Rising</span>
        </span>
      );
    }
    if (trend === 'down') {
      return (
        <span className="sensor-trend down">
          <TrendingDown size={13} />
          <span>Falling</span>
        </span>
      );
    }
    return (
      <span className="sensor-trend steady">
        <Minus size={13} />
        <span>Steady</span>
      </span>
    );
  };

  return (
    <div className={`sensor-card ${id}`}>
      <div className="sensor-header">
        <div className="sensor-label-group">
          <div className="sensor-icon-box">
            <Icon size={18} />
          </div>
          <span className="sensor-name">{label}</span>
        </div>
        <span className="sensor-badge">{status}</span>
      </div>

      <div className="sensor-value-row">
        <span className="sensor-value">{value !== undefined ? value : '--'}</span>
        <span className="sensor-unit">{unit}</span>
      </div>

      <div className="sensor-footer">
        <span className="sensor-timestamp">
          {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live'}
        </span>
        {renderTrend()}
      </div>
    </div>
  );
}
