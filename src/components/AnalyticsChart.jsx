import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

export default function AnalyticsChart({ 
  data = [], 
  parameterKey = 'temperature', 
  parameterLabel = 'Water Temperature', 
  unit = '°C',
  strokeColor = '#00d2ff'
}) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      return (
        <div className="custom-chart-tooltip">
          <div className="tooltip-time">{payload[0].payload.timeLabel || label}</div>
          <div className="tooltip-val-row">
            <span>{parameterLabel}:</span>
            <span style={{ color: strokeColor }}>{val} {unit}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Determine smart Y-axis bounds based on data
  const values = data.map((d) => d[parameterKey]).filter((v) => typeof v === 'number');
  const minVal = values.length ? Math.floor(Math.min(...values) * 0.98) : 0;
  const maxVal = values.length ? Math.ceil(Math.max(...values) * 1.02) : 100;

  return (
    <div style={{ width: '100%', height: 380 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
          <defs>
            <linearGradient id={`gradient-${parameterKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="rgba(70, 120, 200, 0.15)" 
            vertical={false} 
          />
          
          <XAxis 
            dataKey="timeLabel" 
            stroke="#64748b" 
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            tickLine={{ stroke: '#64748b' }}
            dy={10}
            minTickGap={30}
          />
          
          <YAxis 
            stroke="#64748b" 
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            tickLine={{ stroke: '#64748b' }}
            domain={[minVal, maxVal]}
            unit={` ${unit}`}
            dx={-4}
          />
          
          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey={parameterKey}
            stroke={strokeColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 6, fill: strokeColor, stroke: '#ffffff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
