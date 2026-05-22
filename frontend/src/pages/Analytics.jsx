import React, { useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import useAppStore from '../store/appStore';
import StatCard from '../components/ui/StatCard';

// ─── Mock data for charts when API data unavailable ───────────────────────────
function generateLast30Days() {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    data.push({
      date: label,
      sent: Math.floor(Math.random() * 800 + 200),
      opened: Math.floor(Math.random() * 400 + 80),
    });
  }
  return data;
}

const MOCK_LINE_DATA = generateLast30Days();

const MOCK_BAR_DATA = [
  { name: 'Summer Sale', clickRate: 8.4 },
  { name: 'Newsletter #12', clickRate: 5.2 },
  { name: 'Black Friday', clickRate: 12.1 },
  { name: 'Welcome Series', clickRate: 9.8 },
  { name: 'Win-Back Flow', clickRate: 4.3 },
];

const MOCK_CAMPAIGNS = [
  { _id: '1', name: 'Summer Sale 2025', sent: 12540, delivered: 12318, openRate: 0.342, clickRate: 0.084, bounceCount: 67 },
  { _id: '2', name: 'Monthly Newsletter #12', sent: 8920, delivered: 8801, openRate: 0.281, clickRate: 0.052, bounceCount: 34 },
  { _id: '3', name: 'Black Friday Preview', sent: 21000, delivered: 20580, openRate: 0.419, clickRate: 0.121, bounceCount: 94 },
  { _id: '4', name: 'Welcome Series - Email 1', sent: 3400, delivered: 3388, openRate: 0.612, clickRate: 0.098, bounceCount: 12 },
  { _id: '5', name: 'Win-Back Flow', sent: 2100, delivered: 2037, openRate: 0.198, clickRate: 0.043, bounceCount: 29 },
];

function pct(n, digits = 1) {
  if (n == null) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

function ReputationWidget({ bounceRate, complaintRate }) {
  const bounceStatus =
    bounceRate < 0.02 ? 'good' : bounceRate < 0.05 ? 'warning' : 'bad';
  const complaintStatus =
    complaintRate < 0.001 ? 'good' : complaintRate < 0.003 ? 'warning' : 'bad';

  const statusColor = {
    good: '#22C55E',
    warning: '#EAB308',
    bad: '#EF4444',
  };

  const statusBg = {
    good: '#052E16',
    warning: '#3D2E00',
    bad: '#2D0E0E',
  };

  const statusLabel = { good: 'Good', warning: 'Watch', bad: 'Action Required' };

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: '#181C27', border: '1px solid #252B3B' }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#F1F3F9' }}>
        Sender Reputation
      </h3>
      <div className="space-y-3">
        {[
          {
            label: 'Bounce Rate',
            value: pct(bounceRate),
            status: bounceStatus,
            threshold: 'Keep below 5%',
          },
          {
            label: 'Complaint Rate',
            value: pct(complaintRate, 3),
            status: complaintStatus,
            threshold: 'Keep below 0.3%',
          },
        ].map(({ label, value, status, threshold }) => (
          <div
            key={label}
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: statusBg[status], border: `1px solid ${statusColor[status]}22` }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: '#F1F3F9' }}>{label}</p>
              <p className="text-xs mt-0.5" style={{ color: '#8B92A5' }}>{threshold}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold" style={{ color: statusColor[status] }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: statusColor[status] }}>
                {statusLabel[status]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-4 py-3 text-sm shadow-xl"
      style={{ background: '#181C27', border: '1px solid #252B3B' }}
    >
      <p className="font-medium mb-2" style={{ color: '#F1F3F9' }}>{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: '#8B92A5' }}>{p.name}:</span>
          <span style={{ color: '#F1F3F9' }}>{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-4 py-3 text-sm shadow-xl"
      style={{ background: '#181C27', border: '1px solid #252B3B' }}
    >
      <p className="font-medium mb-1" style={{ color: '#F1F3F9' }}>{label}</p>
      <span style={{ color: '#4F7FFF' }}>{payload[0]?.value}% click rate</span>
    </div>
  );
};

export default function Analytics() {
  const { analytics, analyticsLoading, campaignAnalytics, fetchAnalytics } = useAppStore();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const overview = analytics || {
    totalSent: 48960,
    avgOpenRate: 0.318,
    avgClickRate: 0.072,
    bounceRate: 0.031,
    unsubscribeRate: 0.008,
    complaintRate: 0.0009,
  };

  const campaigns = campaignAnalytics.length > 0 ? campaignAnalytics : MOCK_CAMPAIGNS;

  const barData =
    campaigns.length > 0
      ? campaigns.slice(0, 5).map((c) => ({
          name: c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name,
          clickRate: parseFloat(((c.clickRate || 0) * 100).toFixed(1)),
        }))
      : MOCK_BAR_DATA;

  return (
    <div className="space-y-6">
      {/* Top stat cards */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard
          label="Total Emails Sent"
          value={overview.totalSent?.toLocaleString() || '—'}
          trend="up"
          change={12}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          }
        />
        <StatCard
          label="Avg Open Rate"
          value={pct(overview.avgOpenRate)}
          trend="up"
          change={3.2}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        />
        <StatCard
          label="Avg Click Rate"
          value={pct(overview.avgClickRate)}
          trend="down"
          change={-1.1}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1" />
            </svg>
          }
        />
        <StatCard
          label="Bounce Rate"
          value={pct(overview.bounceRate)}
          trend={overview.bounceRate < 0.02 ? 'up' : 'down'}
          change={-0.4}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
            </svg>
          }
        />
        <StatCard
          label="Unsubscribe Rate"
          value={pct(overview.unsubscribeRate)}
          trend="up"
          change={-0.2}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          }
        />
      </div>

      {/* MPP notice */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ background: '#3D2E00', border: '1px solid #EAB308' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0 mt-0.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p style={{ color: '#F1F3F9' }}>
          <span className="font-semibold" style={{ color: '#EAB308' }}>Note:</span> Open rates may be inflated due to email client prefetching (Apple Mail Privacy Protection / MPP). Click rates are a more reliable engagement signal.
        </p>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-5">
        {/* Line chart */}
        <div
          className="col-span-2 rounded-xl p-5"
          style={{ background: '#181C27', border: '1px solid #252B3B' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Emails Sent — Last 30 Days</h3>
            <div className="flex items-center gap-4 text-xs" style={{ color: '#8B92A5' }}>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-px inline-block" style={{ background: '#4F7FFF' }} />
                Sent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-px inline-block" style={{ background: '#22C55E' }} />
                Opened
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={MOCK_LINE_DATA} margin={{ top: 0, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#252B3B" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#8B92A5', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis
                tick={{ fill: '#8B92A5', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="sent"
                name="Sent"
                stroke="#4F7FFF"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#4F7FFF' }}
              />
              <Line
                type="monotone"
                dataKey="opened"
                name="Opened"
                stroke="#22C55E"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#22C55E' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Reputation widget */}
        <ReputationWidget
          bounceRate={overview.bounceRate || 0.031}
          complaintRate={overview.complaintRate || 0.0009}
        />
      </div>

      {/* Bar chart + table */}
      <div className="grid grid-cols-3 gap-5">
        {/* Bar chart */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#181C27', border: '1px solid #252B3B' }}
        >
          <h3 className="text-sm font-semibold mb-5" style={{ color: '#F1F3F9' }}>Top Campaigns by Click Rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="#252B3B" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#8B92A5', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#8B92A5', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="clickRate" fill="#4F7FFF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Campaign table */}
        <div
          className="col-span-2 rounded-xl overflow-hidden"
          style={{ background: '#181C27', border: '1px solid #252B3B' }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: '#252B3B' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#F1F3F9' }}>Campaign Performance</h3>
          </div>
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #252B3B' }}>
                  {['Campaign', 'Sent', 'Delivered', 'Open Rate', 'Click Rate', 'Bounces'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#8B92A5' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, idx) => (
                  <tr
                    key={c._id}
                    style={{ borderBottom: idx < campaigns.length - 1 ? '1px solid #252B3B' : 'none' }}
                    className="transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1E2436')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium truncate max-w-xs" style={{ color: '#F1F3F9' }}>{c.name}</p>
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: '#F1F3F9' }}>
                      {c.sent?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: '#F1F3F9' }}>
                      {c.delivered?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: c.openRate > 0.3 ? '#22C55E' : '#F1F3F9' }}>
                      {pct(c.openRate)}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: c.clickRate > 0.05 ? '#22C55E' : '#F1F3F9' }}>
                      {pct(c.clickRate)}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: c.bounceCount > 50 ? '#EF4444' : '#F1F3F9' }}>
                      {c.bounceCount ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
