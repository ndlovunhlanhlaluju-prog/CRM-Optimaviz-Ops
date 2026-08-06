import fs from 'fs';
import path from 'path';
import { wipeOpsDataButPreserveBrandProfiles } from './opsDataWipe';

// Let's define the interface structure for our Database
export interface DbUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  allowed_brand_ids?: string[];
  platform_role?: 'superadmin' | 'owner' | 'none';
  session_token?: string;
  session_expires_at?: string;
  presence_status?: 'online' | 'away' | 'offline';
  presence_updated_at?: string;
  profile_picture_url?: string;
  workspace_state?: any;
  notification_state?: {
    seen_signature?: string;
    dismissed_ids?: string[];
    preferences?: any;
    updated_at?: string;
  };
  created_at: string;
}

export interface DbBrandFunnel {
  id: string;
  brand_id: string;
  brand_name: string;
  stages: string[];
  description?: string;
  target_audience?: string;
  audience_keywords?: string[];
  cross_sell_notes?: string;
  market_scope?: 'global' | 'country_specific' | string;
  market_countries?: string[];
  created_at: string;
}

export interface DbLead {
  id: string;
  brand_id: string;
  brand_name: string;
  name: string;
  email: string;
  phone: string;
  funnel_stage: string;
  notes?: string;
  tags: string[];
  custom_fields: Record<string, string>;
  owner_id?: string;
  owner_name?: string;
  follow_up_date?: string;
  created_at: string;
  lead_classification?: 'prospect' | 'verified';
  classification_updated_at?: string;
  classification_updated_by?: string;
  classification_reason?: string;
}

export type DbLeadSourceProvider = 'website' | 'facebook' | 'linkedin' | 'api' | 'webhook' | string;

export interface DbLeadSource {
  id: string;
  workspace_id?: string;
  brand_id: string;
  name: string;
  provider: DbLeadSourceProvider;
  status: 'active' | 'paused' | 'needs_setup' | 'error' | string;
  secret_key: string;
  field_mappings: Record<string, string>;
  default_stage?: string;
  duplicate_strategy?: 'update_existing' | 'skip' | 'create_new' | string;
  unmapped_field_strategy?: 'auto' | 'ignore' | string;
  external_account_id?: string;
  external_page_id?: string;
  external_form_id?: string;
  last_sync_at?: string;
  last_error?: string;
  leads_imported?: number;
  created_by_user_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface DbLeadSourceLog {
  id: string;
  workspace_id?: string;
  source_id: string;
  brand_id: string;
  status: 'created' | 'duplicate_updated' | 'duplicate_skipped' | 'failed' | string;
  lead_id?: string;
  external_lead_id?: string;
  message?: string;
  payload_summary?: Record<string, string>;
  created_at: string;
}

export type DbSocialProvider = 'meta' | 'linkedin' | string;
export type DbSocialStatus = 'connected' | 'needs_attention' | 'expired_token' | 'not_connected' | 'error' | string;
export type DbSocialPostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'
  | 'pending_approval'
  | 'rejected'
  | string;

export interface DbSocialConnection {
  id: string;
  workspace_id?: string;
  user_id?: string;
  provider: DbSocialProvider;
  access_token?: string;
  refresh_or_long_lived_token?: string;
  expires_at?: string;
  provider_user_id?: string;
  connected_email?: string;
  connected_name?: string;
  status: DbSocialStatus;
  last_error?: string;
  created_at: string;
  updated_at?: string;
}

export interface DbSocialPage {
  id: string;
  workspace_id?: string;
  /** CRM brand this page publishes for (portfolio mapping). */
  brand_id?: string;
  provider: DbSocialProvider;
  connection_id?: string;
  page_id: string;
  page_name: string;
  page_access_token?: string;
  instagram_business_account_id?: string;
  instagram_username?: string;
  status: DbSocialStatus;
  created_at: string;
  updated_at?: string;
}

export interface DbSocialAdAccount {
  id: string;
  workspace_id?: string;
  /** CRM brand this ad account reports under. */
  brand_id?: string;
  provider: DbSocialProvider;
  connection_id?: string;
  ad_account_id: string;
  ad_account_name: string;
  currency?: string;
  status: DbSocialStatus;
  created_at: string;
  updated_at?: string;
}

export interface DbSocialPost {
  id: string;
  workspace_id?: string;
  brand_id: string;
  provider: DbSocialProvider;
  page_id?: string;
  instagram_account_id?: string;
  linkedin_organization_id?: string;
  caption: string;
  media_urls: string[];
  post_type: 'text' | 'image' | 'video' | string;
  publish_targets: string[];
  status: DbSocialPostStatus;
  scheduled_for?: string;
  published_at?: string;
  provider_post_id?: string;
  failure_reason?: string;
  created_by?: string;
  /** Approval workflow (Phase 2) */
  approval_requested_by?: string;
  approval_requested_by_name?: string;
  approval_requested_at?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at?: string;
}

export interface DbSocialAdMetric {
  id: string;
  workspace_id?: string;
  brand_id?: string;
  provider: DbSocialProvider;
  ad_account_id: string;
  campaign_id?: string;
  campaign_name: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  cost_per_lead: number;
  created_at: string;
  updated_at?: string;
}

/** Saved captions / hashtag packs per brand (content library). */
export interface DbSocialContentTemplate {
  id: string;
  workspace_id?: string;
  brand_id: string;
  name: string;
  caption: string;
  hashtags: string[];
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at?: string;
}

/** Monthly budget + CPL alert threshold per brand for ads cockpit. */
export interface DbSocialBrandBudget {
  id: string;
  workspace_id?: string;
  brand_id: string;
  monthly_budget: number;
  cpl_alert_threshold: number;
  currency?: string;
  created_at: string;
  updated_at?: string;
}

export interface DbNote {
  id: string;
  lead_id: string;
  content: string;
  created_by?: string;
  created_at: string;
}

export interface DbCall {
  id: string;
  lead_id: string;
  outcome: string;
  notes?: string;
  duration?: number;
  created_by?: string;
  created_at: string;
}

export interface DbEmail {
  id: string;
  lead_id: string;
  subject: string;
  html_content: string;
  status: 'sent' | 'pending' | 'failed' | 'received';
  body?: string;
  template_name?: string;
  brand_id?: string;
  to_email?: string;
  to_name?: string;
  from_email?: string;
  direction?: 'outbound' | 'inbound';
  mailbox_folder?: 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'failed' | 'all' | string;
  created_by?: string;
  provider?: string;
  provider_message_id?: string;
  error_message?: string;
  created_at: string;
  opened_at?: string;
  read_at?: string;
  read_by?: string;
  read_by_name?: string;

  open_count?: number;

  attachments?: Array<{
    id: string;
    name: string;
    mime_type?: string;
    size?: number;
    provider?: string;
    data_base64?: string;
  }>;
}

export interface DbTask {
  id: string;
  brand_id: string;
  user_id: string;
  user_name: string;
  user_location: string;
  content: string;
  status: 'In Progress' | 'Completed' | 'Pending' | 'Needs Help';
  created_at: string;
}

export interface DbWhatsApp {
  id: string;
  lead_id: string;
  brand_id?: string;
  from_number?: string;
  to_number?: string;
  direction?: 'outbound' | 'inbound';
  provider?: 'manual' | 'cloud_api' | 'twilio' | string;
  provider_message_id?: string;
  status?: 'draft' | 'sent' | 'delivered' | 'read' | 'failed' | 'replied' | 'received';
  error_message?: string;
  template_name?: string;
  message: string;
  wa_link?: string;
  created_by?: string;
  created_at: string;
}

export interface DbWhatsAppTemplate {
  id: string;
  brand_id: string;
  name: string;
  message: string;
  is_active?: boolean;
  updated_at?: string;
}

export interface DbMessageTemplate {
  id: string;
  brand_id: string;
  channel: 'email' | 'whatsapp' | 'call';
  name: string;
  subject?: string;
  body: string;
  is_active?: boolean;
  updated_at?: string;
}

export interface DbBrandIntegration {
  id: string;
  brand_id: string;
  email_provider: string;
  email_sender_name?: string;
  email_sender_address?: string;
  email_reply_to?: string;
  email_logo_url?: string;
  email_signature?: string;
  gmail_connected_email?: string;
  gmail_refresh_token?: string;
  gmail_access_token?: string;
  gmail_token_expiry?: string;
  gmail_connected_at?: string;
  outlook_connected_email?: string;
  outlook_refresh_token?: string;
  outlook_access_token?: string;
  outlook_token_expiry?: string;
  outlook_connected_at?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_secure?: boolean;
  smtp_username?: string;
  smtp_password_env?: string;
  email_accounts?: DbEmailProviderAccount[];
  whatsapp_provider?: string;
  whatsapp_number?: string;
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_access_token_encrypted?: string;
  whatsapp_access_token_env?: string;
  whatsapp_connected_at?: string;
  whatsapp_verify_token?: string;
  whatsapp_profile_name?: string;
  whatsapp_profile_about?: string;
  whatsapp_profile_picture_url?: string;
  whatsapp_business_category?: string;
  whatsapp_business_website?: string;
  call_provider?: string;
  call_number?: string;
  automation_enabled?: boolean;
  updated_at?: string;
}

export interface SnapshotCardConfig {
  id: string;
  brand_id?: string;
  label: string;
  fieldKey: string;
  matchValue?: string;
  target?: number;
  unit: string;
  icon: string;
  color: string;
  active?: boolean;
}

export interface DbEmailProviderAccount {
  id: string;
  label: string;
  provider: string;
  email: string;
  reply_to?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_secure?: boolean;
  smtp_username?: string;
  smtp_password_env?: string;
  is_default?: boolean;
}

export interface DbEmailConnection {
  id: string;
  tenant_id: string;
  brand_id: string;
  provider: 'gmail' | 'outlook' | 'yahoo' | string;
  provider_email: string;
  display_name?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_secure?: boolean;
  smtp_username?: string;
  smtp_password?: string;
  smtp_password_env?: string;
  imap_host?: string;
  imap_port?: string;
  imap_secure?: boolean;
  imap_username?: string;
  imap_password?: string;
  imap_password_env?: string;
  send_enabled?: boolean;
  sync_enabled?: boolean;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: string;
  connection_status: 'connected' | 'expired' | 'revoked' | 'error' | string;
  connected_at: string;
  updated_at?: string;
  created_by_user_id?: string;
  is_default?: boolean;
  last_sync_at?: string;
  last_error?: string;
  scopes?: string[];
  oauth_mode?: 'central' | 'bring_your_own' | string;
}

export interface DbSequenceStep {
  id: string;
  name: string;
  delay_days: number;
  channel?: 'email' | 'whatsapp' | 'call' | 'task' | string;
  subject: string;
  html_content: string;
}

export interface DbSequence {
  id: string;
  brand_id: string;
  name: string;
  description?: string;
  trigger_stage?: string;
  active: boolean;
  steps: DbSequenceStep[];
  created_at: string;
}

export interface DbCustomField {
  id: string;
  brand_id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'boolean' | 'date';
  required: boolean;
}

export interface DbEnrollment {
  id: string;
  lead_id: string;
  sequence_id: string;
  enrolled_at: string;
  current_step: number;
  status: 'active' | 'completed' | 'cancelled';
}

export interface DbTeamNote {
  id: string;
  title: string;
  content: string;
  color?: string;
  pinned?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbTeamMessage {
  id: string;
  content: string;
  file_name?: string;
  file_url?: string;
  file_type?: string;
  recipient_ids?: string[];
  recipient_names?: string[];
  attachments?: Array<{
    id: string;
    name: string;
    mime_type: string;
    size: number;
    data_base64: string;
  }>;
  event_type?: string;
  call_room_slug?: string;
  call_status?: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

export interface DbUsageEvent {
  id: string;
  brand_id: string;
  feature: string;
  event_type: string;
  session_id?: string;
  user_id?: string;
  path?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface DbWebsiteAnalyticsSite {
  id: string;
  workspace_id?: string;
  brand_id: string;
  name: string;
  domain?: string;
  status: 'active' | 'paused' | string;
  public_key: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at?: string;
  last_seen_at?: string;
}

export interface DbWebsiteTrafficEvent {
  id: string;
  workspace_id?: string;
  brand_id: string;
  site_id: string;
  session_id: string;
  visitor_id?: string;
  page_url?: string;
  path?: string;
  title?: string;
  referrer?: string;
  referrer_domain?: string;
  country?: string;
  device?: 'desktop' | 'mobile' | 'tablet' | string;
  browser?: string;
  event_type: 'pageview' | 'signup_partial' | 'signup_completed' | string;
  lead_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface DbPortfolioOpportunityRule {
  id: string;
  name: string;
  source_brand_id: string;
  target_brand_id: string;
  trigger_field: string;
  trigger_operator: 'equals' | 'contains' | string;
  trigger_value: string;
  required_keywords?: string[];
  excluded_keywords?: string[];
  respect_market_scope?: boolean;
  minimum_keyword_matches?: number;
  max_results_per_scan?: number;
  offer_label: string;
  active: boolean;
  created_by_user_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface DbPortfolioOpportunity {
  id: string;
  rule_id: string;
  source_lead_id: string;
  source_brand_id: string;
  target_brand_id: string;
  status: 'pending' | 'accepted' | 'dismissed' | string;
  title: string;
  reason: string;
  offer_label: string;
  target_lead_id?: string;
  reviewed_by_user_id?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface AuditEntry {
  id: string;
  entity_type: 'lead' | 'sequence' | 'user' | 'task';
  entity_id: string;
  action: 'create' | 'update' | 'delete' | 'stage_change' | 'enroll';
  changed_by: string;
  changed_by_name: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
}

export interface Schema {
  users: DbUser[];
  brand_funnels: DbBrandFunnel[];
  leads: DbLead[];
  notes: DbNote[];
  calls: DbCall[];
  emails: DbEmail[];
  whatsapp: DbWhatsApp[];
  whatsapp_numbers?: Record<string, string>;
  whatsapp_templates?: DbWhatsAppTemplate[];
  message_templates?: DbMessageTemplate[];
  brand_integrations?: DbBrandIntegration[];
  email_connections?: DbEmailConnection[];
  lead_sources?: DbLeadSource[];
  lead_source_logs?: DbLeadSourceLog[];
  brand_workspace_snapshots?: SnapshotCardConfig[];
  social_connections?: DbSocialConnection[];
  social_pages?: DbSocialPage[];
  social_ad_accounts?: DbSocialAdAccount[];
  social_posts?: DbSocialPost[];
  social_ad_metrics?: DbSocialAdMetric[];
  social_content_templates?: DbSocialContentTemplate[];
  social_brand_budgets?: DbSocialBrandBudget[];
  website_analytics_sites?: DbWebsiteAnalyticsSite[];
  website_traffic_events?: DbWebsiteTrafficEvent[];
  portfolio_opportunity_rules?: DbPortfolioOpportunityRule[];
  portfolio_opportunities?: DbPortfolioOpportunity[];
  sequences: DbSequence[];
  custom_fields: DbCustomField[];
  enrollments: DbEnrollment[];
  tasks: DbTask[];
  team_messages: DbTeamMessage[];
  team_notes?: DbTeamNote[];
  usage_events?: DbUsageEvent[];
  /** Provider message IDs removed from CRM so Gmail/Outlook sync does not re-import them. */
  deleted_email_provider_ids?: Array<{
    brand_id: string;
    provider: string;
    provider_message_id: string;
    deleted_at: string;
  }>;
  audit_log: AuditEntry[];
}

/** Standalone local persistence paths. Configure absolute paths when needed. */
const DEFAULT_DB_PATH = path.join(process.cwd(), 'db.json');
const DEFAULT_BACKUP_DIR = path.join(process.cwd(), 'backups', 'ops');
let DB_PATH = path.resolve(process.env['CRM_DB_FILE'] || DEFAULT_DB_PATH);
let BACKUP_DIR = path.resolve(process.env['CRM_BACKUP_DIR'] || DEFAULT_BACKUP_DIR);

function isPathWritable(testPath: string): boolean {
  try {
    const dir = path.dirname(testPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-probe-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

if (!isPathWritable(DB_PATH)) {
  const fallbackDir = '/tmp';
  try {
    if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
    DB_PATH = path.resolve(process.env['CRM_DB_FILE'] || path.join(fallbackDir, 'db.json'));
    BACKUP_DIR = path.resolve(process.env['CRM_BACKUP_DIR'] || path.join(fallbackDir, 'backups', 'ops'));
    console.log(`[CRM DB] Default path not writable, using fallback file=${DB_PATH} backups=${BACKUP_DIR}`);
  } catch {
    console.warn('[CRM DB] Fallback writable path unavailable; database may be read-only.');
  }
}

console.log(`[CRM DB] standalone file=${DB_PATH} backups=${BACKUP_DIR}`);

/** Prefer richer CRM snapshots so empty seed/cloud never silently replaces real data. */
function schemaRichness(data: Partial<Schema> | null | undefined): number {
  if (!data) return 0;
  const leads = Array.isArray(data.leads) ? data.leads.length : 0;
  const customFields = Array.isArray(data.custom_fields) ? data.custom_fields.length : 0;
  const emails = Array.isArray(data.emails) ? data.emails.length : 0;
  const notes = Array.isArray(data.notes) ? data.notes.length : 0;
  const users = Array.isArray(data.users) ? data.users.length : 0;
  const whatsapp = Array.isArray(data.whatsapp) ? data.whatsapp.length : 0;
  const tasks = Array.isArray(data.tasks) ? data.tasks.length : 0;
  // Leads dominate; custom field definitions matter for column recovery.
  return leads * 1000 + customFields * 50 + emails * 5 + notes * 3 + whatsapp * 3 + tasks + users;
}

function readJsonTextFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  if (!buf.length) return null;
  // Handle UTF-8 BOM and accidental UTF-16 exports from PowerShell redirection.
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    return buf.toString('utf16le').replace(/^\uFEFF/, '');
  }
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
    // Rare UTF-16 BE — swap pairs then decode as LE-ish fallback via latin1 rebuild is fragile;
    // convert via Buffer swap.
    const swapped = Buffer.alloc(buf.length - (buf.length % 2));
    for (let i = 0; i + 1 < buf.length; i += 2) {
      swapped[i] = buf[i + 1];
      swapped[i + 1] = buf[i];
    }
    return swapped.toString('utf16le').replace(/^\uFEFF/, '');
  }
  return buf.toString('utf8').replace(/^\uFEFF/, '');
}

function tryReadSchemaFile(filePath: string): Schema | null {
  try {
    const raw = readJsonTextFile(filePath);
    if (!raw || !raw.trim()) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return safeSchema(parsed);
  } catch (err) {
    console.error(`Error reading schema file ${filePath}:`, err);
    return null;
  }
}

function listBackupCandidates(): string[] {
  const candidates: string[] = [
    path.join(BACKUP_DIR, 'db-latest.json'),
  ];
  try {
    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(name => /^db-.*\.json$/i.test(name) && name !== 'db-latest.json')
        .map(name => ({
          name,
          full: path.join(BACKUP_DIR, name),
          mtime: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);
      for (const file of files) candidates.push(file.full);
    }
    // Legacy root backups folder (pre product split)
    const legacyDir = path.join(process.cwd(), 'backups');
    if (fs.existsSync(legacyDir) && path.resolve(legacyDir) !== path.resolve(BACKUP_DIR)) {
      for (const name of fs.readdirSync(legacyDir)) {
        if (/^db-.*\.json$/i.test(name)) candidates.push(path.join(legacyDir, name));
      }
    }
  } catch (err) {
    console.error('Error listing backup candidates:', err);
  }
  return candidates;
}

function recoverSchemaFromBackups(): Schema | null {
  let best: Schema | null = null;
  let bestScore = 0;
  let bestPath = '';
  for (const filePath of listBackupCandidates()) {
    const schema = tryReadSchemaFile(filePath);
    if (!schema) continue;
    const score = schemaRichness(schema);
    if (score > bestScore) {
      best = schema;
      bestScore = score;
      bestPath = filePath;
    }
  }
  if (best && bestScore > 0) {
    console.log(`Recovered CRM database from backup (${bestPath}) with richness score ${bestScore}.`);
    return best;
  }
  return null;
}

const INITIAL_FUNNELS: DbBrandFunnel[] = [
  {
    "id": "1",
    "brand_id": "optimaviz",
    "brand_name": "Optimaviz",
    "stages": ["New Lead", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"],
    "created_at": "2026-06-06T21:39:12.743Z"
  },
  {
    "id": "2",
    "brand_id": "taskgo",
    "brand_name": "TaskGo",
    "stages": ["New Lead", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"],
    "created_at": "2026-06-06T21:39:12.749Z"
  },
  {
    "id": "3",
    "brand_id": "idao",
    "brand_name": "IDAO",
    "stages": ["New Lead", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"],
    "created_at": "2026-06-06T21:39:12.751Z"
  },
  {
    "id": "4",
    "brand_id": "optimaclean",
    "brand_name": "OptimaClean",
    "stages": ["New Lead", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"],
    "created_at": "2026-06-06T21:39:12.752Z"
  },
  {
    "id": "5",
    "brand_id": "nestwise",
    "brand_name": "NestWise",
    "stages": ["New Lead", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"],
    "created_at": "2026-06-06T21:39:12.754Z"
  }
];


export interface SupabaseStatus {
  configured: boolean;
  url?: string;
  last_sync_at?: string;
  last_error?: string;
  using_fallback: boolean;
}

const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'crm_data';
const SUPABASE_RECORD_ID = process.env.SUPABASE_RECORD_ID || 'main';
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function safeSchema(parsed: Partial<Schema> | null | undefined): Schema {
  return {
    users: parsed?.users || [],
    brand_funnels: parsed?.brand_funnels || INITIAL_FUNNELS,
    leads: parsed?.leads || [],
    notes: parsed?.notes || [],
    calls: parsed?.calls || [],
    emails: parsed?.emails || [],
    whatsapp: parsed?.whatsapp || [],
    whatsapp_numbers: parsed?.whatsapp_numbers || {},
    whatsapp_templates: parsed?.whatsapp_templates || [],
    message_templates: parsed?.message_templates || [],
    brand_integrations: parsed?.brand_integrations || [],
    email_connections: parsed?.email_connections || [],
    lead_sources: parsed?.lead_sources || [],
    lead_source_logs: parsed?.lead_source_logs || [],
    brand_workspace_snapshots: parsed?.brand_workspace_snapshots || [],
    social_connections: parsed?.social_connections || [],
    social_pages: parsed?.social_pages || [],
    social_ad_accounts: parsed?.social_ad_accounts || [],
    social_posts: parsed?.social_posts || [],
    social_ad_metrics: parsed?.social_ad_metrics || [],
    social_content_templates: Array.isArray((parsed as any)?.social_content_templates)
      ? (parsed as any).social_content_templates
      : [],
    social_brand_budgets: Array.isArray((parsed as any)?.social_brand_budgets)
      ? (parsed as any).social_brand_budgets
      : [],
    website_analytics_sites: parsed?.website_analytics_sites || [],
    website_traffic_events: parsed?.website_traffic_events || [],
    portfolio_opportunity_rules: parsed?.portfolio_opportunity_rules || [],
    portfolio_opportunities: parsed?.portfolio_opportunities || [],
    sequences: parsed?.sequences || [],
    custom_fields: parsed?.custom_fields || [],
    enrollments: parsed?.enrollments || [],
    tasks: parsed?.tasks || [],
    team_messages: parsed?.team_messages || [],
    team_notes: parsed?.team_notes || [],
    usage_events: parsed?.usage_events || [],
    deleted_email_provider_ids: Array.isArray((parsed as any)?.deleted_email_provider_ids)
      ? (parsed as any).deleted_email_provider_ids
      : [],
    audit_log: parsed?.audit_log || [],
  };
}

/**
 * Repair common UTF-8 mojibake (UTF-8 bytes misread as Windows-1252/Latin-1).
 * Patterns use Unicode escapes only so this source file cannot re-corrupt itself.
 */
function sanitizeStringValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  let s = value;

  // Curly quotes / dashes / ellipsis produced by double-encoding
  s = s.replace(/\u00E2\u20AC\u2122/g, '\u2019'); // â€™ → ’
  s = s.replace(/\u00E2\u20AC\u0153/g, '\u201C'); // â€œ → “
  s = s.replace(/\u00E2\u20AC\u009D/g, '\u201D'); // â€\x9d → ”
  s = s.replace(/\u00E2\u20AC\u201D/g, '\u201D'); // â€ → ”
  s = s.replace(/\u00E2\u20AC\u201C/g, '\u201C'); // â€œ variant
  s = s.replace(/\u00E2\u20AC\u2018/g, '\u2018'); // â€˜ → ‘
  s = s.replace(/\u00E2\u20AC\u2019/g, '\u2019'); // â€™ variant
  s = s.replace(/\u00E2\u20AC\u2013/g, '\u2013'); // â€“ → –
  s = s.replace(/\u00E2\u20AC\u2014/g, '\u2014'); // â€” → —
  s = s.replace(/\u00E2\u20AC\u00A6/g, '\u2026'); // â€¦ → …

  // Literal mojibake sequences still present as multi-char strings in some dumps
  s = s.replace(/â€™/g, '\u2019');
  s = s.replace(/â€˜/g, '\u2018');
  s = s.replace(/â€œ/g, '\u201C');
  s = s.replace(/â€/g, '\u201D');
  s = s.replace(/â€“/g, '\u2013');
  s = s.replace(/â€”/g, '\u2014');
  s = s.replace(/â€¦/g, '\u2026');

  // Spurious C2 (Â) before Latin-1 punctuation / nbsp
  s = s.replace(/\u00C2\u00A0/g, ' '); // Â + NBSP → space
  s = s.replace(/\u00C2([\u00A1-\u00BF])/g, '$1'); // Â¿ → ¿, etc.
  s = s.replace(/\u00C2 /g, ' ');

  // Replacement character left by prior bad round-trips
  s = s.replace(/\uFFFD+/g, '');

  return s;
}

function sanitizeRecord(record: any): void {
  if (!record || typeof record !== 'object') return;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      record[key] = sanitizeStringValue(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          sanitizeRecord(item);
        }
      }
    } else if (value && typeof value === 'object') {
      sanitizeRecord(value);
    }
  }
}

function sanitizeSchema(data: Schema): void {
  const arrays = [
    data.users, data.brand_funnels, data.leads, data.notes, data.calls,
    data.emails, data.whatsapp, data.whatsapp_templates, data.message_templates,
    data.brand_integrations, data.email_connections, data.lead_sources,
    data.lead_source_logs, data.brand_workspace_snapshots, data.social_connections, data.social_pages,
    data.social_ad_accounts, data.social_posts, data.social_ad_metrics,
    data.social_content_templates, data.social_brand_budgets,
    data.website_analytics_sites, data.website_traffic_events,
    data.portfolio_opportunity_rules, data.portfolio_opportunities,
    data.sequences, data.custom_fields, data.enrollments, data.tasks,
    data.team_messages, data.team_notes, data.usage_events, data.audit_log,
  ];
  for (const arr of arrays) {
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && typeof item === 'object') {
          sanitizeRecord(item);
        }
      }
    }
  }
  if (data.whatsapp_numbers && typeof data.whatsapp_numbers === 'object') {
    sanitizeRecord(data.whatsapp_numbers);
  }
}

export class LocalDb {
  private data: Schema;
  private lastSupabaseSyncAt?: string;
  private lastSupabaseError?: string;
  private isSyncingToSupabase = false;

  /** User permanently deleted these field names for a brand — do not re-seed them. */
  private isCustomFieldDeleted(brandId: string, fieldName: string): boolean {
    const deleted = ((this.data as any).deleted_custom_fields || {})[brandId] || [];
    if (!Array.isArray(deleted)) return false;
    const target = String(fieldName || '').toLowerCase().trim();
    return deleted.some((name: string) => String(name || '').toLowerCase().trim() === target);
  }

  constructor() {
    this.data = this.load();
    sanitizeSchema(this.data);
    let userModified = false;
    this.data.users.forEach(u => {
      const email = String(u.email || '').toLowerCase().trim();
      const platformRole = String(u.platform_role || '');
      const isBuiltin = [
        'superadmin@optimaviz.com',
        'admin@optimacrm.com',
        'admin@dirotiq.com',
        'agent@dirotiq.com',
      ].includes(email) || platformRole === 'superadmin' || platformRole === 'owner';
      if (isBuiltin && (!u.password || String(u.password).startsWith('set-'))) {
        u.password = process.env.PLATFORM_OWNER_BOOTSTRAP_PASSWORD
          || process.env.ADMIN_BOOTSTRAP_PASSWORD
          || (email === 'superadmin@optimaviz.com' || platformRole === 'superadmin' ? 'admin1234!' : 'password123');
        userModified = true;
      }
    });
    if (userModified) this.save();
    this.seedTaskGoIfEmpty();
    this.ensureTaskGoSegments();
    this.seedIdaoIfEmpty();
    this.ensureIdaoSegments();
    if (this.ensureIdaoColumnCleanup()) this.save();
    this.ensureOptimavizUpdates();
  }

  private load(): Schema {
    // 1) Prefer primary db.json when it has real operational data
    const primary = tryReadSchemaFile(DB_PATH);
    if (primary && schemaRichness(primary) > 0) {
      return primary;
    }

    // 2) Recover from local backups before falling back to empty demo seed
    //    (missing/corrupt db.json previously wiped live data via seed + cloud push)
    const recovered = recoverSchemaFromBackups();
    if (recovered && schemaRichness(recovered) > schemaRichness(primary)) {
      try {
        this.writeJsonFileSafe(DB_PATH, recovered);
        console.log(`Restored ${DB_PATH} from local backup (leads=${recovered.leads.length}).`);
      } catch (err) {
        console.error('Failed to write recovered db.json:', err);
      }
      return recovered;
    }

    if (primary) return primary;

    console.warn('No db.json or usable backup found. Starting from seed data (in memory only until first real save).');
    return this.getSeededData();
  }

  private getSeededData(): Schema {
    const adminUser: DbUser = {
      id: 'superadmin-1',
      name: 'Optimaviz Superadmin',
      email: 'superadmin@optimaviz.com',
      password: process.env.PLATFORM_OWNER_BOOTSTRAP_PASSWORD || 'admin1234!',
      role: 'admin',
      platform_role: 'superadmin',
      created_at: new Date().toISOString()
    };

    const adminUser2: DbUser = {
      id: 'admin-2',
      name: 'Platform Admin',
      email: 'admin@optimacrm.com',
      password: process.env.ADMIN_BOOTSTRAP_PASSWORD || 'password123',
      role: 'admin',
      platform_role: 'none',
      created_at: new Date().toISOString()
    };

    const agentUser: DbUser = {
      id: 'agent-1',
      name: 'Agent One',
      email: 'agent@dirotiq.com',
      password: process.env.AGENT_BOOTSTRAP_PASSWORD || 'password123',
      role: 'user',
      created_at: new Date().toISOString()
    };

    const initialLeads: DbLead[] = [
      {
        id: 'lead-opt-1',
        brand_id: 'optimaviz',
        brand_name: 'Optimaviz',
        name: 'Johnathan Doe',
        email: 'johndoe@gmail.com',
        phone: '+27 82 123 4567',
        funnel_stage: 'New Lead',
        notes: 'Interested in core visual analytics dashboard.',
        tags: ['High Priority', 'Visuals'],
        custom_fields: {},
        created_at: new Date(Date.now() - 3600000 * 24).toISOString()
      },
      {
        id: 'lead-opt-2',
        brand_id: 'optimaviz',
        brand_name: 'Optimaviz',
        name: 'Sarah Jenkins',
        email: 'sarah.j@techcorp.io',
        phone: '+27 71 987 6543',
        funnel_stage: 'Contacted',
        notes: 'Followed up after website enquiry. Requested pricing.',
        tags: ['Enterprise'],
        custom_fields: {},
        created_at: new Date(Date.now() - 3600000 * 12).toISOString()
      },
      {
        id: 'lead-opt-3',
        brand_id: 'optimaviz',
        brand_name: 'Optimaviz',
        name: 'Michael Peterson',
        email: 'm.peterson@innovate.org',
        phone: '+1 415 555 2671',
        funnel_stage: 'Qualified',
        notes: 'Qualified. Fit for Optimaviz Enterprise suite.',
        tags: ['Hot'],
        custom_fields: {},
        created_at: new Date(Date.now() - 3600000 * 48).toISOString()
      },
      {
        id: 'lead-opt-4',
        brand_id: 'optimaviz',
        brand_name: 'Optimaviz',
        name: 'David Nkosi',
        email: 'd.nkosi@finance.co.za',
        phone: '+27 83 222 1111',
        funnel_stage: 'Won',
        notes: 'Contract signed. Initial payment processed.',
        tags: ['VIP'],
        custom_fields: {},
        created_at: new Date(Date.now() - 3600000 * 72).toISOString()
      },
      // TaskGo Leads
      {
        id: 'lead-tg-1',
        brand_id: 'taskgo',
        brand_name: 'TaskGo',
        name: 'Emma Watson',
        email: 'emma@watsoninc.com',
        phone: '+44 20 7946 0192',
        funnel_stage: 'New Lead',
        notes: 'Looking for a project planning system.',
        tags: ['SaaS'],
        custom_fields: {},
        created_at: new Date().toISOString()
      },
      {
        id: 'lead-clean-1',
        brand_id: 'optimaclean',
        brand_name: 'OptimaClean',
        name: 'Brenda Matthews',
        email: 'brenda@homeservices.com',
        phone: '+27 11 400 3000',
        funnel_stage: 'Proposal Sent',
        notes: 'Requesting office sanitizing quote.',
        tags: ['Corporate'],
        custom_fields: {},
        created_at: new Date(Date.now() - 3600000 * 5).toISOString()
      }
    ];

    const initialHistory: DbNote[] = [
      {
        id: 'note-1',
        lead_id: 'lead-opt-1',
        content: 'Lead created via manual ingestion.',
        created_by: 'Nhlanhla Luju',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString()
      },
      {
        id: 'note-2',
        lead_id: 'lead-opt-2',
        content: 'Talked to Sarah. Outlined core visual intelligence platform modules.',
        created_by: 'Nhlanhla Luju',
        created_at: new Date(Date.now() - 3600000 * 10).toISOString()
      }
    ];

    const initialCalls: DbCall[] = [
      {
        id: 'call-1',
        lead_id: 'lead-opt-2',
        outcome: 'Connected',
        notes: 'Good conversation. Answered scaling and setup questions.',
        duration: 320,
        created_by: 'Nhlanhla Luju',
        created_at: new Date(Date.now() - 3600000 * 11).toISOString()
      }
    ];

    const initialEmails: DbEmail[] = [
      {
        id: 'email-1',
        lead_id: 'lead-opt-2',
        subject: 'Introduction to Optimaviz',
        html_content: 'Hi Sarah,\n\nThanks for reaching out! Here is the slide deck with our pricing tiers.\n\nBest,\nSales Team',
        status: 'sent',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString()
      }
    ];

    const initialSequences: DbSequence[] = [
      {
        id: 'seq-1',
        brand_id: 'optimaviz',
        name: 'Optimaviz Nurture Series',
        description: 'Auto-enrolls leads when they enter the CRM to educate them on our platform.',
        trigger_stage: 'New Lead',
        active: true,
        steps: [
          {
            id: 'step-1',
            name: 'Welcome Email',
            delay_days: 0,
            subject: 'Welcome to Optimaviz Intel!',
            html_content: '<h1>Welcome to Optimaviz</h1><p>We are excited to help you transform your operations with real-time intelligence data visualizers.</p>'
          },
          {
            id: 'step-2',
            name: 'Interactive Demo Invite',
            delay_days: 2,
            subject: 'Schedule Your Optimaviz Demo',
            html_content: '<h1>Book a Demo</h1><p>Hi, quick check-in. Would you be free for a 15-minute quick interactive walkthrough of our products?</p>'
          }
        ],
        created_at: new Date().toISOString()
      }
    ];

    const initialCustomFields: DbCustomField[] = [
      {
        id: 'col-1',
        brand_id: 'optimaviz',
        field_name: 'Company Size',
        field_type: 'text',
        required: false
      },
      {
        id: 'col-2',
        brand_id: 'optimaviz',
        field_name: 'Estimated Budget',
        field_type: 'number',
        required: false
      }
    ];

    const data: Schema = {
      users: [adminUser, adminUser2, agentUser],
      brand_funnels: INITIAL_FUNNELS,
      leads: initialLeads,
      notes: initialHistory,
      calls: initialCalls,
      emails: initialEmails,
      whatsapp: [],
      whatsapp_numbers: {},
      whatsapp_templates: [],
      message_templates: [],
      brand_integrations: [],
      email_connections: [],
      deleted_email_provider_ids: [],
      lead_sources: [],
      lead_source_logs: [],
      social_connections: [],
      social_pages: [],
      social_ad_accounts: [],
      social_posts: [],
      social_ad_metrics: [],
      website_analytics_sites: [],
        website_traffic_events: [],
        portfolio_opportunity_rules: [],
        portfolio_opportunities: [],
        sequences: initialSequences,
      custom_fields: initialCustomFields,
      enrollments: [],
      audit_log: [],
      team_messages: [],
      usage_events: [],
      tasks: [
        {
          id: "task-seed-1",
          brand_id: "optimaviz",
          user_id: "admin-1",
          user_name: "Nhlanhla Luju",
          user_location: "Melbourne, Australia",
          content: "Drafting the Q3 brand alignment proposal for premium accounts.",
          status: "In Progress",
          created_at: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
          id: "task-seed-2",
          brand_id: "optimaviz",
          user_id: "agent-1",
          user_name: "Agent One",
          user_location: "London, UK",
          content: "Refined outbound cold email template for SaaS free trialists segment.",
          status: "Completed",
          created_at: new Date(Date.now() - 3600000 * 5).toISOString()
        },
        {
          id: "task-seed-3",
          brand_id: "taskgo",
          user_id: "agent-1",
          user_name: "Agent One",
          user_location: "Bhutan",
          content: "Approving pending contractor profiles in the Thornlie and Perth regions.",
          status: "In Progress",
          created_at: new Date(Date.now() - 1800000).toISOString()
        }
      ]
    };

    // Do NOT write seed data to disk/cloud here. Writing empty seed was overwriting
    // real backups and could push a blank CRM snapshot to Supabase on startup.
    return data;
  }

  private writeJsonFileSafe(filePath: string, data: Schema) {
    const payload = JSON.stringify(data, null, 2);
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        fs.writeFileSync(tmpPath, payload, 'utf-8');
        fs.renameSync(tmpPath, filePath);
        return;
      } catch (err: any) {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
        const isBusy = ['EBUSY', 'EPERM', 'EACCES'].includes(err?.code);
        if (!isBusy || attempt === maxAttempts) throw err;
        // Windows can briefly lock db.json during antivirus scans, editors, or parallel startup syncs.
        // A short synchronous backoff keeps local fallback saves reliable without changing CRM behavior.
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * attempt);
      }
    }
  }

  private saveData(data: Schema) {
    try {
      // Refuse to replace a richer on-disk CRM with a clearly poorer snapshot.
      const existing = tryReadSchemaFile(DB_PATH);
      const incomingScore = schemaRichness(data);
      const existingScore = schemaRichness(existing);
      if (existing && existingScore > 0 && incomingScore + 500 < existingScore * 0.5 && (existing?.leads?.length || 0) >= 20) {
        const emergencyPath = path.join(BACKUP_DIR, `db-protect-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        try {
          if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
          this.writeJsonFileSafe(emergencyPath, existing);
          console.error(
            `Blocked destructive save: incoming richness ${incomingScore} would replace local richness ${existingScore}. Preserved local copy at ${emergencyPath}.`,
          );
        } catch (preserveErr) {
          console.error('Failed to preserve richer local database before blocked save:', preserveErr);
        }
        // Still allow intentional small datasets only when explicitly tiny already.
        if ((data.leads?.length || 0) < 5 && (existing.leads?.length || 0) >= 20) {
          return;
        }
      }

      // Standalone mode keeps the bundled local database authoritative.
      this.writeJsonFileSafe(DB_PATH, data);
      this.writeTimestampedBackup(data);
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  private supabaseConfigured(): boolean {
    return Boolean(SUPABASE_URL && SUPABASE_KEY);
  }

  private supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  private getSupabaseEndpoint(query = ''): string {
    return `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}${query}`;
  }

  private writeTimestampedBackup(data: Schema) {
    try {
      if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const latestPath = path.join(BACKUP_DIR, 'db-latest.json');
      const existingLatest = tryReadSchemaFile(latestPath);
      // Never let a poorer snapshot clobber the best local backup pointer.
      if (!existingLatest || schemaRichness(data) >= schemaRichness(existingLatest)) {
        this.writeJsonFileSafe(latestPath, data);
      } else {
        const keepPath = path.join(BACKUP_DIR, `db-richer-kept-${new Date().toISOString().slice(0, 10)}.json`);
        if (!fs.existsSync(keepPath)) this.writeJsonFileSafe(keepPath, existingLatest);
        console.log(
          `Kept richer local backup (incoming=${schemaRichness(data)}, existing=${schemaRichness(existingLatest)}).`,
        );
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const dailyPath = path.join(BACKUP_DIR, `db-${stamp}.json`);
      const existingDaily = tryReadSchemaFile(dailyPath);

      if (!existingDaily || schemaRichness(data) >= schemaRichness(existingDaily)) {
        this.writeJsonFileSafe(dailyPath, data);
      }
    } catch (err) {
      console.error('Error writing local backup:', err);
    }
  }

  /** Refuse to upload near-empty/seed snapshots that would wipe production CRM data. */
  private isSparseCrmSnapshot(data: Schema): boolean {
    const leads = data.leads?.length || 0;
    const score = schemaRichness(data);
    return leads < 15 && score < 20_000;
  }

  private async pushToSupabase(data: Schema, options?: { force?: boolean }) {
    if (!this.supabaseConfigured() || this.isSyncingToSupabase) return;
    if (!options?.force && this.isSparseCrmSnapshot(data)) {
      console.warn(
        `[CRM DB] Refusing Supabase push of sparse snapshot (leads=${data.leads?.length || 0}, score=${schemaRichness(data)}). Protects cloud data from seed overwrites.`,
      );
      return;
    }
    sanitizeSchema(data);
    this.isSyncingToSupabase = true;
    try {
      if (!options?.force) {
        try {
          const probe = await fetch(this.getSupabaseEndpoint(`?id=eq.${encodeURIComponent(SUPABASE_RECORD_ID)}&select=data,updated_at`), {
            headers: this.supabaseHeaders(),
          });
          if (probe.ok) {
            const rows = await probe.json() as Array<{ data?: Partial<Schema> }>;
            if (rows[0]?.data) {
              const remoteScore = schemaRichness(safeSchema(rows[0].data));
              const localScore = schemaRichness(data);
              if (remoteScore > localScore * 1.15 && (rows[0].data.leads?.length || 0) >= 20) {
                console.warn(`[CRM DB] Refusing Supabase push: remote richer (remote=${remoteScore}, local=${localScore}).`);
                return;
              }
            }
          }
        } catch { /* proceed */ }
      }

      const response = await fetch(this.getSupabaseEndpoint(), {
        method: 'POST',
        headers: this.supabaseHeaders({ Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify({ id: SUPABASE_RECORD_ID, data, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase upsert failed (${response.status}): ${text}`);
      }
      this.lastSupabaseSyncAt = new Date().toISOString();
      this.lastSupabaseError = undefined;
    } finally {
      this.isSyncingToSupabase = false;
    }
  }

  public async initSupabasePrimary() {
    if (!this.supabaseConfigured()) {
      console.log('Supabase is not configured. Using local db.json only.');
      return;
    }
    try {
      const response = await fetch(this.getSupabaseEndpoint(`?id=eq.${encodeURIComponent(SUPABASE_RECORD_ID)}&select=data,updated_at`), {
        headers: this.supabaseHeaders(),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase read failed (${response.status}): ${text}`);
      }
      const rows = await response.json() as Array<{ data?: Partial<Schema>; updated_at?: string }>;
      const recovered = recoverSchemaFromBackups();
      const localCandidates = [this.data, tryReadSchemaFile(DB_PATH), recovered].filter(Boolean) as Schema[];
      let bestLocal = this.data;
      let localScore = schemaRichness(bestLocal);
      for (const c of localCandidates) {
        const s = schemaRichness(c);
        if (s > localScore) {
          bestLocal = c;
          localScore = s;
        }
      }
      if (bestLocal !== this.data && localScore > schemaRichness(this.data)) {
        this.data = bestLocal;
        console.log(`[CRM DB] Elevated local snapshot from backup/disk (score=${localScore}).`);
      }

      if (rows.length > 0 && rows[0].data) {
        const remote = safeSchema(rows[0].data);
        sanitizeSchema(remote);
        const remoteScore = schemaRichness(remote);
        const remoteLeads = remote.leads?.length || 0;
        const localLeads = this.data.leads?.length || 0;
        const remoteIsPoorer = remoteScore + 500 < localScore * 0.75 || (localLeads >= 40 && remoteLeads < localLeads * 0.5);
        if (!remoteIsPoorer && remoteScore >= localScore) {
          this.data = remote;
          sanitizeSchema(this.data);
          this.ensureIdaoColumnCleanup();
          this.lastSupabaseSyncAt = rows[0].updated_at || new Date().toISOString();
          this.writeJsonFileSafe(DB_PATH, this.data);
          this.writeTimestampedBackup(this.data);
          console.log(`Loaded CRM database from Supabase (remote=${remoteScore}, local=${localScore}, leads=${remoteLeads}).`);
        } else {
          this.lastSupabaseSyncAt = rows[0].updated_at || new Date().toISOString();
          console.warn(
            `Kept local CRM (score ${localScore}, leads=${localLeads}) instead of poorer Supabase snapshot (score ${remoteScore}, leads=${remoteLeads}). Pushing local recovery to cloud.`,
          );
          await this.pushToSupabase(this.data, { force: !this.isSparseCrmSnapshot(this.data) });
        }
      } else {
        if (localScore <= 0 || this.isSparseCrmSnapshot(this.data)) {
          if (recovered && schemaRichness(recovered) > localScore) {
            this.data = recovered;
            this.writeJsonFileSafe(DB_PATH, recovered);
            console.log('Hydrated empty local CRM from backup before first Supabase upload.');
          }
        }
        if (!this.isSparseCrmSnapshot(this.data)) {
          await this.pushToSupabase(this.data, { force: true });
          console.log('No Supabase CRM record found. Uploaded current db.json as the first cloud snapshot.');
        } else {
          console.warn('[CRM DB] No cloud record and local data looks like seed — not uploading.');
        }
      }
    } catch (err) {
      this.lastSupabaseError = err instanceof Error ? err.message : String(err);
      console.error('Could not initialize Supabase primary database. Falling back to db.json:', this.lastSupabaseError);
    }
  }

  public async forcePushToSupabase() {
    await this.pushToSupabase(this.data, { force: true });
  }

  public getSupabaseStatus(): SupabaseStatus {
    return {
      configured: this.supabaseConfigured(),
      url: SUPABASE_URL || undefined,
      last_sync_at: this.lastSupabaseSyncAt,
      last_error: this.lastSupabaseError,
      using_fallback: !this.supabaseConfigured() || Boolean(this.lastSupabaseError),
    };
  }

  public get(): Schema {
    return this.data;
  }

  public save() {
    this.saveData(this.data);
  }

  public wipeOpsDataButPreserveBrandProfiles() {
    this.data = wipeOpsDataButPreserveBrandProfiles(this.data);
    this.save();
  }

  private seedTaskGoIfEmpty() {
    const taskGoLeads = this.data.leads.filter(l => l.brand_id === 'taskgo');
    // Only seed demo contractors on a nearly empty CRM — never when real data exists
    // or was just recovered (previously this re-seeded after data loss and looked like "corruption").
    if (taskGoLeads.length < 5 && this.data.leads.length < 10) {
      console.log('Seeding TaskGo contractor leads from custom CSV source...');
      const contractors = [
        { Name: "Kinga Wangmo", email: "kingawangmo207@gmail.com", phone: "452063930", city: "Thornlie", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "John De Silva", email: "silverfoxjohn63@gmail.com", phone: "435929686", city: "Perth", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Saurabh Shankhi", email: "saurabh.shankhi@gmail.com", phone: "416064898", city: "Cloverdale", abn_number: "73326705100", service_category_name: "Commercial Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Saurabh Shankhi", email: "saurabh.shankhi@gmail.com", phone: "416064898", city: "Cloverdale", abn_number: "73326705100", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Saurabh Shankhi", email: "saurabh.shankhi@gmail.com", phone: "416064898", city: "Cloverdale", abn_number: "73326705100", service_category_name: "Aged Care Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Saurabh Shankhi", email: "saurabh.shankhi@gmail.com", phone: "416064898", city: "Cloverdale", abn_number: "73326705100", service_category_name: "Personal Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Saurabh Shankhi", email: "saurabh.shankhi@gmail.com", phone: "416064898", city: "Cloverdale", abn_number: "73326705100", service_category_name: "Disability Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Vihanga  Miusara", email: "Miusarasamarasinghe@gmail.com", phone: "452478833", city: "Noble Park", abn_number: "", service_category_name: "", state: "Victoria", provider_status: "PENDING" },
        { Name: "Teresa Liistro", email: "liistroteresa@gmail.com", phone: "406792721", city: "Kinglake", abn_number: "", service_category_name: "", state: "Victoria", provider_status: "PENDING" },
        { Name: "Shiffali .", email: "gshiffu@gmail.com", phone: "402967700", city: "Perth", abn_number: "86875437331", service_category_name: "Aged Care Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Shiffali .", email: "gshiffu@gmail.com", phone: "402967700", city: "Perth", abn_number: "86875437331", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Shiffali .", email: "gshiffu@gmail.com", phone: "402967700", city: "Perth", abn_number: "86875437331", service_category_name: "Disability Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Shiffali .", email: "gshiffu@gmail.com", phone: "402967700", city: "Perth", abn_number: "86875437331", service_category_name: "Personal Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Shiffali .", email: "gshiffu@gmail.com", phone: "402967700", city: "Perth", abn_number: "86875437331", service_category_name: "Commercial Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Md Tashir  Imtiaz", email: "tashir.career@gmail.com", phone: "450339395", city: "Perth", abn_number: "27889911610", service_category_name: "Commercial Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Md Tashir  Imtiaz", email: "tashir.career@gmail.com", phone: "450339395", city: "Perth", abn_number: "27889911610", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Srushty Chiragkumar  Pipalia", email: "srushty14@gmail.com", phone: "404014861", city: "Aveley", abn_number: "57478537837", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Md Minhajul Abedin  Aunta", email: "minhajulabedinaunta143@gmail.com", phone: "421433493", city: "Hamersley", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Asha Chhetri", email: "ashachunu98@gmail.com", phone: "401712553", city: "Cloverdale", abn_number: "22963758039", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Asha Chhetri", email: "ashachunu98@gmail.com", phone: "401712553", city: "Cloverdale", abn_number: "22963758039", service_category_name: "Commercial Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Md Mizanur  Rahman", email: "rmanmizanur@gmail.com", phone: "404284665", city: "Wellard", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Nick  Mitrou", email: "redbullracing1990@iprimus.com.au", phone: "414007348", city: "Wollert", abn_number: "", service_category_name: "", state: "Victoria", provider_status: "PENDING" },
        { Name: "Tacian Kasong", email: "taciankashal@gmail.com", phone: "420965664", city: "Collingwood Park", abn_number: "", service_category_name: "", state: "Queensland", provider_status: "PENDING" },
        { Name: "Samin Yeasar  Shams", email: "saminshams999@gmail.com", phone: "451200025", city: "Hurstville", abn_number: "65917972124", service_category_name: "House Cleaning", state: "New South Wales", provider_status: "PENDING" },
        { Name: "Kenyi Cano", email: "tino.caba10@gmail.com", phone: "415750824", city: "East Cannington", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Nawrin Zaman", email: "nawrinzaman8@gmail.com", phone: "450860176", city: "Nollamara", abn_number: "92147058567", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Nawrin Zaman", email: "nawrinzaman8@gmail.com", phone: "450860176", city: "Nollamara", abn_number: "92147058567", service_category_name: "Commercial Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Ann Traill", email: "traillan88@gmail.com", phone: "481277503", city: "Morley", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Sola Silas", email: "STEVABBY247@yahoo.com", phone: "432243992", city: "Bunbury", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Dhanushree Karekura", email: "dhanushree27ks@gmail.com", phone: "435404061", city: "Melbourne", abn_number: "15601313582", service_category_name: "Commercial Cleaning", state: "Victoria", provider_status: "PENDING" },
        { Name: "Dhanushree Karekura", email: "dhanushree27ks@gmail.com", phone: "435404061", city: "Melbourne", abn_number: "15601313582", service_category_name: "House Cleaning", state: "Victoria", provider_status: "PENDING" },
        { Name: "Anees Zafar Iqbal Abbasi", email: "aneesabbasi2797@gmail.com", phone: "402646933", city: "Albany", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Tham Ncube", email: "tham@yahoo.com", phone: "6666666", city: "Bunbury", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Nitesh Kumar Shah", email: "nksshah131@gmail.com", phone: "414418521", city: "Fairfield West", abn_number: "42914739143", service_category_name: "House Cleaning", state: "New South Wales", provider_status: "PENDING" },
        { Name: "Sinegugu Xolo", email: "xolosinegugu@gmail.com", phone: "410673995", city: "Byford", abn_number: "12884480233", service_category_name: "Aged Care Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Sinegugu Xolo", email: "xolosinegugu@gmail.com", phone: "410673995", city: "Byford", abn_number: "12884480233", service_category_name: "Personal Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Sinegugu Xolo", email: "xolosinegugu@gmail.com", phone: "410673995", city: "Byford", abn_number: "12884480233", service_category_name: "Disability Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Pema Gyembo", email: "pgyembo98@gmail.com", phone: "481500023", city: "Bunbury", abn_number: "17385977958", service_category_name: "Commercial Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Pema Gyembo", email: "pgyembo98@gmail.com", phone: "481500023", city: "Bunbury", abn_number: "17385977958", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Kelzang Choden", email: "chodentkelzang@gmail.com", phone: "409166068", city: "Langford", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Yuleidis Meza Simancas ", email: "yulemezas@gmail.com", phone: "423763394", city: "Australind", abn_number: "13468302485", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Apnila Saragih", email: "apnilasaragih@gmail.com", phone: "451376356", city: "Glen Iris", abn_number: "79230881159", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Apnila Saragih", email: "apnilasaragih@gmail.com", phone: "451376356", city: "Glen Iris", abn_number: "79230881159", service_category_name: "Commercial Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Dorisda Murni", email: "shintamurni@yahoo.com", phone: "480651002", city: "Queens Park", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Winnie Jepchumba", email: "jepchumbaw981@gmail.com", phone: "415752369", city: "Perth", abn_number: "39534309205", service_category_name: "Aged Care Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Winnie Jepchumba", email: "jepchumbaw981@gmail.com", phone: "415752369", city: "Perth", abn_number: "39534309205", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Fanchang Yan", email: "AaronYan-@outlook.com", phone: "480415782", city: "Bunbury", abn_number: "76546708770", service_category_name: "Commercial Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Fanchang Yan", email: "AaronYan-@outlook.com", phone: "480415782", city: "Bunbury", abn_number: "76546708770", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Chimi Dorji ", email: "chimmebumthap@gmail.com", phone: "414210170", city: "Bunbury", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Robyn Hooper", email: "rmerritt396@gmail.com", phone: "421445777", city: "Warnbro", abn_number: "46101153873", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Michael Ogugua", email: "ebolimite@gmail.com", phone: "401674171", city: "Tarneit", abn_number: "40967482306", service_category_name: "Aged Care Support", state: "Victoria", provider_status: "PENDING" },
        { Name: "Michael Ogugua", email: "ebolimite@gmail.com", phone: "401674171", city: "Tarneit", abn_number: "40967482306", service_category_name: "Personal Support", state: "Victoria", provider_status: "PENDING" },
        { Name: "Michael Ogugua", email: "ebolimite@gmail.com", phone: "401674171", city: "Tarneit", abn_number: "40967482306", service_category_name: "Disability Support", state: "Victoria", provider_status: "PENDING" },
        { Name: "Ryan Dev", email: "spielereinzig@gmail.com", phone: "2.99219E+11", city: "Perth", abn_number: "12891289893", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Manuel Agbaje", email: "agbajemanuel47@gmail.com", phone: "8108052665", city: "Bidwill", abn_number: "", service_category_name: "", state: "New South Wales", provider_status: "PENDING" },
        { Name: "Thamsanqa Ncube", email: "thamooncube@yahoo.com", phone: "415732438", city: "Ashfield", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Mthokozisi Nhlanhla Ndlovu", email: "bhujuluju89@gmail.com", phone: "1121075991", city: "Broadwater", abn_number: "87887879090", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Praise White", email: "praise.o.olawoore@gmail.com", phone: "9030256432", city: "Bridgewater", abn_number: "", service_category_name: "", state: "Tasmania", provider_status: "PENDING" },
        { Name: "Kristine  Bello", email: "kristine.bello@gmail.com", phone: "421096317", city: "Mortdale", abn_number: "96825306588", service_category_name: "Aged Care Support", state: "New South Wales", provider_status: "PENDING" },
        { Name: "Kristine  Bello", email: "kristine.bello@gmail.com", phone: "421096317", city: "Mortdale", abn_number: "96825306588", service_category_name: "Personal Support", state: "New South Wales", provider_status: "PENDING" },
        { Name: "Kristine  Bello", email: "kristine.bello@gmail.com", phone: "421096317", city: "Mortdale", abn_number: "96825306588", service_category_name: "Disability Support", state: "New South Wales", provider_status: "PENDING" },
        { Name: "Kristine  Bello", email: "kristine.bello@gmail.com", phone: "421096317", city: "Mortdale", abn_number: "96825306588", service_category_name: "House Cleaning", state: "New South Wales", provider_status: "PENDING" },
        { Name: "Munish Mehla", email: "munishmehla06@gmail.com", phone: "6.10452E+11", city: "Ringwood", abn_number: "", service_category_name: "Commercial Cleaning", state: "Victoria", provider_status: "PENDING" },
        { Name: "Sahil Alad", email: "Sahilalad8088@gmail.com", phone: "61424800839", city: "Perth", abn_number: "", service_category_name: "Commercial Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Kevin Kipkemboi", email: "Kevinbarmao@gmail.com", phone: "61452601574", city: "Melbourne", abn_number: "", service_category_name: "Aged Care Support", state: "Victoria", provider_status: "PENDING" },
        { Name: "Kevin Kipkemboi", email: "Kevinbarmao@gmail.com", phone: "61452601574", city: "Melbourne", abn_number: "", service_category_name: "Disability Support", state: "Victoria", provider_status: "PENDING" },
        { Name: "Manuel  Menjivar ", email: "dynamicsolutions1224@gmail.com", phone: "402514197", city: "Brabham", abn_number: "87804914221", service_category_name: "Commercial Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Kudzai Muchemwa", email: "kudzaimuchemwa6@gmail.com", phone: "466187173", city: "Alexander Heights", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Evans Ngeno", email: "masonbennett351@gmail.com", phone: "715133567", city: "Albert Park", abn_number: "", service_category_name: "", state: "Victoria", provider_status: "PENDING" },
        { Name: "Tariqul Islam", email: "tariqulislam.jt@gmail.com", phone: "61480386023", city: "Kelmscott", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Alija Sthapit", email: "alijasthapit@gmail.com", phone: "414795549", city: "Hornsby", abn_number: "", service_category_name: "", state: "New South Wales", provider_status: "PENDING" },
        { Name: "Praise White", email: "olawoorejohn@gmail.com", phone: "9030256432", city: "Atwell", abn_number: "73676698070", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "APPROVED" },
        { Name: "Nhlanhla Ndlovu", email: "nanazawami89@gmail.com", phone: "1123841138", city: "Armadale", abn_number: "54646494664", service_category_name: "Disability Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Nhlanhla Ndlovu", email: "nanazawami89@gmail.com", phone: "1123841138", city: "Armadale", abn_number: "54646494664", service_category_name: "Personal Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Nhlanhla Ndlovu", email: "nanazawami89@gmail.com", phone: "1123841138", city: "Armadale", abn_number: "54646494664", service_category_name: "Aged Care Support", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Nhlanhla Ndlovu", email: "nanazawami89@gmail.com", phone: "1123841138", city: "Armadale", abn_number: "54646494664", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Dayo Praisegod", email: "dayopraisegod@gmail.com", phone: "9033345017", city: "Altona", abn_number: "", service_category_name: "", state: "Victoria", provider_status: "PENDING" },
        { Name: "Thalis Thor", email: "thalizz2299@gmail.com", phone: "434793404", city: "Kensington Gardens", abn_number: "14377312155", service_category_name: "Personal Support", state: "South Australia", provider_status: "PENDING" },
        { Name: "Thalis Thor", email: "thalizz2299@gmail.com", phone: "434793404", city: "Kensington Gardens", abn_number: "14377312155", service_category_name: "House Cleaning", state: "South Australia", provider_status: "PENDING" },
        { Name: "Rica Magondo", email: "ricamagondo@outlook.com", phone: "436108722", city: "Bunbury", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Melissa Mufaranechisi ", email: "melz310106@gmail.com", phone: "494585075", city: "Wellard", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Wakanakaishe  Hove", email: "mengezimildred@gmail.com", phone: "452417576", city: "Mandurah", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Samrin Banu  Shaik", email: "samrinbanushaik@gmail.com", phone: "404134089", city: "Melbourne", abn_number: "", service_category_name: "", state: "Victoria", provider_status: "PENDING" },
        { Name: "Ali  Haidari ", email: "aagha6530@gmail.com", phone: "414132299", city: "Beechboro", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Sweta Patel", email: "swetapatel96@gmail.com", phone: "61434363704", city: "Officer", abn_number: "", service_category_name: "", state: "Victoria", provider_status: "PENDING" },
        { Name: "Leakena Barn", email: "tida.barn@yahoo.com", phone: "429005088", city: "Yangebup", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Binal Man Patel", email: "binalpa1997@gmail.com", phone: "4222239630", city: "Adelaide", abn_number: "82997863596", service_category_name: "Aged Care Support", state: "South Australia", provider_status: "PENDING" },
        { Name: "Binal Man Patel", email: "binalpa1997@gmail.com", phone: "4222239630", city: "Adelaide", abn_number: "82997863596", service_category_name: "House Cleaning", state: "South Australia", provider_status: "PENDING" },
        { Name: "Binal Man Patel", email: "binalpa1997@gmail.com", phone: "4222239630", city: "Adelaide", abn_number: "82997863596", service_category_name: "Commercial Cleaning", state: "South Australia", provider_status: "PENDING" },
        { Name: "Vivian Mwangi", email: "vivianwaitheram@gmail.com", phone: "422687021", city: "Westminster", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Sukhmeet Kaur", email: "sukhmeetkaur48@gmail.com", phone: "451478400", city: "Melton West", abn_number: "12467645457", service_category_name: "Aged Care Support", state: "Victoria", provider_status: "PENDING" },
        { Name: "Sukhmeet Kaur", email: "sukhmeetkaur48@gmail.com", phone: "451478400", city: "Melton West", abn_number: "12467645457", service_category_name: "Personal Support", state: "Victoria", provider_status: "PENDING" },
        { Name: "Sukhmeet Kaur", email: "sukhmeetkaur48@gmail.com", phone: "451478400", city: "Melton West", abn_number: "12467645457", service_category_name: "Disability Support", state: "Victoria", provider_status: "PENDING" },
        { Name: "Rajeev  Khagram", email: "radhika@furniturebazaar.com.au", phone: "448873078", city: "Stirling", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Shalika  Udari ", email: "shalikaudari4@gmail.com", phone: "438635953", city: "Bunbury", abn_number: "", service_category_name: "", state: "Western Australia", provider_status: "PENDING" },
        { Name: "Optimaviz Taskgo", email: "engineering@optimaviz.com", phone: "6378763552", city: "Perth", abn_number: "73676698070", service_category_name: "Aged Care Support", state: "Western Australia", provider_status: "APPROVED" },
        { Name: "Optimaviz Taskgo", email: "engineering@optimaviz.com", phone: "6378763552", city: "Perth", abn_number: "73676698070", service_category_name: "House Cleaning", state: "Western Australia", provider_status: "APPROVED" }
      ];

      // Ensure custom fields are defined
      const requiredFields = [
        { id: "col-tg-city", brand_id: "taskgo", field_name: "city", field_type: "text" as const, required: false },
        { id: "col-tg-service", brand_id: "taskgo", field_name: "service_category_name", field_type: "text" as const, required: false },
        { id: "col-tg-abn", brand_id: "taskgo", field_name: "abn_number", field_type: "text" as const, required: false },
        { id: "col-tg-status", brand_id: "taskgo", field_name: "provider_status", field_type: "text" as const, required: false }
      ];

      requiredFields.forEach(rf => {
        if (this.isCustomFieldDeleted('taskgo', rf.field_name)) return;
        if (!this.data.custom_fields.some(f => f.brand_id === 'taskgo' && f.field_name === rf.field_name)) {
          this.data.custom_fields.push(rf);
        }
      });

      // Clear standard seed leads for taskgo brand first to load fresh accurate contractors list
      this.data.leads = this.data.leads.filter(l => l.brand_id !== 'taskgo');

      contractors.forEach((c, idx) => {
        this.data.leads.push({
          id: `lead-tg-seed-${idx}`,
          brand_id: 'taskgo',
          brand_name: 'TaskGo',
          name: c.Name,
          email: c.email,
          phone: c.phone,
          funnel_stage: c.provider_status === 'APPROVED' ? 'Won' : 'New Lead',
          notes: `Auto-ingested via TaskGo platform contractors importer. Contractor offers: ${c.service_category_name || 'General Platform Services'}. Located in: ${c.city}, ${c.state}. Status: ${c.provider_status}.`,
          tags: c.service_category_name ? [c.service_category_name] : ['Platform Provider'],
          custom_fields: {
            city: c.city,
            service_category_name: c.service_category_name || 'General Platform',
            abn_number: c.abn_number || 'No ABN supplied',
            provider_status: c.provider_status || 'PENDING',
            segment: 'all_platform'
          },
          created_at: new Date().toISOString()
        });
      });

      this.save();
    }
  }

  private ensureTaskGoSegments() {
    let modified = false;
    this.data.leads.forEach(l => {
      if (l.brand_id === 'taskgo') {
        if (!l.custom_fields) {
          l.custom_fields = {};
          modified = true;
        }
        if (!l.custom_fields.segment) {
          l.custom_fields.segment = 'all_platform';
          modified = true;
        }
      }
    });
    if (modified) {
      console.log('Migrated existing/new TaskGo platform leads to Registered Platform Users segment.');
      this.save();
    }
  }

  private seedIdaoIfEmpty() {
    const idaoLeads = this.data.leads.filter(l => l.brand_id === 'idao');
    const hasRealData = idaoLeads.some(l => l.custom_fields?.country);
    if (hasRealData) return;

    console.log('Seeding IDAO 3-Day Training leads from registration CSV...');

    const requiredFields = [
      { id: 'col-id-country', brand_id: 'idao', field_name: 'country', field_type: 'text' as const, required: false },
      { id: 'col-id-company', brand_id: 'idao', field_name: 'company', field_type: 'text' as const, required: false },
      { id: 'col-id-job-title', brand_id: 'idao', field_name: 'job_title', field_type: 'text' as const, required: false },
      { id: 'col-id-service-focus', brand_id: 'idao', field_name: 'service_focus', field_type: 'text' as const, required: false },
      { id: 'col-id-quote-status', brand_id: 'idao', field_name: 'quote_status', field_type: 'text' as const, required: false },
      { id: 'col-id-quote-date', brand_id: 'idao', field_name: 'quote_sent_date', field_type: 'date' as const, required: false },
      { id: 'col-id-follow-type', brand_id: 'idao', field_name: 'follow_up_type', field_type: 'text' as const, required: false },
      { id: 'col-id-follow-status', brand_id: 'idao', field_name: 'follow_up_status', field_type: 'text' as const, required: false },
      { id: 'col-id-outreach-segment', brand_id: 'idao', field_name: 'outreach_segment', field_type: 'text' as const, required: false },
      { id: 'col-id-outreach-status', brand_id: 'idao', field_name: 'outreach_status', field_type: 'text' as const, required: false },
      { id: 'col-id-mine-type', brand_id: 'idao', field_name: 'mine_type', field_type: 'text' as const, required: false },
    ];

    requiredFields.forEach(rf => {
      if (this.isCustomFieldDeleted('idao', rf.field_name)) return;
      if (!this.data.custom_fields.some(f => f.brand_id === 'idao' && f.field_name === rf.field_name)) {
        this.data.custom_fields.push(rf);
      }
    });

    // Remove any previous placeholder idao leads before seeding real data
    this.data.leads = this.data.leads.filter(l => l.brand_id !== 'idao');

    const trainees = [
      { name: 'Jacqueline Monama', email: 'jacqueline.monama@gmail.com', phone: '', country: 'South Africa', company: 'Freeport-McMoRan', job_title: 'Manager Technical Services - Concentrating', quote_sent: true, created: '2026-05-18' },
      { name: 'Kedarnath K', email: 'kedarnathk260@gmail.com', phone: '', country: 'India', company: '', job_title: '', quote_sent: true, created: '2026-05-20' },
      { name: 'Melba Jackson', email: 'chozaj78@gmail.com', phone: '', country: 'Botswana', company: 'Debswana Diamond Company', job_title: 'Data Scientist', quote_sent: true, created: '2026-05-18' },
      { name: 'Enoch Sio', email: 'enochsio100@gmail.com', phone: '', country: 'Papua New Guinea', company: 'Harmony Gold Mining Company Limited', job_title: 'Plant Metallurgist', quote_sent: true, created: '2026-05-19' },
      { name: 'Mokodupe Lilian Sepheu', email: 'mokodupes@gmail.com', phone: '', country: 'South Africa', company: 'Sibanye-Stillwater', job_title: 'Superintendent Metallurgy', quote_sent: true, created: '2026-05-18' },
      { name: 'Paul Seya', email: 'paulseya5@gmail.com', phone: '', country: 'Democratic Republic of the Congo', company: 'Kamoa Copper S.A.', job_title: 'Metallurgist', quote_sent: true, created: '2026-05-18' },
      { name: 'Katlego Morake', email: 'mkatlego788@gmail.com', phone: '', country: 'South Africa', company: 'Student', job_title: 'N/A', quote_sent: true, created: '2026-05-25' },
      { name: 'Judh Mauro Botelho', email: 'judhmauro@hotmail.com', phone: '', country: 'Angola', company: 'CIF Cement Plant', job_title: 'Mining Manager', quote_sent: true, created: '2026-05-20' },
      { name: 'Anthony Pucjlowski', email: 'pucj001@yahoo.com', phone: '', country: 'South Africa', company: 'Extractive Consulting Services', job_title: 'Consulting Metallurgist', quote_sent: true, created: '2026-05-18' },
      { name: 'Kgosiemang Pitso', email: 'kgosiemang.pitso@gmail.com', phone: '', country: 'Botswana', company: 'Premium Nickel Resources Botswana', job_title: 'Technician', quote_sent: true, created: '2026-06-03' },
      { name: 'Humeid Bicá', email: 'humeidbicaa@gmail.com', phone: '', country: 'Mozambique', company: 'Agrodolfo Farm Lda', job_title: 'Agricultural Engineer', quote_sent: true, created: '2026-06-01' },
    ];

    trainees.forEach((t, idx) => {
      this.data.leads.push({
        id: `lead-idao-seed-${idx}`,
        brand_id: 'idao',
        brand_name: 'IDAO',
        name: t.name,
        email: t.email,
        phone: t.phone,
        funnel_stage: 'Quote Sent',
        notes: `Registered for 3-Day AI & Data Analytics in Mining & Mineral Processing Training Pretoria. Company: ${t.company || 'N/A'}. Job: ${t.job_title || 'N/A'}. Country: ${t.country}.`,
        tags: ['3-Day Training', t.country],
        custom_fields: {
          segment: 'training_leads',
          service_focus: '3 Day Annual Training',
          service_type: '3 Day Annual Training',
          country: t.country,
          company: t.company,
          job_title: t.job_title,
          quote_status: 'Quote Sent',
          quote_sent_date: t.created,
          follow_up_type: 'Email then Call',
          follow_up_status: 'Follow-Up Due',
          outreach_segment: '3 Day Training Outreach',
          outreach_status: 'Quote Sent',
        },
        created_at: new Date(t.created).toISOString(),
      });
    });

    this.save();
    console.log(`Seeded ${trainees.length} IDAO training leads.`);
  }

  private ensureIdaoSegments() {
    let modified = false;
    this.data.leads.forEach(l => {
      if (l.brand_id === 'idao') {
        if (!l.custom_fields) {
          l.custom_fields = {};
          modified = true;
        }
        if (!l.custom_fields.segment) {
          l.custom_fields.segment = 'training_leads';
          modified = true;
        }
        if (l.custom_fields.segment === 'optimaviz_leads') {
          l.custom_fields.segment = 'optimaviz_referrals';
          modified = true;
        }
        if (l.custom_fields.segment === 'other_services' && !l.custom_fields.service_focus) {
          l.custom_fields.service_focus = 'Flotation Optimisation';
          modified = true;
        }
        if (l.custom_fields.quote_sent && !l.custom_fields.quote_status) {
          l.custom_fields.quote_status = ['true', 'TRUE', true].includes(l.custom_fields.quote_sent) ? 'Quote Sent' : 'Quote Requested';
          modified = true;
        }
        if (!l.custom_fields.follow_up_type) {
          l.custom_fields.follow_up_type = 'Email then Call';
          modified = true;
        }
        if (!l.custom_fields.follow_up_status && l.custom_fields.quote_status === 'Quote Sent') {
          l.custom_fields.follow_up_status = 'Follow-Up Due';
          modified = true;
        }
        if (!l.custom_fields.outreach_segment) {
          l.custom_fields.outreach_segment = l.custom_fields.segment === 'optimaviz_referrals' ? 'Optimaviz Referral Outreach' : l.custom_fields.segment === 'other_services' ? 'Flotation Optimisation Outreach' : '3 Day Training Outreach';
          modified = true;
        }
        if (l.custom_fields.outreach_brand && !l.custom_fields.outreach_segment) {
          l.custom_fields.outreach_segment = l.custom_fields.outreach_brand;
          delete l.custom_fields.outreach_brand;
          modified = true;
        }
      }
    });
    if (modified) {
      console.log('Migrated existing IDAO leads to training_leads segment.');
      this.save();
    }
  }

  private ensureIdaoColumnCleanup(): boolean {
    let modified = false;
    const cleanFields = [
      { id: 'col-id-segment', brand_id: 'idao', field_name: 'segment', field_type: 'text' as const, required: false },
      { id: 'col-id-service-focus', brand_id: 'idao', field_name: 'service_focus', field_type: 'text' as const, required: false },
      { id: 'col-id-country', brand_id: 'idao', field_name: 'country', field_type: 'text' as const, required: false },
      { id: 'col-id-company', brand_id: 'idao', field_name: 'company', field_type: 'text' as const, required: false },
      { id: 'col-id-job-title', brand_id: 'idao', field_name: 'job_title', field_type: 'text' as const, required: false },
      { id: 'col-id-quote-status', brand_id: 'idao', field_name: 'quote_status', field_type: 'text' as const, required: false },
      { id: 'col-id-quote-date', brand_id: 'idao', field_name: 'quote_sent_date', field_type: 'date' as const, required: false },
      { id: 'col-id-follow-type', brand_id: 'idao', field_name: 'follow_up_type', field_type: 'text' as const, required: false },
      { id: 'col-id-follow-status', brand_id: 'idao', field_name: 'follow_up_status', field_type: 'text' as const, required: false },
      { id: 'col-id-outreach-segment', brand_id: 'idao', field_name: 'outreach_segment', field_type: 'text' as const, required: false },
      { id: 'col-id-outreach-status', brand_id: 'idao', field_name: 'outreach_status', field_type: 'text' as const, required: false },
      { id: 'col-id-mine-type', brand_id: 'idao', field_name: 'mine_type', field_type: 'text' as const, required: false },
    ];
    const duplicateFields = new Set([
      'Country/Region',
      'Company name',
      'Job title',
      'Quote Sent Via Email',
      'created_date',
      'form_name',
      'name_secondary',
      'service_type',
      'quote_sent',
      'quote_requested',
      'registration_confirmed',
      'follow_up_method',
      'follow_up_reason',
      'payment_status',
      'payment_received',
      'outreach_brand',
    ].map(s => s.toLowerCase()));
    const noisyKeys = [
      'Country/Region',
      'Company name',
      'Job title',
      'Quote Sent Via Email',
      'created_date',
      'form_name',
      'name_secondary',
      'service_type',
      'quote_sent',
      'quote_requested',
      'registration_confirmed',
      'follow_up_method',
      'follow_up_reason',
      'payment_status',
      'payment_received',
      'outreach_brand',
    ];
    const isEmail = (value: unknown) => String(value || '').includes('@');
    const cleanValue = (value: unknown) => String(value || '').trim();
    const isTrue = (value: unknown) => ['true', 'yes', '1', 'sent'].includes(cleanValue(value).toLowerCase());

    this.data.leads.forEach(l => {
      if (l.brand_id !== 'idao') return;
      if (!l.custom_fields) {
        l.custom_fields = {};
        modified = true;
      }
      const cf = l.custom_fields;

      // Repair one common bad upload shift: email landed in country, country landed in email.
      if (!isEmail(l.email) && isEmail(cf.country) && cleanValue(cf.name_secondary) && cleanValue(cf.company) && cleanValue(cf.job_title)) {
        const firstName = cleanValue(cf.name_secondary);
        const lastName = cleanValue(cf.job_title);
        const company = cleanValue(l.name);
        const jobTitle = cleanValue(cf.company);
        const country = cleanValue(l.email);
        l.name = `${firstName} ${lastName}`.trim();
        l.email = cleanValue(cf.country).toLowerCase();
        cf.country = country ? country.charAt(0).toUpperCase() + country.slice(1) : cf.country;
        cf.company = company;
        cf.job_title = jobTitle;
        modified = true;
      }

      if (!cleanValue(cf.country) && cleanValue(cf['Country/Region']) && !isEmail(cf['Country/Region'])) {
        cf.country = cleanValue(cf['Country/Region']);
        modified = true;
      }
      if (!cleanValue(cf.company) && cleanValue(cf['Company name'])) {
        cf.company = cleanValue(cf['Company name']);
        modified = true;
      }
      if (!cleanValue(cf.job_title) && cleanValue(cf['Job title'])) {
        cf.job_title = cleanValue(cf['Job title']);
        modified = true;
      }
      if (!cleanValue(cf.service_focus) && cleanValue(cf.service_type)) {
        cf.service_focus = cleanValue(cf.service_type);
        modified = true;
      }
      if (!cleanValue(cf.follow_up_type) && cleanValue(cf.follow_up_method)) {
        cf.follow_up_type = cleanValue(cf.follow_up_method);
        modified = true;
      }
      if (isTrue(cf['Quote Sent Via Email']) || isTrue(cf.quote_sent)) {
        cf.quote_status = 'Quote Sent';
        modified = true;
      } else if (!cleanValue(cf.quote_status) && isTrue(cf.quote_requested)) {
        cf.quote_status = 'Quote Requested';
        modified = true;
      }
      if (isTrue(cf.registration_confirmed)) {
        l.funnel_stage = 'Registered';
        modified = true;
      }

      noisyKeys.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(cf, key)) {
          delete cf[key];
          modified = true;
        }
      });
    });

    const beforeCount = this.data.custom_fields.length;
    this.data.custom_fields = this.data.custom_fields.filter(f => {
      return !(f.brand_id === 'idao' && duplicateFields.has(f.field_name.toLowerCase()));
    });
    if (this.data.custom_fields.length !== beforeCount) modified = true;

    const existingNames = new Set(this.data.custom_fields.filter(f => f.brand_id === 'idao').map(f => f.field_name.toLowerCase()));
    cleanFields.forEach(field => {
      if (this.isCustomFieldDeleted('idao', field.field_name)) return;
      if (!existingNames.has(field.field_name.toLowerCase())) {
        this.data.custom_fields.push(field);
        existingNames.add(field.field_name.toLowerCase());
        modified = true;
      }
    });

    if (modified) console.log('Cleaned duplicate IDAO dynamic columns and merged upload aliases.');
    return modified;
  }

  private ensureOptimavizUpdates() {
    let modified = false;
    const today = new Date().toISOString().split('T')[0];
    this.data.leads.forEach((l, idx) => {
      if (l.brand_id !== 'optimaviz') return;
      if (!l.custom_fields) {
        l.custom_fields = {};
        modified = true;
      }
      // Migrate old demo_leads segment value to demo_request_leads
      if (l.custom_fields.segment === 'demo_leads') {
        l.custom_fields.segment = 'demo_request_leads';
        modified = true;
      }
      // Assign default segments to unsegmented Optimaviz leads for demo purposes
      if (!l.custom_fields.segment) {
        // Distribute among the three segments: demo, trial, subscribed
        const idx3 = idx % 3;
        if (idx3 === 0) {
          l.custom_fields.segment = 'demo_request_leads';
          (l.custom_fields as any).demo_attended = false;
          l.custom_fields.follow_up_status = 'Pending Follow-Up';
        } else if (idx3 === 1) {
          l.custom_fields.segment = 'free_trial';
          // Stagger trial start dates so some have varying days remaining
          const daysAgo = (idx % 14);
          const startDate = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
          l.custom_fields.trial_start_date = startDate.toISOString().split('T')[0];
        } else {
          l.custom_fields.segment = 'subscribed_leads';
          l.custom_fields.subscription_plan = ['Starter', 'Professional', 'Enterprise'][idx % 3];
        }
        modified = true;
      }
      // Ensure free_trial leads have a trial_start_date
      if (l.custom_fields.segment === 'free_trial' && !l.custom_fields.trial_start_date) {
        const daysAgo = (idx % 14);
        const startDate = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
        l.custom_fields.trial_start_date = startDate.toISOString().split('T')[0];
        modified = true;
      }
    });
    if (modified) {
      console.log('Migrated/updated Optimaviz leads (demo_leads → demo_request_leads, assigned segments).');
      this.save();
    }
  }
}
