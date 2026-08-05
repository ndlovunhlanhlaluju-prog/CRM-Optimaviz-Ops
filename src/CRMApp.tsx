import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppSidebar from './layout/AppSidebar';
import AppTopBar from './layout/AppTopBar';
import DashboardPage from './pages/DashboardPage';
import CallsPage from './pages/CallsPage';
import CommunicationsHubPage from './pages/CommunicationsHubPage';
import EmailTrackingPage from './pages/EmailTrackingPage';
import IntegrationsPage from './pages/IntegrationsPage';
import IntelligencePage from './pages/IntelligencePage';
import TeamChatPage from './pages/TeamChatPage';
import WhatsAppPage from './pages/WhatsAppPage';
import UsersPage from './pages/UsersPage';
import SocialHubPage from './components/SocialHubPage';
import BrandDetailPage from './components/BrandDetailPage';

interface CRMAppProps {
  user: any;
  onLogout: () => void;
}

const CRMApp: React.FC<CRMAppProps> = ({ user, onLogout }) => {
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppTopBar user={user} onLogout={onLogout} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900">
          <div className="container mx-auto px-6 py-8">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/calls" element={<CallsPage />} />
              <Route path="/communications" element={<CommunicationsHubPage />} />
              <Route path="/email-tracking" element={<EmailTrackingPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/intelligence" element={<IntelligencePage />} />
              <Route path="/team-chat" element={<TeamChatPage />} />
              <Route path="/whatsapp" element={<WhatsAppPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/social-hub" element={<SocialHubPage />} />
              <Route path="/brand/:brandId" element={<BrandDetailPage />} />
              <Route path="*" element={<div className="text-center py-10"><h2>404: Page Not Found</h2></div>} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CRMApp;