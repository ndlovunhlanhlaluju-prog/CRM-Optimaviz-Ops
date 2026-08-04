import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brand, Lead } from '../types';

interface CommandPaletteProps {
  open: boolean;
  leads: Lead[];
  brands: Brand[];
  onClose: () => void;
  onOpenLead: (lead: Lead) => void;
  onOpenBrand: (brand: Brand) => void;
  onNavigate: (tab: 'dashboard' | 'communications' | 'calls' | 'email-tracking' | 'whatsapp-tracking' | 'team-chat' | 'integrations' | 'users') => void;
  onQuickCall?: (lead: Lead) => void;
}

const ACTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-table-cells-large', tab: 'dashboard' as const },
  { id: 'communications', label: 'Communications Hub', icon: 'fa-comments', tab: 'communications' as const },
  { id: 'calls', label: 'Calls', icon: 'fa-phone', tab: 'calls' as const },
  { id: 'email', label: 'Email', icon: 'fa-envelope', tab: 'email-tracking' as const },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'fa-comment-dots', tab: 'whatsapp-tracking' as const },
  { id: 'team-chat', label: 'Team Chat', icon: 'fa-comment', tab: 'team-chat' as const },
  { id: 'integrations', label: 'Integrations', icon: 'fa-plug', tab: 'integrations' as const },
  { id: 'users', label: 'User Management', icon: 'fa-users', tab: 'users' as const },
];

export default function CommandPalette({
  open,
  leads,
  brands,
  onClose,
  onOpenLead,
  onOpenBrand,
  onNavigate,
  onQuickCall,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const normalized = query.trim().toLowerCase();
  const leadResults = useMemo(() => {
    if (!normalized) return leads.slice(0, 6);
    return leads.filter(lead => {
      const brand = brands.find(b => b.id === lead.brand_id);
      return [
        lead.name,
        lead.email,
        lead.phone,
        lead.funnel_stage,
        lead.brand_name,
        brand?.name,
      ].some(value => String(value || '').toLowerCase().includes(normalized));
    }).slice(0, 8);
  }, [brands, leads, normalized]);

  const brandResults = useMemo(() => {
    if (!normalized) return brands;
    return brands.filter(brand => brand.name.toLowerCase().includes(normalized)).slice(0, 5);
  }, [brands, normalized]);

  const actionResults = useMemo(() => {
    if (!normalized) return ACTIONS;
    return ACTIONS.filter(action => action.label.toLowerCase().includes(normalized));
  }, [normalized]);

  if (!open) return null;

  return (
    <div className="command-palette-overlay" onMouseDown={onClose}>
      <div className="command-palette" onMouseDown={event => event.stopPropagation()}>
        <div className="command-palette__search">
          <i className="fas fa-magnifying-glass" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') onClose();
            }}
            placeholder="Search leads, brands, actions..."
          />
          <button type="button" onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="command-palette__body">
          {leadResults.length > 0 && (
            <section>
              <h4>Leads</h4>
              {leadResults.map(lead => {
                const brand = brands.find(b => b.id === lead.brand_id);
                return (
                  <div key={lead.id} className="command-palette__row">
                    <button type="button" onClick={() => { onOpenLead(lead); onClose(); }}>
                      <span className="command-palette__avatar" style={{ background: `${brand?.color || '#8b5cf6'}22`, color: brand?.color || '#8b5cf6' }}>
                        {(lead.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <strong>{lead.name || 'Unnamed lead'}</strong>
                        <small>{brand?.name || lead.brand_name || lead.brand_id} | {lead.email || lead.phone || 'No contact'}</small>
                      </span>
                    </button>
                    {onQuickCall && lead.phone && (
                      <button type="button" className="command-palette__icon" onClick={() => { onQuickCall(lead); onClose(); }} title="Quick call">
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
              {brandResults.map(brand => (
                <button key={brand.id} type="button" className="command-palette__item" onClick={() => { onOpenBrand(brand); onClose(); }}>
                  <img src={brand.logo} alt="" />
                  <span>{brand.name}</span>
                </button>
              ))}
            </section>
          )}

          {actionResults.length > 0 && (
            <section>
              <h4>Actions</h4>
              {actionResults.map(action => (
                <button key={action.id} type="button" className="command-palette__item" onClick={() => { onNavigate(action.tab); onClose(); }}>
                  <i className={`fas ${action.icon}`} />
                  <span>{action.label}</span>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
