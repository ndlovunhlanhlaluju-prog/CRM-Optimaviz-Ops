/**
 * Shared auto-mapping helpers for Excel/CSV bulk lead import.
 * Maps spreadsheet headers → CRM standard + custom fields.
 */

export type ImportCustomField = { field_name: string };

const FIRST_NAME_ALIASES = new Set([
  'first name',
  'firstname',
  'given name',
  'givenname',
  'fname',
  'first',
]);

const LAST_NAME_ALIASES = new Set([
  'last name',
  'lastname',
  'surname',
  'family name',
  'familyname',
  'lname',
  'last',
]);

const FULL_NAME_ALIASES = new Set([
  'name',
  'full name',
  'fullname',
  'lead name',
  'contact name',
  'contact',
  'client name',
  'customer name',
  'display name',
]);

const EMAIL_ALIASES = new Set([
  'email',
  'e-mail',
  'email address',
  'emailaddress',
  'mail',
  'e mail',
]);

const PHONE_ALIASES = new Set([
  'phone',
  'phone number',
  'phonenumber',
  'tel',
  'telephone',
  'mobile',
  'mobile number',
  'mobilenumber',
  'cell',
  'cell phone',
  'cellphone',
  'contact number',
  'contactnumber',
  'phone no',
  'phone#',
]);

/** Headers that look like names but should never map to the lead Name field. */
const NAME_EXCLUDE =
  /^(company|organisation|organization|business|brand|user|user\s*name|username|account|file|sheet|stage|status|tag|type|source|campaign|owner|assigned)/i;

export function normalizeHeaderKey(value: string): string {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .trim();
}

export function compactHeaderKey(value: string): string {
  return normalizeHeaderKey(value).replace(/[\s_/\-#.]+/g, '');
}

/**
 * Ensure header labels are unique non-empty strings so object keys / React keys stay stable.
 * Duplicate "Email" → "Email", "Email (2)", etc.
 */
export function uniquifyHeaders(rawHeaders: string[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((raw, index) => {
    const cleaned = String(raw ?? '')
      .replace(/^\uFEFF/, '')
      .trim();
    const base = cleaned || `Column ${index + 1}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

export function findLeadDateHeaderLocal(headers: string[]): string {
  const exactAliases = new Set([
    'createdat',
    'createddate',
    'datecreated',
    'datejoined',
    'joineddate',
    'joinedat',
    'registrationdate',
    'registeredat',
    'submittedat',
    'submissiondate',
    'timestamp',
    'leadcreateddate',
    'memberjoineddate',
    'leaddate',
    'date',
  ]);

  for (const header of headers) {
    const compact = compactHeaderKey(header);
    if (exactAliases.has(compact)) return header;
    if (
      compact.includes('createddate') ||
      compact.includes('datecreated') ||
      compact.includes('datejoined') ||
      compact.includes('joineddate') ||
      compact.includes('registrationdate') ||
      compact.includes('submittedat') ||
      compact.includes('submissiondate') ||
      compact.includes('leaddate')
    ) {
      return header;
    }
  }
  return '';
}

function pickExactAlias(headers: string[], aliases: Set<string>): string {
  for (const header of headers) {
    if (aliases.has(normalizeHeaderKey(header))) return header;
  }
  // compact match (First_Name → firstname)
  for (const header of headers) {
    const compact = compactHeaderKey(header);
    for (const alias of aliases) {
      if (compactHeaderKey(alias) === compact) return header;
    }
  }
  return '';
}

function pickNameHeader(headers: string[]): { name: string; name_secondary: string } {
  const first = pickExactAlias(headers, FIRST_NAME_ALIASES);
  const last = pickExactAlias(headers, LAST_NAME_ALIASES);
  if (first || last) {
    return { name: first, name_secondary: last };
  }

  const full = pickExactAlias(headers, FULL_NAME_ALIASES);
  if (full) return { name: full, name_secondary: '' };

  // Soft fallback: header contains "name" but is not company/user/etc.
  for (const header of headers) {
    const hl = normalizeHeaderKey(header);
    if (!hl.includes('name') && !hl.includes('full')) continue;
    if (NAME_EXCLUDE.test(hl)) continue;
    if (LAST_NAME_ALIASES.has(hl)) continue;
    return { name: header, name_secondary: '' };
  }

  return { name: '', name_secondary: '' };
}

function pickPhoneHeader(headers: string[]): string {
  const exact = pickExactAlias(headers, PHONE_ALIASES);
  if (exact) return exact;

  for (const header of headers) {
    const hl = normalizeHeaderKey(header);
    const compact = compactHeaderKey(header);
    // Avoid matching "customer number", "invoice number", "ABN number", etc.
    if (hl.includes('phone') || hl.includes('mobile') || hl.includes('telephone')) return header;
    if (compact === 'tel' || compact.startsWith('tel') && compact.length <= 12) return header;
    if (/\b(cell|mobile)\b/.test(hl)) return header;
  }
  return '';
}

function pickEmailHeader(headers: string[]): string {
  const exact = pickExactAlias(headers, EMAIL_ALIASES);
  if (exact) return exact;
  for (const header of headers) {
    const hl = normalizeHeaderKey(header);
    if (hl.includes('email') || hl === 'e-mail' || hl === 'mail') return header;
  }
  return '';
}

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
const looksLikePhone = (value: string) => {
  if (looksLikeEmail(value) || /[a-z]/i.test(value)) return false;
  const trimmed = value.trim();
  // Dates such as 7/24/2026 contain seven or more digits and used to be
  // mistaken for phone numbers during content-based column detection.
  if (/^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{2,4}(?:\s+.*)?$/.test(trimmed)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 16;
};

function isPhoneCandidateHeader(header: string): boolean {
  const compact = compactHeaderKey(header);
  // Do not infer a phone column from dates, timestamps, IDs, or numeric
  // business fields merely because their values happen to contain 7+ digits.
  return !/(date|time|timestamp|created|updated|year|month|day|id|number|count|amount|price|age)/i.test(compact);
}

function bestMatchingHeader(
  headers: string[],
  sampleRows: Array<Record<string, unknown>>,
  matcher: (value: string) => boolean,
  excluded: string[] = [],
): string {
  const populatedSamples = sampleRows.slice(0, 25);
  let bestHeader = '';
  let bestScore = 0;
  for (const header of headers) {
    if (excluded.includes(header)) continue;
    const values = populatedSamples
      .map(row => String(row?.[header] ?? '').trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    const score = values.filter(matcher).length / values.length;
    if (score > bestScore) {
      bestHeader = header;
      bestScore = score;
    }
  }
  return bestScore >= 0.6 ? bestHeader : '';
}

/**
 * Build spreadsheet-header → CRM-field mapping for the import UI.
 */
export function buildAutoMapping(
  headers: string[],
  fields: ImportCustomField[] = [],
  sampleRows: Array<Record<string, unknown>> = [],
  findDateHeader: (headers: string[]) => string = findLeadDateHeaderLocal,
): Record<string, string> {
  const cleanHeaders = (headers || [])
    .map(h => String(h ?? '').replace(/^\uFEFF/, '').trim())
    .filter(Boolean);

  const mapping: Record<string, string> = {
    name: '',
    name_secondary: '',
    email: '',
    phone: '',
    created_at: findDateHeader(cleanHeaders) || '',
  };

  const namePick = pickNameHeader(cleanHeaders);
  mapping.name = namePick.name;
  mapping.name_secondary = namePick.name_secondary;
  mapping.email = pickEmailHeader(cleanHeaders);
  mapping.phone = pickPhoneHeader(cleanHeaders);

  // Content-based detection can override weak header matches
  const detectedEmail = bestMatchingHeader(cleanHeaders, sampleRows, looksLikeEmail);
  if (detectedEmail) mapping.email = detectedEmail;
  const detectedPhone = bestMatchingHeader(
    cleanHeaders.filter(isPhoneCandidateHeader),
    sampleRows,
    looksLikePhone,
    mapping.email ? [mapping.email] : [],
  );
  if (detectedPhone) mapping.phone = detectedPhone;

  // Map custom CRM fields by name / common aliases
  for (const cf of fields) {
    const fieldName = String(cf.field_name || '').trim();
    if (!fieldName) continue;
    const cfL = normalizeHeaderKey(fieldName);
    const compactField = compactHeaderKey(fieldName);

    for (const h of cleanHeaders) {
      const hl = normalizeHeaderKey(h);
      const compactHeader = compactHeaderKey(h);
      const aliasMatch =
        (cfL === 'country' && ['countryregion', 'country'].includes(compactHeader)) ||
        (cfL === 'company' &&
          ['companyname', 'organisation', 'organization', 'company', 'businessname'].includes(
            compactHeader,
          )) ||
        (cfL === 'organisation' &&
          ['companyname', 'organization', 'company', 'organisation', 'businessname'].includes(
            compactHeader,
          )) ||
        (cfL === 'organization' &&
          ['companyname', 'organisation', 'company', 'organization', 'businessname'].includes(
            compactHeader,
          )) ||
        (cfL === 'quote_status' &&
          ['quotesentviaemail', 'quotesent', 'quotesentemail'].includes(compactHeader)) ||
        (cfL === 'registration_confirmed' &&
          ['registrationconfirmed', 'registered', 'confirmed'].includes(compactHeader)) ||
        (cfL === 'job_title' && ['jobtitle', 'title', 'position'].includes(compactHeader));

      if (cfL === hl || compactHeader === compactField || aliasMatch) {
        mapping[fieldName] = h;
        break;
      }
    }
  }

  // Don't let company fields steal email/phone columns
  for (const field of fields) {
    const fieldKey = normalizeHeaderKey(field.field_name);
    if (!['organisation', 'organization', 'company'].includes(fieldKey)) continue;
    const mapped = mapping[field.field_name];
    if (mapped && [mapping.email, mapping.phone, mapping.name].includes(mapped)) {
      mapping[field.field_name] = '';
    }
  }

  return mapping;
}
