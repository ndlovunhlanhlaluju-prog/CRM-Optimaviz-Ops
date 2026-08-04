import React, { useEffect, useState } from 'react';
import { Lead } from '../types';

export interface QuickCallPayload {
  lead: Lead;
  outcome: string;
  duration: number;
  notes: string;
  followUpDate: string;
}

interface QuickCallLogProps {
  lead: Lead | null;
  open: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: QuickCallPayload) => Promise<void> | void;
}

export default function QuickCallLog({ lead, open, saving = false, onOpenChange, onSubmit }: QuickCallLogProps) {
  const [outcome, setOutcome] = useState('Connected');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  useEffect(() => {
    if (!open) return;
    setOutcome('Connected');
    setDuration(60);
    setNotes('');
    setFollowUpDate('');
  }, [open, lead?.id]);

  if (!lead) return null;

  return (
    <>
      {open && (
        <aside className="quick-call-panel">
          <div className="quick-call-panel__header">
            <div>
              <span>Quick call log</span>
              <strong>{lead.name || 'Selected lead'}</strong>
            </div>
            <button type="button" onClick={() => onOpenChange(false)}>
              <i className="fas fa-times" />
            </button>
          </div>

          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await onSubmit({ lead, outcome, duration, notes, followUpDate });
            }}
          >
            <div className="quick-call-panel__grid">
              <label>
                <span>Outcome</span>
                <select value={outcome} onChange={event => setOutcome(event.target.value)}>
                  <option value="Connected">Connected</option>
                  <option value="No Answer">No Answer</option>
                  <option value="Busy">Busy</option>
                  <option value="Wrong Number">Wrong Number</option>
                  <option value="Rescheduled">Rescheduled</option>
                  <option value="Follow-Up Needed">Follow-Up Needed</option>
                </select>
              </label>
              <label>
                <span>Duration</span>
                <input type="number" min={0} value={duration} onChange={event => setDuration(parseInt(event.target.value, 10) || 0)} />
              </label>
            </div>

            <label>
              <span>Follow-up date</span>
              <input type="date" value={followUpDate} onChange={event => setFollowUpDate(event.target.value)} />
            </label>

            <label>
              <span>Notes</span>
              <textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} placeholder="Call result, objections, next step..." />
            </label>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              <i className="fas fa-save" /> {saving ? 'Saving...' : 'Save call'}
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
