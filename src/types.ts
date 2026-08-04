export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  created_at?: string;
  presence_status?: string;
  presence_updated_at?: string;
  session_token?: string;
  session_expires_at?: string;
  workspace_id?: string;
  platform_role?: string;
  allowed_brand_ids?: string[];
  profile_picture?: string;
  profile_picture_url?: string;
  avatar_url?: string;
  picture_url?: string;
  notification_state?: any;
}

export interface TriggerConfig {
  id: string;
  name: string;
  trigger_type: 'communication_reply' | 'signup_complete' | 'purchase_complete' | 'meeting_attended' | 'info_provided' | 'manual';
  enabled: boolean;
  auto_promote?: boolean;
}

export interface ClassificationConfig {
  enabled: boolean;
  auto_promote_triggers?: TriggerConfig[];
  manual_promote_allowed?: boolean;
  manual_demote_allowed?: boolean;
  verified_starting_stage?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug?: string;
  logo: string;
  color: string;
  archived?: boolean;
  description?: string;
  created_at?: string;
  classification_config?: ClassificationConfig;
}

export interface BrandFunnel {
  id?: string;
  brand_id: string;
  stages?: string[];
  funnel_stages?: string[];
  lead_sources?: string[];
  whatsapp_config?: Record<string, unknown>;
  email_config?: Record<string, unknown>;
  created_at?: string;
  description?: string;
  target_audience?: string;
  audience_keywords?: string[];
  cross_sell_notes?: string;
}

export interface CustomField {
  id: string;
  brand_id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'boolean' | 'select' | string;
  required?: boolean;
  options?: string[] | string;
  created_at?: string;
  updated_at?: string;
}

export interface Lead {
  id: string;
  brand_id: string;
  brand_name?: string;
  name: string;
  email?: string;
  phone?: string;
  funnel_stage: string;
  stage?: string;
  notes?: string;
  tags?: string[] | string;
  source?: string;
  owner_id?: string;
  owner_name?: string;
  assigned_to?: string;
  follow_up_date?: string;
  follow_up_reason?: string;
  follow_up_channel?: string;
  custom_fields?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  workspace_id?: string;
  is_duplicate?: boolean;
  duplicate_of?: string;
  lead_classification?: 'prospect' | 'verified';
  classification_updated_at?: string;
  classification_updated_by?: string;
  classification_reason?: string;
}

export interface Note {
  id: string;
  lead_id?: string;
  user_id?: string;
  content: string;
  created_at?: string;
}

export interface CallLog {
  id: string;
  lead_id?: string;
  user_id?: string;
  outcome?: string;
  duration?: number;
  notes?: string;
  follow_up_date?: string;
  created_at?: string;
}

export interface EmailLog {
  id: string;
  brand_id?: string;
  lead_id?: string;
  from?: string;
  to?: string[];
  subject?: string;
  body?: string;
  status?: string;
  attachments?: Array<{ id: string; name: string; mime_type?: string; size?: number }>;
  tracking_pixel_id?: string;
  read_at?: string;
  read_by?: string;
  read_by_name?: string;
  opened_at?: string;
  open_count?: number;
  created_at?: string;
  provider?: string;
  direction?: string;
  mailbox_folder?: string;
  from_email?: string;
  to_email?: string;
  to_name?: string;
  template_name?: string;
  created_by?: string;
  html_content?: string;
  error_message?: string;
  action_status?: string;
  provider_message_id?: string;
}

export interface TeamMessage {
  id: string;
  content?: string;
  file_name?: string;
  file_url?: string;
  file_type?: string;
  recipient_ids?: string[];
  recipient_names?: string[];
  attachments?: Array<{
    id: string;
    name: string;
    mime_type?: string;
    size?: number;
    download_url?: string;
  }>;
  user_id?: string;
  user_name?: string;
  created_at?: string;
  message_type?: string;
  call_room_slug?: string;
  event_type?: string;
  call_status?: string;
}

export interface TeamNote {
  id: string;
  title: string;
  content: string;
  color?: string;
  pinned?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

export interface WhatsAppLog {
  id: string;
  lead_id?: string;
  brand_id?: string;
  direction?: 'inbound' | 'outbound';
  message: string;
  body?: string;
  status?: string;
  created_at?: string;
  read?: boolean;
}

export interface WhatsAppTemplate {
  id: string;
  brand_id: string;
  name: string;
  message: string;
  is_active?: boolean;
  created_at?: string;
}

export interface MessageTemplate {
  id: string;
  brand_id: string;
  channel: 'email' | 'whatsapp' | 'call';
  name: string;
  subject?: string;
  body: string;
  is_active?: boolean;
  updated_at?: string;
}

export interface BrandIntegration {
  id?: string;
  brand_id: string;
  email_provider: 'internal' | 'gmail' | 'outlook' | 'yahoo' | 'smtp' | string;
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
  email_accounts?: EmailProviderAccount[];
  whatsapp_provider?: 'manual' | 'cloud_api' | string;
  whatsapp_number?: string;
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_access_token_env?: string;
  whatsapp_verify_token?: string;
  whatsapp_profile_name?: string;
  whatsapp_profile_about?: string;
  whatsapp_profile_picture_url?: string;
  whatsapp_business_category?: string;
  whatsapp_business_website?: string;
  call_provider?: 'manual' | 'twilio' | string;
  call_number?: string;
  automation_enabled?: boolean;
  updated_at?: string;
}

export interface EmailProviderAccount {
  id: string;
  label: string;
  provider: 'gmail' | 'outlook' | 'yahoo' | 'smtp' | string;
  email: string;
  reply_to?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_secure?: boolean;
  smtp_username?: string;
  smtp_password_env?: string;
  is_default?: boolean;
}

export interface EmailConnection {
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
  smtp_password_env?: string;
  imap_host?: string;
  imap_port?: string;
  imap_secure?: boolean;
  imap_username?: string;
  imap_password_env?: string;
  send_enabled?: boolean;
  sync_enabled?: boolean;
  connection_status: 'connected' | 'expired' | 'revoked' | 'error' | string;
  connected_at: string;
  updated_at?: string;
  created_by_user_id?: string;
  is_default?: boolean;
  last_sync_at?: string;
  last_error?: string;
  oauth_mode?: 'central' | 'bring_your_own' | string;
}

export interface LeadSource {
  id: string;
  brand_id: string;
  name: string;
  provider: 'website' | 'facebook' | 'linkedin' | 'api' | 'webhook' | string;
  status: 'active' | 'paused' | 'needs_setup' | 'error' | string;
  secret_key?: string;
  webhook_url?: string;
  field_mappings?: Record<string, string>;
  default_stage?: string;
  duplicate_strategy?: 'update_existing' | 'skip' | 'create_new' | string;
  unmapped_field_strategy?: 'auto' | 'ignore' | string;
  leads_imported?: number;
  last_sync_at?: string;
  last_error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeadSourceLog {
  id: string;
  source_id: string;
  brand_id: string;
  status: string;
  lead_id?: string;
  external_lead_id?: string;
  message?: string;
  payload_summary?: Record<string, string>;
  created_at?: string;
}

export interface WebsiteAnalyticsSite {
  id: string;
  brand_id: string;
  name: string;
  domain?: string;
  status: 'active' | 'paused' | string;
  public_key?: string;
  script_url?: string;
  embed_code?: string;
  last_seen_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WebsiteAnalyticsSummary {
  total_visits: number;
  unique_visitors: number;
  conversions: number;
  conversion_rate: number;
  by_date: Array<{ date: string; visits: number }>;
  by_country: Array<{ label: string; count: number }>;
  by_device: Array<{ label: string; count: number }>;
  by_source: Array<{ label: string; count: number }>;
  top_pages: Array<{ label: string; count: number }>;
  recent: Array<Record<string, unknown>>;
}

export interface SequenceStep {
  id: string;
  name: string;
  delay_days: number;
  subject: string;
  html_content: string;
  channel?: string;
  type?: string;
}

export interface Sequence {
  id: string;
  brand_id: string;
  name: string;
  description?: string;
  trigger_stage?: string;
  active?: boolean;
  steps?: SequenceStep[];
  status?: string;
  created_at?: string;
}

export interface Task {
  id: string;
  brand_id?: string;
  content?: string;
  title?: string;
  status?: string;
  assigned_to?: string;
  user_name?: string;
  user_location?: string;
  due_date?: string;
  created_at?: string;
  task_date?: string;
  follow_up_date?: string;
}
