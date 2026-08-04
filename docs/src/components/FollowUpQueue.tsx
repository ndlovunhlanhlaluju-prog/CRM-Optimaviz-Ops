import React, { useMemo, useState } from 'react';
import { Brand, Lead } from '../types';
import { parseDateOnly, isFollowUpDue } from '../utils/workflow';

type QueueMode = 'all' | 'overdue' | 'today';

interface FollowUpQueueProps {
  leads: Lead[];
  brands: Brand[];
  onOpenLead: (lead: Lead) => void;
  onQuickCall?: (lead: Lead) => void;
}

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

// parseDateOnly and isFollowUpDue in utils handle parsing/normalization and exclusion rules
const getDueDate = (lead: Lead) => parseDateOnly(lead.follow_up_date);

const formatDueLabel = (date: Date) => {
  const today = startOfDay(new Date()).getTime();
  const day = startOfDay(date).getTime();
  const diff = Math.round((day - today) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Today';
  return `In ${diff}d`;
};

const getFollowUpReason = (lead: Lead) => {
  const type = String(lead.custom_fields?.follow_up_type || '').trim();
  const status = String(lead.custom_fields?.follow_up_status || '').trim();
  const source = String(lead.custom_fields?.quote_status || lead.custom_fields?.outreach_status || lead.custom_fields?.last_contact_outcome || '').trim();
  const channel = type || (lead.phone ? 'Call or WhatsApp' : lead.email ? 'Email' : 'Data cleanup');
  return {
    channel,
    trigger: status || 'Follow-up date reached',
    reason: source || `${channel} follow-up is scheduled for this lead.`
  };
};

export default function FollowUpQueue({ leads, brands, onOpenLead, onQuickCall }: FollowUpQueueProps) {
  const [mode, setMode] = useState<QueueMode>('all');

  const rows = useMemo(() => {
    return leads
      .map(lead => ({ lead, due: getDueDate(lead) }))
      .filter((item): item is { lead: Lead; due: Date } => Boolean(item.due) && isFollowUpDue(item.lead))
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [leads]);

  const filteredRows = rows.filter(({ due }) => {
    if (mode === 'all') return true;
    const today = startOfDay(new Date()).getTime();
    const dueDay = startOfDay(due).getTime();
    if (mode === 'overdue') return dueDay < today;
    return dueDay === today;
  });

  const counts = {
    all: rows.length,
    overdue: rows.filter(({ due }) => startOfDay(due).getTime() < startOfDay(new Date()).getTime()).length,
    today: rows.filter(({ due }) => startOfDay(due).getTime() === startOfDay(new Date()).getTime()).length,
  };

  return (
    <section className="follow-up-queue">
      <div className="follow-up-queue__header">
        <div>
          <h3><i className="fas fa-calendar-check" /> Unified Follow-Up Queue</h3>
          <p>Overdue and today's follow-ups across every brand.</p>
        </div>
        <div className="follow-up-queue__tabs">
          {([
            ['all', 'All Due', counts.all],
            ['overdue', 'Overdue', counts.overdue],
            ['today', 'Today', counts.today],
          ] as const).map(([value, label, count]) => (
            <button key={value} type="button" className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="follow-up-queue__list">
        {filteredRows.length === 0 ? (
          <div className="follow-up-queue__empty">
            <i className="fas fa-check-circle" />
            <span>No follow-ups in this queue.</span>
          </div>
        ) : (
          filteredRows.slice(0, 12).map(({ lead, due }) => {
            const brand = brands.find(b => b.id === lead.brand_id);
            const dueDay = startOfDay(due).getTime();
            const isOverdue = dueDay < startOfDay(new Date()).getTime();
            const followUp = getFollowUpReason(lead);
            return (
              <div key={lead.id} className="follow-up-queue__row">
                <div className="follow-up-queue__avatar" style={{ background: `${brand?.color || '#8b5cf6'}22`, color: brand?.color || '#8b5cf6' }}>
                  {(lead.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="follow-up-queue__main">
                  <strong>{lead.name || 'Unnamed lead'}</strong>
                  <span>{brand?.name || lead.brand_name || lead.brand_id} | {lead.funnel_stage || 'No stage'}</span>
                  <div className="follow-up-queue__reason">
                    <b>{followUp.trigger}</b>
                    <span>{followUp.reason}</span>
                  </div>
                </div>
                <div className={`follow-up-queue__due${isOverdue ? ' overdue' : ''}`}>
                  <small>{followUp.channel}</small>
                  {formatDueLabel(due)}
                </div>
                <div className="follow-up-queue__actions">
                  {onQuickCall && lead.phone && (
                    <button type="button" onClick={() => onQuickCall(lead)} title="Quick log call">
                      <i className="fas fa-phone" />
                    </button>
                  )}
                  <button type="button" onClick={() => onOpenLead(lead)} title="Open lead">
                    <i className="fas fa-arrow-right" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
