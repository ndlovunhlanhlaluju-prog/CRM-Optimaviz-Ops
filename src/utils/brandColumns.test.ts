import { describe, expect, it } from 'vitest';
import {
  getStandardColumns,
  mergeVisibleColumns,
  resolveVisibleColumns,
  getProtectedColumns,
  isAlwaysOnCustomField,
  columnPrefsMissingProtected,
  CURRENT_COL_VERSION,
  getColumnWidth,
  getColumnShortLabel,
  getColumnFullLabel,
  getColumnSizeStyle,
  buildLeadTableColumns,
  cellTitleText,
  LEAD_TABLE_CHECKBOX_WIDTH,
  LEAD_TABLE_ACTIONS_WIDTH,
} from './brandColumns';

const sharedRenderedColumns = [
  'name',
  'organisation',
  'email',
  'phone',
  'segment',
  'stage',
  'next_action',
  'follow_up_date',
  'last_activity',
  'assigned_to',
  'tags',
  'added',
];

describe('brand column defaults', () => {
  it.each(['optimaviz', 'taskgo', 'optimaclean'])(
    'includes every shared rendered lead-table column for %s',
    brandId => {
      expect(getStandardColumns(brandId)).toEqual(expect.arrayContaining(sharedRenderedColumns));
    },
  );

  it('includes IDAO service type plus every shared rendered lead-table column', () => {
    expect(getStandardColumns('idao')).toEqual(expect.arrayContaining([...sharedRenderedColumns, 'service_type']));
  });

  it('keeps NestWise specialist columns while retaining core contact columns', () => {
    expect(getStandardColumns('nestwise')).toEqual(
      expect.arrayContaining([
        'name',
        'email',
        'phone',
        'stage',
        'tags',
        'segment',
        'property_location',
        'service_package',
        'added',
      ]),
    );
  });
});

describe('permanent column resolve (v6)', () => {
  it('exposes a stable column version for forced re-hydration', () => {
    expect(CURRENT_COL_VERSION).toMatch(/^v\d+/);
  });

  it('always shows standards + all custom fields by default', () => {
    const resolved = resolveVisibleColumns({
      brandId: 'optimaviz',
      customFieldNames: ['city', 'age', 'optional_note'],
      hiddenOptional: [],
    });
    expect(resolved).toEqual(
      expect.arrayContaining(['name', 'email', 'phone', 'stage', 'segment', 'tags', 'city', 'age', 'optional_note']),
    );
  });

  it('honors user hides for every table column', () => {
    const resolved = resolveVisibleColumns({
      brandId: 'taskgo',
      customFieldNames: ['city', 'age', 'years_of_experience', 'optional_note'],
      hiddenOptional: ['phone', 'email', 'segment', 'stage', 'tags', 'city', 'age', 'optional_note'],
    });
    expect(resolved).not.toEqual(expect.arrayContaining(['phone', 'email', 'segment', 'stage', 'tags']));
    expect(resolved).not.toContain('city');
    expect(resolved).not.toContain('age');
    expect(resolved).not.toContain('optional_note');
    // years_of_experience was not in hiddenOptional so remains
    expect(resolved).toContain('years_of_experience');
  });

  it('treats city and age-like fields as always-on labels (not hard-protected)', () => {
    expect(isAlwaysOnCustomField('city')).toBe(true);
    expect(isAlwaysOnCustomField('years_of_experience')).toBe(true);
    expect(isAlwaysOnCustomField('age')).toBe(true);
    expect(isAlwaysOnCustomField('optional_note')).toBe(false);
  });

  it('does not protect columns from user deletion', () => {
    const protectedCols = getProtectedColumns('taskgo', ['city', 'years_of_experience', 'random', 'segment']);
    expect(protectedCols).toEqual(['name', 'email', 'phone', 'added', 'segment', 'stage', 'tags']);
  });

  it('honors permanently deleted standard columns, including former core columns', () => {
    const prev = globalThis.localStorage;
    const store: Record<string, string> = {
      crm_deleted_std_cols_taskgo: JSON.stringify(['organisation', 'next_action', 'name', 'segment']),
    };
    // Minimal localStorage shim for node/vitest
    // @ts-expect-error test shim
    globalThis.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
    try {
      const resolved = resolveVisibleColumns({
        brandId: 'taskgo',
        customFieldNames: ['city'],
        hiddenOptional: [],
      });
      expect(resolved).toEqual(expect.arrayContaining(['email', 'phone', 'stage', 'tags', 'added', 'city']));
      expect(resolved).not.toContain('organisation');
      expect(resolved).not.toContain('next_action');
      expect(resolved).not.toContain('name');
      expect(resolved).not.toContain('segment');
    } finally {
      // @ts-expect-error restore
      globalThis.localStorage = prev;
    }
  });

  it('legacy incomplete saved list cannot wipe protected or remaining customs on full hydrate', () => {
    const merged = mergeVisibleColumns({
      brandId: 'optimaviz',
      customFieldNames: ['city', 'age', 'hidden_optional'],
      saved: 'name',
      includeAllCustomFields: true,
    });
    expect(merged).toEqual(expect.arrayContaining(['phone', 'email', 'segment', 'stage', 'tags', 'city', 'age', 'hidden_optional']));
  });

  it('does not override an intentionally compact saved column list', () => {
    expect(
      columnPrefsMissingProtected({
        brandId: 'taskgo',
        customFieldNames: ['city', 'years_of_experience'],
        saved: 'name,email',
      }),
    ).toBe(true);
  });
});

describe('compact lead-table column sizing', () => {
  it('returns fixed widths that do not grow with label length', () => {
    expect(getColumnWidth('email')).toBe(148);
    expect(getColumnWidth('years_of_experience')).toBe(72);
    expect(getColumnWidth('unknown_long_custom_field_name')).toBe(96);
    expect(getColumnWidth('_select')).toBe(LEAD_TABLE_CHECKBOX_WIDTH);
    expect(getColumnWidth('_actions')).toBe(LEAD_TABLE_ACTIONS_WIDTH);
  });

  it('keeps header labels short while full labels stay readable', () => {
    expect(getColumnShortLabel('follow_up_date')).toBe('Follow-up');
    expect(getColumnShortLabel('organisation')).toBe('Org');
    expect(getColumnShortLabel('segment')).toBe('Segment');
    expect(getColumnShortLabel('assigned_to')).toBe('Owner');
    expect(getColumnFullLabel('segment')).toBe('Target Segment');
    expect(getColumnFullLabel('follow_up_date')).toBe('Follow-Up Date');
    expect(getColumnShortLabel('years_of_experience').length).toBeLessThan(getColumnFullLabel('years_of_experience').length);
  });

  it('exposes matching min/max width style for table cells', () => {
    const style = getColumnSizeStyle('phone');
    expect(style.width).toBe('112px');
    expect(style.minWidth).toBe('112px');
    expect(style.maxWidth).toBe('112px');
  });

  it('builds a single ordered column list for colgroup/header', () => {
    const cols = buildLeadTableColumns({
      brandId: 'optimaviz',
      visible: new Set([
        'name',
        'email',
        'phone',
        'stage',
        'city',
        'tags',
        'trial_status_virtual',
        'added',
      ]),
      customFields: [{ id: 'cf1', field_name: 'city' }],
    });
    expect(cols.map(c => c.key)).toEqual([
      'name',
      'email',
      'phone',
      'stage',
      'city',
      'tags',
      'trial_status_virtual',
      'added',
    ]);
    expect(cols.find(c => c.key === 'stage')?.sortKey).toBe('funnel_stage');
    expect(cols.find(c => c.key === 'city')?.isCustom).toBe(true);
    expect(cols.find(c => c.key === 'tags')?.sortKey).toBeNull();
  });

  it('omits Optimaviz virtual columns for other brands', () => {
    const cols = buildLeadTableColumns({
      brandId: 'taskgo',
      visible: new Set(['name', 'trial_status_virtual', 'days_remaining_virtual', 'added']),
    });
    expect(cols.map(c => c.key)).toEqual(['name', 'added']);
  });

  it('cellTitleText skips blanks for tooltip attributes', () => {
    expect(cellTitleText('  hello  ')).toBe('hello');
    expect(cellTitleText('')).toBeUndefined();
    expect(cellTitleText(null)).toBeUndefined();
  });
});
