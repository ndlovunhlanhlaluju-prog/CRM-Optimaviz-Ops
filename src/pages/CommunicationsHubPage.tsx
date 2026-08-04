import React from 'react';
import { Brand, User } from '../types';

interface CommunicationsHubPageProps {
  commsTotalAttention: number;
  commsChannelsActive: number;
  fetchAllSentEmails: () => void;
  fetchAllWhatsAppMessages: () => void;
  fetchAllCallLogs: () => void;
  fetchTeamMessages: () => void;
  openCommunicationTool: (tab: 'email-tracking' | 'whatsapp-tracking' | 'calls' | 'team-chat' | 'integrations', brandId?: string) => void;
  commsHighPriority: number;
  commsRepliesWaiting: number;
  commsBrandStatus: any[];
  emailAttentionCount: number;
  emailBrandRows: any[];
  whatsappAttentionCount: number;
  whatsappBrandRows: any[];
  dueCallActionCount: number;
  callBrandRows: any[];
  teamGlobalUnreadCount: number;
  usersList: User[];
  user: User | null;
  visibleNotificationItems: any[];
  activeBrands: Brand[];
  getBrandIntegrationFor: (brandId: string) => any;
  getEmailAccountsForIntegration: (integration: any) => any[];
  isWhatsAppCloudConfigured: (integration: any, brandId: string) => boolean;
  whatsappNumbers: Record<string, string>;
}

export function CommunicationsHubPage(props: CommunicationsHubPageProps) {
  const {
    commsTotalAttention,
    commsChannelsActive,
    fetchAllSentEmails,
    fetchAllWhatsAppMessages,
    fetchAllCallLogs,
    fetchTeamMessages,
    openCommunicationTool,
    commsHighPriority,
    commsRepliesWaiting,
    commsBrandStatus,
    emailAttentionCount,
    emailBrandRows,
    whatsappAttentionCount,
    whatsappBrandRows,
    dueCallActionCount,
    callBrandRows,
    teamGlobalUnreadCount,
    usersList,
    user,
    visibleNotificationItems,
    activeBrands,
    getBrandIntegrationFor,
    getEmailAccountsForIntegration,
    isWhatsAppCloudConfigured,
    whatsappNumbers,
  } = props;

  const handleDeleteEmail = async (emailId: string) => {
    try {
      // Delete email from CRM
      // Your existing CRM deletion logic here

      // Call server-side function to delete email from Gmail
      await fetch('/api/deleteEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailId }),
      });
    } catch (error) {
      console.error('Failed to delete email:', error);
    }
  };
  return (
    <div className="comm-hub">
      {/* ═══════════════ HERO - COMMAND CENTER ═══════════════ */}
      <section className="comm-hero">
        <div className="comm-hero__bg" aria-hidden="true">
          <span className="comm-hero__glow" />
        </div>
        <div className="comm-hero__head">
          <div className="comm-hero__eyebrow">
            <span className="comm-hero__pulse" data-state={commsTotalAttention > 0 ? 'live' : 'idle'} />
            <span>{commsChannelsActive > 0 ? `${commsChannelsActive} channels active` : 'All channels clear'}</span>
          </div>
          <div className="comm-hero__actions">
            <button type="button" className="comm-ghost-btn" onClick={() => { fetchAllSentEmails(); fetchAllWhatsAppMessages(); fetchAllCallLogs(); fetchTeamMessages(); }}>
              <i className="fas fa-arrows-rotate" /> Refresh
            </button>
            <button type="button" className="btn btn-primary comm-hero__cta" onClick={() => openCommunicationTool('email-tracking')}>
              <i className="fas fa-pen" /> Compose
            </button>
          </div>
        </div>

        <div className="comm-hero__body">
          <div className="comm-hero__headline">
            <span className="comm-hero__count" data-empty={commsTotalAttention === 0}>{commsTotalAttention}</span>
            <div className="comm-hero__headline-copy">
              <h2>{commsTotalAttention > 0 ? 'conversations require attention' : 'Inbox zero — you\u2019re all caught up'}</h2>
              <p>Live triage of replies, unread chats and overdue follow-ups across every brand.</p>
            </div>
          </div>

          <div className="comm-hero__metrics">
            <div className="comm-metric" data-tone="danger">
              <i className="fas fa-fire" />
              <div>
                <strong>{commsHighPriority}</strong>
                <small>High priority</small>
              </div>
            </div>
            <div className="comm-hero__metrics-sep" />
            <div className="comm-metric" data-tone="info">
              <i className="fas fa-reply" />
              <div>
                <strong>{commsRepliesWaiting}</strong>
                <small>Replies waiting</small>
              </div>
            </div>
            <div className="comm-hero__metrics-sep" />
            <div className="comm-metric" data-tone="brand">
              <i className="fas fa-layer-group" />
              <div>
                <strong>{commsBrandStatus.filter(s => s.attention > 0).length}/{commsBrandStatus.length}</strong>
                <small>Brands active</small>
              </div>
            </div>
          </div>
        </div>

        {/* Brand status rail — the actionable status indicators */}
        <div className="comm-brand-rail">
          {commsBrandStatus.map(({ brand, attention, email, whatsapp, calls, severity }) => (
            <button key={brand.id} type="button"
              className="comm-brand-pill"
              data-severity={severity}
              style={{ ['--pill-brand' as any]: brand.color }}
              onClick={() => attention > 0
                ? (email > 0 ? openCommunicationTool('email-tracking', brand.id) : whatsapp > 0 ? openCommunicationTool('whatsapp-tracking', brand.id) : openCommunicationTool('calls', brand.id))
                : openCommunicationTool('email-tracking', brand.id)}>
              <span className="comm-brand-pill__logo">
                <img src={brand.logo} alt="" />
                <span className="comm-brand-pill__dot" data-severity={severity} />
              </span>
              <span className="comm-brand-pill__copy">
                <strong>{brand.name}</strong>
                <small>{attention > 0 ? `${attention} pending - ${email > 0 ? `${email} mail` : ''}${email > 0 && whatsapp > 0 ? ' - ' : ''}${whatsapp > 0 ? `${whatsapp} WA` : ''}${(email > 0 || whatsapp > 0) && calls > 0 ? ' - ' : ''}${calls > 0 ? `${calls} calls` : ''}` : 'All clear'}</small>
              </span>
              <span className="comm-brand-pill__count" data-empty={attention === 0}>{attention}</span>
              <i className="fas fa-arrow-right comm-brand-pill__go" />
            </button>
          ))}
        </div>
      </section>

      {/* ═══════════════ CHANNEL CARDS ═══════════════ */}
      <div className="comm-channels">
        {[
          {
            id: 'email-tracking' as const,
            title: 'Inbox Health',
            eyebrow: 'Email operations',
            icon: 'fa-envelope-open-text',
            tone: '#155e75',
            value: emailAttentionCount,
            metrics: [
              { label: 'Replies waiting', value: emailAttentionCount, tone: '#155e75', icon: 'fa-reply' },
              { label: 'Brands affected', value: emailBrandRows.length, tone: '#0f766e', icon: 'fa-layer-group' },
              { label: 'Avg. response SLA', value: '\u2014', tone: '#475569', icon: 'fa-gauge-high' },
            ],
            detail: emailBrandRows.length ? 'Replies & failed sends needing action' : 'No brand email actions due',
            rows: emailBrandRows.map(row => ({ name: row.brand.name, value: row.emailAttention, color: row.brand.color, logo: row.brand.logo, brand: row.brand.id })),
          },
          {
            id: 'whatsapp-tracking' as const,
            title: 'WhatsApp Pulse',
            eyebrow: 'Chat activity',
            icon: 'fab fa-whatsapp',
            tone: '#16a34a',
            value: whatsappAttentionCount,
            metrics: [
              { label: 'Unread chats', value: whatsappAttentionCount, tone: '#16a34a', icon: 'fa-comment-dots' },
              { label: 'Active brands', value: whatsappBrandRows.length, tone: '#0f766e', icon: 'fa-layer-group' },
              { label: 'Escalations', value: whatsappBrandRows.filter(r => r.whatsappAttention > 5).length, tone: '#f59e0b', icon: 'fa-triangle-exclamation' },
            ],
            detail: whatsappBrandRows.length ? 'Unread & failed chats by brand' : 'No WhatsApp actions due',
            rows: whatsappBrandRows.map(row => ({ name: row.brand.name, value: row.whatsappAttention, color: row.brand.color, logo: row.brand.logo, brand: row.brand.id })),
          },
          {
            id: 'calls' as const,
            title: 'Call Pipeline',
            eyebrow: 'Follow-ups due',
            icon: 'fa-phone',
            tone: '#0f766e',
            value: dueCallActionCount,
            metrics: [
              { label: 'Calls overdue', value: dueCallActionCount, tone: '#0f766e', icon: 'fa-phone-volume' },
              { label: 'Brands affected', value: callBrandRows.length, tone: '#0f766e', icon: 'fa-layer-group' },
              { label: 'Hot leads', value: callBrandRows.filter(r => r.dueCalls > 3).length, tone: '#ef4444', icon: 'fa-fire' },
            ],
            detail: callBrandRows.length ? 'Due call actions by brand' : 'No call follow-ups due',
            rows: callBrandRows.map(row => ({ name: row.brand.name, value: row.dueCalls, color: row.brand.color, logo: row.brand.logo, brand: row.brand.id })),
          },
          {
            id: 'team-chat' as const,
            title: 'Team Signal',
            eyebrow: 'Internal comms',
            icon: 'fa-comments',
            tone: '#0ea5e9',
            value: teamGlobalUnreadCount,
            metrics: [
              { label: 'Unread messages', value: teamGlobalUnreadCount, tone: '#0ea5e9', icon: 'fa-comments' },
              { label: 'Teammates', value: usersList.filter(staff => staff.id !== user?.id).length, tone: '#0f766e', icon: 'fa-users' },
              { label: 'Pending approvals', value: 0, tone: '#475569', icon: 'fa-circle-check' },
            ],
            detail: `${teamGlobalUnreadCount} unread team item${teamGlobalUnreadCount === 1 ? '' : 's'}`,
            rows: [],
          },
        ].map(card => {
          const sev = card.value >= 20 ? 'danger' : card.value >= 5 ? 'warning' : card.value > 0 ? 'info' : 'idle';
          return (
            <button key={card.id} type="button"
              className="comm-card"
              data-severity={sev}
              style={{ ['--card-tone' as any]: card.tone }}
              onClick={() => openCommunicationTool(card.id)}>
              <span className="comm-card__top">
                <span className="comm-card__icon">
                  <i className={card.icon.startsWith('fab ') ? card.icon : `fas ${card.icon}`} />
                </span>
                <span className="comm-card__heading">
                  <span className="comm-card__eyebrow">{card.eyebrow}</span>
                  <strong>{card.title}</strong>
                </span>
                <span className="comm-card__count" data-empty={card.value === 0}>
                  {card.value}
                </span>
              </span>

              <span className="comm-card__metrics">
                {card.metrics.map(m => (
                  <span key={m.label} className="comm-card__metric">
                    <i className={`fas ${m.icon}`} style={{ color: m.tone }} />
                    <strong>{m.value}</strong>
                    <small>{m.label}</small>
                  </span>
                ))}
              </span>

              <span className="comm-card__detail">
                {card.detail}
                <span className="email-timestamp">
                  {new Date().toLocaleString()} {/* Example timestamp, replace with actual email timestamp */}
                </span>
              </span>

              {card.rows.length > 0 && (
                <span className="comm-card__brands">
                  {card.rows.slice(0, 4).map(row => {
                    const rowSev = row.value >= 10 ? 'danger' : row.value >= 3 ? 'warning' : 'info';
                    return (
                      <span key={row.brand} className="comm-chip" data-severity={rowSev} style={{ ['--chip-brand' as any]: row.color }}>
                        <img src={row.logo} alt="" />
                        <span className="comm-chip__name">{row.name}</span>
                        <span className="comm-chip__count">{row.value}</span>
                        <span className="comm-chip__sev" data-severity={rowSev} />
                      </span>
                    );
                  })}
                  {card.rows.length > 4 && (
                    <span className="comm-chip comm-chip--more">
                      +{card.rows.length - 4} more
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════ LOWER GRID - ATTENTION + READINESS ═══════════════ */}
      <div className="comm-layout">
        <section className="comm-panel comm-panel--attention">
          <div className="comm-panel__header">
            <div>
              <span className="comm-panel__eyebrow">Priority queue</span>
              <h3>What needs action</h3>
            </div>
            <button type="button" className="comm-ghost-btn" onClick={() => { fetchAllSentEmails(); fetchAllWhatsAppMessages(); fetchAllCallLogs(); fetchTeamMessages(); }}>
              <i className="fas fa-arrows-rotate" /> Refresh
            </button>
          </div>
          <div className="comm-alert-list">
            {visibleNotificationItems.length > 0 ? visibleNotificationItems.map(item => {
              const sev = item.value >= 10 ? 'danger' : item.value >= 3 ? 'warning' : 'info';
              return (
                <button key={item.label} type="button" className="comm-alert" data-severity={sev} style={{ ['--alert-tone' as any]: item.tone }} onClick={item.action}>
                  <span className="comm-alert__icon">
                    <i className={`fas ${item.icon}`} style={{ color: item.tone }} />
                    <span className="comm-alert__pulse" data-severity={sev} />
                  </span>
                  <span className="comm-alert__body">
                    <strong>{item.label}</strong>
                    <small>{item.value} record{item.value === 1 ? '' : 's'} need review</small>
                  </span>
                  <span className="comm-alert__count" data-severity={sev}>{item.value}</span>
                  <i className="fas fa-arrow-right comm-alert__go" />
                </button>
              );
            }) : (
              <div className="comm-empty">
                <span className="comm-empty__ring"><i className="fas fa-check" /></span>
                <strong>No urgent communication alerts</strong>
                <span>Failed sends, unread messages, and follow-ups will appear here.</span>
              </div>
            )}
          </div>
        </section>

        <section className="comm-panel comm-panel--readiness">
          <div className="comm-panel__header">
            <div>
              <span className="comm-panel__eyebrow">Brand readiness</span>
              <h3>Connected accounts</h3>
            </div>
            <button type="button" className="comm-ghost-btn" onClick={() => openCommunicationTool('integrations')}>
              <i className="fas fa-plug" /> Setup
            </button>
          </div>
          <div className="comm-readiness-list">
            {activeBrands.map(brand => {
              const integration = getBrandIntegrationFor(brand.id);
              const emailAccounts = getEmailAccountsForIntegration(integration);
              const hasWhatsApp = isWhatsAppCloudConfigured(integration, brand.id) || Boolean(whatsappNumbers[brand.id]);
              const ready = emailAccounts.length > 0 && hasWhatsApp;
              return (
                <button key={brand.id} type="button" className="comm-readiness-row" data-ready={ready} style={{ ['--row-brand' as any]: brand.color }} onClick={() => openCommunicationTool(emailAccounts.length > 0 ? 'email-tracking' : 'integrations', brand.id)}>
                  <span className="comm-readiness-row__logo"><img src={brand.logo} alt={brand.name} /></span>
                  <span className="comm-readiness-row__copy">
                    <strong>{brand.name}</strong>
                    <small>
                      <span className="comm-readiness-row__tag" data-on={emailAccounts.length > 0}>{emailAccounts.length} mail</span>
                      <span className="comm-readiness-row__tag" data-on={hasWhatsApp}>{hasWhatsApp ? 'WA ready' : 'WA off'}</span>
                    </small>
                  </span>
                  <span className="comm-readiness-row__status" data-ready={ready}>
                    <span className="comm-readiness-row__dot" />
                    {ready ? 'Ready' : 'Setup'}
                  </span>
                  <i className="fas fa-arrow-right comm-readiness-row__go" />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
