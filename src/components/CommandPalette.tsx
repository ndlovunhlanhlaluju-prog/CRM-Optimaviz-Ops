import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brand, Lead } from '../types';

export type CommandNavTab =
  | 'dashboard'
  | 'communications'
  | 'calls'
  | 'email-tracking'
  | 'whatsapp-tracking'
  | 'team-chat'
  | 'integrations'
  | 'users'
  | 'intelligence'
  | 'social-hub';

export type PowerActionId =
  | 'sync-gmail'
  | 'create-task'
  | 'handoff-nestwise'
  | 'view-needs-reply'
  | 'view-hot-unassigned'
  | 'view-cross-sell'
  | 'open-keyboard-help'
  | 'go-email'
  | 'go-team-chat'
  | 'go-comms';

interface PowerAction {
  id: PowerActionId;
  label: string;
  hint: string;
  icon: string;
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  leads: Lead[];
  brands: Brand[];
  activeLead?: Lead | null;
  onClose: () => void;
  onOpenLead: (lead: Lead) => void;
  onOpenBrand: (brand: Brand) => void;
  onNavigate: (tab: CommandNavTab) => void;
  onQuickCall?: (lead: Lead) => void;
  onPowerAction?: (actionId: PowerActionId) => void;
}

const NAV_ACTIONS: { id: string; label: string; icon: string; tab: CommandNavTab }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-table-cells-large', tab: 'dashboard' },
  { id: 'communications', label: 'Communications Hub', icon: 'fa-comments', tab: 'communications' },
  { id: 'calls', label: 'Calls', icon: 'fa-phone', tab: 'calls' },
  { id: 'email', label: 'Email mailbox', icon: 'fa-envelope', tab: 'email-tracking' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'fa-comment-dots', tab: 'whatsapp-tracking' },
  { id: 'team-chat', label: 'Team Chat', icon: 'fa-comment', tab: 'team-chat' },
  { id: 'intelligence', label: 'Intelligence / portfolio', icon: 'fa-brain', tab: 'intelligence' },
  { id: 'social-hub', label: 'Social Hub', icon: 'fa-share-nodes', tab: 'social-hub' },
  { id: 'integrations', label: 'Integrations', icon: 'fa-plug', tab: 'integrations' },
  { id: 'users', label: 'User Management', icon: 'fa-users', tab: 'users' },
];

const POWER_ACTIONS: PowerAction[] = [
  {
    id: 'sync-gmail',
    label: 'Sync Gmail for current brand',
    hint: 'Import last 30 days',
    icon: 'fa-arrows-rotate',
    keywords: 'gmail sync mail import',
  },
  {
    id: 'create-task',
    label: 'Create follow-up task',
    hint: 'From active / last lead',
    icon: 'fa-list-check',
    keywords: 'task todo follow up',
  },
  {
    id: 'handoff-nestwise',
    label: 'Hand off lead to NestWise',
    hint: 'Cross-brand note + open NestWise',
    icon: 'fa-handshake',
    keywords: 'nestwise handoff cross sell portfolio',
  },
  {
    id: 'view-needs-reply',
    label: 'View: Needs reply today',
    hint: 'Action inbox focus',
    icon: 'fa-reply',
    keywords: 'email reply overdue action',
  },
  {
    id: 'view-hot-unassigned',
    label: 'View: Hot verified, no owner',
    hint: 'Assign ownership fast',
    icon: 'fa-fire',
    keywords: 'unassigned verified hot owner',
  },
  {
    id: 'view-cross-sell',
    label: 'View: Cross-sell candidates',
    hint: 'Portfolio hand-off ready',
    icon: 'fa-shuffle',
    keywords: 'cross sell portfolio nestwise',
  },
  {
    id: 'go-email',
    label: 'Go to Email',
    hint: 'Shortcut G then E',
    icon: 'fa-envelope',
    keywords: 'mailbox',
  },
  {
    id: 'go-comms',
    label: 'Go to Communications Hub',
    hint: 'Shortcut G then C',
    icon: 'fa-comments',
    keywords: 'comms hub triage',
  },
  {
    id: 'go-team-chat',
    label: 'Go to Team Chat',
    hint: 'Shortcut G then T',
    icon: 'fa-comment',
    keywords: 'slack team',
  },
  {
    id: 'open-keyboard-help',
    label: 'Keyboard shortcuts',
    hint: 'Press ? anytime',
    icon: 'fa-keyboard',
    keywords: 'hotkeys power user help',
  },
];

export default function CommandPalette({
  open,
  leads,
  brands,
  activeLead,
  onClose,
  onOpenLead,
  onOpenBrand,
  onNavigate,
  onQuickCall,
  onPowerAction,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const normalized = query.trim().toLowerCase();

  const leadResults = useMemo(() => {
    if (!normalized) return leads.slice(0, 5);
    return leads
      .filter(lead => {
        const brand = brands.find(b => b.id === lead.brand_id);
        return [lead.name, lead.email, lead.phone, lead.funnel_stage, lead.brand_name, brand?.name].some(value =>
          String(value || '')
            .toLowerCase()
            .includes(normalized),
        );
      })
      .slice(0, 8);
  }, [brands, leads, normalized]);

  const brandResults = useMemo(() => {
    if (!normalized) return brands.slice(0, 5);
    return brands.filter(brand => brand.name.toLowerCase().includes(normalized)).slice(0, 5);
  }, [brands, normalized]);

  const navResults = useMemo(() => {
    if (!normalized) return NAV_ACTIONS;
    return NAV_ACTIONS.filter(action => action.label.toLowerCase().includes(normalized));
  }, [normalized]);

  const powerResults = useMemo(() => {
    if (!normalized) return POWER_ACTIONS;
    return POWER_ACTIONS.filter(action =>
      `${action.label} ${action.hint} ${action.keywords || ''}`.toLowerCase().includes(normalized),
    );
  }, [normalized]);

  type FlatItem =
    | { kind: 'lead'; lead: Lead }
    | { kind: 'brand'; brand: Brand }
    | { kind: 'nav'; tab: CommandNavTab; label: string }
    | { kind: 'power'; id: PowerActionId; label: string };

  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    leadResults.forEach(lead => items.push({ kind: 'lead', lead }));
    brandResults.forEach(brand => items.push({ kind: 'brand', brand }));
    powerResults.forEach(action => items.push({ kind: 'power', id: action.id, label: action.label }));
    navResults.forEach(action => items.push({ kind: 'nav', tab: action.tab, label: action.label }));
    return items;
  }, [brandResults, leadResults, navResults, powerResults]);

  useEffect(() => {
    setCursor(0);
  }, [normalized]);

  const runItem = (item: FlatItem) => {
    if (item.kind === 'lead') onOpenLead(item.lead);
    else if (item.kind === 'brand') onOpenBrand(item.brand);
    else if (item.kind === 'nav') onNavigate(item.tab);
    else if (item.kind === 'power') onPowerAction?.(item.id);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="command-palette-overlay" onMouseDown={onClose}>
      <div className="command-palette command-palette--power" onMouseDown={event => event.stopPropagation()}>
        <div className="command-palette__search">
          <i className="fas fa-magnifying-glass" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                onClose();
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setCursor(c => Math.min(c + 1, Math.max(0, flatItems.length - 1)));
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setCursor(c => Math.max(c - 1, 0));
                return;
              }
              if (event.key === 'Enter' && flatItems[cursor]) {
                event.preventDefault();
                runItem(flatItems[cursor]);
              }
            }}
            placeholder="Search leads, brands, sync Gmail, hand-off, views…"
            aria-label="Command palette"
          />
          <kbd className="command-palette__kbd">Esc</kbd>
          <button type="button" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        {activeLead && (
          <div className="command-palette__context">
            <i className="fas fa-user" />
            <span>
              Active lead: <strong>{activeLead.name || 'Unnamed'}</strong>
            </span>
          </div>
        )}

        <div className="command-palette__body">
          {powerResults.length > 0 && (
            <section>
              <h4>Power actions</h4>
              {powerResults.map(action => {
                const idx = flatItems.findIndex(i => i.kind === 'power' && i.id === action.id);
                return (
                  <button
                    key={action.id}
                    type="button"
                    className={`command-palette__item command-palette__item--power ${cursor === idx ? 'is-active' : ''}`}
                    onClick={() => {
                      onPowerAction?.(action.id);
                      onClose();
                    }}
                    onMouseEnter={() => setCursor(idx)}
                  >
                    <i className={`fas ${action.icon}`} />
                    <span>
                      <strong>{action.label}</strong>
                      <small>{action.hint}</small>
                    </span>
                  </button>
                );
              })}
            </section>
          )}

          {leadResults.length > 0 && (
            <section>
              <h4>Leads</h4>
              {leadResults.map(lead => {
                const brand = brands.find(b => b.id === lead.brand_id);
                const idx = flatItems.findIndex(i => i.kind === 'lead' && i.lead.id === lead.id);
                return (
                  <div key={lead.id} className={`command-palette__row ${cursor === idx ? 'is-active' : ''}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenLead(lead);
                        onClose();
                      }}
                      onMouseEnter={() => setCursor(idx)}
                    >
                      <span
                        className="command-palette__avatar"
                        style={{ background: `${brand?.color || '#0f766e'}22`, color: brand?.color || '#0f766e' }}
                      >
                        {(lead.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <strong>{lead.name || 'Unnamed lead'}</strong>
                        <small>
                          {brand?.name || lead.brand_name || lead.brand_id} | {lead.email || lead.phone || 'No contact'}
                        </small>
                      </span>
                    </button>
                    {onQuickCall && lead.phone && (
                      <button
                        type="button"
                        className="command-palette__icon"
                        onClick={() => {
                          onQuickCall(lead);
                          onClose();
                        }}
                        title="Quick call"
                      >
                        <i className="fas fa-phone" />
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {brandResults.length > 0 && (
            <section>
              <h4>Brands</h4>
              {brandResults.map(brand => {
                const idx = flatItems.findIndex(i => i.kind === 'brand' && i.brand.id === brand.id);
                return (
                  <button
                    key={brand.id}
                    type="button"
                    className={`command-palette__item ${cursor === idx ? 'is-active' : ''}`}
                    onClick={() => {
                      onOpenBrand(brand);
                      onClose();
                    }}
                    onMouseEnter={() => setCursor(idx)}
                  >
                    <img src={brand.logo} alt="" />
                    <span>{brand.name}</span>
                  </button>
                );
              })}
            </section>
          )}

          {navResults.length > 0 && (
            <section>
              <h4>Navigate</h4>
              {navResults.map(action => {
                const idx = flatItems.findIndex(i => i.kind === 'nav' && i.tab === action.tab);
                return (
                  <button
                    key={action.id}
                    type="button"
                    className={`command-palette__item ${cursor === idx ? 'is-active' : ''}`}
                    onClick={() => {
                      onNavigate(action.tab);
                      onClose();
                    }}
                    onMouseEnter={() => setCursor(idx)}
                  >
                    <i className={`fas ${action.icon}`} />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </section>
          )}

          {flatItems.length === 0 && (
            <div className="command-palette__empty">
              <i className="fas fa-compass" />
              <p>No matches. Try “sync”, “nestwise”, or a lead name.</p>
            </div>
          )}
        </div>

        <div className="command-palette__footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>Enter</kbd> run
          </span>
          <span>
            <kbd>Ctrl</kbd>
            <kbd>K</kbd> open
          </span>
          <span>
            <kbd>?</kbd> shortcuts
          </span>
        </div>
      </div>
    </div>
  );
}
