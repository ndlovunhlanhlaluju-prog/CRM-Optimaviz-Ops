import React from 'react';
import { Brand, Lead, User } from '../types';

interface AppTopBarProps {
  activeTab: string;
  selectedBrand: Brand | null;
  user: User;
  globalSearchQuery: string;
  showGlobalSearch: boolean;
  globalSearchResults: Lead[];
  managedBrands: Brand[];
  unreadNotificationCount: number;
  notificationDrawerOpen: boolean;
  notificationSignature: string;
  onGlobalSearchChange: (query: string) => void;
  onGlobalSearchVisibilityChange: (visible: boolean) => void;
  onOpenLead: (lead: Lead) => void;
  onOpenCommandPalette: () => void;
  onToggleNotifications: () => void;
}

function getTopBarTitle(activeTab: string, selectedBrand: Brand | null, user: User) {
  if (selectedBrand) return null;
  if (activeTab === 'dashboard') return { full: 'Dashboard Overview', short: 'Dashboard' };
  if (activeTab === 'communications') return { full: 'Communications Hub', short: 'Comms' };
  if (activeTab === 'calls') return { full: 'Communications - Calls', short: 'Calls' };
  if (activeTab === 'intelligence') return { full: 'Operations Intelligence Center', short: 'Intelligence' };
  if (activeTab === 'users') return { full: 'Staff Directory & Permissions', short: 'Staff' };
  if (activeTab === 'email-tracking') return { full: 'Communications - Email', short: 'Email' };
  if (activeTab === 'whatsapp-tracking') return { full: 'Communications - WhatsApp', short: 'WhatsApp' };
  if (activeTab === 'team-chat') return { full: 'Communications - Team Chat', short: 'Team Chat' };
  if (activeTab === 'social-hub') return { full: 'Social Hub', short: 'Social' };
  if (activeTab === 'integrations') {
    return user.role === 'admin'
      ? { full: 'Brand Integrations & Template Library', short: 'Setup' }
      : { full: 'Communication Template Library', short: 'Templates' };
  }
  return { full: '', short: '' };
}

export default function AppTopBar({
  activeTab,
  selectedBrand,
  user,
  globalSearchQuery,
  showGlobalSearch,
  globalSearchResults,
  managedBrands,
  unreadNotificationCount,
  notificationDrawerOpen,
  onGlobalSearchChange,
  onGlobalSearchVisibilityChange,
  onOpenLead,
  onOpenCommandPalette,
  onToggleNotifications,
}: AppTopBarProps) {
  const brandColor = selectedBrand?.color || '';
  const title = getTopBarTitle(activeTab, selectedBrand, user);

  return (
    <div
      className={`app-topbar ${selectedBrand ? 'app-topbar--brand' : ''}`}
      style={
        selectedBrand
          ? {
              ['--topbar-brand' as string]: brandColor,
              boxShadow: `inset 4px 0 0 ${brandColor}`,
            }
          : undefined
      }
    >
      <h2 className="app-topbar__title">
        {selectedBrand ? (
          <span className="app-topbar__brand-title">
            <span className="app-topbar__brand-badge">
              <img src={selectedBrand.logo} alt="" referrerPolicy="no-referrer" />
            </span>
            <span className="app-topbar__brand-copy">
              <span className="app-topbar__title-full">{selectedBrand.name} Workspace</span>
              <span className="app-topbar__title-short">{selectedBrand.name}</span>
              <span className="app-topbar__brand-sub">Brand active</span>
            </span>
          </span>
        ) : (
          <>
            <span className="app-topbar__title-full">{title?.full}</span>
            <span className="app-topbar__title-short">{title?.short}</span>
          </>
        )}
      </h2>

      <div className="app-topbar__actions">
        <div
          className="global-brand-search"
          onBlur={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              onGlobalSearchVisibilityChange(false);
            }
          }}
        >
          <div className="global-brand-search-control">
            <span className="global-brand-search-icon" aria-hidden="true">
              <i className="fas fa-search"></i>
            </span>
            <input
              className="global-brand-search-input"
              type="search"
              placeholder="Search all brands..."
              value={globalSearchQuery}
              onChange={e => onGlobalSearchChange(e.target.value)}
              onFocus={() => globalSearchQuery && onGlobalSearchVisibilityChange(true)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {showGlobalSearch && globalSearchResults.length > 0 && (
            <div className="global-brand-search-results">
              <div className="global-brand-search-results__head">Leads across all brands</div>
              {globalSearchResults.map(lead => {
                const b = managedBrands.find(br => br.id === lead.brand_id);
                return (
                  <button
                    key={lead.id}
                    type="button"
                    className="global-brand-search-results__item"
                    onMouseDown={() => onOpenLead(lead)}
                  >
                    <span>
                      <strong>{lead.name}</strong>
                      <small>{lead.email || lead.phone || 'No contact'}</small>
                    </span>
                    {b && <em style={{ background: `${b.color}22`, color: b.color }}>{b.name}</em>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          className="command-launcher"
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          title="Open command palette (Ctrl K)"
        >
          <i className="fas fa-bolt"></i>
          <span className="command-launcher__label">Actions</span>
          <span className="kbd-hint">Ctrl K</span>
        </button>

        <div className="notification-shell">
          <button
            type="button"
            className={`notification-trigger ${notificationDrawerOpen ? 'active' : ''}`}
            onClick={onToggleNotifications}
            aria-label="Open notifications"
            title="Open notifications"
          >
            <i className="fas fa-bell"></i>
            {unreadNotificationCount > 0 && (
              <strong>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</strong>
            )}
          </button>
        </div>

        <div className="app-topbar__online">
          <span>
            <i className="fas fa-circle" aria-hidden="true"></i> ONLINE
          </span>
        </div>
      </div>
    </div>
  );
}
