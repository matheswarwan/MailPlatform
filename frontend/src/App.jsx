import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Login from './pages/Login';
import Campaigns from './pages/Campaigns';
import CampaignBuilder from './components/campaigns/CampaignBuilder';
import Audience from './pages/Audience';
import Automations from './pages/Automations';
import Analytics from './pages/Analytics';
import Contacts from './pages/Contacts';
import PreferenceCentre from './pages/PreferenceCentre';
import PreferencePage from './pages/PreferencePage';

function ProtectedLayout() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0F1117' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/preferences/:token" element={<PreferencePage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/campaigns" replace />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/new" element={<CampaignBuilder />} />
        <Route path="/campaigns/:id/edit" element={<CampaignBuilder />} />
        <Route path="/audience" element={<Audience />} />
        <Route path="/automations" element={<Automations />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/preference-centre" element={<PreferenceCentre />} />
      </Route>
    </Routes>
  );
}
