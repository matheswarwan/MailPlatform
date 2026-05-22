import React, { useEffect, useState } from 'react';
import useAppStore from '../store/appStore';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

const PREBUILT = [
  {
    _id: 'pb-1',
    name: 'Welcome Series',
    trigger: 'New Subscriber',
    triggerType: 'signup',
    active: true,
    steps: [
      { type: 'trigger', label: 'New Subscriber' },
      { type: 'email', label: 'Welcome Email' },
      { type: 'delay', label: 'Wait 2 days' },
      { type: 'email', label: 'Getting Started Guide' },
      { type: 'delay', label: 'Wait 5 days' },
      { type: 'email', label: 'Success Stories' },
    ],
  },
  {
    _id: 'pb-2',
    name: 'Win-Back Flow',
    trigger: 'Inactive 90 Days',
    triggerType: 'behavior',
    active: false,
    steps: [
      { type: 'trigger', label: 'Inactive 90 Days' },
      { type: 'email', label: 'We Miss You!' },
      { type: 'delay', label: 'Wait 7 days' },
      { type: 'email', label: 'Special Offer' },
      { type: 'delay', label: 'Wait 7 days' },
      { type: 'email', label: 'Last Chance' },
    ],
  },
  {
    _id: 'pb-3',
    name: 'Birthday Greeting',
    trigger: 'Birthday Date',
    triggerType: 'date',
    active: true,
    steps: [
      { type: 'trigger', label: 'Birthday Today' },
      { type: 'email', label: 'Happy Birthday!' },
    ],
  },
  {
    _id: 'pb-4',
    name: 'Post-Purchase Follow Up',
    trigger: 'Purchase Completed',
    triggerType: 'purchase',
    active: true,
    steps: [
      { type: 'trigger', label: 'Purchase Completed' },
      { type: 'email', label: 'Order Confirmation' },
      { type: 'delay', label: 'Wait 3 days' },
      { type: 'email', label: 'Usage Tips' },
      { type: 'delay', label: 'Wait 14 days' },
      { type: 'email', label: 'Review Request' },
    ],
  },
];

const triggerBadgeMap = {
  signup: { label: 'Sign Up', color: '#4F7FFF', bg: '#1A2744' },
  behavior: { label: 'Behavior', color: '#EAB308', bg: '#3D2E00' },
  date: { label: 'Date Based', color: '#A855F7', bg: '#2D1458' },
  purchase: { label: 'Purchase', color: '#22C55E', bg: '#052E16' },
};

function TriggerBadge({ type }) {
  const cfg = triggerBadgeMap[type] || { label: type, color: '#8B92A5', bg: '#252B3B' };
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

const stepConfig = {
  trigger: { bg: '#1A2744', color: '#4F7FFF', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )},
  email: { bg: '#181C27', color: '#F1F3F9', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )},
  delay: { bg: '#1E2436', color: '#8B92A5', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )},
};

function StepChain({ steps }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mt-4">
      {steps.map((step, i) => {
        const cfg = stepConfig[step.type] || stepConfig.email;
        return (
          <React.Fragment key={i}>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: cfg.bg, color: cfg.color, border: '1px solid #252B3B' }}
            >
              <span style={{ color: cfg.color }}>{cfg.icon}</span>
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <svg viewBox="0 0 24 24" fill="none" stroke="#252B3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function AutomationCard({ automation, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (e) => {
    e.stopPropagation();
    setToggling(true);
    try {
      await onToggle(automation._id, !automation.active);
    } finally {
      setToggling(false);
    }
  };

  const emailSteps = automation.steps?.filter((s) => s.type === 'email').length || 0;

  return (
    <div
      className="rounded-xl transition-all cursor-pointer"
      style={{ background: '#181C27', border: '1px solid #252B3B' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#4F7FFF')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#252B3B')}
    >
      <div
        className="p-5"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <h3 className="text-base font-semibold" style={{ color: '#F1F3F9' }}>
                {automation.name}
              </h3>
              <TriggerBadge type={automation.triggerType} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: '#8B92A5' }}>
                Trigger: <span style={{ color: '#F1F3F9' }}>{automation.trigger}</span>
              </span>
              <span className="text-xs" style={{ color: '#8B92A5' }}>
                {emailSteps} email{emailSteps !== 1 ? 's' : ''}
              </span>
              <span className="text-xs" style={{ color: '#8B92A5' }}>
                {automation.steps?.length || 0} steps
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle switch */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="relative inline-flex items-center w-11 h-6 rounded-full transition-colors flex-shrink-0"
              style={{ background: automation.active ? '#4F7FFF' : '#252B3B' }}
              title={automation.active ? 'Deactivate' : 'Activate'}
            >
              <span
                className="inline-block w-4 h-4 bg-white rounded-full transition-transform"
                style={{ transform: automation.active ? 'translateX(24px)' : 'translateX(4px)' }}
              />
            </button>
            <Badge status={automation.active ? 'active' : 'inactive'} />

            {/* Expand chevron */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8B92A5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 transition-transform flex-shrink-0"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Collapsed step preview */}
        {!expanded && automation.steps && (
          <div className="flex items-center gap-1 mt-3 overflow-hidden">
            {automation.steps.slice(0, 5).map((step, i) => {
              const cfg = stepConfig[step.type] || stepConfig.email;
              return (
                <React.Fragment key={i}>
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.icon}
                    <span className="hidden sm:block">{step.label}</span>
                  </div>
                  {i < Math.min(automation.steps.length, 5) - 1 && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#252B3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </React.Fragment>
              );
            })}
            {automation.steps.length > 5 && (
              <span className="text-xs ml-1" style={{ color: '#8B92A5' }}>
                +{automation.steps.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded */}
      {expanded && automation.steps && (
        <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: '#252B3B' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mt-4 mb-3" style={{ color: '#8B92A5' }}>
            Full Flow
          </p>
          <StepChain steps={automation.steps} />
        </div>
      )}
    </div>
  );
}

export default function Automations() {
  const { automations, automationsLoading, fetchAutomations, toggleAutomation } = useAppStore();
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    fetchAutomations();
  }, []);

  const displayAutomations = automations.length > 0 ? automations : PREBUILT;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#F1F3F9' }}>Automations</h2>
          <p className="text-sm mt-1" style={{ color: '#8B92A5' }}>
            {displayAutomations.length} automation{displayAutomations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowNewModal(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Automation
        </Button>
      </div>

      {/* Info banner */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ background: '#1A2744', border: '1px solid #4F7FFF' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p style={{ color: '#F1F3F9' }}>
          Automations run automatically based on triggers. Toggle the switch to activate or pause any flow.
          Click a card to view the full step chain.
        </p>
      </div>

      {/* Automation grid */}
      {automationsLoading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
      ) : (
        <div className="grid gap-4">
          {displayAutomations.map((automation) => (
            <AutomationCard
              key={automation._id}
              automation={automation}
              onToggle={async (id, active) => {
                if (automations.length > 0) {
                  await toggleAutomation(id, active);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* New automation modal placeholder */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: '#181C27', border: '1px solid #252B3B' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#F1F3F9' }}>
              New Automation
            </h3>
            <p className="text-sm mb-6" style={{ color: '#8B92A5' }}>
              Choose a template to get started quickly, or build a custom flow.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {PREBUILT.map((p) => (
                <button
                  key={p._id}
                  className="text-left p-3 rounded-xl transition-all"
                  style={{ background: '#0F1117', border: '1px solid #252B3B' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#4F7FFF')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#252B3B')}
                  onClick={() => setShowNewModal(false)}
                >
                  <p className="text-sm font-medium" style={{ color: '#F1F3F9' }}>{p.name}</p>
                  <p className="text-xs mt-1" style={{ color: '#8B92A5' }}>{p.steps.length} steps</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => setShowNewModal(false)}>Cancel</Button>
              <Button variant="primary" size="md" onClick={() => setShowNewModal(false)}>Custom Flow</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
