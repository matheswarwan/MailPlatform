import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const routeTitles = {
  '/campaigns': 'Campaigns',
  '/campaigns/new': 'New Campaign',
  '/audience': 'Audience',
  '/automations': 'Automations',
  '/analytics': 'Analytics',
  '/contacts': 'Contacts',
  '/preference-centre': 'Preference Centre',
};

function getTitle(pathname) {
  if (routeTitles[pathname]) return routeTitles[pathname];
  if (pathname.startsWith('/campaigns/') && pathname.endsWith('/edit')) return 'Edit Campaign';
  return 'MailFlow';
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const title = getTitle(location.pathname);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
      style={{ background: '#181C27', borderColor: '#252B3B' }}
    >
      <h1 className="text-lg font-semibold" style={{ color: '#F1F3F9' }}>
        {title}
      </h1>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold"
              style={{ background: '#252B3B', color: '#4F7FFF' }}
            >
              {(user.email || user.name || 'U')[0].toUpperCase()}
            </div>
            <span className="text-sm" style={{ color: '#8B92A5' }}>
              {user.email || user.name || 'User'}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ color: '#8B92A5', border: '1px solid #252B3B' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#F1F3F9';
            e.currentTarget.style.borderColor = '#4F7FFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#8B92A5';
            e.currentTarget.style.borderColor = '#252B3B';
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
}
