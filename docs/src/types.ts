export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  [key: string]: any;
}

export interface Brand {
  id: string;
  name: string;
  logo: string;
  color: string;
  archived?: boolean;
  [key: string]: any;
}

export interface BrandFunnel {
  id?: string;
  brand_id: string;
  stages?: string[];
  [key: string]: any;
}

export interface CustomField {
  id: string;
  brand_id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'boolean' | 'select' | string;
  required?: boolean;
  options?: string[] | string;
  [key: string]: any;
}

export interface Lead {
  id: string;
  brand_id: string;
  brand_name?: string;
  name: string;
  email?: string;
  phone?: string;
  funnel_stage: string;
  notes?: string;
  tags?: string[] | string;
  owner_id?: string;
  owner_name?: string;
  follow_up_date?: string;
  custom_fields?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface Note {
  id: string;
  lead_id?: string;
  content: string;
  created_at?: string;
  [key: string]: any;
}

export interface CallLog {
  id: string;
  lead_id?: string;
  outcome?: string;
  duration?: number;
  notes?: string;
  created_at?: string;
  [key: string]: any;
}

export interface EmailLog {
  id: string;
  lead_id?: string;
  subject?: string;
  body?: string;
  status?: string;
  created_at?: string;
  opened_at?: string;
  open_count?: number;
  [key: string]: any;
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
  [key: string]: any;
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
  [key: string]: any;
}

export interface WhatsAppLog {
  id: string;
  lead_id?: string;
  brand_id?: string;
  message: string;
  status?: string;
  created_at?: string;
  [key: string]: any;
}

export interface WhatsAppTemplate {
  id: string;
  brand_id: string;
  name: string;
  message: string;
  is_active?: boolean;
  [key: string]: any;
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
  [key: string]: any;
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
  whatsapp_provider?: 'manual' | 'cloud_api' | 'twilio' | string;
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
  call_provider?: 'manual' | 'twilio' | 'aircall' | string;
  call_number?: string;
  automation_enabled?: boolean;
  updated_at?: string;
  [key: string]: any;
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

export interface SequenceStep {
  id: string;
  name: string;
  delay_days: number;
  subject: string;
  html_content: string;
  [key: string]: any;
}

export interface Sequence {
  id: string;
  brand_id: string;
  name: string;
  description?: string;
  trigger_stage?: string;
  active?: boolean;
  steps?: SequenceStep[];
  [key: string]: any;
}

export interface Task {
  id: string;
  brand_id?: string;
  content?: string;
  status?: string;
  user_name?: string;
  user_location?: string;
  created_at?: string;
  [key: string]: any;
}
