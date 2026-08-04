import React from 'react';
import { Brand } from '../types';

interface MobileBottomNavProps {
  activeTab: string;
  selectedBrand: Brand | null;
  onSelectDashboard: () => void;
  onSelectCommunications: () => void;
  onSelectTeamChat: () => void;
  onSelectSocialHub: () => void;
  onSelectIntegrations: () => void;
  onSelectBrands: () => void;
  onOpenProfile: () => void;
}

export default function MobileBottomNav({
  activeTab,
  selectedBrand,
  onSelectDashboard,
  onSelectCommunications,
  onSelectTeamChat,
  onSelectSocialHub,
  onSelectIntegrations,
  onSelectBrands,
  onOpenProfile,
}: MobileBottomNavProps) {
  const items = [
    { id: 'dashboard', icon: 'fa-home', label: 'Home', action: onSelectDashboard },
    { id: 'brands', icon: 'fa-layer-group', label: 'Brands', action: onSelectBrands },
    { id: 'communications', icon: 'fa-comments', label: 'Comms', action: onSelectCommunications },
    { id: 'team-chat', icon: 'fa-comment-dots', label: 'Chat', action: onSelectTeamChat },
    { id: 'social-hub', icon: 'fa-share-nodes', label: 'Social', action: onSelectSocialHub },
    { id: 'integrations', icon: 'fa-plug', label: 'Setup', action: onSelectIntegrations },
    { id: 'profile', icon: 'fa-user-circle', label: 'Profile', action: onOpenProfile },
  ];

  const isActive = (id: string) => {
    if (id === 'brands') return Boolean(selectedBrand);
    if (id === 'dashboard') return activeTab === 'dashboard' && !selectedBrand;
    if (id === 'communications') {
      return ['communications', 'email-tracking', 'whatsapp-tracking', 'calls'].includes(activeTab);
    }
    return activeTab === id;
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={item.action}
          aria-label={item.label}
          aria-current={isActive(item.id) ? 'page' : undefined}
          className={isActive(item.id) ? 'is-active' : ''}
        >
          <i className={`fas ${item.icon}`} aria-hidden="true"></i>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
