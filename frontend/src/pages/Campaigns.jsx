import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAppStore from '../store/appStore';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

function StatItem({ label, value }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: '#181C27', border: '1px solid #252B3B' }}
    >
      <p className="text-sm mb-1" style={{ color: '#8B92A5' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: '#F1F3F9' }}>{value}</p>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function pct(n) {
  if (n === undefined || n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export default function Campaigns() {
  const { campaigns, campaignsLoading, fetchCampaigns, deleteCampaign, copyCampaign } = useAppStore();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(null);
  const [copying, setCopying] = useState(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const sent = campaigns.filter((c) => c.status === 'sent');
  const thisMonth = sent.filter((c) => {
    const ts = c.sent_at || c.sentAt;
    if (!ts) return false;
    const d = new Date(ts);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const avgOpenRate =
    sent.length > 0
      ? sent.reduce((sum, c) => sum + (c.open_rate || c.stats?.openRate || 0), 0) / sent.length
      : null;

  const avgClickRate =
    sent.length > 0
      ? sent.reduce((sum, c) => sum + (c.click_rate || c.stats?.clickRate || 0), 0) / sent.length
      : null;

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    setDeleting(id);
    try {
      await deleteCampaign(id);
    } finally {
      setDeleting(null);
    }
  };

  const handleCopy = async (id) => {
    setCopying(id);
    try {
      const newCampaign = await copyCampaign(id);
      const newId = newCampaign.id || newCampaign._id;
      navigate(`/campaigns/${newId}/edit`);
    } catch {
      // ignore
    } finally {
      setCopying(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#F1F3F9' }}>Campaigns</h2>
          <p className="text-sm mt-1" style={{ color: '#8B92A5' }}>
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link to="/campaigns/new">
          <Button variant="primary" size="md">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <StatItem label="Total Campaigns" value={campaigns.length} />
        <StatItem label="Sent This Month" value={thisMonth.length} />
        <StatItem label="Avg Open Rate" value={avgOpenRate !== null ? pct(avgOpenRate) : '—'} />
        <StatItem label="Avg Click Rate" value={avgClickRate !== null ? pct(avgClickRate) : '—'} />
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#181C27', border: '1px solid #252B3B' }}
      >
        {campaignsLoading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-full"
              style={{ background: '#1E2436' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold" style={{ color: '#F1F3F9' }}>No campaigns yet</p>
              <p className="text-sm mt-1" style={{ color: '#8B92A5' }}>
                Create your first campaign to get started
              </p>
            </div>
            <Link to="/campaigns/new">
              <Button variant="primary" size="sm">Create Campaign</Button>
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #252B3B' }}>
                {['Name', 'Status', 'Sent', 'Open Rate', 'Click Rate', 'Created', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#8B92A5' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, idx) => (
                <tr
                  key={campaign.id}
                  style={{
                    borderBottom: idx < campaigns.length - 1 ? '1px solid #252B3B' : 'none',
                  }}
                  className="transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1E2436')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#F1F3F9' }}>
                        {campaign.name}
                      </p>
                      {campaign.subject && (
                        <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: '#8B92A5' }}>
                          {campaign.subject}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge status={campaign.status || 'draft'} />
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: '#F1F3F9' }}>
                    {campaign.stats?.sent?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: '#F1F3F9' }}>
                    {pct(campaign.stats?.openRate)}
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: '#F1F3F9' }}>
                    {pct(campaign.stats?.clickRate)}
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: '#8B92A5' }}>
                    {formatDate(campaign.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/campaigns/${campaign.id}/edit`}>
                        <button
                          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                          style={{ color: '#8B92A5' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#252B3B';
                            e.currentTarget.style.color = '#4F7FFF';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#8B92A5';
                          }}
                          title="Edit"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </Link>
                      <button
                        onClick={() => handleCopy(campaign.id)}
                        disabled={copying === campaign.id}
                        className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                        style={{ color: '#8B92A5' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#252B3B';
                          e.currentTarget.style.color = '#22C55E';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#8B92A5';
                        }}
                        title="Duplicate"
                      >
                        {copying === campaign.id ? (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(campaign.id)}
                        disabled={deleting === campaign.id}
                        className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                        style={{ color: '#8B92A5' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#2D0E0E';
                          e.currentTarget.style.color = '#EF4444';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#8B92A5';
                        }}
                        title="Delete"
                      >
                        {deleting === campaign.id ? (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
