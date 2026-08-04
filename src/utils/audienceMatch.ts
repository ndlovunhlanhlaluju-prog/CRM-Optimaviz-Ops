/**
 * Soft audience-fit scoring: match a lead against a brand's target audience
 * description and keywords so the UI can tint rows that clearly fit.
 */

export type AudienceMatchLevel = 'none' | 'soft' | 'strong';

export type AudienceMatchResult = {
  level: AudienceMatchLevel;
  score: number;
  matchedTerms: string[];
};

export type BrandAudienceProfile = {
  id?: string;
  name?: string;
  color?: string;
  description?: string;
  target_audience?: string;
  audience_keywords?: string[] | string;
};

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'with',
  'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'that', 'this',
  'these', 'those', 'their', 'our', 'your', 'its', 'it', 'we', 'you', 'they',
  'who', 'whom', 'which', 'what', 'when', 'where', 'why', 'how', 'into', 'onto',
  'about', 'over', 'under', 'than', 'then', 'also', 'such', 'via', 'per', 'any',
  'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'no', 'not',
  'only', 'own', 'same', 'so', 'too', 'very', 'can', 'will', 'just', 'should',
  'would', 'could', 'may', 'might', 'must', 'need', 'across', 'among', 'between',
  'people', 'person', 'customer', 'customers', 'client', 'clients', 'user', 'users',
  'business', 'businesses', 'company', 'companies', 'team', 'teams', 'looking',
  'looking', 'seeking', 'want', 'wants', 'need', 'needs', 'using', 'use', 'used',
  'based', 'focus', 'focused', 'target', 'targets', 'audience', 'market', 'markets',
  'sector', 'sectors', 'industry', 'industries', 'including', 'include', 'includes',
  'etc', 'eg', 'ie', 'like', 'e.g', 'i.e',
]);

function tokenize(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#./&\s-]+/gu, ' ')
    .split(/[\s,/|;]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t));
}

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Pull multi-word phrases (2–4 tokens) from free-text audience descriptions. */
function extractPhrases(text: string): string[] {
  const words = tokenize(text);
  const phrases: string[] = [];
  for (let n = 4; n >= 2; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      phrases.push(words.slice(i, i + n).join(' '));
    }
  }
  return uniquePreserve(phrases).slice(0, 40);
}

export function buildAudienceTerms(profile: BrandAudienceProfile | null | undefined): string[] {
  if (!profile) return [];
  const keywordList = Array.isArray(profile.audience_keywords)
    ? profile.audience_keywords
    : String(profile.audience_keywords || '')
        .split(/[\n,;|]+/)
        .map(s => s.trim())
        .filter(Boolean);

  const fromKeywords = keywordList
    .flatMap(k => {
      const raw = String(k).trim().toLowerCase();
      if (!raw) return [];
      // Prefer the full keyword phrase when multi-word
      if (raw.includes(' ') || raw.includes('-')) return [raw, ...tokenize(raw)];
      return tokenize(raw);
    });

  const fromAudience = [
    ...extractPhrases(profile.target_audience || ''),
    ...tokenize(profile.target_audience || ''),
  ];
  // Description is weaker signal — only multi-word phrases to avoid noise
  const fromDescription = extractPhrases(profile.description || '');

  // Prefer longer / explicit keywords first
  return uniquePreserve([...fromKeywords, ...fromAudience, ...fromDescription])
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .slice(0, 60);
}

function leadSearchBlob(lead: {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  tags?: string[] | string;
  source?: string;
  funnel_stage?: string;
  custom_fields?: Record<string, unknown>;
}): string {
  const cf = lead.custom_fields || {};
  const cfParts: string[] = [];
  for (const [key, val] of Object.entries(cf)) {
    if (key.startsWith('_')) continue;
    if (val == null || val === '') continue;
    if (Array.isArray(val)) cfParts.push(val.map(String).join(' '));
    else if (typeof val === 'object') continue;
    else cfParts.push(String(val));
  }
  const tags = Array.isArray(lead.tags) ? lead.tags.join(' ') : String(lead.tags || '');
  return [
    lead.name,
    lead.email,
    lead.notes,
    tags,
    lead.source,
    lead.funnel_stage,
    ...cfParts,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function scoreLeadAudienceMatch(
  lead: {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    tags?: string[] | string;
    source?: string;
    funnel_stage?: string;
    custom_fields?: Record<string, unknown>;
  },
  profile: BrandAudienceProfile | null | undefined,
  prebuiltTerms?: string[],
): AudienceMatchResult {
  const terms = prebuiltTerms ?? buildAudienceTerms(profile);
  if (!terms.length) {
    return { level: 'none', score: 0, matchedTerms: [] };
  }

  const hay = leadSearchBlob(lead);
  if (!hay.trim()) {
    return { level: 'none', score: 0, matchedTerms: [] };
  }

  const matched: string[] = [];
  let score = 0;

  for (const term of terms) {
    if (!term) continue;
    if (hay.includes(term)) {
      matched.push(term);
      // Longer phrases are stronger audience signals
      const weight = term.includes(' ') ? 3 + Math.min(3, term.split(' ').length) : term.length >= 8 ? 2 : 1;
      score += weight;
      if (matched.length >= 8) break;
    }
  }

  // Deduplicate near-duplicates (e.g. "mining" and "mining manager")
  const cleaned = uniquePreserve(matched).slice(0, 5);
  if (score >= 5 || cleaned.some(t => t.includes(' '))) {
    return { level: 'strong', score, matchedTerms: cleaned };
  }
  if (score >= 2 || cleaned.length >= 1) {
    return { level: cleaned.length >= 1 && score >= 1 ? (score >= 2 ? 'soft' : 'soft') : 'none', score, matchedTerms: cleaned };
  }
  return { level: 'none', score: 0, matchedTerms: [] };
}

/**
 * Brand-colored soft highlight styles. Each brand's own color is the hue base
 * so TaskGo / NestWise / OptimaViz etc. read as distinct portfolio signals.
 */
export function audienceMatchStyles(
  level: AudienceMatchLevel,
  brandColor: string,
): {
  rowBackground?: string;
  borderLeft?: string;
  boxShadow?: string;
  accentColor?: string;
  badgeBackground?: string;
  badgeBorder?: string;
} {
  if (level === 'none' || !brandColor) return {};
  const strong = level === 'strong';
  const alphaBg = strong ? 0.11 : 0.06;
  const alphaBorder = strong ? 0.85 : 0.55;
  return {
    rowBackground: `color-mix(in srgb, ${brandColor} ${Math.round(alphaBg * 100)}%, transparent)`,
    borderLeft: `3px solid color-mix(in srgb, ${brandColor} ${Math.round(alphaBorder * 100)}%, transparent)`,
    boxShadow: strong
      ? `inset 0 0 0 1px color-mix(in srgb, ${brandColor} 14%, transparent)`
      : undefined,
    accentColor: brandColor,
    badgeBackground: `color-mix(in srgb, ${brandColor} ${strong ? 16 : 10}%, var(--bg-card))`,
    badgeBorder: `1px solid color-mix(in srgb, ${brandColor} ${strong ? 38 : 22}%, transparent)`,
  };
}

export function audienceMatchLabel(level: AudienceMatchLevel): string {
  if (level === 'strong') return 'Strong fit';
  if (level === 'soft') return 'Audience fit';
  return '';
}
