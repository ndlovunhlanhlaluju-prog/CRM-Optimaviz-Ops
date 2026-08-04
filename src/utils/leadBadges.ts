/**
 * Fully custom lead tags/badges per brand.
 *
 * Users create any labels they want (Business, Female, Started free trial,
 * Offers multiple services, …). Each tag is a rule: when a field matches,
 * show the pill. No fixed Multi-Opportunity / Individual cards.
 *
 * Multi-service for TaskGo: use matchMode "field_has_multiple" on a services
 * field on the SAME lead (merged services), not separate rows.
 */

export type LeadBadgePlacement = 'after_name' | 'detail_only' | 'hidden';

export type LeadBadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

/**
 * How a tag decides to show on a lead.
 * - field_equals: field value equals one of matchValues (case-insensitive exact)
 * - field_contains: field value contains one of matchValues
 * - field_has_multiple: field has ≥ minCount values (comma / ; / | / newline / array)
 * - field_not_empty: field has any non-empty value
 */
export type LeadBadgeMatchMode =
  | 'field_equals'
  | 'field_contains'
  | 'field_has_multiple'
  | 'field_not_empty';

export interface LeadBadgeRule {
  id: string;
  enabled: boolean;
  /** Pill text next to the name */
  label: string;
  detailTitle: string;
  detailBody: string;
  icon: string;
  tone: LeadBadgeTone;
  placement: LeadBadgePlacement;
  matchMode: LeadBadgeMatchMode;
  /** Custom field name (or built-in: funnel_stage, name, email, phone) */
  fieldName: string;
  /** For equals / contains */
  matchValues: string[];
  /** For field_has_multiple (default 2) */
  minCount: number;
}

export interface BrandLeadBadgeSettings {
  version: number;
  rules: LeadBadgeRule[];
}

/** Bump when schema changes — migrates/replaces legacy fixed-kind rules. */
export const LEAD_BADGE_SETTINGS_VERSION = 2;

export function storageKeyForBrandBadges(brandId: string): string {
  return `crm_lead_badges_${brandId}`;
}

export function newBadgeId(): string {
  return `badge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyBadgeRule(partial?: Partial<LeadBadgeRule>): LeadBadgeRule {
  return {
    id: partial?.id || newBadgeId(),
    enabled: partial?.enabled ?? true,
    label: partial?.label || 'New tag',
    detailTitle: partial?.detailTitle || partial?.label || 'New tag',
    detailBody: partial?.detailBody || '',
    icon: partial?.icon || 'fa-tag',
    tone: partial?.tone || 'info',
    placement: partial?.placement || 'after_name',
    matchMode: partial?.matchMode || 'field_equals',
    fieldName: partial?.fieldName || '',
    matchValues: Array.isArray(partial?.matchValues) ? partial!.matchValues.map(String) : [],
    minCount: Math.max(2, Number(partial?.minCount) || 2),
  };
}

/** Split multi-value cell into tokens (merged services on one lead). */
export function splitMultiValues(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map(v => String(v ?? '').trim()).filter(Boolean);
  }
  const text = String(raw).trim();
  if (!text) return [];
  // Prefer clear separators; avoid splitting plain phrases without them
  if (/[,;|/]/.test(text) || text.includes('\n')) {
    return text
      .split(/[,;|/\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  // Also support " · " or " / " style lists
  if (/\s[·•]\s/.test(text)) {
    return text.split(/\s[·•]\s/).map(s => s.trim()).filter(Boolean);
  }
  return [text];
}

function getLeadFieldValue(lead: LeadLike, fieldName: string): unknown {
  const key = String(fieldName || '').trim();
  if (!key) return '';
  if (key === 'funnel_stage' || key === 'stage') return lead.funnel_stage;
  if (key === 'name') return lead.name;
  if (key === 'email') return lead.email;
  if (key === 'phone') return lead.phone;
  const cf = lead.custom_fields || {};
  if (Object.prototype.hasOwnProperty.call(cf, key)) return cf[key];
  // case-insensitive field match
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(cf)) {
    if (String(k).toLowerCase() === lower) return v;
  }
  return '';
}

export function ruleMatchesLead(rule: LeadBadgeRule, lead: LeadLike): boolean {
  if (!rule.enabled || rule.placement === 'hidden') return false;
  const field = String(rule.fieldName || '').trim();
  if (!field && rule.matchMode !== 'field_has_multiple') return false;

  const raw = getLeadFieldValue(lead, field);
  const text = raw == null ? '' : String(raw).trim();
  const values = (rule.matchValues || []).map(v => String(v).trim()).filter(Boolean);
  const lowerValues = values.map(v => v.toLowerCase());

  switch (rule.matchMode) {
    case 'field_not_empty':
      return Boolean(text) || (Array.isArray(raw) && raw.length > 0);

    case 'field_equals': {
      if (!text && !(Array.isArray(raw) && raw.length)) return false;
      if (!lowerValues.length) return Boolean(text);
      const tokens = splitMultiValues(raw).map(t => t.toLowerCase());
      const single = text.toLowerCase();
      return lowerValues.some(v => single === v || tokens.includes(v));
    }

    case 'field_contains': {
      if (!text) return false;
      if (!lowerValues.length) return true;
      const single = text.toLowerCase();
      return lowerValues.some(v => single.includes(v));
    }

    case 'field_has_multiple': {
      const tokens = splitMultiValues(raw);
      // unique case-insensitive
      const unique = new Set(tokens.map(t => t.toLowerCase()));
      const min = Math.max(2, Number(rule.minCount) || 2);
      return unique.size >= min;
    }

    default:
      return false;
  }
}

export type LeadLike = {
  id: string;
  brand_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  funnel_stage?: string;
  custom_fields?: Record<string, any>;
};

export type ResolvedLeadBadge = {
  id: string;
  label: string;
  detailTitle: string;
  detailBody: string;
  icon: string;
  tone: LeadBadgeTone;
  placement: LeadBadgePlacement;
};

export function toneStyles(tone: LeadBadgeTone): { bg: string; border: string; color: string } {
  switch (tone) {
    case 'success':
      return { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' };
    case 'danger':
      return { bg: '#fef2f2', border: '#fecaca', color: '#ef4444' };
    case 'warning':
      return { bg: '#fffbeb', border: '#fde68a', color: '#d97706' };
    case 'info':
      return { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb' };
    default:
      return { bg: '#f8fafc', border: '#e2e8f0', color: '#475569' };
  }
}

/**
 * Starter tags for a brand — examples only. Users can edit/delete/add freely.
 */
export function getDefaultLeadBadgeRules(brandId: string): LeadBadgeRule[] {
  const id = String(brandId || '').toLowerCase();

  if (id === 'taskgo') {
    return [
      createEmptyBadgeRule({
        id: 'tag_multi_services',
        label: 'Offers multiple services',
        detailTitle: 'Multiple services on this lead',
        detailBody:
          'This contractor has more than one service listed on the same lead (merged services). Not separate rows.',
        icon: 'fa-screwdriver-wrench',
        tone: 'success',
        matchMode: 'field_has_multiple',
        fieldName: 'service_category_name',
        matchValues: [],
        minCount: 2,
      }),
      createEmptyBadgeRule({
        id: 'tag_business',
        label: 'Business',
        detailTitle: 'Business lead',
        detailBody: 'Marked as a business contact.',
        icon: 'fa-building',
        tone: 'info',
        matchMode: 'field_equals',
        fieldName: 'lead_type',
        matchValues: ['business', 'company', 'commercial'],
      }),
      createEmptyBadgeRule({
        id: 'tag_individual',
        label: 'Individual',
        detailTitle: 'Individual lead',
        detailBody: 'Marked as an individual contact. Disable this tag if you only want Business.',
        icon: 'fa-user',
        tone: 'neutral',
        enabled: false,
        matchMode: 'field_equals',
        fieldName: 'lead_type',
        matchValues: ['individual', 'person', 'personal', 'residential'],
      }),
    ];
  }

  if (id === 'optimaviz') {
    return [
      createEmptyBadgeRule({
        id: 'tag_free_trial',
        label: 'Started free trial',
        detailTitle: 'Free trial',
        detailBody: 'This user is on (or started) a free trial.',
        icon: 'fa-flask',
        tone: 'success',
        matchMode: 'field_contains',
        fieldName: 'segment',
        matchValues: ['trial', 'free trial', 'trial_leads'],
      }),
      createEmptyBadgeRule({
        id: 'tag_subscribed',
        label: 'Subscribed',
        detailTitle: 'Subscribed user',
        detailBody: 'Active subscribed platform user.',
        icon: 'fa-crown',
        tone: 'info',
        matchMode: 'field_contains',
        fieldName: 'segment',
        matchValues: ['subscribed', 'subscriber', 'subscribed_platform_users'],
      }),
      createEmptyBadgeRule({
        id: 'tag_business',
        label: 'Business',
        detailTitle: 'Business',
        detailBody: '',
        icon: 'fa-building',
        tone: 'info',
        matchMode: 'field_equals',
        fieldName: 'lead_type',
        matchValues: ['business', 'company'],
      }),
    ];
  }

  if (id === 'idao') {
    return [
      createEmptyBadgeRule({
        id: 'tag_multi_services',
        label: 'Multiple services',
        detailTitle: 'Multiple services',
        detailBody: 'More than one service type/focus listed on this lead.',
        icon: 'fa-briefcase',
        tone: 'success',
        matchMode: 'field_has_multiple',
        fieldName: 'service_type',
        minCount: 2,
      }),
      createEmptyBadgeRule({
        id: 'tag_business',
        label: 'Business',
        detailTitle: 'Business',
        detailBody: '',
        icon: 'fa-building',
        tone: 'info',
        matchMode: 'field_equals',
        fieldName: 'lead_type',
        matchValues: ['business', 'company', 'corporate'],
      }),
    ];
  }

  if (id === 'nestwise') {
    return [
      createEmptyBadgeRule({
        id: 'tag_multi_needs',
        label: 'Multiple needs',
        detailTitle: 'Multiple service needs',
        detailBody: 'More than one package/interest listed on this lead.',
        icon: 'fa-house-chimney',
        tone: 'success',
        matchMode: 'field_has_multiple',
        fieldName: 'service_package',
        minCount: 2,
      }),
      createEmptyBadgeRule({
        id: 'tag_business',
        label: 'Business',
        detailTitle: 'Business',
        detailBody: '',
        icon: 'fa-building',
        tone: 'info',
        matchMode: 'field_equals',
        fieldName: 'lead_type',
        matchValues: ['business', 'company'],
      }),
    ];
  }

  if (id === 'optimaclean') {
    return [
      createEmptyBadgeRule({
        id: 'tag_multi_services',
        label: 'Multiple services',
        detailTitle: 'Multiple services',
        detailBody: 'More than one service listed on this lead.',
        icon: 'fa-broom',
        tone: 'success',
        matchMode: 'field_has_multiple',
        fieldName: 'service_area',
        minCount: 2,
      }),
      createEmptyBadgeRule({
        id: 'tag_business',
        label: 'Business',
        detailTitle: 'Business',
        detailBody: '',
        icon: 'fa-building',
        tone: 'info',
        matchMode: 'field_equals',
        fieldName: 'lead_type',
        matchValues: ['business', 'company', 'commercial'],
      }),
    ];
  }

  // Custom brands (property, training, …): empty starter + one example users can edit
  return [
    createEmptyBadgeRule({
      id: 'tag_example_business',
      label: 'Business',
      detailTitle: 'Business',
      detailBody: 'Example tag — edit or delete. Add any labels you need for this brand.',
      icon: 'fa-building',
      tone: 'info',
      matchMode: 'field_equals',
      fieldName: 'lead_type',
      matchValues: ['business', 'company'],
    }),
  ];
}

function isLegacyFixedKindRule(rule: any): boolean {
  return rule && typeof rule === 'object' && ['multi_opportunity', 'duplicate', 'lead_type'].includes(String(rule.kind || ''));
}

export function normalizeLeadBadgeSettings(
  brandId: string,
  raw?: Partial<BrandLeadBadgeSettings> | any | null,
): BrandLeadBadgeSettings {
  const defaults = getDefaultLeadBadgeRules(brandId);
  const version = Number(raw?.version) || 0;
  const incoming = Array.isArray(raw?.rules) ? raw.rules : [];

  // Legacy v1 fixed kinds → replace with new custom defaults (user can re-edit)
  if (version < LEAD_BADGE_SETTINGS_VERSION || incoming.some(isLegacyFixedKindRule)) {
    // If they already have custom-shaped rules mixed in, keep those that look modern
    const modern = incoming
      .filter((r: any) => r && r.id && r.label && r.matchMode && !isLegacyFixedKindRule(r))
      .map((r: any) => createEmptyBadgeRule(r));
    if (modern.length > 0) {
      return { version: LEAD_BADGE_SETTINGS_VERSION, rules: modern };
    }
    return { version: LEAD_BADGE_SETTINGS_VERSION, rules: defaults };
  }

  const rules = incoming
    .filter((r: any) => r && r.id)
    .map((r: any) => createEmptyBadgeRule(r));

  if (!rules.length) {
    return { version: LEAD_BADGE_SETTINGS_VERSION, rules: defaults };
  }

  return { version: LEAD_BADGE_SETTINGS_VERSION, rules };
}

export function loadLeadBadgeSettings(
  brandId: string,
  storage: { getItem: (k: string) => string | null } = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null },
): BrandLeadBadgeSettings {
  try {
    const raw = storage.getItem(storageKeyForBrandBadges(brandId));
    if (!raw) return normalizeLeadBadgeSettings(brandId, null);
    return normalizeLeadBadgeSettings(brandId, JSON.parse(raw));
  } catch {
    return normalizeLeadBadgeSettings(brandId, null);
  }
}

export function saveLeadBadgeSettings(
  brandId: string,
  settings: BrandLeadBadgeSettings,
  storage: { setItem: (k: string, v: string) => void } = typeof localStorage !== 'undefined' ? localStorage : { setItem: () => undefined },
): void {
  const normalized = normalizeLeadBadgeSettings(brandId, settings);
  storage.setItem(storageKeyForBrandBadges(brandId), JSON.stringify(normalized));
}

/**
 * Resolve which custom tags show for a lead.
 * (allLeads / isDuplicate kept for API compatibility — multi-service is field-based now.)
 */
export function resolveLeadBadges(options: {
  lead: LeadLike;
  allLeads?: LeadLike[];
  isDuplicate?: boolean;
  settings: BrandLeadBadgeSettings;
  availableFieldNames?: string[];
}): ResolvedLeadBadge[] {
  const { lead, settings } = options;
  const out: ResolvedLeadBadge[] = [];

  for (const rule of settings.rules || []) {
    if (!rule.enabled || rule.placement === 'hidden') continue;
    if (!ruleMatchesLead(rule, lead)) continue;
    out.push({
      id: rule.id,
      label: rule.label || 'Tag',
      detailTitle: rule.detailTitle || rule.label || 'Tag',
      detailBody: rule.detailBody || '',
      icon: rule.icon || 'fa-tag',
      tone: rule.tone || 'neutral',
      placement: rule.placement || 'after_name',
    });
  }

  return out;
}

/** @deprecated kept for older imports — multi-row opportunity is no longer the multi-service model */
export function isMultiOpportunityLead(): boolean {
  return false;
}
