import React, { useRef } from 'react';
import axios from 'axios';
import { Brand, Lead, EmailLog, EmailConnection, MessageTemplate } from '../types';
import { toUserFacingError } from '../utils/userFacingError';

/** Gmail-style list date: time for today, short date otherwise. Full option for reader header. */
export function formatMailboxDateTime(
  value: string | number | Date | null | undefined,
  options?: { full?: boolean },
): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  if (options?.full) {
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const dayDiff = Math.round((startOfToday.getTime() - startOfMsg.getTime()) / dayMs);
  if (dayDiff === 0) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (dayDiff === 1) return 'Yesterday';
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface EmailTrackingPageProps {
  leads: Lead[];
  selectedBrandForEmail: Brand | null;
  setSelectedBrandForEmail: (brand: Brand) => void;
  emailStageFilter: string;
  setEmailStageFilter: (stage: string) => void;
  activeEmailLead: Lead | null;
  setActiveEmailLead: (lead: Lead | null) => void;
  allSentEmails: EmailLog[];
  fetchAllSentEmails: () => Promise<void>;
  getBrandIntegrationFor: (brandId: string) => any;
  emailConnections: EmailConnection[];
  getEmailAccountsForIntegration: (integration: any) => any[];
  selectedEmailAccountId: string;
  setSelectedEmailAccountId: (id: string) => void;
  outlookSyncing: boolean;
  gmailSyncing: boolean;
  customMailboxSyncing: boolean;
  syncOutlookMessages: (brandId?: string) => Promise<void>;
  syncGmailReplies: (brandId?: string) => Promise<void>;
  syncCustomMailboxMessages: (brandId?: string) => Promise<void>;
  emailProviderFilter: string;
  setEmailProviderFilter: React.Dispatch<React.SetStateAction<any>>;
  emailMailboxFilter: string;
  setEmailMailboxFilter: React.Dispatch<React.SetStateAction<any>>;
  getEmailActionSummary: (emails: EmailLog[]) => any;
  isEmailActionable: (email: EmailLog) => boolean;
  getEmailActionBucket: (email: EmailLog) => string;
  emailSearchQuery: string;
  setEmailSearchQuery: (query: string) => void;
  emailPage: number;
  setEmailPage: React.Dispatch<React.SetStateAction<number>>;
  selectedMailboxEmailIds: Set<string>;
  setSelectedMailboxEmailIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedEmailLogId: string;
  setSelectedEmailLogId: (id: string) => void;
  emailReplyBody: string;
  setEmailReplyBody: (body: string) => void;
  directEmailOpen: boolean;
  setDirectEmailOpen: (open: boolean) => void;
  directEmailTo: string;
  setDirectEmailTo: (email: string) => void;
  directEmailName: string;
  setDirectEmailName: (name: string) => void;
  emailSubject: string;
  setEmailSubject: (subject: string) => void;
  emailContent: string;
  setEmailContent: (content: string) => void;
  emailTemplateSel: string;
  setEmailTemplateSel: (template: string) => void;
  emailAttachments: any[];
  setEmailAttachments: React.Dispatch<React.SetStateAction<any[]>>;
  emailSending: boolean;
  setEmailSending: (sending: boolean) => void;
  prepareEmailAttachments: () => Promise<any[]>;
  sendDirectBrandEmail: (brand: Brand | null, to: string, name: string, subject: string, body: string, template: string, attachments?: any[]) => Promise<void>;
  showToast: (msg: string, isError?: boolean) => void;
  messageTemplates: MessageTemplate[];
  EMAIL_TEMPLATES: Record<string, any[]>;
  applyEmailTemplateVars: (template: string, lead: Lead, brand: Brand | null) => string;
  addEmailAttachmentFiles: (files: FileList) => void;
  sendTrackedEmail: (lead: Lead, subject: string, body: string, brand: Brand | null, template: string, attachments?: any[]) => Promise<void>;
  handleSelectCommunications: () => void;
  managedBrands: Brand[];
  activeBrands: Brand[];
  setActiveLead: (lead: Lead | null) => void;
  handleSelectBrand: (brand: Brand) => void;
  loadLeadDetailsHistory: (id: string) => void;
  handleDeleteEmail: (id: string) => Promise<void>;
  handleBulkDeleteMailboxEmails: () => void;
  markEmailReadInCrm: (email: EmailLog) => void;
  isInboundCrmEmail: (email: EmailLog) => boolean;
  sanitizeEmailHtml: (html?: string) => string;
  openingAttachmentKey: string | null;
  handleEmailAttachment: (emailLogId: string, file: any, action: 'open' | 'download') => void;
  handleEmailAction: (emailIds: string[], action: string, msg: string) => void;
  emailProviderMode: 'internal' | 'gmail' | 'outlook' | 'yahoo' | 'smtp';
  setEmailProviderMode: (mode: 'internal' | 'gmail' | 'outlook' | 'yahoo' | 'smtp') => void;
  setIntegrationBrandId: (id: string) => void;
  integrationBrandId: string;
  setActiveIntegrationChannel: (channel: 'leads' | 'traffic' | 'email' | 'whatsapp' | 'call') => void;
  /** Jump to Integrations → Email for the current brand mailbox setup. */
  onOpenIntegrationsEmail?: () => void;
}

export function EmailTrackingPage(props: EmailTrackingPageProps) {
  const {
    leads,
    selectedBrandForEmail,
    setSelectedBrandForEmail,
    emailStageFilter,
    setEmailStageFilter,
    activeEmailLead,
    setActiveEmailLead,
    allSentEmails,
    fetchAllSentEmails,
    getBrandIntegrationFor,
    emailConnections,
    getEmailAccountsForIntegration,
    selectedEmailAccountId,
    setSelectedEmailAccountId,
    outlookSyncing,
    gmailSyncing,
    customMailboxSyncing,
    syncOutlookMessages,
    syncGmailReplies,
    syncCustomMailboxMessages,
    emailProviderFilter,
    setEmailProviderFilter,
    emailMailboxFilter,
    setEmailMailboxFilter,
    getEmailActionSummary,
    isEmailActionable,
    getEmailActionBucket,
    emailSearchQuery,
    setEmailSearchQuery,
    emailPage,
    setEmailPage,
    selectedMailboxEmailIds,
    setSelectedMailboxEmailIds,
    selectedEmailLogId,
    setSelectedEmailLogId,
    emailReplyBody,
    setEmailReplyBody,
    directEmailOpen,
    setDirectEmailOpen,
    directEmailTo,
    setDirectEmailTo,
    directEmailName,
    setDirectEmailName,
    emailSubject,
    setEmailSubject,
    emailContent,
    setEmailContent,
    emailTemplateSel,
    setEmailTemplateSel,
    emailAttachments,
    setEmailAttachments,
    emailSending,
    setEmailSending,
    prepareEmailAttachments,
    sendDirectBrandEmail,
    showToast,
    messageTemplates,
    EMAIL_TEMPLATES,
    applyEmailTemplateVars,
    addEmailAttachmentFiles,
    sendTrackedEmail,
    handleSelectCommunications,
    managedBrands,
    activeBrands,
    setActiveLead,
    handleSelectBrand,
    loadLeadDetailsHistory,
    handleDeleteEmail,
    handleBulkDeleteMailboxEmails,
    markEmailReadInCrm,
    isInboundCrmEmail,
    sanitizeEmailHtml,
    openingAttachmentKey,
    handleEmailAttachment,
    handleEmailAction,
    emailProviderMode,
    setEmailProviderMode,
    setIntegrationBrandId,
    integrationBrandId,
    setActiveIntegrationChannel,
    onOpenIntegrationsEmail,
  } = props;

  const goConnectMailbox = () => {
    setIntegrationBrandId(selectedBrandForEmail?.id || integrationBrandId);
    setActiveIntegrationChannel('email');
    onOpenIntegrationsEmail?.();
  };

  const emailAttachmentInputRef = useRef<HTMLInputElement | null>(null);

  const brandLeads = leads.filter(l => l.brand_id === selectedBrandForEmail?.id);
  const queueLeads = brandLeads.filter(l => emailStageFilter === 'all' || l.funnel_stage === emailStageFilter);
  const selectedHistory = activeEmailLead ? allSentEmails.filter(e => e.lead_id === activeEmailLead.id) : [];
  const emailIntegration = selectedBrandForEmail?.id ? getBrandIntegrationFor(selectedBrandForEmail.id) : null;

  const connectedEmailAccounts = emailConnections
    .filter(connection => connection.brand_id === selectedBrandForEmail?.id)
    .map(connection => ({
      id: connection.id,
      label: `${connection.provider_email}`,
      provider: connection.provider,
      email: connection.provider_email,
      reply_to: connection.provider_email,
      is_default: Boolean(connection.is_default),
    }));

  const legacyEmailAccounts = emailIntegration ? getEmailAccountsForIntegration(emailIntegration).filter(account => account.id !== 'primary') : [];
  const connectedAccountIds = new Set(connectedEmailAccounts.map(account => `${account.provider}:${account.email}`));
  const emailAccounts = [
    ...connectedEmailAccounts,
    ...legacyEmailAccounts.filter(account => !connectedAccountIds.has(`${account.provider}:${account.email}`)),
  ];

  const selectedEmailAccount = emailAccounts.find(account => account.id === selectedEmailAccountId) || emailAccounts.find(account => account.is_default) || emailAccounts[0];
  const hasGmailAccount = emailAccounts.some(account => account.provider === 'gmail')
    || emailIntegration?.email_provider === 'gmail'
    || Boolean(emailIntegration?.gmail_refresh_token || emailIntegration?.gmail_connected_email);
  const canSyncGmail = hasGmailAccount;
  const canSyncOutlook = emailAccounts.some(account => account.provider === 'outlook')
    || Boolean(emailIntegration?.outlook_refresh_token || emailIntegration?.outlook_connected_email);
  const canSyncCustomMailbox = emailAccounts.some(account => account.provider === 'custom_smtp_imap');
  const syncLabel = canSyncOutlook ? 'Sync Outlook' : canSyncGmail ? 'Sync Gmail' : canSyncCustomMailbox ? 'Sync Mailbox' : 'Sync';
  const syncBusy = outlookSyncing || gmailSyncing || customMailboxSyncing;

  const runMailboxSync = () => canSyncOutlook
    ? syncOutlookMessages(selectedBrandForEmail?.id)
    : canSyncGmail
      ? syncGmailReplies(selectedBrandForEmail?.id)
      : syncCustomMailboxMessages(selectedBrandForEmail?.id);

  const hasWorkingEmailAccount = emailAccounts.some(account => (
    account.provider === 'gmail' ||
    (['outlook', 'yahoo', 'smtp'].includes(account.provider || '') && Boolean(account.email && account.smtp_host && account.smtp_port && account.smtp_password_env))
  ));

  const brandEmailActivity = allSentEmails
    .filter(e => e.brand_id === selectedBrandForEmail?.id || brandLeads.some(l => l.id === e.lead_id))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  const providerFilteredActivity = emailProviderFilter === 'all'
    ? brandEmailActivity
    : brandEmailActivity.filter(e => (e.provider || 'internal') === emailProviderFilter);

  const providerCounts = {
    all: brandEmailActivity.length,
    gmail: brandEmailActivity.filter(e => e.provider === 'gmail').length,
    outlook: brandEmailActivity.filter(e => e.provider === 'outlook').length,
    yahoo: brandEmailActivity.filter(e => e.provider === 'yahoo').length,
    smtp: brandEmailActivity.filter(e => e.provider === 'smtp').length,
    internal: brandEmailActivity.filter(e => !e.provider || e.provider === 'internal').length,
  };

  const inboxEmails = providerFilteredActivity.filter(e => (e.mailbox_folder === 'inbox') || ((e.status === 'received' || e.direction === 'inbound') && !['spam', 'trash'].includes(e.mailbox_folder || '')));
  const sentEmails = providerFilteredActivity.filter(e => e.mailbox_folder === 'sent' || (e.status !== 'received' && e.status !== 'failed' && e.direction !== 'inbound' && !['drafts', 'spam', 'trash'].includes(e.mailbox_folder || '')));
  const draftEmails = providerFilteredActivity.filter(e => e.mailbox_folder === 'drafts');
  const spamEmails = providerFilteredActivity.filter(e => e.mailbox_folder === 'spam');
  const trashEmails = providerFilteredActivity.filter(e => e.mailbox_folder === 'trash');
  const failedEmails = providerFilteredActivity.filter(e => e.status === 'failed');

  const brandActionSummary = getEmailActionSummary(brandEmailActivity);
  const providerActionSummary = getEmailActionSummary(providerFilteredActivity);
  const brandActionableEmails = brandEmailActivity.filter(isEmailActionable);
  const actionInboxEmails = providerFilteredActivity.filter(isEmailActionable);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const overdueCutoff = Date.now() - (24 * 60 * 60 * 1000);
  const todayActionEmails = actionInboxEmails.filter(email => email.created_at && new Date(email.created_at).getTime() >= todayStart.getTime());
  const overdueActionEmails = actionInboxEmails.filter(email => {
    const created = email.created_at ? new Date(email.created_at).getTime() : Date.now();
    return created < overdueCutoff;
  });

  const getActionLabel = (email: EmailLog) => ({
    needs_reply: 'Needs reply',
    follow_up: 'Follow up',
    handled: 'Handled',
    ignored: 'Ignored',
    marketing: 'Marketing',
    sent: 'Sent',
  }[getEmailActionBucket(email)]);

  const folderMessages = (emailMailboxFilter === 'action'
    ? actionInboxEmails
    : emailMailboxFilter === 'today'
      ? todayActionEmails
      : emailMailboxFilter === 'overdue'
        ? overdueActionEmails
        : emailMailboxFilter === 'inbox'
          ? inboxEmails
          : emailMailboxFilter === 'sent'
            ? sentEmails
            : emailMailboxFilter === 'drafts'
              ? draftEmails
              : emailMailboxFilter === 'spam'
                ? spamEmails
                : emailMailboxFilter === 'trash'
                  ? trashEmails
                  : emailMailboxFilter === 'failed'
                    ? failedEmails
                    : brandEmailActivity);

  const query = emailSearchQuery.trim().toLowerCase();
  const mailboxMessages = query
    ? folderMessages.filter(e => [
        e.subject,
        e.from_email,
        e.to_email,
        e.to_name,
        e.template_name,
        e.created_by
      ].some(v => String(v || '').toLowerCase().includes(query)))
    : folderMessages;

  const emailsPerPage = 15;
  const totalEmailPages = Math.max(1, Math.ceil(mailboxMessages.length / emailsPerPage));
  const safeEmailPage = Math.min(emailPage, totalEmailPages);
  const visibleMailboxMessages = mailboxMessages.slice((safeEmailPage - 1) * emailsPerPage, safeEmailPage * emailsPerPage);
  const visibleMailboxIds = visibleMailboxMessages.map(message => message.id);
  const visibleSelectedCount = visibleMailboxIds.filter(id => selectedMailboxEmailIds.has(id)).length;
  const allVisibleMailboxSelected = visibleMailboxIds.length > 0 && visibleSelectedCount === visibleMailboxIds.length;

  const selectedEmailLog = selectedEmailLogId ? brandEmailActivity.find(e => e.id === selectedEmailLogId) || null : null;
  const selectedEmailLead = selectedEmailLog?.lead_id ? brandLeads.find(l => l.id === selectedEmailLog.lead_id) : null;

  const replyToEmail = selectedEmailLog?.status === 'received' || selectedEmailLog?.direction === 'inbound'
    ? selectedEmailLog?.from_email
    : selectedEmailLog?.to_email;

  const forwardSubject = selectedEmailLog?.subject?.toLowerCase().startsWith('fwd:')
    ? selectedEmailLog.subject
    : `Fwd: ${selectedEmailLog?.subject || ''}`.trim();

  const replySubject = selectedEmailLog?.subject?.toLowerCase().startsWith('re:')
    ? selectedEmailLog.subject
    : `Re: ${selectedEmailLog?.subject || ''}`.trim();

  const totalBrandEmails = brandEmailActivity.length;
  const isEmailComposing = directEmailOpen || Boolean(activeEmailLead);

  const folderTitle = emailMailboxFilter === 'all'
    ? 'All brand email'
    : emailMailboxFilter === 'action'
      ? 'Action Inbox'
      : emailMailboxFilter === 'today'
        ? 'New today'
        : emailMailboxFilter === 'overdue'
          ? 'Overdue replies'
          : emailMailboxFilter === 'inbox'
            ? 'Inbox'
            : emailMailboxFilter === 'sent'
              ? 'Sent mail'
              : emailMailboxFilter === 'drafts'
                ? 'Drafts'
                : emailMailboxFilter === 'spam'
                  ? 'Spam'
                  : emailMailboxFilter === 'trash'
                    ? 'Trash'
                    : 'Failed sends';

  const selectedFolder = selectedEmailLog?.mailbox_folder || (selectedEmailLog?.status === 'failed' ? 'failed' : selectedEmailLog?.direction === 'inbound' || selectedEmailLog?.status === 'received' ? 'inbox' : 'sent');

  const selectedStatusText = selectedFolder === 'spam'
    ? 'Spam'
    : selectedFolder === 'trash'
      ? 'Trash'
      : selectedFolder === 'drafts'
        ? 'Draft'
        : selectedEmailLog?.status === 'received'
          ? 'Reply received'
          : selectedEmailLog?.status === 'failed'
            ? 'Failed send'
            : 'Sent';

  const selectedActionBucket = selectedEmailLog ? getEmailActionBucket(selectedEmailLog) : 'sent';

  const getEmailProviderLabel = () => {
    return emailProviderMode === 'gmail' ? 'Gmail active' : emailProviderMode === 'internal' ? 'Internal queue' : `${emailProviderMode} active`;
  };

  return (
    <div className="email-workspace" style={{ ['--mail-accent' as any]: selectedBrandForEmail?.color || 'var(--accent)' }}>
      <div className="email-command-bar">
        <div className="email-title-block" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleSelectCommunications} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '6px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <i className="fas fa-arrow-left"></i>
            <span>Back</span>
          </button>
          <div className="email-app-mark">
            <i className="fas fa-envelope-open-text"></i>
          </div>
          <div>
            <h3>Brand Mail Desk</h3>
            <p>Compose, track, and manage all brand email communications from connected providers.</p>
          </div>
        </div>

        <div className="email-command-actions">
          <select
            value={selectedBrandForEmail?.id || ''}
            onChange={e => {
              const brand = managedBrands.find(b => b.id === e.target.value);
              if (brand) {
                setSelectedBrandForEmail(brand);
                setActiveEmailLead(null);
                setEmailStageFilter('all');
                setEmailSubject('');
                setEmailContent('');
                setEmailTemplateSel('');
                setEmailAttachments([]);
                setDirectEmailOpen(false);
                setDirectEmailTo('');
                setDirectEmailName('');
                setSelectedEmailLogId('');
                setEmailReplyBody('');
                setSelectedEmailAccountId('');
              }
            }}
          >
            {activeBrands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {emailAccounts.length > 0 && (
            <select
              value={selectedEmailAccount?.id || ''}
              onChange={e => {
                const account = emailAccounts.find(item => item.id === e.target.value);
                setSelectedEmailAccountId(e.target.value);
                if (account?.provider) setEmailProviderMode(account.provider as any);
              }}
              title="Choose which brand email account to use for sending"
            >
              {emailAccounts.map(account => (
                <option key={account.id} value={account.id}>{account.label || account.email} ({account.provider})</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setDirectEmailOpen(true);
              setActiveEmailLead(null);
              setEmailSubject('');
              setEmailContent('');
              setEmailTemplateSel('');
              setEmailAttachments([]);
              setDirectEmailTo('');
              setDirectEmailName('');
              setSelectedEmailLogId('');
              setEmailReplyBody('');
            }}
            style={{ background: selectedBrandForEmail?.color || 'var(--accent)', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}
          >
            <i className="fas fa-pen"></i> New Email
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={runMailboxSync}
            disabled={syncBusy || (!canSyncOutlook && !canSyncGmail && !canSyncCustomMailbox)}
            title={canSyncOutlook ? 'Import recent Outlook messages for this brand' : canSyncGmail ? 'Import recent Gmail replies for this brand' : canSyncCustomMailbox ? 'Import recent custom mailbox messages for this brand' : 'Connect a mailbox before syncing'}
            style={{ whiteSpace: 'nowrap', padding: '9px 12px' }}
          >
            <i className={`fas ${syncBusy ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}></i> {syncBusy ? 'Syncing' : syncLabel}
          </button>
        </div>
      </div>

      {!isEmailComposing && emailAccounts.length === 0 && (
        <div className="email-empty-hero">
          <div className="email-empty-hero__icon"><i className="fas fa-envelope-open-text"></i></div>
          <h3>Connect Gmail to see brand mail here</h3>
          <p>
            No mailbox is connected for <strong>{selectedBrandForEmail?.name || 'this brand'}</strong>.
            Connect Gmail (or Outlook), then import the last 30 days so the CRM stays in sync with your inbox.
          </p>
          <div className="email-empty-hero__actions">
            <button type="button" className="btn btn-primary" onClick={goConnectMailbox}>
              <i className="fas fa-plug"></i> Connect mailbox
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!canSyncGmail && !canSyncOutlook && !canSyncCustomMailbox}
              onClick={runMailboxSync}
              title="Import messages after connecting"
            >
              <i className="fas fa-cloud-arrow-down"></i> Import last 30 days
            </button>
          </div>
          <ul className="email-empty-hero__steps">
            <li><strong>1.</strong> Integrations → Email → Connect Gmail</li>
            <li><strong>2.</strong> Approve send, read, and mailbox edit permissions</li>
            <li><strong>3.</strong> Click Sync / Import — messages appear in this mailbox</li>
          </ul>
        </div>
      )}

      {!isEmailComposing && (
        <div className="mailbox-focus-strip">
          <button type="button" className={emailMailboxFilter === 'action' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('action'); setEmailPage(1); setSelectedEmailLogId(''); }}>
            <i className="fas fa-bolt"></i><span>Action Inbox</span><strong>{actionInboxEmails.length}</strong>
          </button>
          <button type="button" className={emailMailboxFilter === 'today' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('today'); setEmailPage(1); setSelectedEmailLogId(''); }}>
            <i className="fas fa-sun"></i><span>New today</span><strong>{providerActionSummary.newToday}</strong>
          </button>
          <button type="button" className={emailMailboxFilter === 'overdue' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('overdue'); setEmailPage(1); setSelectedEmailLogId(''); }}>
            <i className="fas fa-clock"></i><span>Overdue</span><strong>{providerActionSummary.overdue}</strong>
          </button>
          <button type="button" onClick={() => handleEmailAction(brandActionableEmails.map(email => email.id), 'handled', 'All items marked as reviewed. New replies will continue to appear here.')} disabled={brandActionableEmails.length === 0}>
            <i className="fas fa-check-double"></i><span>Mark all reviewed</span><strong>{brandActionSummary.actionInbox}</strong>
          </button>
        </div>
      )}

      {!isEmailComposing && (
        selectedEmailLog ? (
          <main className="mailbox-reader mailbox-reader--full">
            <div className="mailbox-reader-toolbar">
              <button type="button" onClick={() => { setSelectedEmailLogId(''); setEmailReplyBody(''); }}>
                <i className="fas fa-arrow-left"></i>
                Back
              </button>
              <button
                type="button"
                disabled={!replyToEmail}
                onClick={() => {
                  const replyBox = document.querySelector('.mailbox-reply-box textarea') as HTMLTextAreaElement | null;
                  replyBox?.focus();
                }}
              >
                <i className="fas fa-reply"></i>
                Reply
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirectEmailOpen(true);
                  setActiveEmailLead(null);
                  setDirectEmailTo('');
                  setDirectEmailName('');
                  setEmailSubject(forwardSubject);
                  setEmailContent(`<p></p><hr /><p><strong>Forwarded message</strong></p>${selectedEmailLog.html_content || selectedEmailLog.body || ''}`);
                  setEmailTemplateSel('');
                  setEmailReplyBody('');
                }}
              >
                <i className="fas fa-share"></i>
                Forward
              </button>
              {selectedEmailLog && isInboundCrmEmail(selectedEmailLog) && (
                <>
                  <button
                    type="button"
                    className={selectedActionBucket === 'needs_reply' ? 'mailbox-action-active' : ''}
                    onClick={() => handleEmailAction([selectedEmailLog.id], 'needs_reply', 'Email marked as needing a reply.')}
                  >
                    <i className="fas fa-reply"></i>
                    Needs reply
                  </button>
                  <button
                    type="button"
                    className={selectedActionBucket === 'handled' ? 'mailbox-action-active' : ''}
                    onClick={() => handleEmailAction([selectedEmailLog.id], 'handled', 'Email marked handled.')}
                  >
                    <i className="fas fa-check"></i>
                    Handled
                  </button>
                  <button
                    type="button"
                    className={selectedActionBucket === 'ignored' ? 'mailbox-action-active' : ''}
                    onClick={() => handleEmailAction([selectedEmailLog.id], 'ignored', 'Email ignored for action counts.')}
                  >
                    <i className="fas fa-eye-slash"></i>
                    Ignore
                  </button>
                  <button
                    type="button"
                    className={selectedActionBucket === 'marketing' ? 'mailbox-action-active' : ''}
                    onClick={() => handleEmailAction([selectedEmailLog.id], 'marketing', 'Email marked as marketing.')}
                  >
                    <i className="fas fa-filter-circle-xmark"></i>
                    Marketing
                  </button>
                </>
              )}
              <button
                type="button"
                className="mailbox-danger-action"
                onClick={async () => {
                  if (!selectedEmailLog?.id || !confirm('Delete this email from the CRM and Gmail? It will not reappear after sync.')) return;
                  await handleDeleteEmail(selectedEmailLog.id);
                  setSelectedEmailLogId('');
                  setEmailReplyBody('');
                }}
              >
                <i className="fas fa-trash"></i>
                Delete
              </button>
            </div>
            <div className="mailbox-reader-header">
              <div>
                <span className={`mailbox-status-pill ${selectedFolder === 'spam' || selectedFolder === 'trash' || selectedEmailLog.status === 'failed' ? 'failed' : selectedFolder === 'inbox' ? 'inbound' : 'sent'}`}>
                  {selectedStatusText}
                </span>
                {isInboundCrmEmail(selectedEmailLog) && (
                  <span className={`mailbox-action-pill ${selectedActionBucket}`}>
                    {getActionLabel(selectedEmailLog)}
                  </span>
                )}
                <h3>{selectedEmailLog.subject || '(No subject)'}</h3>
                <p>
                  {selectedEmailLog.status === 'received' || selectedEmailLog.direction === 'inbound'
                    ? `From ${selectedEmailLog.from_email || 'unknown sender'}`
                    : `To ${selectedEmailLog.to_email || selectedEmailLead?.email || 'recipient'}`}
                  {' | '}
{formatMailboxDateTime(selectedEmailLog.created_at, { full: true })}
                  {(selectedEmailLog.status === 'received' || selectedEmailLog.direction === 'inbound') && selectedEmailLog.read_at && (
                    <>
                      {' | '}
                      Read in CRM by {selectedEmailLog.read_by_name || 'staff'}
                    </>
                  )}
                </p>
              </div>
              {selectedEmailLead && (
                <button type="button" className="btn btn-ghost" onClick={() => { setActiveLead(selectedEmailLead); if (selectedBrandForEmail) handleSelectBrand(selectedBrandForEmail); loadLeadDetailsHistory(selectedEmailLead.id); }}>
                  Open lead
                </button>
              )}
            </div>
            {selectedEmailLog.error_message && (
              <div className="mailbox-error">{selectedEmailLog.error_message}</div>
            )}
            <div className="mailbox-email-body" dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(selectedEmailLog.html_content || selectedEmailLog.body) }} />
            {Array.isArray(selectedEmailLog.attachments) && selectedEmailLog.attachments.length > 0 && (
              <div className="mailbox-attachments">
                <strong>Attachments</strong>
                <div>
                  {selectedEmailLog.attachments.map((file: any) => {
                    const isProviderFile = Boolean(file.provider && file.provider !== 'outgoing' && !file.data_base64);
                    const attachmentKey = file?.id || file?.name || '';
                    const openRequestKey = `${selectedEmailLog.id}:${attachmentKey}:open`;
                    const downloadRequestKey = `${selectedEmailLog.id}:${attachmentKey}:download`;
                    const isOpeningAttachment = openingAttachmentKey === openRequestKey;
                    const isDownloadingAttachment = openingAttachmentKey === downloadRequestKey;
                    return (
                      <span key={file.id || file.name} className="mailbox-attachment-chip">
                        <i className={`fas ${String(file.mime_type || '').startsWith('image/') ? 'fa-image' : String(file.mime_type || '').includes('pdf') ? 'fa-file-pdf' : 'fa-paperclip'}`}></i>
                        <strong>{file.name || 'Attachment'}</strong>
                        {file.size ? <small>{Math.round(Number(file.size) / 1024)} KB</small> : null}
                        {isProviderFile && <em title="CRM will fetch this from the connected mailbox the first time you open it.">Mailbox file</em>}
                        <button type="button" disabled={Boolean(openingAttachmentKey)} onClick={() => handleEmailAttachment(selectedEmailLog.id, file, 'open')} title="Open attachment">
                          {isOpeningAttachment && <i className="fas fa-spinner fa-spin"></i>}
                          {isOpeningAttachment ? 'Opening' : 'Open'}
                        </button>
                        <button type="button" disabled={Boolean(openingAttachmentKey)} onClick={() => handleEmailAttachment(selectedEmailLog.id, file, 'download')} title="Download attachment">
                          {isDownloadingAttachment && <i className="fas fa-spinner fa-spin"></i>}
                          {isDownloadingAttachment ? 'Downloading' : 'Download'}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <form
              className="mailbox-reply-box"
              onSubmit={async e => {
                e.preventDefault();
                if (!replyToEmail) { showToast('This email does not have a reply address.', true); return; }
                if (!emailReplyBody.trim()) { showToast('Write a reply first.', true); return; }
                setEmailSending(true);
                try {
                  await sendDirectBrandEmail(selectedBrandForEmail, replyToEmail, '', replySubject, emailReplyBody, 'CRM Email Reply');
                  if (selectedEmailLog?.id && isInboundCrmEmail(selectedEmailLog)) {
                    await axios.patch(`/api/emails/${encodeURIComponent(selectedEmailLog.id)}/action`, {
                      action_status: 'handled',
                    });
                  }
                  showToast(`Reply sent to ${replyToEmail}.`);
                  setEmailReplyBody('');
                  await fetchAllSentEmails();
                } catch (err: any) {
                  showToast(toUserFacingError(err, 'Could not send reply.'), true);
                } finally {
                  setEmailSending(false);
                }
              }}
            >
              <div>
                <strong>Reply in CRM</strong>
                <span>{replyToEmail ? `To ${replyToEmail}` : 'No reply address found'}</span>
              </div>
              <textarea value={emailReplyBody} onChange={e => setEmailReplyBody(e.target.value)} placeholder="Write your reply..." />
              <button type="submit" className="btn btn-primary" disabled={emailSending || !replyToEmail || !emailReplyBody.trim()} style={{ background: selectedBrandForEmail?.color || 'var(--accent)' }}>
                <i className="fas fa-reply"></i> {emailSending ? 'Sending...' : 'Send reply'}
              </button>
            </form>
          </main>
        ) : (
          <div className="mailbox-shell mailbox-shell--list">
            <aside className="mailbox-folders">
              <button type="button" className={emailMailboxFilter === 'all' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('all'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                <i className="fas fa-inbox"></i>
                <span>All Mail</span>
                <strong>{brandEmailActivity.length}</strong>
              </button>
              <button type="button" className={emailMailboxFilter === 'action' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('action'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                <i className="fas fa-bolt"></i>
                <span>Action Inbox</span>
                <strong>{actionInboxEmails.length}</strong>
              </button>
              <button type="button" className={emailMailboxFilter === 'today' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('today'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                <i className="fas fa-sun"></i>
                <span>New Today</span>
                <strong>{todayActionEmails.length}</strong>
              </button>
              <button type="button" className={emailMailboxFilter === 'overdue' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('overdue'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                <i className="fas fa-clock"></i>
                <span>Overdue</span>
                <strong>{overdueActionEmails.length}</strong>
              </button>
              <button type="button" className={emailMailboxFilter === 'inbox' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('inbox'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                <i className="fas fa-reply"></i>
                <span>Inbox</span>
                <strong>{inboxEmails.length}</strong>
              </button>
              <button type="button" className={emailMailboxFilter === 'sent' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('sent'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                <i className="fas fa-paper-plane"></i>
                <span>Sent</span>
                <strong>{sentEmails.length}</strong>
              </button>
              <button type="button" className={emailMailboxFilter === 'drafts' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('drafts'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                <i className="fas fa-file-pen"></i>
                <span>Drafts</span>
                <strong>{draftEmails.length}</strong>
              </button>
              <button type="button" className={emailMailboxFilter === 'spam' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('spam'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                <i className="fas fa-ban"></i>
                <span>Spam</span>
                <strong>{spamEmails.length}</strong>
              </button>
              <button type="button" className={emailMailboxFilter === 'trash' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('trash'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                <i className="fas fa-trash"></i>
                <span>Trash</span>
                <strong>{trashEmails.length}</strong>
              </button>
              <button type="button" className={emailMailboxFilter === 'failed' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('failed'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                <i className="fas fa-triangle-exclamation"></i>
                <span>Failed</span>
                <strong>{failedEmails.length}</strong>
              </button>
            </aside>

            <section className="mailbox-list mailbox-list--wide">
              <div className="mailbox-list-header mailbox-list-header--gmail">
                <div>
                  <span>{selectedBrandForEmail?.name}</span>
                  <strong>{folderTitle}</strong>
                </div>
                <div className="mailbox-list-tools">
                  <div className="mailbox-search">
                    <i className="fas fa-search"></i>
                    <input
                      value={emailSearchQuery}
                      onChange={e => { setEmailSearchQuery(e.target.value); setEmailPage(1); }}
                      placeholder="Search email address or subject"
                    />
                  </div>
                  <button type="button" onClick={runMailboxSync} disabled={syncBusy || (!canSyncOutlook && !canSyncGmail && !canSyncCustomMailbox)}>
                    <i className={`fas ${syncBusy ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}></i>
                    Refresh
                  </button>
                </div>
              </div>
              <div className="mailbox-action-summary">
                <span><i className="fas fa-bolt"></i><strong>{brandActionSummary.actionInbox}</strong> action inbox</span>
                <span><i className="fas fa-sun"></i><strong>{brandActionSummary.newToday}</strong> new today</span>
                <span><i className="fas fa-clock"></i><strong>{brandActionSummary.overdue}</strong> overdue</span>
                <span><i className="fas fa-filter-circle-xmark"></i><strong>{brandActionSummary.ignored}</strong> handled or ignored</span>
                <button
                  type="button"
                  onClick={() => handleEmailAction(brandActionableEmails.map(email => email.id), 'handled', 'Inbox reviewed. Future customer replies will still appear here.')}
                  disabled={brandActionableEmails.length === 0}
                >
                  <i className="fas fa-check-double"></i>
                  Mark reviewed
                </button>
              </div>
              <div className="email-provider-filter-row">
                {([
                  ['all', 'All providers', providerCounts.all],
                  ['gmail', 'Gmail', providerCounts.gmail],
                  ['outlook', 'Outlook', providerCounts.outlook],
                  ['yahoo', 'Yahoo', providerCounts.yahoo],
                  ['smtp', 'SMTP', providerCounts.smtp],
                  ['internal', 'CRM only', providerCounts.internal],
                ] as const).map(([provider, label, count]) => (
                  <button
                    key={provider}
                    type="button"
                    className={emailProviderFilter === provider ? 'active' : ''}
                    onClick={() => { setEmailProviderFilter(provider); setEmailPage(1); setSelectedEmailLogId(''); setEmailReplyBody(''); }}
                  >
                    {label}
                    <strong>{count}</strong>
                  </button>
                ))}
              </div>
              <div className="mailbox-pagination">
                <span>
                  {mailboxMessages.length === 0
                    ? '0 emails'
                    : `${((safeEmailPage - 1) * emailsPerPage) + 1}-${Math.min(safeEmailPage * emailsPerPage, mailboxMessages.length)} of ${mailboxMessages.length}`}
                </span>
                <button type="button" disabled={safeEmailPage <= 1} onClick={() => setEmailPage(prev => Math.max(1, prev - 1))}>
                  <i className="fas fa-chevron-left"></i>
                  Newer
                </button>
                <button type="button" disabled={safeEmailPage >= totalEmailPages} onClick={() => setEmailPage(prev => Math.min(totalEmailPages, prev + 1))}>
                  Older
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
              <div className={`mailbox-selection-toolbar ${selectedMailboxEmailIds.size > 0 ? 'has-selection' : ''}`}>
                <label className="mailbox-select-all">
                  <input
                    type="checkbox"
                    checked={allVisibleMailboxSelected}
                    disabled={visibleMailboxIds.length === 0}
                    onChange={e => {
                      setSelectedMailboxEmailIds(prev => {
                        const next = new Set(prev);
                        visibleMailboxIds.forEach(id => {
                          if (e.target.checked) next.add(id);
                          else next.delete(id);
                        });
                        return next;
                      });
                    }}
                  />
                  <span>{allVisibleMailboxSelected ? 'Unselect visible' : 'Select visible'}</span>
                </label>
                <strong>{selectedMailboxEmailIds.size} selected</strong>
                {selectedMailboxEmailIds.size > 0 && (
                  <div>
                    <button type="button" onClick={() => setSelectedMailboxEmailIds(new Set())}>
                      Clear
                    </button>
                    <button type="button" onClick={() => handleEmailAction(Array.from(selectedMailboxEmailIds), 'needs_reply', 'Selected emails marked as needing replies.')}>
                      Needs reply
                    </button>
                    <button type="button" onClick={() => handleEmailAction(Array.from(selectedMailboxEmailIds), 'handled', 'Selected emails marked handled.')}>
                      Handled
                    </button>
                    <button type="button" onClick={() => handleEmailAction(Array.from(selectedMailboxEmailIds), 'ignored', 'Selected emails ignored for action counts.')}>
                      Ignore
                    </button>
                    <button type="button" onClick={() => handleEmailAction(Array.from(selectedMailboxEmailIds), 'marketing', 'Selected emails marked as marketing.')}>
                      Marketing
                    </button>
                    <button type="button" className="danger" onClick={handleBulkDeleteMailboxEmails}>
                      <i className="fas fa-trash"></i> Delete selected
                    </button>
                  </div>
                )}
              </div>
              <div className="mailbox-message-list mailbox-message-list--gmail">
                {visibleMailboxMessages.length === 0 ? (
                  <div className="mailbox-empty mailbox-empty--teach">
                    <i className="fas fa-inbox"></i>
                    <strong>No emails in this folder yet</strong>
                    <span>
                      {canSyncGmail || canSyncOutlook || canSyncCustomMailbox
                        ? 'Pull the last 30 days from the connected mailbox, or switch folders above.'
                        : 'Connect a mailbox for this brand, then import recent mail.'}
                    </span>
                    <div className="mailbox-empty__actions">
                      {(canSyncGmail || canSyncOutlook || canSyncCustomMailbox) ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={runMailboxSync} disabled={syncBusy}>
                          <i className={`fas ${syncBusy ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-down'}`}></i>
                          {syncBusy ? 'Importing…' : 'Import last 30 days'}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-primary btn-sm" onClick={goConnectMailbox}>
                          <i className="fas fa-plug"></i> Connect mailbox
                        </button>
                      )}
                    </div>
                  </div>
                ) : visibleMailboxMessages.map(message => {
                  const isInbound = message.status === 'received' || message.direction === 'inbound';
                  const isSelected = selectedMailboxEmailIds.has(message.id);
                  const actionBucket = getEmailActionBucket(message);
                  return (
                    <div
                      key={message.id}
                      role="button"
                      tabIndex={0}
                      className={`mailbox-row ${isInbound && !message.read_at ? 'unread' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => { setSelectedEmailLogId(message.id); setEmailReplyBody(''); markEmailReadInCrm(message); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedEmailLogId(message.id);
                          setEmailReplyBody('');
                          markEmailReadInCrm(message);
                        }
                      }}
                    >
                      <label className="mailbox-row-check" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          aria-label={`Select email ${message.subject || 'No subject'}`}
                          onChange={e => {
                            setSelectedMailboxEmailIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(message.id);
                              else next.delete(message.id);
                              return next;
                            });
                          }}
                        />
                      </label>
                      <span className="mailbox-row-star"><i className="far fa-star"></i></span>
                      <strong className="mailbox-row-person">{isInbound ? (message.from_email || 'unknown sender') : (message.to_email || 'recipient')}</strong>
                      <span className="mailbox-row-subject">{message.subject || '(No subject)'}</span>
                      <span className={`mailbox-action-pill mailbox-action-pill--row ${actionBucket}`}>{getActionLabel(message)}</span>
                      <span className="mailbox-row-snippet">
                        {Array.isArray(message.attachments) && message.attachments.length > 0 && <i className="fas fa-paperclip mailbox-row-attachment-icon" title="Has attachment"></i>}
                        {String(message.html_content || message.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 130)}
                      </span>
                      <time
                        className="mailbox-row-date"
                        dateTime={message.created_at || undefined}
                        title={formatMailboxDateTime(message.created_at, { full: true })}
                      >
                        {formatMailboxDateTime(message.created_at)}
                      </time>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )
      )}

      {isEmailComposing && (
        <div className={`email-client-shell ${isEmailComposing ? 'email-client-shell--compose' : ''}`}>
          <main className="email-compose-plane">
            {directEmailOpen ? (
              <form
                className="email-compose-card"
                onSubmit={async e => {
                  e.preventDefault();
                  if (!directEmailTo.trim() || !emailSubject.trim() || !emailContent.trim()) {
                    showToast('Recipient, subject, and email body are required.', true);
                    return;
                  }
                  setEmailSending(true);
                  try {
                    const outgoingAttachments = await prepareEmailAttachments();
                    await sendDirectBrandEmail(selectedBrandForEmail, directEmailTo, directEmailName, emailSubject, emailContent, emailTemplateSel || 'Direct Brand Email', outgoingAttachments);
                    showToast('Direct email sent from the brand mail desk.');
                    setDirectEmailTo('');
                    setDirectEmailName('');
                    setEmailSubject('');
                    setEmailContent('');
                    setEmailTemplateSel('');
                    setEmailAttachments([]);
                    setDirectEmailOpen(false);
                  } catch (err: any) {
                    showToast(toUserFacingError(err, 'Failed to send direct email.'), true);
                  } finally {
                    setEmailSending(false);
                  }
                }}
              >
                <div className="email-compose-top">
                  <div className="email-compose-identity">
                    <div className="email-account-avatar">{(selectedBrandForEmail?.name || 'M').charAt(0)}</div>
                    <div>
                      <span>New Email</span>
                      <h4>{selectedBrandForEmail?.name} Mail Desk</h4>
                      <p>{emailProviderMode === 'gmail' ? 'Connected Gmail mailbox' : emailProviderMode === 'internal' ? 'CRM tracked outbox' : `${emailProviderMode} mailbox slot`}</p>
                    </div>
                  </div>
                  <div className="email-compose-status email-compose-status--live">
                    <i className="fas fa-circle"></i>
                    {getEmailProviderLabel()}
                  </div>
                </div>

                <div className="email-mailbox-strip">
                  <div>
                    <span>From</span>
                    <strong>{selectedBrandForEmail?.name} Mail Desk</strong>
                    <small>{emailProviderMode === 'gmail' ? 'Gmail connector' : emailProviderMode === 'internal' ? 'tracked only' : `${emailProviderMode} connector slot`}</small>
                  </div>
                  <div>
                    <span>Draft</span>
                    <strong>Composer ready</strong>
                    <small>No send until confirmed</small>
                  </div>
                </div>

                <div className="email-recipient-grid">
                  <label className="premium-field">
                    <span>Recipient email</span>
                    <input
                      type="email"
                      placeholder="name@company.com"
                      value={directEmailTo}
                      onChange={e => setDirectEmailTo(e.target.value)}
                    />
                  </label>
                  <label className="premium-field">
                    <span>Recipient name</span>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={directEmailName}
                      onChange={e => setDirectEmailName(e.target.value)}
                    />
                  </label>
                </div>

                {directEmailTo.trim() && (
                  <div className="email-recipient-chips">
                    <span className="recipient-chip">
                      <i className="fas fa-user"></i>
                      {directEmailName || directEmailTo}
                      <small>{directEmailTo}</small>
                    </span>
                  </div>
                )}

                <div className="email-template-row">
                  <div>
                    <span>Template</span>
                    <strong>{emailTemplateSel || 'Custom email'}</strong>
                  </div>
                  <button type="button" className="email-ai-pill" title="Template preview">
                    <i className="fas fa-wand-magic-sparkles"></i> Preview
                  </button>
                </div>

                <select
                  className="email-template-picker"
                  value={emailTemplateSel}
                  onChange={e => {
                    const val = e.target.value;
                    setEmailTemplateSel(val);
                    if (val === 'custom') {
                      setEmailTemplateSel('');
                      return;
                    }
                    const savedEmailTemplates = messageTemplates
                      .filter(t => t.brand_id === selectedBrandForEmail?.id && t.channel === 'email' && t.is_active !== false)
                      .map(t => ({ id: t.id, name: t.name, subject: t.subject || '', body: t.body }));
                    const matched = [...savedEmailTemplates, ...(EMAIL_TEMPLATES[selectedBrandForEmail?.id || ''] || [])].find(tp => tp.name === val);
                    if (matched && selectedBrandForEmail) {
                      const tempLead = {
                        id: 'direct-email',
                        brand_id: selectedBrandForEmail.id,
                        brand_name: selectedBrandForEmail.name,
                        name: directEmailName || directEmailTo || 'there',
                        email: directEmailTo,
                        phone: '',
                        funnel_stage: 'Direct Email',
                        tags: [],
                        custom_fields: {},
                        created_at: new Date().toISOString()
                      } as Lead;
                      setEmailSubject(applyEmailTemplateVars(matched.subject, tempLead, selectedBrandForEmail));
                      setEmailContent(applyEmailTemplateVars(matched.body, tempLead, selectedBrandForEmail));
                    }
                  }}
                >
                  <option value="custom">Custom email</option>
                  <option value="" disabled>Use a saved template</option>
                  {[
                    ...messageTemplates
                      .filter(t => t.brand_id === selectedBrandForEmail?.id && t.channel === 'email' && t.is_active !== false)
                      .map(t => ({ id: t.id, name: t.name })),
                    ...(EMAIL_TEMPLATES[selectedBrandForEmail?.id || ''] || [])
                  ].map(tp => (
                    <option key={tp.id} value={tp.name}>{tp.name}</option>
                  ))}
                </select>

                <label className="premium-field premium-field--flat">
                  <span>Subject</span>
                  <input
                    type="text"
                    placeholder="Write a clear subject line"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                  />
                </label>

                <div className="email-format-toolbar" aria-label="Email formatting shortcuts">
                  {['B', 'I', 'Link', 'List', 'Quote'].map(item => (
                    <button key={item} type="button" title={`${item} formatting placeholder`}>{item}</button>
                  ))}
                  <span></span>
                  <button type="button" title="Attach files" onClick={() => emailAttachmentInputRef.current?.click()}><i className="fas fa-paperclip"></i></button>
                  <button type="button" title="Insert template variable"><i className="fas fa-code"></i></button>
                  <button type="button" title="AI writing assist"><i className="fas fa-wand-magic-sparkles"></i></button>
                </div>

                <textarea
                  className="email-body-editor"
                  placeholder="Write a standalone email from this brand. If Gmail is connected, this will send through Gmail."
                  value={emailContent}
                  onChange={e => setEmailContent(e.target.value)}
                />

                <input
                  ref={emailAttachmentInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files) addEmailAttachmentFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                />

                <div
                  className="email-attachment-zone"
                  style={{ cursor: 'pointer' }}
                  onClick={() => emailAttachmentInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    addEmailAttachmentFiles(e.dataTransfer.files);
                  }}
                >
                  <i className="fas fa-paperclip"></i>
                  <div>
                    <strong>Attachments</strong>
                    <span>{emailAttachments.length ? `${emailAttachments.length} file${emailAttachments.length === 1 ? '' : 's'} selected` : 'Click to attach files or drag them here.'}</span>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); emailAttachmentInputRef.current?.click(); }}>Attach</button>
                </div>

                {emailAttachments.length > 0 && (
                  <div className="email-selected-attachments">
                    {emailAttachments.map((file, idx) => (
                      <span key={`${file.name}-${file.size}-${idx}`}>
                        <i className={`fas ${file.type.startsWith('image/') ? 'fa-image' : file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-lines'}`}></i>
                        <strong>{file.name}</strong>
                        <small>{Math.ceil(file.size / 1024)} KB</small>
                        <button type="button" onClick={() => setEmailAttachments(files => files.filter(item => item !== file))}>
                          <i className="fas fa-xmark"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="email-signature-preview">
                  <span>Signature preview</span>
                  <p>{selectedBrandForEmail?.name} Team</p>
                </div>

                <div className="email-compose-footer">
                  <div>
                    <strong>Standalone brand email</strong>
                    <span>This send will be tracked under {selectedBrandForEmail?.name} once sent.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => { setDirectEmailOpen(false); setEmailSubject(''); setEmailContent(''); setEmailTemplateSel(''); setEmailAttachments([]); }}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-ghost">
                      <i className="fas fa-clock"></i> Send later
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={emailSending || !directEmailTo.trim()} style={{ background: selectedBrandForEmail?.color || 'var(--accent)' }}>
                      {emailSending ? 'Sending...' : <><i className="fas fa-paper-plane"></i> Send email</>}
                    </button>
                  </div>
                </div>
              </form>
            ) : activeEmailLead ? (
              <form
                className="email-compose-card"
                onSubmit={async e => {
                  e.preventDefault();
                  if (!emailSubject.trim() || !emailContent.trim()) {
                    showToast('Subject and email body are required.', true);
                    return;
                  }
                  setEmailSending(true);
                  try {
                    const outgoingAttachments = await prepareEmailAttachments();
                    await sendTrackedEmail(activeEmailLead, emailSubject, emailContent, selectedBrandForEmail, emailTemplateSel || 'Manual Ad-hoc Mail', outgoingAttachments);
                    showToast('Email logged in the brand outbox.');
                    setEmailSubject('');
                    setEmailContent('');
                    setEmailTemplateSel('');
                    setEmailAttachments([]);
                  } catch {
                    showToast('Failed to send mail.', true);
                  } finally {
                    setEmailSending(false);
                  }
                }}
              >
                <div className="email-compose-top">
                  <div className="email-compose-identity">
                    <div className="email-account-avatar">{activeEmailLead.name.charAt(0)}</div>
                    <div>
                      <span>Compose</span>
                      <h4>{activeEmailLead.name}</h4>
                      <p>{activeEmailLead.email || 'No email address'} - {activeEmailLead.funnel_stage}</p>
                    </div>
                  </div>
                  <div className="email-compose-status email-compose-status--live">
                    <i className="fas fa-circle"></i>
                    {getEmailProviderLabel()}
                  </div>
                </div>

                <div className="email-mailbox-strip">
                  <div>
                    <span>From</span>
                    <strong>{selectedBrandForEmail?.name} Mail Desk</strong>
                    <small>{emailProviderMode === 'internal' ? 'tracked only' : `${emailProviderMode} connector slot`}</small>
                  </div>
                  <div>
                    <span>To</span>
                    <strong>{activeEmailLead.email || 'Missing email'}</strong>
                    <small>{activeEmailLead.funnel_stage}</small>
                  </div>
                  <div>
                    <span>Draft</span>
                    <strong>Composer ready</strong>
                    <small>No send until confirmed</small>
                  </div>
                </div>

                <div className="email-recipient-chips">
                  <span className="recipient-chip">
                    <i className="fas fa-user"></i>
                    {activeEmailLead.name}
                    <small>{activeEmailLead.email || 'Missing email'}</small>
                  </span>
                </div>

                <div className="email-template-row">
                  <div>
                    <span>Template</span>
                    <strong>{emailTemplateSel || 'Custom email'}</strong>
                  </div>
                  <button type="button" className="email-ai-pill" title="Template preview">
                    <i className="fas fa-wand-magic-sparkles"></i> Preview
                  </button>
                </div>

                <select
                  className="email-template-picker"
                  value={emailTemplateSel}
                  onChange={e => {
                    const val = e.target.value;
                    setEmailTemplateSel(val);
                    if (val === 'custom') {
                      setEmailTemplateSel('');
                      return;
                    }
                    const savedEmailTemplates = messageTemplates
                      .filter(t => t.brand_id === selectedBrandForEmail?.id && t.channel === 'email' && t.is_active !== false)
                      .map(t => ({ id: t.id, name: t.name, subject: t.subject || '', body: t.body }));
                    const matched = [...savedEmailTemplates, ...(EMAIL_TEMPLATES[selectedBrandForEmail?.id || ''] || [])].find(tp => tp.name === val);
                    if (matched && selectedBrandForEmail) {
                      setEmailSubject(applyEmailTemplateVars(matched.subject, activeEmailLead, selectedBrandForEmail));
                      setEmailContent(applyEmailTemplateVars(matched.body, activeEmailLead, selectedBrandForEmail));
                    }
                  }}
                >
                  <option value="custom">Custom email</option>
                  <option value="" disabled>Use a saved template</option>
                  {[
                    ...messageTemplates
                      .filter(t => t.brand_id === selectedBrandForEmail?.id && t.channel === 'email' && t.is_active !== false)
                      .map(t => ({ id: t.id, name: t.name })),
                    ...(EMAIL_TEMPLATES[selectedBrandForEmail?.id || ''] || [])
                  ].map(tp => (
                    <option key={tp.id} value={tp.name}>{tp.name}</option>
                  ))}
                </select>

                <label className="premium-field premium-field--flat">
                  <span>Subject</span>
                  <input
                    type="text"
                    placeholder="Write a clear subject line"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                  />
                </label>

                <div className="email-format-toolbar" aria-label="Email formatting shortcuts">
                  {['B', 'I', 'Link', 'List', 'Quote'].map(item => (
                    <button key={item} type="button" title={`${item} formatting placeholder`}>{item}</button>
                  ))}
                  <span></span>
                  <button type="button" title="Attach files" onClick={() => emailAttachmentInputRef.current?.click()}><i className="fas fa-paperclip"></i></button>
                  <button type="button" title="Insert template variable"><i className="fas fa-code"></i></button>
                </div>

                <textarea
                  className="email-body-editor"
                  placeholder="Write the email body here. Plain text and HTML snippets can both be logged now, then mapped to a real provider later."
                  value={emailContent}
                  onChange={e => setEmailContent(e.target.value)}
                />

                <input
                  ref={emailAttachmentInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files) addEmailAttachmentFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                />

                <div
                  className="email-attachment-zone"
                  style={{ cursor: 'pointer' }}
                  onClick={() => emailAttachmentInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    addEmailAttachmentFiles(e.dataTransfer.files);
                  }}
                >
                  <i className="fas fa-paperclip"></i>
                  <div>
                    <strong>Attachments</strong>
                    <span>{emailAttachments.length ? `${emailAttachments.length} file${emailAttachments.length === 1 ? '' : 's'} selected` : 'Click to attach files or drag them here.'}</span>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); emailAttachmentInputRef.current?.click(); }}>Attach</button>
                </div>

                {emailAttachments.length > 0 && (
                  <div className="email-selected-attachments">
                    {emailAttachments.map((file, idx) => (
                      <span key={`${file.name}-${file.size}-${idx}`}>
                        <i className={`fas ${file.type.startsWith('image/') ? 'fa-image' : file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-lines'}`}></i>
                        <strong>{file.name}</strong>
                        <small>{Math.ceil(file.size / 1024)} KB</small>
                        <button type="button" onClick={() => setEmailAttachments(files => files.filter(item => item !== file))}>
                          <i className="fas fa-xmark"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="email-signature-preview">
                  <span>Signature preview</span>
                  <p>{selectedBrandForEmail?.name} Team</p>
                </div>

                <div className="email-compose-footer">
                  <div>
                    <strong>Lead-linked email</strong>
                    <span>This message will be tracked on {activeEmailLead.name}'s timeline once sent.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => { setActiveEmailLead(null); setEmailSubject(''); setEmailContent(''); setEmailTemplateSel(''); setEmailAttachments([]); }}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-ghost">
                      <i className="fas fa-clock"></i> Send later
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={emailSending || !activeEmailLead.email} style={{ background: selectedBrandForEmail?.color || 'var(--accent)' }}>
                      {emailSending ? 'Sending...' : <><i className="fas fa-paper-plane"></i> Send tracked email</>}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="email-compose-empty">
                <i className="fas fa-pen-nib"></i>
                <h4>Pick a lead to compose</h4>
                <p>The lead list stays nearby, but the main area is reserved for writing and previewing the email.</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}