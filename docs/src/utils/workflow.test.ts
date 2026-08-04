import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseDateOnly, isDoNotContact, isFinalStage, isFollowUpDue, getFollowUpLabel } from './workflow';

type LeadMinimal = { follow_up_date?: string | null; custom_fields?: any; funnel_stage?: string };

describe('workflow helpers', () => {
  beforeEach(() => {
    // Freeze system time to 2026-06-22 for deterministic tests
    vi.setSystemTime(new Date(2026, 5, 22));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parseDateOnly parses YYYY-MM-DD to local midnight', () => {
    const d = parseDateOnly('2026-06-22');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(22);
    expect(d!.getHours()).toBe(0);
    expect(d!.getMinutes()).toBe(0);
  });

  it('isDoNotContact detects boolean and string true', () => {
    expect(isDoNotContact({ custom_fields: { do_not_contact: true } } as any)).toBe(true);
    expect(isDoNotContact({ custom_fields: { do_not_contact: 'true' } } as any)).toBe(true);
    expect(isDoNotContact({ custom_fields: { do_not_contact: 'false' } } as any)).toBe(false);
  });

  it('isFinalStage recognizes final funnel stages', () => {
    expect(isFinalStage({ funnel_stage: 'Won' } as any)).toBe(true);
    expect(isFinalStage({ funnel_stage: 'lead' } as any)).toBe(false);
  });

  it('isFollowUpDue & getFollowUpLabel behavior', () => {
    const past: LeadMinimal = { follow_up_date: '2026-06-21' };
    const today: LeadMinimal = { follow_up_date: '2026-06-22' };
    const soon: LeadMinimal = { follow_up_date: '2026-06-24' };

    expect(isFollowUpDue(past as any)).toBe(true);
    expect(getFollowUpLabel(past as any).label).toContain('overdue');

    expect(isFollowUpDue(today as any)).toBe(true);
    expect(getFollowUpLabel(today as any).label).toBe('Due today');

    expect(isFollowUpDue(soon as any)).toBe(false);
    const lbl = getFollowUpLabel(soon as any);
    expect(lbl.label).toContain('Due in');
    expect(lbl.urgent).toBe(true);
  });

  it('isFollowUpDue returns false for do-not-contact and final stage', () => {
    expect(isFollowUpDue({ follow_up_date: '2026-06-21', custom_fields: { do_not_contact: true } } as any)).toBe(false);
    expect(isFollowUpDue({ follow_up_date: '2026-06-21', funnel_stage: 'won' } as any)).toBe(false);
  });
});
