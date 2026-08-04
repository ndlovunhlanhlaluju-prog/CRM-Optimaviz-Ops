import React from 'react';
import { Brand, Lead, Sequence, WebsiteAnalyticsSummary, User, EmailLog, WhatsAppLog, CallLog } from '../types';

interface IntelligencePageProps {
  allCrmLeads: Lead[];
  leads: Lead[];
  sequences: Sequence[];
  websiteAnalyticsSummary: WebsiteAnalyticsSummary | null;
  portfolioOpportunities: any[];
  globalDuplicateLeadGroups: Lead[][];
  dataCleanupSearch: string;
  setDataCleanupSearch: (search: string) => void;
  activeBrands: Brand[];
  managedBrands: Brand[];
  handleSelectBrand: (brand: Brand) => void;
  todayCommand: { due: any[]; untouched: any[] };
  portfolioCounts: { pending: number };
  scanPortfolioOpportunities: () => void;
  portfolioSaving: boolean;
  showDataCleanupStudio: boolean;
  setShowDataCleanupStudio: (show: boolean) => void;
  usersList: User[];
  allSentEmails: EmailLog[];
  allWhatsAppMessages: WhatsAppLog[];
  allCallLogs: CallLog[];
  getGlobalLeadActivityCount: (lead: Lead) => number;
  reviewPortfolioOpportunity: (id: string, action: 'accept' | 'dismiss') => void;
  setActiveIntegrationChannel: (channel: 'leads' | 'traffic' | 'email' | 'whatsapp' | 'call') => void;
  setActiveTab: (tab: string) => void;
  portfolioForm?: any;
  setPortfolioForm?: (fn: any) => void;
  savePortfolioRule?: () => void;
  portfolioRules?: any[];
  dismissPendingPortfolioOpportunities?: () => void;
}

export function IntelligencePage(props: IntelligencePageProps) {
  const {
    allCrmLeads,
    leads,
    sequences,
    websiteAnalyticsSummary,
    portfolioOpportunities,
    globalDuplicateLeadGroups,
    dataCleanupSearch,
    setDataCleanupSearch,
    activeBrands,
    managedBrands,
    handleSelectBrand,
    todayCommand,
    portfolioCounts,
    scanPortfolioOpportunities,
    portfolioSaving,
    showDataCleanupStudio,
    setShowDataCleanupStudio,
    usersList,
    allSentEmails,
    allWhatsAppMessages,
    allCallLogs,
    getGlobalLeadActivityCount,
    reviewPortfolioOpportunity,
    setActiveIntegrationChannel,
    setActiveTab,
    portfolioForm,
    setPortfolioForm,
    savePortfolioRule,
    portfolioRules = [],
    dismissPendingPortfolioOpportunities,
  } = props;

  // Data-quality insights use verified leads only — prospects stay in their own pool.
  const isVerifiedLead = (l: Lead) => (l.lead_classification || 'verified') !== 'prospect';
  const allSourceLeads = allCrmLeads.length ? allCrmLeads : leads;
  const sourceLeads = allSourceLeads.filter(isVerifiedLead);
  const prospectCount = allSourceLeads.filter(l => !isVerifiedLead(l)).length;
  const missingContactCount = sourceLeads.filter(l => !String(l.phone || '').replace(/\D/g, '') || !String(l.email || '').trim()).length;
  const untouchedCount = todayCommand.untouched.length;
  const activeSequenceCount = sequences.filter(seq => seq.active !== false).length;
  const trafficVisits = websiteAnalyticsSummary?.total_visits || 0;
  const trafficConversions = websiteAnalyticsSummary?.conversions || 0;
  const pendingOpportunities = portfolioOpportunities.filter(item => item.status === 'pending');
  const missingContactLeads = sourceLeads.filter(l => !String(l.phone || '').replace(/\D/g, '') || !String(l.email || '').trim());
  const untouchedLeads = todayCommand.untouched;
  const duplicatePreviewGroups = globalDuplicateLeadGroups
    .filter(group => group.some(isVerifiedLead))
    .map(group => group.filter(isVerifiedLead))
    .filter(group => group.length > 1)
    .slice(0, 8);
  const cleanupQuery = dataCleanupSearch.trim().toLowerCase();

  const cleanupLeadMatches = (lead?: Lead) => {
    if (!cleanupQuery) return true;
    const brand = activeBrands.find(item => item.id === lead?.brand_id) || managedBrands.find(item => item.id === lead?.brand_id);
    return [
      lead?.name,
      lead?.email,
      lead?.phone,
      lead?.funnel_stage,
      lead?.source,
      lead?.notes,
      lead?.assigned_to,
      lead?.owner_id,
      brand?.name,
      lead?.custom_fields?.organisation,
      lead?.custom_fields?.organization,
      lead?.custom_fields?.segment,
      lead?.custom_fields?.next_action,
    ].some(value => String(value || '').toLowerCase().includes(cleanupQuery));
  };

  const filteredMissingContactLeads = missingContactLeads.filter(cleanupLeadMatches);
  const filteredUntouchedLeads = untouchedLeads.filter(cleanupLeadMatches);
  const filteredDuplicateGroups = duplicatePreviewGroups.filter(group => group.some(cleanupLeadMatches));

  const openCleanupLeadBrand = (lead?: Lead) => {
    const brand = activeBrands.find(item => item.id === lead?.brand_id) || managedBrands.find(item => item.id === lead?.brand_id);
    if (brand) handleSelectBrand(brand);
  };

  const verifiedDuplicateGroupCount = globalDuplicateLeadGroups.filter(group => group.filter(isVerifiedLead).length > 1).length;

  const cleanupSummary = [
    {
      label: 'Missing contact info',
      value: missingContactLeads.length,
      detail: 'Verified leads missing a usable phone number or email address.',
      icon: 'fa-address-card',
      tone: '#ef4444',
    },
    {
      label: 'Untouched leads',
      value: untouchedLeads.length,
      detail: 'Verified leads with no logged email, WhatsApp, call, note, or task activity.',
      icon: 'fa-inbox',
      tone: '#0f766e',
    },
    {
      label: 'Possible duplicates',
      value: verifiedDuplicateGroupCount,
      detail: 'Verified records that appear to share the same email or phone (prospects excluded).',
      icon: 'fa-copy',
      tone: '#14b8a6',
    },
  ];

  const actionCards = [
    { label: 'Follow-ups due', value: todayCommand.due.length, icon: 'fa-clock', tone: '#f59e0b', action: () => setActiveTab('dashboard') },
    { label: 'Portfolio opportunities', value: portfolioCounts.pending, icon: 'fa-diagram-project', tone: '#0f766e', action: () => scanPortfolioOpportunities() },
    { label: 'Traffic visits', value: trafficVisits, icon: 'fa-chart-simple', tone: '#16a34a', action: () => { setActiveIntegrationChannel('traffic'); setActiveTab('integrations'); } },
    { label: 'Conversions', value: trafficConversions, icon: 'fa-bullseye', tone: '#155e75', action: () => { setActiveIntegrationChannel('traffic'); setActiveTab('integrations'); } },
    { label: 'Automation flows', value: activeSequenceCount, icon: 'fa-route', tone: '#164e63', action: () => { if (activeBrands[0]) { handleSelectBrand(activeBrands[0]); } } },
    { label: 'Data cleanup', value: missingContactCount + untouchedCount + verifiedDuplicateGroupCount, icon: 'fa-broom', tone: '#ef4444', action: () => setShowDataCleanupStudio(true) },
  ];

  const teamCoachingRows = usersList
    .map(member => {
      const owned = sourceLeads.filter(l => l.owner_id === member.id || l.assigned_to === member.name || l.custom_fields?.assigned_to === member.name);
      const touches = allSentEmails.filter(e => owned.some(l => l.id === e.lead_id)).length
        + allWhatsAppMessages.filter(w => owned.some(l => l.id === w.lead_id)).length
        + allCallLogs.filter(c => owned.some(l => l.id === c.lead_id)).length;
      const untouched = owned.filter(l => getGlobalLeadActivityCount(l) === 0).length;
      return { member, owned: owned.length, touches, untouched };
    })
    .sort((a, b) => b.owned - a.owned)
    .slice(0, 5);

  return (
    <div style={{ animation: 'fadeIn 0.3s', display: 'grid', gap: '18px' }}>
      <section style={{ border: '1px solid var(--border)', borderRadius: '18px', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: 'var(--accent)', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>
              <i className="fas fa-compass"></i> Operations intelligence
            </span>
            <h2 style={{ margin: '8px 0 6px', color: 'var(--text-primary)', fontSize: '28px' }}>Focus the work that matters today</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '780px', lineHeight: 1.55 }}>
              Review follow-ups, portfolio recommendations, traffic signals, automation, and team activity from one place.
              Lead data quality here is <strong>verified only</strong>
              {prospectCount > 0 ? ` (${prospectCount} prospect${prospectCount === 1 ? '' : 's'} excluded)` : ''}.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="button" onClick={scanPortfolioOpportunities}>
              <i className="fas fa-arrows-rotate"></i> Refresh intelligence
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setActiveTab('dashboard')}>
              <i className="fas fa-table-columns"></i> Open command dashboard
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginTop: '18px' }}>
          {actionCards.map(card => (
            <button key={card.label} type="button" onClick={card.action} style={{ display: 'grid', gap: '8px', textAlign: 'left', border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--bg-base)', padding: '15px', cursor: 'pointer' }}>
              <i className={`fas ${card.icon}`} style={{ color: card.tone, fontSize: '18px' }}></i>
              <strong style={{ color: 'var(--text-primary)', fontSize: '24px' }}>{card.value}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>{card.label}</span>
            </button>
          ))}
        </div>
      </section>

      {showDataCleanupStudio && (
        <section style={{ border: '1px solid var(--border)', borderRadius: '18px', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div>
              <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>Data cleanliness studio</span>
              <h3 style={{ margin: '4px 0 4px', color: 'var(--text-primary)' }}>Fix records that slow the team down</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
                Review leads with missing contacts, no activity, or possible duplicates. Open the brand to clean the record, merge manually, assign ownership, or add the next action.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="kanban-search-field" style={{ minWidth: '260px' }}>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '5px' }}>Filter cleanup</span>
                <input value={dataCleanupSearch} onChange={e => setDataCleanupSearch(e.target.value)} placeholder="Search name, brand, email, phone..." />
              </label>
              {dataCleanupSearch && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDataCleanupSearch('')}>Clear</button>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDataCleanupStudio(false)}>
                <i className="fas fa-xmark"></i> Hide
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '14px' }}>
            {cleanupSummary.map(item => (
              <div key={item.label} style={{ border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--bg-base)', padding: '14px', display: 'grid', gap: '7px' }}>
                <i className={`fas ${item.icon}`} style={{ color: item.tone, fontSize: '17px' }}></i>
                <strong style={{ color: 'var(--text-primary)', fontSize: '24px' }}>{item.value}</strong>
                <span style={{ color: 'var(--text-primary)', fontWeight: 850 }}>{item.label}</span>
                <small style={{ color: 'var(--text-muted)', lineHeight: 1.45 }}>{item.detail}</small>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--bg-base)', padding: '14px' }}>
              <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '10px' }}>Missing contact info</strong>
              <div style={{ display: 'grid', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                {filteredMissingContactLeads.slice(0, 8).map(lead => {
                  const brand = activeBrands.find(item => item.id === lead.brand_id) || managedBrands.find(item => item.id === lead.brand_id);
                  return (
                    <button key={lead.id} type="button" onClick={() => openCleanupLeadBrand(lead)} style={{ border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-card)', padding: '10px', textAlign: 'left', cursor: 'pointer' }}>
                      <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{lead.name || 'Unnamed lead'}</strong>
                      <small style={{ color: 'var(--text-muted)' }}>{brand?.name || lead.brand_id} · {!lead.email ? 'missing email' : 'missing phone'}</small>
                    </button>
                  );
                })}
                {filteredMissingContactLeads.length === 0 && <small style={{ color: 'var(--text-muted)' }}>{dataCleanupSearch ? 'No missing-contact leads match this filter.' : 'No missing contact details found.'}</small>}
              </div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--bg-base)', padding: '14px' }}>
              <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '10px' }}>Untouched leads</strong>
              <div style={{ display: 'grid', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                {filteredUntouchedLeads.slice(0, 8).map(lead => {
                  const brand = activeBrands.find(item => item.id === lead.brand_id) || managedBrands.find(item => item.id === lead.brand_id);
                  return (
                    <button key={lead.id} type="button" onClick={() => openCleanupLeadBrand(lead)} style={{ border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-card)', padding: '10px', textAlign: 'left', cursor: 'pointer' }}>
                      <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{lead.name || 'Unnamed lead'}</strong>
                      <small style={{ color: 'var(--text-muted)' }}>{brand?.name || lead.brand_id} · no activity logged</small>
                    </button>
                  );
                })}
                {filteredUntouchedLeads.length === 0 && <small style={{ color: 'var(--text-muted)' }}>{dataCleanupSearch ? 'No untouched leads match this filter.' : 'All leads have activity logged.'}</small>}
              </div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--bg-base)', padding: '14px' }}>
              <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '10px' }}>Possible duplicates</strong>
              <div style={{ display: 'grid', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                {filteredDuplicateGroups.map((group, index) => {
                  const firstLead = group[0];
                  const brand = activeBrands.find(item => item.id === firstLead?.brand_id) || managedBrands.find(item => item.id === firstLead?.brand_id);
                  return (
                    <button key={`${firstLead?.id || 'duplicate'}-${index}`} type="button" onClick={() => openCleanupLeadBrand(firstLead)} style={{ border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-card)', padding: '10px', textAlign: 'left', cursor: 'pointer' }}>
                      <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{group.length} matching records</strong>
                      <small style={{ color: 'var(--text-muted)' }}>{brand?.name || firstLead?.brand_id || 'Multiple brands'} · {group.map(item => item.name || 'Unnamed').slice(0, 2).join(', ')}</small>
                    </button>
                  );
                })}
                {filteredDuplicateGroups.length === 0 && <small style={{ color: 'var(--text-muted)' }}>{dataCleanupSearch ? 'No duplicate groups match this filter.' : 'No possible duplicates found.'}</small>}
              </div>
            </div>
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, .85fr)', gap: '16px' }}>
        <section style={{ border: '1px solid var(--border)', borderRadius: '18px', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>Portfolio opportunities</span>
              <h3 style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>Cross-brand recommendations</h3>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {dismissPendingPortfolioOpportunities && (
                <button className="btn btn-ghost btn-sm" type="button" onClick={dismissPendingPortfolioOpportunities} disabled={portfolioSaving || !portfolioCounts.pending}>
                  Clear pending
                </button>
              )}
              <button className="btn btn-primary btn-sm" type="button" onClick={scanPortfolioOpportunities} disabled={portfolioSaving}>
                <i className="fas fa-wand-magic-sparkles"></i> Scan
              </button>
            </div>
          </div>
          <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
            Cross-brand recommendations live here (moved from Dashboard). Create rules, scan, then accept or dismiss hand-offs.
          </p>
          {portfolioForm && setPortfolioForm && savePortfolioRule && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12, background: 'var(--bg-base)', display: 'grid', gap: 8 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Create a recommendation rule</strong>
              <input value={portfolioForm.name} onChange={e => setPortfolioForm((prev: any) => ({ ...prev, name: e.target.value }))} placeholder="Rule name" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select className="brand-aware-select" value={portfolioForm.source_brand_id} onChange={e => setPortfolioForm((prev: any) => ({ ...prev, source_brand_id: e.target.value }))}>
                  <option value="">Source brand</option>
                  {activeBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
                <select className="brand-aware-select" value={portfolioForm.target_brand_id} onChange={e => setPortfolioForm((prev: any) => ({ ...prev, target_brand_id: e.target.value }))}>
                  <option value="">Target brand</option>
                  {activeBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1fr', gap: 8 }}>
                <select value={portfolioForm.trigger_field} onChange={e => setPortfolioForm((prev: any) => ({ ...prev, trigger_field: e.target.value }))}>
                  <option value="funnel_stage">Stage</option>
                  <option value="source">Source</option>
                  <option value="segment">Segment</option>
                  <option value="city">City</option>
                </select>
                <input value={portfolioForm.trigger_value} onChange={e => setPortfolioForm((prev: any) => ({ ...prev, trigger_value: e.target.value }))} placeholder="Match value" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }} />
              </div>
              <input value={portfolioForm.offer_label} onChange={e => setPortfolioForm((prev: any) => ({ ...prev, offer_label: e.target.value }))} placeholder="Recommended offer" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }} />
              <button type="button" className="btn btn-primary btn-sm" onClick={savePortfolioRule} disabled={portfolioSaving}><i className="fas fa-save"></i> Save rule</button>
              {portfolioRules.slice(0, 4).map(rule => (
                <div key={rule.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-primary)' }}>{rule.name}</strong> · {rule.trigger_field} contains {rule.trigger_value}</div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
            {pendingOpportunities.slice(0, 8).map(item => (
              <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-base)', padding: '12px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{item.title}</strong>
                <p style={{ margin: '5px 0 8px', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.45 }}>{item.reason}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <small style={{ color: 'var(--text-muted)' }}>{item.source_brand_name} {'->'} {item.target_brand_name}</small>
                  <span style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => reviewPortfolioOpportunity(item.id, 'dismiss')}>Dismiss</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => reviewPortfolioOpportunity(item.id, 'accept')}>Accept</button>
                  </span>
                </div>
              </div>
            ))}
            {pendingOpportunities.length === 0 && (
              <div style={{ border: '1px dashed var(--border)', borderRadius: '12px', padding: '22px', color: 'var(--text-muted)', textAlign: 'center' }}>
                No pending recommendations. Save a rule, then run Scan.
              </div>
            )}
          </div>
        </section>

        <section style={{ border: '1px solid var(--border)', borderRadius: '18px', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', padding: '18px' }}>
          <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>Team coaching analytics</span>
          <h3 style={{ margin: '4px 0 12px', color: 'var(--text-primary)' }}>Performance signals</h3>
          <div style={{ display: 'grid', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
            {teamCoachingRows.map(row => (
              <div key={row.member.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-base)', padding: '12px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{row.member.name}</strong>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  <span>{row.owned} owned leads</span>
                  <span>{row.touches} touches</span>
                  <span>{row.untouched} untouched</span>
                </div>
              </div>
            ))}
            {teamCoachingRows.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Team coaching appears once users own leads.</div>}
          </div>
        </section>
      </div>

      <section style={{ border: '1px solid var(--border)', borderRadius: '18px', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', padding: '18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {[
            { title: 'Workflow automation', body: 'Build sequences that email, WhatsApp, create tasks, or schedule calls after a lead reaches a stage.', icon: 'fa-route', action: () => { if (activeBrands[0]) { handleSelectBrand(activeBrands[0]); } } },
            { title: 'Lead source ROI', body: 'Compare lead sources, conversions, and website traffic so each brand knows where growth is coming from.', icon: 'fa-chart-line', action: () => { setActiveIntegrationChannel('leads'); setActiveTab('integrations'); } },
            { title: 'Data cleanliness studio', body: 'Use duplicates, missing contacts, untouched leads, and brand health to clean the portfolio quickly.', icon: 'fa-broom', action: () => setShowDataCleanupStudio(true) },
            { title: 'Custom dashboards', body: 'Save command metrics, layout density, brand cards, and views per brand workspace.', icon: 'fa-sliders', action: () => setActiveTab('dashboard') },
          ].map(card => (
            <button key={card.title} type="button" onClick={card.action} style={{ display: 'grid', gap: '8px', alignContent: 'start', minHeight: '150px', border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--bg-base)', padding: '15px', textAlign: 'left', cursor: 'pointer' }}>
              <i className={`fas ${card.icon}`} style={{ color: 'var(--accent)', fontSize: '18px' }}></i>
              <strong style={{ color: 'var(--text-primary)' }}>{card.title}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.45 }}>{card.body}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
