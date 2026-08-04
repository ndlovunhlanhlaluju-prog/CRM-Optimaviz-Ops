import React from 'react';
import { BRANDS } from '../config/crmConfig';
import { Brand, Lead, BrandIntegration, EmailConnection, LeadSource, LeadSourceLog, WebsiteAnalyticsSite, WebsiteAnalyticsSummary, MessageTemplate, User } from '../types';

interface IntegrationsPageProps {
  activeBrands: Brand[];
  integrationBrandId: string;
  setIntegrationBrandId: (id: string) => void;
  integrationForm: BrandIntegration;
  setIntegrationForm: React.Dispatch<React.SetStateAction<BrandIntegration>>;
  activeIntegrationChannel: 'email' | 'whatsapp' | 'call' | 'leads' | 'traffic';
  setActiveIntegrationChannel: (channel: 'email' | 'whatsapp' | 'call' | 'leads' | 'traffic') => void;
  leadSourceForm: {
    name: string;
    provider: string;
    default_stage: string;
    duplicate_strategy: string;
    unmapped_field_strategy: string;
  };
  setLeadSourceForm: React.Dispatch<React.SetStateAction<{
    name: string;
    provider: string;
    default_stage: string;
    duplicate_strategy: string;
    unmapped_field_strategy: string;
  }>>;
  leadSources: LeadSource[];
  leadSourceLogs: LeadSourceLog[];
  leadSourceSaving: boolean;
  messageTemplates: MessageTemplate[];
  templateForm: { id?: string; brand_id: string; channel: 'email' | 'whatsapp' | 'call'; name: string; subject: string; body: string };
  setTemplateForm: React.Dispatch<React.SetStateAction<{ id?: string; brand_id: string; channel: 'email' | 'whatsapp' | 'call'; name: string; subject: string; body: string }>>;
  templateSaving: boolean;
  integrationSaving: boolean;
  integrationChecking: boolean;
  integrationStatus: any;
  user: User | null;
  gmailStatus: any;
  outlookStatus: any;
  gmailConnecting: boolean;
  gmailTesting: boolean;
  gmailTestRecipient: string;
  setGmailTestRecipient: (value: string) => void;
  customMailboxOpen: boolean;
  setCustomMailboxOpen: React.Dispatch<React.SetStateAction<boolean>>;
  customMailboxForm: {
    provider_preset: string;
    provider_email: string;
    display_name: string;
    smtp_host: string;
    smtp_port: string;
    smtp_secure: boolean;
    smtp_username: string;
    smtp_password: string;
    imap_host: string;
    imap_port: string;
    imap_secure: boolean;
    imap_username: string;
  };
  setCustomMailboxForm: React.Dispatch<React.SetStateAction<{
    provider_preset: string;
    provider_email: string;
    display_name: string;
    smtp_host: string;
    smtp_port: string;
    smtp_secure: boolean;
    smtp_username: string;
    smtp_password: string;
    imap_host: string;
    imap_port: string;
    imap_secure: boolean;
    imap_username: string;
  }>>;
  customMailboxSaving: boolean;
  emailConnections: EmailConnection[];
  whatsappConnecting: boolean;
  whatsappDisconnectConfirm: boolean;
  setWhatsAppDisconnectConfirm: (value: boolean) => void;
  websiteAnalyticsForm: { name: string; domain: string };
  setWebsiteAnalyticsForm: React.Dispatch<React.SetStateAction<{ name: string; domain: string }>>;
  websiteAnalyticsSaving: boolean;
  websiteAnalyticsSites: WebsiteAnalyticsSite[];
  websiteAnalyticsSummary: WebsiteAnalyticsSummary | null;
  createLeadSource: () => void;
  rotateLeadSourceKey: (sourceId: string) => void;
  updateLeadSource: (sourceId: string, patch: Partial<LeadSource>) => void;
  deleteLeadSource: (sourceId: string) => void;
  createWebsiteAnalyticsSite: () => void;
  fetchWebsiteAnalytics: (brandId?: string, siteId?: string) => void;
  updateWebsiteAnalyticsSite: (siteId: string, patch: Partial<WebsiteAnalyticsSite>) => void;
  deleteWebsiteAnalyticsSite: (siteId: string) => void;
  saveBrandIntegration: () => void;
  checkBrandIntegrationStatus: () => void;
  startGmailConnection: () => void;
  disconnectGmail: () => void;
  sendGmailTestEmail: () => void;
  startOutlookConnection: () => void;
  sendSmtpProviderTestEmail: () => void;
  saveCustomMailboxConnection: () => void;
  applyCustomMailboxPreset: (preset: string, email?: string) => void;
  applyEmailProviderPreset: (provider: string) => void;
  disconnectEmailConnection: (connection: EmailConnection) => void;
  setDefaultEmailConnection: (connectionId: string) => void;
  sendDefaultMailboxTestEmail: () => void;
  addEmailAccountToIntegration: () => void;
  updateEmailAccountInIntegration: (accountId: string, patch: Record<string, any>) => void;
  removeEmailAccountFromIntegration: (accountId: string) => void;
  startWhatsAppEmbeddedSignup: () => void;
  disconnectWhatsAppEmbeddedSignup: () => void;
  resetTemplateForm: () => void;
  saveMessageTemplate: () => void;
  startEditMessageTemplate: (template: MessageTemplate) => void;
  deleteMessageTemplate: (templateId: string) => void;
  showToast: (text: string, isError?: boolean) => void;
  getEmailAccountsForIntegration: (integration: BrandIntegration) => any[];
}

export default function IntegrationsPage(props: IntegrationsPageProps) {
  const {
    activeBrands,
    integrationBrandId,
    setIntegrationBrandId,
    integrationForm,
    setIntegrationForm,
    activeIntegrationChannel,
    setActiveIntegrationChannel,
    leadSourceForm,
    setLeadSourceForm,
    leadSources,
    leadSourceLogs,
    leadSourceSaving,
    messageTemplates,
    templateForm,
    setTemplateForm,
    templateSaving,
    integrationSaving,
    integrationChecking,
    integrationStatus,
    user,
    gmailStatus,
    outlookStatus,
    gmailConnecting,
    gmailTesting,
    gmailTestRecipient,
    setGmailTestRecipient,
    customMailboxOpen,
    setCustomMailboxOpen,
    customMailboxForm,
    setCustomMailboxForm,
    customMailboxSaving,
    emailConnections,
    whatsappConnecting,
    whatsappDisconnectConfirm,
    setWhatsAppDisconnectConfirm,
    websiteAnalyticsForm,
    setWebsiteAnalyticsForm,
    websiteAnalyticsSaving,
    websiteAnalyticsSites,
    websiteAnalyticsSummary,
    createLeadSource,
    rotateLeadSourceKey,
    updateLeadSource,
    deleteLeadSource,
    createWebsiteAnalyticsSite,
    fetchWebsiteAnalytics,
    updateWebsiteAnalyticsSite,
    deleteWebsiteAnalyticsSite,
    saveBrandIntegration,
    checkBrandIntegrationStatus,
    startGmailConnection,
    disconnectGmail,
    sendGmailTestEmail,
    startOutlookConnection,
    sendSmtpProviderTestEmail,
    saveCustomMailboxConnection,
    applyCustomMailboxPreset,
    applyEmailProviderPreset,
    disconnectEmailConnection,
    setDefaultEmailConnection,
    sendDefaultMailboxTestEmail,
    addEmailAccountToIntegration,
    updateEmailAccountInIntegration,
    removeEmailAccountFromIntegration,
    startWhatsAppEmbeddedSignup,
    disconnectWhatsAppEmbeddedSignup,
    resetTemplateForm,
    saveMessageTemplate,
    startEditMessageTemplate,
    deleteMessageTemplate,
    showToast,
    getEmailAccountsForIntegration,
  } = props;

  const selectedIntegrationBrand = activeBrands.find(b => b.id === integrationBrandId) || BRANDS[0];
  const integrationChannelOptions: Array<{ id: 'leads' | 'traffic' | 'email' | 'whatsapp' | 'call'; title: string; summary: string; icon: string; tone: string }> = [
    { id: 'leads', title: 'Lead Sources', summary: 'Capture leads from website forms, API integrations, Facebook, and LinkedIn.', icon: 'fa-users-rectangle', tone: '#155e75' },
    { id: 'traffic', title: 'Traffic Analytics', summary: 'Monitor website visits, traffic sources, visitor locations, and conversion metrics.', icon: 'fa-chart-line', tone: '#16a34a' },
    { id: 'email', title: 'Email', summary: 'Connect Gmail, Outlook, Yahoo, or custom SMTP for seamless email management.', icon: 'fa-envelope-open-text', tone: '#155e75' },
    { id: 'whatsapp', title: 'WhatsApp', summary: 'Enable WhatsApp messaging with manual logging or Cloud API integration.', icon: 'fa-message', tone: '#25D366' },
    { id: 'call', title: 'Calling', summary: 'Log calls manually with click-to-call, or enable browser-based calling.', icon: 'fa-phone-volume', tone: '#0f766e' },
  ];
  const activeIntegrationOption = integrationChannelOptions.find(option => option.id === activeIntegrationChannel) || integrationChannelOptions[0];
  const templateChannel = activeIntegrationChannel === 'whatsapp' || activeIntegrationChannel === 'call' ? activeIntegrationChannel : 'email';
  const brandTemplates = messageTemplates.filter(t => t.brand_id === integrationBrandId && t.channel === templateChannel);
  const emailAccounts = getEmailAccountsForIntegration(integrationForm).filter(account => account.id !== 'primary');
  const currentBrandEmailConnections = emailConnections.filter(connection => connection.brand_id === integrationBrandId);

  return (
    <div className="integration-workspace-redesign">
      {user?.role === 'admin' && <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <img src={selectedIntegrationBrand.logo} alt={selectedIntegrationBrand.name} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-primary)' }}>{selectedIntegrationBrand.name} {activeIntegrationOption.title} Setup</h3>
            <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>Configure one channel at a time. Other channels remain available when you're ready.</p>
          </div>
        </div>
        <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Brand</label>
        <select className="brand-aware-select" value={integrationBrandId} onChange={e => setIntegrationBrandId(e.target.value)} style={{ width: '100%', margin: '6px 0 16px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '8px', marginBottom: '16px' }}>
          {integrationChannelOptions.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setActiveIntegrationChannel(option.id);
                if (!['leads', 'traffic'].includes(option.id)) setTemplateForm(prev => ({ ...prev, channel: option.id as 'email' | 'whatsapp' | 'call' }));
              }}
              style={{
                textAlign: 'left',
                padding: '12px',
                borderRadius: '10px',
                border: activeIntegrationChannel === option.id ? `1.5px solid ${option.tone}` : '1px solid var(--border)',
                background: activeIntegrationChannel === option.id ? `${option.tone}14` : 'var(--bg-base)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                minHeight: '104px'
              }}
            >
              <i className={`fas ${option.icon}`} style={{ color: option.tone, marginBottom: '10px' }}></i>
              <strong style={{ display: 'block', fontSize: '12.5px', marginBottom: '4px' }}>{option.title}</strong>
              <span style={{ display: 'block', fontSize: '11.2px', color: 'var(--text-muted)', lineHeight: 1.35 }}>{option.summary}</span>
            </button>
          ))}
        </div>
        {activeIntegrationChannel === 'leads' && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', padding: '14px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Source type</span>
                <select value={leadSourceForm.provider} onChange={e => setLeadSourceForm(prev => ({ ...prev, provider: e.target.value }))} style={{ width: '100%' }}>
                  <option value="website">Website form</option>
                  <option value="api">Manual/API import</option>
                  <option value="webhook">Webhook / Zapier-style</option>
                  <option value="facebook">Facebook Lead Ads</option>
                  <option value="linkedin">LinkedIn Lead Gen</option>
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Name</span>
                <input value={leadSourceForm.name} onChange={e => setLeadSourceForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Website contact form" style={{ width: '100%' }} />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Default stage</span>
                <input value={leadSourceForm.default_stage} onChange={e => setLeadSourceForm(prev => ({ ...prev, default_stage: e.target.value }))} placeholder="New Lead" style={{ width: '100%' }} />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Duplicates</span>
                <select value={leadSourceForm.duplicate_strategy} onChange={e => setLeadSourceForm(prev => ({ ...prev, duplicate_strategy: e.target.value }))} style={{ width: '100%' }}>
                  <option value="update_existing">Update existing lead</option>
                  <option value="skip">Skip duplicate</option>
                  <option value="create_new">Always create new</option>
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Unmapped fields</span>
                <select value={leadSourceForm.unmapped_field_strategy || 'auto'} onChange={e => setLeadSourceForm(prev => ({ ...prev, unmapped_field_strategy: e.target.value }))} style={{ width: '100%' }}>
                  <option value="auto">Keep safely as source fields</option>
                  <option value="ignore">Ignore unless mapped</option>
                </select>
              </label>
              <button type="button" className="btn btn-primary" onClick={createLeadSource} disabled={leadSourceSaving} style={{ alignSelf: 'end', minHeight: '42px' }}>
                <i className="fas fa-plus"></i> {leadSourceSaving ? 'Creating...' : 'Create source'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {leadSources.length === 0 && (
                <div style={{ padding: '22px', border: '1px dashed var(--border)', borderRadius: '14px', color: 'var(--text-muted)', background: 'var(--bg-base)' }}>
                  No lead sources configured yet. Create a website or API source to start capturing leads. Facebook and LinkedIn integrations will be available once OAuth is configured.
                </div>
              )}
              {leadSources.map(source => {
                const recentLogs = leadSourceLogs.filter(log => log.source_id === source.id).slice(0, 3);
                const mappingRows = [
                  ['name', 'Name'],
                  ['email', 'Email'],
                  ['phone', 'Phone'],
                  ['message', 'Message / Notes'],
                  ['service_category', 'Service category'],
                  ['city', 'City'],
                  ['state', 'State'],
                  ['abn_number', 'ABN Number'],
                  ['provider_status', 'Provider status'],
                  ['campaign', 'Campaign'],
                  ['page_url', 'Page URL'],
                ];
                const destinationOptions = [
                  ['ignore', 'Ignore'],
                  ['name', 'Lead name'],
                  ['email', 'Email'],
                  ['phone', 'Phone'],
                  ['notes', 'Notes'],
                  ['funnel_stage', 'Pipeline stage'],
                  ['custom_fields.segment', 'Segment'],
                  ['custom_fields.service_category', 'Service Category'],
                  ['custom_fields.city', 'City'],
                  ['custom_fields.state', 'State'],
                  ['custom_fields.abn_number', 'ABN Number'],
                  ['custom_fields.provider_status', 'Provider Status'],
                  ['custom_fields.campaign', 'Campaign'],
                  ['custom_fields.page_url', 'Page URL'],
                ];
                const embedCode = `<script>
const crmSignupSessionId = localStorage.getItem("crm_signup_session_id") || (window.crypto?.randomUUID?.() || "signup_" + Date.now() + "_" + Math.random().toString(36).slice(2));
localStorage.setItem("crm_signup_session_id", crmSignupSessionId);

async function sendLeadToCrm(data, captureStatus = "completed") {
  await fetch("${source.webhook_url}", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-lead-source-key": "${source.secret_key || ''}" },
    body: JSON.stringify({
      ...data,
      session_id: crmSignupSessionId,
      capture_status: captureStatus,
      page_url: window.location.href
    })
  });
}

// Send this after email/phone or each signup step, debounced.
function saveSignupProgress(data) {
  return sendLeadToCrm(data, "partial");
}
</script>`;
                return (
                  <article key={source.id} style={{ border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--bg-base)', padding: '14px', display: 'grid', gap: '12px', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ color: activeIntegrationOption.tone, fontSize: '10px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' }}>{source.provider}</span>
                        <h4 style={{ margin: '4px 0 2px', color: 'var(--text-primary)' }}>{source.name}</h4>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>{source.leads_imported || 0} imported - {source.last_sync_at ? `Last ${new Date(source.last_sync_at).toLocaleDateString()}` : 'No leads yet'}</p>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateLeadSource(source.id, { status: source.status === 'active' ? 'paused' : 'active' })}>
                        <i className={`fas ${source.status === 'active' ? 'fa-pause' : 'fa-play'}`}></i> {source.status === 'active' ? 'Pause' : 'Activate'}
                      </button>
                    </div>
                    {(source.provider === 'facebook' || source.provider === 'linkedin') && source.status === 'needs_setup' ? (
                      <div style={{ padding: '10px', borderRadius: '12px', border: '1px solid rgba(245,158,11,.28)', background: 'rgba(245,158,11,.08)', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.45 }}>
                        {source.provider === 'facebook'
                          ? 'Facebook Lead Ads requires Meta OAuth, webhook verification, and app review before live syncing.'
                          : 'LinkedIn Lead Gen requires LinkedIn developer access and lead retrieval permissions before live syncing.'}
                      </div>
                    ) : (
                      <>
                        <label>
                          <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Webhook URL</span>
                          <input readOnly value={source.webhook_url || ''} onFocus={e => e.currentTarget.select()} style={{ width: '100%', fontSize: '11px' }} />
                        </label>
                        <label>
                          <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Secure key</span>
                          <input readOnly value={source.secret_key || ''} onFocus={e => e.currentTarget.select()} style={{ width: '100%', fontSize: '11px' }} />
                        </label>
                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 850, color: 'var(--accent)' }}>Embed script</summary>
                          <textarea readOnly value={embedCode} rows={7} onFocus={e => e.currentTarget.select()} style={{ width: '100%', marginTop: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                        </details>
                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 850, color: 'var(--accent)' }}>Field mapping</summary>
                          <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                            <label>
                              <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Unmapped signup fields</span>
                              <select
                                value={source.unmapped_field_strategy || 'auto'}
                                onChange={e => updateLeadSource(source.id, { unmapped_field_strategy: e.target.value })}
                                style={{ width: '100%' }}
                              >
                                <option value="auto">Keep safely as prefixed source fields</option>
                                <option value="ignore">Ignore unless listed below</option>
                              </select>
                            </label>
                            {mappingRows.map(([from, label]) => (
                              <div key={from} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, .75fr) minmax(130px, 1fr)', gap: '8px', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800 }}>{label}</span>
                                <select
                                  value={(source.field_mappings || {})[from] || ''}
                                  onChange={e => updateLeadSource(source.id, { field_mappings: { ...(source.field_mappings || {}), [from]: e.target.value } })}
                                  style={{ width: '100%', fontSize: '12px' }}
                                >
                                  <option value="">Default</option>
                                  {destinationOptions.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                                </select>
                              </div>
                            ))}
                          </div>
                        </details>
                      </>
                    )}
                    {source.last_error && <p style={{ margin: 0, color: '#dc2626', fontSize: '12px' }}>{source.last_error}</p>}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(`${source.webhook_url}\nKey: ${source.secret_key || ''}`).then(() => showToast('Lead source details copied.'))}>
                        <i className="fas fa-copy"></i> Copy
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => rotateLeadSourceKey(source.id)}>
                        <i className="fas fa-key"></i> Rotate key
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteLeadSource(source.id)} style={{ color: '#dc2626' }}>
                        <i className="fas fa-trash"></i> Remove
                      </button>
                    </div>
                    {recentLogs.length > 0 && (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {recentLogs.map(log => (
                          <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                            <span>{log.status.replace(/_/g, ' ')}</span>
                            <span>{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}
        {activeIntegrationChannel === 'traffic' && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ border: '1px solid rgba(22,163,74,.22)', borderRadius: '16px', background: 'rgba(22,163,74,.06)', padding: '16px', display: 'grid', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Set up website traffic tracking</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.45 }}>Create a tracking script, add it to your website, then visits will appear on the main dashboard after the first page view.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                {[
                  ['1', 'Create tracker', 'Name the website and optional domain.'],
                  ['2', 'Copy script', 'Paste the script before the closing body tag.'],
                  ['3', 'Watch dashboard', 'Traffic, countries, sources, and pages update automatically.'],
                ].map(([step, title, copy]) => (
                  <div key={step} style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <span style={{ display: 'inline-grid', placeItems: 'center', width: '24px', height: '24px', borderRadius: '999px', background: '#16a34a', color: '#fff', fontSize: '11px', fontWeight: 900 }}>{step}</span>
                    <strong style={{ display: 'block', marginTop: '8px', color: 'var(--text-primary)', fontSize: '12.5px' }}>{title}</strong>
                    <span style={{ display: 'block', marginTop: '3px', color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: 1.35 }}>{copy}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', padding: '14px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Website name</span>
                <input value={websiteAnalyticsForm.name} onChange={e => setWebsiteAnalyticsForm(prev => ({ ...prev, name: e.target.value }))} placeholder={`${selectedIntegrationBrand.name} website`} style={{ width: '100%' }} />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Domain</span>
                <input value={websiteAnalyticsForm.domain} onChange={e => setWebsiteAnalyticsForm(prev => ({ ...prev, domain: e.target.value }))} placeholder="example.com" style={{ width: '100%' }} />
              </label>
              <button type="button" className="btn btn-primary" onClick={createWebsiteAnalyticsSite} disabled={websiteAnalyticsSaving} style={{ alignSelf: 'end', minHeight: '42px', background: '#16a34a', border: 'none' }}>
                <i className="fas fa-plus"></i> {websiteAnalyticsSaving ? 'Creating...' : 'Create tracking script'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => fetchWebsiteAnalytics(integrationBrandId)} style={{ alignSelf: 'end', minHeight: '42px' }}>
                <i className="fas fa-rotate"></i> Refresh traffic
              </button>
            </div>

            {websiteAnalyticsSites.length === 0 && (
              <div style={{ padding: '22px', border: '1px dashed var(--border)', borderRadius: '14px', color: 'var(--text-muted)', background: 'var(--bg-base)' }}>
                No tracking scripts configured for this brand. Create a tracking script above and add it to your website to begin monitoring traffic.
              </div>
            )}

            {websiteAnalyticsSites.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {websiteAnalyticsSites.map(site => {
                  const script = `<script async src="${site.script_url}"></script>`;
                  const siteSummary = websiteAnalyticsSummary;
                  return (
                    <article key={site.id} style={{ border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--bg-base)', padding: '14px', display: 'grid', gap: '12px', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ color: '#16a34a', fontSize: '10px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' }}>{site.status}</span>
                          <h4 style={{ margin: '4px 0 2px', color: 'var(--text-primary)' }}>{site.name}</h4>
                          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>{site.domain || 'Any domain'} - {site.last_seen_at ? `Last visit ${new Date(site.last_seen_at).toLocaleString()}` : 'Waiting for first visit'}</p>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateWebsiteAnalyticsSite(site.id, { status: site.status === 'active' ? 'paused' : 'active' })}>
                          <i className={`fas ${site.status === 'active' ? 'fa-pause' : 'fa-play'}`}></i> {site.status === 'active' ? 'Pause' : 'Activate'}
                        </button>
                      </div>
                      <label>
                        <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Tracking script</span>
                        <textarea readOnly value={script} rows={3} onFocus={e => e.currentTarget.select()} style={{ width: '100%', fontSize: '11px', fontFamily: 'monospace', resize: 'vertical' }} />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                        <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 800 }}>Visits</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{siteSummary?.total_visits ?? 0}</strong>
                        </div>
                        <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 800 }}>Visitors</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{siteSummary?.unique_visitors ?? 0}</strong>
                        </div>
                        <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 800 }}>Leads</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{siteSummary?.conversions ?? 0}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(script).then(() => showToast('Tracking script copied.'))}>
                          <i className="fas fa-copy"></i> Copy script
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fetchWebsiteAnalytics(integrationBrandId, site.id)}>
                          <i className="fas fa-chart-line"></i> Check visits
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteWebsiteAnalyticsSite(site.id)} style={{ color: '#dc2626' }}>
                          <i className="fas fa-trash"></i> Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          {activeIntegrationChannel === 'email' && (
            <>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Email Provider</label>
            <select value={integrationForm.email_provider} onChange={e => applyEmailProviderPreset(e.target.value)} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <option value="internal">CRM outbox only</option>
              <option value="gmail">Gmail</option>
              <option value="outlook">Outlook</option>
              <option value="yahoo">Yahoo</option>
              <option value="smtp">SMTP</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Sender Name</label>
            <input value={integrationForm.email_sender_name || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, email_sender_name: e.target.value }))} placeholder={`${selectedIntegrationBrand.name} Team`} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
          </div>
          </>
          )}
          {activeIntegrationChannel === 'whatsapp' && (
            <>
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '14px', borderRadius: '12px', border: `1px solid ${(integrationStatus?.whatsapp?.connected || (integrationForm as any).whatsapp_connected) ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, background: (integrationStatus?.whatsapp?.connected || (integrationForm as any).whatsapp_connected) ? 'rgba(16,185,129,0.08)' : 'var(--bg-base)' }}>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '13px' }}>
                {(integrationStatus?.whatsapp?.connected || (integrationForm as any).whatsapp_connected) ? 'WhatsApp connected' : 'Connect your WhatsApp Business account'}
              </strong>
              <span style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.45 }}>
                {(integrationStatus?.whatsapp?.connected || (integrationForm as any).whatsapp_connected)
                  ? `${integrationStatus?.whatsapp?.verified_name || integrationForm.whatsapp_profile_name || selectedIntegrationBrand.name}${integrationStatus?.whatsapp?.display_number || integrationForm.whatsapp_number ? ` - ${integrationStatus?.whatsapp?.display_number || integrationForm.whatsapp_number}` : ''}`
                  : 'Sign in with Meta, choose the business and phone number, and return here ready to send.'}
              </span>
            </div>
            {(integrationStatus?.whatsapp?.connected || (integrationForm as any).whatsapp_connected) ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {whatsappDisconnectConfirm && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWhatsAppDisconnectConfirm(false)} disabled={whatsappConnecting}>Keep connected</button>}
                <button type="button" className={whatsappDisconnectConfirm ? 'btn btn-danger btn-sm' : 'btn btn-ghost btn-sm'} onClick={disconnectWhatsAppEmbeddedSignup} disabled={whatsappConnecting}>
                  <i className="fas fa-unlink"></i> {whatsappConnecting ? 'Disconnecting...' : whatsappDisconnectConfirm ? 'Confirm disconnect' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={startWhatsAppEmbeddedSignup} disabled={whatsappConnecting}>
                <i className="fab fa-whatsapp"></i> {whatsappConnecting ? 'Connecting...' : 'Connect WhatsApp'}
              </button>
            )}
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>WhatsApp Provider</label>
            <select value={integrationForm.whatsapp_provider || 'manual'} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_provider: e.target.value, whatsapp_access_token_env: prev.whatsapp_access_token_env || `WHATSAPP_${integrationBrandId.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_ACCESS_TOKEN`, whatsapp_verify_token: prev.whatsapp_verify_token || `verify_${integrationBrandId.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` }))} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <option value="manual">Manual / wa.me</option>
              <option value="cloud_api">WhatsApp Cloud API</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>WhatsApp Number</label>
            <input value={integrationForm.whatsapp_number || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_number: e.target.value }))} placeholder="+27123456789" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '80px minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '1px solid var(--border)', background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              {integrationForm.whatsapp_profile_picture_url
                ? <img src={integrationForm.whatsapp_profile_picture_url} alt="WhatsApp profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <i className="fab fa-whatsapp" style={{ color: '#25D366', fontSize: '26px' }}></i>}
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Business Display Name</label>
              <input value={integrationForm.whatsapp_profile_name || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_profile_name: e.target.value }))} placeholder={`${selectedIntegrationBrand.name}`} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Profile Photo URL</label>
              <input value={integrationForm.whatsapp_profile_picture_url || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_profile_picture_url: e.target.value }))} placeholder="https://..." style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
            </div>
            <div style={{ gridColumn: '2 / 4' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>About</label>
              <input value={integrationForm.whatsapp_profile_about || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_profile_about: e.target.value }))} placeholder="Professional property management and owner support." style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
            </div>
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Category</label>
              <input value={integrationForm.whatsapp_business_category || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_business_category: e.target.value }))} placeholder="Property Management" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Website</label>
              <input value={integrationForm.whatsapp_business_website || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_business_website: e.target.value }))} placeholder="https://..." style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
            </div>
            {/* TODO: Implement automatic WhatsApp Business Profile API sync when whatsapp_business_management permission is granted */}
            <p style={{ gridColumn: '1 / -1', margin: 0, color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: 1.45 }}>
              Saved now for WhatsApp Business profile management. When Cloud API permissions are connected, these fields can be pushed to Meta automatically.
            </p>
          </div>
          {integrationForm.whatsapp_provider === 'cloud_api' && (
            <>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Phone Number ID</label>
                <input value={integrationForm.whatsapp_phone_number_id || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_phone_number_id: e.target.value }))} placeholder="Meta phone number ID" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>WhatsApp Business Account ID</label>
                <input value={integrationForm.whatsapp_business_account_id || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_business_account_id: e.target.value }))} placeholder="WABA ID" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Access Token Env Name</label>
                <input value={integrationForm.whatsapp_access_token_env || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_access_token_env: e.target.value }))} placeholder={`WHATSAPP_${integrationBrandId.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_ACCESS_TOKEN`} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Webhook Verify Token</label>
                <input value={integrationForm.whatsapp_verify_token || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_verify_token: e.target.value }))} placeholder={`verify_${integrationBrandId}`} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
              </div>
              <div style={{ gridColumn: '1 / -1', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(37,211,102,0.25)', background: 'rgba(37,211,102,0.08)', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.45 }}>
                Webhook callback path: <strong style={{ color: 'var(--text-primary)' }}>/api/webhooks/whatsapp</strong>. Keep the real access token in the server .env, not inside this form.
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-primary)' }}>Backend setup check</strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Confirms the saved IDs and server token before you try sending.</span>
                  </div>
                  <button type="button" onClick={checkBrandIntegrationStatus} disabled={integrationChecking} className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap' }}>
                    <i className="fas fa-plug"></i> {integrationChecking ? 'Checking...' : 'Check Setup'}
                  </button>
                </div>
                {integrationStatus?.brand_id === integrationBrandId && (
                  <div style={{ padding: '9px 10px', borderRadius: '10px', background: integrationStatus.whatsapp?.api_ready ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: integrationStatus.whatsapp?.api_ready ? '1px solid rgba(16,185,129,0.28)' : '1px solid rgba(245,158,11,0.28)', color: integrationStatus.whatsapp?.api_ready ? '#10b981' : '#d97706', fontSize: '12px', fontWeight: 700, lineHeight: 1.45 }}>
                    {integrationStatus.whatsapp?.api_ready ? (
                      <>Ready. Backend found the phone ID, token variable, and webhook token.</>
                    ) : (
                      <>Needs: {(integrationStatus.whatsapp?.missing || []).join(', ') || 'Cloud API provider not selected'}.</>
                    )}
                    <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Callback URL: {integrationStatus.whatsapp?.webhook_callback_url || '/api/webhooks/whatsapp'}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
            </>
          )}
          {activeIntegrationChannel === 'call' && (
            <>
              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '2px' }}>
                <div style={{ padding: '12px', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '12px', background: (integrationForm.call_provider || 'manual') === 'manual' ? 'rgba(124,58,237,0.08)' : 'var(--bg-base)' }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '13px' }}>Manual click-to-call</strong>
                  <span style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.45 }}>
                    Works now. CRM opens the phone app with the lead number, then the agent saves outcome, duration, notes, and follow-up date.
                  </span>
                </div>
                <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: integrationForm.call_provider === 'twilio' ? 'rgba(124,58,237,0.08)' : 'var(--bg-base)' }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '13px' }}>Managed browser phone</strong>
                  <span style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.45 }}>
                    Owner-enabled. Turn this on only after the central voice provider is configured.
                  </span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Calling Mode</label>
                <select value={integrationForm.call_provider || 'manual'} onChange={e => setIntegrationForm(prev => ({ ...prev, call_provider: e.target.value }))} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <option value="manual">Open phone app and log result</option>
                  <option value="twilio">Managed browser phone</option>
                </select>
                <span style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: 1.45 }}>
                  Open phone app works immediately on mobile and desktop devices with calling apps. Managed browser phone should be enabled only after the central voice provider is ready.
                </span>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Public Calling Number</label>
                <input value={integrationForm.call_number || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, call_number: e.target.value }))} placeholder="+27123456789" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
              </div>
            </>
          )}
        </div>
        {activeIntegrationChannel === 'email' && (
            <div className="email-connection-guide">
              <div className="email-connection-guide__header">
                <div>
                  <span>Connected mailboxes</span>
                  <strong>Connect inboxes with CRM-managed OAuth</strong>
                </div>
              </div>
            <div className="email-provider-connect-grid">
              {integrationForm.email_provider === 'gmail' && (
                <button type="button" onClick={startGmailConnection} disabled={gmailConnecting || gmailStatus?.configured === false}>
                  <i className="fab fa-google"></i>
                  <strong>Connect Gmail</strong>
                  <span>Google Workspace or Gmail</span>
                </button>
              )}
              {integrationForm.email_provider === 'outlook' && (
                <button type="button" onClick={startOutlookConnection} disabled={gmailConnecting || outlookStatus?.configured === false}>
                  <i className="fab fa-microsoft"></i>
                  <strong>Connect Outlook</strong>
                  <span>Microsoft 365 or Outlook</span>
                </button>
              )}
              {(integrationForm.email_provider === 'smtp' || integrationForm.email_provider === 'internal') && (
                <button type="button" onClick={() => setCustomMailboxOpen(open => !open)}>
                  <i className="fas fa-server"></i>
                  <strong>Custom Mailbox</strong>
                  <span>Webmail, cPanel, Zoho, Titan</span>
                </button>
              )}
              {/* TODO: Yahoo Mail OAuth integration - waiting for Yahoo developer app approval and OAuth flow implementation */}
              {integrationForm.email_provider === 'yahoo' && (
                <button type="button" onClick={() => showToast('Yahoo central OAuth is planned next. Gmail and Outlook are ready for the new mailbox architecture.', true)}>
                  <i className="fab fa-yahoo"></i>
                  <strong>Yahoo Mail</strong>
                  <span>Coming next</span>
                </button>
              )}
            </div>
            {customMailboxOpen && (
              <div className="custom-mailbox-panel">
                <div className="custom-mailbox-panel__top">
                  <div>
                    <strong>Connect custom webmail</strong>
                    <span>Use an app password if the mailbox provider requires one.</span>
                  </div>
                  <select value={customMailboxForm.provider_preset} onChange={e => applyCustomMailboxPreset(e.target.value)}>
                    <option value="cpanel">cPanel / Webmail</option>
                    <option value="zoho">Zoho Mail</option>
                    <option value="titan">Titan Email</option>
                    <option value="godaddy">GoDaddy / Microsoft hosted</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="custom-mailbox-grid">
                  <label>Email address<input value={customMailboxForm.provider_email} onChange={e => applyCustomMailboxPreset(customMailboxForm.provider_preset, e.target.value)} placeholder="support@taskgo.co.au" /></label>
                  <label>Display name<input value={customMailboxForm.display_name} onChange={e => setCustomMailboxForm(prev => ({ ...prev, display_name: e.target.value }))} placeholder="TaskGo Support" /></label>
                  <label>SMTP host<input value={customMailboxForm.smtp_host} onChange={e => setCustomMailboxForm(prev => ({ ...prev, smtp_host: e.target.value }))} placeholder="mail.taskgo.co.au" /></label>
                  <label>SMTP port<input value={customMailboxForm.smtp_port} onChange={e => setCustomMailboxForm(prev => ({ ...prev, smtp_port: e.target.value }))} placeholder="465" /></label>
                  <label>Username<input value={customMailboxForm.smtp_username} onChange={e => setCustomMailboxForm(prev => ({ ...prev, smtp_username: e.target.value, imap_username: prev.imap_username || e.target.value }))} placeholder="same as email" /></label>
                  <label>Password / app password<input type="password" value={customMailboxForm.smtp_password} onChange={e => setCustomMailboxForm(prev => ({ ...prev, smtp_password: e.target.value }))} placeholder="mailbox app password" /></label>
                  <label>IMAP host<input value={customMailboxForm.imap_host} onChange={e => setCustomMailboxForm(prev => ({ ...prev, imap_host: e.target.value }))} placeholder="mail.taskgo.co.au" /></label>
                  <label>IMAP port<input value={customMailboxForm.imap_port} onChange={e => setCustomMailboxForm(prev => ({ ...prev, imap_port: e.target.value }))} placeholder="993" /></label>
                </div>
                <div className="custom-mailbox-panel__footer">
                  <label><input type="checkbox" checked={customMailboxForm.smtp_secure} onChange={e => setCustomMailboxForm(prev => ({ ...prev, smtp_secure: e.target.checked }))} /> SMTP SSL/TLS</label>
                  <label><input type="checkbox" checked={customMailboxForm.imap_secure} onChange={e => setCustomMailboxForm(prev => ({ ...prev, imap_secure: e.target.checked }))} /> IMAP SSL/TLS</label>
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveCustomMailboxConnection} disabled={customMailboxSaving}>
                    <i className="fas fa-plug"></i> {customMailboxSaving ? 'Connecting...' : 'Connect mailbox'}
                  </button>
                </div>
              </div>
            )}
            {currentBrandEmailConnections.length === 0 ? (
              <div className="brand-email-empty">
                No mailboxes connected yet. Select Gmail or Outlook above, sign in, and authorize access to connect your mailbox.
              </div>
            ) : (
              <div className="connected-mailbox-list">
                {currentBrandEmailConnections.map(connection => (
                  <div key={connection.id} className="connected-mailbox-card">
                    <span className={`connected-mailbox-provider ${connection.provider}`}>
                      <i className={`${connection.provider === 'custom_smtp_imap' ? 'fas fa-server' : `fab ${connection.provider === 'outlook' ? 'fa-microsoft' : connection.provider === 'yahoo' ? 'fa-yahoo' : 'fa-google'}`}`}></i>
                    </span>
                    <div>
                      <strong>{connection.provider_email}</strong>
                      <small>{connection.provider} - {connection.connection_status}{connection.is_default ? ' - default' : ''}</small>
                    </div>
                    <button type="button" onClick={() => setDefaultEmailConnection(connection.id)} disabled={connection.is_default}>Default</button>
                    <button type="button" onClick={() => disconnectEmailConnection(connection)} title="Disconnect mailbox"><i className="fas fa-unlink"></i></button>
                  </div>
                ))}
              </div>
            )}
            <div className="brand-email-test-panel compact">
              <div>
                <span>Send a test</span>
                <strong>{currentBrandEmailConnections.length ? 'Uses the default connected mailbox' : 'Connect a mailbox first'}</strong>
              </div>
              <div className="brand-email-test-actions">
                <input value={gmailTestRecipient} onChange={e => setGmailTestRecipient(e.target.value)} placeholder="test recipient email" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={sendDefaultMailboxTestEmail} disabled={gmailTesting || currentBrandEmailConnections.length === 0}>
                  <i className="fas fa-paper-plane"></i> {gmailTesting ? 'Sending...' : 'Send test'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Legacy email accounts panel removed - replaced by connected mailboxes architecture above */}
        {activeIntegrationChannel === 'email' && (
          <>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '14px' }}>Email Signature</label>
            <textarea value={integrationForm.email_signature || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, email_signature: e.target.value }))} rows={4} placeholder="Best,\nBrand Team" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', resize: 'vertical' }} />
          </>
        )}
        {activeIntegrationChannel === 'email' && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.45 }}>
            Automations are managed from the brand's Auto drip Sequences tab. Connect a real email provider before using automatic sending.
          </div>
        )}
        {!['leads', 'traffic'].includes(activeIntegrationChannel) && (
          <button onClick={saveBrandIntegration} disabled={integrationSaving} className="btn btn-primary" style={{ width: '100%', marginTop: '16px', background: selectedIntegrationBrand.color, border: 'none', color: '#fff' }}>
            <i className="fas fa-save"></i> {integrationSaving ? 'Saving...' : `Save ${activeIntegrationOption.title} Setup`}
          </button>
        )}
      </section>}

      {user?.role !== 'admin' && (
        <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ width: '40px', height: '40px', display: 'grid', placeItems: 'center', borderRadius: '12px', background: `${selectedIntegrationBrand.color}18`, color: selectedIntegrationBrand.color }}>
              <i className="fas fa-book-open"></i>
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-primary)' }}>Template Library</h3>
              <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>Browse approved communication templates. Integration setup is managed by administrators.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) repeat(3, minmax(120px, .55fr))', gap: '10px' }}>
            <label>
              <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Brand</span>
              <select className="brand-aware-select" value={integrationBrandId} onChange={e => setIntegrationBrandId(e.target.value)} style={{ width: '100%' }}>
                {activeBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select>
            </label>
            {integrationChannelOptions.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveIntegrationChannel(option.id)}
                style={{ alignSelf: 'end', minHeight: '48px', borderRadius: '12px', border: activeIntegrationChannel === option.id ? `1.5px solid ${option.tone}` : '1px solid var(--border)', background: activeIntegrationChannel === option.id ? `${option.tone}14` : 'var(--bg-base)', color: activeIntegrationChannel === option.id ? option.tone : 'var(--text-secondary)', fontWeight: 850, cursor: 'pointer' }}
              >
                <i className={`fas ${option.icon}`} style={{ marginRight: '7px' }}></i>{option.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {!['leads', 'traffic'].includes(activeIntegrationChannel) && <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-primary)' }}>{activeIntegrationOption.title} Templates</h3>
            <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>{user?.role === 'admin' ? 'Create and manage reusable templates.' : 'Approved templates available for your communications.'} Variables: {'{{name}}'}, {'{{first_name}}'}, {'{{brand}}'}.</p>
          </div>
          {user?.role === 'admin' && <button className="btn btn-ghost" onClick={resetTemplateForm}><i className="fas fa-plus"></i> New</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: user?.role === 'admin' ? '1fr 1fr' : '1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '510px', overflowY: 'auto' }}>
            {brandTemplates.length === 0 && (
              <div style={{ padding: '24px', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No {activeIntegrationOption.title.toLowerCase()} templates created for {selectedIntegrationBrand.name} yet.</div>
            )}
            {brandTemplates.map(t => (
              <div key={t.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-base)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{t.name}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{t.channel}{t.subject ? ` | ${t.subject}` : ''}</div>
                  </div>
                  {user?.role === 'admin' && <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEditMessageTemplate(t)} style={{ padding: '5px 8px' }}><i className="fas fa-pen"></i></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteMessageTemplate(t.id)} style={{ padding: '5px 8px', color: '#ef4444' }}><i className="fas fa-trash"></i></button>
                  </div>}
                </div>
                <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>{t.body.slice(0, 140)}{t.body.length > 140 ? '...' : ''}</p>
              </div>
            ))}
          </div>
          {user?.role === 'admin' && <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', background: 'var(--bg-base)' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Template Type</label>
            <div style={{ width: '100%', margin: '6px 0 10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700 }}>
              <i className={`fas ${activeIntegrationOption.icon}`} style={{ color: activeIntegrationOption.tone, marginRight: '8px' }}></i>{activeIntegrationOption.title}
            </div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Template Name</label>
            <input value={templateForm.name} onChange={e => setTemplateForm(prev => ({ ...prev, name: e.target.value }))} placeholder="First follow-up" style={{ width: '100%', margin: '6px 0 10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
            {templateForm.channel === 'email' && (
              <>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Subject</label>
                <input value={templateForm.subject} onChange={e => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))} placeholder="Hi {{first_name}}" style={{ width: '100%', margin: '6px 0 10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
              </>
            )}
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Body / Script</label>
            <textarea value={templateForm.body} onChange={e => setTemplateForm(prev => ({ ...prev, body: e.target.value }))} rows={10} placeholder="Hi {{first_name}}, this is {{brand}}..." style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', resize: 'vertical' }} />
            <button onClick={saveMessageTemplate} disabled={templateSaving} className="btn btn-primary" style={{ width: '100%', marginTop: '12px', background: selectedIntegrationBrand.color, border: 'none', color: '#fff' }}>
              <i className="fas fa-save"></i> {templateSaving ? 'Saving...' : templateForm.id ? 'Update Template' : 'Save Template'}
            </button>
          </div>}
        </div>
      </section>}
    </div>
  );
}
