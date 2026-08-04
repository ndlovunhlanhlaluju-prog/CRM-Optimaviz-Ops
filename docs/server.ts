import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID, createHmac } from 'crypto';
import nodemailer from 'nodemailer';
import { LocalDb, DbUser, DbLead, DbNote, DbCall, DbEmail, DbWhatsApp, DbWhatsAppTemplate, DbMessageTemplate, DbBrandIntegration, DbSequence, DbCustomField, DbEnrollment, DbTask, DbTeamMessage, DbTeamNote, DbUsageEvent } from './src/db/server_db.js';

// ─── Brand config ────────────────────────────────────────────────────────────
// Add new brand behaviour here instead of scattering if/else across routes.
const BRAND_DEFAULTS: Record<string, Record<string, string>> = {
  taskgo: { segment: 'all_platform' },
  idao:   { segment: 'training_leads' },
};

const BRAND_NAMES: Record<string, string> = {
  optimaviz: 'Optimaviz',
  taskgo: 'TaskGo',
  idao: 'IDAO',
  optimaclean: 'OptimaClean',
  nestwise: 'NestWise',
};

const NESTWISE_SEED_LEADS = [
  ['Nobert Moyo', '2026-04-30T13:51:00.000Z', 'nobertmoyo51@gmail.com', '+263780558929', 'payment of rent into my uk account', '', '1 property', 'Bulawayo', '', 'Follow-up Needed'],
  ['Anita Sibanda', '2026-04-30T13:32:00.000Z', 'enitasibanda@gmail.com', '+263774447443', 'no business skill', '', '1 property', 'Bulawayo', '', 'Follow-up Needed'],
  ['Adelaide Tabvuma Muchetu', '2026-04-30T13:17:00.000Z', 'adelaide.muchetu@gmail.com', '', 'maintenance', '', '1 property', 'Bulawayo', '', 'Follow-up Needed'],
  ['James Tau Makumbe', '2026-04-30T05:46:00.000Z', '', '+2637726033333', 'Getting guests clients', '', '1 property', 'Avondale', '', 'Follow-up Needed'],
  ['Tkay official', '2026-04-27T15:00:00.000Z', '', '+263774558135', 'money', '', '1 property', 'Domboshava', '', 'Follow-up Needed'],
  ['Dagger', '2026-04-27T12:09:00.000Z', 'eniasgokuda@gmail.com', '+263783822266 / +263783822277', 'Lack of money', '', '1 property', 'masvingo', '', 'Follow-up Needed'],
  ['Esther Paul', '2026-04-26T22:44:00.000Z', 'estherpaulm@gmail.com', '+263772609458', "I can't seem to get clients", 'Needs guidance in choosing', '1 property', 'Borrowdale West', '2026-08-23', 'Follow-up Needed'],
  ['Vincent Malaba Ncube', '2026-04-26T10:50:00.000Z', 'vncube59@gmail.com', '+9459946673', 'I am far away', '', '1 property', 'Zimbabwe', '', 'Follow-up Needed'],
  ['Olivia Nyamwanza', '2026-04-12T16:53:00.000Z', 'tashiko10@yahoo.co.uk', '+263772313306', 'Need to fill up the calendar. ie booked 100%', 'BASIC PLAN - $50/month', '1 property', 'Greendale', '2026-05-01', 'Onboard'],
  ['Lovemore Kuveya', '2026-04-12T00:00:00.000Z', 'mrkuveya@gmail.com', '+263773587119', 'Finding customers', '', '1 property', 'Norton', '', 'Follow-up Needed'],
  ['Ndabezinhle Ncube', '2026-04-11T22:16:00.000Z', 'ncubend@gmail.com', '+263772573262', 'Management and marketing', 'BASIC PLAN - $50/month', '1 property', 'Bulawayo', '2026-07-01', 'Onboard'],
  ['Dr Kwazi Zodwa Magwenzi', '2026-04-10T22:18:00.000Z', 'kwazimag@yahoo.com', '+27713188861', 'AirBNB Management', '', '1 property', 'Bulawayo', '', 'Follow-up Needed'],
  ['Mkhululi Ncube', '2026-04-10T22:18:00.000Z', 'mkayz89@gmail.com', '+971555967105', 'AirBNB Management', 'BASIC PLAN - $50/month', '1 property', 'Bulawayo', '2026-05-01', 'Onboard'],
] as const;

const WEBSITE_INTAKE_CONFIG: Record<string, { allowedCustomFields: string[]; defaultSource: string }> = {
  taskgo: {
    defaultSource: 'TaskGo Website',
    allowedCustomFields: [
      'segment',
      'service_category',
      'service_category_name',
      'abn_number',
      'provider_status',
      'verification_status',
      'documents_status',
      'coverage_area',
      'availability_status',
      'hourly_rate',
      'city',
      'state',
      'suburb',
      'postcode',
      'country',
      'support_issue_type',
      'support_status',
      'support_priority',
      'account_issue',
      'ticket_type',
      'login_issue',
      'last_follow_up_date',
    ],
  },
  idao: {
    defaultSource: 'IDAO Website',
    allowedCustomFields: [
      'segment',
      'course_interest',
      'training_date',
      'company',
      'country',
      'city',
      'attendance_type',
      'payment_status',
      'quote_status',
    ],
  },
  nestwise: {
    defaultSource: 'NestWise Website',
    allowedCustomFields: [
      'segment',
      'property_type',
      'service_interest',
      'service_focus',
      'enquiry',
      'message',
      'request_details',
      'property_location',
      'property_address',
      'owner_location',
      'owner_type',
      'property_use',
      'service_package',
      'revenue_model',
      'inspection_type',
      'maintenance_category',
      'security_frequency',
      'emergency_type',
      'reporting_requirement',
      'owner_retains_control',
      'next_service_date',
      'follow_up_status',
      'location',
      'city',
      'suburb',
      'budget_range',
      'preferred_contact_time',
    ],
  },
  optimaviz: {
    defaultSource: 'Optimaviz Website',
    allowedCustomFields: [
      'segment',
      'company',
      'business_category',
      'demo_request',
      'trial_status',
      'subscription_plan',
      'service_focus',
      'follow_up_status',
    ],
  },
  optimaclean: {
    defaultSource: 'OptimaClean Website',
    allowedCustomFields: [
      'segment',
      'service_type',
      'property_type',
      'city',
      'suburb',
      'cleaning_frequency',
      'preferred_date',
    ],
  },
};

// ─── Input validation helpers ────────────────────────────────────────────────
function sanitizeString(val: unknown, maxLen = 500): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

function sanitizeLead(body: Record<string, any>) {
  return {
    name:          sanitizeString(body.name, 120),
    email:         sanitizeString(body.email, 254).toLowerCase(),
    phone:         sanitizeString(body.phone, 30),
    notes:         sanitizeString(body.notes, 2000),
    brand_id:      sanitizeString(body.brand_id, 40),
    brand_name:    sanitizeString(body.brand_name, 80),
    funnel_stage:  sanitizeString(body.funnel_stage, 80),
    owner_id:      sanitizeString(body.owner_id, 60),
    owner_name:    sanitizeString(body.owner_name, 120),
    tags:          Array.isArray(body.tags) ? body.tags.map((t: any) => sanitizeString(t, 50)) : [],
    custom_fields: sanitizeCustomFields(body.custom_fields),
  };
}

function sanitizeCustomFields(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[sanitizeString(k, 60)] = sanitizeString(v, 500);
  }
  return out;
}

function slugId(val: string): string {
  return sanitizeString(val, 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || randomUUID();
}

function classifyNestWiseService(input: string | Record<string, string>): string {
  const text = typeof input === 'string' ? input.toLowerCase() : Object.values(input).join(' ').toLowerCase();
  if (/(airbnb|short[-\s]?term|guest|check[-\s]?in|check[-\s]?out|linen|occupancy|hosting)/i.test(text)) return 'airbnb_hosting_support';
  if (/(security|patrol|perimeter|access point|break[-\s]?in|trespass|vandal|alarm|storm|emergency)/i.test(text)) return 'property_security';
  if (/(maintenance|repair|plumb|electric|handyman|paint|garden|cleaning|borehole|pump|solar)/i.test(text)) return 'maintenance_repairs';
  if (/(inspection|condition report|photo report|vacant|occupied|diaspora|property care|oversight|maintenance report)/i.test(text)) return 'property_care';
  if (/(marketing|advertis|listing|rental|sale|sell|buyer|lead generation|social media|website listing)/i.test(text)) return 'property_marketing';
  if (/(photo|photography|valuation|value support)/i.test(text)) return 'photo_valuation';
  return 'property_care';
}

function nestWiseServiceLabel(segment: string): string {
  const labels: Record<string, string> = {
    airbnb_hosting_support: 'Airbnb Hosting Support',
    property_marketing: 'Rental & Sale Marketing',
    property_care: 'Property Care & Inspections',
    maintenance_repairs: 'Maintenance & Repairs',
    property_security: 'Security & Emergency Support',
    photo_valuation: 'Photography & Valuation Support',
  };
  return labels[segment] || 'Property Owner Support';
}

function deriveNestWiseRevenueModel(segment: string): string {
  const models: Record<string, string> = {
    airbnb_hosting_support: 'Setup fees / monthly hosting support subscription',
    property_marketing: 'Listing fees / marketing packages / photography packages',
    property_care: 'Per inspection fees / property care subscriptions',
    maintenance_repairs: 'Pay-per-visit service fees / monthly maintenance plan',
    property_security: 'Security monitoring subscriptions / emergency call-out fees',
    photo_valuation: 'Photography package / valuation support package',
  };
  return models[segment] || 'Service fee / support package';
}

function deriveNestWisePropertyUse(fields: Record<string, string>, segment: string): string {
  const text = Object.values(fields).join(' ').toLowerCase();
  if (segment === 'airbnb_hosting_support' || /(airbnb|short[-\s]?term)/i.test(text)) return 'Airbnb / short-term rental';
  if (/(sale|sell|buyer|valuation)/i.test(text)) return 'Sale marketing';
  if (/(long[-\s]?term|rental|tenant)/i.test(text)) return 'Rental marketing';
  if (/(vacant|security|monitoring)/i.test(text)) return 'Vacant property support';
  if (/(occupied|inspection)/i.test(text)) return 'Occupied property support';
  return fields.property_use || 'Owner support service';
}

function deriveNestWiseOwnerLocation(fields: Record<string, string>): string {
  const text = Object.values(fields).join(' ').toLowerCase();
  if (/(diaspora|overseas|outside|australia|uk|united kingdom|south africa|botswana|canada|usa|united states|new zealand)/i.test(text)) return fields.owner_location || 'Diaspora / remote owner';
  return fields.owner_location || fields.location || fields.city || 'Local owner';
}

function normalizeNestWiseFields(fields: Record<string, string>): void {
  if (fields.message && !fields.enquiry) fields.enquiry = fields.message;
  if (fields.request_details && !fields.enquiry) fields.enquiry = fields.request_details;
  if (fields.service_focus && !fields.service_interest) fields.service_interest = fields.service_focus;
  if (fields.location && !fields.property_location) fields.property_location = fields.location;
  if (fields.property_address && !fields.property_location) fields.property_location = fields.property_address;
  const segment = fields.segment || classifyNestWiseService(fields);
  fields.segment = segment;
  fields.service_interest = fields.service_interest || nestWiseServiceLabel(segment);
  fields.service_package = fields.service_package || nestWiseServiceLabel(segment);
  fields.revenue_model = fields.revenue_model || deriveNestWiseRevenueModel(segment);
  fields.property_use = fields.property_use || deriveNestWisePropertyUse(fields, segment);
  fields.owner_location = deriveNestWiseOwnerLocation(fields);
  fields.owner_type = fields.owner_type || (fields.owner_location.toLowerCase().includes('diaspora') || fields.owner_location.toLowerCase().includes('remote') ? 'Diaspora / remote' : 'Local');
  fields.owner_retains_control = fields.owner_retains_control || 'Yes - owner controls bookings, payments, rentals, and sales';
  fields.reporting_requirement = fields.reporting_requirement || 'Photo updates / service reports';
  fields.follow_up_status = fields.follow_up_status || 'Needs discovery';
  delete fields.message;
  delete fields.request_details;
  delete fields.service_focus;
  delete fields.property_address;
}

function ensureNestWiseSeedLeads(db: LocalDb, createdBy = 'System') {
  const fieldDefs: Array<[string, string, string]> = [
    ['nw-lead-date', 'lead_date', 'date'],
    ['nw-service-interest', 'service_interest', 'text'],
    ['nw-enquiry', 'enquiry', 'text'],
    ['nw-plan', 'plan', 'text'],
    ['nw-property-count', 'property_count', 'text'],
    ['nw-property-location', 'property_location', 'text'],
    ['nw-property-type', 'property_type', 'text'],
    ['nw-property-use', 'property_use', 'text'],
    ['nw-owner-location', 'owner_location', 'text'],
    ['nw-owner-type', 'owner_type', 'text'],
    ['nw-service-package', 'service_package', 'text'],
    ['nw-revenue-model', 'revenue_model', 'text'],
    ['nw-reporting-requirement', 'reporting_requirement', 'text'],
    ['nw-owner-retains-control', 'owner_retains_control', 'text'],
    ['nw-next-service-date', 'next_service_date', 'date'],
    ['nw-plan-start-date', 'plan_start_date', 'date'],
    ['nw-follow-up-status', 'follow_up_status', 'text'],
    ['nw-source', 'source', 'text'],
    ['nw-website-segment', 'website_segment', 'text'],
  ];
  db.get().custom_fields ||= [];
  for (const [id, field_name, field_type] of fieldDefs) {
    if (!db.get().custom_fields.some(f => f.brand_id === 'nestwise' && f.field_name === field_name)) {
      db.get().custom_fields.push({ id, brand_id: 'nestwise', field_name, field_type, required: false } as DbCustomField);
    }
  }

  let added = 0;
  let updated = 0;
  for (const row of NESTWISE_SEED_LEADS) {
    const [name, leadDate, email, phone, enquiry, plan, propertyCount, location, planStartDate, followUpStatus] = row;
    const serviceInterest = classifyNestWiseService(enquiry);
    const cleanEmail = sanitizeString(email, 254).toLowerCase();
    const cleanPhone = sanitizeString(phone, 60);
    const normalizedFields: Record<string, string> = {
      lead_date: leadDate,
      enquiry,
      plan,
      property_count: propertyCount,
      property_location: location,
      plan_start_date: planStartDate,
      next_service_date: planStartDate,
      follow_up_status: followUpStatus,
      source: 'NestWise leads spreadsheet',
      website_segment: serviceInterest,
      segment: serviceInterest,
    };
    normalizeNestWiseFields(normalizedFields);
    const existing = db.get().leads.find(l => l.brand_id === 'nestwise' && (
      l.id === `lead-nestwise-${slugId(name)}` ||
      (cleanEmail && l.email === cleanEmail) ||
      (cleanPhone && l.phone === cleanPhone)
    ));
    const payload: DbLead = {
      id: existing?.id || `lead-nestwise-${slugId(name)}`,
      brand_id: 'nestwise',
      brand_name: 'NestWise',
      name,
      email: cleanEmail,
      phone: cleanPhone,
      funnel_stage: followUpStatus.toLowerCase().includes('onboard') ? 'Owner Approved' : 'New Enquiry',
      notes: enquiry,
      tags: ['NestWise', nestWiseServiceLabel(serviceInterest), location].filter(Boolean),
      custom_fields: normalizedFields,
      owner_id: 'admin-1',
      owner_name: 'Mthokozisi Gatsheni',
      created_at: leadDate,
    };
    if (existing) {
      Object.assign(existing, payload, { id: existing.id, created_at: existing.created_at || payload.created_at });
      updated++;
    } else {
      db.get().leads.push(payload);
      db.get().notes.push({
        id: `note-nestwise-import-${slugId(name)}`,
        lead_id: payload.id,
        content: `Imported from NestWise spreadsheet. Enquiry: ${enquiry || 'None provided'}`,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      });
      added++;
    }
  }
  if (added || updated) db.save();
  return { added, updated, total: db.get().leads.filter(l => l.brand_id === 'nestwise').length };
}

function parseLeadDateInput(value: unknown): string | null {
  const raw = sanitizeString(value, 120);
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    if (raw.length >= 12) {
      const asMs = new Date(numeric);
      if (!Number.isNaN(asMs.getTime())) return asMs.toISOString();
    }
    if (raw.length === 10 && numeric > 1000000000) {
      const asSeconds = new Date(numeric * 1000);
      if (!Number.isNaN(asSeconds.getTime())) return asSeconds.toISOString();
    }
    if (numeric > 20000 && numeric < 80000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const excelDate = new Date(excelEpoch + numeric * 86400000);
      if (!Number.isNaN(excelDate.getTime())) return excelDate.toISOString();
    }
  }

  const ymd = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getLeadSortTime(lead: DbLead): number {
  const sourceDate =
    lead.custom_fields?.lead_date ||
    lead.custom_fields?.source_created_at ||
    lead.custom_fields?.date_created ||
    lead.custom_fields?.created_date ||
    lead.custom_fields?.date_joined ||
    lead.custom_fields?.joined_date ||
    lead.custom_fields?.submitted_at ||
    lead.custom_fields?.submission_date ||
    lead.created_at;
  const parsed = parseLeadDateInput(sourceDate);
  return parsed ? new Date(parsed).getTime() : 0;
}

// ─── Deduplication helper ─────────────────────────────────────────────────────
function findExistingLead(db: LocalDb, email: string, brandId: string): DbLead | undefined {
  if (!email) return undefined;
  return db.get().leads.find(
    l => l.email.toLowerCase() === email.toLowerCase() && l.brand_id === brandId
  );
}

function normalizePhone(phone: string): string {
  return sanitizeString(phone, 40).replace(/[^\d+]/g, '');
}

function findExistingLeadByContact(db: LocalDb, email: string, phone: string, brandId: string): DbLead | undefined {
  const cleanEmail = sanitizeString(email, 254).toLowerCase();
  const cleanPhone = normalizePhone(phone);
  return db.get().leads.find(l => {
    if (l.brand_id !== brandId) return false;
    const emailMatch = cleanEmail && l.email && l.email.toLowerCase() === cleanEmail;
    const phoneMatch = cleanPhone && normalizePhone(l.phone) === cleanPhone;
    return Boolean(emailMatch || phoneMatch);
  });
}

function parseWebsiteIntakeKeys(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const addKey = (brandId: string, key: string) => {
    const cleanBrandId = sanitizeString(brandId, 40).toLowerCase();
    const cleanKey = sanitizeString(key, 200);
    if (!cleanBrandId || !cleanKey) return;
    if (!out[cleanBrandId]) out[cleanBrandId] = [];
    out[cleanBrandId].push(cleanKey);
  };

  for (const brandId of Object.keys(WEBSITE_INTAKE_CONFIG)) {
    const envKey = process.env[`WEBSITE_INTAKE_KEY_${brandId.toUpperCase()}`];
    if (envKey) envKey.split(',').forEach(k => addKey(brandId, k));
  }

  const packed = process.env.WEBSITE_INTAKE_KEYS;
  if (packed) {
    try {
      const parsed = JSON.parse(packed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed as Record<string, unknown>).forEach(([brandId, value]) => {
          if (Array.isArray(value)) value.forEach(k => addKey(brandId, String(k)));
          else addKey(brandId, String(value));
        });
      }
    } catch {
      packed.split(',').forEach(pair => {
        const [brandId, key] = pair.split(':');
        addKey(brandId, key);
      });
    }
  }

  return out;
}

function getWebsiteIntakeKey(req: express.Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7).trim();
  return sanitizeString(req.headers['x-crm-intake-key'], 200);
}

function filterBrandCustomFields(brandId: string, rawFields: Record<string, string>): { accepted: Record<string, string>; ignored: string[] } {
  const config = WEBSITE_INTAKE_CONFIG[brandId];
  const allowed = new Set([...(config?.allowedCustomFields || []), ...Object.keys(BRAND_DEFAULTS[brandId] || {})]);
  const accepted: Record<string, string> = {};
  const ignored: string[] = [];

  for (const [key, value] of Object.entries(rawFields)) {
    if (allowed.has(key)) accepted[key] = value;
    else ignored.push(key);
  }

  return { accepted, ignored };
}

function normalizeImportedCustomFields(brandId: string, fields: Record<string, string>): Record<string, string> {
  const next = { ...fields };
  if (brandId === 'idao') {
    const quoteStatus = String(next.quote_status || '').trim().toLowerCase();
    if (['true', 'yes', '1', 'sent'].includes(quoteStatus)) next.quote_status = 'Quote Sent';
    if (['false', 'no', '0'].includes(quoteStatus)) next.quote_status = 'Quote Requested';
    if (next.service_type && !next.service_focus) next.service_focus = next.service_type;
    delete next.service_type;
    delete next.quote_sent;
    delete next.quote_requested;
    delete next.registration_confirmed;
    delete next.follow_up_method;
    delete next.follow_up_reason;
    delete next.created_date;
    delete next.form_name;
    delete next.name_secondary;
    delete next['Country/Region'];
    delete next['Company name'];
    delete next['Job title'];
    delete next['Quote Sent Via Email'];
  }
  if (brandId === 'nestwise') {
    normalizeNestWiseFields(next);
  }
  return next;
}

function ensureBrandCustomFieldDefinitions(db: LocalDb, brandId: string, fields: Record<string, string>): void {
  const existing = new Set(
    db.get().custom_fields
      .filter(f => f.brand_id === brandId)
      .map(f => f.field_name.toLowerCase())
  );

  for (const fieldName of Object.keys(fields)) {
    const cleanFieldName = sanitizeString(fieldName, 60);
    if (!cleanFieldName || existing.has(cleanFieldName.toLowerCase())) continue;
    db.get().custom_fields.push({
      id: newId('col'),
      brand_id: brandId,
      field_name: cleanFieldName,
      field_type: 'text',
      required: false,
    });
    existing.add(cleanFieldName.toLowerCase());
  }
}

// ─── ID generation ─────────────────────────────────────────────────────────
function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function brandEnvPrefix(brandId: string): string {
  return sanitizeString(brandId, 40).replace(/[^a-z0-9]/gi, '_').toUpperCase();
}

function normalizeWhatsAppDigits(value: unknown): string {
  return sanitizeString(value, 60).replace(/\D/g, '');
}

function getBrandIntegration(db: LocalDb, brandId: string): DbBrandIntegration | undefined {
  return (db.get().brand_integrations || []).find(i => i.brand_id === brandId);
}

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GOOGLE_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const MICROSOFT_GRAPH_SCOPES = 'offline_access openid email profile User.Read Mail.Read Mail.Send';
const microsoftOAuthStates = new Map<string, { brandId: string; userId: string; createdAt: number }>();

function getPublicBaseUrl(req: express.Request): string {
  return sanitizeString(process.env.PUBLIC_CRM_URL || `${req.protocol}://${req.get('host')}`, 300).replace(/\/$/, '');
}

function getGmailRedirectUri(req: express.Request): string {
  return sanitizeString(process.env.GOOGLE_REDIRECT_URI || `${getPublicBaseUrl(req)}/api/integrations/gmail/callback`, 500);
}

function getGmailOAuthConfig(req: express.Request) {
  return {
    clientId: sanitizeString(process.env.GOOGLE_CLIENT_ID || '', 500),
    clientSecret: sanitizeString(process.env.GOOGLE_CLIENT_SECRET || '', 500),
    redirectUri: getGmailRedirectUri(req),
  };
}

function getMicrosoftRedirectUri(req: express.Request): string {
  return sanitizeString(process.env.MICROSOFT_REDIRECT_URI || `${getPublicBaseUrl(req)}/api/integrations/outlook/callback`, 500);
}

function getMicrosoftOAuthConfig(req: express.Request) {
  return {
    clientId: sanitizeString(process.env.MICROSOFT_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID || '', 500),
    clientSecret: sanitizeString(process.env.MICROSOFT_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET || '', 500),
    tenant: sanitizeString(process.env.MICROSOFT_TENANT_ID || 'common', 120),
    redirectUri: getMicrosoftRedirectUri(req),
  };
}

function getFrontendBaseUrl(req: express.Request): string {
  const envUrl = sanitizeString(process.env.FRONTEND_URL || process.env.APP_BASE_URL || '', 300);
  if (envUrl) return envUrl.replace(/\/$/, '');
  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  if (origin) return origin;
  return sanitizeString(process.env.PUBLIC_CRM_URL || '', 300).replace(/\/$/, '');
}

function sanitizeReturnTo(value: unknown, fallback = '/'): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      if (!['http:', 'https:'].includes(url.protocol)) return fallback;
      if (/javascript:|data:/.test(raw)) return fallback;
      return raw.split('?')[0].split('#')[0] || fallback;
    } catch {
      return fallback;
    }
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (/javascript:|data:|\r|\n/.test(raw)) return fallback;
  return raw.split('?')[0].split('#')[0] || fallback;
}

function extractReturnTo(req: express.Request): string {
  const bodyReturnTo = String(req.body?.return_to || '').trim();
  if (bodyReturnTo) {
    const sanitized = sanitizeReturnTo(bodyReturnTo);
    if (sanitized !== '/') return sanitized;
  }
  const referer = String(req.headers.referer || '').trim();
  if (referer) {
    try {
      const url = new URL(referer);
      const path = sanitizeReturnTo(url.pathname + url.search);
      if (path && path !== '/') return path;
    } catch { /* ignore */ }
  }
  const queryReturnTo = sanitizeReturnTo(req.query?.return_to);
  if (queryReturnTo !== '/') return queryReturnTo;
  return '/';
}

function createGmailState(brandId: string, userId: string, returnTo: string): string {
  const payload = {
    brandId: sanitizeString(brandId, 40),
    userId: sanitizeString(userId, 40),
    returnTo: sanitizeReturnTo(returnTo, '/'),
    ts: Date.now(),
  };
  const data = JSON.stringify(payload);
  const secret = sanitizeString(process.env.OAUTH_STATE_SECRET || process.env.DATA_ENCRYPTION_KEY || '', 100);
  let signature = '';
  if (secret) {
    try {
      signature = createHmac('sha256', secret).update(data).digest('base64url');
    } catch { /* ignore */ }
  }
  const token = { d: data, s: signature };
  return Buffer.from(JSON.stringify(token)).toString('base64url');
}

function decodeGmailState(state: string): { brandId: string; userId: string; returnTo: string; ts: number } | null {
  try {
    const token = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    if (!token?.d) return null;
    const payload = JSON.parse(token.d);
    if (!payload?.brandId || !payload?.userId || !payload?.returnTo) return null;
    const secret = sanitizeString(process.env.OAUTH_STATE_SECRET || process.env.DATA_ENCRYPTION_KEY || '', 100);
    if (secret && token.s) {
      try {
        const expectedSig = createHmac('sha256', secret).update(token.d).digest('base64url');
        if (expectedSig !== token.s) return null;
      } catch { /* ignore */ }
    }
    if (Date.now() - Number(payload.ts || 0) > 10 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
  const current = db.get().brand_integrations || [];
  const idx = current.findIndex(i => i.brand_id === brandId);
  const existing = idx >= 0 ? current[idx] : undefined;
  const next: DbBrandIntegration = {
    id: existing?.id || newId('integration'),
    email_provider: existing?.email_provider || 'internal',
    email_sender_name: existing?.email_sender_name || '',
    email_sender_address: existing?.email_sender_address || '',
    email_reply_to: existing?.email_reply_to || '',
    email_logo_url: existing?.email_logo_url || '',
    email_signature: existing?.email_signature || '',
    smtp_host: existing?.smtp_host || '',
    smtp_port: existing?.smtp_port || '',
    smtp_secure: Boolean(existing?.smtp_secure),
    smtp_username: existing?.smtp_username || '',
    smtp_password_env: existing?.smtp_password_env || '',
    email_accounts: existing?.email_accounts || [],
    whatsapp_provider: existing?.whatsapp_provider || 'manual',
    whatsapp_number: existing?.whatsapp_number || '',
    whatsapp_phone_number_id: existing?.whatsapp_phone_number_id || '',
    whatsapp_business_account_id: existing?.whatsapp_business_account_id || '',
    whatsapp_access_token_env: existing?.whatsapp_access_token_env || '',
    whatsapp_verify_token: existing?.whatsapp_verify_token || '',
    whatsapp_profile_name: existing?.whatsapp_profile_name || '',
    whatsapp_profile_about: existing?.whatsapp_profile_about || '',
    whatsapp_profile_picture_url: existing?.whatsapp_profile_picture_url || '',
    whatsapp_business_category: existing?.whatsapp_business_category || '',
    whatsapp_business_website: existing?.whatsapp_business_website || '',
    call_provider: existing?.call_provider || 'manual',
    call_number: existing?.call_number || '',
    automation_enabled: Boolean(existing?.automation_enabled),
    ...existing,
    ...patch,
    brand_id: brandId,
    updated_at: new Date().toISOString(),
  };
  if (idx >= 0) current[idx] = next; else current.push(next);
  db.get().brand_integrations = current;
  return next;
}

function sanitizeEmailAccounts(raw: any): DbBrandIntegration['email_accounts'] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((account, index) => ({
    id: sanitizeString(account?.id || `email_account_${Date.now()}_${index}`, 80),
    label: sanitizeString(account?.label || account?.email || `Email account ${index + 1}`, 120),
    provider: sanitizeString(account?.provider || 'outlook', 30),
    email: sanitizeString(account?.email || '', 254).toLowerCase(),
    reply_to: sanitizeString(account?.reply_to || '', 254).toLowerCase(),
    smtp_host: sanitizeString(account?.smtp_host || '', 200),
    smtp_port: sanitizeString(account?.smtp_port || '', 8),
    smtp_secure: Boolean(account?.smtp_secure),
    smtp_username: sanitizeString(account?.smtp_username || account?.email || '', 254),
    smtp_password_env: sanitizeString(account?.smtp_password_env || '', 120),
    is_default: Boolean(account?.is_default),
  })).filter(account => account.email || account.provider === 'gmail');
}

function getEmailAccountForSend(integration: DbBrandIntegration | undefined, accountId?: string) {
  if (!integration) return null;
  if (accountId === 'gmail_oauth' && (integration.gmail_refresh_token || integration.gmail_connected_email)) {
    return {
      id: 'gmail_oauth',
      label: integration.gmail_connected_email || 'Connected Gmail',
      provider: 'gmail',
      email: integration.gmail_connected_email || integration.email_sender_address || '',
      reply_to: integration.email_reply_to || integration.gmail_connected_email || '',
      is_default: integration.email_provider === 'gmail',
    };
  }
  if (accountId === 'outlook_oauth' && (integration.outlook_refresh_token || integration.outlook_connected_email)) {
    return {
      id: 'outlook_oauth',
      label: integration.outlook_connected_email || 'Connected Outlook',
      provider: 'outlook',
      email: integration.outlook_connected_email || integration.email_sender_address || '',
      reply_to: integration.email_reply_to || integration.outlook_connected_email || '',
      is_default: integration.email_provider === 'outlook',
    };
  }
  const accounts = integration.email_accounts || [];
  return accounts.find(account => account.id === accountId)
    || accounts.find(account => account.is_default)
    || accounts[0]
    || null;
}

async function exchangeGoogleCodeForToken(code: string, req: express.Request) {
  const config = getGmailOAuthConfig(req);
  const params = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Google token exchange failed');
  return data;
}

async function refreshGmailAccessToken(db: LocalDb, brandId: string, req: express.Request): Promise<string> {
  const integration = getBrandIntegration(db, brandId);
  if (!integration?.gmail_refresh_token) throw new Error('Gmail is not connected for this brand.');

  const expiry = integration.gmail_token_expiry ? new Date(integration.gmail_token_expiry).getTime() : 0;
  if (integration.gmail_access_token && expiry > Date.now() + 60000) return integration.gmail_access_token;

  const config = getGmailOAuthConfig(req);
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: integration.gmail_refresh_token,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Could not refresh Gmail token');

  const tokenExpiry = new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString();
  upsertBrandIntegration(db, brandId, {
    gmail_access_token: sanitizeString(data.access_token || '', 4000),
    gmail_token_expiry: tokenExpiry,
  });
  db.save();
  return sanitizeString(data.access_token || '', 4000);
}

async function exchangeMicrosoftCodeForToken(code: string, req: express.Request) {
  const config = getMicrosoftOAuthConfig(req);
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Microsoft token exchange failed');
  return data;
}

async function refreshOutlookAccessToken(db: LocalDb, brandId: string, req: express.Request): Promise<string> {
  const integration = getBrandIntegration(db, brandId);
  if (!integration?.outlook_refresh_token) throw new Error('Outlook is not connected for this brand.');

  const expiry = integration.outlook_token_expiry ? new Date(integration.outlook_token_expiry).getTime() : 0;
  if (integration.outlook_access_token && expiry > Date.now() + 60000) return integration.outlook_access_token;

  const config = getMicrosoftOAuthConfig(req);
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: integration.outlook_refresh_token,
    grant_type: 'refresh_token',
    scope: MICROSOFT_GRAPH_SCOPES,
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Could not refresh Outlook token');

  const tokenExpiry = new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString();
  upsertBrandIntegration(db, brandId, {
    outlook_access_token: sanitizeString(data.access_token || '', 4000),
    outlook_refresh_token: sanitizeString(data.refresh_token || integration.outlook_refresh_token || '', 4000),
    outlook_token_expiry: tokenExpiry,
  });
  db.save();
  return sanitizeString(data.access_token || '', 4000);
}

function encodeMimeMessage(message: string): string {
  return Buffer.from(message, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: unknown): string {
  const input = sanitizeString(value || '', 200000);
  if (!input) return '';
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  try {
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function stripHtml(value: string): string {
  return sanitizeString(value, 50000)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function gmailHeaders(message: any): Record<string, string> {
  const out: Record<string, string> = {};
  (message?.payload?.headers || []).forEach((h: any) => {
    const name = sanitizeString(h?.name || '', 80).toLowerCase();
    if (name) out[name] = sanitizeString(h?.value || '', 2000);
  });
  return out;
}

function extractEmailAddress(value: unknown): string {
  const raw = sanitizeString(value || '', 1000);
  const match = raw.match(/<([^<>@\s]+@[^<>\s]+)>/) || raw.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return sanitizeString(match?.[1] || '', 254).toLowerCase();
}

function gmailBody(payload: any): string {
  const parts: any[] = [];
  const walk = (part: any) => {
    if (!part) return;
    parts.push(part);
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  const html = parts.find(p => p.mimeType === 'text/html' && p.body?.data);
  const text = parts.find(p => p.mimeType === 'text/plain' && p.body?.data);
  if (html) return decodeBase64Url(html.body.data);
  if (text) return decodeBase64Url(text.body.data).replace(/\n/g, '<br />');
  return '';
}

function flattenGmailParts(payload: any): any[] {
  const parts: any[] = [];
  const walk = (part: any) => {
    if (!part) return;
    parts.push(part);
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return parts;
}

function gmailAttachments(payload: any) {
  return flattenGmailParts(payload)
    .filter(part => part?.filename && part?.body?.attachmentId)
    .map(part => ({
      id: sanitizeString(part.body.attachmentId, 300),
      name: sanitizeString(part.filename, 300),
      mime_type: sanitizeString(part.mimeType || '', 120),
      size: Number(part.body.size || 0),
      provider: 'gmail',
    }));
}

function cleanMailHeader(value: unknown, max = 300): string {
  return sanitizeString(value, max).replace(/[\r\n]+/g, ' ').trim();
}

type OutgoingEmailAttachment = {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  data_base64: string;
};

function wrapBase64(value: string): string {
  return value.replace(/(.{76})/g, '$1\r\n');
}

function cleanAttachmentFilename(value: unknown): string {
  return cleanMailHeader(value || 'attachment', 180).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'attachment';
}

function sanitizeOutgoingEmailAttachments(raw: unknown): OutgoingEmailAttachment[] {
  if (!Array.isArray(raw)) return [];
  const attachments: OutgoingEmailAttachment[] = [];
  let totalBytes = 0;

  for (const item of raw.slice(0, 10)) {
    const dataBase64 = String(item?.data_base64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/[^A-Za-z0-9+/=]/g, '');
    if (!dataBase64) continue;
    const size = Number(item?.size || Math.floor((dataBase64.length * 3) / 4));
    if (!Number.isFinite(size) || size <= 0) continue;
    totalBytes += size;
    if (totalBytes > 20 * 1024 * 1024) {
      throw new Error('Email attachments must be 20MB or less in total.');
    }
    attachments.push({
      id: newId('att'),
      name: cleanAttachmentFilename(item?.name),
      mime_type: sanitizeString(item?.mime_type || 'application/octet-stream', 120),
      size,
      data_base64: dataBase64,
    });
  }

  return attachments;
}

function emailAttachmentMetadata(attachments: OutgoingEmailAttachment[]) {
  return attachments.map(file => ({
    id: file.id,
    name: file.name,
    mime_type: file.mime_type,
    size: file.size,
    provider: 'outgoing',
    data_base64: file.data_base64,
  }));
}

function friendlyGmailError(rawError: unknown): string {
  const raw = sanitizeString(rawError || '', 2000);
  const projectMatch = raw.match(/project[=/\s]+([0-9]+)/i);
  const projectId = projectMatch?.[1] || sanitizeString(process.env.GOOGLE_CLOUD_PROJECT || '', 120);
  const projectPart = projectId ? ` for Google project ${projectId}` : ' for the Google project connected to this OAuth client';

  if (/gmail api has not been used|gmail\.googleapis\.com.*disabled|api has not been used|accessnotconfigured/i.test(raw)) {
    return `Gmail API is not enabled${projectPart}. Enable "Gmail API" in Google Cloud Console > APIs & Services > Library, wait a few minutes, then send the test again.`;
  }
  if (/insufficient authentication scopes|insufficient permissions|request had insufficient authentication scopes/i.test(raw)) {
    return 'Gmail is connected, but the permission scope is missing. Disconnect Gmail, reconnect it, and approve the Gmail send permission.';
  }
  if (/invalid_grant|token has been expired or revoked/i.test(raw)) {
    return 'Gmail access expired or was revoked. Disconnect Gmail for this brand, then connect it again.';
  }
  return raw || 'Gmail send failed.';
}

function isPublicImageUrl(value: unknown): boolean {
  const url = sanitizeString(value, 1000);
  return /^https:\/\/[^\s"'<>]+\.(png|jpe?g|gif|webp|svg)(\?[^\s"'<>]*)?$/i.test(url);
}

function applyBrandEmailHeader(db: LocalDb, brandId: string, html: string): string {
  const integration = getBrandIntegration(db, brandId);
  const logoUrl = sanitizeString(integration?.email_logo_url || '', 1000);
  if (html.includes('data-optima-email-brand-header="true"')) return html;
  if (!isPublicImageUrl(logoUrl)) return html;

  const brandName = cleanMailHeader(integration?.email_sender_name || BRAND_NAMES[brandId] || 'Optima CRM', 120);
  const header = [
    '<div data-optima-email-brand-header="true" style="margin:0 0 20px 0;padding:0 0 14px 0;border-bottom:1px solid #e5e7eb;">',
    `<img src="${logoUrl}" alt="${brandName}" width="140" style="display:block;max-width:140px;width:140px;height:auto;border:0;outline:none;text-decoration:none;" />`,
    '</div>',
  ].join('');

  return `${header}${html}`;
}

async function sendGmailMessage(db: LocalDb, brandId: string, req: express.Request, options: { to: string; subject: string; html: string; attachments?: OutgoingEmailAttachment[] }) {
  const integration = getBrandIntegration(db, brandId);
  if (!integration?.gmail_refresh_token) throw new Error('Gmail is not connected for this brand.');

  const accessToken = await refreshGmailAccessToken(db, brandId, req);
  const fromName = cleanMailHeader(integration.email_sender_name || BRAND_NAMES[brandId] || 'Optima CRM', 120);
  const fromEmail = cleanMailHeader(integration.gmail_connected_email || integration.email_sender_address || '', 254);
  const replyTo = cleanMailHeader(integration.email_reply_to || fromEmail, 254);
  const to = cleanMailHeader(options.to, 254);
  const subject = cleanMailHeader(options.subject, 200);
  const html = applyBrandEmailHeader(db, brandId, sanitizeString(options.html, 50000));
  const fromHeader = fromEmail ? `${fromName} <${fromEmail}>` : fromName;
  const boundary = `optima_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const mixedBoundary = `optima_mixed_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const plainText = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 4000);
  const htmlBodyB64  = wrapBase64(Buffer.from(html,      'utf8').toString('base64'));
  const textBodyB64  = wrapBase64(Buffer.from(plainText, 'utf8').toString('base64'));
  const alternativeParts = [
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    textBodyB64,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlBodyB64,
    '',
    `--${boundary}--`,
  ].join('\r\n');
  const attachments = options.attachments || [];
  const bodyParts = attachments.length > 0
    ? [
        `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
        '',
        `--${mixedBoundary}`,
        alternativeParts,
        '',
        ...attachments.flatMap(file => [
          `--${mixedBoundary}`,
          `Content-Type: ${file.mime_type || 'application/octet-stream'}; name="${file.name}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${file.name}"`,
          '',
          wrapBase64(file.data_base64),
          '',
        ]),
        `--${mixedBoundary}--`,
      ].join('\r\n')
    : alternativeParts;
  const mime = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    bodyParts,
  ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeMimeMessage(mime) }),
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(friendlyGmailError(data?.error?.message || data?.error_description || data?.error || 'Gmail send failed'));
  return data;
}

async function sendOutlookMessage(db: LocalDb, brandId: string, req: express.Request, options: { to: string; subject: string; html: string; attachments?: OutgoingEmailAttachment[] }) {
  const integration = getBrandIntegration(db, brandId);
  if (!integration?.outlook_refresh_token) throw new Error('Outlook is not connected for this brand. Connect Outlook with Microsoft first.');

  const accessToken = await refreshOutlookAccessToken(db, brandId, req);
  const html = applyBrandEmailHeader(db, brandId, sanitizeString(options.html, 50000));
  const body = {
    message: {
      subject: cleanMailHeader(options.subject, 200),
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: cleanMailHeader(options.to, 254) } }],
      replyTo: integration.email_reply_to ? [{ emailAddress: { address: cleanMailHeader(integration.email_reply_to, 254) } }] : undefined,
      attachments: (options.attachments || []).map(file => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: file.name,
        contentType: file.mime_type || 'application/octet-stream',
        contentBytes: file.data_base64,
      })),
    },
    saveToSentItems: true,
  };
  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data: any = await response.json().catch(() => ({}));
    throw new Error(sanitizeString(data?.error?.message || 'Outlook Graph send failed.', 1000));
  }
  return { id: `outlook_${Date.now()}` };
}

async function sendSmtpMessage(db: LocalDb, brandId: string, options: { to: string; subject: string; html: string; account?: any; attachments?: OutgoingEmailAttachment[] }) {
  const baseIntegration = getBrandIntegration(db, brandId);
  const account = options.account;
  const integration = account ? {
    ...baseIntegration,
    email_provider: account.provider || baseIntegration?.email_provider,
    email_sender_address: account.email || baseIntegration?.email_sender_address,
    email_reply_to: account.reply_to || baseIntegration?.email_reply_to,
    smtp_host: account.smtp_host || baseIntegration?.smtp_host,
    smtp_port: account.smtp_port || baseIntegration?.smtp_port,
    smtp_secure: Boolean(account.smtp_secure),
    smtp_username: account.smtp_username || account.email || baseIntegration?.smtp_username,
    smtp_password_env: account.smtp_password_env || baseIntegration?.smtp_password_env,
  } as DbBrandIntegration : baseIntegration;
  if (!integration) throw new Error('Email integration is not saved for this brand.');

  const host = sanitizeString(integration.smtp_host || '', 200);
  const port = Number(sanitizeString(integration.smtp_port || '', 8)) || 587;
  const username = sanitizeString(integration.smtp_username || integration.email_sender_address || '', 254);
  const passwordEnv = sanitizeString(integration.smtp_password_env || '', 120);
  const password = sanitizeString((passwordEnv ? process.env[passwordEnv] : '') || '', 2000);
  if (!host || !username || !passwordEnv) {
    throw new Error('SMTP is not fully configured. Add host, username, and password environment variable name in Integrations.');
  }
  if (!password) {
    throw new Error(`SMTP password was not found in Render env var "${passwordEnv}".`);
  }

  const fromName = cleanMailHeader(integration.email_sender_name || BRAND_NAMES[brandId] || 'Optima CRM', 120);
  const fromEmail = cleanMailHeader(integration.email_sender_address || username, 254);
  const replyTo = cleanMailHeader(integration.email_reply_to || fromEmail, 254);
  const html = applyBrandEmailHeader(db, brandId, sanitizeString(options.html, 50000));
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: Boolean(integration.smtp_secure) || port === 465,
    requireTLS: port === 587,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    auth: { user: username, pass: password },
  });
  try {
    return await transporter.sendMail({
      from: fromEmail ? `${fromName} <${fromEmail}>` : username,
      to: cleanMailHeader(options.to, 254),
      replyTo,
      subject: cleanMailHeader(options.subject, 200),
      html,
      text: html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(),
      attachments: (options.attachments || []).map(file => ({
        filename: file.name,
        content: Buffer.from(file.data_base64, 'base64'),
        contentType: file.mime_type || 'application/octet-stream',
      })),
    });
  } catch (err: any) {
    const raw = sanitizeString(err?.message || err?.code || 'SMTP send failed.', 1000);
    if (/timeout|timed out|etimedout|esocket/i.test(raw)) {
      throw new Error(`Outlook SMTP timed out. Check host "${host}", port ${port}, SSL/TLS setting, and whether Render can reach Outlook SMTP.`);
    }
    if (/auth|login|password|credentials|535|5\.7\.3|5\.7\.57/i.test(raw)) {
      throw new Error(`Outlook rejected the login for "${username}". Check the Render password variable "${passwordEnv}" and use an Outlook app password if normal password login is blocked.`);
    }
    throw new Error(raw);
  }
}

async function sendProviderEmail(db: LocalDb, brandId: string, req: express.Request, options: { to: string; subject: string; html: string; accountId?: string; attachments?: OutgoingEmailAttachment[] }) {
  const integration = getBrandIntegration(db, brandId);
  const selectedAccount = getEmailAccountForSend(integration, options.accountId);
  const provider = selectedAccount?.provider || integration?.email_provider;
  if (provider === 'gmail') {
    const payload = await sendGmailMessage(db, brandId, req, options);
    return { provider: 'gmail', messageId: sanitizeString(payload?.id || '', 200) };
  }
  if (provider === 'outlook' && integration?.outlook_refresh_token) {
    const payload: any = await sendOutlookMessage(db, brandId, req, options);
    return { provider: 'outlook', messageId: sanitizeString(payload?.id || '', 200), account: selectedAccount };
  }
  if (provider === 'outlook' || provider === 'yahoo' || provider === 'smtp') {
    const payload: any = await sendSmtpMessage(db, brandId, { ...options, account: selectedAccount });
    return { provider, messageId: sanitizeString(payload?.messageId || '', 200), account: selectedAccount };
  }
  return { provider: integration?.email_provider || 'internal', messageId: '' };
}

function getWhatsAppVerifyTokens(db: LocalDb): Set<string> {
  const tokens = new Set<string>();
  const globalToken = sanitizeString(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '', 200);
  if (globalToken) tokens.add(globalToken);
  (db.get().brand_integrations || []).forEach(integration => {
    const token = sanitizeString(integration.whatsapp_verify_token || '', 200);
    if (token) tokens.add(token);
  });
  return tokens;
}

function resolveWhatsAppBrandId(db: LocalDb, phoneNumberId: string): string {
  const cleanPhoneNumberId = sanitizeString(phoneNumberId, 80);
  if (!cleanPhoneNumberId) return '';

  const integration = (db.get().brand_integrations || []).find(i => sanitizeString(i.whatsapp_phone_number_id || '', 80) === cleanPhoneNumberId);
  if (integration) return integration.brand_id;

  for (const brandId of Object.keys(WEBSITE_INTAKE_CONFIG)) {
    const envPhoneId = sanitizeString(process.env[`WHATSAPP_${brandEnvPrefix(brandId)}_PHONE_NUMBER_ID`] || '', 80);
    if (envPhoneId === cleanPhoneNumberId) return brandId;
  }

  const globalPhoneId = sanitizeString(process.env.WHATSAPP_PHONE_NUMBER_ID || '', 80);
  if (globalPhoneId === cleanPhoneNumberId) {
    const globalBrand = sanitizeString(process.env.WHATSAPP_DEFAULT_BRAND_ID || '', 40);
    if (globalBrand) return globalBrand;
  }
  return '';
}

function resolveWhatsAppCloudConfig(db: LocalDb, brandId: string) {
  const cleanBrandId = sanitizeString(brandId, 40);
  const prefix = brandEnvPrefix(cleanBrandId);
  const integration = getBrandIntegration(db, cleanBrandId);
  const phoneNumberId = sanitizeString(
    integration?.whatsapp_phone_number_id ||
    process.env[`WHATSAPP_${prefix}_PHONE_NUMBER_ID`] ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    '',
    80
  );
  const accessTokenEnv = sanitizeString(
    integration?.whatsapp_access_token_env ||
    process.env[`WHATSAPP_${prefix}_ACCESS_TOKEN_ENV`] ||
    `WHATSAPP_${prefix}_ACCESS_TOKEN`,
    120
  );
  const accessToken = sanitizeString(
    process.env[accessTokenEnv] ||
    process.env[`WHATSAPP_${prefix}_ACCESS_TOKEN`] ||
    process.env.WHATSAPP_ACCESS_TOKEN ||
    '',
    5000
  );

  if (!phoneNumberId || !accessToken) return null;

  return {
    brandId: cleanBrandId,
    graphVersion: sanitizeString(process.env.WHATSAPP_GRAPH_VERSION || 'v20.0', 20),
    phoneNumberId,
    accessToken,
    displayNumber: sanitizeString(integration?.whatsapp_number || '', 30),
    integration,
  };
}

async function sendWhatsAppCloudText(config: NonNullable<ReturnType<typeof resolveWhatsAppCloudConfig>>, toNumber: string, message: string) {
  const endpoint = `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizeWhatsAppDigits(toNumber),
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }),
  });

  const rawText = await response.text();
  let payload: any = null;
  try { payload = rawText ? JSON.parse(rawText) : null; } catch { payload = { raw: rawText }; }

  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || rawText || response.statusText;
    throw new Error(detail);
  }
  return payload;
}

function extractWhatsAppInboundText(message: any): string {
  if (message?.text?.body) return sanitizeString(message.text.body, 3000);
  if (message?.button?.text) return sanitizeString(message.button.text, 3000);
  if (message?.interactive?.button_reply?.title) return sanitizeString(message.interactive.button_reply.title, 3000);
  if (message?.interactive?.list_reply?.title) return sanitizeString(message.interactive.list_reply.title, 3000);
  if (message?.image?.caption) return sanitizeString(message.image.caption, 3000);
  if (message?.document?.caption) return sanitizeString(message.document.caption, 3000);
  return sanitizeString(`WhatsApp ${message?.type || 'message'} received`, 3000);
}

function findLeadByWhatsAppPhone(db: LocalDb, brandId: string, phone: string): DbLead | undefined {
  const cleanPhone = normalizeWhatsAppDigits(phone);
  if (!cleanPhone) return undefined;
  return db.get().leads.find(lead => {
    if (brandId && lead.brand_id !== brandId) return false;
    return normalizeWhatsAppDigits(lead.phone) === cleanPhone;
  });
}

async function startServer() {
  const app = express();
  const PORT = 5000;

  const db = new LocalDb();
  await db.initSupabasePrimary();
  const websiteIntakeKeys = parseWebsiteIntakeKeys();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Serve brand logos explicitly in both dev and production.
  // This prevents broken sidebar/dashboard logos when the app is run through
  // the custom Express server instead of pure Vite.
  app.use('/logos', express.static(path.join(process.cwd(), 'public', 'logos')));
  app.use('/public', express.static(path.join(process.cwd(), 'public')));

  // ─── Auth helpers ────────────────────────────────────────────────────────
  const getSessionUser = (req: express.Request): DbUser | null => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const tokenUserId = authHeader.substring(7).trim();
        if (tokenUserId) {
          const user = db.get().users.find(u => u.id === tokenUserId);
          if (user) return user;
        }
      }

      const cookieHeader = req.headers.cookie;
      if (!cookieHeader) return null;

      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach(c => {
        const parts = c.trim().split('=');
        if (parts[0]) {
          let val = '';
          try { val = decodeURIComponent(parts[1] || ''); } catch { val = parts[1] || ''; }
          cookies[parts[0]] = val;
        }
      });

      const userId = cookies.optima_session_id;
      if (!userId) return null;
      return db.get().users.find(u => u.id === userId) || null;
    } catch (err) {
      console.error('Error in getSessionUser:', err);
      return null;
    }
  };

  // Auth middleware — attaches req.user with proper TypeScript type
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getSessionUser(req);
    if (!user) { res.status(401).json({ detail: 'Authentication required' }); return; }
    req.user = user;
    next();
  };

  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') { res.status(403).json({ detail: 'Admin role required.' }); return; }
    req.user = user;
    next();
  };

  const publicUser = (user: DbUser) => {
    const { password: _, ...safeUser } = user;
    return {
      ...safeUser,
      presence_status: safeUser.presence_status || 'offline',
      presence_updated_at: safeUser.presence_updated_at || '',
    };
  };

  const updateUserPresence = (userId: string, status: 'online' | 'away' | 'offline') => {
    const user = db.get().users.find(u => u.id === userId);
    if (!user) return null;
    user.presence_status = status;
    user.presence_updated_at = new Date().toISOString();
    db.save();
    return user;
  };


  // ─── Database / Supabase status and migration helpers ─────────────────────
  app.get('/api/admin/database/status', requireAdmin, (_req, res) => {
    const status = db.getSupabaseStatus();
    res.json({
      mode: status.configured && !status.using_fallback ? 'supabase_primary' : 'db_json_fallback',
      supabase: status,
      local_backup: { enabled: true, files: ['db.json', 'backups/db-latest.json', 'backups/db-YYYY-MM-DD.json'] },
      counts: {
        leads: db.get().leads.length,
        taskgo_leads: db.get().leads.filter(l => l.brand_id === 'taskgo').length,
        idao_leads: db.get().leads.filter(l => l.brand_id === 'idao').length,
        optimaviz_leads: db.get().leads.filter(l => l.brand_id === 'optimaviz').length,
        emails: db.get().emails.length,
        notes: db.get().notes.length,
      },
    });
  });

  app.post('/api/admin/seed/nestwise', requireAdmin, (req, res) => {
    const result = ensureNestWiseSeedLeads(db, req.user?.name || 'System');
    res.json({ success: true, ...result });
  });

  app.post('/api/admin/database/sync-supabase', requireAdmin, async (_req, res) => {
    try {
      await db.forcePushToSupabase();
      res.json({ success: true, supabase: db.getSupabaseStatus() });
    } catch (err) {
      res.status(500).json({ success: false, detail: err instanceof Error ? err.message : String(err), supabase: db.getSupabaseStatus() });
    }
  });

  app.get('/api/admin/website-intake/guide', requireAdmin, (_req, res) => {
    res.json({
      endpoint: '/api/public/leads',
      method: 'POST',
      authentication: 'Send the brand key with either Authorization: Bearer <key> or x-crm-intake-key: <key>.',
      key_setup: {
        packed_env: 'WEBSITE_INTAKE_KEYS={"taskgo":"taskgo-secret","idao":"idao-secret"}',
        per_brand_env: 'WEBSITE_INTAKE_KEY_TASKGO=taskgo-secret',
      },
      brands: Object.entries(WEBSITE_INTAKE_CONFIG).map(([brand_id, config]) => ({
        brand_id,
        brand_name: BRAND_NAMES[brand_id] || brand_id,
        key_configured: Boolean(websiteIntakeKeys[brand_id]?.length),
        default_source: config.defaultSource,
        allowed_custom_fields: config.allowedCustomFields,
      })),
      example_taskgo_payload: {
        brand_id: 'taskgo',
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+61400000000',
        source: 'TaskGo Website',
        custom_fields: {
          service_category: 'House Cleaning',
          abn_number: '12345678901',
          city: 'Perth',
          state: 'Western Australia',
        },
      },
    });
  });

  // ─── Shared enroll helper (replaces 3 copy-pasted blocks) ──────────────────
  app.get('/api/admin/usage/guide', requireAdmin, (_req, res) => {
    res.json({
      endpoint: '/api/public/usage',
      method: 'POST',
      authentication: 'Use the same brand website key as lead intake: Authorization: Bearer <key> or x-crm-intake-key: <key>.',
      example_optimaviz_payload: {
        brand_id: 'optimaviz',
        feature: 'data_evaluation',
        event_type: 'feature_view',
        session_id: 'anonymous-session-id',
        user_id: 'optional-app-user-id',
        path: '/dashboard/data-evaluation',
        metadata: { plan: 'trial' },
      },
      optimaviz_features: [
        'data_evaluation',
        'performance_evaluation',
        'performance_exploration',
        'analytics_for_optimisation',
        'machine_learning_for_optimisation',
        'global_parameter_impact_evaluation',
      ],
    });
  });

  app.get('/api/usage/analytics', requireAuth, (req, res) => {
    const brandId = sanitizeString(req.query.brand_id || 'optimaviz', 40).toLowerCase();
    const events = (db.get().usage_events || []).filter(event => event.brand_id === brandId);
    const byFeature: Record<string, { total_events: number; unique_sessions: number; last_seen_at: string | null }> = {};
    for (const event of events) {
      if (!byFeature[event.feature]) {
        byFeature[event.feature] = { total_events: 0, unique_sessions: 0, last_seen_at: null };
      }
      byFeature[event.feature].total_events += 1;
      if (!byFeature[event.feature].last_seen_at || event.created_at > byFeature[event.feature].last_seen_at!) {
        byFeature[event.feature].last_seen_at = event.created_at;
      }
    }
    Object.keys(byFeature).forEach(feature => {
      byFeature[feature].unique_sessions = new Set(events.filter(event => event.feature === feature).map(event => event.session_id || event.user_id || event.id)).size;
    });
    res.json({ brand_id: brandId, total_events: events.length, by_feature: byFeature });
  });

  app.post('/api/public/usage', (req, res) => {
    const brandId = sanitizeString(req.body?.brand_id, 40).toLowerCase();
    if (!brandId || !WEBSITE_INTAKE_CONFIG[brandId]) {
      res.status(400).json({ detail: 'A supported brand_id is required.', supported_brands: Object.keys(WEBSITE_INTAKE_CONFIG) });
      return;
    }

    const configuredKeys = websiteIntakeKeys[brandId] || [];
    if (configuredKeys.length === 0) {
      res.status(503).json({ detail: `Usage tracking is not configured for ${BRAND_NAMES[brandId] || brandId}. Add WEBSITE_INTAKE_KEY_${brandId.toUpperCase()} to enable it.` });
      return;
    }

    const suppliedKey = getWebsiteIntakeKey(req);
    if (!suppliedKey || !configuredKeys.includes(suppliedKey)) {
      res.status(401).json({ detail: 'Invalid website tracking key.' });
      return;
    }

    const feature = sanitizeString(req.body?.feature, 100);
    const eventType = sanitizeString(req.body?.event_type || 'feature_view', 80);
    if (!feature) {
      res.status(400).json({ detail: 'feature is required.' });
      return;
    }

    const metadata: Record<string, unknown> = {};
    if (req.body?.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata)) {
      Object.entries(req.body.metadata as Record<string, unknown>).slice(0, 20).forEach(([key, value]) => {
        metadata[sanitizeString(key, 60)] = sanitizeString(value, 500);
      });
    }

    const event: DbUsageEvent = {
      id: newId('usage'),
      brand_id: brandId,
      feature,
      event_type: eventType,
      session_id: sanitizeString(req.body?.session_id, 120),
      user_id: sanitizeString(req.body?.user_id, 120),
      path: sanitizeString(req.body?.path, 300),
      metadata,
      created_at: new Date().toISOString(),
    };

    db.get().usage_events = db.get().usage_events || [];
    db.get().usage_events!.push(event);
    db.save();
    res.status(201).json({ success: true, event_id: event.id });
  });

  function enrollLeadInSequence(
    lead: DbLead,
    seq: DbSequence,
    triggeredBy: string
  ): boolean {
    const alreadyEnrolled = db.get().enrollments.some(
      e => e.lead_id === lead.id && e.sequence_id === seq.id
    );
    if (alreadyEnrolled) return false;

    db.get().enrollments.push({
      id: newId('enroll'),
      lead_id: lead.id,
      sequence_id: seq.id,
      enrolled_at: new Date().toISOString(),
      current_step: 0,
      status: 'active',
    });

    if (seq.steps && seq.steps.length > 0) {
      const step = seq.steps[0];
      db.get().emails.push({
        id: newId('email'),
        lead_id: lead.id,
        subject: step.subject,
        html_content: step.html_content,
        status: 'sent',
        created_at: new Date().toISOString(),
      });
      db.get().notes.push({
        id: newId('note'),
        lead_id: lead.id,
        content: `${triggeredBy === 'manual' ? 'Manually enrolled' : 'Auto-enrolled'} in sequence "${seq.name}". Sent Step 1: "${step.name}"`,
        created_by: triggeredBy === 'manual' ? (db.get().users.find(u => u.id === triggeredBy)?.name || triggeredBy) : 'System Auto-Trigger',
        created_at: new Date().toISOString(),
      });
    }

    return true;
  }

  app.post('/api/public/leads', (req, res) => {
    const brandId = sanitizeString(req.body?.brand_id, 40).toLowerCase();
    const brandConfig = WEBSITE_INTAKE_CONFIG[brandId];
    if (!brandId || !brandConfig) {
      res.status(400).json({ detail: 'A supported brand_id is required.', supported_brands: Object.keys(WEBSITE_INTAKE_CONFIG) });
      return;
    }

    const configuredKeys = websiteIntakeKeys[brandId] || [];
    if (configuredKeys.length === 0) {
      res.status(503).json({ detail: `Website intake is not configured for ${BRAND_NAMES[brandId] || brandId}. Add WEBSITE_INTAKE_KEY_${brandId.toUpperCase()} to enable it.` });
      return;
    }

    const suppliedKey = getWebsiteIntakeKey(req);
    if (!suppliedKey || !configuredKeys.includes(suppliedKey)) {
      res.status(401).json({ detail: 'Invalid website intake key.' });
      return;
    }

    const clean = sanitizeLead({
      ...req.body,
      brand_id: brandId,
      brand_name: req.body?.brand_name || BRAND_NAMES[brandId] || brandId,
      funnel_stage: req.body?.funnel_stage || req.body?.stage || (brandId === 'nestwise' ? 'New Enquiry' : 'New Lead'),
    });

    if (!clean.name) {
      if (clean.email) clean.name = clean.email.split('@')[0];
      else if (clean.phone) clean.name = `Contact ${clean.phone}`;
    }

    if (!clean.name || (!clean.email && !clean.phone)) {
      res.status(400).json({ detail: 'A lead needs a name plus either email or phone. If name is missing, email or phone can be used to create one.' });
      return;
    }

    const topLevelCustomFields: Record<string, unknown> = {};
    for (const key of brandConfig.allowedCustomFields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) topLevelCustomFields[key] = req.body[key];
    }

    const rawCustomFields = sanitizeCustomFields({
      ...clean.custom_fields,
      ...topLevelCustomFields,
      ...(brandId === 'nestwise' && clean.notes ? { enquiry: clean.notes } : {}),
    });
    const { accepted, ignored } = filterBrandCustomFields(brandId, rawCustomFields);
    const brandFields = normalizeImportedCustomFields(brandId, accepted);
    const source = sanitizeString(req.body?.source, 120) || brandConfig.defaultSource;
    const duplicateStrategy = sanitizeString(req.body?.duplicate_strategy, 40) || 'update_existing';
    const intakeCreatedAt = parseLeadDateInput(req.body?.created_at || req.body?.source_created_at || req.body?.submitted_at || req.body?.date_joined || req.body?.joined_at);
    const brandDefaults = BRAND_DEFAULTS[brandId] || {};
    const mergedCustomFields = {
      ...brandDefaults,
      ...brandFields,
      lead_source: source,
      intake_channel: 'website',
    };
    ensureBrandCustomFieldDefinitions(db, brandId, mergedCustomFields);

    const existing = findExistingLeadByContact(db, clean.email, clean.phone, brandId);
    if (existing && duplicateStrategy !== 'create_new') {
      if (duplicateStrategy === 'skip') {
        res.json({ success: true, status: 'duplicate_skipped', lead_id: existing.id, ignored_fields: ignored });
        return;
      }

      existing.name = clean.name || existing.name;
      existing.email = clean.email || existing.email;
      existing.phone = clean.phone || existing.phone;
      existing.notes = clean.notes || existing.notes;
      existing.tags = Array.from(new Set([...(existing.tags || []), 'Website Intake', source]));
      existing.custom_fields = {
        ...(existing.custom_fields || {}),
        ...mergedCustomFields,
      };

      db.get().notes.push({
        id: newId('note'),
        lead_id: existing.id,
        content: clean.notes
          ? `Website lead update from ${source}. Notes: ${clean.notes}`
          : `Website lead update from ${source}.`,
        created_by: source,
        created_at: new Date().toISOString(),
      });

      db.save();
      res.json({ success: true, status: 'duplicate_updated', lead: existing, ignored_fields: ignored });
      return;
    }

    const newLead: DbLead = {
      id: newId('lead'),
      brand_id: brandId,
      brand_name: clean.brand_name || BRAND_NAMES[brandId] || 'Brand',
      name: clean.name,
      email: clean.email,
      phone: clean.phone,
      funnel_stage: clean.funnel_stage || (brandId === 'nestwise' ? 'New Enquiry' : 'New Lead'),
      notes: clean.notes,
      tags: Array.from(new Set([...(clean.tags || []), 'Website Intake', source])),
      custom_fields: mergedCustomFields,
      created_at: intakeCreatedAt || new Date().toISOString(),
    };

    db.get().leads.push(newLead);
    db.get().notes.push({
      id: newId('note'),
      lead_id: newLead.id,
      content: clean.notes
        ? `Lead created from ${source}. Notes: ${clean.notes}`
        : `Lead created from ${source}.`,
      created_by: source,
      created_at: new Date().toISOString(),
    });

    const activeSequences = db.get().sequences.filter(
      s => s.brand_id === brandId && s.active && s.trigger_stage === newLead.funnel_stage
    );
    for (const seq of activeSequences) {
      enrollLeadInSequence(newLead, seq, 'auto');
    }

    db.save();
    res.status(201).json({ success: true, status: 'created', lead: newLead, ignored_fields: ignored });
  });

  // ─── Sequence step scheduler ──────────────────────────────────────────────
  // Checks every minute whether a scheduled next-step email is due.
  setInterval(() => {
    const now = new Date();
    let dirty = false;

    for (const enroll of db.get().enrollments) {
      if (enroll.status !== 'active') continue;

      const seq = db.get().sequences.find(s => s.id === enroll.sequence_id);
      if (!seq) continue;

      const nextStepIndex = enroll.current_step;
      const nextStep = seq.steps[nextStepIndex];
      if (!nextStep) {
        enroll.status = 'completed';
        dirty = true;
        continue;
      }

      // Calculate when this step should fire
      const enrolledAt = new Date(enroll.enrolled_at);
      const sendAt = new Date(enrolledAt);
      sendAt.setDate(sendAt.getDate() + nextStep.delay_days);

      if (now >= sendAt) {
        db.get().emails.push({
          id: newId('email'),
          lead_id: enroll.lead_id,
          subject: nextStep.subject,
          html_content: nextStep.html_content,
          status: 'sent',
          created_at: now.toISOString(),
        });
        db.get().notes.push({
          id: newId('note'),
          lead_id: enroll.lead_id,
          content: `Sequence "${seq.name}" — Step ${nextStepIndex + 1} sent: "${nextStep.name}"`,
          created_by: 'Sequence Scheduler',
          created_at: now.toISOString(),
        });

        enroll.current_step += 1;
        dirty = true;

        // Mark completed if no more steps
        if (enroll.current_step >= seq.steps.length) {
          enroll.status = 'completed';
        }
      }
    }

    if (dirty) db.save();
  }, 60_000);

  // ─── Auth routes ─────────────────────────────────────────────────────────
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ detail: 'Email and password are required' }); return; }
    const user = db.get().users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) { res.status(401).json({ detail: 'Invalid credentials' }); return; }
    user.presence_status = 'online';
    user.presence_updated_at = new Date().toISOString();
    db.save();
    res.setHeader('Set-Cookie', `optima_session_id=${user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    res.json(publicUser(user));
  });

  app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', `optima_session_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    const user = getSessionUser(req);
    if (user) updateUserPresence(user.id, 'offline');
    res.json({ success: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getSessionUser(req);
    if (!user) { res.status(401).json({ detail: 'Not authenticated' }); return; }
    res.json(publicUser(user));
  });

  app.put('/api/auth/me/notification-state', requireAuth, (req, res) => {
    const user = db.get().users.find(u => u.id === req.user!.id);
    if (!user) { res.status(404).json({ detail: 'User not found' }); return; }
    const dismissed = Array.isArray(req.body?.dismissed_ids)
      ? req.body.dismissed_ids.map((item: unknown) => sanitizeString(String(item || ''), 200)).filter(Boolean).slice(0, 200)
      : Array.isArray(user.notification_state?.dismissed_ids) ? user.notification_state!.dismissed_ids : [];
    user.notification_state = {
      seen_signature: sanitizeString(req.body?.seen_signature || user.notification_state?.seen_signature || '', 2000),
      dismissed_ids: dismissed,
      updated_at: new Date().toISOString(),
    };
    db.save();
    res.json(user.notification_state);
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email, newPassword } = req.body;
    if (!email) { res.status(400).json({ detail: 'Email is required' }); return; }
    const idx = db.get().users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) { res.json({ success: true }); return; }
    if (!newPassword || String(newPassword).length < 6) { res.status(400).json({ detail: 'Password must be at least 6 characters' }); return; }
    db.get().users[idx].password = newPassword;
    db.save();
    res.json({ success: true });
  });

  // ─── Brand funnels ────────────────────────────────────────────────────────
  app.get('/api/brand-funnels', requireAuth, (req, res) => {
    res.json(db.get().brand_funnels);
  });

  // ─── Leads ───────────────────────────────────────────────────────────────
  // Paginated: GET /api/leads?brand_id=x&page=1&limit=50
  app.get('/api/leads', requireAuth, (req, res) => {
    const { brand_id } = req.query;
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string) || 200);

    let leads = db.get().leads;
    if (brand_id) leads = leads.filter(l => l.brand_id === brand_id);
    leads = [...leads].sort((a, b) => getLeadSortTime(b) - getLeadSortTime(a));

    const total = leads.length;
    const items = leads.slice((page - 1) * limit, page * limit);
    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  });

  app.post('/api/leads/bulk-assign-segment', requireAuth, (req, res) => {
    const { lead_ids, segment } = req.body;
    if (!lead_ids || !Array.isArray(lead_ids)) { res.status(400).json({ detail: 'lead_ids list is required' }); return; }
    const val = segment === 'unassigned' ? '' : segment;
    let updatedCount = 0;
    db.get().leads.forEach(l => {
      if (lead_ids.includes(l.id)) {
        if (!l.custom_fields) l.custom_fields = {};
        l.custom_fields.segment = val;
        updatedCount++;
      }
    });
    db.save();
    res.json({ success: true, count: updatedCount });
  });

  app.post('/api/leads', requireAuth, (req, res) => {
    const clean = sanitizeLead(req.body);

    if (!clean.brand_id || !clean.name || !clean.funnel_stage) {
      res.status(400).json({ detail: 'Missing required lead fields (brand_id, name, funnel_stage)' });
      return;
    }

    // Deduplication check
    const existing = findExistingLead(db, clean.email, clean.brand_id);
    if (existing) {
      res.status(409).json({
        error: 'duplicate',
        message: `A lead with this email already exists in ${clean.brand_id}.`,
        existing_id: existing.id,
      });
      return;
    }

    const sessionUser = req.user!;

    // Apply brand-level default custom fields from config
    const brandDefaults = BRAND_DEFAULTS[clean.brand_id] || {};
    const mergedCustomFields = { ...brandDefaults, ...clean.custom_fields };

    const newLead: DbLead = {
      id: newId('lead'),
      brand_id: clean.brand_id,
      brand_name: clean.brand_name || 'Brand',
      name: clean.name,
      email: clean.email,
      phone: clean.phone,
      funnel_stage: clean.funnel_stage,
      notes: clean.notes,
      tags: clean.tags,
      custom_fields: mergedCustomFields,
      owner_id: clean.owner_id || sessionUser.id,
      owner_name: clean.owner_name || sessionUser.name,
      created_at: new Date().toISOString(),
    };

    db.get().leads.push(newLead);

    db.get().notes.push({
      id: newId('note'),
      lead_id: newLead.id,
      content: clean.notes ? `Lead created. Notes: ${clean.notes}` : 'Lead created.',
      created_by: sessionUser.name,
      created_at: new Date().toISOString(),
    });

    // Auto-enroll using shared helper
    const activeSequences = db.get().sequences.filter(
      s => s.brand_id === clean.brand_id && s.active && s.trigger_stage === clean.funnel_stage
    );
    for (const seq of activeSequences) {
      enrollLeadInSequence(newLead, seq, 'auto');
    }

    db.save();
    res.status(201).json(newLead);
  });

  app.put('/api/leads/:lead_id', requireAuth, (req, res) => {
    const { lead_id } = req.params;
    const { name, email, phone, funnel_stage, notes, tags, custom_fields, owner_id, owner_name, follow_up_date } = req.body;

    const leadIndex = db.get().leads.findIndex(l => l.id === lead_id);
    if (leadIndex === -1) { res.status(404).json({ detail: 'Lead not found' }); return; }

    const prev = db.get().leads[leadIndex];
    const previousStage = prev.funnel_stage;

    const updatedLead: DbLead = {
      ...prev,
      name:          name          !== undefined ? sanitizeString(name, 120)          : prev.name,
      email:         email         !== undefined ? sanitizeString(email, 254).toLowerCase() : prev.email,
      phone:         phone         !== undefined ? sanitizeString(phone, 30)          : prev.phone,
      funnel_stage:  funnel_stage  !== undefined ? sanitizeString(funnel_stage, 80)   : prev.funnel_stage,
      notes:         notes         !== undefined ? sanitizeString(notes, 2000)        : prev.notes,
      tags:          tags          !== undefined ? tags                               : prev.tags,
      custom_fields: custom_fields !== undefined ? sanitizeCustomFields(custom_fields): prev.custom_fields,
      owner_id:      owner_id      !== undefined ? sanitizeString(owner_id, 60)       : prev.owner_id,
      owner_name:    owner_name    !== undefined ? sanitizeString(owner_name, 120)    : prev.owner_name,
      follow_up_date: follow_up_date !== undefined ? sanitizeString(follow_up_date, 20)  : prev.follow_up_date,
    };

    db.get().leads[leadIndex] = updatedLead;

    const sessionUser = req.user!;
    if (funnel_stage && funnel_stage !== previousStage) {
      db.get().notes.push({
        id: newId('note'),
        lead_id,
        content: `Funnel stage updated from "${previousStage}" to "${funnel_stage}"`,
        created_by: sessionUser.name,
        created_at: new Date().toISOString(),
      });

      // Auto-enroll on stage change using shared helper
      const activeSequences = db.get().sequences.filter(
        s => s.brand_id === updatedLead.brand_id && s.active && s.trigger_stage === funnel_stage
      );
      for (const seq of activeSequences) {
        enrollLeadInSequence(updatedLead, seq, 'auto');
      }
    }

    db.save();
    res.json(updatedLead);
  });

  app.delete('/api/leads/:lead_id', requireAuth, (req, res) => {
    const { lead_id } = req.params;
    const idx = db.get().leads.findIndex(l => l.id === lead_id);
    if (idx === -1) { res.status(404).json({ detail: 'Lead not found' }); return; }
    db.get().leads.splice(idx, 1);
    db.get().notes       = db.get().notes.filter(n => n.lead_id !== lead_id);
    db.get().emails      = db.get().emails.filter(e => e.lead_id !== lead_id);
    db.get().whatsapp    = db.get().whatsapp.filter(w => w.lead_id !== lead_id);
    db.get().enrollments = db.get().enrollments.filter(e => e.lead_id !== lead_id);
    db.save();
    res.json({ success: true });
  });

  // ─── Notes ───────────────────────────────────────────────────────────────
  app.get('/api/leads/:lead_id/notes', requireAuth, (req, res) => {
    const { lead_id } = req.params;
    res.json(db.get().notes.filter(n => n.lead_id === lead_id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.post('/api/leads/:lead_id/notes', requireAuth, (req, res) => {
    const { lead_id } = req.params;
    const content = sanitizeString(req.body.content, 2000);
    if (!content) { res.status(400).json({ detail: 'Content is required' }); return; }

    const newNote: DbNote = {
      id: newId('note'),
      lead_id,
      content,
      created_by: req.user!.name,
      created_at: new Date().toISOString(),
    };
    db.get().notes.push(newNote);
    db.save();
    res.status(201).json(newNote);
  });

  app.delete('/api/notes/:note_id', requireAuth, (req, res) => {
    const { note_id } = req.params;
    const filtered = db.get().notes.filter(n => n.id !== note_id);
    if (filtered.length === db.get().notes.length) { res.status(404).json({ detail: 'Note not found' }); return; }
    db.get().notes = filtered;
    db.save();
    res.json({ success: true });
  });

  // ─── Open-tracking pixel (no auth — fetched by email clients) ───────────────
  app.get('/api/track/open/:email_id', (req, res) => {
    const emailId = sanitizeString(req.params.email_id, 200);
    const email = db.get().emails.find(e => e.id === emailId);
    if (email) {
      email.open_count = (email.open_count || 0) + 1;
      if (!email.opened_at) email.opened_at = new Date().toISOString();
      db.save();
    }
    // 1×1 transparent GIF
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    });
    res.end(pixel);
  });

  app.get('/api/emails/:email_id/attachments/:attachment_id', requireAuth, (req, res) => {
    const emailId = sanitizeString(req.params.email_id, 200);
    const attachmentId = sanitizeString(req.params.attachment_id, 300);
    const email = db.get().emails.find(e => e.id === emailId);
    if (!email) { res.status(404).json({ detail: 'Email not found.' }); return; }
    const attachment = (email.attachments || []).find((file: any) => file.id === attachmentId);
    if (!attachment) { res.status(404).json({ detail: 'Attachment not found.' }); return; }
    if (!attachment.data_base64) {
      res.status(404).json({ detail: 'This provider attachment is listed, but the file data is not stored in CRM. Sync/download it from the connected mailbox.' });
      return;
    }
    const buffer = Buffer.from(String(attachment.data_base64 || '').replace(/^data:[^;]+;base64,/i, ''), 'base64');
    const mime = sanitizeString(attachment.mime_type || 'application/octet-stream', 120);
    const filename = cleanAttachmentFilename(attachment.name || 'attachment');
    const inline = String(req.query.inline || '') === '1';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename.replace(/"/g, '')}"`);
    res.end(buffer);
  });

  app.delete('/api/emails/:email_id', requireAuth, (req, res) => {
    const { email_id } = req.params;
    const filtered = db.get().emails.filter(e => e.id !== email_id);
    if (filtered.length === db.get().emails.length) { res.status(404).json({ detail: 'Email not found' }); return; }
    db.get().emails = filtered;
    db.save();
    res.json({ success: true });
  });

  app.delete('/api/whatsapp/:wa_id', requireAuth, (req, res) => {
    const { wa_id } = req.params;
    const filtered = db.get().whatsapp.filter(w => w.id !== wa_id);
    if (filtered.length === db.get().whatsapp.length) { res.status(404).json({ detail: 'WhatsApp message not found' }); return; }
    db.get().whatsapp = filtered;
    db.save();
    res.json({ success: true });
  });

  // ─── History / timeline ───────────────────────────────────────────────────
  app.get('/api/team-notes', requireAuth, (_req, res) => {
    const notes = (db.get().team_notes || [])
      .slice()
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    res.json(notes);
  });

  app.post('/api/team-notes', requireAuth, (req, res) => {
    const title = sanitizeString(req.body?.title || 'Untitled note', 120) || 'Untitled note';
    const content = sanitizeString(req.body?.content || '', 5000);
    const color = sanitizeString(req.body?.color || '#fef3c7', 40);
    const pinned = Boolean(req.body?.pinned);
    if (!content.trim()) { res.status(400).json({ detail: 'Note content is required.' }); return; }
    const now = new Date().toISOString();
    const note: DbTeamNote = {
      id: newId('teamnote'),
      title,
      content,
      color,
      pinned,
      created_by: req.user!.name,
      created_at: now,
      updated_at: now,
    };
    if (!db.get().team_notes) db.get().team_notes = [];
    db.get().team_notes!.push(note);
    db.save();
    res.status(201).json(note);
  });

  app.put('/api/team-notes/:note_id', requireAuth, (req, res) => {
    const noteId = sanitizeString(req.params.note_id, 120);
    const notes = db.get().team_notes || [];
    const idx = notes.findIndex(n => n.id === noteId);
    if (idx === -1) { res.status(404).json({ detail: 'Team note not found.' }); return; }
    notes[idx] = {
      ...notes[idx],
      title: req.body?.title !== undefined ? (sanitizeString(req.body.title || 'Untitled note', 120) || 'Untitled note') : notes[idx].title,
      content: req.body?.content !== undefined ? sanitizeString(req.body.content || '', 5000) : notes[idx].content,
      color: req.body?.color !== undefined ? sanitizeString(req.body.color || '#fef3c7', 40) : notes[idx].color,
      pinned: req.body?.pinned !== undefined ? Boolean(req.body.pinned) : notes[idx].pinned,
      updated_at: new Date().toISOString(),
    };
    db.get().team_notes = notes;
    db.save();
    res.json(notes[idx]);
  });

  app.delete('/api/team-notes/:note_id', requireAuth, (req, res) => {
    const noteId = sanitizeString(req.params.note_id, 120);
    const before = db.get().team_notes || [];
    const after = before.filter(n => n.id !== noteId);
    if (after.length === before.length) { res.status(404).json({ detail: 'Team note not found.' }); return; }
    db.get().team_notes = after;
    db.save();
    res.json({ success: true });
  });

  app.get('/api/team-chat', requireAuth, (req, res) => {
    const sessionUser = req.user!;
    const messages = (db.get().team_messages || [])
      .filter(message => {
        const recipients = Array.isArray(message.recipient_ids) ? message.recipient_ids : [];
        return recipients.length === 0 || recipients.includes('all') || recipients.includes(sessionUser.id) || message.user_id === sessionUser.id || sessionUser.role === 'admin';
      })
      .slice()
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
      .map(message => ({
        ...message,
        attachments: (message.attachments || []).map(file => ({
          id: file.id,
          name: file.name,
          mime_type: file.mime_type,
          size: file.size,
          download_url: `/api/team-chat/${encodeURIComponent(message.id)}/attachments/${encodeURIComponent(file.id)}`,
        })),
      }));
    res.json(messages);
  });

  app.post('/api/team-chat', requireAuth, (req, res) => {
    const content = sanitizeString(req.body.content || '', 2000);
    const recipientIds = Array.isArray(req.body.recipient_ids)
      ? req.body.recipient_ids.map((id: unknown) => sanitizeString(String(id || ''), 120)).filter(Boolean)
      : [];
    const validUserIds = new Set(db.get().users.map(u => u.id));
    const cleanRecipientIds = recipientIds.includes('all') ? ['all'] : recipientIds.filter(id => validUserIds.has(id));
    const cleanRecipientNames = cleanRecipientIds.includes('all')
      ? ['Everyone']
      : db.get().users.filter(u => cleanRecipientIds.includes(u.id)).map(u => u.name);
    const incomingAttachments = Array.isArray(req.body.attachments) ? req.body.attachments.slice(0, 5) : [];
    const attachments: DbTeamMessage['attachments'] = [];
    let totalBytes = 0;

    for (const file of incomingAttachments) {
      const name = sanitizeString(file?.name || 'shared-file', 180).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || 'shared-file';
      const mimeType = sanitizeString(file?.mime_type || file?.type || 'application/octet-stream', 120);
      const rawData = String(file?.data_base64 || '').includes(',') ? String(file?.data_base64 || '').split(',').pop() || '' : String(file?.data_base64 || '');
      const dataBase64 = rawData.replace(/\s/g, '');
      if (!dataBase64) continue;
      const bytes = Buffer.byteLength(dataBase64, 'base64');
      if (bytes > 8 * 1024 * 1024) {
        res.status(400).json({ detail: `${name} is too large. Maximum file size is 8MB.` });
        return;
      }
      totalBytes += bytes;
      if (totalBytes > 20 * 1024 * 1024) {
        res.status(400).json({ detail: 'Total attachments must be 20MB or less per message.' });
        return;
      }
      attachments.push({
        id: newId('teamfile'),
        name,
        mime_type: mimeType,
        size: bytes,
        data_base64: dataBase64,
      });
    }

    if (!content && attachments.length === 0) {
      res.status(400).json({ detail: 'Message or attachment is required.' });
      return;
    }

    const sessionUser = req.user!;
    const message: DbTeamMessage = {
      id: newId('teammsg'),
      content,
      recipient_ids: cleanRecipientIds.length ? cleanRecipientIds : ['all'],
      recipient_names: cleanRecipientNames.length ? cleanRecipientNames : ['Everyone'],
      attachments,
      user_id: sessionUser.id,
      user_name: sessionUser.name,
      created_at: new Date().toISOString(),
    };
    if (!db.get().team_messages) db.get().team_messages = [];
    db.get().team_messages.push(message);
    db.save();
    res.status(201).json({
      ...message,
      attachments: (message.attachments || []).map(file => ({
        id: file.id,
        name: file.name,
        mime_type: file.mime_type,
        size: file.size,
        download_url: `/api/team-chat/${encodeURIComponent(message.id)}/attachments/${encodeURIComponent(file.id)}`,
      })),
    });
  });

  app.get('/api/team-chat/:message_id/attachments/:attachment_id', requireAuth, (req, res) => {
    const messageId = sanitizeString(req.params.message_id, 120);
    const attachmentId = sanitizeString(req.params.attachment_id, 120);
    const message = (db.get().team_messages || []).find(m => m.id === messageId);
    if (!message) {
      res.status(404).json({ detail: 'Team message not found.' });
      return;
    }
    const recipients = Array.isArray(message.recipient_ids) ? message.recipient_ids : [];
    if (!(recipients.length === 0 || recipients.includes('all') || recipients.includes(req.user!.id) || message.user_id === req.user!.id || req.user!.role === 'admin')) {
      res.status(403).json({ detail: 'You do not have access to this file.' });
      return;
    }
    const attachment = (message.attachments || []).find(file => file.id === attachmentId);
    if (!attachment) {
      res.status(404).json({ detail: 'Attachment not found.' });
      return;
    }
    const buffer = Buffer.from(attachment.data_base64, 'base64');
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.name.replace(/"/g, '')}"`);
    res.end(buffer);
  });

  app.delete('/api/team-chat/:message_id', requireAuth, (req, res) => {
    const messageId = sanitizeString(req.params.message_id, 120);
    const existing = (db.get().team_messages || []).find(m => m.id === messageId);
    if (!existing) {
      res.status(404).json({ detail: 'Team message not found.' });
      return;
    }
    if (existing.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ detail: 'Only the sender or an admin can delete this message.' });
      return;
    }
    db.get().team_messages = (db.get().team_messages || []).filter(m => m.id !== messageId);
    db.save();
    res.json({ success: true });
  });

  app.get('/api/emails', requireAuth, (req, res) => { res.json(db.get().emails); });

  app.get('/api/emails/history/:lead_id', requireAuth, (req, res) => {
    res.json(db.get().emails.filter(e => e.lead_id === req.params.lead_id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });


  app.get('/api/whatsapp', requireAuth, (req, res) => {
    const brandId = String(req.query.brand_id || '');
    const messages = brandId ? db.get().whatsapp.filter(w => w.brand_id === brandId) : db.get().whatsapp;
    res.json(messages.sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.get('/api/whatsapp/numbers', requireAuth, (req, res) => {
    res.json(db.get().whatsapp_numbers || {});
  });

  app.put('/api/whatsapp/numbers', requireAuth, (req, res) => {
    const numbers = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, string>;
    const clean: Record<string, string> = {};
    Object.entries(numbers).forEach(([brandId, value]) => {
      clean[sanitizeString(brandId, 50)] = sanitizeString(String(value || ''), 30);
    });
    db.get().whatsapp_numbers = clean;
    db.save();
    res.json(clean);
  });

  app.get('/api/whatsapp/history/:lead_id', requireAuth, (req, res) => {
    res.json(db.get().whatsapp.filter(w => w.lead_id === req.params.lead_id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });


  app.get('/api/whatsapp/templates', requireAuth, (req, res) => {
    const brandId = String(req.query.brand_id || '');
    const templates = db.get().whatsapp_templates || [];
    res.json((brandId ? templates.filter(t => t.brand_id === brandId) : templates).sort((a, b) => a.name.localeCompare(b.name)));
  });

  app.post('/api/whatsapp/templates', requireAuth, (req, res) => {
    const brand_id = sanitizeString(req.body.brand_id || '', 50);
    const name = sanitizeString(req.body.name || '', 120);
    const message = sanitizeString(req.body.message || '', 3000);
    if (!brand_id || !name || !message) { res.status(400).json({ detail: 'brand_id, name, and message are required' }); return; }
    const template: DbWhatsAppTemplate = { id: newId('wa_tpl'), brand_id, name, message, is_active: req.body.is_active !== false, updated_at: new Date().toISOString() };
    db.get().whatsapp_templates = [...(db.get().whatsapp_templates || []), template];
    db.save();
    res.status(201).json(template);
  });

  app.put('/api/whatsapp/templates/:template_id', requireAuth, (req, res) => {
    const { template_id } = req.params;
    const templates = db.get().whatsapp_templates || [];
    const idx = templates.findIndex(t => t.id === template_id);
    if (idx === -1) { res.status(404).json({ detail: 'Template not found' }); return; }
    templates[idx] = { ...templates[idx], brand_id: sanitizeString(req.body.brand_id || templates[idx].brand_id, 50), name: sanitizeString(req.body.name || templates[idx].name, 120), message: sanitizeString(req.body.message || templates[idx].message, 3000), is_active: req.body.is_active !== false, updated_at: new Date().toISOString() };
    db.get().whatsapp_templates = templates;
    db.save();
    res.json(templates[idx]);
  });

  app.delete('/api/whatsapp/templates/:template_id', requireAuth, (req, res) => {
    const { template_id } = req.params;
    const before = db.get().whatsapp_templates || [];
    const after = before.filter(t => t.id !== template_id);
    if (after.length === before.length) { res.status(404).json({ detail: 'Template not found' }); return; }
    db.get().whatsapp_templates = after;
    db.save();
    res.json({ success: true });
  });

  app.get('/api/webhooks/whatsapp', (req, res) => {
    const mode = sanitizeString(req.query['hub.mode'] || '', 80);
    const token = sanitizeString(req.query['hub.verify_token'] || '', 200);
    const challenge = sanitizeString(req.query['hub.challenge'] || '', 500);
    if (mode === 'subscribe' && token && getWhatsAppVerifyTokens(db).has(token)) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).json({ detail: 'Webhook verification failed.' });
  });

  app.post('/api/webhooks/whatsapp', (req, res) => {
    try {
      const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
      let changed = false;

      for (const entry of entries) {
        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change?.value || {};
          const phoneNumberId = sanitizeString(value?.metadata?.phone_number_id || '', 80);
          const displayPhoneNumber = sanitizeString(value?.metadata?.display_phone_number || '', 30);
          const brandId = resolveWhatsAppBrandId(db, phoneNumberId);
          if (!brandId) {
            console.warn('WhatsApp webhook received for an unmapped phone number id:', phoneNumberId);
            continue;
          }

          const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
          for (const status of statuses) {
            const providerMessageId = sanitizeString(status?.id || '', 180);
            const log = db.get().whatsapp.find(w => w.provider_message_id === providerMessageId);
            if (!log) continue;
            const nextStatus = sanitizeString(status?.status || '', 30);
            if (['sent', 'delivered', 'read', 'failed'].includes(nextStatus)) {
              log.status = nextStatus as DbWhatsApp['status'];
              changed = true;
            }
            if (Array.isArray(status?.errors) && status.errors.length > 0) {
              log.error_message = sanitizeString(status.errors[0]?.message || status.errors[0]?.title || 'WhatsApp delivery error', 500);
              changed = true;
            }
          }

          const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
          const messages = Array.isArray(value?.messages) ? value.messages : [];
          for (const inboundMessage of messages) {
            const fromNumber = normalizeWhatsAppDigits(inboundMessage?.from || '');
            const providerMessageId = sanitizeString(inboundMessage?.id || '', 180);
            if (!fromNumber || db.get().whatsapp.some(w => w.provider_message_id === providerMessageId)) continue;

            let lead = findLeadByWhatsAppPhone(db, brandId, fromNumber);
            if (!lead) {
              const profile = contacts.find((c: any) => normalizeWhatsAppDigits(c?.wa_id || '') === fromNumber)?.profile;
              const now = new Date().toISOString();
              lead = {
                id: newId('lead'),
                brand_id: brandId,
                brand_name: BRAND_NAMES[brandId] || brandId,
                name: sanitizeString(profile?.name || `WhatsApp Contact ${fromNumber.slice(-4)}`, 120),
                email: '',
                phone: `+${fromNumber}`,
                funnel_stage: 'New Lead',
                notes: 'Created from inbound WhatsApp message.',
                tags: ['WhatsApp Inbound'],
                custom_fields: { source: 'WhatsApp Inbound' },
                created_at: now,
              };
              db.get().leads.push(lead);
              changed = true;
            }

            const createdAt = Number(inboundMessage?.timestamp)
              ? new Date(Number(inboundMessage.timestamp) * 1000).toISOString()
              : new Date().toISOString();
            const messageText = extractWhatsAppInboundText(inboundMessage);
            db.get().whatsapp.push({
              id: newId('wa'),
              lead_id: lead.id,
              brand_id: brandId,
              from_number: `+${fromNumber}`,
              to_number: displayPhoneNumber,
              direction: 'inbound',
              provider: 'cloud_api',
              provider_message_id: providerMessageId,
              status: 'received',
              template_name: 'Inbound WhatsApp',
              message: messageText,
              created_by: 'WhatsApp webhook',
              created_at: createdAt,
            });
            db.get().notes.push({
              id: newId('note'),
              lead_id: lead.id,
              content: `Inbound WhatsApp received: "${messageText.substring(0, 120)}${messageText.length > 120 ? '...' : ''}"`,
              created_by: 'WhatsApp webhook',
              created_at: createdAt,
            });
            changed = true;
          }
        }
      }

      if (changed) db.save();
      res.json({ success: true });
    } catch (err) {
      console.error('WhatsApp webhook error:', err);
      res.status(500).json({ success: false, detail: err instanceof Error ? err.message : String(err) });
    }
  });

  // Brand-level integrations and reusable communication templates.
  app.get('/api/brand-integrations', requireAuth, (_req, res) => {
    res.json(db.get().brand_integrations || []);
  });

  app.get('/api/integrations/gmail/status/:brand_id', requireAdmin, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const integration = getBrandIntegration(db, brandId);
    const config = getGmailOAuthConfig(req);
    res.json({
      brand_id: brandId,
      configured: Boolean(config.clientId && config.clientSecret),
      redirect_uri: config.redirectUri,
      connected: Boolean(integration?.gmail_refresh_token),
      connected_email: integration?.gmail_connected_email || '',
      connected_at: integration?.gmail_connected_at || '',
      provider: integration?.email_provider || 'internal',
      scope: `${GMAIL_SEND_SCOPE} ${GMAIL_READONLY_SCOPE}`,
    });
  });

  app.post('/api/integrations/gmail/start/:brand_id', requireAdmin, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const config = getGmailOAuthConfig(req);
    if (!config.clientId || !config.clientSecret) {
      res.status(400).json({
        detail: 'Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then restart the CRM.',
        redirect_uri: config.redirectUri,
      });
      return;
    }

    const state = createGmailState(brandId, req.user!.id, extractReturnTo(req));
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: `${GMAIL_SEND_SCOPE} ${GMAIL_READONLY_SCOPE} ${GOOGLE_EMAIL_SCOPE}`,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    res.json({ auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, redirect_uri: config.redirectUri });
  });

  app.get('/api/integrations/gmail/callback', async (req, res) => {
    try {
      const code = sanitizeString(req.query.code || '', 4000);
      const state = sanitizeString(req.query.state || '', 200);
      const error = sanitizeString(req.query.error || '', 500);
      if (error) throw new Error(error);
      const stateEntry = decodeGmailState(state);
      if (!code || !stateEntry) {
        throw new Error('Gmail connection expired or invalid. Please start the connection again from the CRM.');
      }

      const requiredGmailScopes = [GMAIL_SEND_SCOPE, GMAIL_READONLY_SCOPE, GOOGLE_EMAIL_SCOPE];
      const callbackScope = Array.isArray(req.query.scope) ? req.query.scope.join(' ') : String(req.query.scope || '');
      const callbackMissingScopes = callbackScope ? missingScopes(callbackScope, requiredGmailScopes) : [];
      if (callbackMissingScopes.length > 0) {
        throw new Error(`Google returned login-only access instead of Gmail mailbox access. Start again from Integrations > Email > Connect Gmail and approve Gmail permissions. Missing: ${callbackMissingScopes.join(', ')}`);
      }

      const tokenData: any = await exchangeGoogleCodeForToken(code, req);
      const tokenMissingScopes = missingScopes(tokenData.scope || callbackScope, requiredGmailScopes);
      if (tokenMissingScopes.length > 0) {
        throw new Error(`Gmail connected without the required mailbox permissions. Disconnect/reconnect Gmail and approve Gmail send/read access. Missing: ${tokenMissingScopes.join(', ')}`);
      }
      const accessToken = sanitizeString(tokenData.access_token || '', 4000);
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile: any = await profileResponse.json();
      const connectedEmail = sanitizeString(profile?.email || '', 254).toLowerCase();
      const existing = getBrandIntegration(db, stateEntry.brandId);
      const refreshToken = sanitizeString(tokenData.refresh_token || existing?.gmail_refresh_token || '', 4000);
      if (!refreshToken) {
        throw new Error('Google did not return a refresh token. Remove the app access in Google Account permissions, then connect again.');
      }

      upsertBrandIntegration(db, stateEntry.brandId, {
        email_provider: 'gmail',
        email_sender_address: connectedEmail || existing?.email_sender_address || '',
        email_reply_to: existing?.email_reply_to || connectedEmail,
        gmail_connected_email: connectedEmail,
        gmail_refresh_token: refreshToken,
        gmail_access_token: accessToken,
        gmail_token_expiry: new Date(Date.now() + Number(tokenData.expires_in || 3600) * 1000).toISOString(),
        gmail_connected_at: new Date().toISOString(),
      });
      db.save();

      const frontendBase = getFrontendBaseUrl(req);
      const rawReturnTo = stateEntry.returnTo && stateEntry.returnTo !== '/' ? stateEntry.returnTo : '/';
      const returnUrl = sanitizeReturnTo(rawReturnTo, '/');
      let successUrl: string;
      if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) {
        successUrl = `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}gmail=success`;
      } else {
        successUrl = `${frontendBase}${returnUrl}${returnUrl.includes('?') ? '&' : '?'}gmail=success`;
      }
      res.send(`<!doctype html><html><head><title>Gmail connected</title><meta http-equiv="refresh" content="2;url=${successUrl}" /></head><body style="font-family:Arial,sans-serif;padding:32px;"><h2>Gmail connected</h2><p>${connectedEmail || 'Your Gmail account'} is now connected. Returning to CRM...</p><p><a href="${successUrl}">Back to CRM</a></p></body></html>`);
    } catch (err: any) {
      const frontendBase = getFrontendBaseUrl(req);
      const errorUrl = `${frontendBase}/?gmail=error`;
      res.status(400).send(`<!doctype html><html><head><title>Gmail connection failed</title></head><body style="font-family:Arial,sans-serif;padding:32px;"><h2>Gmail connection failed</h2><p>${sanitizeString(err?.message || 'Could not connect Gmail.', 1000)}</p><p><a href="${errorUrl}">Back to CRM</a></p></body></html>`);
    }
  });

  app.post('/api/integrations/gmail/test/:brand_id', requireAdmin, async (req, res) => {
    try {
      const brandId = sanitizeString(req.params.brand_id, 40);
      const toEmail = sanitizeString(req.body.to_email || '', 254).toLowerCase();
      if (!toEmail) { res.status(400).json({ detail: 'Test recipient email is required.' }); return; }
      const sessionUser = req.user!;
      const integration = getBrandIntegration(db, brandId);
      const emailId = newId('email');
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const pixelUrl = `${baseUrl}/api/track/open/${emailId}`;
      const brandName = BRAND_NAMES[brandId] || brandId;
      const subject = `Optima CRM Gmail test for ${brandName}`;
      const html = applyBrandEmailHeader(
        db,
        brandId,
        `<p>This is a test email from Optima CRM for <strong>${brandName}</strong>.</p><p>If you received this, Gmail sending is connected.</p><img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;outline:none;text-decoration:none" alt="" />`
      );
      const payload = await sendGmailMessage(db, brandId, req, {
        to: toEmail,
        subject,
        html,
      });
      db.get().emails.push({
        id: emailId,
        lead_id: '',
        subject,
        html_content: html,
        status: 'sent',
        template_name: 'Gmail Test Email',
        brand_id: brandId,
        to_email: toEmail,
        to_name: '',
        direction: 'outbound',
        mailbox_folder: 'sent',
        created_by: sessionUser.name,
        provider: integration?.email_provider || 'gmail',
        provider_message_id: sanitizeString(payload?.id || '', 200),
        created_at: new Date().toISOString(),
        open_count: 0,
      });
      db.save();
      res.json({ success: true, provider_message_id: payload?.id || '', to_email: toEmail });
    } catch (err: any) {
      res.status(400).json({ detail: sanitizeString(err?.message || 'Could not send Gmail test email.', 1000) });
    }
  });

  app.post('/api/integrations/gmail/sync/:brand_id', requireAdmin, async (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const integration = getBrandIntegration(db, brandId);
    if (!integration?.gmail_refresh_token) {
      res.status(400).json({ detail: 'Gmail is not connected for this brand.' });
      return;
    }

    try {
      const accessToken = await refreshGmailAccessToken(db, brandId, req);
      const connectedEmail = sanitizeString(integration.gmail_connected_email || integration.email_sender_address || '', 254).toLowerCase();
      let imported = 0;
      let skipped = 0;
      const folders = [
        { folder: 'inbox', labelIds: ['INBOX'] },
        { folder: 'spam', labelIds: ['SPAM'] },
        { folder: 'trash', labelIds: ['TRASH'] },
        { folder: 'drafts', labelIds: ['DRAFT'] },
        { folder: 'sent', labelIds: ['SENT'] },
      ];

      const seenMessageIds = new Set<string>();
      for (const folderDef of folders) {
        const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
        listUrl.searchParams.set('maxResults', '50');
        folderDef.labelIds.forEach(label => listUrl.searchParams.append('labelIds', label));
        listUrl.searchParams.set('q', 'newer_than:30d');
        if (folderDef.folder === 'spam' || folderDef.folder === 'trash') {
          listUrl.searchParams.set('includeSpamTrash', 'true');
        }

        const listResponse = await fetch(listUrl.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
        const listData: any = await listResponse.json();
        if (!listResponse.ok) throw new Error(friendlyGmailError(listData?.error?.message || listData?.error_description || listData?.error || 'Could not read Gmail messages.'));

        const messages = Array.isArray(listData.messages) ? listData.messages : [];
      for (const item of messages) {
        const messageId = sanitizeString(item?.id || '', 200);
        if (!messageId || seenMessageIds.has(messageId) || db.get().emails.some(e => e.provider_message_id === messageId)) {
          skipped++;
          continue;
        }
        seenMessageIds.add(messageId);

        const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const detail: any = await detailResponse.json();
        if (!detailResponse.ok) {
          skipped++;
          continue;
        }

        const headers = gmailHeaders(detail);
        const fromEmail = extractEmailAddress(headers.from);
        const toEmail = extractEmailAddress(headers.to) || connectedEmail;
        const isOutbound = fromEmail && connectedEmail && fromEmail === connectedEmail;

        const subject = cleanMailHeader(headers.subject || '(No subject)', 200);
        const body = gmailBody(detail) || sanitizeString(detail.snippet || '', 5000);
        const attachments = gmailAttachments(detail.payload);
        const createdAt = headers.date ? new Date(headers.date).toISOString() : new Date(Number(detail.internalDate || Date.now())).toISOString();
        const matchingLead = db.get().leads.find(l => (
          l.brand_id === brandId &&
          l.email &&
          fromEmail &&
          l.email.toLowerCase() === fromEmail
        ));
        const replyHtml = body.includes('<') ? body : body.replace(/\n/g, '<br />');

        db.get().emails.push({
          id: newId('email'),
          lead_id: matchingLead?.id || '',
          subject,
          html_content: replyHtml,
          status: folderDef.folder === 'sent' || isOutbound ? 'sent' : folderDef.folder === 'drafts' ? 'pending' : 'received',
          template_name: folderDef.folder === 'drafts' ? 'Gmail Draft' : folderDef.folder === 'sent' || isOutbound ? 'Gmail Sent' : 'Gmail Message',
          brand_id: brandId,
          to_email: toEmail,
          from_email: fromEmail,
          direction: folderDef.folder === 'sent' || isOutbound ? 'outbound' : 'inbound',
          mailbox_folder: folderDef.folder,
          created_by: 'Gmail sync',
          provider: 'gmail',
          provider_message_id: messageId,
          created_at: createdAt,
          open_count: 0,
          attachments,
        });

        if (matchingLead && folderDef.folder !== 'sent' && !isOutbound) {
          const plain = stripHtml(replyHtml);
          db.get().notes.push({
            id: newId('note'),
            lead_id: matchingLead.id,
            content: `Gmail reply received from ${fromEmail || 'unknown sender'}: "${plain.substring(0, 160)}${plain.length > 160 ? '...' : ''}"`,
            created_by: 'Gmail sync',
            created_at: createdAt,
          });
        }
        imported++;
      }
      }

      if (imported > 0) db.save();
      res.json({ success: true, imported, skipped });
    } catch (err: any) {
      res.status(400).json({ detail: sanitizeString(err?.message || 'Could not sync Gmail replies.', 1000) });
    }
  });

  app.delete('/api/integrations/gmail/message', requireAdmin, async (req, res) => {
    try {
      const providerMessageId = sanitizeString(req.body?.provider_message_id || '', 200);
      const brandId = sanitizeString(req.body?.brand_id || '', 40);
      if (!providerMessageId) {
        res.status(400).json({ detail: 'provider_message_id is required.' });
        return;
      }
      const integration = getBrandIntegration(db, brandId);
      if (!integration?.gmail_refresh_token) {
        res.status(400).json({ detail: 'Gmail is not connected for this brand.' });
        return;
      }
      const accessToken = await refreshGmailAccessToken(db, brandId, req);
      const deleteUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(providerMessageId)}`;
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!deleteResponse.ok && deleteResponse.status !== 204 && deleteResponse.status !== 404) {
        const data: any = await deleteResponse.json().catch(() => ({}));
        throw new Error(data?.error?.message || `Gmail delete failed with status ${deleteResponse.status}`);
      }
      res.json({ success: true, deleted: true });
    } catch (err: any) {
      res.status(400).json({ detail: sanitizeString(err?.message || 'Could not delete Gmail message.', 1000) });
    }
  });

  app.delete('/api/integrations/gmail/:brand_id', requireAdmin, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const existing = getBrandIntegration(db, brandId);
    upsertBrandIntegration(db, brandId, {
      email_provider: existing?.email_provider === 'gmail' ? 'internal' : existing?.email_provider || 'internal',
      gmail_connected_email: '',
      gmail_refresh_token: '',
      gmail_access_token: '',
      gmail_token_expiry: '',
      gmail_connected_at: '',
    });
    db.save();
    res.json({ success: true });
  });

  app.get('/api/integrations/outlook/status/:brand_id', requireAdmin, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const integration = getBrandIntegration(db, brandId);
    const config = getMicrosoftOAuthConfig(req);
    res.json({
      brand_id: brandId,
      configured: Boolean(config.clientId && config.clientSecret),
      redirect_uri: config.redirectUri,
      connected: Boolean(integration?.outlook_refresh_token),
      connected_email: integration?.outlook_connected_email || '',
      connected_at: integration?.outlook_connected_at || '',
      provider: integration?.email_provider || 'internal',
      scope: MICROSOFT_GRAPH_SCOPES,
    });
  });

  app.post('/api/integrations/outlook/start/:brand_id', requireAdmin, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const config = getMicrosoftOAuthConfig(req);
    if (!config.clientId || !config.clientSecret) {
      res.status(400).json({
        detail: 'Microsoft OAuth is not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in Render.',
        redirect_uri: config.redirectUri,
      });
      return;
    }
    const state = randomUUID();
    microsoftOAuthStates.set(state, { brandId, userId: req.user!.id, createdAt: Date.now() });
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: MICROSOFT_GRAPH_SCOPES,
      response_mode: 'query',
      prompt: 'select_account',
      state,
    });
    res.json({ auth_url: `https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/authorize?${params.toString()}`, redirect_uri: config.redirectUri });
  });

  app.get('/api/integrations/outlook/callback', async (req, res) => {
    try {
      const code = sanitizeString(req.query.code || '', 4000);
      const state = sanitizeString(req.query.state || '', 200);
      const error = sanitizeString(req.query.error || '', 500);
      if (error) throw new Error(error);
      const stateEntry = microsoftOAuthStates.get(state);
      microsoftOAuthStates.delete(state);
      if (!code || !stateEntry || Date.now() - stateEntry.createdAt > 10 * 60 * 1000) {
        throw new Error('Outlook connection expired. Please start the connection again from the CRM.');
      }
      const tokenData: any = await exchangeMicrosoftCodeForToken(code, req);
      const accessToken = sanitizeString(tokenData.access_token || '', 4000);
      const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile: any = await profileResponse.json();
      const connectedEmail = sanitizeString(profile?.mail || profile?.userPrincipalName || '', 254).toLowerCase();
      const existing = getBrandIntegration(db, stateEntry.brandId);
      const refreshToken = sanitizeString(tokenData.refresh_token || existing?.outlook_refresh_token || '', 4000);
      if (!refreshToken) throw new Error('Microsoft did not return a refresh token. Reconnect Outlook and approve offline access.');

      upsertBrandIntegration(db, stateEntry.brandId, {
        email_provider: 'outlook',
        email_sender_address: connectedEmail || existing?.email_sender_address || '',
        email_reply_to: existing?.email_reply_to || connectedEmail,
        outlook_connected_email: connectedEmail,
        outlook_refresh_token: refreshToken,
        outlook_access_token: accessToken,
        outlook_token_expiry: new Date(Date.now() + Number(tokenData.expires_in || 3600) * 1000).toISOString(),
        outlook_connected_at: new Date().toISOString(),
      });
      db.save();
      res.send(`<!doctype html><html><head><title>Outlook connected</title><meta http-equiv="refresh" content="2;url=/" /></head><body style="font-family:Arial,sans-serif;padding:32px;"><h2>Outlook connected</h2><p>${connectedEmail || 'Your Outlook account'} is now connected. Returning to Optima CRM...</p><p><a href="/">Back to CRM</a></p></body></html>`);
    } catch (err: any) {
      res.status(400).send(`<!doctype html><html><head><title>Outlook connection failed</title></head><body style="font-family:Arial,sans-serif;padding:32px;"><h2>Outlook connection failed</h2><p>${sanitizeString(err?.message || 'Could not connect Outlook.', 1000)}</p><p><a href="/">Back to CRM</a></p></body></html>`);
    }
  });

  app.post('/api/integrations/outlook/sync/:brand_id', requireAdmin, async (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const integration = getBrandIntegration(db, brandId);
    if (!integration?.outlook_refresh_token) {
      res.status(400).json({ detail: 'Outlook is not connected for this brand.' });
      return;
    }
    try {
      const accessToken = await refreshOutlookAccessToken(db, brandId, req);
      const connectedEmail = sanitizeString(integration.outlook_connected_email || integration.email_sender_address || '', 254).toLowerCase();
      let imported = 0;
      let skipped = 0;
      const folders = [
        { graph: 'inbox', folder: 'inbox' },
        { graph: 'sentitems', folder: 'sent' },
        { graph: 'junkemail', folder: 'spam' },
        { graph: 'drafts', folder: 'drafts' },
        { graph: 'deleteditems', folder: 'trash' },
      ];
      for (const folderDef of folders) {
        const url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderDef.graph}/messages?$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,sentDateTime,bodyPreview,body,hasAttachments&$expand=attachments($select=id,name,contentType,size,isInline)`;
        const listResponse = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const listData: any = await listResponse.json();
        if (!listResponse.ok) throw new Error(sanitizeString(listData?.error?.message || 'Could not read Outlook messages.', 1000));
        for (const message of Array.isArray(listData.value) ? listData.value : []) {
          const messageId = sanitizeString(message?.id || '', 300);
          if (!messageId || db.get().emails.some(e => e.provider_message_id === messageId)) { skipped++; continue; }
          const fromEmail = sanitizeString(message?.from?.emailAddress?.address || '', 254).toLowerCase();
          const toEmail = sanitizeString(message?.toRecipients?.[0]?.emailAddress?.address || connectedEmail || '', 254).toLowerCase();
          const isOutbound = fromEmail && connectedEmail && fromEmail === connectedEmail;
          const matchingLead = db.get().leads.find(l => l.brand_id === brandId && l.email && fromEmail && l.email.toLowerCase() === fromEmail);
          const attachments = (Array.isArray(message?.attachments) ? message.attachments : [])
            .filter((attachment: any) => !attachment?.isInline)
            .map((attachment: any) => ({
              id: sanitizeString(attachment?.id || '', 300),
              name: sanitizeString(attachment?.name || 'Attachment', 300),
              mime_type: sanitizeString(attachment?.contentType || '', 120),
              size: Number(attachment?.size || 0),
              provider: 'outlook',
            }));
          db.get().emails.push({
            id: newId('email'),
            lead_id: matchingLead?.id || '',
            brand_id: brandId,
            subject: cleanMailHeader(message?.subject || '(No subject)', 200),
            html_content: sanitizeString(message?.body?.content || message?.bodyPreview || '', 50000),
            body: sanitizeString(message?.bodyPreview || '', 5000),
            status: isOutbound ? 'sent' : 'received',
            direction: isOutbound ? 'outbound' : 'inbound',
            template_name: folderDef.folder === 'sent' ? 'Outlook Sent' : folderDef.folder === 'drafts' ? 'Outlook Draft' : 'Outlook Message',
            from_email: fromEmail,
            to_email: toEmail,
            provider: 'outlook',
            provider_message_id: messageId,
            mailbox_folder: folderDef.folder,
            created_by: 'Outlook sync',
            created_at: sanitizeString(message?.receivedDateTime || message?.sentDateTime || new Date().toISOString(), 80),
            open_count: 0,
            attachments,
          });
          imported++;
        }
      }
      db.save();
      res.json({ success: true, imported, skipped });
    } catch (err: any) {
      res.status(400).json({ detail: sanitizeString(err?.message || 'Could not sync Outlook messages.', 1000) });
    }
  });

  app.get('/api/brand-integrations/:brand_id/status', requireAdmin, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const prefix = brandEnvPrefix(brandId);
    const integration = getBrandIntegration(db, brandId);
    const tokenEnvName = sanitizeString(
      integration?.whatsapp_access_token_env ||
      process.env[`WHATSAPP_${prefix}_ACCESS_TOKEN_ENV`] ||
      `WHATSAPP_${prefix}_ACCESS_TOKEN`,
      120
    );
    const hasToken = Boolean(process.env[tokenEnvName] || process.env[`WHATSAPP_${prefix}_ACCESS_TOKEN`] || process.env.WHATSAPP_ACCESS_TOKEN);
    const hasPhoneNumberId = Boolean(integration?.whatsapp_phone_number_id || process.env[`WHATSAPP_${prefix}_PHONE_NUMBER_ID`] || process.env.WHATSAPP_PHONE_NUMBER_ID);
    const hasVerifyToken = Boolean(integration?.whatsapp_verify_token || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
    const provider = integration?.whatsapp_provider || 'manual';
    const missing: string[] = [];

    if (provider === 'cloud_api') {
      if (!hasPhoneNumberId) missing.push('Phone Number ID');
      if (!hasToken) missing.push(`server .env token (${tokenEnvName})`);
      if (!hasVerifyToken) missing.push('Webhook Verify Token');
    }

    const baseUrl = sanitizeString(process.env.PUBLIC_CRM_URL || `${req.protocol}://${req.get('host')}`, 300).replace(/\/$/, '');

    res.json({
      brand_id: brandId,
      whatsapp: {
        provider,
        api_ready: provider === 'cloud_api' && missing.length === 0,
        missing,
        phone_number_id_saved: Boolean(integration?.whatsapp_phone_number_id),
        access_token_env_name: tokenEnvName,
        access_token_found_on_server: hasToken,
        webhook_verify_token_saved: hasVerifyToken,
        webhook_callback_path: '/api/webhooks/whatsapp',
        webhook_callback_url: `${baseUrl}/api/webhooks/whatsapp`,
      },
      templates: {
        total: (db.get().message_templates || []).filter(t => t.brand_id === brandId).length,
        email: (db.get().message_templates || []).filter(t => t.brand_id === brandId && t.channel === 'email').length,
        whatsapp: (db.get().message_templates || []).filter(t => t.brand_id === brandId && t.channel === 'whatsapp').length,
        call: (db.get().message_templates || []).filter(t => t.brand_id === brandId && t.channel === 'call').length,
      },
    });
  });

  app.put('/api/brand-integrations/:brand_id', requireAdmin, (req, res) => {
    const { brand_id } = req.params;
    const current = db.get().brand_integrations || [];
    const idx = current.findIndex(i => i.brand_id === brand_id);
    const next: DbBrandIntegration = {
      id: idx >= 0 ? current[idx].id : newId('integration'),
      brand_id,
      email_provider: sanitizeString(req.body.email_provider || 'internal', 30),
      email_sender_name: sanitizeString(req.body.email_sender_name || '', 120),
      email_sender_address: sanitizeString(req.body.email_sender_address || '', 254).toLowerCase(),
      email_reply_to: sanitizeString(req.body.email_reply_to || '', 254).toLowerCase(),
      email_logo_url: sanitizeString(req.body.email_logo_url || '', 1000),
      email_signature: sanitizeString(req.body.email_signature || '', 2000),
      gmail_connected_email: current[idx]?.gmail_connected_email || '',
      gmail_refresh_token: current[idx]?.gmail_refresh_token || '',
      gmail_access_token: current[idx]?.gmail_access_token || '',
      gmail_token_expiry: current[idx]?.gmail_token_expiry || '',
      gmail_connected_at: current[idx]?.gmail_connected_at || '',
      outlook_connected_email: current[idx]?.outlook_connected_email || '',
      outlook_refresh_token: current[idx]?.outlook_refresh_token || '',
      outlook_access_token: current[idx]?.outlook_access_token || '',
      outlook_token_expiry: current[idx]?.outlook_token_expiry || '',
      outlook_connected_at: current[idx]?.outlook_connected_at || '',
      smtp_host: sanitizeString(req.body.smtp_host || '', 200),
      smtp_port: sanitizeString(req.body.smtp_port || '', 8),
      smtp_secure: Boolean(req.body.smtp_secure),
      smtp_username: sanitizeString(req.body.smtp_username || '', 254),
      smtp_password_env: sanitizeString(req.body.smtp_password_env || '', 120),
      email_accounts: sanitizeEmailAccounts(req.body.email_accounts),
      whatsapp_provider: sanitizeString(req.body.whatsapp_provider || 'manual', 40),
      whatsapp_number: sanitizeString(req.body.whatsapp_number || '', 30),
      whatsapp_phone_number_id: sanitizeString(req.body.whatsapp_phone_number_id || '', 80),
      whatsapp_business_account_id: sanitizeString(req.body.whatsapp_business_account_id || '', 80),
      whatsapp_access_token_env: sanitizeString(req.body.whatsapp_access_token_env || '', 120),
      whatsapp_verify_token: sanitizeString(req.body.whatsapp_verify_token || '', 200),
      whatsapp_profile_name: sanitizeString(req.body.whatsapp_profile_name || '', 120),
      whatsapp_profile_about: sanitizeString(req.body.whatsapp_profile_about || '', 260),
      whatsapp_profile_picture_url: sanitizeString(req.body.whatsapp_profile_picture_url || '', 1000),
      whatsapp_business_category: sanitizeString(req.body.whatsapp_business_category || '', 80),
      whatsapp_business_website: sanitizeString(req.body.whatsapp_business_website || '', 300),
      call_provider: sanitizeString(req.body.call_provider || 'manual', 40),
      call_number: sanitizeString(req.body.call_number || '', 30),
      automation_enabled: Boolean(req.body.automation_enabled),
      updated_at: new Date().toISOString(),
    };
    if (idx >= 0) current[idx] = next; else current.push(next);
    db.get().brand_integrations = current;
    db.save();
    res.json(next);
  });

  app.get('/api/message-templates', requireAuth, (req, res) => {
    const brandId = sanitizeString(req.query.brand_id || '', 40);
    const channel = sanitizeString(req.query.channel || '', 20);
    let templates = db.get().message_templates || [];
    if (brandId) templates = templates.filter(t => t.brand_id === brandId);
    if (channel) templates = templates.filter(t => t.channel === channel);
    res.json(templates);
  });

  app.post('/api/message-templates', requireAdmin, (req, res) => {
    const channel = sanitizeString(req.body.channel || 'email', 20) as DbMessageTemplate['channel'];
    if (!['email', 'whatsapp', 'call'].includes(channel)) { res.status(400).json({ detail: 'Invalid template channel.' }); return; }
    const template: DbMessageTemplate = {
      id: newId('template'),
      brand_id: sanitizeString(req.body.brand_id, 40),
      channel,
      name: sanitizeString(req.body.name, 120),
      subject: sanitizeString(req.body.subject || '', 200),
      body: sanitizeString(req.body.body || '', 10000),
      is_active: req.body.is_active !== false,
      updated_at: new Date().toISOString(),
    };
    if (!template.brand_id || !template.name || !template.body) { res.status(400).json({ detail: 'brand_id, name, and body are required.' }); return; }
    db.get().message_templates = [...(db.get().message_templates || []), template];
    db.save();
    res.status(201).json(template);
  });

  app.put('/api/message-templates/:template_id', requireAdmin, (req, res) => {
    const templates = db.get().message_templates || [];
    const idx = templates.findIndex(t => t.id === req.params.template_id);
    if (idx === -1) { res.status(404).json({ detail: 'Template not found' }); return; }
    const channel = req.body.channel ? sanitizeString(req.body.channel, 20) as DbMessageTemplate['channel'] : templates[idx].channel;
    if (!['email', 'whatsapp', 'call'].includes(channel)) { res.status(400).json({ detail: 'Invalid template channel.' }); return; }
    templates[idx] = {
      ...templates[idx],
      brand_id: req.body.brand_id !== undefined ? sanitizeString(req.body.brand_id, 40) : templates[idx].brand_id,
      channel,
      name: req.body.name !== undefined ? sanitizeString(req.body.name, 120) : templates[idx].name,
      subject: req.body.subject !== undefined ? sanitizeString(req.body.subject, 200) : templates[idx].subject,
      body: req.body.body !== undefined ? sanitizeString(req.body.body, 10000) : templates[idx].body,
      is_active: req.body.is_active !== false,
      updated_at: new Date().toISOString(),
    };
    db.get().message_templates = templates;
    db.save();
    res.json(templates[idx]);
  });

  app.delete('/api/message-templates/:template_id', requireAdmin, (req, res) => {
    const before = db.get().message_templates || [];
    const after = before.filter(t => t.id !== req.params.template_id);
    if (after.length === before.length) { res.status(404).json({ detail: 'Template not found' }); return; }
    db.get().message_templates = after;
    db.save();
    res.json({ success: true });
  });

  app.get('/api/calls/history/:lead_id', requireAuth, (req, res) => {
    res.json(db.get().calls.filter(c => c.lead_id === req.params.lead_id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.get('/api/calls', requireAuth, (_req, res) => {
    res.json(db.get().calls.sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.get('/api/enrollments/lead/:lead_id', requireAuth, (req, res) => {
    res.json(db.get().enrollments.filter(e => e.lead_id === req.params.lead_id));
  });

  // ─── Outgoing messages ────────────────────────────────────────────────────
  app.post('/api/emails/send', requireAuth, async (req, res) => {
    const { lead_id, template_name, brand_id } = req.body;
    const subject      = sanitizeString(req.body.subject, 200);
    const html_content = sanitizeString(req.body.html_content, 50000);
    if (!lead_id || !subject || !html_content) { res.status(400).json({ detail: 'lead_id, subject, and html_content are required' }); return; }
    let attachments: OutgoingEmailAttachment[] = [];
    try {
      attachments = sanitizeOutgoingEmailAttachments(req.body.attachments);
    } catch (err: any) {
      res.status(400).json({ detail: sanitizeString(err?.message || 'Invalid email attachments.', 1000) });
      return;
    }

    const sessionUser = req.user!;
    const lead = db.get().leads.find(l => l.id === lead_id);
    const effectiveBrandId = sanitizeString(brand_id || lead?.brand_id || '', 40);
    const integration = effectiveBrandId ? getBrandIntegration(db, effectiveBrandId) : undefined;
    const selectedAccount = getEmailAccountForSend(integration, sanitizeString(req.body.email_account_id || '', 80));
    const selectedProvider = selectedAccount?.provider || integration?.email_provider || 'internal';
    let providerMessageId = '';
    let sendStatus: DbEmail['status'] = 'sent';
    let errorMessage = '';

    // Generate ID upfront so the pixel URL can reference it
    const emailId = newId('email');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pixelUrl = `${baseUrl}/api/track/open/${emailId}`;
    const trackedHtml = `${html_content}<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;outline:none;text-decoration:none" alt="" />`;
    const storedHtml = ['gmail', 'outlook', 'yahoo', 'smtp'].includes(selectedProvider) ? applyBrandEmailHeader(db, effectiveBrandId, trackedHtml) : trackedHtml;

    if (['gmail', 'outlook', 'yahoo', 'smtp'].includes(selectedProvider)) {
      try {
        if (!lead?.email) throw new Error('Lead does not have an email address.');
        const payload = await sendProviderEmail(db, effectiveBrandId, req, {
          to: lead.email,
          subject,
          html: storedHtml,
          accountId: selectedAccount?.id,
          attachments,
        });
        providerMessageId = sanitizeString(payload?.messageId || '', 200);
      } catch (err: any) {
        sendStatus = 'failed';
        errorMessage = sanitizeString(err?.message || 'Email send failed.', 1000);
      }
    }
    const newEmail: DbEmail = {
      id: emailId,
      lead_id,
      subject,
      html_content: storedHtml,
      status: sendStatus,
      template_name: template_name || 'Standard Email',
      brand_id: effectiveBrandId,
      created_by: sessionUser.name,
      created_at: new Date().toISOString(),
      from_email: selectedAccount?.email || integration?.email_sender_address || '',
      provider: selectedProvider,
      provider_message_id: providerMessageId,
      error_message: errorMessage,
      mailbox_folder: sendStatus === 'failed' ? 'failed' : 'sent',
      open_count: 0,
      attachments: emailAttachmentMetadata(attachments),
    };
    db.get().emails.push(newEmail);
    db.get().notes.push({
      id: newId('note'),
      lead_id,
      content: `${sendStatus === 'sent' ? 'Email sent' : 'Email failed'}${['gmail', 'outlook', 'yahoo', 'smtp'].includes(selectedProvider) ? ` via ${selectedProvider}` : ''}${template_name ? ` ("${template_name}")` : ''}. Subject: "${subject}"${errorMessage ? ` Error: ${errorMessage}` : ''}`,
      created_by: sessionUser.name,
      created_at: new Date().toISOString(),
    });
    db.save();
    if (sendStatus === 'failed') { res.status(400).json(newEmail); return; }
    res.status(201).json(newEmail);
  });

  app.post('/api/emails/send-direct', requireAuth, async (req, res) => {
    const brandId = sanitizeString(req.body.brand_id || '', 40);
    const toEmail = sanitizeString(req.body.to_email || '', 254).toLowerCase();
    const recipientName = sanitizeString(req.body.to_name || '', 120);
    const subject = sanitizeString(req.body.subject, 200);
    const htmlContent = sanitizeString(req.body.html_content, 50000);
    const templateName = sanitizeString(req.body.template_name || 'Direct Email', 200);
    if (!brandId || !toEmail || !subject || !htmlContent) {
      res.status(400).json({ detail: 'brand_id, to_email, subject, and html_content are required' });
      return;
    }
    let attachments: OutgoingEmailAttachment[] = [];
    try {
      attachments = sanitizeOutgoingEmailAttachments(req.body.attachments);
    } catch (err: any) {
      res.status(400).json({ detail: sanitizeString(err?.message || 'Invalid email attachments.', 1000) });
      return;
    }

    const sessionUser = req.user!;
    const integration = getBrandIntegration(db, brandId);
    const selectedAccount = getEmailAccountForSend(integration, sanitizeString(req.body.email_account_id || '', 80));
    const selectedProvider = selectedAccount?.provider || integration?.email_provider || 'internal';
    let providerMessageId = '';
    let sendStatus: DbEmail['status'] = 'sent';
    let errorMessage = '';

    // Generate ID upfront for tracking pixel
    const directEmailId = newId('email');
    const baseUrlDirect = `${req.protocol}://${req.get('host')}`;
    const pixelUrlDirect = `${baseUrlDirect}/api/track/open/${directEmailId}`;
    const trackedHtmlDirect = `${htmlContent}<img src="${pixelUrlDirect}" width="1" height="1" style="display:none;border:0;outline:none;text-decoration:none" alt="" />`;
    const storedHtmlDirect = ['gmail', 'outlook', 'yahoo', 'smtp'].includes(selectedProvider) ? applyBrandEmailHeader(db, brandId, trackedHtmlDirect) : trackedHtmlDirect;

    if (['gmail', 'outlook', 'yahoo', 'smtp'].includes(selectedProvider)) {
      try {
        const payload = await sendProviderEmail(db, brandId, req, {
          to: toEmail,
          subject,
          html: storedHtmlDirect,
          accountId: selectedAccount?.id,
          attachments,
        });
        providerMessageId = sanitizeString(payload?.messageId || '', 200);
      } catch (err: any) {
        sendStatus = 'failed';
        errorMessage = sanitizeString(err?.message || 'Email send failed.', 1000);
      }
    }

    const newEmail: DbEmail = {
      id: directEmailId,
      lead_id: '',
      to_email: toEmail,
      to_name: recipientName,
      subject,
      html_content: storedHtmlDirect,
      status: sendStatus,
      template_name: templateName,
      brand_id: brandId,
      from_email: selectedAccount?.email || integration?.email_sender_address || '',
      created_by: sessionUser.name,
      created_at: new Date().toISOString(),
      provider: selectedProvider,
      provider_message_id: providerMessageId,
      error_message: errorMessage,
      mailbox_folder: sendStatus === 'failed' ? 'failed' : 'sent',
      open_count: 0,
      attachments: emailAttachmentMetadata(attachments),
    };
    db.get().emails.push(newEmail);
    db.save();
    if (sendStatus === 'failed') { res.status(400).json(newEmail); return; }
    res.status(201).json(newEmail);
  });

  app.post('/api/whatsapp/send', requireAuth, async (req, res) => {
    const { lead_id, template_name, brand_id, status } = req.body;
    const message = sanitizeString(req.body.message, 2000);
    const from_number = sanitizeString(req.body.from_number || '', 30);
    const lead = db.get().leads.find(l => l.id === lead_id);
    const effectiveBrandId = sanitizeString(brand_id || lead?.brand_id || '', 40);
    const to_number = sanitizeString(req.body.to_number || lead?.phone || '', 30);
    const cleanTo = normalizeWhatsAppDigits(to_number);
    const logOnly = Boolean(req.body.log_only);
    if (!effectiveBrandId || !message) { res.status(400).json({ detail: 'brand_id and message are required' }); return; }
    if (!cleanTo && !logOnly) { res.status(400).json({ detail: 'A phone number is required to send WhatsApp messages.' }); return; }

    const integration = getBrandIntegration(db, effectiveBrandId);
    const shouldUseCloudApi = integration?.whatsapp_provider === 'cloud_api' && !logOnly;
    let provider: DbWhatsApp['provider'] = shouldUseCloudApi ? 'cloud_api' : 'manual';
    let finalStatus: DbWhatsApp['status'] = status === 'draft' || status === 'failed' || status === 'replied' ? status : 'sent';
    let providerMessageId = '';
    let errorMessage = '';
    let responseStatus = 201;

    if (shouldUseCloudApi) {
      const config = resolveWhatsAppCloudConfig(db, effectiveBrandId);
      if (!config) {
        finalStatus = 'failed';
        errorMessage = 'WhatsApp Cloud API is selected, but the Phone Number ID or access token environment variable is missing.';
        responseStatus = 400;
      } else {
        try {
          const payload = await sendWhatsAppCloudText(config, to_number, message);
          providerMessageId = sanitizeString(payload?.messages?.[0]?.id || '', 180);
        } catch (err) {
          finalStatus = 'failed';
          errorMessage = err instanceof Error ? err.message : String(err);
          responseStatus = 502;
        }
      }
    }

    const newWa: DbWhatsApp = {
      id: newId('wa'),
      lead_id: lead_id || '',
      brand_id: effectiveBrandId,
      from_number,
      to_number,
      direction: 'outbound',
      provider,
      provider_message_id: providerMessageId,
      status: finalStatus,
      error_message: errorMessage,
      template_name: template_name || 'Manual WhatsApp',
      message,
      wa_link: cleanTo ? `https://wa.me/${cleanTo}?text=${encodeURIComponent(message)}` : '',
      created_by: req.user!.name,
      created_at: new Date().toISOString(),
    };
    db.get().whatsapp.push(newWa);
    if (lead_id) {
      db.get().notes.push({
        id: newId('note'),
        lead_id,
        content: `WhatsApp ${newWa.status || 'sent'} ${provider === 'cloud_api' ? 'via Cloud API' : 'log'} from ${from_number || 'brand number'} to ${to_number || 'lead phone'}. Content: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"${errorMessage ? ` Error: ${errorMessage}` : ''}`,
        created_by: req.user!.name,
        created_at: new Date().toISOString(),
      });
    }
    db.save();
    res.status(responseStatus).json(newWa);
  });

  app.post('/api/calls/log', requireAuth, (req, res) => {
    const { lead_id, outcome, duration } = req.body;
    const notes = sanitizeString(req.body.notes, 1000);
    if (!lead_id || !outcome) { res.status(400).json({ detail: 'lead_id and outcome are required' }); return; }

    const newCall: DbCall = {
      id: newId('call'),
      lead_id,
      outcome: sanitizeString(outcome, 100),
      notes,
      duration: duration || 0,
      created_by: req.user!.name,
      created_at: new Date().toISOString(),
    };
    db.get().calls.push(newCall);
    db.get().notes.push({
      id: newId('note'),
      lead_id,
      content: `Call logged: "${outcome}". Duration: ${Math.floor(newCall.duration! / 60)}m ${newCall.duration! % 60}s. Notes: ${notes || 'None'}`,
      created_by: req.user!.name,
      created_at: new Date().toISOString(),
    });
    db.save();
    res.status(201).json(newCall);
  });

  // ─── Custom fields ────────────────────────────────────────────────────────
  app.get('/api/brands/:brand_id/custom-fields', requireAuth, (req, res) => {
    res.json(db.get().custom_fields.filter(f => f.brand_id === req.params.brand_id));
  });

  app.post('/api/brands/:brand_id/custom-fields', requireAuth, (req, res) => {
    const { brand_id } = req.params;
    const field_name = sanitizeString(req.body.field_name, 60);
    const { field_type, required } = req.body;
    if (!field_name || !field_type) { res.status(400).json({ detail: 'field_name and field_type are required' }); return; }

    const exists = db.get().custom_fields.find(
      f => f.brand_id === brand_id && f.field_name.toLowerCase() === field_name.toLowerCase()
    );
    if (exists) { res.status(200).json(exists); return; }

    const newField: DbCustomField = {
      id: newId('col'),
      brand_id,
      field_name,
      field_type,
      required: !!required,
    };
    db.get().custom_fields.push(newField);
    db.save();
    res.status(201).json(newField);
  });

  app.delete('/api/custom-fields/:field_id', requireAuth, (req, res) => {
    db.get().custom_fields = db.get().custom_fields.filter(f => f.id !== req.params.field_id);
    db.save();
    res.json({ success: true });
  });

  // ─── Sequences ────────────────────────────────────────────────────────────
  app.get('/api/sequences', requireAuth, (req, res) => {
    const { brand_id } = req.query;
    let seqs = db.get().sequences;
    if (brand_id) seqs = seqs.filter(s => s.brand_id === brand_id);
    res.json(seqs);
  });

  app.post('/api/sequences', requireAuth, (req, res) => {
    const { brand_id, name, description, trigger_stage, active, steps } = req.body;
    if (!brand_id || !name) { res.status(400).json({ detail: 'brand_id and name are required' }); return; }

    const newSeq: DbSequence = {
      id: newId('seq'),
      brand_id: sanitizeString(brand_id, 40),
      name: sanitizeString(name, 120),
      description: sanitizeString(description, 500),
      trigger_stage: sanitizeString(trigger_stage, 80),
      active: active !== undefined ? active : true,
      steps: steps || [],
      created_at: new Date().toISOString(),
    };
    db.get().sequences.push(newSeq);
    db.save();
    res.status(201).json(newSeq);
  });

  app.put('/api/sequences/:seq_id', requireAuth, (req, res) => {
    const { seq_id } = req.params;
    const idx = db.get().sequences.findIndex(s => s.id === seq_id);
    if (idx === -1) { res.status(404).json({ detail: 'Sequence not found' }); return; }

    const orig = db.get().sequences[idx];
    const { name, description, trigger_stage, active, steps } = req.body;
    db.get().sequences[idx] = {
      ...orig,
      name:          name          !== undefined ? sanitizeString(name, 120)         : orig.name,
      description:   description   !== undefined ? sanitizeString(description, 500)  : orig.description,
      trigger_stage: trigger_stage !== undefined ? sanitizeString(trigger_stage, 80) : orig.trigger_stage,
      active:        active        !== undefined ? active                             : orig.active,
      steps:         steps         !== undefined ? steps                              : orig.steps,
    };
    db.save();
    res.json(db.get().sequences[idx]);
  });

  app.delete('/api/sequences/:seq_id', requireAuth, (req, res) => {
    const { seq_id } = req.params;
    db.get().sequences   = db.get().sequences.filter(s => s.id !== seq_id);
    db.get().enrollments = db.get().enrollments.filter(e => e.sequence_id !== seq_id);
    db.save();
    res.json({ success: true });
  });

  // Bulk enroll — uses shared helper
  app.post('/api/enrollments/bulk-enroll', requireAuth, (req, res) => {
    const { sequence_id, lead_ids } = req.body;
    if (!sequence_id || !lead_ids || !Array.isArray(lead_ids)) {
      res.status(400).json({ detail: 'sequence_id and lead_ids array are required' });
      return;
    }

    const seq = db.get().sequences.find(s => s.id === sequence_id);
    if (!seq) { res.status(404).json({ detail: 'Sequence not found' }); return; }

    let enrolledCount = 0;
    const sessionUserName = req.user!.name;

    for (const leadId of lead_ids) {
      const lead = db.get().leads.find(l => l.id === leadId);
      if (!lead) continue;

      // Pass session user name through for the note
      const enrolled = enrollLeadInSequence(lead, seq, sessionUserName);
      if (enrolled) enrolledCount++;
    }

    db.save();
    res.json({ success: true, enrolledCount });
  });

  // ─── CSV upload ───────────────────────────────────────────────────────────
  app.post('/api/leads/upload/preview', requireAuth, (req, res) => {
    const { csvText } = req.body;
    if (!csvText) { res.status(400).json({ detail: 'csvText is required' }); return; }

    function parseCSVLine(line: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += char; }
      }
      result.push(current.trim());
      return result.map(val => val.replace(/^"|"$/g, '').trim());
    }

    const lines = csvText.replace(/\r/g, '').split('\n').filter((l: string) => l.trim().length > 0);
    if (lines.length < 2) { res.status(400).json({ detail: 'CSV must have headers and at least one row' }); return; }

    const headers = parseCSVLine(lines[0]);
    const dataRows = lines.slice(1).map((line: string, i: number) => {
      const cols = parseCSVLine(line);
      const item: Record<string, string> = { id: `row-${i}` };
      headers.forEach((h: string, j: number) => { item[h] = cols[j] || ''; });
      return item;
    });

    res.json({ headers, preview: dataRows.slice(0, 5), totalRows: dataRows.length });
  });

  app.post('/api/leads/upload', requireAuth, (req, res) => {
    try {
      const { brand_id, brand_name, funnel_stage, mappings, dataRows, default_custom_fields } = req.body;
      if (!brand_id || !funnel_stage || !dataRows || !mappings) {
        res.status(400).json({ detail: 'brand_id, funnel_stage, mappings, and dataRows are required.' });
        return;
      }

      const sessionUser = req.user!;
      const existingCf = db.get().custom_fields.filter(f => f.brand_id === brand_id);
      const existingCfNames = new Set(existingCf.map(f => f.field_name.toLowerCase()));

      Object.keys(mappings).forEach(targetKey => {
        if (!['name', 'name_secondary', 'email', 'phone', 'created_at', 'id'].includes(targetKey)) {
          const cleanKey = sanitizeString(targetKey, 60);
          if (!existingCfNames.has(cleanKey.toLowerCase())) {
            db.get().custom_fields.push({
              id: newId('col'),
              brand_id,
              field_name: cleanKey,
              field_type: 'text',
              required: false,
            });
            existingCfNames.add(cleanKey.toLowerCase());
          }
        }
      });

      let addedCount = 0;
      let skippedCount = 0;

      for (const row of dataRows) {
        const firstName = sanitizeString(row[mappings.name], 120);
        const secondName = sanitizeString(row[mappings.name_secondary], 120);
        let name  = [firstName, secondName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        const email = sanitizeString(row[mappings.email], 254).toLowerCase();
        const phone = sanitizeString(row[mappings.phone], 30);

        if (!name) {
          if (email)      name = email.split('@')[0];
          else if (phone) name = `Contact ${phone}`;
          else {
            const first = Object.entries(row).find(([k, v]) => k !== 'id' && v && String(v).trim().length > 0 && String(v).length < 60);
            name = first ? sanitizeString(first[1], 120) : 'Unnamed Lead';
          }
        }

        // Skip duplicates during upload
        if (email && findExistingLead(db, email, brand_id)) {
          skippedCount++;
          continue;
        }

        let extraFields: Record<string, string> = { ...(default_custom_fields || {}) };
        Object.entries(mappings).forEach(([target, source]) => {
          if (!['name', 'name_secondary', 'email', 'phone', 'created_at'].includes(target) && source) {
            extraFields[sanitizeString(target, 60)] = sanitizeString(row[source as string], 500);
          }
        });

        // Apply brand defaults from config (no more hard-coded brand_id checks)
        const brandDefaults = BRAND_DEFAULTS[brand_id] || {};
        for (const [k, v] of Object.entries(brandDefaults)) {
          if (!extraFields[k]) extraFields[k] = v;
        }
        extraFields = normalizeImportedCustomFields(brand_id, extraFields);

        const sourceCreatedAt = mappings.created_at ? parseLeadDateInput(row[mappings.created_at]) : null;

        db.get().leads.push({
          id: newId('lead'),
          brand_id,
          brand_name: brand_name || 'Brand',
          name,
          email,
          phone,
          funnel_stage,
          tags: ['CSV Aggregator'],
          custom_fields: extraFields,
          created_at: sourceCreatedAt || new Date().toISOString(),
        });

        db.get().notes.push({
          id: newId('note'),
          lead_id: db.get().leads[db.get().leads.length - 1].id,
          content: 'Lead imported via bulk CSV uploader.',
          created_by: sessionUser.name,
          created_at: new Date().toISOString(),
        });

        addedCount++;
      }

      db.save();
      res.json({ success: true, count: addedCount, skipped: skippedCount });
    } catch (err: any) {
      console.error('CSV upload error:', err);
      res.status(500).json({ detail: err.message || 'Fatal error during CSV ingestion.' });
    }
  });

  // ─── Users ────────────────────────────────────────────────────────────────
  app.get('/api/users', requireAuth, (req, res) => {
    res.json(db.get().users.map(publicUser));
  });

  app.put('/api/team-presence', requireAuth, (req, res) => {
    const rawStatus = sanitizeString(req.body?.status || 'online', 20);
    const status = rawStatus === 'away' || rawStatus === 'offline' ? rawStatus : 'online';
    const user = updateUserPresence(req.user!.id, status);
    if (!user) {
      res.status(404).json({ detail: 'User not found.' });
      return;
    }
    res.json(publicUser(user));
  });

  // ─── Tasks ────────────────────────────────────────────────────────────────
  app.get('/api/tasks', requireAuth, (req, res) => {
    const { brand_id } = req.query;
    let tasks = db.get().tasks || [];
    if (brand_id) tasks = tasks.filter(t => t.brand_id === brand_id);
    res.json([...tasks].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.post('/api/tasks', requireAuth, (req, res) => {
    const { brand_id, status, location } = req.body;
    const content = sanitizeString(req.body.content, 2000);
    if (!brand_id || !content) { res.status(400).json({ detail: 'brand_id and content are required' }); return; }

    if (!db.get().tasks) db.get().tasks = [];
    const sessionUser = req.user!;
    const newTask: DbTask = {
      id: newId('task'),
      brand_id,
      user_id: sessionUser.id,
      user_name: sessionUser.name,
      user_location: sanitizeString(location, 100) || 'Remote Workspace',
      content,
      status: status || 'In Progress',
      created_at: new Date().toISOString(),
    };
    db.get().tasks.push(newTask);
    db.save();
    res.status(201).json(newTask);
  });

  app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    if (!db.get().tasks) db.get().tasks = [];
    db.get().tasks = db.get().tasks.filter(t => t.id !== req.params.id);
    db.save();
    res.json({ success: true });
  });

  // ─── User management ──────────────────────────────────────────────────────
  app.get('/api/auth/users', requireAdmin, (req, res) => {
    res.json(db.get().users.map(({ password, ...u }) => u));
  });

  app.post('/api/auth/users', requireAdmin, (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) { res.status(400).json({ detail: 'Missing required user fields' }); return; }
    const duplicate = db.get().users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (duplicate) { res.status(400).json({ detail: 'User email already registered.' }); return; }
    const newUser: DbUser = {
      id: newId('user'),
      name: sanitizeString(name, 120),
      email: sanitizeString(email, 254).toLowerCase(),
      password,
      role,
      created_at: new Date().toISOString(),
    };
    db.get().users.push(newUser);
    db.save();
    const { password: _, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  });

  app.put('/api/auth/users/:user_id', requireAuth, (req, res) => {
    const { user_id } = req.params;
    const idx = db.get().users.findIndex(u => u.id === user_id);
    if (idx === -1) { res.status(404).json({ detail: 'User not found' }); return; }
    if (req.user!.id !== user_id && req.user!.role !== 'admin') { res.status(403).json({ detail: 'You can only update your own profile.' }); return; }
    const orig = db.get().users[idx];
    const { name, email, role } = req.body;
    const isSelf = req.user!.id === user_id;
    db.get().users[idx] = {
      ...orig,
      name:  name  !== undefined ? sanitizeString(name, 120)             : orig.name,
      email: (isSelf || req.user!.role === 'admin') ? (email !== undefined ? sanitizeString(email, 254).toLowerCase() : orig.email) : orig.email,
      role: (isSelf || req.user!.role === 'admin') ? (role !== undefined ? role : orig.role) : orig.role,
    };
    db.save();
    const { password: _, ...safeUser } = db.get().users[idx];
    res.json(safeUser);
  });

  app.post('/api/auth/me/change-password', requireAuth, (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) { res.status(400).json({ detail: 'Current and new password are required' }); return; }
    if (String(new_password).length < 6) { res.status(400).json({ detail: 'Password must be at least 6 characters' }); return; }
    const idx = db.get().users.findIndex(u => u.id === req.user!.id);
    if (idx === -1) { res.status(404).json({ detail: 'User not found' }); return; }
    if (db.get().users[idx].password !== current_password) { res.status(400).json({ detail: 'Current password is incorrect' }); return; }
    db.get().users[idx].password = new_password;
    db.save();
    res.json({ success: true });
  });

  app.delete('/api/auth/users/:user_id', requireAdmin, (req, res) => {
    const { user_id } = req.params;
    if (req.user!.id === user_id) { res.status(400).json({ detail: 'You cannot delete your own account.' }); return; }
    db.get().users = db.get().users.filter(u => u.id !== user_id);
    db.save();
    res.json({ success: true });
  });

  app.post('/api/auth/users/:user_id/change-password', requireAdmin, (req, res) => {
    const { user_id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) { res.status(400).json({ detail: 'Password must be at least 6 characters' }); return; }
    const idx = db.get().users.findIndex(u => u.id === user_id);
    if (idx === -1) { res.status(404).json({ detail: 'User not found' }); return; }
    db.get().users[idx].password = password;
    db.save();
    res.json({ success: true });
  });

  // ─── Download zip ─────────────────────────────────────────────────────────
  app.get('/api/download-zip', async (req, res) => {
    const sessionUser = getSessionUser(req);
    if (!sessionUser || sessionUser.role !== 'admin') { return res.status(401).json({ error: 'Admin access required' }); }
    try {
      const { ZipArchive } = await import('archiver');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      res.setHeader('Content-Disposition', `attachment; filename="optima-crm-${timestamp}.zip"`);
      res.setHeader('Content-Type', 'application/zip');
      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.on('error', (err: Error) => { console.error('Zip error:', err); if (!res.headersSent) res.status(500).end(); });
      archive.pipe(res);
      const root = process.cwd();
      ['src', 'public'].forEach(dir => { const p = path.join(root, dir); if (fs.existsSync(p)) archive.directory(p, dir); });
      ['package.json', 'tsconfig.json', 'vite.config.ts', 'server.ts', 'index.html'].forEach(f => { const p = path.join(root, f); if (fs.existsSync(p)) archive.file(p, { name: f }); });
      await archive.finalize();
    } catch (err) {
      console.error('Download zip error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to create zip' });
    }
  });

  // ─── Vite dev / production static ─────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({ server: { middlewareMode: true, allowedHosts: true }, appType: 'spa' });
      app.use(vite.middlewares);
      console.log('Vite dev middleware loaded');
    } catch (err) {
      console.warn('Vite not available, falling back to static dist:', (err as Error).message);
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
      } else {
        app.get('*', (_req, res) => { res.status(503).send('<h2>App building... please wait and refresh.</h2>'); });
      }
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }

  app.listen(PORT, '0.0.0.0', () => { console.log(`Server running on http://0.0.0.0:${PORT}`); });
}

startServer().catch(err => { console.error('Failed to start server:', err); });
