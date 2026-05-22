import React from 'react';

export default function StatCard({ label, value, change, trend, suffix = '', icon }) {
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';
  const hasChange = change !== undefined && change !== null;

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: '#181C27', border: '1px solid #252B3B' }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium" style={{ color: '#8B92A5' }}>
          {label}
        </p>
        {icon && (
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: '#1E2436' }}
          >
            {icon}
          </div>
        )}
      </div>

      <p className="text-2xl font-bold mb-2" style={{ color: '#F1F3F9' }}>
        {value}
        {suffix && <span className="text-base font-medium ml-0.5" style={{ color: '#8B92A5' }}>{suffix}</span>}
      </p>

      {hasChange && (
        <div className="flex items-center gap-1">
          {isPositive && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          )}
          {isNegative && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
          <span
            className="text-xs font-medium"
            style={{
              color: isPositive ? '#22C55E' : isNegative ? '#EF4444' : '#8B92A5',
            }}
          >
            {change > 0 ? '+' : ''}{change}% vs last month
          </span>
        </div>
      )}
    </div>
  );
}
