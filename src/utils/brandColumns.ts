/**
 * Shared standard-column definitions per brand.
 *
 * Permanent rules (do not weaken):
 * 1. Protected columns (name, email, phone, lead date/added, segment, stage, tags)
 *    cannot be hidden or permanently deleted — they power search, filters, pipeline.
 * 2. All other standard + brand custom columns are user-controlled: hide or permanently delete.
 * 3. Permanent deletes leave tombstones (local + server) so auto-seed never resurrects them
 *    until the user explicitly re-adds the column.
 * 4. localStorage stores HIDDEN optional keys only — never a full "visible list"
 *    that can wipe the table when incomplete.
 */

/** Bump forces every browser to drop legacy full-list prefs and re-show everything. */
export const CURRENT_COL_VERSION = 'v6-always-show-all';

export const COMMON_LEAD_TABLE_COLUMNS = [
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

/** Custom field names that should never disappear from the table when the brand has them. */
export const ALWAYS_ON_CUSTOM_FIELD_PATTERN =
  /^(address|city|country|state|suburb|postcode|zip|postal|age|years_of_experience|years of experience|dob|date_of_birth|gender|abn|abn_number|location|property_location|owner_location|company|job_title|organisation|organization)$/i;

/** Extra brand defaults that stay visible whenever present. */
export const BRAND_DEFAULT_VISIBLE_CUSTOM_FIELDS: Record<string, string[]> = {
  taskgo: [
    'city',
    'state',
    'age',
    'years_of_experience',
    'gender',
    'abn_number',
    'service_category_name',
    'provider_status',
    'verification_status',
  ],
  idao: ['country', 'company', 'job_title', 'mine_type', 'quote_status', 'follow_up_status', 'city'],
  optimaviz: [
    'city',
    'age',
    'country',
    'organisation',
    'trial_start_date',
    'trial_end_date',
    'subscription_plan',
    'lead_category',
    'last_active_date',
  ],
  optimaclean: ['city', 'service_area', 'age'],
  nestwise: [
    'property_location',
    'property_type',
    'owner_location',
    'service_package',
    'service_focus',
    'rental_type',
    'city',
  ],
};

/** Required custom fields every brand should have defined in the DB (seeded on load). */
export const BRAND_REQUIRED_CUSTOM_FIELDS: Record<string, Array<{ field_name: string; field_type: 'text' | 'number' | 'boolean' | 'date'; required?: boolean }>> = {
  optimaviz: [
    { field_name: 'organisation', field_type: 'text' },
    { field_name: 'segment', field_type: 'text' },
    { field_name: 'next_action', field_type: 'text' },
    { field_name: 'city', field_type: 'text' },
    { field_name: 'age', field_type: 'text' },
    { field_name: 'country', field_type: 'text' },
    { field_name: 'trial_start_date', field_type: 'date' },
    { field_name: 'trial_end_date', field_type: 'date' },
    { field_name: 'subscription_plan', field_type: 'text' },
    { field_name: 'lead_category', field_type: 'text' },
    { field_name: 'last_active_date', field_type: 'date' },
  ],
  taskgo: [
    { field_name: 'segment', field_type: 'text' },
    { field_name: 'city', field_type: 'text' },
    { field_name: 'state', field_type: 'text' },
    { field_name: 'age', field_type: 'text' },
    { field_name: 'years_of_experience', field_type: 'text' },
    { field_name: 'gender', field_type: 'text' },
    { field_name: 'service_category_name', field_type: 'text' },
    { field_name: 'abn_number', field_type: 'text' },
    { field_name: 'provider_status', field_type: 'text' },
    { field_name: 'verification_status', field_type: 'text' },
  ],
  idao: [
    { field_name: 'organisation', field_type: 'text' },
    { field_name: 'segment', field_type: 'text' },
    { field_name: 'service_type', field_type: 'text' },
    { field_name: 'country', field_type: 'text' },
    { field_name: 'city', field_type: 'text' },
    { field_name: 'company', field_type: 'text' },
    { field_name: 'job_title', field_type: 'text' },
    { field_name: 'mine_type', field_type: 'text' },
    { field_name: 'quote_status', field_type: 'text' },
    { field_name: 'follow_up_status', field_type: 'text' },
  ],
  nestwise: [
    { field_name: 'segment', field_type: 'text' },
    { field_name: 'city', field_type: 'text' },
    { field_name: 'enquiry', field_type: 'text' },
    { field_name: 'service_interest', field_type: 'text' },
    { field_name: 'property_location', field_type: 'text' },
    { field_name: 'property_type', field_type: 'text' },
    { field_name: 'owner_location', field_type: 'text' },
    { field_name: 'service_package', field_type: 'text' },
    { field_name: 'follow_up_status', field_type: 'text' },
  ],
  optimaclean: [
    { field_name: 'segment', field_type: 'text' },
    { field_name: 'city', field_type: 'text' },
    { field_name: 'age', field_type: 'text' },
    { field_name: 'service_area', field_type: 'text' },
  ],
};

export function getStandardColumns(brandId?: string): string[] {
  if (!brandId) return [];

  if (brandId === 'idao') {
    return [
      'name',
      'organisation',
      'email',
      'phone',
      'segment',
      'service_type',
      'stage',
      'next_action',
      'follow_up_date',
      'last_activity',
      'assigned_to',
      'tags',
      'added',
    ];
  }

  if (brandId === 'nestwise') {
    return [
      'name',
      'email',
      'phone',
      'stage',
      'tags',
      'segment',
      'service_interest',
      'enquiry',
      'property_location',
      'property_type',
      'property_use',
      'owner_location',
      'service_package',
      'revenue_model',
      'next_service_date',
      'follow_up_status',
      'added',
    ];
  }

  return [...COMMON_LEAD_TABLE_COLUMNS];
}

export function isAlwaysOnCustomField(fieldName: string): boolean {
  return ALWAYS_ON_CUSTOM_FIELD_PATTERN.test(String(fieldName || '').trim());
}

export function getAlwaysOnCustomFields(brandId: string | undefined, customFieldNames: string[]): string[] {
  const names = customFieldNames.map(n => String(n || '').trim()).filter(Boolean);
  const defaults = new Set((BRAND_DEFAULT_VISIBLE_CUSTOM_FIELDS[brandId || ''] || []).map(n => n.toLowerCase()));
  return names.filter(name => isAlwaysOnCustomField(name) || defaults.has(name.toLowerCase()));
}

/**
 * Columns that cannot be hidden or permanently deleted.
 * - Core contact/date fields are required for every lead row.
 * - segment / stage / tags power lead search, filters, and pipeline views.
 * Everything else (brand customs, city, country, mine_type, …) is fully user-controlled.
 */
export function getProtectedColumns(_brandId?: string, _customFieldNames: string[] = []): string[] {
  return ['name', 'email', 'phone', 'added', 'segment', 'stage', 'tags'];
}

/** True when a column key is protected from hide/delete (case-insensitive). */
export function isProtectedColumn(columnKey: string, brandId?: string, customFieldNames: string[] = []): boolean {
  const key = String(columnKey || '').trim().toLowerCase();
  if (!key) return false;
  return getProtectedColumns(brandId, customFieldNames).some(c => c.toLowerCase() === key);
}

function parseList(raw?: string[] | string | null): string[] {
  if (Array.isArray(raw)) return raw.map(s => String(s || '').trim()).filter(Boolean);
  if (typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

/**
 * Resolve visible columns (canonical).
 * Starts with standards + every custom field, then removes only optional hidden keys.
 * Protected columns can never be removed.
 */
export function resolveVisibleColumns(options: {
  brandId?: string;
  customFieldNames?: string[];
  /** Optional columns the user explicitly hid (never standards / always-on). */
  hiddenOptional?: string[] | string | null;
}): string[] {
  const brandId = options.brandId;
  const customFieldNames = (options.customFieldNames || []).map(n => String(n || '').trim()).filter(Boolean);
  const std = getStandardColumns(brandId);
  const protectedCols = new Set(getProtectedColumns(brandId, customFieldNames));
  const protectedLower = new Set(Array.from(protectedCols).map(c => c.toLowerCase()));

  // Load user-deleted standard columns from localStorage (client-side only)
  let deletedStdSet = new Set<string>();
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem(`crm_deleted_std_cols_${brandId || ''}`)
      : null;
    const parsed: string[] = raw ? JSON.parse(raw) : [];
    deletedStdSet = new Set(
      parsed
        .map(c => String(c || '').trim().toLowerCase())
        .filter(Boolean),
    );
  } catch { /* ignore */ }

  // Default: everything on — standards (minus user-deleted) + all brand custom fields.
  const filteredStd = std.filter(c => !deletedStdSet.has(String(c).toLowerCase()));
  const visible = new Set<string>([...filteredStd, ...customFieldNames]);

  parseList(options.hiddenOptional).forEach(col => visible.delete(col));

  // Stable-ish order: standards first, then remaining customs alphabetically by appearance in customFieldNames.
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const col of filteredStd) {
    if (visible.has(col) && !seen.has(col)) {
      ordered.push(col);
      seen.add(col);
    }
  }
  for (const col of customFieldNames) {
    if (visible.has(col) && !seen.has(col)) {
      ordered.push(col);
      seen.add(col);
    }
  }
  for (const col of visible) {
    if (!seen.has(col)) {
      ordered.push(col);
      seen.add(col);
    }
  }
  return ordered;
}

/**
 * Legacy merge used by older call sites — now delegates to resolveVisibleColumns.
 * `saved` is treated as a legacy "visible list" only to infer hidden optional keys.
 * `includeAllCustomFields` is always effective for non-hidden fields.
 */
export function mergeVisibleColumns(options: {
  brandId?: string;
  customFieldNames?: string[];
  saved?: string[] | string | null;
  includeAllCustomFields?: boolean;
  hiddenOptional?: string[] | string | null;
}): string[] {
  const customFieldNames = (options.customFieldNames || []).map(n => String(n || '').trim()).filter(Boolean);
  const brandId = options.brandId;

  // Prefer explicit hidden list when provided.
  if (options.hiddenOptional != null && options.hiddenOptional !== '') {
    return resolveVisibleColumns({
      brandId,
      customFieldNames,
      hiddenOptional: options.hiddenOptional,
    });
  }

  // Legacy full visible-list prefs: infer hidden optional = customs not in saved (if saved present).
  const savedList = parseList(options.saved);
  if (savedList.length > 0 && !options.includeAllCustomFields) {
    const savedSet = new Set(savedList);
    const hiddenOptional = customFieldNames.filter(
      name => !savedSet.has(name) && !isProtectedColumn(name, brandId, customFieldNames),
    );
    return resolveVisibleColumns({
      brandId,
      customFieldNames,
      hiddenOptional,
    });
  }

  // Full hydrate / no prefs: show everything.
  return resolveVisibleColumns({
    brandId: options.brandId,
    customFieldNames,
    hiddenOptional: [],
  });
}

/** True when saved prefs omit any permanent/default column that should always be present. */
export function columnPrefsMissingProtected(options: {
  brandId?: string;
  customFieldNames?: string[];
  saved?: string[] | string | null;
}): boolean {
  const protectedCols = getProtectedColumns(options.brandId, options.customFieldNames || []);
  if (!protectedCols.length) return false;
  const savedList = parseList(options.saved);
  if (!savedList.length) return true;
  const savedSet = new Set(savedList);
  return protectedCols.some(col => !savedSet.has(col));
}

export function hiddenOptionalStorageKey(brandId: string): string {
  return `crm_cols_hidden_${brandId}`;
}

export function columnVersionStorageKey(brandId: string): string {
  return `crm_cols_version_${brandId}`;
}

/** Clear legacy full-list keys that used to wipe columns. */
export function clearLegacyColumnPrefs(brandId: string, storage: { removeItem: (k: string) => void }) {
  try {
    storage.removeItem(`crm_cols_${brandId}`);
    storage.removeItem(`crm_visible_cols_${brandId}`);
  } catch {
    /* ignore */
  }
}

/** Sticky select + actions columns (not part of brand field keys). */
export const LEAD_TABLE_CHECKBOX_WIDTH = 40;
export const LEAD_TABLE_ACTIONS_WIDTH = 136;
/** Uniform body row height for the leads grid. */
export const LEAD_TABLE_ROW_HEIGHT = 40;

/**
 * Dedicated core columns rendered before brand custom fields.
 * Keep this list in sync with the leads table JSX order.
 */
export const LEAD_TABLE_CORE_ORDER = [
  'name',
  'email',
  'phone',
  'organisation',
  'segment',
  'service_type',
  'stage',
  'next_action',
  'follow_up_date',
  'last_activity',
  'assigned_to',
] as const;

/** Columns rendered after brand custom fields. */
export const LEAD_TABLE_TRAILING_ORDER = [
  'tags',
  'trial_status_virtual',
  'days_remaining_virtual',
  'added',
] as const;

export type LeadTableColumnDef = {
  key: string;
  /** Sort field for handleSortColToggle; null = not sortable */
  sortKey: string | null;
  stickyName?: boolean;
  isCustom?: boolean;
  customFieldId?: string;
};

const CORE_SORT_KEYS: Record<string, string | null> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  organisation: 'organisation',
  segment: 'segment',
  service_type: 'service_type',
  stage: 'funnel_stage',
  next_action: 'next_action',
  follow_up_date: 'follow_up_date',
  last_activity: 'last_activity',
  assigned_to: 'assigned_to',
  tags: null,
  trial_status_virtual: null,
  days_remaining_virtual: null,
  added: 'created_at',
};

/**
 * Single ordered list of data columns for colgroup / thead / export.
 * Select + actions columns are excluded (always present).
 */
export function buildLeadTableColumns(options: {
  brandId?: string;
  visible: Set<string> | Iterable<string>;
  /** User-defined display order. Name remains pinned as the first data column. */
  order?: string[];
  /** Brand custom fields already filtered for table display (e.g. getTableCustomFields). */
  customFields?: Array<{ id: string; field_name: string }>;
}): LeadTableColumnDef[] {
  const visible = options.visible instanceof Set ? options.visible : new Set(options.visible);
  const brandId = options.brandId || '';
  const cols: LeadTableColumnDef[] = [];
  const coreSet = new Set<string>(LEAD_TABLE_CORE_ORDER as unknown as string[]);
  const trailingSet = new Set<string>(LEAD_TABLE_TRAILING_ORDER as unknown as string[]);

  for (const key of LEAD_TABLE_CORE_ORDER) {
    if (!visible.has(key)) continue;
    cols.push({
      key,
      sortKey: CORE_SORT_KEYS[key] ?? key,
      stickyName: key === 'name',
    });
  }

  for (const field of options.customFields || []) {
    const key = String(field.field_name || '').trim();
    if (!key || !visible.has(key)) continue;
    // Avoid double-rendering dedicated core/trailing columns.
    if (coreSet.has(key) || trailingSet.has(key)) continue;
    cols.push({
      key,
      sortKey: key,
      isCustom: true,
      customFieldId: field.id,
    });
  }

  for (const key of LEAD_TABLE_TRAILING_ORDER) {
    if (!visible.has(key)) continue;
    if (
      (key === 'trial_status_virtual' || key === 'days_remaining_virtual') &&
      brandId !== 'optimaviz'
    ) {
      continue;
    }
    cols.push({
      key,
      sortKey: CORE_SORT_KEYS[key] ?? null,
    });
  }

  const order = options.order || [];
  if (!order.length) return cols;
  const rank = new Map(order.map((key, index) => [key, index]));
  return [...cols].sort((a, b) => {
    if (a.key === 'name') return -1;
    if (b.key === 'name') return 1;
    return (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER);
  });
}

/** Full text for truncated cell tooltips (empty → undefined so title is omitted). */
export function cellTitleText(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}

/**
 * Compact pixel width per column. Fixed widths keep long values from stretching
 * the grid; horizontal scroll handles overflow instead.
 */
export function getColumnWidth(columnKey: string): number {
  const key = String(columnKey || '').trim().toLowerCase();
  const widths: Record<string, number> = {
    // Core contact / pipeline (scan-first)
    name: 148,
    organisation: 104,
    organization: 104,
    email: 148,
    phone: 112,
    segment: 96,
    service_type: 100,
    stage: 104,
    next_action: 108,
    follow_up_date: 92,
    last_activity: 88,
    assigned_to: 96,
    tags: 96,
    added: 84,
    // Common custom fields
    city: 88,
    state: 64,
    age: 52,
    years_of_experience: 72,
    gender: 68,
    abn_number: 96,
    service_category_name: 108,
    provider_status: 88,
    verification_status: 88,
    country: 84,
    company: 104,
    job_title: 104,
    mine_type: 88,
    quote_status: 88,
    follow_up_status: 92,
    trial_start_date: 92,
    trial_end_date: 92,
    subscription_plan: 92,
    lead_category: 96,
    last_active_date: 92,
    service_area: 96,
    property_location: 112,
    property_type: 96,
    property_use: 88,
    owner_location: 112,
    service_package: 96,
    service_focus: 96,
    rental_type: 88,
    enquiry: 112,
    service_interest: 104,
    revenue_model: 92,
    next_service_date: 92,
    // Virtual / computed
    trial_status_virtual: 96,
    days_remaining_virtual: 104,
    _select: LEAD_TABLE_CHECKBOX_WIDTH,
    _actions: LEAD_TABLE_ACTIONS_WIDTH,
  };
  return widths[key] || 96;
}

/** Full readable label (tooltips, filters, column picker). */
export function getColumnFullLabel(columnKey: string): string {
  const key = String(columnKey || '').trim().toLowerCase();
  const labels: Record<string, string> = {
    name: 'Lead Name',
    organisation: 'Organisation',
    organization: 'Organisation',
    email: 'Email',
    phone: 'Phone',
    segment: 'Target Segment',
    service_type: 'Service Type',
    stage: 'Stage',
    next_action: 'Next Action',
    follow_up_date: 'Follow-Up Date',
    last_activity: 'Last Activity',
    assigned_to: 'Assigned To',
    tags: 'Tags',
    added: 'Lead Date',
    years_of_experience: 'Years of Experience',
    service_category_name: 'Service Category',
    verification_status: 'Verification Status',
    provider_status: 'Provider Status',
    property_location: 'Property Location',
    property_type: 'Property Type',
    property_use: 'Property Use',
    owner_location: 'Owner Location',
    service_package: 'Service Package',
    revenue_model: 'Revenue Model',
    next_service_date: 'Next Service Date',
    follow_up_status: 'Follow-Up Status',
    trial_start_date: 'Trial Start Date',
    trial_end_date: 'Trial End Date',
    subscription_plan: 'Subscription Plan',
    lead_category: 'Lead Category',
    last_active_date: 'Last Active Date',
    abn_number: 'ABN Number',
    service_area: 'Service Area',
    service_interest: 'Service Interest',
    service_focus: 'Service Focus',
    rental_type: 'Rental Type',
    trial_status_virtual: 'Trial Status',
    days_remaining_virtual: 'Days Remaining',
  };
  if (labels[key]) return labels[key];
  return String(columnKey || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Short header label — keeps the grid compact so more columns fit before scroll.
 * Pair with `title={getColumnFullLabel(...)}` for hover clarity.
 */
export function getColumnShortLabel(columnKey: string): string {
  const key = String(columnKey || '').trim().toLowerCase();
  const labels: Record<string, string> = {
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    organisation: 'Org',
    organization: 'Org',
    segment: 'Segment',
    service_type: 'Service',
    stage: 'Stage',
    next_action: 'Next',
    follow_up_date: 'Follow-up',
    last_activity: 'Activity',
    assigned_to: 'Owner',
    tags: 'Tags',
    added: 'Date',
    years_of_experience: 'Yrs',
    years_of_exp: 'Yrs',
    service_category_name: 'Category',
    verification_status: 'Verified',
    provider_status: 'Status',
    property_location: 'Prop loc',
    property_type: 'Prop type',
    property_use: 'Prop use',
    owner_location: 'Owner loc',
    service_package: 'Package',
    revenue_model: 'Rev model',
    next_service_date: 'Next svc',
    follow_up_status: 'F/up',
    trial_start_date: 'Trial start',
    trial_end_date: 'Trial end',
    subscription_plan: 'Plan',
    lead_category: 'Category',
    last_active_date: 'Last active',
    service_interest: 'Interest',
    enquiry: 'Enquiry',
    abn_number: 'ABN',
    service_area: 'Svc area',
    rental_type: 'Rental',
    service_focus: 'Focus',
    job_title: 'Title',
    company: 'Company',
    country: 'Country',
    city: 'City',
    state: 'State',
    age: 'Age',
    gender: 'Gender',
    mine_type: 'Mine',
    quote_status: 'Quote',
    trial_status_virtual: 'Trial',
    days_remaining_virtual: 'Days left',
  };

  if (labels[key]) return labels[key];

  // Fallback: title-case, drop filler words, cap length for dense headers
  const cleaned = String(columnKey || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(and|or|of|the|in|at|by|with|on|to|for)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return cleaned.length > 12 ? `${cleaned.slice(0, 11)}…` : cleaned || 'Field';
}

/** Width-only style for col / th / td — height & truncation live in CSS. */
export function getColumnSizeStyle(columnKey: string): Record<string, string | number> {
  const width = getColumnWidth(columnKey);
  return {
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
  };
}

/**
 * Full compact cell style (inline fallback). Prefer CSS class `lead-data-table`
 * + `getColumnSizeStyle` so design tokens stay consistent.
 */
export function getCompactCellStyle(columnKey: string, options?: { isHeader?: boolean }): Record<string, any> {
  return {
    ...getColumnSizeStyle(columnKey),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    padding: options?.isHeader ? '8px 8px' : '6px 8px',
    height: options?.isHeader ? '36px' : `${LEAD_TABLE_ROW_HEIGHT}px`,
    maxHeight: options?.isHeader ? '36px' : `${LEAD_TABLE_ROW_HEIGHT}px`,
    boxSizing: 'border-box',
    verticalAlign: 'middle',
  };
}
