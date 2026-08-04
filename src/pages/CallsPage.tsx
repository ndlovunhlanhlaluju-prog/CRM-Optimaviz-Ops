import React from 'react';
import { Brand, Lead, MessageTemplate } from '../types';

interface CallsPageProps {
  diallerLeadsList: Lead[];
  selectedBrandForCalls: Brand | null;
  setSelectedBrandForCalls: (brand: Brand) => void;
  callStageFilter: string;
  setCallStageFilter: (stage: string) => void;
  activeCallLead: Lead | null;
  setActiveCallLead: (lead: Lead | null) => void;
  leadCalls: any[];
  getBrandIntegrationFor: (brandId: string) => any;
  handleSelectCommunications: () => void;
  managedBrands: Brand[];
  activeBrands: Brand[];
  setDiallerLead: (lead: Lead | null) => void;
  setCallNotes: (notes: string) => void;
  setCallFollowUpDate: (date: string) => void;
  getBrandStageOptions: (brandId?: string) => string[];
  setActiveLead: (lead: Lead | null) => void;
  loadLeadDetailsHistory: (id: string) => void;
  isCalling: boolean;
  diallerLead: Lead | null;
  callSeconds: number;
  handleEndSimulatedCall: () => void;
  handleStartSimulatedCall: (lead: Lead) => void;
  callOutcome: string;
  setCallOutcome: (outcome: string) => void;
  callDuration: number;
  setCallDuration: (duration: number) => void;
  callFollowUpDate: string;
  messageTemplates: MessageTemplate[];
  applyTemplateVars: (template: string, lead: Lead, brand: Brand | null) => string;
  callNotes: string;
  handleLogCallSubmit: (e: React.FormEvent) => void;
  callSaving: boolean;
  setActiveTab: (tab: string) => void;
  setIntegrationBrandId: (id: string) => void;
  integrationBrandId: string;
  setActiveIntegrationChannel: (channel: 'leads' | 'traffic' | 'email' | 'whatsapp' | 'call') => void;
}

export function CallsPage(props: CallsPageProps) {
  const {
    diallerLeadsList,
    selectedBrandForCalls,
    setSelectedBrandForCalls,
    callStageFilter,
    setCallStageFilter,
    activeCallLead,
    setActiveCallLead,
    leadCalls,
    getBrandIntegrationFor,
    handleSelectCommunications,
    managedBrands,
    activeBrands,
    setDiallerLead,
    setCallNotes,
    setCallFollowUpDate,
    getBrandStageOptions,
    setActiveLead,
    loadLeadDetailsHistory,
    isCalling,
    diallerLead,
    callSeconds,
    handleEndSimulatedCall,
    handleStartSimulatedCall,
    callOutcome,
    setCallOutcome,
    callDuration,
    setCallDuration,
    callFollowUpDate,
    messageTemplates,
    applyTemplateVars,
    callNotes,
    handleLogCallSubmit,
    callSaving,
    setActiveTab,
    setIntegrationBrandId,
    integrationBrandId,
    setActiveIntegrationChannel,
  } = props;

  const brandCallLeads = diallerLeadsList.filter(l => l.brand_id === selectedBrandForCalls?.id);
  const queueLeads = brandCallLeads.filter(l => callStageFilter === 'all' || l.funnel_stage === callStageFilter);
  const selectedCalls = activeCallLead ? leadCalls : [];
  const callIntegration = selectedBrandForCalls?.id ? getBrandIntegrationFor(selectedBrandForCalls.id) : null;
  const callProvider = String(callIntegration?.call_provider || 'manual');
  const callModeLabel = callProvider === 'twilio' ? 'Managed browser phone' : 'Open phone app';
  const callableLeads = brandCallLeads.filter(lead => lead.phone).length;
  const needsNumbers = brandCallLeads.length - callableLeads;

  return (
    <div className="call-workspace" style={{ ['--call-accent' as any]: selectedBrandForCalls?.color || 'var(--accent)' }}>
      <div className="call-command-bar">
        <div className="call-title-block" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleSelectCommunications} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '6px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <i className="fas fa-arrow-left"></i>
            <span>Back</span>
          </button>
          <div className="call-app-mark"><i className="fas fa-headset"></i></div>
          <div>
            <h3>Brand Call Desk</h3>
            <p>Choose a brand, narrow by stage, call the right contacts, and log outcomes immediately.</p>
          </div>
        </div>
        <select
          value={selectedBrandForCalls?.id || ''}
          onChange={e => {
            const brand = managedBrands.find(b => b.id === e.target.value);
            if (brand) {
              setSelectedBrandForCalls(brand);
              setCallStageFilter('all');
              setActiveCallLead(null);
              setDiallerLead(null);
              setCallNotes('');
              setCallFollowUpDate('');
            }
          }}
        >
          {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="channel-readiness-strip channel-readiness-strip--call">
        <span><i className="fas fa-circle"></i>{callModeLabel}</span>
        <strong>{callableLeads}/{brandCallLeads.length} contacts have phone numbers</strong>
        <em>{callIntegration?.call_number || 'No brand call number saved'}</em>
        <small>{callProvider === 'twilio' ? 'Managed browser calling is selected. If it is not fully enabled yet, agents can still open the phone app and log results.' : 'Calls open in the device phone app. When the call ends, save the outcome, notes, and follow-up.'}</small>
        <button
          type="button"
          onClick={() => {
            setActiveTab('integrations');
            setIntegrationBrandId(selectedBrandForCalls?.id || integrationBrandId);
            setActiveIntegrationChannel('call');
          }}
        >
          <i className="fas fa-sliders"></i>
          Call setup
        </button>
      </div>

      <div className="call-guidance-grid">
        <div>
          <i className="fas fa-list-check"></i>
          <strong>Work the queue</strong>
          <span>Pick a brand and stage so agents only see the contacts they should call next.</span>
        </div>
        <div>
          <i className="fas fa-phone-volume"></i>
          <strong>Start the call</strong>
          <span>Click Call now. DirotiQ opens the saved number and starts a timer for the agent.</span>
        </div>
        <div>
          <i className="fas fa-clipboard-check"></i>
          <strong>Save the result</strong>
          <span>Save outcome, duration, notes, objections, and the next follow-up date in one place.</span>
        </div>
        {needsNumbers > 0 && (
          <div>
            <i className="fas fa-triangle-exclamation"></i>
            <strong>{needsNumbers} need numbers</strong>
            <span>Add phone numbers before assigning those leads to a calling queue.</span>
          </div>
        )}
      </div>

      <div className="call-stage-row">
        <button type="button" className={callStageFilter === 'all' ? 'active' : ''} onClick={() => setCallStageFilter('all')}>All <span>{brandCallLeads.length}</span></button>
        {getBrandStageOptions(selectedBrandForCalls?.id).map(stg => {
          const count = brandCallLeads.filter(l => l.funnel_stage === stg).length;
          return (
            <button key={stg} type="button" className={callStageFilter === stg ? 'active' : ''} onClick={() => setCallStageFilter(stg)}>
              {stg} <span>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="call-client-shell">
        <aside className="call-lead-rail">
          <div className="call-rail-header">
            <strong>Call Queue</strong>
            <span>{queueLeads.length} contacts</span>
          </div>
          <div className="call-lead-list">
            {queueLeads.length === 0 ? (
              <div className="call-empty-state"><i className="fas fa-phone-slash"></i><span>No callable contacts in this stage.</span></div>
            ) : queueLeads.map(l => {
              const isSelected = activeCallLead?.id === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`call-lead-item ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCallLead(l);
                    setActiveLead(l);
                    setDiallerLead(l);
                    setCallNotes('');
                    setCallFollowUpDate('');
                    loadLeadDetailsHistory(l.id);
                  }}
                >
                  <span className="call-avatar">{l.name.charAt(0)}</span>
                  <span className="call-lead-copy">
                    <strong>{l.name}</strong>
                    <small>{l.phone || 'No phone saved'} | {l.funnel_stage}</small>
                  </span>
                  {!l.phone && <span className="call-missing-number">Add number</span>}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="call-focus-panel">
          {activeCallLead ? (
            <div className="call-active-card">
              <div className="call-active-header">
                <div>
                  <span>Selected Contact</span>
                  <h4>{activeCallLead.name}</h4>
                  <p>{activeCallLead.phone || 'No phone number'} | {activeCallLead.email || 'No email'}</p>
                </div>
                <span className="pill pill-blue">{activeCallLead.funnel_stage}</span>
              </div>

              <div className={`call-ring-panel ${isCalling && diallerLead?.id === activeCallLead.id ? 'calling' : ''}`}>
                <div className="call-ring-icon"><i className="fas fa-phone-volume"></i></div>
                <div>
                  <strong>{isCalling && diallerLead?.id === activeCallLead.id ? 'Call in progress' : 'Ready to call'}</strong>
                  <span>{isCalling && diallerLead?.id === activeCallLead.id ? `${Math.floor(callSeconds / 60)}m ${callSeconds % 60}s` : 'Opens the saved number and starts the timer'}</span>
                </div>
                {isCalling && diallerLead?.id === activeCallLead.id ? (
                  <button type="button" className="call-hangup-btn" onClick={handleEndSimulatedCall}><i className="fas fa-phone-slash"></i> End call</button>
                ) : (
                  <button type="button" className="call-start-btn" onClick={() => handleStartSimulatedCall(activeCallLead)} disabled={!activeCallLead.phone}><i className="fas fa-phone"></i> {activeCallLead.phone ? 'Call now' : 'Add phone first'}</button>
                )}
              </div>

              <form className="call-notes-form" onSubmit={handleLogCallSubmit}>
                <div className="call-outcome-pills">
                  {['Connected', 'No Answer', 'Left Voicemail', 'Follow-Up Needed'].map(outcome => (
                    <button key={outcome} type="button" className={callOutcome === outcome ? 'active' : ''} onClick={() => setCallOutcome(outcome)}>
                      {outcome}
                    </button>
                  ))}
                </div>
                <div className="call-form-grid">
                  <label>
                    <span>Outcome</span>
                    <select value={callOutcome} onChange={e => setCallOutcome(e.target.value)}>
                      <option value="Connected">Connected</option>
                      <option value="No Answer">No Answer</option>
                      <option value="Left Voicemail">Left Voicemail</option>
                      <option value="Busy">Busy / Requested Callback</option>
                      <option value="Interested">Interested</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Wrong Number">Wrong Number</option>
                      <option value="Follow-Up Needed">Follow-Up Needed</option>
                    </select>
                  </label>
                  <label>
                    <span>Duration</span>
                    <input type="number" value={callDuration} onChange={e => setCallDuration(parseInt(e.target.value) || 0)} />
                  </label>
                  <label>
                    <span>Follow-up Date</span>
                    <input type="date" value={callFollowUpDate} onChange={e => setCallFollowUpDate(e.target.value)} />
                  </label>
                </div>
                <label className="call-note-block">
                  <span>Call Notes</span>
                  <select
                    value=""
                    onChange={e => {
                      const template = messageTemplates.find(t => t.id === e.target.value);
                      if (template && activeCallLead) {
                        setCallNotes(applyTemplateVars(template.body, activeCallLead, selectedBrandForCalls));
                      }
                    }}
                    style={{ marginBottom: '8px', padding: '9px 11px', borderRadius: '9px', border: '1px solid var(--border)' }}
                  >
                    <option value="">Use call script...</option>
                    {messageTemplates
                      .filter(t => t.brand_id === selectedBrandForCalls?.id && t.channel === 'call' && t.is_active !== false)
                      .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <textarea value={callNotes} onChange={e => setCallNotes(e.target.value)} placeholder="What happened on the call? Add objections, interest level, next step, or anything the team should know." rows={8} />
                </label>
                <div className="call-form-footer">
                  <span>Notes are saved to the lead timeline together with the call log.</span>
                  <button type="submit" className="btn btn-primary" disabled={callSaving} style={{ background: selectedBrandForCalls?.color || 'var(--accent)' }}>
                    {callSaving ? 'Saving...' : <><i className="fas fa-clipboard-check"></i> Save call notes</>}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="call-empty-compose">
              <i className="fas fa-headset"></i>
              <h4>Select a contact to call</h4>
              <p>Names are the main focus here. Pick a brand, choose a stage, then open a contact to start calling and logging notes.</p>
            </div>
          )}
        </main>

        <aside className="call-context-rail">
          <div className="call-context-card">
            <span>Brand Queue</span>
            <strong>{selectedBrandForCalls?.name}</strong>
            <p>{brandCallLeads.length} callable contacts, {queueLeads.length} in this stage.</p>
          </div>
          <div className="call-context-card">
            <span>Recent Calls</span>
            {selectedCalls.length > 0 ? (
              <div className="call-history-list">
                {selectedCalls.slice(0, 6).map(c => (
                  <div key={c.id}>
                    <strong>{c.outcome || 'Call logged'}</strong>
                    <small>{c.duration || 0}s | {c.created_at ? new Date(c.created_at).toLocaleString() : 'Recently'}</small>
                    {c.notes && <p>{c.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p>{activeCallLead ? 'No calls logged for this contact yet.' : 'Select a contact to see call history.'}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
