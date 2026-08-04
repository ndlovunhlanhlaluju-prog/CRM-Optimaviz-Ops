import { describe, expect, it } from 'vitest';
import {
  createEmptyBadgeRule,
  getDefaultLeadBadgeRules,
  normalizeLeadBadgeSettings,
  resolveLeadBadges,
  ruleMatchesLead,
  splitMultiValues,
  LEAD_BADGE_SETTINGS_VERSION,
} from './leadBadges';

describe('custom lead badges v2', () => {
  it('splits merged multi-service values on one lead', () => {
    expect(splitMultiValues('Cleaning, Plumbing, Gardening')).toEqual([
      'Cleaning',
      'Plumbing',
      'Gardening',
    ]);
    expect(splitMultiValues('Cleaning; Plumbing')).toHaveLength(2);
    expect(splitMultiValues(['A', 'B'])).toEqual(['A', 'B']);
  });

  it('matches field_has_multiple for multi services on one lead', () => {
    const rule = createEmptyBadgeRule({
      label: 'Offers multiple services',
      matchMode: 'field_has_multiple',
      fieldName: 'service_category_name',
      minCount: 2,
    });
    expect(
      ruleMatchesLead(rule, {
        id: '1',
        custom_fields: { service_category_name: 'Cleaning, Plumbing' },
      }),
    ).toBe(true);
    expect(
      ruleMatchesLead(rule, {
        id: '2',
        custom_fields: { service_category_name: 'Cleaning' },
      }),
    ).toBe(false);
  });

  it('matches Business without requiring Individual', () => {
    const business = createEmptyBadgeRule({
      label: 'Business',
      matchMode: 'field_equals',
      fieldName: 'lead_type',
      matchValues: ['business', 'company'],
    });
    expect(
      ruleMatchesLead(business, { id: '1', custom_fields: { lead_type: 'Business' } }),
    ).toBe(true);
    expect(
      ruleMatchesLead(business, { id: '2', custom_fields: { lead_type: 'Individual' } }),
    ).toBe(false);
  });

  it('matches free trial style tags via field_contains', () => {
    const trial = createEmptyBadgeRule({
      label: 'Started free trial',
      matchMode: 'field_contains',
      fieldName: 'segment',
      matchValues: ['trial', 'free trial'],
    });
    expect(
      ruleMatchesLead(trial, { id: '1', custom_fields: { segment: 'trial_leads' } }),
    ).toBe(true);
  });

  it('provides starter tags for all brands and allows empty custom brands', () => {
    for (const brand of ['taskgo', 'idao', 'nestwise', 'optimaviz', 'optimaclean', 'property', 'training']) {
      const rules = getDefaultLeadBadgeRules(brand);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(r => r.matchMode && r.label)).toBe(true);
    }
  });

  it('migrates legacy fixed-kind settings to custom defaults', () => {
    const migrated = normalizeLeadBadgeSettings('taskgo', {
      version: 1,
      rules: [{ id: 'multi_opportunity', kind: 'multi_opportunity', enabled: true, label: 'Multi-Opportunity' }],
    });
    expect(migrated.version).toBe(LEAD_BADGE_SETTINGS_VERSION);
    expect(migrated.rules.some(r => r.matchMode === 'field_has_multiple')).toBe(true);
    expect(migrated.rules.some(r => r.kind)).toBeFalsy();
  });

  it('resolves only matching custom tags', () => {
    const settings = normalizeLeadBadgeSettings('taskgo', {
      version: 2,
      rules: [
        createEmptyBadgeRule({
          id: 'a',
          label: 'Offers multiple services',
          matchMode: 'field_has_multiple',
          fieldName: 'service_category_name',
          minCount: 2,
        }),
        createEmptyBadgeRule({
          id: 'b',
          label: 'Business',
          matchMode: 'field_equals',
          fieldName: 'lead_type',
          matchValues: ['business'],
        }),
        createEmptyBadgeRule({
          id: 'c',
          label: 'Female',
          matchMode: 'field_equals',
          fieldName: 'gender',
          matchValues: ['female', 'f'],
        }),
      ],
    });
    const badges = resolveLeadBadges({
      lead: {
        id: '1',
        custom_fields: {
          service_category_name: 'Cleaning, Plumbing, Electrical',
          lead_type: 'Business',
          gender: 'Female',
        },
      },
      settings,
    });
    const labels = badges.map(b => b.label);
    expect(labels).toContain('Offers multiple services');
    expect(labels).toContain('Business');
    expect(labels).toContain('Female');
  });

  it('supports add/remove style free-form rules', () => {
    const settings = normalizeLeadBadgeSettings('optimaviz', {
      version: 2,
      rules: [
        createEmptyBadgeRule({
          label: 'Started free trial',
          matchMode: 'field_contains',
          fieldName: 'segment',
          matchValues: ['trial'],
        }),
        createEmptyBadgeRule({
          label: 'Male',
          matchMode: 'field_equals',
          fieldName: 'gender',
          matchValues: ['male'],
        }),
      ],
    });
    expect(settings.rules).toHaveLength(2);
    const next = { ...settings, rules: settings.rules.filter(r => r.label !== 'Male') };
    expect(next.rules).toHaveLength(1);
  });
});
