import React from 'react';
import axios from 'axios';
import { Brand, Lead, BrandIntegration, LeadSource, WebsiteAnalyticsSite, User } from '../types';
import { BRANDS, SnapshotCardConfig } from '../config/crmConfig';

interface DashboardPageProps {
  allCrmLeads: Lead[];
  leads: Lead[];
  brandIntegrations: BrandIntegration[];
  activeBrands: Brand[];
  managedBrands: Brand[];
  setIntegrationBrandId: (id: string) => void;
  setActiveIntegrationChannel: (channel: 'leads' | 'traffic' | 'email' | 'whatsapp' | 'call') => void;
  setActiveTab: (tab: string) => void;
  setupGuideCollapsed: boolean;
  setSetupGuideCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  leadSources: LeadSource[];
  websiteAnalyticsSites: WebsiteAnalyticsSite[];
  usersList: User[];
  handleSelectBrand: (brand: Brand) => void;
  portfolioCounts: { pending: number };
  portfolioCollapsed: boolean;
  setPortfolioCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  scanPortfolioOpportunities: () => void;
  portfolioSaving: boolean;
  dismissPendingPortfolioOpportunities: () => void;
  portfolioForm: any;
  setPortfolioForm: React.Dispatch<React.SetStateAction<any>>;
  savePortfolioRule: () => void;
  portfolioRules: any[];
  portfolioOpportunities: any[];
  reviewPortfolioOpportunity: (id: string, action: 'accept' | 'dismiss') => void;
  getGlobalLeadActivityCount: (lead: Lead) => number;
  duplicateLeadIds: Set<string>;
  todayCommand: { due: any[]; untouched: any[] };
  emailAttentionCount: number;
  whatsappAttentionCount: number;
  dueCallActionCount: number;
  teamGlobalUnreadCount: number;
  brandOperatingMetrics: any[];
  commandMetrics: any[];
  resetCommandMetrics: () => void;
  dashboardDensity: 'comfortable' | 'compact';
  setDashboardDensity: (density: 'comfortable' | 'compact') => void;
  getCommandMetricValue: (card: any) => number;
  openCommandMetricModal: (card?: any) => void;
  deleteCommandMetric: (id: string) => void;
  getNextActionForLead: (lead: Lead) => any;
  getLeadBrand: (lead: Lead) => Brand | undefined;
  setSelectedBrand: (brand: Brand | null) => void;
  setSelectedBrandForEmail: (brand: Brand) => void;
  setActiveEmailLead: (lead: Lead | null) => void;
  setSelectedBrandForWhatsApp: (brand: Brand) => void;
  setActiveWhatsAppLead: (lead: Lead | null) => void;
  setSelectedBrandForCalls: (brand: Brand) => void;
  setActiveCallLead: (lead: Lead | null) => void;
  setActiveLead: (lead: Lead | null) => void;
  loadLeadDetailsHistory: (id: string) => void;
  portfolioLeaderboard: any[];
  countUniquePeopleForBrand: (leads: Lead[]) => number;
  brandIntelligenceBreakdowns: Record<string, any[]>;
  isSectionVisible: (brandId: string, sectionKey: string, defaultValue: boolean) => boolean;
  toggleSection: (brandId: string, sectionKey: string, defaultValue: boolean) => void;
  setIntelligenceBuilderOpen: React.Dispatch<React.SetStateAction<boolean>>;
  intelligenceBuilderOpen: boolean;
  intelligenceForm: any;
  setIntelligenceForm: React.Dispatch<React.SetStateAction<any>>;
  editingIntelligenceId: string;
  setEditingIntelligenceId: (id: string) => void;
  showToast: (msg: string, isError?: boolean) => void;
  isFollowUpDue: (lead: Lead) => boolean;
  getSnapshotCardValue: (card: any, leads: Lead[]) => number;
  snapshotCards: Record<string, SnapshotCardConfig[]>;
  handleDeleteSnapshotCard: (brandId: string, cardId: string) => void;
  snapshotForm: any;
  setSnapshotForm: React.Dispatch<React.SetStateAction<any>>;
  handleAddSnapshotCard: (brandId: string) => void;
  getBrandSegmentOptions: (brandId: string) => any[];
  getBrandStageOptions: (brandId: string) => string[];
  getStageColor: (stage: string) => string;
  getLeadMetricRawValue: (lead: Lead, fieldKey: string) => any;
  isMeaningfulMetricValue: (value: unknown) => boolean;
  getLeadIdentityKeyForBrand: (lead: Lead) => string;
  setBrandIntelligenceBreakdowns: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  DEFAULT_INTELLIGENCE_BREAKDOWNS: any[];
  setSelectedStageFilter: (stage: string) => void;
  setSelectedCustomFieldFilter: (filter: { field: string; value: string }) => void;
  setSelectedSegmentFilter: (segment: string) => void;
  openBrandWorkbench?: (
    brand: Brand,
    focus?: {
      label?: string;
      segment?: string;
      stage?: string;
      abn?: 'has_abn' | 'no_abn';
      customField?: { field: string; value: string };
      search?: string;
      classification?: 'prospect' | 'verified';
    }
  ) => void;
}

export function DashboardPage(props: DashboardPageProps) {
  const {
    allCrmLeads,
    leads,
    brandIntegrations,
    activeBrands,
    managedBrands,
    setIntegrationBrandId,
    setActiveIntegrationChannel,
    setActiveTab,
    setupGuideCollapsed,
    setSetupGuideCollapsed,
    leadSources,
    websiteAnalyticsSites,
    usersList,
    handleSelectBrand,
    portfolioCounts,
    portfolioCollapsed,
    setPortfolioCollapsed,
    scanPortfolioOpportunities,
    portfolioSaving,
    dismissPendingPortfolioOpportunities,
    portfolioForm,
    setPortfolioForm,
    savePortfolioRule,
    portfolioRules,
    portfolioOpportunities,
    reviewPortfolioOpportunity,
    getGlobalLeadActivityCount,
    duplicateLeadIds,
    todayCommand,
    emailAttentionCount,
    whatsappAttentionCount,
    dueCallActionCount,
    teamGlobalUnreadCount,
    brandOperatingMetrics,
    commandMetrics,
    resetCommandMetrics,
    dashboardDensity,
    setDashboardDensity,
    getCommandMetricValue,
    openCommandMetricModal,
    deleteCommandMetric,
    getNextActionForLead,
    getLeadBrand,
    setSelectedBrand,
    setSelectedBrandForEmail,
    setActiveEmailLead,
    setSelectedBrandForWhatsApp,
    setActiveWhatsAppLead,
    setSelectedBrandForCalls,
    setActiveCallLead,
    setActiveLead,
    loadLeadDetailsHistory,
    portfolioLeaderboard,
    countUniquePeopleForBrand,
    brandIntelligenceBreakdowns,
    isSectionVisible,
    toggleSection,
    setIntelligenceBuilderOpen,
    intelligenceBuilderOpen,
    intelligenceForm,
    setIntelligenceForm,
    editingIntelligenceId,
    setEditingIntelligenceId,
    showToast,
    isFollowUpDue,
    getSnapshotCardValue,
    snapshotCards,
    handleDeleteSnapshotCard,
    snapshotForm,
    setSnapshotForm,
    handleAddSnapshotCard,
    getBrandSegmentOptions,
    getBrandStageOptions,
    getStageColor,
    getLeadMetricRawValue,
    isMeaningfulMetricValue,
    getLeadIdentityKeyForBrand,
    setBrandIntelligenceBreakdowns,
    DEFAULT_INTELLIGENCE_BREAKDOWNS,
    setSelectedStageFilter,
    setSelectedCustomFieldFilter,
    setSelectedSegmentFilter,
    openBrandWorkbench,
  } = props;

  // Full lead set (setup checklist etc.) vs verified-only (data insights / metrics).
  // Prospects must not dilute portfolio insights — verified = high-quality pipeline.
  const allSourceLeads = allCrmLeads.length ? allCrmLeads : leads;
  const isVerifiedLead = (l: Lead) => (l.lead_classification || 'verified') !== 'prospect';
  const sourceLeads = allSourceLeads.filter(isVerifiedLead);
  const prospectCount = allSourceLeads.filter(l => !isVerifiedLead(l)).length;
  const hasCommunicationSetup = (brandIntegrations || []).some((integration: any) => {
    const emailReady = integration.email_provider && integration.email_provider !== 'internal';
    const whatsappReady = String(integration.whatsapp_number || '').trim();
    const callingReady = String(integration.call_number || integration.calling_number || integration.calling_public_number || '').trim();
    return emailReady || whatsappReady || callingReady;
  });

  const openSetupChannel = (channel: 'leads' | 'traffic' | 'email' | 'whatsapp' | 'call') => {
    const brandId = activeBrands[0]?.id || BRANDS[0]?.id || '';
    if (brandId) setIntegrationBrandId(brandId);
    setActiveIntegrationChannel(channel);
    setActiveTab('integrations');
  };

  const checklist = [
    {
      id: 'brand',
      title: 'Create or review brands',
      detail: 'Brands keep pipelines, lead sources, messages, and reports separate.',
      done: activeBrands.length > 0,
      icon: 'fa-layer-group',
      action: () => setActiveTab('dashboard'),
      cta: activeBrands.length > 0 ? `${activeBrands.length} brands` : 'Review brands',
    },
    {
      id: 'leads',
      title: 'Add or import leads',
      detail: 'Use real leads so follow-ups, AI signals, and dashboards become useful.',
      done: allSourceLeads.length > 0,
      icon: 'fa-user-plus',
      action: () => activeBrands[0] ? handleSelectBrand(activeBrands[0]) : setActiveTab('dashboard'),
      cta: allSourceLeads.length > 0 ? `${allSourceLeads.length} leads` : 'Add leads',
    },
    {
      id: 'sources',
      title: 'Connect lead capture',
      detail: 'Use website forms or webhook capture first. Social sources can connect later.',
      done: leadSources.length > 0,
      icon: 'fa-code',
      action: () => openSetupChannel('leads'),
      cta: leadSources.length > 0 ? `${leadSources.length} sources` : 'Setup capture',
    },
    {
      id: 'traffic',
      title: 'Install traffic tracking',
      detail: 'Track page views, countries, sources, devices, and conversions on the dashboard.',
      done: websiteAnalyticsSites.length > 0,
      icon: 'fa-chart-simple',
      action: () => openSetupChannel('traffic'),
      cta: websiteAnalyticsSites.length > 0 ? 'Tracking' : 'Setup traffic',
    },
    {
      id: 'channels',
      title: 'Set up communication',
      detail: 'Connect email/WhatsApp or click-to-call so activity lands on each lead.',
      done: hasCommunicationSetup,
      icon: 'fa-comments',
      action: () => openSetupChannel('email'),
      cta: hasCommunicationSetup ? 'Configured' : 'Open setup',
    },
    {
      id: 'team',
      title: 'Check staff access',
      detail: 'Keep ownership, notes, chat, and follow-ups shared across the team.',
      done: usersList.length > 1,
      icon: 'fa-users',
      action: () => setActiveTab('users'),
      cta: usersList.length > 1 ? `${usersList.length} users` : 'Open staff',
    },
  ];

  const completed = checklist.filter(item => item.done).length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const newTodayCount = sourceLeads.filter(l => l.created_at && new Date(l.created_at).getTime() >= todayStart.getTime()).length;
  const staleLeadCount = sourceLeads.filter(l => {
    const activityCount = getGlobalLeadActivityCount(l);
    const lastSeen = new Date(l.updated_at || l.created_at || Date.now()).getTime();
    return activityCount === 0 && Date.now() - lastSeen > 7 * 86400000;
  }).length;
  const missingContactCount = sourceLeads.filter(l => !String(l.phone || '').replace(/\D/g, '') || !String(l.email || '').trim()).length;
  const mostAffectedDuplicateBrand = activeBrands
    .map(brand => ({ brand, count: sourceLeads.filter(l => l.brand_id === brand.id && duplicateLeadIds.has(l.id)).length }))
    .sort((a, b) => b.count - a.count)[0]?.brand;

  const workCards = [
    { label: 'Follow-ups due', value: todayCommand.due.length, icon: 'fa-clock', tone: '#f59e0b', action: () => setActiveTab('dashboard') },
    { label: 'New today', value: newTodayCount, icon: 'fa-sun', tone: '#155e75', action: () => setActiveTab('dashboard') },
    { label: 'Email action inbox', value: emailAttentionCount, icon: 'fa-envelope-open-text', tone: '#155e75', action: () => setActiveTab('email-tracking') },
    { label: 'Untouched leads', value: todayCommand.untouched.length, icon: 'fa-inbox', tone: '#0f766e', action: () => setActiveTab('dashboard') },
    { label: 'Missing contact info', value: missingContactCount, icon: 'fa-address-card', tone: '#ef4444', action: () => setActiveTab('dashboard') },
    { label: 'Possible duplicates', value: globalDuplicateLeadGroupsLength(sourceLeads), icon: 'fa-copy', tone: '#14b8a6', action: () => mostAffectedDuplicateBrand ? handleSelectBrand(mostAffectedDuplicateBrand) : setActiveTab('dashboard') },
  ];

  const commCards = [
    { label: 'Email replies', value: emailAttentionCount, icon: 'fa-envelope', tone: '#155e75', action: () => setActiveTab('email-tracking') },
    { label: 'WhatsApp attention', value: whatsappAttentionCount, icon: 'fa-comment-dots', tone: '#16a34a', action: () => setActiveTab('whatsapp-tracking') },
    { label: 'Calls due', value: dueCallActionCount, icon: 'fa-phone', tone: '#0f766e', action: () => setActiveTab('calls') },
    { label: 'Team unread', value: teamGlobalUnreadCount, icon: 'fa-comments', tone: '#0f766e', action: () => setActiveTab('team-chat') },
  ];

  const healthRows = activeBrands.map(brand => {
    const rows = sourceLeads.filter(l => l.brand_id === brand.id);
    const missingPhones = rows.filter(l => !String(l.phone || '').replace(/\D/g, '')).length;
    const missingEmails = rows.filter(l => !String(l.email || '').trim()).length;
    const stale = rows.filter(l => getGlobalLeadActivityCount(l) === 0).length;
    return { brand, missingPhones, missingEmails, stale, score: missingPhones + missingEmails + stale };
  }).sort((a, b) => b.score - a.score).slice(0, 5);

  function globalDuplicateLeadGroupsLength(allLeads: Lead[]) {
    // Basic grouping by email/phone duplicates
    const byEmail: Record<string, Lead[]> = {};
    const byPhone: Record<string, Lead[]> = {};
    allLeads.forEach(l => {
      const email = String(l.email || '').trim().toLowerCase();
      if (email) {
        byEmail[email] = byEmail[email] || [];
        byEmail[email].push(l);
      }
      const phone = String(l.phone || '').replace(/\D/g, '');
      if (phone) {
        byPhone[phone] = byPhone[phone] || [];
        byPhone[phone].push(l);
      }
    });
    const groups: Lead[][] = [];
    Object.values(byEmail).forEach(g => { if (g.length > 1) groups.push(g); });
    Object.values(byPhone).forEach(g => { if (g.length > 1) groups.push(g); });
    return groups.length;
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      {completed < checklist.length && (
        <section className={`dashboard-launch-checklist ${setupGuideCollapsed ? 'is-collapsed' : ''}`}>
          <div className="dashboard-launch-checklist__head">
            <div>
              <span>Operations setup guide</span>
              <h3>Keep the CRM ready for daily work</h3>
              <p>Complete these once. Lead records stay simple while capture, analytics, and communication run behind the scenes.</p>
            </div>
            <div className="dashboard-launch-checklist__actions">
              <strong>{completed}/{checklist.length} complete</strong>
              <button type="button" onClick={() => {
                setSetupGuideCollapsed(previous => {
                  const next = !previous;
                  localStorage.setItem('lujunal_operations_setup_guide_collapsed', String(next));
                  return next;
                });
              }}>
                <i className={`fas ${setupGuideCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
                {setupGuideCollapsed ? 'Show' : 'Collapse'}
              </button>
            </div>
          </div>
          {!setupGuideCollapsed && (
            <div className="dashboard-launch-checklist__grid">
              {checklist.map(item => (
                <button key={item.id} type="button" className={item.done ? 'done' : ''} onClick={item.action}>
                  <i className={`fas ${item.done ? 'fa-circle-check' : item.icon}`}></i>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <em>{item.cta}</em>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="dashboard-ops-overview">
        <div className="dashboard-ops-header">
          <div>
            <span>Today&apos;s work</span>
            <h3>Operational Overview</h3>
            <p>
              Data insights below use <strong>Verified leads only</strong> (high-quality pipeline).
              {prospectCount > 0
                ? ` ${prospectCount} prospect${prospectCount === 1 ? '' : 's'} are kept separate and do not affect these numbers.`
                : ' Prospects are kept in a separate pool and never mixed in.'}
            </p>
          </div>
          <button type="button" onClick={scanPortfolioOpportunities}>
            <i className="fas fa-arrows-rotate"></i>
            Refresh
          </button>
        </div>
        <div className="dashboard-verified-pill">
          <i className="fas fa-shield-halved" />
          Verified-only insights · {sourceLeads.length} verified · {prospectCount} prospects excluded
        </div>
        <div className="dashboard-work-grid">
          {workCards.map(card => (
            <button key={card.label} type="button" onClick={card.action} style={{ ['--work-tone' as any]: card.tone }}>
              <i className={`fas ${card.icon}`}></i>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </button>
          ))}
        </div>
        <div className="dashboard-action-panels">
          <div className="dashboard-action-panel">
            <div className="dashboard-action-panel__title">
              <strong>Communication Queue</strong>
              <span>{emailAttentionCount + whatsappAttentionCount + dueCallActionCount + teamGlobalUnreadCount} open items</span>
            </div>
            <div className="dashboard-comms-grid">
              {commCards.map(card => (
                <button key={card.label} type="button" onClick={card.action} style={{ ['--comm-tone' as any]: card.tone }}>
                  <i className={`fas ${card.icon}`}></i>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </button>
              ))}
            </div>
          </div>
          <div className="dashboard-action-panel">
            <div className="dashboard-action-panel__title">
              <strong>Brand Data Health</strong>
              <span>{missingContactCount + staleLeadCount} cleanup signals</span>
            </div>
            <div className="dashboard-health-list">
              {healthRows.map(row => (
                <button key={row.brand.id} type="button" onClick={() => handleSelectBrand(row.brand)}>
                  <span>
                    <img src={row.brand.logo} alt={row.brand.name} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                    <strong>{row.brand.name}</strong>
                  </span>
                  <em>{row.missingPhones} phone</em>
                  <em>{row.missingEmails} email</em>
                  <em>{row.stale} untouched</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Daily Command Center */}
      <div className="command-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', marginBottom: '28px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>Today Command Center</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              Daily work queue across brands — lead counts and data health are <strong>verified only</strong>. Fully editable.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => openCommandMetricModal()} style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
              <i className="fas fa-plus"></i> Add Metric
            </button>
            <button className="btn btn-ghost btn-sm" onClick={resetCommandMetrics}>
              <i className="fas fa-rotate-left"></i> Reset
            </button>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              {(['comfortable', 'compact'] as const).map(mode => (
                <button key={mode} onClick={() => setDashboardDensity(mode)} style={{ padding: '8px 12px', border: 'none', background: dashboardDensity === mode ? 'var(--accent)' : 'var(--bg-base)', color: dashboardDensity === mode ? '#fff' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '18px' }}>
          {commandMetrics.map(card => (
            <div key={card.id} style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px', padding: dashboardDensity === 'compact' ? '12px' : '16px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>{card.label}</span>
                <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => openCommandMetricModal(card)} title="Edit metric" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}><i className="fas fa-pen"></i></button>
                  <button onClick={() => deleteCommandMetric(card.id)} title="Delete metric" style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: 0 }}><i className="fas fa-trash"></i></button>
                  <i className={`fas ${card.icon}`} style={{ color: card.color }}></i>
                </span>
              </div>
              <strong style={{ fontSize: dashboardDensity === 'compact' ? '22px' : '28px', color: 'var(--text-primary)' }}>{getCommandMetricValue(card)}</strong>
            </div>
          ))}
          {commandMetrics.length === 0 && (
            <button onClick={() => openCommandMetricModal()} style={{ minHeight: '110px', border: '1px dashed var(--border)', borderRadius: '12px', background: 'var(--bg-base)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}>
              <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>Add your first metric
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, .8fr)', gap: '16px' }}>
          <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontWeight: 800, marginBottom: '10px', color: 'var(--text-primary)' }}>Next Best Actions</div>
            <div style={{ display: 'grid', gap: dashboardDensity === 'compact' ? '6px' : '8px', maxHeight: '260px', overflowY: 'auto' }}>
              {sourceLeads
                .map(l => ({ lead: l, action: getNextActionForLead(l) }))
                .filter(({ action }) => action.priority > 10)
                .sort((a, b) => b.action.priority - a.action.priority)
                .slice(0, 10)
                .map(({ lead: l, action }) => {
                const brand = getLeadBrand(l);
                return (
                  <div key={l.id} onClick={() => {
                    if (action.tab === 'email-tracking') { setSelectedBrand(null); setSelectedBrandForEmail(brand || activeBrands[0] || BRANDS[0]); setActiveEmailLead(l); setActiveTab('email-tracking'); }
                    else if (action.tab === 'whatsapp-tracking') { setSelectedBrand(null); setSelectedBrandForWhatsApp(brand || activeBrands[0] || BRANDS[0]); setActiveWhatsAppLead(l); setActiveTab('whatsapp-tracking'); }
                    else if (action.tab === 'calls') { setSelectedBrand(null); setSelectedBrandForCalls(brand || activeBrands[0] || BRANDS[0]); setActiveCallLead(l); setActiveTab('calls'); loadLeadDetailsHistory(l.id); }
                    else if (brand) { handleSelectBrand(brand); setTimeout(() => { setActiveLead(l); loadLeadDetailsHistory(l.id); }, 120); }
                  }} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'center', padding: dashboardDensity === 'compact' ? '8px 10px' : '11px 12px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{brand?.name || l.brand_name} | {l.funnel_stage}</div>
                      <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '3px 7px', borderRadius: '999px', background: `${action.tone}14`, color: action.tone }}>Trigger: {action.trigger}</span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{action.reason}</span>
                      </div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 10px', borderRadius: '999px', background: `${action.tone}22`, color: action.tone, fontSize: '12px', fontWeight: 800 }}>
                      <i className={action.icon.startsWith('fa') && !action.icon.startsWith('fas') && !action.icon.startsWith('fab') ? `fas ${action.icon}` : action.icon}></i>{action.label}
                    </span>
                  </div>
                );
              })}
              {sourceLeads.every(l => getNextActionForLead(l).priority <= 10) && (
                <small style={{ color: 'var(--text-muted)', padding: '10px' }}>No trigger-based actions need attention right now.</small>
              )}
            </div>
          </div>
          <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontWeight: 800, marginBottom: '10px', color: 'var(--text-primary)' }}>Brand Operating Metrics</div>
            <div style={{ display: 'grid', gap: '10px', maxHeight: '260px', overflowY: 'auto' }}>
              {brandOperatingMetrics.map(({ brand, items }) => (
                <div key={brand.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', background: 'var(--bg-card)' }}>
                  <button
                    type="button"
                    onClick={() => (openBrandWorkbench ? openBrandWorkbench(brand) : handleSelectBrand(brand))}
                    title={`Open ${brand.name} workspace`}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                  >
                    <img src={brand.logo} alt={brand.name} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                    <strong style={{ color: 'var(--text-primary)' }}>{brand.name}</strong>
                    <i className="fas fa-arrow-up-right-from-square" style={{ marginLeft: 'auto', fontSize: '11px', color: brand.color }}></i>
                  </button>
                  <div style={{ display: 'grid', gap: '7px' }}>
                    {items.map((item: any) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          if (openBrandWorkbench) openBrandWorkbench(brand, item.focus || { label: item.label });
                          else handleSelectBrand(brand);
                        }}
                        title={`Open ${brand.name} · ${item.label}`}
                        style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', width: '100%', border: '1px solid transparent', borderRadius: '8px', background: 'transparent', cursor: 'pointer', padding: '4px 6px', textAlign: 'left' }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${brand.color}12`; e.currentTarget.style.borderColor = `${brand.color}33`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>{item.label}</span>
                        <strong style={{ color: brand.color }}>{item.value}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {brandOperatingMetrics.length === 0 && <small style={{ color: 'var(--text-muted)' }}>Metrics appear here as brand data is added.</small>}
              <small style={{ color: 'var(--text-muted)' }}>Click a metric to open that brand with the matching lead filter applied.</small>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Intelligence Strip */}
      <div className="portfolio-intelligence-strip">
        <section className="portfolio-leaderboard-card">
          <div className="portfolio-leaderboard-card__header">
            <div>
              <h3>Cross-Brand Leaderboard</h3>
              <p>Verified lead volume, open follow-ups, and won/converted activity across the portfolio (prospects excluded).</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={scanPortfolioOpportunities}>
              <i className="fas fa-arrows-rotate"></i> <span className="btn-label-desktop">Refresh</span>
            </button>
          </div>
          <div className="portfolio-leaderboard-list">
            {portfolioLeaderboard.map(({ brand, total, due, won, pct }) => (
              <button
                key={brand.id}
                type="button"
                className="portfolio-leader-row"
                onClick={() => handleSelectBrand(brand)}
              >
                <span className="portfolio-leader-row__brand">
                  <img src={brand.logo} alt="" />
                  <strong>{brand.name}</strong>
                </span>
                <div className="portfolio-leader-row__stats">
                  <span><em>{total}</em> leads</span>
                  <span><em>{due}</em> due</span>
                  <span><em>{won}</em> won</span>
                </div>
                <strong className="portfolio-leader-row__pct" style={{ color: brand.color }}>
                  {pct}% <span>conversion</span>
                </strong>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
