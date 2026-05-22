import React from 'react';

const badgeConfig = {
  draft: { bg: '#252B3B', color: '#8B92A5', label: 'Draft' },
  scheduled: { bg: '#3D2E00', color: '#EAB308', label: 'Scheduled' },
  sending: { bg: '#1A2744', color: '#4F7FFF', label: 'Sending', pulse: true },
  sent: { bg: '#052E16', color: '#22C55E', label: 'Sent' },
  cancelled: { bg: '#2D0E0E', color: '#EF4444', label: 'Cancelled' },
  active: { bg: '#052E16', color: '#22C55E', label: 'Active' },
  unsubscribed: { bg: '#3D2E00', color: '#EAB308', label: 'Unsubscribed' },
  bounced: { bg: '#2D0E0E', color: '#EF4444', label: 'Bounced' },
  complained: { bg: '#2D0E0E', color: '#EF4444', label: 'Complained' },
  paused: { bg: '#252B3B', color: '#8B92A5', label: 'Paused' },
  inactive: { bg: '#252B3B', color: '#8B92A5', label: 'Inactive' },
};

export default function Badge({ status, customLabel }) {
  const config = badgeConfig[status] || badgeConfig.draft;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ background: config.bg, color: config.color }}
    >
      {config.pulse ? (
        <span className="relative flex w-2 h-2">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ background: config.color }}
          />
          <span
            className="relative inline-flex rounded-full w-2 h-2"
            style={{ background: config.color }}
          />
        </span>
      ) : (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: config.color }}
        />
      )}
      {customLabel || config.label}
    </span>
  );
}
