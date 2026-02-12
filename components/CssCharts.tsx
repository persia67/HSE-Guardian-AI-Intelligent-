
import React from 'react';
import { theme } from '../theme';

interface GaugeChartProps {
  value: number; // 0-100
  label: string;
  color?: string;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({ value, label, color = theme.colors.primary }) => {
  const rotation = (value / 100) * 180; // 180 degree semi-circle
  
  return (
    <div style={{ position: 'relative', width: '100px', height: '50px', overflow: 'hidden', margin: '0 auto' }}>
      {/* Background Arc */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100px', height: '100px',
        borderRadius: '50%',
        border: `10px solid ${theme.colors.panel}`,
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent',
        transform: 'rotate(135deg)',
        boxSizing: 'border-box'
      }} />
      
      {/* Foreground Arc */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100px', height: '100px',
        borderRadius: '50%',
        border: `10px solid ${color}`,
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent',
        transform: `rotate(${135 + rotation}deg)`, // Start at 135, add value
        transition: 'transform 1s ease-out',
        boxSizing: 'border-box',
        clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' // Clip the bottom half properly
      }} />
      
      {/* Value Text */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, width: '100%',
        textAlign: 'center', lineHeight: '1',
        display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{Math.round(value)}</span>
        <span style={{ fontSize: '10px', color: theme.colors.textMuted, textTransform: 'uppercase' }}>{label}</span>
      </div>
    </div>
  );
};

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
}

export const BarChart: React.FC<BarChartProps> = ({ data, maxValue }) => {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {data.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <div style={{ width: '60px', textAlign: 'right', color: theme.colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </div>
          <div style={{ flex: 1, backgroundColor: theme.colors.panel, height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(item.value / max) * 100}%`,
              backgroundColor: item.color || theme.colors.primary,
              borderRadius: '4px',
              transition: 'width 0.5s ease-out'
            }} className="animate-grow" />
          </div>
          <div style={{ width: '24px', textAlign: 'left', fontWeight: 'bold' }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
};
