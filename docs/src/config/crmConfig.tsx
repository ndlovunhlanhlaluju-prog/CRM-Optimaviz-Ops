import React from 'react';
import type { Brand, Lead } from '../types';

export const BRANDS: Brand[] = [
  { id: 'optimaviz', name: 'Optimaviz', logo: '/logos/optimaviz.png', color: 'var(--brand-optimaviz)' },
  { id: 'taskgo', name: 'TaskGo', logo: '/logos/taskgo.png', color: 'var(--brand-taskgo)' },
  { id: 'idao', name: 'IDAO', logo: '/logos/idao.png', color: 'var(--brand-idao)' },
  { id: 'optimaclean', name: 'OptimaClean', logo: '/logos/optimaclean.png', color: 'var(--brand-optimaclean)' },
  { id: 'nestwise', name: 'NestWise', logo: '/logos/nestwise.png', color: 'var(--brand-nestwise)' }
];

export const BRAND_COLOR_PRESETS = ['#8B5CF6', '#2563EB', '#0EA5E9', '#10B981', '#F97316', '#EF4444', '#111827', '#25D366'];
export const NESTWISE_DASHBOARD_VERSION = 'nextwise_services_2026_v1';
export const readViteEnv = (key: string, fallback = '') => {
  try {
    return ((import.meta as any).env?.[key] as string) || fallback;
  } catch {
    return fallback;
  }
};
export const TEAM_CALL_DOMAIN = readViteEnv('VITE_JITSI_DOMAIN', '8x8.vc');
export const TEAM_CALL_JAAS_APP_ID = readViteEnv('VITE_JITSI_JAAS_APP_ID', 'vpaas-magic-cookie-0c04c84af206463ca5e03829c46a8553');
export const TEAM_CALL_BRAND_NAME = readViteEnv('VITE_JITSI_APP_NAME', 'Optima CRM Calls');
export const TEAM_CALL_IS_JAAS = TEAM_CALL_DOMAIN.includes('8x8.vc');
export const getTeamCallScriptSrc = () => TEAM_CALL_IS_JAAS
  ? `https://${TEAM_CALL_DOMAIN}/${TEAM_CALL_JAAS_APP_ID}/external_api.js`
  : `https://${TEAM_CALL_DOMAIN}/external_api.js`;
export const sanitizeTeamCallRoom = (value: string) => value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 120);
export const getTeamCallRoomName = (roomSlug: string) => TEAM_CALL_IS_JAAS ? `${TEAM_CALL_JAAS_APP_ID}/${roomSlug}` : roomSlug;
export const getTeamCallExternalUrl = (roomSlug: string) => `https://${TEAM_CALL_DOMAIN}/${getTeamCallRoomName(roomSlug)}`;

export const BRAND_SEGMENTS: Record<string, { label: string; value: string; color: string; icon: string }[]> = {
  nestwise: [
    { label: 'Airbnb Hosting Support', value: 'airbnb_hosting_support', color: '#FD5C63', icon: 'fas fa-bed' },
    { label: 'Rental & Sale Marketing', value: 'property_marketing', color: '#2563EB', icon: 'fas fa-bullhorn' },
    { label: 'Property Care & Inspections', value: 'property_care', color: '#8B5CF6', icon: 'fas fa-clipboard-check' },
    { label: 'Maintenance & Repairs', value: 'maintenance_repairs', color: '#F59E0B', icon: 'fas fa-screwdriver-wrench' },
    { label: 'Security & Emergency Support', value: 'property_security', color: '#10B981', icon: 'fas fa-shield-halved' },
    { label: 'Photography & Valuation Support', value: 'photo_valuation', color: '#0EA5E9', icon: 'fas fa-camera' }
  ],
  optimaviz: [
    { label: 'Optimaviz Demo Leads', value: 'demo_leads', color: '#F59E0B', icon: 'fas fa-chalkboard-teacher' },
    { label: 'Trial Leads', value: 'trial_leads', color: '#EC4899', icon: 'fas fa-hourglass-half' },
    { label: 'Subscribed Platform Users', value: 'subscribed_platform_users', color: '#10B981', icon: 'fas fa-crown' },
    { label: '3 Day Training Leads', value: 'training_leads', color: '#F97316', icon: 'fas fa-graduation-cap' }
  ],
  taskgo: [
    { label: 'Contractor Roster', value: 'all_platform', color: '#3B82F6', icon: 'fas fa-users' },
    { label: 'Contractor Verification Issues', value: 'incomplete_platform', color: '#EF4444', icon: 'fas fa-user-clock' },
    { label: 'Contractor Form Submissions', value: 'form_leads', color: '#8B5CF6', icon: 'fas fa-file-signature' },
    { label: 'Client Support & Complaints', value: 'client_support', color: '#F97316', icon: 'fas fa-headset' },
    { label: 'Client Login / Account Help', value: 'client_login_help', color: '#06B6D4', icon: 'fas fa-key' },
    { label: 'Client Follow-Ups', value: 'client_followup', color: '#10B981', icon: 'fas fa-phone-volume' }
  ],
  idao: [
    { label: '3 Day Training', value: 'training_leads', color: '#8B5CF6', icon: 'fas fa-graduation-cap' },
    { label: 'Optimaviz Referrals', value: 'optimaviz_referrals', color: '#3B82F6', icon: 'fas fa-project-diagram' },
    { label: 'Other Services', value: 'other_services', color: '#10B981', icon: 'fas fa-briefcase' }
  ],
  optimaclean: [
    { label: 'Contract Clients & Accounts', value: 'clients', color: '#10B981', icon: 'fas fa-user-tie' },
    { label: 'Service Partners & Cleaners', value: 'workers', color: '#F59E0B', icon: 'fas fa-broom' }
  ]
};

export const DEFAULT_STAGES = ["New Lead", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"];
export const IDAO_TRAINING_STAGES = ["Training Enquiry", "Email Sent", "Quote Requested", "Quote Sent", "Follow-Up Due", "Call Follow-Up", "Registered", "Attended", "Post-Training Follow-Up"];
export const IDAO_OPTIMAVIZ_REFERRAL_STAGES = ["Interested in Optimaviz", "Demo Requested", "Demo Scheduled", "Demo Attended", "No Show / Did Not Attend", "Passed to Optimaviz", "Trial Started", "Closed / Not Interested"];
export const IDAO_OTHER_SERVICES_STAGES = ["Service Enquiry", "Email Sent", "Needs Discussion", "Quote Requested", "Quote Sent", "Follow-Up Due", "Call Follow-Up", "Won", "Lost / Not Interested"];
export const IDAO_STAGES = Array.from(new Set([...IDAO_TRAINING_STAGES, ...IDAO_OPTIMAVIZ_REFERRAL_STAGES, ...IDAO_OTHER_SERVICES_STAGES]));
export const TASKGO_STAGES = ["New Intake", "Contractor Verification", "ABN Missing", "Documents Needed", "Approved Contractor", "Active Contractor", "Support Open", "Complaint Open", "Login Help", "Follow-Up Needed", "Resolved", "Closed"];
export const NESTWISE_STAGES = ["New Enquiry", "Needs Discovery", "Service Matched", "Quote / Package Sent", "Owner Approved", "Active Service", "Reporting / Updates", "Closed / Lost"];

export const OPTIMAVIZ_DEMO_LEADS_STAGES = ["Demo Requested", "Demo Scheduled", "Demo Attended", "No Show / Did Not Attend", "Follow-Up Due", "Trial Started", "Closed / Not Interested"];
export const OPTIMAVIZ_TRIAL_LEADS_STAGES = ["Trial Started", "Onboarding Sent", "Active Trial User", "Low Activity / Needs Follow-Up", "Trial Ending Soon", "Converted to Subscriber", "Trial Expired"];
export const OPTIMAVIZ_SUBSCRIBED_USERS_STAGES = ["Subscribed", "Onboarding in Progress", "Active Platform User", "Needs Support / Check-In", "At Risk", "Renewed / Expanded", "Cancelled"];
export const OPTIMAVIZ_TRAINING_LEADS_STAGES = ["Training Enquiry", "Email Sent", "Quote Sent", "Follow-Up Due", "Registered", "Attended", "Post-Training Follow-Up"];

export const BRAND_STAGE_MAP: Record<string, string[]> = { 
  idao: IDAO_STAGES, 
  taskgo: TASKGO_STAGES, 
  nestwise: NESTWISE_STAGES,
  optimaviz: [...OPTIMAVIZ_DEMO_LEADS_STAGES, ...OPTIMAVIZ_TRIAL_LEADS_STAGES, ...OPTIMAVIZ_SUBSCRIBED_USERS_STAGES, ...OPTIMAVIZ_TRAINING_LEADS_STAGES]
};

export const OPTIMAVIZ_SEGMENT_STAGES: Record<string, string[]> = {
  demo_leads: OPTIMAVIZ_DEMO_LEADS_STAGES,
  trial_leads: OPTIMAVIZ_TRIAL_LEADS_STAGES,
  subscribed_platform_users: OPTIMAVIZ_SUBSCRIBED_USERS_STAGES,
  training_leads: OPTIMAVIZ_TRAINING_LEADS_STAGES
};

export const IDAO_SEGMENT_STAGES: Record<string, string[]> = {
  training_leads: IDAO_TRAINING_STAGES,
  optimaviz_referrals: IDAO_OPTIMAVIZ_REFERRAL_STAGES,
  other_services: IDAO_OTHER_SERVICES_STAGES
};

export const IDAO_SERVICE_TYPES: Record<string, string[]> = {
  training_leads: ["3 Day Annual Training", "Early Bird Training Lead", "Training Follow-Up"],
  optimaviz_referrals: ["Optimaviz Demo", "Optimaviz Trial Interest", "Optimaviz Platform Interest"],
  other_services: ["Corporate Training", "Flotation Optimisation", "Consulting / Advisory", "Other"]
};

export const IDAO_NEXT_ACTIONS: Record<string, string[]> = {
  training_leads: ["Send Intro Email", "Send Quote", "Follow Up Quote", "Call Lead", "Confirm Registration", "Send Training Reminder", "Post-Training Follow-Up", "Invite to Optimaviz Demo"],
  optimaviz_referrals: ["Qualify Interest", "Book Demo", "Send Demo Reminder", "Rebook Demo", "Pass to Optimaviz", "Follow Up After Demo", "Mark Trial Started", "Close Lead"],
  other_services: ["Send Intro Email", "Book Discovery Call", "Clarify Service Need", "Send Quote", "Follow Up Quote", "Call Lead", "Mark Won", "Mark Lost"]
};

export const IDAO_FOLLOW_UP_RULES: Record<string, { stage: string; days: number; description: string }[]> = {
  training_leads: [
    { stage: "Training Enquiry", days: 0, description: "Send email today" },
    { stage: "Email Sent", days: 2, description: "Follow up in 2 days" },
    { stage: "Quote Requested", days: 0, description: "Send quote today" },
    { stage: "Quote Sent", days: 3, description: "Follow up in 3 days" },
    { stage: "Follow-Up Due", days: 7, description: "Call after 7 days" },
    { stage: "Attended", days: 0, description: "Post-training follow-up" }
  ],
  optimaviz_referrals: [
    { stage: "Interested in Optimaviz", days: 1, description: "Follow up in 1 day" },
    { stage: "Demo Requested", days: 1, description: "Schedule demo within 1 day" },
    { stage: "Demo Scheduled", days: 0, description: "Reminder on demo day" },
    { stage: "Demo Attended", days: 1, description: "Follow up within 1 day" },
    { stage: "No Show / Did Not Attend", days: 1, description: "Rebook follow-up in 1 day" },
    { stage: "Passed to Optimaviz", days: 3, description: "Check status in 3 days" }
  ],
  other_services: [
    { stage: "Service Enquiry", days: 0, description: "Send email today" },
    { stage: "Email Sent", days: 2, description: "Follow up in 2 days" },
    { stage: "Needs Discussion", days: 2, description: "Schedule call in 2 days" },
    { stage: "Quote Requested", days: 0, description: "Send quote today" },
    { stage: "Quote Sent", days: 3, description: "Follow up in 3 days" },
    { stage: "Follow-Up Due", days: 7, description: "Call after 7 days" }
  ]
};

export const OPTIMAVIZ_NEXT_ACTIONS: Record<string, string[]> = {
  demo_leads: [
    "Schedule Demo",
    "Send Demo Reminder",
    "Follow Up After Demo",
    "Rebook Demo",
    "Send Trial Invite",
    "Close Lead"
  ],
  trial_leads: [
    "Send Onboarding Email",
    "Check Usage",
    "Send Trial Reminder",
    "Call Trial User",
    "Push Subscription",
    "Extend Trial",
    "Mark Expired"
  ],
  subscribed_platform_users: [
    "Start Onboarding",
    "Schedule Check-In",
    "Resolve Support Issue",
    "Usage Follow-Up",
    "Renewal Follow-Up",
    "Upsell / Expand",
    "Mark Cancelled"
  ],
  training_leads: [
    "Send Email",
    "Send Quote",
    "Follow Up Quote",
    "Call Lead",
    "Confirm Registration",
    "Post-Training Follow-Up",
    "Invite to Optimaviz Demo"
  ]
};

export const OPTIMAVIZ_FOLLOW_UP_RULES: Record<string, { stage: string; days: number; description: string }[]> = {
  demo_leads: [
    { stage: "Demo Requested", days: 1, description: "Follow up in 1 day if not scheduled" },
    { stage: "Demo Scheduled", days: 0, description: "Reminder on demo day" },
    { stage: "Demo Attended", days: 1, description: "Follow up within 1 day" },
    { stage: "No Show / Did Not Attend", days: 1, description: "Follow up within 1 day to rebook" },
    { stage: "Follow-Up Due", days: 0, description: "Mark overdue if date passes" }
  ],
  trial_leads: [
    { stage: "Trial Started", days: 1, description: "Onboarding follow-up in 1 day" },
    { stage: "Low Activity / Needs Follow-Up", days: 0, description: "Follow up immediately" },
    { stage: "Trial Ending Soon", days: 3, description: "Follow up 3 days before trial end" },
    { stage: "Trial Expired", days: 1, description: "Follow up 1 day after expiry" }
  ],
  subscribed_platform_users: [
    { stage: "Onboarding in Progress", days: 2, description: "Check in after 2 days" },
    { stage: "Needs Support / Check-In", days: 0, description: "Follow up today" },
    { stage: "At Risk", days: 0, description: "Follow up today" },
    { stage: "Renewed / Expanded", days: 7, description: "Follow up in 7 days" }
  ],
  training_leads: [
    { stage: "Email Sent", days: 2, description: "Follow up in 2 days" },
    { stage: "Quote Sent", days: 3, description: "Follow up in 3 days" },
    { stage: "Follow-Up Due", days: 7, description: "Call after 7 days if no response" },
    { stage: "Attended", days: 0, description: "Post-training follow-up to offer Optimaviz demo" }
  ]
};
export const getBrandStages = (brandId?: string) => BRAND_STAGE_MAP[brandId || ''] || DEFAULT_STAGES;
export const IDAO_QUOTE_FOLLOW_UP_DAYS = 3;
export const IDAO_PAYMENT_FOLLOW_UP_DAYS = 7;

export const OPTIMAVIZ_TRIAL_DAYS = 14;
export const OPTIMAVIZ_REMOVED_TABLE_FIELDS = new Set(['estimated_budget', 'annual_revenue', 'employee_count', 'project_size']);
export const IDAO_REMOVED_TABLE_FIELDS = new Set(['estimated_budget', 'annual_revenue', 'employee_count', 'project_size', 'payment_status']);
export const OPTIMAVIZ_TRIAL_TABLE_FIELDS = new Set(['trial_status', 'days_remaining']);
export const OPTIMAVIZ_USAGE_FIELDS = [
  'data_evaluation',
  'performance_evaluation',
  'performance_exploration',
  'analytics_for_optimisation',
  'machine_learning_for_optimisation',
  'global_parameter_impact_evaluation'
];
export const OPTIMAVIZ_USAGE_LABELS: Record<string, string> = {
  data_evaluation: 'Data Evaluation',
  performance_evaluation: 'Performance Evaluation',
  performance_exploration: 'Performance Exploration',
  analytics_for_optimisation: 'Analytics for Optimisation',
  machine_learning_for_optimisation: 'Machine Learning for Optimisation',
  global_parameter_impact_evaluation: 'Global Parameter Impact Evaluation'
};

export const LEAD_DATE_FIELD_KEYS = [
  'lead_date',
  'source_created_at',
  'date_created',
  'created_date',
  'date_joined',
  'joined_date',
  'joined_at',
  'registration_date',
  'registered_at',
  'submitted_at',
  'submission_date',
  'timestamp'
];

export const DATE_WINDOW_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last30', label: 'Last 30 Days' },
] as const;

export type DateWindowFilter = typeof DATE_WINDOW_OPTIONS[number]['value'];

export const normalizeDateHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const findLeadDateHeader = (headers: string[]) => {
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
  ]);

  return headers.find(header => {
    const compact = normalizeDateHeader(header);
    if (exactAliases.has(compact)) return true;
    return (
      compact.includes('createddate') ||
      compact.includes('datecreated') ||
      compact.includes('datejoined') ||
      compact.includes('joineddate') ||
      compact.includes('registrationdate') ||
      compact.includes('submittedat') ||
      compact.includes('submissiondate')
    );
  }) || '';
};

export const parseLeadDateValue = (value: any): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    if (raw.length >= 12) {
      const asMs = new Date(numeric);
      if (!Number.isNaN(asMs.getTime())) return asMs;
    }
    if (raw.length === 10 && numeric > 1000000000) {
      const asSeconds = new Date(numeric * 1000);
      if (!Number.isNaN(asSeconds.getTime())) return asSeconds;
    }
    if (numeric > 20000 && numeric < 80000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const excelDate = new Date(excelEpoch + numeric * 86400000);
      if (!Number.isNaN(excelDate.getTime())) return excelDate;
    }
  }

  const ymd = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(date.getTime())) return date;
  }

  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(date.getTime())) return date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getLeadTimelineDate = (lead: Lead): Date | null => {
  for (const key of LEAD_DATE_FIELD_KEYS) {
    const parsed = parseLeadDateValue(lead.custom_fields?.[key]);
    if (parsed) return parsed;
  }
  return parseLeadDateValue(lead.created_at);
};

export const getLeadTimelineTime = (lead: Lead) => getLeadTimelineDate(lead)?.getTime() || 0;

export const getLeadDateLabel = (lead: Lead) => {
  const date = getLeadTimelineDate(lead);
  return date ? date.toLocaleDateString() : '';
};

export const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const startOfWeek = (date: Date) => {
  const next = startOfDay(date);
  const day = next.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + mondayOffset);
  return next;
};

export const isLeadInDateWindow = (lead: Lead, window: DateWindowFilter) => {
  if (window === 'all') return true;
  const date = getLeadTimelineDate(lead);
  if (!date) return false;

  const now = new Date();
  const leadDay = startOfDay(date).getTime();
  if (window === 'today') return leadDay === startOfDay(now).getTime();
  if (window === 'week') return leadDay >= startOfWeek(now).getTime();
  if (window === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (window === 'last30') return date.getTime() >= now.getTime() - 30 * 86400000;
  return true;
};

export const parseDateInputBoundary = (value: string, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
};

export const isLeadInCustomDateRange = (lead: Lead, from: string, to: string) => {
  if (!from && !to) return true;
  const date = getLeadTimelineDate(lead);
  if (!date) return false;

  const fromDate = parseDateInputBoundary(from);
  const toDate = parseDateInputBoundary(to, true);

  if (fromDate && date.getTime() < fromDate.getTime()) return false;
  if (toDate && date.getTime() > toDate.getTime()) return false;
  return true;
};


export interface CustomWidget {
  id: string;
  title: string;
  criteriaType: 'segment' | 'stage' | 'custom_field';
  criteriaValue: string;
  criteriaOp?: 'present' | 'equals' | 'contains' | 'groupby';
  criteriaCompareValue?: string;
  countMode?: 'records' | 'unique_people' | 'valid_abn' | 'missing_abn';
  icon: string;
  color: string;
  goal?: number;
}

export type CommandMetricKind =
  | 'due_followups'
  | 'new_leads'
  | 'no_activity'
  | 'missing_phone'
  | 'duplicate_people'
  | 'do_not_contact'
  | 'total_leads'
  | 'emails_sent'
  | 'whatsapp_sent'
  | 'calls_logged'
  | 'taskgo_unique_users'
  | 'taskgo_with_abn'
  | 'taskgo_missing_abn'
  | 'optimaviz_demo_requests'
  | 'optimaviz_new_trials'
  | 'optimaviz_subscribers'
  | 'optimaviz_feature_data_evaluation'
  | 'optimaviz_feature_performance_evaluation'
  | 'optimaviz_feature_performance_exploration'
  | 'optimaviz_feature_analytics_optimisation'
  | 'optimaviz_feature_ml_optimisation'
  | 'optimaviz_feature_global_parameter'
  | 'idao_training_leads'
  | 'idao_quotes_sent'
  | 'idao_followups_due'
  | 'optimaclean_pipeline'
  | 'optimaclean_proposals'
  | 'optimaclean_clients'
  | 'nestwise_property_owners'
  | 'nestwise_onboarded_owners'
  | 'nestwise_bulawayo_properties'
  | 'nestwise_service_enquiries'
  | 'stage_count'
  | 'custom_field_present'
  | 'custom_field_match';

export interface CommandMetricConfig {
  id: string;
  label: string;
  kind: CommandMetricKind;
  icon: string;
  color: string;
  brandId?: string;
  stage?: string;
  fieldKey?: string;
}

export const COMMAND_METRIC_OPTIONS: { value: CommandMetricKind; label: string; description?: string; brandId?: string; needsBrand?: boolean; needsStage?: boolean; needsField?: boolean; icon?: string; color?: string }[] = [
  { value: 'due_followups', label: 'Follow-ups due', description: 'Leads whose follow-up date is today or overdue.', icon: 'fa-clock', color: '#ef4444' },
  { value: 'new_leads', label: 'New leads', description: 'Leads still sitting in a new/intake stage.', icon: 'fa-user-plus', color: '#2563eb' },
  { value: 'no_activity', label: 'Leads with no activity', description: 'Leads with no emails, WhatsApp messages, calls, or notes yet.', icon: 'fa-inbox', color: '#8b5cf6' },
  { value: 'missing_phone', label: 'Missing phone numbers', description: 'Records that need phone cleanup before calls or WhatsApp.', icon: 'fa-phone-slash', color: '#ef4444' },
  { value: 'duplicate_people', label: 'Duplicate people', description: 'Possible duplicate people within the selected scope.', icon: 'fa-clone', color: '#0ea5e9' },
  { value: 'do_not_contact', label: 'Do-not-contact leads', description: 'Records marked as not safe to contact.', icon: 'fa-ban', color: '#ef4444' },
  { value: 'total_leads', label: 'Total leads', description: 'Lead count using the selected brand scope.', needsBrand: true, icon: 'fa-users', color: '#6366f1' },
  { value: 'emails_sent', label: 'Emails sent', description: 'Tracked outbound email volume for the selected scope.', icon: 'fa-envelope', color: '#6366f1' },
  { value: 'whatsapp_sent', label: 'WhatsApp sent', description: 'Tracked WhatsApp message volume for the selected scope.', icon: 'fa-comments', color: '#25d366' },
  { value: 'calls_logged', label: 'Calls logged', description: 'Call activity logged for the selected scope.', icon: 'fa-phone', color: '#0ea5e9' },
  { value: 'optimaviz_demo_requests', label: 'Optimaviz demo requests', description: 'Optimaviz leads requesting product demos.', brandId: 'optimaviz', icon: 'fa-chalkboard-teacher', color: '#f59e0b' },
  { value: 'optimaviz_new_trials', label: 'Optimaviz new trials', description: 'Free trial leads in the Optimaviz pipeline.', brandId: 'optimaviz', icon: 'fa-hourglass-half', color: '#ec4899' },
  { value: 'optimaviz_subscribers', label: 'Optimaviz subscribers', description: 'Active paid/subscribed Optimaviz accounts.', brandId: 'optimaviz', icon: 'fa-crown', color: '#f59e0b' },
  { value: 'optimaviz_feature_data_evaluation', label: 'Optimaviz Data Evaluation usage', description: 'Leads/accounts using Data Evaluation.', brandId: 'optimaviz', icon: 'fa-chart-simple', color: '#6366f1' },
  { value: 'optimaviz_feature_performance_evaluation', label: 'Optimaviz Performance Evaluation usage', description: 'Leads/accounts using Performance Evaluation.', brandId: 'optimaviz', icon: 'fa-gauge-high', color: '#0ea5e9' },
  { value: 'optimaviz_feature_performance_exploration', label: 'Optimaviz Performance Exploration usage', description: 'Leads/accounts using Performance Exploration.', brandId: 'optimaviz', icon: 'fa-magnifying-glass-chart', color: '#14b8a6' },
  { value: 'optimaviz_feature_analytics_optimisation', label: 'Optimaviz Analytics for Optimisation usage', description: 'Leads/accounts using Analytics for Optimisation.', brandId: 'optimaviz', icon: 'fa-chart-line', color: '#10b981' },
  { value: 'optimaviz_feature_ml_optimisation', label: 'Optimaviz Machine Learning for Optimisation usage', description: 'Leads/accounts using ML optimisation.', brandId: 'optimaviz', icon: 'fa-brain', color: '#8b5cf6' },
  { value: 'optimaviz_feature_global_parameter', label: 'Optimaviz Global Parameter Impact usage', description: 'Leads/accounts using Global Parameter Impact Evaluation.', brandId: 'optimaviz', icon: 'fa-globe', color: '#f97316' },
  { value: 'taskgo_unique_users', label: 'TaskGo registered contractors', description: 'Unique people in the TaskGo contractor roster.', brandId: 'taskgo', icon: 'fa-users', color: '#2563eb' },
  { value: 'taskgo_with_abn', label: 'TaskGo ABN verified contractors', description: 'TaskGo contractors with a valid ABN captured.', brandId: 'taskgo', icon: 'fa-id-card', color: '#10b981' },
  { value: 'taskgo_missing_abn', label: 'TaskGo contractors missing ABN', description: 'TaskGo contractor records still missing ABN.', brandId: 'taskgo', icon: 'fa-id-card-clip', color: '#f59e0b' },
  { value: 'idao_training_leads', label: 'IDAO training leads', description: 'IDAO 3-day training registrations.', brandId: 'idao', icon: 'fa-graduation-cap', color: '#8b5cf6' },
  { value: 'idao_quotes_sent', label: 'IDAO quotes sent', description: 'IDAO leads with quotes sent.', brandId: 'idao', icon: 'fa-file-invoice-dollar', color: '#f59e0b' },
  { value: 'idao_followups_due', label: 'IDAO follow-ups due', description: 'IDAO records with due follow-up status or date.', brandId: 'idao', icon: 'fa-bell', color: '#ef4444' },
  { value: 'optimaclean_pipeline', label: 'OptimaClean pipeline', description: 'All OptimaClean pipeline records.', brandId: 'optimaclean', icon: 'fa-broom', color: '#14b8a6' },
  { value: 'optimaclean_proposals', label: 'OptimaClean proposals', description: 'OptimaClean leads currently around proposal stage.', brandId: 'optimaclean', icon: 'fa-file-signature', color: '#f59e0b' },
  { value: 'optimaclean_clients', label: 'OptimaClean clients', description: 'OptimaClean won/client accounts.', brandId: 'optimaclean', icon: 'fa-user-check', color: '#10b981' },
  { value: 'nestwise_property_owners', label: 'NestWise property owners', description: 'NestWise property owner/service leads.', brandId: 'nestwise', icon: 'fa-house-user', color: '#f97316' },
  { value: 'nestwise_onboarded_owners', label: 'NestWise onboarded owners', description: 'Owners moved into onboarding/won stages.', brandId: 'nestwise', icon: 'fa-key', color: '#10b981' },
  { value: 'nestwise_bulawayo_properties', label: 'NestWise Bulawayo properties', description: 'NestWise records mentioning Bulawayo property locations.', brandId: 'nestwise', icon: 'fa-location-dot', color: '#0ea5e9' },
  { value: 'nestwise_service_enquiries', label: 'NestWise service enquiries', description: 'Owners asking for hosting, marketing, care, security, repairs, photos, or valuation services.', brandId: 'nestwise', icon: 'fa-concierge-bell', color: '#8b5cf6' },
  { value: 'stage_count', label: 'Leads in a stage', description: 'Count records in a specific funnel stage.', needsBrand: true, needsStage: true, icon: 'fa-diagram-project', color: '#6366f1' },
  { value: 'custom_field_present', label: 'Custom field present', description: 'Count records where a custom field has any value.', needsBrand: true, needsField: true, icon: 'fa-table-columns', color: '#64748b' },
  { value: 'custom_field_match', label: 'Custom field match', description: 'Count records where a custom field equals a value.', needsBrand: true, needsField: true, needsStage: true, icon: 'fa-filter', color: '#64748b' },
];

export const DEFAULT_COMMAND_METRICS: CommandMetricConfig[] = [
  { id: 'cmd_tg_roster', label: 'TaskGo Registered Contractors', kind: 'taskgo_unique_users', icon: 'fa-users', color: '#2563eb', brandId: 'taskgo' },
  { id: 'cmd_tg_abn', label: 'TaskGo ABN Verified', kind: 'taskgo_with_abn', icon: 'fa-id-card', color: '#10b981', brandId: 'taskgo' },
  { id: 'cmd_ov_trials', label: 'Optimaviz New Trials', kind: 'custom_field_match', icon: 'fa-hourglass-half', color: '#ec4899', brandId: 'optimaviz', fieldKey: 'segment', stage: 'trial_leads' },
  { id: 'cmd_ov_subs', label: 'Optimaviz Subscribers', kind: 'custom_field_match', icon: 'fa-crown', color: '#f59e0b', brandId: 'optimaviz', fieldKey: 'segment', stage: 'subscribed_platform_users' },
  { id: 'cmd_nw_owners', label: 'NestWise Service Pipeline', kind: 'total_leads', icon: 'fa-house-user', color: '#f97316', brandId: 'nestwise' },
  { id: 'cmd_idao_training', label: 'IDAO Training Leads', kind: 'custom_field_match', icon: 'fa-graduation-cap', color: '#8b5cf6', brandId: 'idao', fieldKey: 'segment', stage: 'training_leads' },
  { id: 'cmd_oc_pipeline', label: 'OptimaClean Pipeline', kind: 'total_leads', icon: 'fa-broom', color: '#14b8a6', brandId: 'optimaclean' },
  { id: 'cmd_due', label: 'Due Follow-Ups', kind: 'due_followups', icon: 'fa-clock', color: '#ef4444' },
];

export const DEFAULT_WIDGETS: Record<string, CustomWidget[]> = {
  taskgo: [
    { id: 'tg_contractors_roster', title: 'Contractor Roster', criteriaType: 'segment', criteriaValue: 'all_platform', countMode: 'unique_people', icon: 'fa-users', color: '#3B82F6' },
    { id: 'tg_contractor_verification', title: 'Verification Queue', criteriaType: 'segment', criteriaValue: 'incomplete_platform', countMode: 'unique_people', icon: 'fa-user-clock', color: '#EF4444' },
    { id: 'tg_abn_missing', title: 'Contractors Missing ABN', criteriaType: 'custom_field', criteriaValue: 'abn_number', criteriaOp: 'present', countMode: 'missing_abn', icon: 'fa-id-card', color: '#F59E0B' },
    { id: 'tg_client_support', title: 'Client Support Tickets', criteriaType: 'segment', criteriaValue: 'client_support', countMode: 'records', icon: 'fa-headset', color: '#F97316' },
    { id: 'tg_login_help', title: 'Login / Account Help', criteriaType: 'segment', criteriaValue: 'client_login_help', countMode: 'records', icon: 'fa-key', color: '#06B6D4' },
  ],
  optimaviz: [
    { id: 'ov_demo_leads', title: 'Optimaviz Demo Leads', criteriaType: 'segment', criteriaValue: 'demo_leads', goal: 50, icon: 'fa-chalkboard-teacher', color: '#8B5CF6' },
    { id: 'ov_trial_leads', title: 'Trial Leads', criteriaType: 'segment', criteriaValue: 'trial_leads', goal: 20, icon: 'fa-hourglass-half', color: '#10B981' },
    { id: 'ov_subscribed_users', title: 'Subscribed Platform Users', criteriaType: 'segment', criteriaValue: 'subscribed_platform_users', goal: 20, icon: 'fa-check-double', color: '#3B82F6' },
    { id: 'ov_training_leads', title: '3 Day Training Leads', criteriaType: 'segment', criteriaValue: 'training_leads', goal: 30, icon: 'fa-graduation-cap', color: '#F59E0B' },
  ],
  idao: [
    { id: 'id_training', title: '3 Day Training', criteriaType: 'segment', criteriaValue: 'training_leads', goal: 30, icon: 'fa-graduation-cap', color: '#8B5CF6' },
    { id: 'id_optimaviz_referrals', title: 'Optimaviz Referrals', criteriaType: 'segment', criteriaValue: 'optimaviz_referrals', goal: 15, icon: 'fa-project-diagram', color: '#3B82F6' },
    { id: 'id_other_services', title: 'Other Services', criteriaType: 'segment', criteriaValue: 'other_services', goal: 10, icon: 'fa-briefcase', color: '#10B981' },
  ],
  optimaclean: [
    { id: 'oc_corp', title: 'Corporate Contract Accounts', criteriaType: 'segment', criteriaValue: 'clients', goal: 20, icon: 'fa-user-tie', color: '#10B981' },
    { id: 'oc_clean', title: 'Cleaning Service Partners', criteriaType: 'segment', criteriaValue: 'workers', goal: 30, icon: 'fa-broom', color: '#F59E0B' },
  ],
  nestwise: [
    { id: 'nw_airbnb_support', title: 'Airbnb Hosting Support', criteriaType: 'segment', criteriaValue: 'airbnb_hosting_support', goal: 30, icon: 'fa-bed', color: '#FD5C63' },
    { id: 'nw_marketing', title: 'Rental & Sale Marketing', criteriaType: 'segment', criteriaValue: 'property_marketing', goal: 25, icon: 'fa-bullhorn', color: '#2563EB' },
    { id: 'nw_care', title: 'Care & Inspection Requests', criteriaType: 'segment', criteriaValue: 'property_care', goal: 30, icon: 'fa-clipboard-check', color: '#8B5CF6' },
    { id: 'nw_maintenance', title: 'Maintenance & Repairs', criteriaType: 'segment', criteriaValue: 'maintenance_repairs', goal: 20, icon: 'fa-screwdriver-wrench', color: '#F59E0B' },
    { id: 'nw_security', title: 'Security & Emergency Support', criteriaType: 'segment', criteriaValue: 'property_security', goal: 18, icon: 'fa-shield-halved', color: '#10B981' },
    { id: 'nw_photo_value', title: 'Photography & Valuation', criteriaType: 'segment', criteriaValue: 'photo_valuation', goal: 15, icon: 'fa-camera', color: '#0EA5E9' },
  ]
};

export interface SpotlightConfig {
  id: string;
  brandId: string;
  title: string;
  icon: string;
  fieldKeys: string[];
  type: 'groupby' | 'binary' | 'trial';
  binaryTrueLabel?: string;
  binaryFalseLabel?: string;
  deduplicateBy?: string;
  segmentScope?: string[];
  trialDays?: number;
}

export interface SnapshotCardConfig {
  id: string;
  label: string;
  fieldKey: string;
  matchValue?: string;
  target: number;
  unit: string;
  icon: string;
  color: string;
  active?: boolean;
}

export interface NestwiseCardItem {
  id: string;
  label: string;
  fieldKey?: string;
  matchValue?: string;
  color?: string;
}

export interface NestwiseDashboardCard {
  id: string;
  title: string;
  icon: string;
  color: string;
  type: 'metrics' | 'progress' | 'journey';
  items: NestwiseCardItem[];
}

export type SavedLeadView = {
  name: string;
  stage: string;
  search: string;
  segment: string;
  city: string;
  service: string;
  abn: string;
  dateWindow?: DateWindowFilter;
  dateFrom?: string;
  dateTo?: string;
};

export type BrandWorkspaceSnapshot = {
  snapshotCards?: SnapshotCardConfig[];
  customWidgets?: CustomWidget[];
  savedViews?: SavedLeadView[];
  sectionVisibility?: Record<string, boolean>;
  sectionTitles?: Record<string, string>;
  columnVisibility?: string[];
  commandMetrics?: CommandMetricConfig[];
  brandSpotlights?: SpotlightConfig[];
  nestwiseCards?: NestwiseDashboardCard[];
  brandSubTab?: 'leads' | 'sequences' | 'tasks';
  dashboardDensity?: 'comfortable' | 'compact';
};

export type BrandWorkspaceProfile = {
  id: string;
  brandId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
  snapshot: BrandWorkspaceSnapshot;
};

export const DEFAULT_SNAPSHOT_CARDS: Record<string, SnapshotCardConfig[]> = {
  taskgo: [
    { id: 'tg-abn', label: 'Verified ABN Contractors', fieldKey: 'abn_number', target: 40, unit: 'ABNs', icon: 'fa-file-invoice', color: '#10B981', active: true },
    { id: 'tg-platform', label: 'Platform Registered Contractors', fieldKey: 'segment', matchValue: 'all_platform', target: 100, unit: 'Profiles', icon: 'fa-users', color: '#3B82F6', active: true },
    { id: 'tg-total', label: 'Active Roster Pipeline Goals', fieldKey: '__total__', target: 150, unit: 'Total', icon: 'fa-user-clock', color: '#8B5CF6', active: true }
  ],
  idao: [
    { id: 'id-training', label: '3 Day Training', fieldKey: 'segment', matchValue: 'training_leads', target: 30, unit: 'Leads', icon: 'fa-graduation-cap', color: '#8B5CF6', active: true },
    { id: 'id-referrals', label: 'Optimaviz Referrals', fieldKey: 'segment', matchValue: 'optimaviz_referrals', target: 15, unit: 'Leads', icon: 'fa-project-diagram', color: '#3B82F6', active: true },
    { id: 'id-other', label: 'Other Services', fieldKey: 'segment', matchValue: 'other_services', target: 10, unit: 'Leads', icon: 'fa-briefcase', color: '#10B981', active: true }
  ],
  optimaclean: [
    { id: 'oc-clients', label: 'Corporate Client Accounts', fieldKey: 'segment', matchValue: 'clients', target: 25, unit: 'Clients', icon: 'fa-user-tie', color: '#10B981', active: true },
    { id: 'oc-workers', label: 'Partner Cleaner Roster Count', fieldKey: 'segment', matchValue: 'workers', target: 50, unit: 'Cleaners', icon: 'fa-broom', color: '#F59E0B', active: true }
  ],
  nestwise: [
    { id: 'nw-hosting', label: 'Airbnb Hosting Pipeline', fieldKey: 'segment', matchValue: 'airbnb_hosting_support', target: 25, unit: 'Owners', icon: 'fa-bed', color: '#FD5C63', active: true },
    { id: 'nw-marketing', label: 'Marketing Package Leads', fieldKey: 'segment', matchValue: 'property_marketing', target: 25, unit: 'Listings', icon: 'fa-bullhorn', color: '#2563EB', active: true },
    { id: 'nw-care', label: 'Care / Inspection Subscribers', fieldKey: 'segment', matchValue: 'property_care', target: 30, unit: 'Properties', icon: 'fa-clipboard-check', color: '#8B5CF6', active: true },
    { id: 'nw-security', label: 'Security Monitoring Leads', fieldKey: 'segment', matchValue: 'property_security', target: 18, unit: 'Properties', icon: 'fa-shield-halved', color: '#10B981', active: true }
  ]
};

export const DEFAULT_NESTWISE_CARDS: NestwiseDashboardCard[] = [
  {
    id: 'nw_service_pipeline',
    title: 'NextWise Service Pipeline',
    icon: 'fa-layer-group',
    color: '#2563EB',
    type: 'metrics',
    items: [
      { id: 'nw_total', label: 'Total Property Owners', fieldKey: '__owner_leads__', color: '#2563EB' },
      { id: 'nw_service_matched', label: 'Service-Line Leads', fieldKey: '__service_pipeline__', color: '#10B981' },
      { id: 'nw_diaspora_owners', label: 'Diaspora / Remote Owners', fieldKey: '__diaspora_support__', color: '#8B5CF6' },
      { id: 'nw_followups_due', label: 'Follow-Ups Due', fieldKey: '__followups_due__', color: '#EF4444' }
    ]
  },
  {
    id: 'nw_service_mix',
    title: 'Services Being Requested',
    icon: 'fa-grid-2',
    color: '#0EA5E9',
    type: 'progress',
    items: [
      { id: 'nw_airbnb', label: 'Airbnb Hosting Support', fieldKey: 'segment', matchValue: 'airbnb_hosting_support|airbnb_hosts|short_term_rental', color: '#FD5C63' },
      { id: 'nw_marketing', label: 'Rental / Sale Marketing', fieldKey: 'segment', matchValue: 'property_marketing|marketing_leads|house_listings|property_sales', color: '#2563EB' },
      { id: 'nw_care', label: 'Inspections & Property Care', fieldKey: 'segment', matchValue: 'property_care|inspection|diaspora_inspection', color: '#8B5CF6' },
      { id: 'nw_maintenance', label: 'Maintenance & Repairs', fieldKey: 'segment', matchValue: 'maintenance_repairs|maintenance|repairs', color: '#F59E0B' },
      { id: 'nw_security', label: 'Security / Emergency Support', fieldKey: 'segment', matchValue: 'property_security|security|emergency', color: '#10B981' },
      { id: 'nw_photo', label: 'Photography / Valuation', fieldKey: 'segment', matchValue: 'photo_valuation|photography|valuation', color: '#0EA5E9' }
    ]
  },
  {
    id: 'nw_revenue_routes',
    title: 'Revenue Routes',
    icon: 'fa-coins',
    color: '#F59E0B',
    type: 'progress',
    items: [
      { id: 'nw_setup_fees', label: 'Setup Fees', fieldKey: 'revenue_model', matchValue: 'setup fee|setup fees', color: '#FD5C63' },
      { id: 'nw_monthly_support', label: 'Monthly Support / Subscription', fieldKey: '__subscription_opportunities__', color: '#10B981' },
      { id: 'nw_listing_fees', label: 'Listing / Marketing Packages', fieldKey: 'revenue_model', matchValue: 'listing|marketing package|photography package', color: '#2563EB' },
      { id: 'nw_inspection_fees', label: 'Inspection Fees', fieldKey: 'revenue_model', matchValue: 'inspection fee|per inspection', color: '#8B5CF6' },
      { id: 'nw_callouts', label: 'Emergency Call-Outs', fieldKey: '__emergency_response__', color: '#EF4444' }
    ]
  },
  {
    id: 'nw_owner_promise',
    title: 'Owner Control & Reporting',
    icon: 'fa-file-shield',
    color: '#10B981',
    type: 'metrics',
    items: [
      { id: 'nw_owner_control', label: 'Owner Keeps Control', fieldKey: '__owner_control__', color: '#10B981' },
      { id: 'nw_reports_needed', label: 'Needs Reports / Photo Updates', fieldKey: '__reporting_needed__', color: '#0EA5E9' },
      { id: 'nw_missing_phone', label: 'Missing Phone Numbers', fieldKey: '__missing_phone__', color: '#EF4444' }
    ]
  },
  {
    id: 'nw_owner_journey',
    title: 'NextWise Owner Journey',
    icon: 'fa-route',
    color: '#8B5CF6',
    type: 'journey',
    items: [
      { id: 'nw_step_enquire', label: 'New enquiry' },
      { id: 'nw_step_discovery', label: 'Needs discovery' },
      { id: 'nw_step_match', label: 'Match service line' },
      { id: 'nw_step_quote', label: 'Quote / package sent' },
      { id: 'nw_step_approve', label: 'Owner approval' },
      { id: 'nw_step_active', label: 'Active service' },
      { id: 'nw_step_report', label: 'Photo/report update' }
    ]
  }
];

export const DEFAULT_SPOTLIGHTS: Record<string, SpotlightConfig[]> = {
  optimaviz: [
    {
      id: 'opt-trial-countdown',
      brandId: 'optimaviz',
      title: '14-Day Free Trial Tracker',
      icon: 'fas fa-hourglass-half',
      fieldKeys: ['trial_start_date'],
      type: 'trial',
      segmentScope: ['trial_leads']
    },
    {
      id: 'opt-sales-funnel',
      brandId: 'optimaviz',
      title: 'Sales Funnel',
      icon: 'fas fa-filter',
      fieldKeys: ['funnel_stage'],
      type: 'groupby'
    },
    {
      id: 'opt-demo-followup',
      brandId: 'optimaviz',
      title: 'Demo Follow-Up Status',
      icon: 'fas fa-paper-plane',
      fieldKeys: ['follow_up_status'],
      type: 'groupby',
      segmentScope: ['demo_leads']
    },
    {
      id: 'opt-subscribed-plan',
      brandId: 'optimaviz',
      title: 'Subscription Plans',
      icon: 'fas fa-award',
      fieldKeys: ['subscription_plan', 'Plan'],
      type: 'groupby',
      segmentScope: ['subscribed_platform_users']
    }
  ],
  taskgo: [
    {
      id: 'tg-coverage',
      brandId: 'taskgo',
      title: 'Contractor Coverage Areas',
      icon: 'fas fa-map-marker-alt',
      fieldKeys: ['coverage_area', 'city', 'City'],
      type: 'groupby',
      deduplicateBy: 'email'
    },
    {
      id: 'tg-services',
      brandId: 'taskgo',
      title: 'Contractor Service Mix',
      icon: 'fas fa-toolbox',
      fieldKeys: ['service_category_name', 'ServiceCategoryName', 'service_category'],
      type: 'groupby'
    },
    {
      id: 'tg-support-issues',
      brandId: 'taskgo',
      title: 'Client Support Issue Types',
      icon: 'fas fa-headset',
      fieldKeys: ['support_issue_type', 'account_issue', 'issue_type'],
      type: 'groupby',
      segmentScope: ['client_support', 'client_login_help', 'client_followup']
    }
  ],
  idao: [
    {
      id: 'idao-country',
      brandId: 'idao',
      title: 'Lead Countries',
      icon: 'fas fa-globe-africa',
      fieldKeys: ['country'],
      type: 'groupby',
      segmentScope: ['training_leads']
    },
    {
      id: 'idao-job-title',
      brandId: 'idao',
      title: 'Job Titles',
      icon: 'fas fa-user-tie',
      fieldKeys: ['job_title'],
      type: 'groupby',
      segmentScope: ['training_leads']
    },
    {
      id: 'idao-quote-sent',
      brandId: 'idao',
      title: 'Quote Request / Sent Status',
      icon: 'fas fa-file-invoice-dollar',
      fieldKeys: ['quote_status'],
      type: 'groupby',
      segmentScope: ['training_leads']
    },
    {
      id: 'idao-follow-up',
      brandId: 'idao',
      title: 'Follow-Up Status',
      icon: 'fas fa-bell',
      fieldKeys: ['follow_up_status'],
      type: 'groupby',
      segmentScope: ['training_leads', 'optimaviz_referrals', 'other_services']
    }
  ],
  optimaclean: [
    {
      id: 'oc-role',
      brandId: 'optimaclean',
      title: 'Partner / Cleaner Roles',
      icon: 'fas fa-broom',
      fieldKeys: ['cleaner_role', 'role'],
      type: 'groupby'
    },
    {
      id: 'oc-verification',
      brandId: 'optimaclean',
      title: 'Background Check Verification',
      icon: 'fas fa-shield-alt',
      fieldKeys: ['verified', 'verification'],
      type: 'binary',
      binaryTrueLabel: 'Verified Partner',
      binaryFalseLabel: 'Pending Verification'
    }
  ],
  nestwise: [
    {
      id: 'nw-service-lines',
      brandId: 'nestwise',
      title: 'Service Lines',
      icon: 'fas fa-layer-group',
      fieldKeys: ['service_interest', 'segment'],
      type: 'groupby'
    },
    {
      id: 'nw-property-use',
      brandId: 'nestwise',
      title: 'Property Use',
      icon: 'fas fa-house-chimney-window',
      fieldKeys: ['property_use', 'property_type', 'type'],
      type: 'groupby'
    },
    {
      id: 'nw-revenue-routes',
      brandId: 'nestwise',
      title: 'Revenue Routes',
      icon: 'fas fa-coins',
      fieldKeys: ['revenue_model', 'service_package'],
      type: 'groupby'
    },
    {
      id: 'nw-owner-location',
      brandId: 'nestwise',
      title: 'Local vs Diaspora Owners',
      icon: 'fas fa-globe-africa',
      fieldKeys: ['owner_location', 'location', 'property_location'],
      type: 'groupby'
    },
    {
      id: 'nw-reporting',
      brandId: 'nestwise',
      title: 'Reporting Needed',
      icon: 'fas fa-camera',
      fieldKeys: ['reporting_requirement', 'inspection_type'],
      type: 'groupby'
    }
  ]
};

export const EMAIL_TEMPLATES: Record<string, { id: string; name: string; subject: string; body: string; }[]> = {
  optimaviz: [
    { id: 't1', name: 'Optimaviz Onboarding', subject: 'Welcome to Optimaviz, {{name}}!', body: 'Hi {{name}},\n\nThank you for choosing Optimaviz! We are thrilled to help you visualize your operational pipelines with high efficiency.\n\nLet us know if you would like to schedule a quick walk-through.\n\nBest regards,\nThe Optimaviz Team' },
    { id: 't2', name: 'Optimaviz Proposal', subject: 'Your Tailored Analytics Proposal - {{name}}', body: 'Hi {{name}},\n\nBased on our conversation, we have drafted a custom enterprise pipeline analytics plan for your review.\n\nPlease find the PDF link enclosed here: https://optima.crm/proposals/{{leadId}}\n\nKind regards,\nOptimaviz Partnerships' }
  ],
  taskgo: [
    { id: 't3', name: 'TaskGo ABN Validation', subject: 'Urgent: ABN Verification Request - {{name}}', body: 'Hi {{name}},\n\nWe noticed you are registering your contractor services on TaskGo. To make sure you receive payments, could you please verify your Australian Business Number (ABN)?\n\nYou can update this in your dashboard or send it back via this thread.\n\nBest,\nTaskGo Safety & Verification' },
    { id: 't4', name: 'TaskGo Welcoming', subject: 'Welcome to the TaskGo Contractor Roster!', body: 'Hi {{name}},\n\nWelcome! Your specialist service profile is now on TaskGo leads dashboard.\n\nWe are looking forward to helping you expand your services across the major capitals.\n\nSincerely,\nTaskGo Team' },
    { id: 't5', name: 'TaskGo Login Help', subject: 'TaskGo account access support', body: 'Hi {{name}},\n\nThanks for contacting TaskGo. We are checking your account access issue and will help you get back into your dashboard.\n\nPlease reply with any error message you see and the email address you used to sign up.\n\nTaskGo Support' },
    { id: 't6', name: 'TaskGo Complaint Follow-Up', subject: 'Following up on your TaskGo support case', body: 'Hi {{name}},\n\nThanks for raising this with TaskGo. We have logged your support case and are reviewing the details.\n\nWe will follow up with the next step shortly.\n\nTaskGo Support' }
  ],
  idao: [
    { id: 't5', name: 'IDAO Enterprise Demo', subject: 'Scheduled Machine Learning Consultation - {{name}}', body: 'Hi {{name}},\n\nYour session with our Senior Intelligent Data Optimization consultant has been locked in!\n\nWe will review your dataset and discuss the best models for your brand portfolio.\n\nBest,\nIDAO Engineering' }
  ],
  optimaclean: [
    { id: 't6', name: 'OptimaClean Booking Quote', subject: 'Your Onsite Cleaning Assessment Quote', body: 'Hi {{name}},\n\nThank you for requesting an OptimaClean corporate assessment. Our team is available this week to clean/refresh your corporate space.\n\nLet us know if this works for you.\n\nWarm regards,\nOptimaClean Dispatch' }
  ],
  nestwise: [
    { id: 't7', name: 'NextWise Service Discovery', subject: 'NextWise property support options for {{name}}', body: 'Hi {{name}},\n\nThanks for contacting NextWise. We help property owners with Airbnb hosting support, rental and sale marketing, inspections, maintenance, security, photography, valuation support, and reporting.\n\nTo recommend the right option, could you share the property location, property type, current use, and whether you need marketing, care, maintenance, security, or hosting support?\n\nYou remain in full control of bookings, payments, rentals, and sale decisions. NextWise provides the support services and updates around your property.\n\nBest,\nNextWise Team' },
    { id: 't8', name: 'NextWise Care Report Follow-Up', subject: 'Property care and reporting support for {{name}}', body: 'Hi {{name}},\n\nWe can help with occupied, vacant, or diaspora property inspections, condition reports, photo updates, maintenance reporting, and recommended next steps.\n\nIf you would like, we can prepare a property care option based on the inspection frequency and reporting style you prefer.\n\nBest,\nNextWise Team' },
    { id: 't9', name: 'NextWise Marketing Package', subject: 'Marketing support for your property', body: 'Hi {{name}},\n\nNextWise can support your rental, Airbnb, or sale listing with professional photography, advertising, social media marketing, website listings, buyer/renter enquiries, and valuation support.\n\nSend us the property details and preferred goal, and we will suggest the right package.\n\nBest,\nNextWise Team' }
  ]
};

export function OptimaLogo({ size = 48 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 120 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.05))" }}
    >
      <defs>
        <linearGradient id="optimaOrange" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff7e33" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <linearGradient id="optimaBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="optimaInner" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0.1} />
        </linearGradient>
      </defs>

      {/* Main Stylized "O" Loop */}
      <path 
        d="M 60 15 A 45 45 0 0 0 60 105 A 30 30 0 0 1 60 15 Z" 
        fill="url(#optimaOrange)"
        opacity="0.95"
      />
      <path 
        d="M 60 15 A 45 45 0 0 1 60 105 A 30 30 0 0 0 60 15 Z" 
        fill="url(#optimaBlue)"
        opacity="0.95"
      />

      <circle cx="60" cy="60" r="30" fill="none" stroke="url(#optimaInner)" strokeWidth="1.5" opacity="0.4" />

      {/* LEFT SIDE GEOMETRIC NETWORK (Orange nodes represent connected sales lines) */}
      <g stroke="#f97316" strokeWidth="1.2" opacity="0.6">
        <line x1="25" y1="40" x2="35" y2="25" />
        <line x1="25" y1="40" x2="18" y2="60" />
        <line x1="35" y1="25" x2="48" y2="18" />
        <line x1="18" y1="60" x2="28" y2="80" />
        <line x1="28" y1="80" x2="42" y2="92" />
        <line x1="25" y1="40" x2="38" y2="45" />
        <line x1="18" y1="60" x2="34" y2="62" />
        <line x1="28" y1="80" x2="40" y2="72" />
      </g>

      <circle cx="35" cy="25" r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
      <circle cx="25" cy="40" r="5.5" fill="#f97316" stroke="#ffffff" strokeWidth="1" />
      <circle cx="18" cy="60" r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
      <circle cx="28" cy="80" r="5.5" fill="#f97316" stroke="#ffffff" strokeWidth="1" />
      <circle cx="48" cy="18" r="4" fill="#ea580c" stroke="#ffffff" strokeWidth="1" />
      <circle cx="42" cy="92" r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
      <circle cx="38" cy="45" r="3" fill="#ff7e33" />
      <circle cx="34" cy="62" r="3.5" fill="#f59e0b" />
      <circle cx="40" cy="72" r="3" fill="#ef4444" />

      {/* RIGHT SIDE GEOMETRIC NETWORK (Blue nodes represent digital optimizations) */}
      <g stroke="#0284c7" strokeWidth="1.2" opacity="0.6">
        <line x1="95" y1="45" x2="88" y2="30" />
        <line x1="95" y1="45" x2="102" y2="65" />
        <line x1="102" y1="65" x2="92" y2="84" />
        <line x1="92" y1="84" x2="78" y2="90" />
        <line x1="88" y1="30" x2="75" y2="20" />
        <line x1="95" y1="45" x2="82" y2="52" />
        <line x1="102" y1="65" x2="86" y2="70" />
      </g>

      <circle cx="88" cy="30" r="5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
      <circle cx="95" cy="45" r="4" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1" />
      <circle cx="102" cy="65" r="5.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1" />
      <circle cx="92" cy="84" r="4.5" fill="#0284c7" stroke="#ffffff" strokeWidth="1" />
      <circle cx="75" cy="20" r="4" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
      <circle cx="78" cy="90" r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1" />
      <circle cx="82" cy="52" r="3.5" fill="#0ea5e9" />
      <circle cx="86" cy="70" r="3" fill="#2563eb" />
    </svg>
  );
}


export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage is restricted or disabled', e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage is restricted or disabled', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage is restricted or disabled', e);
    }
  }

};
