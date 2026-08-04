// Small helper utilities for follow-up and workflow logic
import { Lead } from '../types';

export const normalizeStage = (s?: string) => (String(s || '').toLowerCase().trim());

export const FINAL_STAGES = new Set(['won', 'lost', 'resolved', 'closed']);

export const isFinalStage = (lead: Lead) => {
  const stage = normalizeStage(lead.funnel_stage);
  return FINAL_STAGES.has(stage);
};

export const parseDateOnly = (value?: string | null): Date | null => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // If value looks like YYYY-MM-DD or starts with that, parse as local date-only
  const datePart = raw.split('T')[0];
  const ymd = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // If numeric timestamp
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    const asDate = raw.length >= 12 ? new Date(numeric) : new Date(numeric * 1000);
    if (!Number.isNaN(asDate.getTime())) {
      const dt = new Date(asDate);
      dt.setHours(0,0,0,0);
      return dt;
    }
  }

  // Fallback to Date parsing and then normalize to midnight
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0,0,0,0);
  return parsed;
};

export const isDoNotContact = (lead: Lead) => {
  return lead.custom_fields?.do_not_contact === true || String(lead.custom_fields?.do_not_contact || '').toLowerCase() === 'true';
};

export const isFollowUpDue = (lead: Lead) => {
  if (!lead.follow_up_date) return false;
  if (isDoNotContact(lead)) return false;
  if (isFinalStage(lead)) return false;
  const due = parseDateOnly(lead.follow_up_date);
  if (!due) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  return due.getTime() <= today.getTime();
};

export const getFollowUpLabel = (lead: Lead) => {
  const due = parseDateOnly(lead.follow_up_date);
  if (!due) return { label: 'No reminder', urgent: false };
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { label: 'Due today', urgent: true };
  if (diff <= 2) return { label: `Due in ${diff}d`, urgent: true };
  return { label: `Due in ${diff}d`, urgent: false };
};
