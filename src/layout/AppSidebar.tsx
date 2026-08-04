import React, { useState } from 'react';
import { Brand, User, Lead } from '../types';
import { DirotiQLogo, APP_WORDMARK, APP_DESCRIPTOR, BRANDS } from '../config/crmConfig';

interface AppSidebarProps {
  activeTab: string;
  activeBrands: Brand[];
  user: User;
  profilePicture: string;
  allCrmLeads: Lead[];
  leads: Lead[];
  portfolioPendingCount: number;
  teamGlobalUnreadCount: number;
  onSelectDashboard: () => void;
  onSelectBrand: (brand: Brand) => void;
  onSelectCommunications: () => void;
  onSelectIntelligence: () => void;
  onSelectTeamChat: () => void;
  onSelectSocialHub: () => void;
  onSelectIntegrations: () => void;
  onSelectUsers: () => void;
  onOpenProfile: () => void;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  isDarkMode: boolean;
}

export default function AppSidebar({
  activeTab,
  activeBrands,
  user,
  profilePicture,
  allCrmLeads: _allCrmLeads,
  leads: _leads,
  portfolioPendingCount,
  teamGlobalUnreadCount,
  onSelectDashboard,
  onSelectBrand,
  onSelectCommunications,
  onSelectIntelligence,
  onSelectTeamChat,
  onSelectSocialHub,
  onSelectIntegrations,
  onSelectUsers,
  onOpenProfile,
  onToggleDarkMode,
  onLogout,
  isDarkMode,
}: AppSidebarProps) {
  const [brandSearch, setBrandSearch] = useState('');
  const communicationsTabs = ['communications', 'calls', 'email-tracking', 'whatsapp-tracking'];
  const isCommunicationsActive = communicationsTabs.includes(activeTab);

  return (
    <div className="sidebar" style={{ width: '260px', display: 'flex', flexDirection: 'column', padding: '24px 16px', flexShrink: 0 }}>
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingLeft: '8px' }}>
        <div className="sidebar-logo-icon" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DirotiQLogo size={36} />
        </div>
        <span className="sidebar-logo-wordmark" style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {APP_WORDMARK}{' '}
          <span className="sidebar-logo-descriptor">{APP_DESCRIPTOR}</span>
        </span>
      </div>

      <div
        className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={onSelectDashboard}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', marginBottom: '8px' }}
      >
        <i className="fas fa-th-large"></i>
        <span>Dashboard</span>
      </div>

      <div className="sidebar-section-label">Brands</div>
      {activeBrands.length > 4 && (
        <div className="sidebar-brand-search">
          <i className="fas fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Filter brands…"
            value={brandSearch}
            onChange={e => setBrandSearch(e.target.value)}
          />
        </div>
      )}
      {activeBrands.filter(b => !brandSearch || String(b.name || '').toLowerCase().includes(String(brandSearch).toLowerCase())).map(b => (
        <div
          key={b.id}
          className={`nav-item ${activeTab === b.id ? 'active' : ''}`}
          onClick={() => onSelectBrand(b)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '10px',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '4px',
            // Active brand uses brand color only as an accent; CSS owns readable foregrounds.
            ...(activeTab === b.id ? { color: b.color, borderColor: `${b.color}44` } : {}),
          }}
        >
          <img src={b.logo} alt={b.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '18px', height: '18px', objectFit: 'contain' }} referrerPolicy="no-referrer" />
          <span>{b.name}</span>
        </div>
      ))}

      <div className="sidebar-section-label">Operations</div>
      <div
        className={`nav-item ${isCommunicationsActive ? 'active' : ''}`}
        onClick={onSelectCommunications}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', marginBottom: '4px' }}
      >
        <i className="fas fa-tower-broadcast" style={{ width: '20px' }}></i>
        <span>Communications</span>
      </div>

      <div
        className={`nav-item ${activeTab === 'intelligence' ? 'active' : ''}`}
        onClick={onSelectIntelligence}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', marginBottom: '4px' }}
      >
        <i className="fas fa-wand-magic-sparkles" style={{ width: '20px' }}></i>
        <span>Intelligence</span>
        {portfolioPendingCount > 0 && (
          <strong className="nav-unread-badge">{portfolioPendingCount > 9 ? '9+' : portfolioPendingCount}</strong>
        )}
      </div>

      <div
        className={`nav-item ${activeTab === 'team-chat' ? 'active' : ''}`}
        onClick={onSelectTeamChat}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', marginBottom: '4px' }}
      >
        <i className="fas fa-comments" style={{ width: '20px' }}></i>
        <span>Team Chat</span>
        {teamGlobalUnreadCount > 0 && (
          <strong className="nav-unread-badge">{teamGlobalUnreadCount > 9 ? '9+' : teamGlobalUnreadCount}</strong>
        )}
      </div>

      <div
        className={`nav-item ${activeTab === 'social-hub' ? 'active' : ''}`}
        onClick={onSelectSocialHub}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', marginBottom: '4px' }}
      >
        <i className="fas fa-share-nodes" style={{ width: '20px' }}></i>
        <span>Social Hub</span>
      </div>

      <div
        className={`nav-item ${activeTab === 'integrations' ? 'active' : ''}`}
        onClick={onSelectIntegrations}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', marginBottom: '4px' }}
      >
        <i className={`fas ${user.role === 'admin' ? 'fa-plug' : 'fa-book-open'}`} style={{ width: '20px' }}></i>
        <span>{user.role === 'admin' ? 'Integrations' : 'Template Library'}</span>
      </div>

      {user.role === 'admin' && (
        <div className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={onSelectUsers} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', marginBottom: '4px' }}>
          <i className="fas fa-users-cog"></i>
          <span>User Management</span>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-profile-row">
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: profilePicture ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--brand-optimaviz))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', overflow: 'hidden', flexShrink: 0 }}>
            {profilePicture ? <img src={profilePicture} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user.name.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-profile-name">{user.name}</div>
            <div className="sidebar-profile-role">{user.role}</div>
          </div>
          <button
            onClick={onOpenProfile}
            aria-label="User Profile Settings"
            title="User Profile Settings"
            className="sidebar-footer-action"
          >
            <i className="fas fa-user-circle"></i>
          </button>
          <button
            type="button"
            className="sidebar-theme-btn"
            onClick={onToggleDarkMode}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button onClick={onLogout} className="btn-logout sidebar-footer-action" aria-label="Log Out" title="Log Out">
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
