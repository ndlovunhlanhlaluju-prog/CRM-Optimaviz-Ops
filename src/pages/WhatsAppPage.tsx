import React from 'react';
import axios from 'axios';
import { Brand, Lead, WhatsAppLog, WhatsAppTemplate, MessageTemplate } from '../types';

interface WhatsAppPageProps {
  activeTab: 'whatsapp-tracking';
  leads: Lead[];
  selectedBrandForWhatsApp: Brand;
  setSelectedBrandForWhatsApp: (brand: Brand) => void;
  allWhatsAppMessages: WhatsAppLog[];
  fetchAllWhatsAppMessages: (brandId?: string) => Promise<void>;
  waContactSearch: string;
  setWaContactSearch: (val: string) => void;
  waPickerSearch: string;
  setWaPickerSearch: (val: string) => void;
  activeWhatsAppLead: Lead | null;
  setActiveWhatsAppLead: (lead: Lead | null) => void;
  getBrandIntegrationFor: (brandId: string) => any;
  isWhatsAppCloudConfigured: (integration: any, brandId: string) => boolean;
  whatsappNumbers: Record<string, string>;
  setWhatsappNumbers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSelectCommunications: () => void;
  managedBrands: Brand[];
  activeBrands: Brand[];
  setDirectWhatsAppOpen: (val: boolean) => void;
  directWhatsAppOpen: boolean;
  setWaDashboardMessage: (val: string) => void;
  waDashboardMessage: string;
  sendDirectWhatsApp: (brandId: string, toNumber: string, message: string, templateName?: string) => Promise<void>;
  showToast: (msg: string, isError?: boolean) => void;
  waContactPickerOpen: boolean;
  setWaContactPickerOpen: (val: boolean) => void;
  waPickerSelectedIds: Set<string>;
  setWaPickerSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  directWhatsAppNumber: string;
  setDirectWhatsAppNumber: (val: string) => void;
  directWhatsAppName: string;
  setDirectWhatsAppName: (val: string) => void;
  setSelectedBrand: (brand: Brand | null) => void;
  setSelectedLeadIds: (ids: Set<string>) => void;
  setBulkWhatsAppMessage: (msg: string) => void;
  setBulkWhatsAppProgress: (progress: any) => void;
  setBulkWhatsAppModalOpen: (open: boolean) => void;
  getFollowUpStatus: (lead: Lead) => any;
  countUniquePeopleForBrand: (leads: Lead[]) => number;
  saveWhatsAppNumbers: () => void;
  waSavingSettings: boolean;
  setWaSavingSettings: (val: boolean) => void;
  resetWhatsAppTemplateForm: () => void;
  getWhatsAppTemplatesForBrand: (brandId: string) => any[];
  startEditWhatsAppTemplate: (t: any) => void;
  deleteWhatsAppTemplate: (id: string) => void;
  waTemplateName: string;
  setWaTemplateName: (val: string) => void;
  waTemplateMessage: string;
  setWaTemplateMessage: (val: string) => void;
  saveWhatsAppTemplate: () => void;
  waTemplateEditingId: string;
  waTemplateSel: string;
  setWaTemplateSel: (val: string) => void;
  applyTemplateVars: (template: string, lead: Lead, brand: Brand | null) => string;
  fetchLeadsForEmailBrand: (brandId: string) => void;
  setActiveTab: (tab: string) => void;
  setIntegrationBrandId: (id: string) => void;
  setActiveIntegrationChannel: (channel: 'leads' | 'traffic' | 'email' | 'whatsapp' | 'call') => void;
}

export function WhatsAppPage(props: WhatsAppPageProps) {
  const {
    activeTab,
    leads,
    selectedBrandForWhatsApp,
    setSelectedBrandForWhatsApp,
    allWhatsAppMessages,
    fetchAllWhatsAppMessages,
    waContactSearch,
    setWaContactSearch,
    waPickerSearch,
    setWaPickerSearch,
    activeWhatsAppLead,
    setActiveWhatsAppLead,
    getBrandIntegrationFor,
    isWhatsAppCloudConfigured,
    whatsappNumbers,
    setWhatsappNumbers,
    handleSelectCommunications,
    managedBrands,
    activeBrands,
    setDirectWhatsAppOpen,
    directWhatsAppOpen,
    setWaDashboardMessage,
    waDashboardMessage,
    sendDirectWhatsApp,
    showToast,
    waContactPickerOpen,
    setWaContactPickerOpen,
    waPickerSelectedIds,
    setWaPickerSelectedIds,
    directWhatsAppNumber,
    setDirectWhatsAppNumber,
    directWhatsAppName,
    setDirectWhatsAppName,
    setSelectedBrand,
    setSelectedLeadIds,
    setBulkWhatsAppMessage,
    setBulkWhatsAppProgress,
    setBulkWhatsAppModalOpen,
    getFollowUpStatus,
    countUniquePeopleForBrand,
    saveWhatsAppNumbers,
    waSavingSettings,
    setWaSavingSettings,
    resetWhatsAppTemplateForm,
    getWhatsAppTemplatesForBrand,
    startEditWhatsAppTemplate,
    deleteWhatsAppTemplate,
    waTemplateName,
    setWaTemplateName,
    waTemplateMessage,
    setWaTemplateMessage,
    saveWhatsAppTemplate,
    waTemplateEditingId,
    waTemplateSel,
    setWaTemplateSel,
    applyTemplateVars,
    fetchLeadsForEmailBrand,
    setActiveTab,
    setIntegrationBrandId,
    setActiveIntegrationChannel,
  } = props;

  const BRANDS = activeBrands;

  if (activeTab === 'whatsapp-tracking') {
    const allBrandContacts = leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id);
    const brandContacts = allBrandContacts
      .filter(contact => allWhatsAppMessages.some(m => m.lead_id === contact.id))
      .filter(l => {
        const q = waContactSearch.trim().toLowerCase();
        return !q || [l.name, l.phone, l.email, l.funnel_stage].some(value => String(value || '').toLowerCase().includes(q));
      });
    const pickerContacts = allBrandContacts.filter(l => {
      const q = waPickerSearch.trim().toLowerCase();
      return !q || [l.name, l.phone, l.email, l.funnel_stage, l.custom_fields?.property_location].some(value => String(value || '').toLowerCase().includes(q));
    });
    const brandMessages = allWhatsAppMessages.filter(m => m.brand_id === selectedBrandForWhatsApp.id || leads.some(l => l.brand_id === selectedBrandForWhatsApp.id && l.id === m.lead_id));
    const activeMessages = activeWhatsAppLead
      ? allWhatsAppMessages.filter(m => m.lead_id === activeWhatsAppLead.id).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
      : [];
    const whatsappIntegration = getBrandIntegrationFor(selectedBrandForWhatsApp.id);
    const apiReady = isWhatsAppCloudConfigured(whatsappIntegration, selectedBrandForWhatsApp.id);
    const contactsWithPhone = allBrandContacts.filter(contact => contact.phone).length;

    const sendActiveWhatsApp = async () => {
      if (!activeWhatsAppLead || !waDashboardMessage.trim() || !activeWhatsAppLead.phone) return;
      try {
        const fromNum = whatsappNumbers[selectedBrandForWhatsApp.id] || '';
        const toNum = activeWhatsAppLead.phone.replace(/[^0-9+]/g, '');
        if (!apiReady) window.open(`https://wa.me/${toNum}?text=${encodeURIComponent(waDashboardMessage)}`, '_blank');
        await axios.post('/api/whatsapp/send', {
          lead_id: activeWhatsAppLead.id,
          brand_id: selectedBrandForWhatsApp.id,
          message: waDashboardMessage,
          from_number: fromNum,
          to_number: activeWhatsAppLead.phone,
          template_name: 'Manual',
          status: 'sent',
          log_only: !apiReady
        });
        await fetchAllWhatsAppMessages(selectedBrandForWhatsApp.id);
        setWaDashboardMessage('');
        showToast(apiReady ? 'WhatsApp sent in CRM.' : 'WhatsApp opened and logged.');
      } catch {
        showToast('Failed to send WhatsApp message.', true);
      }
    };

    return (
      <div className="wa-inbox-shell">
        <aside className="wa-inbox-sidebar">
          <div className="wa-inbox-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={handleSelectCommunications} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '6px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <i className="fas fa-arrow-left"></i>
              <span>Back</span>
            </button>
            <div>
              <h3>Chats</h3>
              <span>{selectedBrandForWhatsApp.name} WhatsApp history</span>
            </div>
            <button type="button" onClick={() => { setWaContactPickerOpen(true); setWaPickerSearch(''); setWaPickerSelectedIds(new Set()); }}>
              <i className="fas fa-plus"></i>
            </button>
          </div>
          <select
            className="wa-brand-select"
            value={selectedBrandForWhatsApp.id}
            onChange={e => {
              const brand = managedBrands.find(b => b.id === e.target.value) || activeBrands[0] || BRANDS[0];
              setSelectedBrandForWhatsApp(brand);
              setActiveWhatsAppLead(null);
              setDirectWhatsAppOpen(false);
              setWaDashboardMessage('');
              fetchAllWhatsAppMessages(brand.id);
            }}
          >
            {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="channel-readiness-strip channel-readiness-strip--whatsapp">
            <span><i className="fas fa-circle"></i>{apiReady ? 'Cloud API ready' : 'Manual WhatsApp'}</span>
            <strong>{contactsWithPhone}/{allBrandContacts.length} contacts have numbers</strong>
            <em>{whatsappIntegration.whatsapp_number || whatsappNumbers[selectedBrandForWhatsApp.id] || 'No brand WhatsApp number saved'}</em>
            <button
              type="button"
              onClick={() => {
                setActiveTab('integrations');
                setIntegrationBrandId(selectedBrandForWhatsApp.id);
                setActiveIntegrationChannel('whatsapp');
              }}
            >
              <i className="fas fa-sliders"></i>
              WhatsApp setup
            </button>
          </div>
          <div className="wa-inbox-search">
            <i className="fas fa-search"></i>
            <input value={waContactSearch} onChange={e => setWaContactSearch(e.target.value)} placeholder="Search chats" />
          </div>
          <div className="wa-filter-row">
            <span>Chats {brandContacts.length}</span>
            <span>{brandMessages.length} messages</span>
            <button type="button" onClick={() => { setWaContactPickerOpen(true); setWaPickerSearch(''); setWaPickerSelectedIds(new Set()); }} title="Open contacts">
              <i className="fas fa-address-book"></i>
            </button>
            <button type="button" onClick={() => { fetchAllWhatsAppMessages(selectedBrandForWhatsApp.id); fetchLeadsForEmailBrand(selectedBrandForWhatsApp.id); }}>
              <i className="fas fa-arrows-rotate"></i>
            </button>
          </div>
          <div className="wa-chat-list">
            <button type="button" className={`wa-chat-contact ${directWhatsAppOpen ? 'active' : ''}`} onClick={() => { setDirectWhatsAppOpen(true); setActiveWhatsAppLead(null); setDirectWhatsAppNumber(''); setDirectWhatsAppName(''); setWaDashboardMessage(''); }}>
              <span className="wa-contact-avatar standalone"><i className="fas fa-plus"></i></span>
              <span>
                <strong>New number</strong>
                <small>Send to a WhatsApp number</small>
              </span>
            </button>
            {brandContacts.map(contact => {
              const messages = allWhatsAppMessages.filter(m => m.lead_id === contact.id).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
              const latest = messages[0];
              return (
                <button
                  key={contact.id}
                  type="button"
                  className={`wa-chat-contact ${activeWhatsAppLead?.id === contact.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveWhatsAppLead(contact);
                    setDirectWhatsAppOpen(false);
                    setWaDashboardMessage('');
                  }}
                >
                  <span className="wa-contact-avatar">{(contact.name || '?').charAt(0)}</span>
                  <span>
                    <strong>{contact.name}</strong>
                    <small>{latest?.message || contact.phone || 'No phone number'}</small>
                  </span>
                  <time>{latest?.created_at ? new Date(latest.created_at).toLocaleDateString() : contact.funnel_stage}</time>
                </button>
              );
            })}
            {brandContacts.length === 0 && <p className="wa-empty-list">No WhatsApp chats yet. Click + or Contacts to start from brand contacts.</p>}
          </div>
        </aside>

        <section className="wa-conversation">
          <div className="wa-conversation-header">
            <div className="wa-contact-avatar">{directWhatsAppOpen ? '#' : activeWhatsAppLead ? activeWhatsAppLead.name.charAt(0) : selectedBrandForWhatsApp.name.charAt(0)}</div>
            <div>
              <h3>{directWhatsAppOpen ? 'New WhatsApp chat' : activeWhatsAppLead?.name || 'Select a contact'}</h3>
              <span>{directWhatsAppOpen ? selectedBrandForWhatsApp.name : activeWhatsAppLead?.phone || 'Contacts are filtered by selected brand'}</span>
            </div>
            <div className={`wa-api-pill ${apiReady ? 'ready' : ''}`}>
              <i className="fas fa-circle"></i>{apiReady ? 'API ready' : 'Manual mode'}
            </div>
          </div>

          <div className="wa-conversation-body">
            {directWhatsAppOpen ? (
              <div className="wa-direct-card">
                <input value={directWhatsAppNumber} onChange={e => setDirectWhatsAppNumber(e.target.value)} placeholder="WhatsApp number" />
                <input value={directWhatsAppName} onChange={e => setDirectWhatsAppName(e.target.value)} placeholder="Contact name optional" />
              </div>
            ) : activeWhatsAppLead ? (
              activeMessages.length > 0 ? activeMessages.map(message => (
                <article key={message.id} className={`wa-message ${message.direction === 'inbound' ? 'received' : 'sent'}`}>
                  <p>{message.message}</p>
                  <time>{message.created_at ? new Date(message.created_at).toLocaleString() : 'Logged'} - {message.status || 'sent'}</time>
                </article>
              )) : (
                <div className="wa-start-state">
                  <i className="fab fa-whatsapp"></i>
                  <strong>No messages with this contact yet</strong>
                  <span>Write below to start the conversation.</span>
                </div>
              )
            ) : (
              <div className="wa-start-state">
                <i className="fab fa-whatsapp"></i>
                <strong>Choose a contact</strong>
                <span>Use the chat list to open a brand contact or start a new number.</span>
              </div>
            )}
          </div>

          <div className="wa-message-composer">
            <textarea value={waDashboardMessage} onChange={e => setWaDashboardMessage(e.target.value)} placeholder={activeWhatsAppLead || directWhatsAppOpen ? 'Type a message' : 'Select a contact to message'} disabled={!activeWhatsAppLead && !directWhatsAppOpen} />
            <button
              type="button"
              disabled={!waDashboardMessage.trim() || (!activeWhatsAppLead && (!directWhatsAppOpen || !directWhatsAppNumber.trim()))}
              onClick={async () => {
                if (directWhatsAppOpen) {
                  if (!directWhatsAppNumber.trim()) { showToast('Add a WhatsApp number first.', true); return; }
                  await sendDirectWhatsApp(selectedBrandForWhatsApp.id, directWhatsAppNumber, waDashboardMessage, 'Direct WhatsApp');
                  setDirectWhatsAppOpen(false);
                  setDirectWhatsAppNumber('');
                  setDirectWhatsAppName('');
                  setWaDashboardMessage('');
                  showToast(apiReady ? 'WhatsApp sent in CRM.' : 'WhatsApp opened and logged.');
                } else {
                  await sendActiveWhatsApp();
                }
              }}
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        </section>

        {waContactPickerOpen && (
          <div className="wa-contact-picker-backdrop">
            <div className="wa-contact-picker">
              <div className="wa-contact-picker-head">
                <div>
                  <span>{selectedBrandForWhatsApp.name}</span>
                  <h3>Choose WhatsApp contacts</h3>
                </div>
                <button type="button" onClick={() => setWaContactPickerOpen(false)}>
                  <i className="fas fa-xmark"></i>
                </button>
              </div>
              <div className="wa-picker-search">
                <i className="fas fa-search"></i>
                <input value={waPickerSearch} onChange={e => setWaPickerSearch(e.target.value)} placeholder="Search contacts by name, phone, email, or location" />
              </div>
              <div className="wa-picker-actions">
                <button
                  type="button"
                  onClick={() => setWaPickerSelectedIds(new Set(pickerContacts.filter(l => l.phone).map(l => l.id)))}
                >
                  Select all with phone
                </button>
                <button type="button" onClick={() => setWaPickerSelectedIds(new Set())}>Clear</button>
                <strong>{waPickerSelectedIds.size} selected</strong>
              </div>
              <div className="wa-picker-list">
                {pickerContacts.map(contact => {
                  const checked = waPickerSelectedIds.has(contact.id);
                  const hasChat = allWhatsAppMessages.some(m => m.lead_id === contact.id);
                  return (
                    <label key={contact.id} className={`wa-picker-contact ${checked ? 'checked' : ''} ${!contact.phone ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!contact.phone}
                        onChange={e => setWaPickerSelectedIds(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(contact.id); else next.delete(contact.id);
                          return next;
                        })}
                      />
                      <span className="wa-contact-avatar">{(contact.name || '?').charAt(0)}</span>
                      <span>
                        <strong>{contact.name}</strong>
                        <small>{contact.phone || 'No WhatsApp number'}{contact.custom_fields?.property_location ? ` - ${contact.custom_fields.property_location}` : ''}</small>
                      </span>
                      {hasChat && <em>Has chat</em>}
                    </label>
                  );
                })}
                {pickerContacts.length === 0 && <p className="wa-empty-list">No matching contacts.</p>}
              </div>
              <div className="wa-picker-footer">
                <button type="button" className="btn btn-ghost" onClick={() => { setDirectWhatsAppOpen(true); setActiveWhatsAppLead(null); setWaContactPickerOpen(false); }}>
                  <i className="fas fa-hashtag"></i> New number
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={waPickerSelectedIds.size !== 1}
                  onClick={() => {
                    const contact = allBrandContacts.find(l => l.id === Array.from(waPickerSelectedIds)[0]);
                    if (!contact) return;
                    setActiveWhatsAppLead(contact);
                    setDirectWhatsAppOpen(false);
                    setWaDashboardMessage('');
                    setWaContactPickerOpen(false);
                  }}
                >
                  <i className="fab fa-whatsapp"></i> Open chat
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={waPickerSelectedIds.size === 0}
                  onClick={() => {
                    const ids = new Set(Array.from(waPickerSelectedIds).filter(id => allBrandContacts.find(l => l.id === id)?.phone));
                    if (ids.size === 0) {
                      showToast('Select contacts with WhatsApp numbers first.', true);
                      return;
                    }
                    setSelectedBrand(selectedBrandForWhatsApp);
                    setSelectedLeadIds(ids);
                    setBulkWhatsAppMessage('');
                    setBulkWhatsAppProgress(null);
                    setWaContactPickerOpen(false);
                    setBulkWhatsAppModalOpen(true);
                  }}
                >
                  <i className="fas fa-paper-plane"></i> Bulk message
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // legacy mode
  const integration = getBrandIntegrationFor(selectedBrandForWhatsApp.id);
  const apiReady = isWhatsAppCloudConfigured(integration, selectedBrandForWhatsApp.id);
  const brandLeads = leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id);
  const brandMessages = allWhatsAppMessages.filter(m => m.brand_id === selectedBrandForWhatsApp.id || brandLeads.some(l => l.id === m.lead_id));
  const missingPhones = brandLeads.filter(l => !l.phone).length;
  const due = brandLeads.filter(l => getFollowUpStatus(l).urgent).length;
  const contacted = brandLeads.filter(l => allWhatsAppMessages.some(m => m.lead_id === l.id)).length;

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fab fa-whatsapp" style={{ fontSize: '22px', color: '#25D366' }}></i>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>WhatsApp Business Centre</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>Compose, track, and manage WhatsApp outreach per brand</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: apiReady ? 'rgba(37,211,102,0.1)' : 'rgba(245,158,11,0.1)', border: apiReady ? '1px solid rgba(37,211,102,0.3)' : '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '6px 12px' }}>
            <i className="fas fa-circle" style={{ fontSize: '7px', color: apiReady ? '#25D366' : '#f59e0b' }}></i>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: apiReady ? '#25D366' : '#f59e0b' }}>
              {apiReady ? 'WhatsApp Business: API Ready' : 'WhatsApp Business: Manual Mode'}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setDirectWhatsAppOpen(true);
              setActiveWhatsAppLead(null);
              setDirectWhatsAppNumber('');
              setDirectWhatsAppName('');
              setWaDashboardMessage('');
              setWaTemplateSel('');
            }}
            style={{ background: '#25D366', border: 'none', color: '#fff', whiteSpace: 'nowrap' }}
          >
            <i className="fab fa-whatsapp"></i> New Chat
          </button>
          <select className="brand-aware-select" value={selectedBrandForWhatsApp.id} onChange={e => { const brand = managedBrands.find(b => b.id === e.target.value) || activeBrands[0] || BRANDS[0]; setSelectedBrandForWhatsApp(brand); setActiveWhatsAppLead(null); setDirectWhatsAppOpen(false); setDirectWhatsAppNumber(''); setDirectWhatsAppName(''); setWaDashboardMessage(''); setWaTemplateSel(''); fetchAllWhatsAppMessages(brand.id); }} style={{ padding: '8px 14px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>
            {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Stats row */}
      {!(directWhatsAppOpen || activeWhatsAppLead) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {[
              { label: 'Total Leads', value: countUniquePeopleForBrand(brandLeads), icon: 'fa-users', color: '#25D366' },
              { label: 'Messages Sent', value: brandMessages.length, icon: 'fa-comment-dots', color: '#155e75' },
              { label: 'Contacted', value: contacted, icon: 'fa-check-circle', color: '#10b981' },
              { label: 'Follow-Up Due', value: due, icon: 'fa-bell', color: due > 0 ? '#ef4444' : 'var(--text-muted)' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${stat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fas ${stat.icon}`} style={{ color: stat.color, fontSize: '16px' }}></i>
                </div>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginTop: '3px' }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
          {missingPhones > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '8px 14px', fontSize: '12.5px', color: '#d97706', fontWeight: 600 }}>
              <i className="fas fa-exclamation-triangle"></i> {missingPhones} lead{missingPhones !== 1 ? 's' : ''} missing phone numbers — they cannot receive WhatsApp messages.
            </div>
          )}
        </div>
      )}

      {/* Main 3-column layout */}
      <div className={directWhatsAppOpen || activeWhatsAppLead ? 'wa-layout wa-layout--compose' : 'wa-layout'} style={{ display: 'grid', gridTemplateColumns: directWhatsAppOpen || activeWhatsAppLead ? 'minmax(0, 1fr)' : '290px 1fr 330px', gap: '20px', alignItems: 'start' }}>
        {/* LEFT: Settings panel */}
        {!(directWhatsAppOpen || activeWhatsAppLead) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <i className="fas fa-phone-alt" style={{ color: '#25D366', fontSize: '13px' }}></i>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>Brand Number</span>
              </div>
              <input value={whatsappNumbers[selectedBrandForWhatsApp.id] || ''} onChange={e => setWhatsappNumbers(prev => ({ ...prev, [selectedBrandForWhatsApp.id]: e.target.value }))} placeholder="+27123456789" style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', marginBottom: '10px', fontSize: '13px' }} />
              <button className="btn btn-primary" onClick={saveWhatsAppNumbers} disabled={waSavingSettings} style={{ background: '#25D366', border: 'none', color: '#fff', width: '100%', fontSize: '12px' }}>
                <i className="fas fa-save"></i> {waSavingSettings ? 'Saving...' : 'Save Number'}
              </button>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <i className="fas fa-layer-group" style={{ color: '#25D366', fontSize: '12px' }}></i>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>Message Templates</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={resetWhatsAppTemplateForm} style={{ fontSize: '11px', padding: '4px 8px' }}>
                  <i className="fas fa-plus"></i> New
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '180px', overflowY: 'auto', marginBottom: '12px' }}>
                {getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).map(t => (
                  <div key={t.id} style={{ padding: '9px 11px', borderRadius: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                      <strong style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}>{t.name}</strong>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEditWhatsAppTemplate(t)} style={{ fontSize: '9.5px', padding: '3px 6px' }}>Edit</button>
                        {!String(t.id).startsWith('wa_') && <button className="btn btn-ghost btn-sm" onClick={() => deleteWhatsAppTemplate(t.id)} style={{ fontSize: '9.5px', padding: '3px 6px', color: '#ef4444' }}>Del</button>}
                      </div>
                    </div>
                    <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>{t.message.length > 60 ? t.message.substring(0, 60) + '…' : t.message}</p>
                  </div>
                ))}
                {getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).length === 0 && (
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No templates yet.</p>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <input value={waTemplateName} onChange={e => setWaTemplateName(e.target.value)} placeholder="Template name" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', marginBottom: '7px', fontSize: '12px' }} />
                <textarea rows={3} value={waTemplateMessage} onChange={e => setWaTemplateMessage(e.target.value)} placeholder="Message body…" style={{ width: '100%', resize: 'vertical', padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '12px' }} />
                <div style={{ display: 'flex', gap: '7px', marginTop: '8px' }}>
                  <button className="btn" onClick={saveWhatsAppTemplate} disabled={waSavingSettings} style={{ background: '#25D366', color: '#fff', border: 'none', flex: 1, fontSize: '12px' }}>{waTemplateEditingId ? 'Update' : 'Save Template'}</button>
                  <button className="btn btn-ghost" onClick={resetWhatsAppTemplateForm} style={{ fontSize: '12px' }}>Clear</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CENTRE: Contact list */}
        {!(directWhatsAppOpen || activeWhatsAppLead) && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-address-book" style={{ color: '#25D366' }}></i> Contacts
                <span style={{ fontSize: '11px', background: 'rgba(37,211,102,0.1)', color: '#25D366', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>
                  {leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id).length}
                </span>
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click to compose →</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto', paddingRight: '2px' }}>
              {leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id).map(l => {
                const isActive = activeWhatsAppLead?.id === l.id;
                const msgCount = allWhatsAppMessages.filter(m => m.lead_id === l.id).length;
                const reminder = getFollowUpStatus(l);
                const initials = (l.name || '?').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
                return (
                  <div
                    key={l.id}
                    className={`wa-contact-card${isActive ? ' active' : ''}`}
                    onClick={() => { setActiveWhatsAppLead(l); setDirectWhatsAppOpen(false); setDirectWhatsAppNumber(''); setDirectWhatsAppName(''); setWaDashboardMessage(`Hi ${(l.name || '').split(' ')[0]}, `); setWaTemplateSel(''); }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: isActive ? '#25D366' : 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? '#fff' : '#25D366', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', display: 'block' }}>{l.name}</strong>
                        {msgCount > 0 && (
                          <span style={{ fontSize: '10px', background: 'rgba(37,211,102,0.15)', color: '#25D366', padding: '1px 6px', borderRadius: '10px', fontWeight: 700, flexShrink: 0 }}>{msgCount} msg</span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: l.phone ? 'var(--text-secondary)' : '#ef4444', marginTop: '2px' }}>
                        {l.phone || <span><i className="fas fa-exclamation-circle"></i> No phone</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '5px', padding: '1px 6px', color: 'var(--text-muted)', fontWeight: 600 }}>{l.funnel_stage}</span>
                        {reminder.urgent && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}><i className="fas fa-bell"></i> Due</span>}
                      </div>
                    </div>
                    <i className="fas fa-chevron-right" style={{ color: isActive ? '#25D366' : 'var(--text-muted)', fontSize: '12px', flexShrink: 0 }}></i>
                  </div>
                );
              })}
              {leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id).length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                  <i className="fab fa-whatsapp" style={{ fontSize: '40px', opacity: 0.25, marginBottom: '12px', display: 'block' }}></i>
                  <p style={{ fontSize: '13px' }}>No leads for {selectedBrandForWhatsApp.name} yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RIGHT: Composer + Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={directWhatsAppOpen || activeWhatsAppLead ? 'wa-compose-card wa-compose-card--full' : 'wa-compose-card'} style={{ background: 'var(--bg-card)', border: activeWhatsAppLead || directWhatsAppOpen ? '1.5px solid rgba(37,211,102,0.35)' : '1px solid var(--border)', borderRadius: '16px', padding: directWhatsAppOpen || activeWhatsAppLead ? '0' : '20px', transition: 'all 0.2s', overflow: 'hidden' }}>
            {directWhatsAppOpen ? (
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  if (!directWhatsAppNumber.trim() || !waDashboardMessage.trim()) {
                    showToast('Phone number and message are required.', true);
                    return;
                  }
                  setWaSavingSettings(true);
                  try {
                    await sendDirectWhatsApp(selectedBrandForWhatsApp.id, directWhatsAppNumber, waDashboardMessage, waTemplateSel || 'Direct WhatsApp');
                    setDirectWhatsAppOpen(false);
                    setDirectWhatsAppNumber('');
                    setDirectWhatsAppName('');
                    setWaDashboardMessage('');
                    setWaTemplateSel('');
                    showToast(isWhatsAppCloudConfigured(getBrandIntegrationFor(selectedBrandForWhatsApp.id), selectedBrandForWhatsApp.id) ? 'WhatsApp sent in CRM.' : 'WhatsApp opened and message logged.');
                  } catch {
                    showToast('Failed to send WhatsApp message.', true);
                  } finally {
                    setWaSavingSettings(false);
                  }
                }}
              >
                <div className="wa-compose-header">
                  <div>
                    <span>New WhatsApp Chat</span>
                    <h4>{selectedBrandForWhatsApp.name} WhatsApp Desk</h4>
                  </div>
                  <div className="wa-compose-status">
                    <i className="fas fa-circle"></i>
                    {isWhatsAppCloudConfigured(getBrandIntegrationFor(selectedBrandForWhatsApp.id), selectedBrandForWhatsApp.id) ? 'API ready' : 'Manual mode'}
                  </div>
                </div>
                <div className="wa-compose-row">
                  <span>From</span>
                  <strong>{whatsappNumbers[selectedBrandForWhatsApp.id] || `${selectedBrandForWhatsApp.name} number not set`}</strong>
                  <small>{selectedBrandForWhatsApp.name}</small>
                </div>
                <div className="wa-direct-grid">
                  <input className="compose-clean-input" value={directWhatsAppNumber} onChange={e => setDirectWhatsAppNumber(e.target.value)} placeholder="WhatsApp number" />
                  <input className="compose-clean-input" value={directWhatsAppName} onChange={e => setDirectWhatsAppName(e.target.value)} placeholder="Contact name optional" />
                </div>
                <select className="compose-clean-select" value={waTemplateSel} onChange={e => { const id = e.target.value; setWaTemplateSel(id); if (id === 'custom') { setWaTemplateSel(''); return; } const t = getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).find(x => x.id === id); if (t) setWaDashboardMessage(applyTemplateVars(t.message, { id: 'direct-wa', brand_id: selectedBrandForWhatsApp.id, name: directWhatsAppName || directWhatsAppNumber || 'there', email: '', phone: directWhatsAppNumber, funnel_stage: 'Direct WhatsApp', tags: [], custom_fields: {}, created_at: new Date().toISOString() } as Lead, selectedBrandForWhatsApp)); }}>
                  <option value="custom">Custom message</option>
                  <option value="" disabled>Use a saved template</option>
                  {getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <textarea className="compose-clean-textarea wa-full-message" value={waDashboardMessage} onChange={e => setWaDashboardMessage(e.target.value)} placeholder="Write a WhatsApp message..." />
                <div className="wa-compose-footer">
                  <div>
                    <strong>Standalone WhatsApp chat</strong>
                    <span>Send to any number. It will be tracked at brand level.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => { setDirectWhatsAppOpen(false); setDirectWhatsAppNumber(''); setDirectWhatsAppName(''); setWaDashboardMessage(''); setWaTemplateSel(''); }}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={waSavingSettings || !directWhatsAppNumber.trim() || !waDashboardMessage.trim()} style={{ background: '#25D366', border: 'none' }}>
                      <i className="fab fa-whatsapp"></i> {waSavingSettings ? 'Sending...' : 'Send WhatsApp'}
                    </button>
                  </div>
                </div>
              </form>
            ) : activeWhatsAppLead ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25D366', fontWeight: 800, fontSize: '14px', flexShrink: 0 }}>
                    {(activeWhatsAppLead.name || '?').charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>To: {activeWhatsAppLead.name}</div>
                    <div style={{ fontSize: '11.5px', color: activeWhatsAppLead.phone ? '#25D366' : '#ef4444', fontWeight: 600 }}>
                      {activeWhatsAppLead.phone || 'No phone — cannot send'}
                    </div>
                  </div>
                  <button onClick={() => { setActiveWhatsAppLead(null); setWaDashboardMessage(''); setWaTemplateSel(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
                </div>
                <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Template</label>
                <select value={waTemplateSel} onChange={e => { const id = e.target.value; setWaTemplateSel(id); const t = getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).find(x => x.id === id); if (t) setWaDashboardMessage(applyTemplateVars(t.message, activeWhatsAppLead, selectedBrandForWhatsApp)); }} style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', marginBottom: '12px', fontSize: '12.5px' }}>
                  <option value="">Write custom message…</option>
                  {getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="wa-chat-thread">
                  {allWhatsAppMessages.filter(m => m.lead_id === activeWhatsAppLead.id).length > 0 ? (
                    allWhatsAppMessages.filter(m => m.lead_id === activeWhatsAppLead.id).slice(0, 6).map(m => (
                      <div key={m.id} className={`wa-chat-bubble ${m.direction === 'inbound' ? 'received' : 'sent'}`}>
                        <p>{m.message}</p>
                        <span>{m.created_at ? new Date(m.created_at).toLocaleString() : 'Logged'} | {m.status || 'sent'}</span>
                      </div>
                    ))
                  ) : (
                    <div className="wa-chat-empty">
                      <i className="fab fa-whatsapp"></i>
                      <span>No WhatsApp messages logged for this lead yet.</span>
                    </div>
                  )}
                </div>
                <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</label>
                <textarea value={waDashboardMessage} onChange={e => setWaDashboardMessage(e.target.value)} rows={6} placeholder="Write your WhatsApp message…" style={{ width: '100%', resize: 'vertical', padding: '11px', borderRadius: '11px', border: '1.5px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: '12px', fontSize: '13px' }} />
                <div className="wa-compose-actions">
                  <button
                    className="wa-log-btn"
                    disabled={!waDashboardMessage.trim() || !activeWhatsAppLead.phone}
                    onClick={async () => {
                      try {
                        const fromNum = whatsappNumbers[selectedBrandForWhatsApp.id] || '';
                        await axios.post('/api/whatsapp/send', { lead_id: activeWhatsAppLead.id, brand_id: selectedBrandForWhatsApp.id, message: waDashboardMessage, from_number: fromNum, to_number: activeWhatsAppLead.phone, template_name: waTemplateSel || 'Manual', status: 'sent', log_only: true });
                        fetchAllWhatsAppMessages(selectedBrandForWhatsApp.id);
                        setWaDashboardMessage('');
                        setWaTemplateSel('');
                        setActiveWhatsAppLead(null);
                        showToast('Message logged in dashboard.');
                      } catch { showToast('Failed to log WhatsApp message.', true); }
                    }}
                  >
                    <i className="fas fa-comment-medical"></i>
                    Log in dashboard
                  </button>
                  <button
                    className="wa-open-btn"
                    disabled={!waDashboardMessage.trim() || !activeWhatsAppLead.phone}
                    onClick={async () => {
                      try {
                        const fromNum = whatsappNumbers[selectedBrandForWhatsApp.id] || '';
                        const integration = getBrandIntegrationFor(selectedBrandForWhatsApp.id);
                        const apiReady = isWhatsAppCloudConfigured(integration, selectedBrandForWhatsApp.id);
                        const toNum = activeWhatsAppLead.phone!.replace(/[^0-9+]/g, '');
                        const encodedMsg = encodeURIComponent(waDashboardMessage);
                        if (!apiReady) window.open(`https://wa.me/${toNum}?text=${encodedMsg}`, '_blank');
                        await axios.post('/api/whatsapp/send', { lead_id: activeWhatsAppLead.id, brand_id: selectedBrandForWhatsApp.id, message: waDashboardMessage, from_number: fromNum, to_number: activeWhatsAppLead.phone, template_name: waTemplateSel || 'Manual', status: 'sent', log_only: !apiReady });
                        fetchAllWhatsAppMessages(selectedBrandForWhatsApp.id);
                        setWaDashboardMessage('');
                        setWaTemplateSel('');
                        setActiveWhatsAppLead(null);
                        showToast(apiReady ? 'WhatsApp sent in CRM.' : 'WhatsApp opened and message logged.');
                      } catch { showToast('Failed to log WhatsApp message.', true); }
                    }}
                  >
                    <i className="fab fa-whatsapp"></i>
                    {isWhatsAppCloudConfigured(getBrandIntegrationFor(selectedBrandForWhatsApp.id), selectedBrandForWhatsApp.id) ? 'Send in CRM' : 'Open WhatsApp'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 20px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <i className="fab fa-whatsapp" style={{ fontSize: '24px', color: '#25D366' }}></i>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>Select a Contact</p>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Click any contact to open the composer.</p>
              </div>
            )}
          </div>
          {!(directWhatsAppOpen || activeWhatsAppLead) && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-history" style={{ color: '#25D366', fontSize: '11px' }}></i> Recent Activity
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {allWhatsAppMessages
                  .filter(m => leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id).some(l => l.id === m.lead_id))
                  .slice(0, 10)
                  .map(m => {
                    const lead = leads.find(l => l.id === m.lead_id);
                    return (
                      <div key={m.id} style={{ padding: '9px 11px', borderRadius: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                          <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{lead?.name || 'Unknown'}</strong>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '9.5px', background: 'rgba(37,211,102,0.12)', color: '#25D366', padding: '1px 7px', borderRadius: '10px', fontWeight: 800 }}>{m.status || 'sent'}</span>
                            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{m.message.length > 80 ? m.message.substring(0, 80) + '…' : m.message}</p>
                      </div>
                    );
                  })}
                {allWhatsAppMessages.filter(m => leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id).some(l => l.id === m.lead_id)).length === 0 && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No messages logged yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
