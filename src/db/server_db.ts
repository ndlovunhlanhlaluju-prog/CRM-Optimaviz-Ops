import fs from 'fs';
import path from 'path';

// Let's define the interface structure for our Database
export interface DbUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  allowed_brand_ids?: string[];
  platform_role?: 'superadmin' | 'none';
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
  brand