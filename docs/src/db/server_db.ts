import fs from 'fs';
import path from 'path';

// Let's define the interface structure for our Database
export interface DbUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  presence_status?: 'online' | 'away' | 'offline';
  presence_updated_at?: string;
  notification_state?: {
    seen_signature?: string;
    dismissed_ids?: string[];
    updated_at?: string;
  };
  created_at: string;
}

export interface DbBrandFunnel {
  id: string;
  brand_id: string;
  brand_name: string;
  stages: string[];
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
  whatsapp_access_token_env?: string;
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
  sequences: DbSequence[];
  custom_fields: DbCustomField[];
  enrollments: DbEnrollment[];
  tasks: DbTask[];
  team_messages: DbTeamMessage[];
  team_notes?: DbTeamNote[];
  usage_events?: DbUsageEvent[];
  audit_log: AuditEntry[];
}

const DB_PATH = path.join(process.cwd(), 'db.json');

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
const BACKUP_DIR = path.join(process.cwd(), 'backups');

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
    sequences: parsed?.sequences || [],
    custom_fields: parsed?.custom_fields || [],
    enrollments: parsed?.enrollments || [],
    tasks: parsed?.tasks || [],
    team_messages: parsed?.team_messages || [],
    team_notes: parsed?.team_notes || [],
    usage_events: parsed?.usage_events || [],
    audit_log: parsed?.audit_log || [],
  };
}

export class LocalDb {
  private data: Schema;
  private lastSupabaseSyncAt?: string;
  private lastSupabaseError?: string;
  private isSyncingToSupabase = false;

  constructor() {
    this.data = this.load();
    this.seedTaskGoIfEmpty();
    this.ensureTaskGoSegments();
    this.seedIdaoIfEmpty();
    this.ensureIdaoSegments();
    if (this.ensureIdaoColumnCleanup()) this.save();
    this.ensureOptimavizUpdates();
  }

  private load(): Schema {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return safeSchema(parsed);
      }
    } catch (err) {
      console.error('Error loading database:', err);
    }
    return this.getSeededData();
  }

  private getSeededData(): Schema {
    const adminUser: DbUser = {
      id: 'superadmin-1',
      name: 'Optimaviz Superadmin',
      email: 'superadmin@optimaviz.com',
      password: '***REMOVED***',
      role: 'admin',
      platform_role: 'superadmin' as any,
      created_at: new Date().toISOString()
    };

    const adminUser2: DbUser = {
      id: 'admin-2',
      name: 'Optima Admin',
      email: 'admin@optimacrm.com',
      password: '***REMOVED***',
      role: 'admin',
      created_at: new Date().toISOString()
    };

    const agentUser: DbUser = {
      id: 'agent-1',
      name: 'Agent One',
      email: 'agent@luju.com',
      password: 'password',
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

    this.saveData(data);
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
      this.writeJsonFileSafe(DB_PATH, data);
      this.writeTimestampedBackup(data);
      this.pushToSupabase(data).catch(err => {
        this.lastSupabaseError = err instanceof Error ? err.message : String(err);
        console.error('Supabase backup sync failed:', this.lastSupabaseError);
      });
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
      this.writeJsonFileSafe(path.join(BACKUP_DIR, 'db-latest.json'), data);
      const stamp = new Date().toISOString().slice(0, 10);
      const dailyPath = path.join(BACKUP_DIR, `db-${stamp}.json`);
      if (!fs.existsSync(dailyPath)) this.writeJsonFileSafe(dailyPath, data);
    } catch (err) {
      console.error('Error writing local backup:', err);
    }
  }

  private async pushToSupabase(data: Schema) {
    if (!this.supabaseConfigured() || this.isSyncingToSupabase) return;
    this.isSyncingToSupabase = true;
    try {
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
      if (rows.length > 0 && rows[0].data) {
        this.data = safeSchema(rows[0].data);
        this.ensureIdaoColumnCleanup();
        this.lastSupabaseSyncAt = rows[0].updated_at || new Date().toISOString();
        this.saveData(this.data);
        console.log('Loaded CRM database from Supabase and refreshed db.json fallback.');
      } else {
        await this.pushToSupabase(this.data);
        console.log('No Supabase CRM record found. Uploaded current db.json as the first cloud snapshot.');
      }
    } catch (err) {
      this.lastSupabaseError = err instanceof Error ? err.message : String(err);
      console.error('Could not initialize Supabase primary database. Falling back to db.json:', this.lastSupabaseError);
    }
  }

  public async forcePushToSupabase() {
    await this.pushToSupabase(this.data);
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

  private seedTaskGoIfEmpty() {
    const taskGoLeads = this.data.leads.filter(l => l.brand_id === 'taskgo');
    // If we only have the default 1-2 leads, run seeding
    if (taskGoLeads.length < 5) {
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
