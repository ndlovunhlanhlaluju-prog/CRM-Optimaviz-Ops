import type { Lead } from '../types';
import { isDoNotContact, isFinalStage, parseDateOnly } from './workflow';

export type NotificationCategory =
  | 'team_chat'
  | 'follow_ups'
  | 'missing_contact'
  | 'duplicates'
  | 'do_not_contact'
  | 'email'
  | 'whatsapp'
  | 'call_followups';

export type NotificationPreferences = {
  enabled: Record<NotificationCategory, boolean>;
  /** Critical categories keep alerting after the drawer is opened until resolved or manually dismissed. */
  critical: Record<NotificationCategory, boolean>;
  /**
   * How many days ahead follow-ups should start alerting.
   * 0 = due today or overdue only (default).
   * 3 = due within the next 3 days (including overdue).
   */
  follow_up_remind_days: number;
};

export const NOTIFICATION_CATEGORY_META: {
  id: NotificationCategory;
  label: string;
  description: string;
}[] = [
  { id: 'team_chat', label: 'Team chat', description: 'Unread team messages' },
  { id: 'follow_ups', label: 'Follow-ups', description: 'Lead follow-ups due / upcoming' },
  { id: 'missing_contact', label: 'Missing contact', description: 'Leads missing phone and email' },
  { id: 'duplicates', label: 'Duplicates', description: 'Possible duplicate people' },
  { id: 'do_not_contact', label: 'Do not contact', description: 'Leads marked do-not-contact' },
  { id: 'email', label: 'Email attention', description: 'Inbox / failed brand emails' },
  { id: 'whatsapp', label: 'WhatsApp attention', description: 'Unread / failed WhatsApp' },
  { id: 'call_followups', label: 'Call follow-ups', description: 'Due call follow-ups by brand' },
];

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: {
    team_chat: true,
    follow_ups: true,
    missing_contact: true,
    duplicates: true,
    do_not_contact: true,
    email: true,
    whatsapp: true,
    call_followups: true,
  },
  critical: {
    team_chat: false,
    follow_ups: true,
    missing_contact: false,
    duplicates: false,
    do_not_contact: false,
    email: false,
    whatsapp: false,
    call_followups: false,
  },
  follow_up_remind_days: 0,
};

export function normalizeNotificationPreferences(raw: any): NotificationPreferences {
  const base = DEFAULT_NOTIFICATION_PREFERENCES;
  const enabled = { ...base.enabled };
  const critical = { ...base.critical };
  const rawEnabled = raw?.enabled && typeof raw.enabled === 'object' ? raw.enabled : {};
  const rawCritical = raw?.critical && typeof raw.critical === 'object' ? raw.critical : {};
  (Object.keys(enabled) as NotificationCategory[]).forEach((key) => {
    if (typeof rawEnabled[key] === 'boolean') enabled[key] = rawEnabled[key];
    if (typeof rawCritical[key] === 'boolean') critical[key] = rawCritical[key];
  });
  const days = Number(raw?.follow_up_remind_days);
  return {
    enabled,
    critical,
    follow_up_remind_days: Number.isFinite(days) ? Math.max(0, Math.min(30, Math.round(days))) : base.follow_up_remind_days,
  };
}

export function getNotificationCategory(label: string): NotificationCategory | null {
  const text = String(label || '');
  if (text === 'Unread team messages') return 'team_chat';
  if (text === 'Follow-ups due') return 'follow_ups';
  if (text === 'Missing contact details') return 'missing_contact';
  if (text === 'Duplicate people') return 'duplicates';
  if (text === 'Do-not-contact leads') return 'do_not_contact';
  if (text.endsWith(' email attention') || text.includes(' email attention')) return 'email';
  if (text.endsWith(' WhatsApp attention') || text.includes(' WhatsApp attention')) return 'whatsapp';
  if (text.endsWith(' call follow-ups') || text.includes(' call follow-ups')) return 'call_followups';
  return null;
}

/** Follow-up is alertable when due date is on/before (today + daysAhead). */
export function isFollowUpDueWithinDays(lead: Lead, daysAhead = 0): boolean {
  if (!lead.follow_up_date) return false;
  if (isDoNotContact(lead)) return false;
  if (isFinalStage(lead)) return false;
  const due = parseDateOnly(lead.follow_up_date);
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + Math.max(0, Number(daysAhead) || 0));
  return due.getTime() <= horizon.getTime();
}
