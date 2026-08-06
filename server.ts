import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from 'crypto';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { LocalDb, DbUser, DbLead, DbNote, DbCall, DbEmail, DbWhatsApp, DbWhatsAppTemplate, DbMessageTemplate, DbBrandIntegration, DbSequence, DbCustomField, DbEnrollment, DbTask, DbTeamMessage, DbTeamNote, DbUsageEvent, DbEmailConnection, DbPortfolioOpportunity, DbPortfolioOpportunityRule, DbBrandFunnel } from './src/db/server_db.js';
import { registerLeadSourceRoutes } from './server/routes/leadSourceRoutes';
import { registerWebsiteAnalyticsRoutes } from './server/routes/websiteAnalyticsRoutes';
import { registerSocialHubRoutes, startSocialPostScheduler } from './server/routes/socialHubRoutes';
import { decryptSecret, encryptSecret } from './server/utils/secretVault';

// â”€â”€â”€ Brand config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Input validation helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function sanitizeString(val: unknown, maxLen = 500): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

function sanitizeLead(body: Record<string, any>) {
  const validClassifications = ['prospect', 'verified'];
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
    lead_classification: validClassifications.includes(body.lead_classification) ? body.lead_classification : undefined,
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

  const monthNames = [
    'january','february','march','april','may','june',
    'july','august','september','october','november','december'
  ];
  const monthAliases = [
    'jan','feb','mar','apr','may','jun',
    'jul','aug','sep','oct','nov','dec'
  ];

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

    const monthNameBeforeDate = raw.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (monthNameBeforeDate) {
      const [, monthStr, d, y] = monthNameBeforeDate;
      const mIndex = monthNames.findIndex(m => m.startsWith(monthStr.toLowerCase().slice(0, 3)));
      if (mIndex >= 0) {
        const date = new Date(Date.UTC(Number(y), mIndex, Number(d)));
        if (!Number.isNaN(date.getTime())) return date.toISOString();
      }
    }

    const monthNameAfterDate = raw.match(/^(\d{1,2})\s+([a-zA-Z]+),?\s+(\d{4})/i);
    if (monthNameAfterDate) {
      const [, d, monthStr, y] = monthNameAfterDate;
      const mIndex = monthNames.findIndex(m => m.startsWith(monthStr.toLowerCase().slice(0, 3)));
      if (mIndex >= 0) {
        const date = new Date(Date.UTC(Number(y), mIndex, Number(d)));
        if (!Number.isNaN(date.getTime())) return date.toISOString();
      }
    }

    const timeWithDate = raw.match(/^(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?),?\s*([\d/-]+)$/i);
    if (timeWithDate) {
      const [, timeStr, dateStr] = timeWithDate;
      const datePart = parseLeadDateInput(dateStr);
      if (datePart) {
        const base = new Date(datePart);
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
        if (timeMatch) {
          let hours = Number(timeMatch[1]);
          const minutes = Number(timeMatch[2]);
          const seconds = timeMatch[3] ? Number(timeMatch[3]) : 0;
          const ampm = timeMatch[4]?.toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
          base.setUTCHours(hours, minutes, seconds, 0);
        }
        return base.toISOString();
      }
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

// â”€â”€â”€ Deduplication helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function findExistingLead(db: LocalDb, email: string, brandId: string): DbLead | undefined {
  if (!email) return undefined;
  return db.get().leads.find(
    l => l.email.toLowerCase() === email.toLowerCase() && l.brand_id === brandId
  );
}

function normalizePhone(phone: string): string {
  const digits = sanitizeString(phone, 40).replace(/\D/g, '');
  // A short number (for example a year, postcode, or spreadsheet ID) is not
  // reliable enough to identify a contact.
  return digits.length >= 7 && digits.length <= 16 ? digits : '';
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

// Names that should never be treated as a real identity match (import fallbacks).
const GENERIC_LEAD_NAMES = new Set(['unnamed lead']);

function isGenericLeadName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (GENERIC_LEAD_NAMES.has(n)) return true;
  if (n.startsWith('contact ')) return true; // e.g. "Contact 0412345678"
  return false;
}

function findExistingLeadByName(db: LocalDb, name: string, brandId: string): DbLead | undefined {
  const cleanName = sanitizeString(name, 120).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!cleanName || isGenericLeadName(cleanName)) return undefined;
  return db.get().leads.find(l => l.brand_id === brandId && String(l.name || '').toLowerCase().replace(/\s+/g, ' ').trim() === cleanName);
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
  const deleted = new Set((((db.get() as any).deleted_custom_fields || {})[brandId] || []).map((name: string) => String(name).toLowerCase()));
  const existing = new Set(
    db.get().custom_fields
      .filter(f => f.brand_id === brandId)
      .map(f => f.field_name.toLowerCase())
  );

  for (const fieldName of Object.keys(fields)) {
    const cleanFieldName = sanitizeString(fieldName, 60);
    if (!cleanFieldName || existing.has(cleanFieldName.toLowerCase()) || deleted.has(cleanFieldName.toLowerCase())) continue;
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

// â”€â”€â”€ ID generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_HASH_PREFIX = 'scrypt$';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_HASH_PREFIX}${salt}$${hash}`;
}

function verifyPassword(password: string, stored?: string): boolean {
  if (!stored) return false;
  // Reject any credential not stored as a proper scrypt hash. Earlier code
  // accepted plaintext here (`stored === password`), which kept leaked
  // plaintext values usable for login. Plaintext is never a valid stored form.
  if (!stored.startsWith(PASSWORD_HASH_PREFIX)) return false;
  const [, salt, expectedHex] = stored.split('$');
  if (!salt || !expectedHex) return false;
  const actual = Buffer.from(scryptSync(password, salt, 64).toString('hex'), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function issueSession(user: DbUser): string {
  const token = randomBytes(32).toString('hex');
  user.session_token = token;
  user.session_expires_at = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  return token;
}

function clearSession(user?: DbUser | null): void {
  if (!user) return;
  user.session_token = '';
  user.session_expires_at = '';
}

function isSessionValid(user: DbUser | undefined, token: string): user is DbUser {
  if (!user || !token || user.session_token !== token) return false;
  const expires = user.session_expires_at ? new Date(user.session_expires_at).getTime() : 0;
  return expires > Date.now();
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

const DEFAULT_TENANT_ID = 'default';

function publicEmailConnection(connection: DbEmailConnection) {
  const { access_token, refresh_token, smtp_password, imap_password, ...safe } = connection;
  return safe;
}

function publicBrandIntegration(integration: DbBrandIntegration) {
  const {
    gmail_refresh_token,
    gmail_access_token,
    outlook_refresh_token,
    outlook_access_token,
    whatsapp_verify_token,
    whatsapp_access_token_encrypted,
    ...safe
  } = integration;
  return {
    ...safe,
    gmail_connected: Boolean(integration.gmail_refresh_token || integration.gmail_connected_email),
    outlook_connected: Boolean(integration.outlook_refresh_token || integration.outlook_connected_email),
    whatsapp_verify_token_saved: Boolean(integration.whatsapp_verify_token),
    whatsapp_connected: Boolean(integration.whatsapp_access_token_encrypted && integration.whatsapp_phone_number_id),
  };
}

function getEmailConnections(db: LocalDb, brandId?: string, provider?: string): DbEmailConnection[] {
  return (db.get().email_connections || [])
    .filter(connection => !brandId || connection.brand_id === brandId)
    .filter(connection => !provider || connection.provider === provider);
}

function getDefaultEmailConnection(db: LocalDb, brandId: string, provider?: string): DbEmailConnection | undefined {
  const connections = getEmailConnections(db, brandId, provider)
    .filter(connection => connection.connection_status === 'connected');
  return connections.find(connection => connection.is_default) || connections[0];
}

function getEmailBrandId(db: LocalDb, email: DbEmail): string {
  if (email.brand_id) return email.brand_id;
  return (db.get().leads || []).find(lead => lead.id === email.lead_id)?.brand_id || '';
}

function isProviderMailConnected(db: LocalDb, email: DbEmail): boolean {
  const provider = sanitizeString(email.provider || 'internal', 40).toLowerCase();
  if (!provider || provider === 'internal') return true;
  const brandId = getEmailBrandId(db, email);
  if (!brandId) return true;
  const integration = getBrandIntegration(db, brandId);
  const activeConnections = getEmailConnections(db, brandId, provider)
    .filter(connection => connection.connection_status === 'connected');
  if (provider === 'gmail') {
    return Boolean(
      integration?.gmail_refresh_token ||
      activeConnections.some(connection => connection.refresh_token || connection.connection_status === 'connected'),
    );
  }
  if (provider === 'outlook') {
    return Boolean(
      integration?.outlook_refresh_token ||
      activeConnections.some(connection => connection.refresh_token || connection.connection_status === 'connected'),
    );
  }
  if (provider === 'custom_smtp_imap') {
    return activeConnections.length > 0;
  }
  if (['smtp', 'yahoo'].includes(provider)) {
    return Boolean(
      (integration?.email_accounts || []).some(account => account.provider === provider) ||
      activeConnections.length > 0,
    );
  }
  return true;
}

function getVisibleEmails(db: LocalDb, emails = db.get().emails || []): DbEmail[] {
  // Never let a single bad row hide the whole mailbox.
  try {
    return (emails || []).filter(email => {
      try {
        return isProviderMailConnected(db, email);
      } catch {
        return true;
      }
    });
  } catch {
    return emails || [];
  }
}

function normalizedContact(value: unknown): string {
  return sanitizeString(value || '', 254).toLowerCase().replace(/\s+/g, '');
}

function portfolioFieldValue(lead: DbLead, field: string): string {
  const key = sanitizeString(field || 'stage', 80).toLowerCase();
  if (['stage', 'funnel_stage', 'status'].includes(key)) return sanitizeString(lead.funnel_stage || '', 240);
  if (['source', 'lead_source'].includes(key)) return sanitizeString((lead as any).source || lead.custom_fields?.source || lead.custom_fields?.lead_source || lead.custom_fields?.source_name || '', 240);
  if (['segment', 'lead_type'].includes(key)) return sanitizeString(lead.custom_fields?.segment || lead.custom_fields?.lead_type || '', 240);
  const direct = (lead as any)[field];
  const custom = lead.custom_fields?.[field] ?? lead.custom_fields?.[key];
  return sanitizeString(direct ?? custom ?? '', 240);
}

function portfolioRuleMatches(lead: DbLead, rule: DbPortfolioOpportunityRule): boolean {
  const actual = portfolioFieldValue(lead, rule.trigger_field).toLowerCase();
  const expected = sanitizeString(rule.trigger_value || '', 240).toLowerCase();
  if (!expected) return false;
  if (rule.trigger_operator === 'equals') return actual === expected;
  return actual.includes(expected);
}

function keywordList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(',') : sanitizeString(value || '', 4000);
  return Array.from(new Set(raw
    .split(/[\n,;|]/)
    .map(item => item.trim().toLowerCase())
    .filter(item => item.length >= 3)
    .slice(0, 40)));
}

function wordsFromText(value: unknown): string[] {
  return sanitizeString(value || '', 4000)
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .map(item => item.trim())
    .filter(item => item.length >= 4);
}

function brandProfileKeywords(brand: Partial<DbBrandFunnel> | undefined): string[] {
  if (!brand) return [];
  return Array.from(new Set([
    ...keywordList(brand.audience_keywords || []),
    ...wordsFromText(brand.target_audience),
    ...wordsFromText(brand.description),
    ...wordsFromText(brand.cross_sell_notes),
  ])).slice(0, 60);
}

function normalizeCountry(value: unknown): string {
  const raw = sanitizeString(value || '', 120).toLowerCase().trim();
  if (!raw) return '';
  const compact = raw.replace(/[^a-z]/g, '');
  const aliases: Record<string, string> = {
    zim: 'zimbabwe',
    zw: 'zimbabwe',
    zimbabwe: 'zimbabwe',
    australia: 'australia',
    aus: 'australia',
    au: 'australia',
    southafrica: 'south africa',
    rsa: 'south africa',
    za: 'south africa',
    uk: 'united kingdom',
    gb: 'united kingdom',
    unitedkingdom: 'united kingdom',
    usa: 'united states',
    us: 'united states',
    unitedstates: 'united states',
  };
  return aliases[compact] || raw;
}

function brandMarketCountries(brand: Partial<DbBrandFunnel> | undefined): string[] {
  if (!brand) return [];
  return keywordList(brand.market_countries || []).map(normalizeCountry).filter(Boolean);
}

function leadCountrySignals(lead: DbLead): string[] {
  const fields = lead.custom_fields || {};
  const candidates = [
    fields.country,
    fields.countryregion,
    fields.country_region,
    fields.location,
    fields.city,
    fields.address,
    fields.property_location,
    fields.region,
    fields.state,
    lead.notes,
    lead.phone?.startsWith('+263') ? 'Zimbabwe' : '',
    lead.phone?.startsWith('+61') ? 'Australia' : '',
    lead.phone?.startsWith('+27') ? 'South Africa' : '',
    lead.phone?.startsWith('+44') ? 'United Kingdom' : '',
    lead.phone?.startsWith('+1') ? 'United States' : '',
  ];
  const text = candidates.map(item => sanitizeString(item || '', 500).toLowerCase()).join(' ');
  const countries = ['zimbabwe', 'australia', 'south africa', 'united kingdom', 'united states'];
  const matched = countries.filter(country => text.includes(country));
  return Array.from(new Set([
    ...matched,
    ...candidates.map(normalizeCountry).filter(Boolean),
  ]));
}

function marketCompatible(lead: DbLead, targetBrand: DbBrandFunnel): { ok: boolean; reason?: string } {
  if (sanitizeString(targetBrand.market_scope || 'global', 40) !== 'country_specific') return { ok: true };
  const allowed = brandMarketCountries(targetBrand);
  if (!allowed.length) return { ok: false, reason: 'Target brand is country-specific but has no allowed countries set.' };
  const leadCountries = leadCountrySignals(lead);
  if (!leadCountries.length) return { ok: false, reason: 'Lead has no clear country signal.' };
  const ok = leadCountries.some(country => allowed.includes(country));
  return ok ? { ok: true } : { ok: false, reason: `Lead market (${leadCountries.join(', ')}) is outside ${targetBrand.brand_name}.` };
}

function keywordFit(lead: DbLead, keywords: string[], minimumMatches = 1) {
  const haystack = leadPortfolioText(lead);
  const matched = keywords.filter(keyword => haystack.includes(keyword)).slice(0, 12);
  return { ok: matched.length >= minimumMatches, matched };
}

function portfolioRuleFit(lead: DbLead, rule: DbPortfolioOpportunityRule, targetBrand: DbBrandFunnel) {
  if (!portfolioRuleMatches(lead, rule)) return null;
  if (rule.respect_market_scope !== false) {
    const market = marketCompatible(lead, targetBrand);
    if (!market.ok) return null;
  }
  const excluded = keywordFit(lead, keywordList(rule.excluded_keywords || []), 1);
  if (excluded.ok) return null;
  const required = keywordList(rule.required_keywords || []);
  if (required.length) {
    const fit = keywordFit(lead, required, Math.max(1, Number(rule.minimum_keyword_matches || 1)));
    if (!fit.ok) return null;
    return { matched_keywords: fit.matched };
  }
  return { matched_keywords: [] };
}

function leadPortfolioText(lead: DbLead): string {
  const customValues = Object.values(lead.custom_fields || {}).join(' ');
  const tags = Array.isArray(lead.tags) ? lead.tags.join(' ') : String(lead.tags || '');
  return [
    lead.name,
    lead.email,
    lead.phone,
    lead.funnel_stage,
    lead.notes,
    tags,
    customValues,
  ].map(value => sanitizeString(value || '', 4000)).join(' ').toLowerCase();
}

function matchLeadToBrandProfile(lead: DbLead, targetBrand: DbBrandFunnel) {
  const keywords = brandProfileKeywords(targetBrand);
  if (keywords.length < 2) return null;
  const market = marketCompatible(lead, targetBrand);
  if (!market.ok) return null;
  const haystack = leadPortfolioText(lead);
  const matched = keywords.filter(keyword => haystack.includes(keyword)).slice(0, 8);
  if (matched.length < 2) return null;
  return {
    matched_keywords: matched,
    score: Math.min(100, matched.length * 20),
  };
}

function getEmailConnectionById(db: LocalDb, connectionId?: string): DbEmailConnection | undefined {
  const cleanId = sanitizeString(connectionId || '', 120);
  if (!cleanId) return undefined;
  return (db.get().email_connections || []).find(connection => connection.id === cleanId);
}

function upsertEmailConnection(db: LocalDb, patch: Partial<DbEmailConnection> & { brand_id: string; provider: string; provider_email: string }): DbEmailConnection {
  const current = db.get().email_connections || [];
  const provider = sanitizeString(patch.provider, 40);
  const providerEmail = sanitizeString(patch.provider_email, 254).toLowerCase();
  const existingIndex = current.findIndex(connection => (
    connection.id === patch.id ||
    (connection.brand_id === patch.brand_id && connection.provider === provider && connection.provider_email === providerEmail)
  ));
  const now = new Date().toISOString();
  const existing = existingIndex >= 0 ? current[existingIndex] : undefined;
  const shouldDefault = patch.is_default ?? !current.some(connection => connection.brand_id === patch.brand_id && connection.connection_status === 'connected');
  const next: DbEmailConnection = {
    id: existing?.id || newId('email-connection'),
    tenant_id: sanitizeString(patch.tenant_id || existing?.tenant_id || DEFAULT_TENANT_ID, 80),
    brand_id: sanitizeString(patch.brand_id, 40),
    provider,
    provider_email: providerEmail,
    display_name: sanitizeString(patch.display_name || existing?.display_name || providerEmail, 160),
    smtp_host: sanitizeString(patch.smtp_host || existing?.smtp_host || '', 200),
    smtp_port: sanitizeString(patch.smtp_port || existing?.smtp_port || '', 8),
    smtp_secure: Boolean(patch.smtp_secure ?? existing?.smtp_secure),
    smtp_username: sanitizeString(patch.smtp_username || existing?.smtp_username || providerEmail, 254),
    smtp_password: sanitizeString(patch.smtp_password || existing?.smtp_password || '', 2000),
    smtp_password_env: sanitizeString(patch.smtp_password_env || existing?.smtp_password_env || '', 120),
    imap_host: sanitizeString(patch.imap_host || existing?.imap_host || '', 200),
    imap_port: sanitizeString(patch.imap_port || existing?.imap_port || '', 8),
    imap_secure: Boolean(patch.imap_secure ?? existing?.imap_secure),
    imap_username: sanitizeString(patch.imap_username || existing?.imap_username || providerEmail, 254),
    imap_password: sanitizeString(patch.imap_password || existing?.imap_password || '', 2000),
    imap_password_env: sanitizeString(patch.imap_password_env || existing?.imap_password_env || '', 120),
    send_enabled: patch.send_enabled ?? existing?.send_enabled ?? true,
    sync_enabled: patch.sync_enabled ?? existing?.sync_enabled ?? false,
    access_token: sanitizeString(patch.access_token || existing?.access_token || '', 4000),
    refresh_token: sanitizeString(patch.refresh_token || existing?.refresh_token || '', 4000),
    token_expiry: sanitizeString(patch.token_expiry || existing?.token_expiry || '', 80),
    connection_status: sanitizeString(patch.connection_status || existing?.connection_status || 'connected', 40),
    connected_at: sanitizeString(patch.connected_at || existing?.connected_at || now, 80),
    updated_at: now,
    created_by_user_id: sanitizeString(patch.created_by_user_id || existing?.created_by_user_id || '', 80),
    is_default: Boolean(shouldDefault),
    last_sync_at: sanitizeString(patch.last_sync_at || existing?.last_sync_at || '', 80),
    last_error: sanitizeString(patch.last_error || existing?.last_error || '', 1000),
    scopes: Array.isArray(patch.scopes) ? patch.scopes.map(scope => sanitizeString(scope, 200)).filter(Boolean) : existing?.scopes || [],
    oauth_mode: sanitizeString(patch.oauth_mode || existing?.oauth_mode || 'central', 40),
  };
  if (next.is_default) {
    current.forEach(connection => {
      if (connection.brand_id === next.brand_id && connection.id !== next.id) connection.is_default = false;
    });
  }
  if (existingIndex >= 0) current[existingIndex] = next; else current.push(next);
  db.get().email_connections = current;
  return next;
}

function ensureLegacyEmailConnections(db: LocalDb) {
  (db.get().brand_integrations || []).forEach(integration => {
    if (integration.gmail_refresh_token && integration.gmail_connected_email) {
      upsertEmailConnection(db, {
        brand_id: integration.brand_id,
        provider: 'gmail',
        provider_email: integration.gmail_connected_email,
        access_token: integration.gmail_access_token,
        refresh_token: integration.gmail_refresh_token,
        token_expiry: integration.gmail_token_expiry,
        connected_at: integration.gmail_connected_at || new Date().toISOString(),
        connection_status: 'connected',
        is_default: integration.email_provider === 'gmail',
        oauth_mode: 'central',
        scopes: [GMAIL_SEND_SCOPE, GMAIL_READONLY_SCOPE, GOOGLE_EMAIL_SCOPE],
      });
    }
    if (integration.outlook_refresh_token && integration.outlook_connected_email) {
      upsertEmailConnection(db, {
        brand_id: integration.brand_id,
        provider: 'outlook',
        provider_email: integration.outlook_connected_email,
        access_token: integration.outlook_access_token,
        refresh_token: integration.outlook_refresh_token,
        token_expiry: integration.outlook_token_expiry,
        connected_at: integration.outlook_connected_at || new Date().toISOString(),
        connection_status: 'connected',
        is_default: integration.email_provider === 'outlook',
        oauth_mode: 'central',
        scopes: MICROSOFT_GRAPH_SCOPES.split(' '),
      });
    }
  });
}

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
/** Required to trash/delete messages in Gmail (readonly cannot modify mailbox). */
const GMAIL_MODIFY_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
const GOOGLE_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const GMAIL_OAUTH_SCOPES = [GMAIL_SEND_SCOPE, GMAIL_READONLY_SCOPE, GMAIL_MODIFY_SCOPE, GOOGLE_EMAIL_SCOPE];
/** Minimum scopes to finish connect; modify is also requested so CRM delete can trash Gmail messages. */
const GMAIL_REQUIRED_CONNECT_SCOPES = [GMAIL_SEND_SCOPE, GMAIL_READONLY_SCOPE, GOOGLE_EMAIL_SCOPE];
const MICROSOFT_GRAPH_SCOPES = 'offline_access openid email profile User.Read Mail.Read Mail.Send';
/** Legacy in-memory Outlook states (pre signed-state). Kept only as a short fallback during deploy rollout. */
const microsoftOAuthStates = new Map<string, { brandId: string; userId: string; createdAt: number; returnTo?: string }>();

/**
 * True when a URL/origin is the API host (Render), not the SPA (Vercel).
 * PUBLIC_CRM_URL is often mis-set to the Render service — never bounce OAuth there.
 */
function isApiHostUrl(value: string): boolean {
  const raw = sanitizeString(value || '', 300).replace(/\/$/, '');
  if (!raw) return false;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase();
    if (!host) return false;
    if (host.endsWith('.onrender.com')) return true;
    const apiEnv = [
      process.env.PUBLIC_API_URL,
      process.env.API_PUBLIC_URL,
      process.env.SAAS_API_URL,
    ]
      .map(s => sanitizeString(s || '', 300).replace(/\/$/, ''))
      .filter(Boolean);
    for (const api of apiEnv) {
      try {
        if (new URL(api.includes('://') ? api : `https://${api}`).hostname.toLowerCase() === host) return true;
      } catch { /* ignore */ }
    }
  } catch {
    return false;
  }
  return false;
}

/** Vercel SPA / local dev — safe browser bounce targets after OAuth on the API host. */
function isSpaFrontendOrigin(origin: string): boolean {
  const clean = origin.replace(/\/$/, '');
  if (!clean) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(clean)) return true;
  try {
    const host = new URL(clean).hostname.toLowerCase();
    // Product UI is hosted on Vercel (e.g. dirotiq-crm.vercel.app); API is on Render.
    if (host.endsWith('.vercel.app')) return true;
  } catch {
    return false;
  }
  return false;
}

/** Origins the SPA may live on (Vercel ops UI, local Vite, etc.). Used for OAuth return + open-redirect guards. */
function getTrustedFrontendOrigins(): string[] {
  const fromList = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
    .filter(s => s !== '*');
  const singles = [
    process.env.FRONTEND_URL,
    process.env.APP_BASE_URL,
    process.env.PUBLIC_CRM_URL,
  ]
    .map(s => sanitizeString(s || '', 300).replace(/\/$/, ''))
    .filter(Boolean);
  // Drop API/Render hosts from the SPA allowlist so bounce-back cannot prefer them.
  return Array.from(new Set([...singles, ...fromList])).filter(origin => !isApiHostUrl(origin));
}

function getFrontendBaseUrl(req: express.Request): string {
  // Prefer explicit SPA origins so OAuth bounce-back never lands on the Render API host.
  // Do not fall through to PUBLIC_CRM_URL when it points at onrender.com (common Render misconfig).
  const preferred = [
    process.env.FRONTEND_URL,
    process.env.APP_BASE_URL,
    ...String(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()),
    process.env.PUBLIC_CRM_URL,
  ]
    .map(s => sanitizeString(s || '', 300).replace(/\/$/, ''))
    .filter(Boolean)
    .filter(u => !isApiHostUrl(u));
  if (preferred[0]) return preferred[0];

  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  if (origin && isTrustedFrontendOrigin(origin) && !isApiHostUrl(origin)) return origin;

  const referer = String(req.headers.referer || '').trim();
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (isTrustedFrontendOrigin(refOrigin) && !isApiHostUrl(refOrigin)) return refOrigin;
    } catch { /* ignore */ }
  }

  const trusted = getTrustedFrontendOrigins();
  if (trusted[0]) return trusted[0];
  return '';
}

function isTrustedFrontendOrigin(origin: string): boolean {
  const clean = origin.replace(/\/$/, '');
  if (!clean) return false;
  // Never treat the API host as a browser return target.
  if (isApiHostUrl(clean)) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(clean)) return true;
  // Always allow Vercel SPA hosts — UI and API are split (Vercel ↔ Render).
  if (isSpaFrontendOrigin(clean)) return true;
  const trusted = getTrustedFrontendOrigins();
  if (trusted.length === 0) {
    // No allowlist configured: accept any https origin that is not the API host.
    // Prefer setting FRONTEND_URL / CORS_ORIGINS in production.
    return clean.startsWith('https://') || clean.startsWith('http://');
  }
  return trusted.some(t => t === clean || t === '*');
}

function sanitizeReturnTo(value: unknown, fallback = '/'): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      if (!['http:', 'https:'].includes(url.protocol)) return fallback;
      if (/javascript:|data:/.test(raw)) return fallback;
      const origin = `${url.protocol}//${url.host}`;
      // Absolute return_to from the SPA must never be the API host (Render).
      if (isApiHostUrl(origin) || !isTrustedFrontendOrigin(origin)) return fallback;
      // Keep path so user lands back on Integrations / Social Hub (or wherever they started).
      const path = (url.pathname || '/') + (url.search || '');
      const safePath = path.split('#')[0] || '/';
      if (safePath.startsWith('//') || /javascript:|data:|\r|\n/i.test(safePath)) return origin + '/';
      return `${origin}${safePath.startsWith('/') ? safePath : `/${safePath}`}`.split('#')[0];
    } catch {
      return fallback;
    }
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (/javascript:|data:|\r|\n/.test(raw)) return fallback;
  // Keep query (e.g. /?tab=social-hub) — only strip hash.
  return raw.split('#')[0] || fallback;
}

/**
 * Build absolute URL to send the browser after OAuth.
 * Prefer absolute returnTo from the UI (Vercel); otherwise FRONTEND_URL + path.
 * Never leave the user stuck on the API host (Render) when a frontend base is known.
 */
function buildOAuthReturnUrl(req: express.Request, returnTo: unknown, statusQuery: string): string {
  const frontendBase = getFrontendBaseUrl(req).replace(/\/$/, '');
  const cleaned = sanitizeReturnTo(returnTo, '/');
  let target: string;
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    target = cleaned;
  } else if (frontendBase) {
    target = `${frontendBase}${cleaned === '/' ? '' : cleaned}` || frontendBase;
  } else {
    target = cleaned || '/';
  }
  // Last line of defense: relative paths would stay on Render; API-host absolutes must be rewritten.
  try {
    if (target.startsWith('http://') || target.startsWith('https://')) {
      const targetOrigin = new URL(target).origin;
      if (isApiHostUrl(targetOrigin) && frontendBase && !isApiHostUrl(frontendBase)) {
        const path = target.startsWith(targetOrigin) ? target.slice(targetOrigin.length) || '/' : '/';
        target = `${frontendBase}${path.startsWith('/') ? path : `/${path}`}`;
      }
    } else if (frontendBase && !target.startsWith('http')) {
      target = `${frontendBase}${target === '/' ? '' : target}` || frontendBase;
    }
  } catch { /* keep target */ }
  const join = target.includes('?') ? '&' : '?';
  return `${target}${join}${statusQuery}`;
}

/** Escape bounce-back URLs for HTML meta refresh / anchor href attributes. */
function escapeOAuthRedirectHtml(url: string): string {
  return String(url || '/')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function extractReturnTo(req: express.Request): string {
  const bodyReturnTo = String(req.body?.return_to || '').trim();
  if (bodyReturnTo) {
    const sanitized = sanitizeReturnTo(bodyReturnTo);
    if (sanitized && sanitized !== '/') return sanitized;
  }
  // Prefer full origin+path from the SPA Referer (cross-origin: Vercel → Render API).
  const referer = String(req.headers.referer || '').trim();
  if (referer) {
    try {
      const url = new URL(referer);
      const absolute = sanitizeReturnTo(`${url.origin}${url.pathname}${url.search}`);
      if (absolute && absolute !== '/') return absolute;
      const path = sanitizeReturnTo(url.pathname + url.search);
      if (path && path !== '/') return path;
    } catch { /* ignore */ }
  }
  const origin = String(req.headers.origin || '').trim().replace(/\/$/, '');
  if (origin && isTrustedFrontendOrigin(origin)) {
    return origin + '/';
  }
  const queryReturnTo = sanitizeReturnTo(req.query?.return_to);
  if (queryReturnTo !== '/') return queryReturnTo;
  return '/';
}

/**
 * Signed OAuth state for mailbox providers (Gmail / Outlook).
 * Embeds absolute returnTo (Vercel SPA) so multi-instance Render can bounce users
 * back without relying on in-memory Maps.
 */
function createMailboxOAuthState(brandId: string, userId: string, returnTo: string, provider: 'gmail' | 'outlook' = 'gmail'): string {
  const payload = {
    brandId: sanitizeString(brandId, 40),
    userId: sanitizeString(userId, 80),
    returnTo: sanitizeReturnTo(returnTo, '/'),
    provider,
    ts: Date.now(),
  };
  const data = JSON.stringify(payload);
  const secret = sanitizeString(process.env.OAUTH_STATE_SECRET || process.env.DATA_ENCRYPTION_KEY || '', 200);
  let signature = '';
  if (secret) {
    try {
      signature = createHmac('sha256', secret).update(data).digest('base64url');
    } catch { /* ignore */ }
  }
  const token = { d: data, s: signature };
  return Buffer.from(JSON.stringify(token)).toString('base64url');
}

/** @deprecated use createMailboxOAuthState — kept as alias for readability at Gmail call sites */
function createGmailState(brandId: string, userId: string, returnTo: string): string {
  return createMailboxOAuthState(brandId, userId, returnTo, 'gmail');
}

function decodeMailboxOAuthState(state: string): { brandId: string; userId: string; returnTo: string; ts: number; provider?: string } | null {
  try {
    // OAuth state is a signed base64url JSON blob and is typically 200–400+ chars.
    // Never truncate below ~2k or decode fails with "expired or invalid".
    const raw = String(state || '').trim();
    if (!raw || raw.length > 8000) return null;
    const token = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!token?.d) return null;
    const payload = JSON.parse(token.d);
    if (!payload?.brandId || !payload?.userId) return null;
    const secret = sanitizeString(process.env.OAUTH_STATE_SECRET || process.env.DATA_ENCRYPTION_KEY || '', 200);
    if (secret) {
      // When a secret is configured, require a valid signature (prevents return URL tampering).
      if (!token.s) return null;
      try {
        const expectedSig = createHmac('sha256', secret).update(token.d).digest('base64url');
        if (expectedSig !== token.s) return null;
      } catch {
        return null;
      }
    }
    if (Date.now() - Number(payload.ts || 0) > 15 * 60 * 1000) return null;
    return {
      brandId: sanitizeString(payload.brandId, 40),
      userId: sanitizeString(payload.userId, 80),
      returnTo: sanitizeReturnTo(payload.returnTo || '/', '/'),
      ts: Number(payload.ts || 0),
      provider: sanitizeString(payload.provider || '', 40),
    };
  } catch {
    return null;
  }
}

function decodeGmailState(state: string): { brandId: string; userId: string; returnTo: string; ts: number } | null {
  return decodeMailboxOAuthState(state);
}

/** Best-effort parse of returnTo from a (possibly expired) state token for error redirects. */
function peekMailboxOAuthStateReturnTo(state: string): string {
  try {
    const raw = String(state || '').trim();
    if (!raw || raw.length > 8000) return '/';
    const token = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!token?.d) return '/';
    const payload = JSON.parse(token.d);
    return sanitizeReturnTo(payload?.returnTo || '/', '/');
  } catch {
    return '/';
  }
}

function peekGmailStateReturnTo(state: string): string {
  return peekMailboxOAuthStateReturnTo(state);
}

function scopeSet(value: unknown): Set<string> {
  return new Set(String(value || '').split(/\s+/).map(scope => scope.trim()).filter(Boolean));
}

function missingScopes(granted: unknown, required: string[]): string[] {
  const grantedSet = scopeSet(granted);
  return required.filter(scope => !grantedSet.has(scope));
}

type DeletedEmailProviderRef = {
  brand_id: string;
  provider: string;
  provider_message_id: string;
  deleted_at: string;
};

function getDeletedEmailProviderIds(db: LocalDb): DeletedEmailProviderRef[] {
  const raw = (db.get() as any).deleted_email_provider_ids;
  if (!Array.isArray(raw)) {
    (db.get() as any).deleted_email_provider_ids = [];
    return (db.get() as any).deleted_email_provider_ids;
  }
  return raw as DeletedEmailProviderRef[];
}

function rememberDeletedProviderMessage(
  db: LocalDb,
  brandId: string,
  provider: string,
  providerMessageId: string,
) {
  const messageId = sanitizeString(providerMessageId, 200);
  const brand = sanitizeString(brandId, 40);
  const prov = sanitizeString(provider || 'gmail', 40).toLowerCase();
  if (!messageId || !brand) return;
  const list = getDeletedEmailProviderIds(db);
  const exists = list.some(
    entry =>
      entry.brand_id === brand &&
      entry.provider === prov &&
      entry.provider_message_id === messageId,
  );
  if (exists) return;
  list.push({
    brand_id: brand,
    provider: prov,
    provider_message_id: messageId,
    deleted_at: new Date().toISOString(),
  });
  // Cap growth (keep newest)
  if (list.length > 5000) {
    list.sort((a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at)));
    (db.get() as any).deleted_email_provider_ids = list.slice(0, 5000);
  }
}

function isDeletedProviderMessage(
  db: LocalDb,
  brandId: string,
  provider: string,
  providerMessageId: string,
): boolean {
  const messageId = sanitizeString(providerMessageId, 200);
  const brand = sanitizeString(brandId, 40);
  const prov = sanitizeString(provider || 'gmail', 40).toLowerCase();
  if (!messageId || !brand) return false;
  return getDeletedEmailProviderIds(db).some(
    entry =>
      entry.brand_id === brand &&
      entry.provider === prov &&
      entry.provider_message_id === messageId,
  );
}

/** Move a Gmail message to Trash (needs gmail.modify). 404 = already gone. */
async function trashGmailMessage(db: LocalDb, brandId: string, req: express.Request, providerMessageId: string) {
  const messageId = sanitizeString(providerMessageId, 200);
  if (!messageId) throw new Error('provider_message_id is required.');
  const integration = getBrandIntegration(db, brandId);
  if (!integration?.gmail_refresh_token) throw new Error('Gmail is not connected for this brand.');
  const accessToken = await refreshGmailAccessToken(db, brandId, req);
  const trashUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/trash`;
  const trashResponse = await fetch(trashUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!trashResponse.ok && trashResponse.status !== 404) {
    const data: any = await trashResponse.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Gmail trash failed with status ${trashResponse.status}`);
  }
  return true;
}

class ProviderReconnectError extends Error {
  provider: string;
  reconnectRequired = true;

  constructor(provider: string, message: string) {
    super(message);
    this.provider = provider;
  }
}

function isProviderTokenRevoked(raw: unknown): boolean {
  return /expired|revoked|invalid[_\s-]?grant|invalid refresh token|interaction_required|consent_required/i.test(String(raw || ''));
}

function providerReconnectMessage(provider: string): string {
  const label = provider === 'outlook' ? 'Outlook' : 'Gmail';
  return `${label} needs to be reconnected before CRM can fetch this mailbox attachment. Go to Integrations > Email, reconnect ${label}, then open the attachment again.`;
}

function sendAttachmentError(req: express.Request, res: express.Response, status: number, detail: string, reconnectRequired = false, provider = '') {
  const cleanDetail = sanitizeString(detail, 1000);
  const accept = String(req.get('accept') || '');
  const wantsHtml = !accept.includes('application/json') && (String(req.query.inline || '') === '1' || accept.includes('text/html'));
  if (wantsHtml) {
    res.status(status).send(`<!doctype html><html><head><title>Attachment unavailable</title><style>body{font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:32px;line-height:1.5}.box{max-width:680px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;box-shadow:0 18px 50px rgba(15,23,42,.08)}h1{font-size:20px;margin:0 0 10px}.pill{display:inline-block;margin-top:12px;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#4f46e5;font-weight:700;font-size:12px}</style></head><body><div class="box"><h1>Attachment needs mailbox reconnection</h1><p>${cleanDetail}</p>${reconnectRequired ? `<span class="pill">${sanitizeString(provider || 'email', 40)} reconnect required</span>` : ''}</div></body></html>`);
    return;
  }
  res.status(status).json({ detail: cleanDetail, reconnect_required: reconnectRequired, provider });
}

function getPublicBaseUrl(req: express.Request): string {
  const forwardedProto = sanitizeString(String(req.get('x-forwarded-proto') || '').split(',')[0] || '', 20);
  const proto = forwardedProto || req.protocol;
  return sanitizeString(process.env.PUBLIC_CRM_URL || `${proto}://${req.get('host')}`, 300).replace(/\/$/, '');
}

/**
 * Base URL of this API process (Render SaaS host), not the SPA (Vercel).
 * OAuth provider callbacks MUST hit the API, never the frontend origin.
 */
function getApiBaseUrl(req: express.Request): string {
  const explicit = sanitizeString(
    process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || process.env.SAAS_API_URL || '',
    300,
  ).replace(/\/$/, '');
  if (explicit) return explicit;
  const forwardedProto = sanitizeString(String(req.get('x-forwarded-proto') || '').split(',')[0] || '', 20);
  const proto = forwardedProto || req.protocol || 'https';
  const host = sanitizeString(req.get('host') || '', 300);
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  // Last resort: PUBLIC_CRM_URL only if it is not a known frontend-only host pattern mismatch.
  return getPublicBaseUrl(req);
}

function getGmailRedirectUri(req: express.Request): string {
  const host = sanitizeString(req.get('host') || '', 300);
  const configured = sanitizeString(process.env.GOOGLE_REDIRECT_URI || '', 500);
  const isLocalRequest = /^localhost(?::\d+)?$/i.test(host) || /^127\.0\.0\.1(?::\d+)?$/i.test(host);
  const configuredIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configured);
  if (configured && (!configuredIsLocal || isLocalRequest)) return configured;
  // Prefer request host (Render API) over PUBLIC_CRM_URL which may point at the Vercel SPA.
  return `${getApiBaseUrl(req)}/api/integrations/gmail/callback`;
}

function getGmailOAuthConfig(req: express.Request) {
  return {
    clientId: sanitizeString(process.env.GOOGLE_CLIENT_ID || '', 500),
    clientSecret: sanitizeString(process.env.GOOGLE_CLIENT_SECRET || '', 500),
    redirectUri: getGmailRedirectUri(req),
  };
}

function getMicrosoftRedirectUri(req: express.Request): string {
  const host = sanitizeString(req.get('host') || '', 300);
  const configured = sanitizeString(process.env.MICROSOFT_REDIRECT_URI || '', 500);
  const isLocalRequest = /^localhost(?::\d+)?$/i.test(host) || /^127\.0\.0\.1(?::\d+)?$/i.test(host);
  const configuredIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configured);
  // Same rule as Gmail: never send Microsoft to the Vercel SPA; callback must hit the API host.
  if (configured && (!configuredIsLocal || isLocalRequest)) return configured;
  return `${getApiBaseUrl(req)}/api/integrations/outlook/callback`;
}

function getMicrosoftOAuthConfig(req: express.Request) {
  return {
    clientId: sanitizeString(process.env.MICROSOFT_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID || '', 500),
    clientSecret: sanitizeString(process.env.MICROSOFT_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET || '', 500),
    tenant: sanitizeString(process.env.MICROSOFT_TENANT_ID || 'common', 120),
    redirectUri: getMicrosoftRedirectUri(req),
  };
}

function upsertBrandIntegration(db: LocalDb, brandId: string, patch: Partial<DbBrandIntegration>): DbBrandIntegration {
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
    whatsapp_access_token_encrypted: existing?.whatsapp_access_token_encrypted || '',
    whatsapp_access_token_env: existing?.whatsapp_access_token_env || '',
    whatsapp_connected_at: existing?.whatsapp_connected_at || '',
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

function getEmailAccountForSend(db: LocalDb, integration: DbBrandIntegration | undefined, accountId?: string) {
  if (!integration) return null;
  const cleanAccountId = sanitizeString(accountId || '', 120);
  const connection = getEmailConnectionById(db, cleanAccountId);
  if (connection) {
    return {
      id: connection.id,
      label: connection.provider_email,
      provider: connection.provider,
      email: connection.provider_email,
      reply_to: connection.provider_email,
      smtp_host: connection.smtp_host,
      smtp_port: connection.smtp_port,
      smtp_secure: connection.smtp_secure,
      smtp_username: connection.smtp_username || connection.provider_email,
      smtp_password: connection.smtp_password,
      smtp_password_env: connection.smtp_password_env,
      is_default: Boolean(connection.is_default),
    };
  }
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

async function refreshGmailAccessToken(db: LocalDb, brandId: string, req: express.Request, connectionId?: string): Promise<string> {
  const integration = getBrandIntegration(db, brandId);
  const selectedConnection = getEmailConnectionById(db, connectionId);
  const connection = selectedConnection?.provider === 'gmail' && selectedConnection.brand_id === brandId ? selectedConnection : getDefaultEmailConnection(db, brandId, 'gmail');
  const refreshToken = connection?.refresh_token || integration?.gmail_refresh_token || '';
  if (!refreshToken) throw new Error('Gmail is not connected for this brand.');

  const tokenExpiryRaw = connection?.token_expiry || integration?.gmail_token_expiry || '';
  const accessToken = connection?.access_token || integration?.gmail_access_token || '';
  const expiry = tokenExpiryRaw ? new Date(tokenExpiryRaw).getTime() : 0;
  if (accessToken && expiry > Date.now() + 60000) return accessToken;

  const config = getGmailOAuthConfig(req);
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data: any = await response.json();
  if (!response.ok) {
    const raw = data?.error_description || data?.error || 'Could not refresh Gmail token';
    if (isProviderTokenRevoked(raw)) throw new ProviderReconnectError('gmail', providerReconnectMessage('gmail'));
    throw new Error(raw);
  }

  const tokenExpiry = new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString();
  if (connection) {
    upsertEmailConnection(db, {
      ...connection,
      access_token: sanitizeString(data.access_token || '', 4000),
      refresh_token: connection.refresh_token || refreshToken,
      token_expiry: tokenExpiry,
      connection_status: 'connected',
      last_error: '',
    });
  }
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

async function refreshOutlookAccessToken(db: LocalDb, brandId: string, req: express.Request, connectionId?: string): Promise<string> {
  const integration = getBrandIntegration(db, brandId);
  const selectedConnection = getEmailConnectionById(db, connectionId);
  const connection = selectedConnection?.provider === 'outlook' && selectedConnection.brand_id === brandId ? selectedConnection : getDefaultEmailConnection(db, brandId, 'outlook');
  const refreshToken = connection?.refresh_token || integration?.outlook_refresh_token || '';
  if (!refreshToken) throw new Error('Outlook is not connected for this brand.');

  const tokenExpiryRaw = connection?.token_expiry || integration?.outlook_token_expiry || '';
  const accessToken = connection?.access_token || integration?.outlook_access_token || '';
  const expiry = tokenExpiryRaw ? new Date(tokenExpiryRaw).getTime() : 0;
  if (accessToken && expiry > Date.now() + 60000) return accessToken;

  const config = getMicrosoftOAuthConfig(req);
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: MICROSOFT_GRAPH_SCOPES,
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data: any = await response.json();
  if (!response.ok) {
    const raw = data?.error_description || data?.error || 'Could not refresh Outlook token';
    if (isProviderTokenRevoked(raw)) throw new ProviderReconnectError('outlook', providerReconnectMessage('outlook'));
    throw new Error(raw);
  }

  const tokenExpiry = new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString();
  if (connection) {
    upsertEmailConnection(db, {
      ...connection,
      access_token: sanitizeString(data.access_token || '', 4000),
      refresh_token: sanitizeString(data.refresh_token || connection.refresh_token || refreshToken, 4000),
      token_expiry: tokenExpiry,
      connection_status: 'connected',
      last_error: '',
    });
  }
  upsertBrandIntegration(db, brandId, {
    outlook_access_token: sanitizeString(data.access_token || '', 4000),
    outlook_refresh_token: sanitizeString(data.refresh_token || refreshToken || '', 4000),
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

function base64UrlToBase64(value: unknown): string {
  const input = sanitizeString(value || '', 50000000);
  if (!input) return '';
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
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
      id: sanitizeString(part.body.attachmentId, 1200),
      name: sanitizeString(part.filename, 300),
      mime_type: sanitizeString(part.mimeType || '', 120),
      size: Number(part.body.size || 0),
      provider: 'gmail',
    }));
}

async function resolveGmailAttachmentId(accessToken: string, messageId: string, attachment: any): Promise<string> {
  const savedId = sanitizeString(attachment?.id || '', 1200);
  const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const detail: any = await detailResponse.json();
  if (!detailResponse.ok) throw new Error(friendlyGmailError(detail?.error?.message || detail?.error_description || detail?.error || 'Could not inspect Gmail message attachments.'));

  const savedName = sanitizeString(attachment?.name || '', 300);
  const savedMime = sanitizeString(attachment?.mime_type || '', 120);
  const savedSize = Number(attachment?.size || 0);
  const parts = flattenGmailParts(detail.payload).filter(part => part?.filename && part?.body?.attachmentId);
  const match = parts.find(part => (
    sanitizeString(part.body.attachmentId || '', 1200) === savedId ||
    (
      sanitizeString(part.filename || '', 300) === savedName &&
      (!savedMime || sanitizeString(part.mimeType || '', 120) === savedMime) &&
      (!savedSize || Number(part.body?.size || 0) === savedSize)
    )
  ));
  const resolvedId = sanitizeString(match?.body?.attachmentId || savedId, 1200);
  if (!resolvedId) throw new Error('This Gmail attachment no longer has a downloadable file reference.');
  return resolvedId;
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

  const brandName = cleanMailHeader(integration?.email_sender_name || BRAND_NAMES[brandId] || 'DirotiQ CRM', 120);
  const header = [
    '<div data-optima-email-brand-header="true" style="margin:0 0 20px 0;padding:0 0 14px 0;border-bottom:1px solid #e5e7eb;">',
    `<img src="${logoUrl}" alt="${brandName}" width="140" style="display:block;max-width:140px;width:140px;height:auto;border:0;outline:none;text-decoration:none;" />`,
    '</div>',
  ].join('');

  return `${header}${html}`;
}

async function sendGmailMessage(db: LocalDb, brandId: string, req: express.Request, options: { to: string; subject: string; html: string; accountId?: string; attachments?: OutgoingEmailAttachment[] }) {
  const integration = getBrandIntegration(db, brandId);
  const selectedConnection = getEmailConnectionById(db, options.accountId);
  const connection = selectedConnection?.provider === 'gmail' && selectedConnection.brand_id === brandId ? selectedConnection : getDefaultEmailConnection(db, brandId, 'gmail');
  if (!connection?.refresh_token && !integration?.gmail_refresh_token) throw new Error('Gmail is not connected for this brand.');

  const accessToken = await refreshGmailAccessToken(db, brandId, req, connection?.id);
  const fromName = cleanMailHeader(integration?.email_sender_name || BRAND_NAMES[brandId] || 'DirotiQ CRM', 120);
  const fromEmail = cleanMailHeader(connection?.provider_email || integration?.gmail_connected_email || integration?.email_sender_address || '', 254);
  const replyTo = cleanMailHeader(integration?.email_reply_to || fromEmail, 254);
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

async function sendOutlookMessage(db: LocalDb, brandId: string, req: express.Request, options: { to: string; subject: string; html: string; accountId?: string; attachments?: OutgoingEmailAttachment[] }) {
  const integration = getBrandIntegration(db, brandId);
  const selectedConnection = getEmailConnectionById(db, options.accountId);
  const connection = selectedConnection?.provider === 'outlook' && selectedConnection.brand_id === brandId ? selectedConnection : getDefaultEmailConnection(db, brandId, 'outlook');
  if (!connection?.refresh_token && !integration?.outlook_refresh_token) throw new Error('Outlook is not connected for this brand. Connect Outlook with Microsoft first.');

  const accessToken = await refreshOutlookAccessToken(db, brandId, req, connection?.id);
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
  const password = sanitizeString((account?.smtp_password || '') || (passwordEnv ? process.env[passwordEnv] : '') || '', 2000);
  if (!host || !username) {
    throw new Error('SMTP is not fully configured. Add host and username for this mailbox.');
  }
  if (!password) {
    throw new Error(passwordEnv ? `SMTP password was not found in Render env var "${passwordEnv}".` : 'SMTP password/app password is missing for this mailbox.');
  }

  const fromName = cleanMailHeader(integration.email_sender_name || BRAND_NAMES[brandId] || 'DirotiQ CRM', 120);
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

async function syncCustomImapMailbox(db: LocalDb, connectionId: string) {
  const connection = getEmailConnectionById(db, connectionId);
  if (!connection || connection.provider !== 'custom_smtp_imap') throw new Error('Custom mailbox connection not found.');
  const host = sanitizeString(connection.imap_host || '', 200);
  const port = Number(sanitizeString(connection.imap_port || '', 8)) || 993;
  const username = sanitizeString(connection.imap_username || connection.provider_email || '', 254);
  const passwordEnv = sanitizeString(connection.imap_password_env || '', 120);
  const password = sanitizeString(connection.imap_password || connection.smtp_password || (passwordEnv ? process.env[passwordEnv] : '') || '', 2000);
  if (!host || !username || !password) throw new Error('IMAP is not fully configured for this mailbox.');

  const client = new ImapFlow({
    host,
    port,
    secure: connection.imap_secure !== false,
    auth: { user: username, pass: password },
    logger: false,
  } as any);

  let imported = 0;
  let skipped = 0;
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const range = { since };
for await (const msg of client.fetch(range as any, { uid: true, envelope: true, source: true } as any)) {
  const uid = sanitizeString(String((msg as any).uid || ''), 80);
  const providerMessageId = `${connection.id}:${uid}`;
  if (!uid || db.get().emails.some(email => email.provider_message_id === providerMessageId || email.deleted)) {
    skipped++;
    continue;
  }
        const parsed = await simpleParser((msg as any).source);
        const parsedTo: any = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
        const fromEmail = sanitizeString((parsed.from as any)?.value?.[0]?.address || '', 254).toLowerCase();
        const toEmail = sanitizeString(parsedTo?.value?.[0]?.address || connection.provider_email || '', 254).toLowerCase();
        const html = sanitizeString(String(parsed.html || ''), 50000) || sanitizeString(String(parsed.textAsHtml || parsed.text || ''), 50000);
        const attachments = (parsed.attachments || []).slice(0, 12).map(file => ({
          id: newId('imap-attachment'),
          name: sanitizeString(file.filename || 'attachment', 300),
          mime_type: sanitizeString(file.contentType || 'application/octet-stream', 120),
          size: Number(file.size || file.content?.length || 0),
          provider: 'custom_smtp_imap',
          data_base64: Buffer.from(file.content || Buffer.alloc(0)).toString('base64'),
        }));
        const matchingLead = db.get().leads.find(lead => (
          lead.brand_id === connection.brand_id &&
          lead.email &&
          fromEmail &&
          lead.email.toLowerCase() === fromEmail
        ));
        db.get().emails.push({
          id: newId('email'),
          lead_id: matchingLead?.id || '',
          subject: cleanMailHeader(parsed.subject || '(No subject)', 200),
          html_content: html || '<p>No message body saved.</p>',
          body: stripHtml(html || String(parsed.text || '')).slice(0, 5000),
          status: 'received',
          template_name: 'Custom Mailbox Message',
          brand_id: connection.brand_id,
          to_email: toEmail,
          from_email: fromEmail,
          direction: 'inbound',
          mailbox_folder: 'inbox',
          created_by: 'IMAP sync',
          provider: 'custom_smtp_imap',
          provider_message_id: providerMessageId,
          created_at: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
          open_count: 0,
          attachments,
        });
        if (matchingLead) {
          db.get().notes.push({
            id: newId('note'),
            lead_id: matchingLead.id,
            content: `Custom mailbox reply received from ${fromEmail || 'unknown sender'}: "${stripHtml(html).substring(0, 160)}"`,
            created_by: 'IMAP sync',
            created_at: new Date().toISOString(),
          });
        }
        imported++;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => null);
  }

  upsertEmailConnection(db, {
    ...connection,
    last_sync_at: new Date().toISOString(),
    last_error: '',
    connection_status: 'connected',
  });
  db.save();
  return { imported, skipped };
}

function purgeProviderMailForBrand(db: LocalDb, brandId: string, provider: string) {
  const providerName = sanitizeString(provider, 40);
  const leadIds = new Set((db.get().leads || [])
    .filter(lead => lead.brand_id === brandId)
    .map(lead => lead.id));
  const beforeEmails = (db.get().emails || []).length;
  const beforeNotes = (db.get().notes || []).length;
  db.get().emails = (db.get().emails || []).filter(email => {
    if (email.brand_id && email.brand_id !== brandId) return true;
    if (!email.brand_id && !leadIds.has(email.lead_id)) return true;
    return email.provider !== providerName;
  });
  if (providerName === 'gmail') {
    db.get().notes = (db.get().notes || []).filter(note => {
      if (!leadIds.has(note.lead_id)) return true;
      return note.created_by !== 'Gmail sync';
    });
  }
  return {
    emails_removed: beforeEmails - (db.get().emails || []).length,
    notes_removed: beforeNotes - (db.get().notes || []).length,
  };
}

async function sendProviderEmail(db: LocalDb, brandId: string, req: express.Request, options: { to: string; subject: string; html: string; accountId?: string; attachments?: OutgoingEmailAttachment[] }) {
  const integration = getBrandIntegration(db, brandId);
  const selectedAccount = getEmailAccountForSend(db, integration, options.accountId);
  const provider = selectedAccount?.provider || integration?.email_provider;
  if (provider === 'gmail') {
    const payload = await sendGmailMessage(db, brandId, req, options);
    return { provider: 'gmail', messageId: sanitizeString(payload?.id || '', 200) };
  }
  if (provider === 'outlook' && integration?.outlook_refresh_token) {
    const payload: any = await sendOutlookMessage(db, brandId, req, options);
    return { provider: 'outlook', messageId: sanitizeString(payload?.id || '', 200), account: selectedAccount };
  }
  if (provider === 'outlook' || provider === 'yahoo' || provider === 'smtp' || provider === 'custom_smtp_imap') {
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
    decryptSecret(integration?.whatsapp_access_token_encrypted) ||
    process.env[accessTokenEnv] ||
    process.env[`WHATSAPP_${prefix}_ACCESS_TOKEN`] ||
    process.env.WHATSAPP_ACCESS_TOKEN ||
    '',
    5000
  );

  if (!phoneNumberId || !accessToken) return null;

  return {
    brandId: cleanBrandId,
    graphVersion: sanitizeString(process.env.WHATSAPP_GRAPH_VERSION || 'v23.0', 20),
    phoneNumberId,
    accessToken,
    displayNumber: sanitizeString(integration?.whatsapp_number || '', 30),
    integration,
  };
}

function whatsappEmbeddedConfig() {
  return {
    appId: sanitizeString(process.env.META_APP_ID || process.env.WHATSAPP_EMBEDDED_SIGNUP_APP_ID || '', 120),
    appSecret: sanitizeString(process.env.META_APP_SECRET || process.env.WHATSAPP_EMBEDDED_SIGNUP_APP_SECRET || '', 500),
    configId: sanitizeString(process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || '', 160),
    graphVersion: sanitizeString(process.env.WHATSAPP_GRAPH_VERSION || 'v23.0', 20),
  };
}

async function whatsappGraphRequest(pathname: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(`https://graph.facebook.com/${whatsappEmbeddedConfig().graphVersion}/${pathname.replace(/^\/+/, '')}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(sanitizeString(payload?.error?.message || 'Meta Graph API request failed.', 500));
  return payload;
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
  const portFlagIndex = process.argv.indexOf('--port');
  const cliPort = portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : undefined;
  const PORT = Number(process.env['PORT'] || cliPort || 5000);

  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();

  });

  // Cross-origin SPA hosts (e.g. Vercel UI â†’ this API). Comma-separated absolute origins.
  // Example: CORS_ORIGINS=https://crm-optima-updated.vercel.app,http://localhost:5173
  const corsOrigins = new Set(
    String(process.env.CORS_ORIGINS || '')
      .split(',')
      .map(value => value.trim().replace(/\/$/, ''))
      .filter(Boolean)
  );
  app.use((req, res, next) => {
    const origin = String(req.headers.origin || '').replace(/\/$/, '');
    if (origin && (corsOrigins.has(origin) || corsOrigins.has('*'))) {
      res.setHeader('Access-Control-Allow-Origin', corsOrigins.has('*') ? '*' : origin);
      if (!corsOrigins.has('*')) res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const rateLimit = (name: string, windowMs: number, max: number): express.RequestHandler => (req, res, next) => {
    const forwarded = sanitizeString(String(req.headers['x-forwarded-for'] || '').split(',')[0], 80);
    const key = `${name}:${forwarded || req.ip || 'unknown'}`;
    const now = Date.now();
    const current = rateBuckets.get(key);
    if (!current || current.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    current.count += 1;
    if (current.count > max) {
      res.status(429).json({ detail: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
    next();
  };

  app.use('/api/auth', rateLimit('auth', 15 * 60 * 1000, 120));
  app.use('/api/public', rateLimit('public', 60 * 1000, 120));

  const db = new LocalDb();
  ensureLegacyEmailConnections(db);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      architecture: 'standalone',
      database: 'local',
      timestamp: new Date().toISOString(),
    });
  });

  // Migration: classify all existing leads as 'verified'
  try {
    const migrationKey = 'lead_classification_v1';
    const schema = (db as any).schema;
    if (schema && schema.leads) {
      const existingMigrations: string[] = schema._migrations || [];
      if (!existingMigrations.includes(migrationKey)) {

        const now = new Date().toISOString();
        let migratedCount = 0;
        for (const lead of schema.leads) {
          if (!lead.lead_classification) {
            lead.lead_classification = 'verified';
            lead.classification_updated_at = now;
            lead.classification_updated_by = 'system';
            lead.classification_reason = 'Auto-classified as Verified Lead during classification system setup';
            migratedCount++;
          }
        }
        if (migratedCount > 0) {
          schema._migrations = [...existingMigrations, migrationKey];
          console.log(`[Migration] Classified ${migratedCount} leads as verified`);
        }
      }
    }
  } catch (err) {
    console.error('Classification migration failed (non-fatal):', err);
  }

  db.save();
  const websiteIntakeKeys = parseWebsiteIntakeKeys();

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Serve brand logos explicitly in both dev and production.
  // This prevents broken sidebar/dashboard logos when the app is run through
  // the custom Express server instead of pure Vite.
  app.use('/logos', express.static(path.join(process.cwd(), 'public', 'logos')));
  app.use('/public', express.static(path.join(process.cwd(), 'public')));

  // â”€â”€â”€ Auth helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const getSessionUser = (req: express.Request): DbUser | null => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const user = db.get().users.find(u => isSessionValid(u, token));
        if (user) return user;
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

      const sessionToken = cookies.optima_session_id;
      if (!sessionToken) return null;
      return db.get().users.find(u => isSessionValid(u, sessionToken)) || null;
    } catch (err) {
      console.error('Error in getSessionUser:', err);
      return null;
    }
  };

  // Auth middleware â€” attaches req.user with proper TypeScript type
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getSessionUser(req);
    if (!user) { res.status(401).json({ detail: 'Authentication required' }); return; }
    req.user = user;
    next();
  };

  // Platform superadmin (overall owner): can create/delete admins. Not a normal staff/admin account.
  const DEFAULT_SUPERADMIN_EMAIL = 'superadmin@optimaviz.com';
  const DEFAULT_SUPERADMIN_PASSWORD = 'admin1234!';
  /** Former personal owner emails — blocked from login and stripped of elevated role. */
  const LEGACY_OWNER_EMAILS = new Set([
    'mthokozisigatsheni89@gmail.com',
    'mthokozisigatsheni89@gamil.com', // common typo from earlier setup
  ]);

  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getSessionUser(req);
    if (!user || !isAdminUser(user)) { res.status(403).json({ detail: 'Admin role required.' }); return; }
    req.user = user;
    next();
  };

  const publicUser = (user: DbUser) => {
    const { password: _, session_token: __, session_expires_at: ___, ...safeUser } = user;
    return {
      ...safeUser,
      presence_status: safeUser.presence_status || 'offline',
      presence_updated_at: safeUser.presence_updated_at || '',
    };
  };

  const protectedOwnerEmails = new Set(
    (process.env.PLATFORM_OWNER_EMAILS || DEFAULT_SUPERADMIN_EMAIL)
      .split(',')
      .map(email => sanitizeString(email, 254).toLowerCase())
      .filter(email => Boolean(email) && !LEGACY_OWNER_EMAILS.has(email))
  );
  // Always ensure the default Optimaviz superadmin email is protected.
  protectedOwnerEmails.add(DEFAULT_SUPERADMIN_EMAIL);

  const SUPERADMIN_ROLES = new Set(['superadmin', 'owner']); // 'owner' kept for backward-compat data
  const isProtectedOwnerUser = (user?: DbUser | null) => Boolean(
    user
    && (
      SUPERADMIN_ROLES.has(String(user.platform_role || ''))
      || protectedOwnerEmails.has(String(user.email || '').toLowerCase())
    )
    && !LEGACY_OWNER_EMAILS.has(String(user.email || '').toLowerCase())
  );
  const isAdminUser = (user?: DbUser | null) => Boolean(
    user && (
      user.role === 'admin'
      || SUPERADMIN_ROLES.has(String(user.platform_role || ''))
      || protectedOwnerEmails.has(String(user.email || '').toLowerCase())
    )
  );

  const ensureProtectedOwnerAccounts = () => {
    let dirty = false;
    const bootstrapPassword = sanitizeString(
      process.env.PLATFORM_OWNER_BOOTSTRAP_PASSWORD || DEFAULT_SUPERADMIN_PASSWORD,
      200,
    );
    const forceBootstrap = ['1', 'true', 'yes'].includes(String(process.env.BOOTSTRAP_PASSWORD_FORCE || '').toLowerCase());
    const isBroken = (stored?: string) => {
      const value = String(stored || '');
      return !value || value.startsWith('set-') || !value.startsWith(PASSWORD_HASH_PREFIX);
    };

    // Remove / demote legacy personal owner accounts (no longer platform superadmin).
    // Login is blocked for these emails; strip elevated role once and invalidate any open session.
    db.get().users.forEach(u => {
      const email = String(u.email || '').toLowerCase().trim();
      if (!LEGACY_OWNER_EMAILS.has(email)) return;
      let changed = false;
      if (SUPERADMIN_ROLES.has(String(u.platform_role || '')) || u.platform_role === 'owner' || u.platform_role === 'superadmin') {
        u.platform_role = 'none';
        changed = true;
      }
      if (u.session_token || u.session_expires_at) {
        clearSession(u);
        changed = true;
      }
      if (changed) dirty = true;
    });

    protectedOwnerEmails.forEach(email => {
      if (LEGACY_OWNER_EMAILS.has(email)) return;
      let owner = db.get().users.find(user => String(user.email || '').toLowerCase() === email);
      const recoverySecret = bootstrapPassword || DEFAULT_SUPERADMIN_PASSWORD;
      if (!owner) {
        owner = {
          id: newId('superadmin'),
          name: email === DEFAULT_SUPERADMIN_EMAIL ? 'Optimaviz Superadmin' : 'Platform Superadmin',
          email,
          password: hashPassword(recoverySecret),
          role: 'admin',
          platform_role: 'superadmin',
          created_at: new Date().toISOString(),
        };
        db.get().users.push(owner);
        dirty = true;
      }
      if (owner.role !== 'admin') { owner.role = 'admin'; dirty = true; }
      if (owner.platform_role !== 'superadmin') { owner.platform_role = 'superadmin'; dirty = true; }
      // Heal only missing/broken passwords (or explicit force). Never wipe a working custom password every boot.
      if (forceBootstrap && bootstrapPassword) {
        if (!verifyPassword(bootstrapPassword, owner.password || '')) {
          owner.password = hashPassword(bootstrapPassword);
          dirty = true;
        }
      } else if (isBroken(owner.password)) {
        owner.password = hashPassword(recoverySecret);
        dirty = true;
      }
    });
    if (dirty) db.save();
  };

  const verifyLoginPassword = (user: DbUser | undefined, password: string) => {
    if (!user) return false;
    const email = String(user.email || '').toLowerCase().trim();
    if (LEGACY_OWNER_EMAILS.has(email)) return false;

    const attempt = String(password || '');
    if (!attempt) return false;
    if (verifyPassword(attempt, user.password || '')) return true;

    const stored = String(user.password || '');
    // Legacy plaintext → upgrade for any user
    if (stored && !stored.startsWith(PASSWORD_HASH_PREFIX) && stored === attempt) {
      user.password = hashPassword(attempt);
      db.save();
      return true;
    }

    const bootstrapPassword = sanitizeString(
      process.env.PLATFORM_OWNER_BOOTSTRAP_PASSWORD || DEFAULT_SUPERADMIN_PASSWORD,
      200,
    );
    // Superadmin bootstrap env is always a recovery master key
    if (isProtectedOwnerUser(user) && bootstrapPassword && attempt === bootstrapPassword) {
      user.password = hashPassword(attempt);
      db.save();
      return true;
    }

    // Keep the documented built-in superadmin credentials recoverable even when a
    // stale persisted hash or deployment bootstrap override exists.
    if (email === DEFAULT_SUPERADMIN_EMAIL && attempt === DEFAULT_SUPERADMIN_PASSWORD) {
      user.password = hashPassword(attempt);
      db.save();
      return true;
    }

    // Broken / seed-placeholder passwords on built-in accounts → accept recovery defaults
    const broken = !stored || stored.startsWith('set-') || !stored.startsWith(PASSWORD_HASH_PREFIX);
    const defaultEmails = new Set([

      DEFAULT_SUPERADMIN_EMAIL,
      'admin@optimacrm.com',
      'admin@dirotiq.com',
      'agent@dirotiq.com',
      ...protectedOwnerEmails,
    ]);
    const defaultPasswords = [DEFAULT_SUPERADMIN_PASSWORD, 'password123', 'admin123', 'password'];
    if (broken && defaultEmails.has(email) && defaultPasswords.includes(attempt)) {
      user.password = hashPassword(attempt);
      db.save();
      return true;
    }

    return false;
  };

  ensureProtectedOwnerAccounts();

  const hasBrandAccess = (user: DbUser | undefined | null, brandId: string) => {
    if (!user || isAdminUser(user)) return true;
    const assigned = Array.isArray(user.allowed_brand_ids) ? user.allowed_brand_ids.filter(Boolean) : [];
    return assigned.length === 0 || assigned.includes(brandId);
  };
  const cleanAllowedBrandIds = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    const allowed = new Set(db.get().brand_funnels.map(brand => brand.brand_id));
    return Array.from(new Set(value.map(item => sanitizeString(item, 80)).filter(item => item && allowed.has(item))));
  };

  const auditSecurityEvent = (req: express.Request, eventType: string, metadata: Record<string, unknown> = {}) => {
    const user = req.user || getSessionUser(req);
    db.get().usage_events = db.get().usage_events || [];
    db.get().usage_events!.push({
      id: newId('audit'),
      brand_id: sanitizeString(String(metadata.brand_id || 'system'), 80),
      feature: 'security',
      event_type: eventType,
      user_id: user?.id,
      path: req.path,
      metadata: {
        ...metadata,
        user_name: user?.name,
      },
      created_at: new Date().toISOString(),
    });
  };

  const updateUserPresence = (userId: string, status: 'online' | 'away' | 'offline') => {
    const user = db.get().users.find(u => u.id === userId);
    if (!user) return null;
    user.presence_status = status;
    user.presence_updated_at = new Date().toISOString();
    db.save();
    return user;
  };


  // â”€â”€â”€ Standalone database status and maintenance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get('/api/admin/database/status', requireAdmin, (_req, res) => {
    res.json({
      mode: 'standalone_local',
      database: { file: process.env['CRM_DB_FILE'] || 'db.json', persistent: true },
      local_backup: { enabled: true, directory: process.env['CRM_BACKUP_DIR'] || 'backups/ops' },
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

  app.post('/api/admin/database/wipe-ops-data', requireAdmin, (_req, res) => {
    try {
      db.wipeOpsDataButPreserveBrandProfiles();
      res.json({ success: true, message: 'Operations CRM data wiped. Brand profiles and setup were preserved.' });
    } catch (err) {
      console.error('Operational data wipe failed:', err);

      res.status(500).json({ success: false, detail: 'The CRM wipe could not be completed right now.' });
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

  // â”€â”€â”€ Shared enroll helper (replaces 3 copy-pasted blocks) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      res.status(503).json({ detail: 'Website tracking is not available yet.' });
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

    const isAutoEnrollment = triggeredBy === 'auto';
    db.get().notes.push({
      id: newId('note'),
      lead_id: lead.id,
      content: `${isAutoEnrollment ? 'Auto-enrolled' : 'Manually enrolled'} in sequence "${seq.name}".`,
      created_by: isAutoEnrollment ? 'System Auto-Trigger' : sanitizeString(triggeredBy || 'Manual enrollment', 120),
      created_at: new Date().toISOString(),
    });

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
      res.status(503).json({ detail: 'Website lead capture is not available yet.' });
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
      res.json({ success: true, status: 'duplicate_updated', lead_id: existing.id, ignored_fields: ignored });
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
      lead_classification: 'prospect',
      classification_updated_at: new Date().toISOString(),
      classification_updated_by: source,
      classification_reason: `Created via ${source} intake`,
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
    res.status(201).json({ success: true, status: 'created', lead_id: newLead.id, ignored_fields: ignored });
  });

  function getSystemRequest(): express.Request {
    const publicUrl = sanitizeString(process.env.PUBLIC_CRM_URL || 'http://localhost:5000', 300);
    const parsed = new URL(publicUrl);
    return {
      protocol: parsed.protocol.replace(':', ''),
      get: (name: string) => name.toLowerCase() === 'host' ? parsed.host : '',
    } as express.Request;
  }

  async function executeSequenceStep(lead: DbLead, seq: DbSequence, step: DbSequence['steps'][number], stepIndex: number) {
    const channel = sanitizeString(step.channel || 'email', 30);
    const now = new Date().toISOString();
    const subject = cleanMailHeader(step.subject || step.name || `Sequence step ${stepIndex + 1}`, 200);
    const content = sanitizeString(step.html_content || '', 50000);

    if (channel === 'email') {
      let status: DbEmail['status'] = 'sent';
      let provider = 'internal';
      let providerMessageId = '';
      let errorMessage = '';
      try {
        if (!lead.email) throw new Error('Lead has no email address.');
        const payload = await sendProviderEmail(db, lead.brand_id, getSystemRequest(), { to: lead.email, subject, html: content });
        provider = sanitizeString(payload.provider || 'internal', 40);
        providerMessageId = sanitizeString(payload.messageId || '', 200);
      } catch (err: any) {
        status = 'failed';
        errorMessage = sanitizeString(err?.message || 'Sequence email failed.', 1000);
      }
      db.get().emails.push({
        id: newId('email'), lead_id: lead.id, brand_id: lead.brand_id, to_email: lead.email, to_name: lead.name,
        subject, html_content: content, status, direction: 'outbound', mailbox_folder: status === 'failed' ? 'failed' : 'sent',
        template_name: `Sequence: ${seq.name}`, provider, provider_message_id: providerMessageId, error_message: errorMessage,
        created_by: 'Sequence Scheduler', created_at: now, open_count: 0,
      });
      if (errorMessage) throw new Error(errorMessage);
      return `Email sent to ${lead.email}`;
    }

    if (channel === 'whatsapp') {
      const toNumber = normalizeWhatsAppDigits(lead.phone || '');
      if (!toNumber) throw new Error('Lead has no WhatsApp phone number.');
      const integration = getBrandIntegration(db, lead.brand_id);
      const apiReady = integration?.whatsapp_provider === 'cloud_api';
      let status: DbWhatsApp['status'] = apiReady ? 'sent' : 'draft';
      let providerMessageId = '';
      let errorMessage = '';
      if (apiReady) {
        try {
          const config = resolveWhatsAppCloudConfig(db, lead.brand_id);
          const payload = await sendWhatsAppCloudText(config, toNumber, content);
          providerMessageId = sanitizeString(payload?.messages?.[0]?.id || '', 180);
        } catch (err: any) {
          status = 'failed';
          errorMessage = sanitizeString(err?.message || 'WhatsApp sequence step failed.', 1000);
        }
      }
      db.get().whatsapp.push({
        id: newId('wa'), lead_id: lead.id, brand_id: lead.brand_id, from_number: integration?.whatsapp_number || '', to_number: lead.phone,
        direction: 'outbound', provider: apiReady ? 'cloud_api' : 'manual', provider_message_id: providerMessageId, status,
        error_message: errorMessage, template_name: `Sequence: ${seq.name}`, message: content, created_by: 'Sequence Scheduler', created_at: now,
      });
      if (errorMessage) throw new Error(errorMessage);
      return apiReady ? `WhatsApp sent to ${lead.phone}` : 'WhatsApp logged for manual send';
    }

    if (channel === 'call' || channel === 'task') {
      const admin = db.get().users.find(u => u.role === 'admin') || db.get().users[0];
      if (!db.get().tasks) db.get().tasks = [];
      db.get().tasks.push({
        id: newId('task'), brand_id: lead.brand_id, user_id: admin?.id || 'system', user_name: admin?.name || 'Team',
        user_location: 'Sequence', content: `${channel === 'call' ? 'Call' : 'Task'} for ${lead.name}: ${subject}${content ? ` - ${stripHtml(content).slice(0, 220)}` : ''}`,
        status: 'Pending', created_at: now,
      });
      return channel === 'call' ? 'Call task created' : 'Internal task created';
    }

    throw new Error(`Unsupported sequence channel: ${channel}`);
  }

  // â”€â”€â”€ Sequence step scheduler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Checks every minute whether a scheduled next-step email is due.
  setInterval(async () => {
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

      const enrolledAt = new Date(enroll.enrolled_at);
      const cumulativeDelayDays = seq.steps
        .slice(0, nextStepIndex + 1)
        .reduce((total, step) => total + Number(step.delay_days || 0), 0);
      const sendAt = new Date(enrolledAt);
      sendAt.setDate(sendAt.getDate() + cumulativeDelayDays);

      if (now >= sendAt) {
        const lead = db.get().leads.find(l => l.id === enroll.lead_id);
        if (!lead) {
          enroll.status = 'cancelled';
          dirty = true;
          continue;
        }
        let result = '';
        try {
          result = await executeSequenceStep(lead, seq, nextStep, nextStepIndex);
        } catch (err: any) {
          result = `Failed: ${sanitizeString(err?.message || 'Sequence step failed.', 500)}`;
        }
        db.get().notes.push({
          id: newId('note'),
          lead_id: enroll.lead_id,
          content: `Sequence "${seq.name}" - Step ${nextStepIndex + 1}: "${nextStep.name}" - ${result}`,
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

  // â”€â”€â”€ Auth routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sessionCookieHeader = (req: express.Request, token: string, maxAgeSeconds: number) => {
    const origin = String(req.headers.origin || '').replace(/\/$/, '');
    const host = String(req.headers.host || '').toLowerCase();
    let crossOrigin = false;
    if (origin) {
      try {
        const originHost = new URL(origin).host.toLowerCase();
        crossOrigin = Boolean(originHost && host && originHost !== host);
      } catch { /* ignore */ }
    }
    const secure = crossOrigin || String(req.headers['x-forwarded-proto'] || '').includes('https') || Boolean(req.secure);
    const sameSite = crossOrigin ? 'None' : 'Lax';
    const secureFlag = secure || sameSite === 'None' ? '; Secure' : '';
    return `optima_session_id=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAgeSeconds}${secureFlag}`;
  };

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ detail: 'Email and password are required' }); return; }
    const normalizedEmail = String(email).toLowerCase().trim();
    if (LEGACY_OWNER_EMAILS.has(normalizedEmail)) {
      res.status(401).json({ detail: 'Invalid credentials' });
      return;
    }
    let user = db.get().users.find(u => String(u.email || '').toLowerCase() === normalizedEmail);
    // Recreate missing superadmin after wipe (parity with SaaS recovery).
    const bootstrapPassword = sanitizeString(
      process.env.PLATFORM_OWNER_BOOTSTRAP_PASSWORD || DEFAULT_SUPERADMIN_PASSWORD,
      200,
    );
    const recoveryPasswords = [bootstrapPassword, DEFAULT_SUPERADMIN_PASSWORD, 'password123', 'admin123'].filter(Boolean);
    if (!user && protectedOwnerEmails.has(normalizedEmail) && recoveryPasswords.includes(String(password))) {
      user = {
        id: newId('superadmin'),
        name: normalizedEmail === DEFAULT_SUPERADMIN_EMAIL ? 'Optimaviz Superadmin' : 'Platform Superadmin',
        email: normalizedEmail,
        password: hashPassword(String(password)),
        role: 'admin',
        platform_role: 'superadmin',
        created_at: new Date().toISOString(),
      };
      db.get().users.push(user);
    }
    if (!verifyLoginPassword(user, String(password))) { res.status(401).json({ detail: 'Invalid credentials' }); return; }
    const sessionToken = issueSession(user!);
    user!.presence_status = 'online';
    user!.presence_updated_at = new Date().toISOString();
    db.save();
    // Keep users signed in for 30 days unless they explicitly log out.
    res.setHeader('Set-Cookie', sessionCookieHeader(req, sessionToken, 30 * 24 * 60 * 60));
    // The bearer token complements the same-origin session cookie.
    res.json({ ...publicUser(user!), session_token: sessionToken });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', sessionCookieHeader(req, '', 0));
    const user = getSessionUser(req);
    if (user) {

      clearSession(user);
      updateUserPresence(user.id, 'offline');
      db.save();
    }
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
    const previousPreferences = user.notification_state?.preferences && typeof user.notification_state.preferences === 'object'
      ? user.notification_state.preferences
      : undefined;
    const nextPreferences = req.body?.preferences && typeof req.body.preferences === 'object'
      ? req.body.preferences
      : previousPreferences;
    user.notification_state = {
      seen_signature: sanitizeString(req.body?.seen_signature || user.notification_state?.seen_signature || '', 2000),
      dismissed_ids: dismissed,
      ...(nextPreferences ? { preferences: nextPreferences } : {}),
      updated_at: new Date().toISOString(),
    };
    db.save();
    res.json(user.notification_state);
  });

  app.put('/api/auth/me/workspace-state', requireAuth, (req, res) => {
    const user = db.get().users.find(u => u.id === req.user!.id);
    if (!user) { res.status(404).json({ detail: 'User not found' }); return; }
    const incoming = req.body && typeof req.body === 'object' ? req.body : {};
    const tabs = Array.isArray(incoming.tabs) ? incoming.tabs.slice(0, 12) : [];
    const closedStack = Array.isArray(incoming.closedStack) ? incoming.closedStack.slice(0, 15) : [];
    const activeId = sanitizeString(incoming.activeId || '', 120);
    const state = {
      tabs,
      closedStack,
      activeId,
      updated_at: new Date().toISOString(),
    };
    if (JSON.stringify(state).length > 250_000) {
      res.status(413).json({ detail: 'Workspace state is too large.' });
      return;
    }
    user.workspace_state = state;
    db.save();
    res.json(state);
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const email = sanitizeString(req.body?.email || '', 254).toLowerCase();
    const user = db.get().users.find(item => String(item.email || '').toLowerCase() === email);
    auditSecurityEvent(req, 'password_reset_request', {
      target_email: email,
      target_user_id: user?.id,
      protected_owner: Boolean(user && isProtectedOwnerUser(user)),
      email_enabled: false,
    });
    db.save();
    res.json({ success: true, detail: 'If this account exists, the reset request has been recorded. Password reset links are not enabled for this operational workspace yet.' });
  });

  // â”€â”€â”€ Brand funnels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get('/api/brand-funnels', requireAuth, (req, res) => {
    res.json(db.get().brand_funnels.filter(brand => hasBrandAccess(req.user, brand.brand_id)));
  });

  app.patch('/api/brand-funnels/:brand_id/profile', requireAuth, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id || '', 80);
    if (!hasBrandAccess(req.user, brandId)) { res.status(403).json({ detail: 'You do not have access to this brand.' }); return; }
    const brand = db.get().brand_funnels.find(item => item.brand_id === brandId);
    if (!brand) { res.status(404).json({ detail: 'Brand not found.' }); return; }
    brand.description = sanitizeString(req.body?.description || '', 2000);
    brand.target_audience = sanitizeString(req.body?.target_audience || '', 2000);
    brand.cross_sell_notes = sanitizeString(req.body?.cross_sell_notes || '', 1000);
    brand.audience_keywords = keywordList(req.body?.audience_keywords || req.body?.keywords || []);
    brand.market_scope = sanitizeString(req.body?.market_scope || 'global', 40) === 'country_specific' ? 'country_specific' : 'global';
    brand.market_countries = keywordList(req.body?.market_countries || []);
    db.save();
    res.json(brand);
  });

  // â”€â”€â”€ Leads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Paginated: GET /api/leads?brand_id=x&page=1&limit=50
  app.get('/api/leads', requireAuth, (req, res) => {
    const { brand_id } = req.query;
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string) || 200);

    let leads = db.get().leads.filter(l => hasBrandAccess(req.user, l.brand_id));
    if (brand_id) {
      const brandId = sanitizeString(brand_id, 80);
      if (!hasBrandAccess(req.user, brandId)) { res.status(403).json({ detail: 'You do not have access to this brand.' }); return; }
      leads = leads.filter(l => l.brand_id === brandId);
    }
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
      if (lead_ids.includes(l.id) && hasBrandAccess(req.user, l.brand_id)) {
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
    if (!hasBrandAccess(req.user, clean.brand_id)) { res.status(403).json({ detail: 'You do not have access to this brand.' }); return; }

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
      lead_classification: (clean.lead_classification as any) || 'prospect',
      classification_updated_at: new Date().toISOString(),
      classification_updated_by: sessionUser.id,
      classification_reason: clean.lead_classification ? 'Set during creation' : 'Default classification',
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
    if (!hasBrandAccess(req.user, prev.brand_id)) { res.status(403).json({ detail: 'You do not have access to this brand.' }); return; }
    const previousStage = prev.funnel_stage;
    const sessionUser = req.user!;

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
      lead_classification: (req.body.lead_classification as any) || prev.lead_classification || 'verified',
      classification_updated_at: req.body.lead_classification ? new Date().toISOString() : prev.classification_updated_at,
      classification_updated_by: req.body.lead_classification ? sessionUser.id : prev.classification_updated_by,
      classification_reason: req.body.classification_reason ? sanitizeString(req.body.classification_reason, 200) : prev.classification_reason,
    };

    db.get().leads[leadIndex] = updatedLead;

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

    // Auto-promotion trigger: if lead is a prospect and stage changed to a final/won stage, auto-promote
    if (updatedLead.lead_classification === 'prospect' && funnel_stage && funnel_stage !== previousStage) {
      const WON_STAGES = ['Won', 'Converted', 'Subscribed', 'Approved Contractor', 'Active Service', 'Owner Approved'];
      if (WON_STAGES.some(ws => funnel_stage.toLowerCase().includes(ws.toLowerCase()))) {
        updatedLead.lead_classification = 'verified';
        updatedLead.classification_updated_at = new Date().toISOString();
        updatedLead.classification_updated_by = 'system';
        updatedLead.classification_reason = `Auto-promoted: stage changed to "${funnel_stage}"`;
        db.get().notes.push({
          id: newId('note'),
          lead_id,
          content: `Auto-promoted from Prospect to Verified Lead â€” stage changed to "${funnel_stage}"`,
          created_by: 'system',
          created_at: new Date().toISOString(),
        });
      }
    }

    db.save();
    res.json(updatedLead);
  });

  // â”€â”€â”€ Prospect â†’ Verified Lead Conversion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.post('/api/leads/:lead_id/convert', requireAuth, (req, res) => {
    const { lead_id } = req.params;
    const { reason } = req.body;

    const leadIndex = db.get().leads.findIndex(l => l.id === lead_id);
    if (leadIndex === -1) { res.status(404).json({ detail: 'Lead not found' }); return; }

    const lead = db.get().leads[leadIndex];
    if (!hasBrandAccess(req.user, lead.brand_id)) { res.status(403).json({ detail: 'You do not have access to this brand.' }); return; }

    if (lead.lead_classification === 'verified') {
      return res.json({ ...lead, already_verified: true });
    }

    const sessionUser = req.user!;
    const now = new Date().toISOString();

    // Determine the brand's verified starting stage
    const brandFunnel = db.get().brand_funnels.find(f => f.brand_id === lead.brand_id);
    const startingStage = (brandFunnel as any)?.verified_starting_stage
      || (brandFunnel?.stages && brandFunnel.stages.length > 0 ? brandFunnel.stages[0] : 'New Lead');

    // Update classification
    lead.lead_classification = 'verified';
    lead.classification_updated_at = now;
    lead.classification_updated_by = sessionUser.id;
    lead.classification_reason = reason || 'Manually converted by user';

    // Map to brand's verified starting stage
    const previousStage = lead.funnel_stage;
    lead.funnel_stage = startingStage;

    db.get().notes.push({
      id: newId('note'),
      lead_id,
      content: `Converted from Prospect to Verified Lead. Stage mapped from "${previousStage}" to "${startingStage}".${reason ? ` Reason: ${reason}` : ''}`,
      created_by: sessionUser.name,
      created_at: now,
    });

    db.save();
    res.json(lead);
  });

  app.delete('/api/leads/:lead_id', requireAuth, (req, res) => {
    const { lead_id } = req.params;
    const idx = db.get().leads.findIndex(l => l.id === lead_id);
    if (idx === -1) { res.status(404).json({ detail: 'Lead not found' }); return; }
    if (!hasBrandAccess(req.user, db.get().leads[idx].brand_id)) { res.status(403).json({ detail: 'You do not have access to this brand.' }); return; }
    db.get().leads.splice(idx, 1);
    db.get().notes       = db.get().notes.filter(n => n.lead_id !== lead_id);
    db.get().emails      = db.get().emails.filter(e => e.lead_id !== lead_id);
    db.get().whatsapp    = db.get().whatsapp.filter(w => w.lead_id !== lead_id);
    db.get().enrollments = db.get().enrollments.filter(e => e.lead_id !== lead_id);
    auditSecurityEvent(req, 'lead_delete', { lead_id });
    db.save();
    res.json({ success: true });
  });

  // â”€â”€â”€ Notes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get('/api/leads/:lead_id/notes', requireAuth, (req, res) => {
    const { lead_id } = req.params;
    res.json(db.get().notes.filter(n => n.lead_id === lead_id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  /** Lead access audit trail (who viewed / exported). Stored in usage_events for lightweight history. */
  app.get('/api/leads/:lead_id/events', requireAuth, (req, res) => {
    const leadId = sanitizeString(req.params.lead_id, 80);
    const lead = db.get().leads.find(l => l.id === leadId);
    if (!lead) { res.status(404).json({ detail: 'Lead not found' }); return; }
    if (!hasBrandAccess(req.user, lead.brand_id)) {
      res.status(403).json({ detail: 'You do not have access to this brand.' });
      return;
    }
    const events = (db.get().usage_events || [])
      .filter(e => e.feature === 'lead_audit' && String(e.metadata?.lead_id || '') === leadId)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 50)
      .map(e => ({
        id: e.id,
        event_type: e.event_type,
        user_id: e.user_id,
        user_name: sanitizeString(e.metadata?.user_name || '', 120),
        created_at: e.created_at,
        metadata: e.metadata || {},
      }));
    res.json(events);
  });

  app.post('/api/leads/:lead_id/events', requireAuth, (req, res) => {
    const leadId = sanitizeString(req.params.lead_id, 80);
    const lead = db.get().leads.find(l => l.id === leadId);
    if (!lead) { res.status(404).json({ detail: 'Lead not found' }); return; }
    if (!hasBrandAccess(req.user, lead.brand_id)) {
      res.status(403).json({ detail: 'You do not have access to this brand.' });
      return;
    }
    const eventType = sanitizeString(req.body?.event_type || 'view', 40).toLowerCase();
    if (!['view', 'export', 'open', 'handoff'].includes(eventType)) {
      res.status(400).json({ detail: 'event_type must be view, export, open, or handoff.' });
      return;
    }
    // Dedupe rapid view spam: same user + lead + view within 2 minutes → no new row
    if (eventType === 'view' || eventType === 'open') {
      const recent = (db.get().usage_events || []).find(e =>
        e.feature === 'lead_audit' &&
        e.event_type === eventType &&
        e.user_id === req.user!.id &&
        String(e.metadata?.lead_id || '') === leadId &&
        Date.now() - new Date(e.created_at).getTime() < 2 * 60 * 1000,
      );
      if (recent) {
        res.json({ success: true, deduped: true, id: recent.id });
        return;
      }
    }
    db.get().usage_events = db.get().usage_events || [];
    const entry = {
      id: newId('audit'),
      brand_id: lead.brand_id,
      feature: 'lead_audit',
      event_type: eventType,
      user_id: req.user!.id,
      path: req.path,
      metadata: {
        lead_id: leadId,
        lead_name: lead.name,
        user_name: req.user!.name,
        detail: sanitizeString(req.body?.detail || '', 500),
      },
      created_at: new Date().toISOString(),
    };
    db.get().usage_events!.push(entry);
    // Cap global audit growth
    if (db.get().usage_events!.length > 20000) {
      db.get().usage_events = db.get().usage_events!.slice(-15000);
    }
    db.save();
    res.status(201).json({ success: true, id: entry.id });
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
    const note = db.get().notes.find(n => n.id === note_id);
    const lead = note?.lead_id ? db.get().leads.find(l => l.id === note.lead_id) : undefined;
    if (lead && !hasBrandAccess(req.user, lead.brand_id)) { res.status(403).json({ detail: 'You do not have access to this brand.' }); return; }
    const filtered = db.get().notes.filter(n => n.id !== note_id);
    if (filtered.length === db.get().notes.length) { res.status(404).json({ detail: 'Note not found' }); return; }
    db.get().notes = filtered;
    auditSecurityEvent(req, 'note_delete', { note_id });
    db.save();
    res.json({ success: true });
  });

  // â”€â”€â”€ Open-tracking pixel (no auth â€” fetched by email clients) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get('/api/track/open/:email_id', (req, res) => {
    const emailId = sanitizeString(req.params.email_id, 200);
    const email = db.get().emails.find(e => e.id === emailId);
    if (email) {
      email.open_count = (email.open_count || 0) + 1;
      if (!email.opened_at) email.opened_at = new Date().toISOString();
      db.save();
    }
    // 1Ã—1 transparent GIF
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

  app.get('/api/emails/:email_id/attachments/:attachment_id', requireAuth, async (req, res) => {
    const emailId = sanitizeString(req.params.email_id, 200);
    const attachmentId = sanitizeString(req.params.attachment_id, 1200);
    const email = db.get().emails.find(e => e.id === emailId);
    if (!email) { res.status(404).json({ detail: 'Email not found.' }); return; }
    const attachment = (email.attachments || []).find((file: any) => file.id === attachmentId || file.name === attachmentId);
    if (!attachment) { res.status(404).json({ detail: 'Attachment not found.' }); return; }
    const integration = email.brand_id ? getBrandIntegration(db, email.brand_id) : undefined;
    const attachmentProvider = sanitizeString(
      attachment.provider ||
      email.provider ||
      (integration?.gmail_refresh_token ? 'gmail' : integration?.outlook_refresh_token ? 'outlook' : ''),
      40
    );
    if (!attachment.data_base64) {
      try {
        if (attachmentProvider === 'gmail' && email.brand_id && email.provider_message_id && attachment.id) {
          const accessToken = await refreshGmailAccessToken(db, email.brand_id, req);
          const gmailAttachmentId = await resolveGmailAttachmentId(accessToken, email.provider_message_id, attachment);
          const attachmentResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(email.provider_message_id)}/attachments/${encodeURIComponent(gmailAttachmentId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const attachmentData: any = await attachmentResponse.json();
          if (!attachmentResponse.ok) throw new Error(friendlyGmailError(attachmentData?.error?.message || attachmentData?.error_description || attachmentData?.error || 'Could not download Gmail attachment.'));
          attachment.data_base64 = base64UrlToBase64(attachmentData?.data || '');
          attachment.size = Number(attachmentData?.size || attachment.size || 0);
          attachment.id = gmailAttachmentId;
          attachment.provider = 'gmail';
          db.save();
        } else if (attachmentProvider === 'outlook' && email.brand_id && email.provider_message_id && attachment.id) {
          const accessToken = await refreshOutlookAccessToken(db, email.brand_id, req);
          const attachmentResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(email.provider_message_id)}/attachments/${encodeURIComponent(attachment.id)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const attachmentData: any = await attachmentResponse.json();
          if (!attachmentResponse.ok) throw new Error(sanitizeString(attachmentData?.error?.message || 'Could not download Outlook attachment.', 1000));
          if (attachmentData?.contentBytes) {
            attachment.data_base64 = sanitizeString(attachmentData.contentBytes, 50000000).replace(/[^A-Za-z0-9+/=]/g, '');
            attachment.mime_type = sanitizeString(attachmentData.contentType || attachment.mime_type || 'application/octet-stream', 120);
            attachment.name = sanitizeString(attachmentData.name || attachment.name || 'attachment', 300);
            attachment.size = Number(attachmentData.size || attachment.size || 0);
            attachment.provider = 'outlook';
            db.save();
          }
        }
      } catch (err: any) {
        const reconnectRequired = Boolean(err?.reconnectRequired);
        sendAttachmentError(
          req,
          res,
          reconnectRequired ? 401 : 400,
          reconnectRequired ? err.message : sanitizeString(err?.message || 'Could not download provider attachment.', 1000),
          reconnectRequired,
          sanitizeString(err?.provider || attachmentProvider || '', 40)
        );
        return;
      }
      if (!attachment.data_base64) {
        sendAttachmentError(req, res, 404, attachment.id
          ? 'This provider attachment is listed, but the file data is not available from the connected mailbox.'
          : 'This older attachment record does not include the provider file id needed to download it. Sync the mailbox again so CRM can save the attachment reference.'
        );
        return;
      }
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

  app.post('/api/emails/:email_id/read', requireAuth, (req, res) => {
    const emailId = sanitizeString(req.params.email_id, 200);
    const email = db.get().emails.find(e => e.id === emailId);
    if (!email) { res.status(404).json({ detail: 'Email not found.' }); return; }
    if (!email.read_at) {
      email.read_at = new Date().toISOString();
      email.read_by = req.user!.id;
      email.read_by_name = req.user!.name;
      db.save();
    }
    res.json(email);
  });

  app.patch('/api/emails/:email_id/action', requireAuth, (req, res) => {
    const emailId = sanitizeString(req.params.email_id, 200);
    const email = db.get().emails.find(e => e.id === emailId) as any;
    if (!email) { res.status(404).json({ detail: 'Email not found.' }); return; }

    const actionStatus = sanitizeString(req.body?.action_status || '', 40).toLowerCase();
    const allowedStatuses = new Set(['needs_reply', 'handled', 'ignored', 'marketing', 'follow_up']);
    if (!allowedStatuses.has(actionStatus)) {
      res.status(400).json({ detail: 'Choose a valid email action status.' });
      return;
    }

    const now = new Date().toISOString();
    email.action_status = actionStatus;
    email.action_note = sanitizeString(req.body?.action_note || '', 500);
    email.action_updated_at = now;
    email.action_updated_by = req.user!.id;
    email.action_updated_by_name = req.user!.name;

    if (actionStatus === 'handled' && !email.read_at) {
      email.read_at = now;
      email.read_by = req.user!.id;
      email.read_by_name = req.user!.name;
    }

    db.save();
    res.json(email);
  });

  app.delete('/api/emails/:email_id', requireAuth, async (req, res) => {
    const { email_id } = req.params;
    const email = db.get().emails.find(e => e.id === email_id);
    if (!email) { res.status(404).json({ detail: 'Email not found' }); return; }
    const brandId = sanitizeString(email.brand_id || '', 40);
    const lead = email.lead_id ? db.get().leads.find(l => l.id === email.lead_id) : undefined;
    const accessBrand = brandId || lead?.brand_id || '';
    if (accessBrand && !hasBrandAccess(req.user, accessBrand)) {
      res.status(403).json({ detail: 'You do not have access to this brand.' });
      return;
    }

    const provider = sanitizeString(email.provider || '', 40).toLowerCase();
    const providerMessageId = sanitizeString(email.provider_message_id || '', 200);
    // Always tombstone before remove so a later sync cannot resurrect this message.
    if (providerMessageId && accessBrand) {
      rememberDeletedProviderMessage(db, accessBrand, provider || 'gmail', providerMessageId);
    }

    let gmailDeleted = false;
    let gmailError = '';
    if (providerMessageId && accessBrand && provider === 'gmail') {
      const integration = getBrandIntegration(db, accessBrand);
      if (integration?.gmail_refresh_token) {
        try {
          await trashGmailMessage(db, accessBrand, req, providerMessageId);
          gmailDeleted = true;
        } catch (err: any) {
          gmailError = sanitizeString(err?.message || 'Gmail delete failed', 500);
          console.warn('Gmail trash on CRM delete failed:', gmailError);
        }
      }
    }

    db.get().emails = db.get().emails.filter(e => e.id !== email_id);
    auditSecurityEvent(req, 'email_delete', {
      email_id,
      brand_id: accessBrand,
      provider,
      provider_message_id: providerMessageId,
      gmail_deleted: gmailDeleted,
    });
    db.save();
    res.json({
      success: true,
      gmail_deleted: gmailDeleted,
      gmail_error: gmailError || undefined,
      suppressed_reimport: Boolean(providerMessageId),
    });
  });

  app.delete('/api/whatsapp/:wa_id', requireAuth, (req, res) => {
    const { wa_id } = req.params;
    const message = db.get().whatsapp.find(w => w.id === wa_id);
    const lead = message?.lead_id ? db.get().leads.find(l => l.id === message.lead_id) : undefined;
    if (lead && !hasBrandAccess(req.user, lead.brand_id)) { res.status(403).json({ detail: 'You do not have access to this brand.' }); return; }
    const filtered = db.get().whatsapp.filter(w => w.id !== wa_id);
    if (filtered.length === db.get().whatsapp.length) { res.status(404).json({ detail: 'WhatsApp message not found' }); return; }
    db.get().whatsapp = filtered;
    auditSecurityEvent(req, 'whatsapp_delete', { wa_id });
    db.save();
    res.json({ success: true });
  });

  // â”€â”€â”€ History / timeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        return recipients.length === 0 || recipients.includes('all') || recipients.includes(sessionUser.id) || message.user_id === sessionUser.id || ['owner', 'admin'].includes(String(sessionUser.role));
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

    const eventType = sanitizeString(req.body.event_type || '', 80);
    if (!content && attachments.length === 0 && !eventType) {
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
      event_type: eventType,
      call_room_slug: sanitizeString(req.body.call_room_slug || '', 160),
      call_status: sanitizeString(req.body.call_status || '', 40),
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
    if (!(recipients.length === 0 || recipients.includes('all') || recipients.includes(req.user!.id) || message.user_id === req.user!.id || ['owner', 'admin'].includes(String(req.user!.role)))) {
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
    if (existing.user_id !== req.user!.id && !['owner', 'admin'].includes(String(req.user!.role))) {
      res.status(403).json({ detail: 'Only the sender or an admin can delete this message.' });
      return;
    }
    db.get().team_messages = (db.get().team_messages || []).filter(m => m.id !== messageId);
    db.save();
    res.json({ success: true });
  });

  app.get('/api/emails', requireAuth, (req, res) => {
    try {
      res.json(getVisibleEmails(db));
    } catch (err: any) {
      console.error('GET /api/emails failed:', err?.message || err);
      // Fallback: return raw emails rather than empty mailbox
      res.json(db.get().emails || []);
    }
  });

  app.get('/api/emails/history/:lead_id', requireAuth, (req, res) => {
    res.json(getVisibleEmails(db, db.get().emails.filter(e => e.lead_id === req.params.lead_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)));
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
      res.status(500).json({ success: false, detail: 'Webhook could not be processed.' });
    }
  });

  // Brand-level integrations and reusable communication templates.
  app.get('/api/brand-integrations', requireAuth, (_req, res) => {
    ensureLegacyEmailConnections(db);
    res.json((db.get().brand_integrations || []).map(publicBrandIntegration));
  });

  app.get('/api/email-connections', requireAuth, (req, res) => {
    ensureLegacyEmailConnections(db);
    const brandId = sanitizeString(req.query.brand_id || '', 40);
    const provider = sanitizeString(req.query.provider || '', 40);
    res.json(getEmailConnections(db, brandId || undefined, provider || undefined).map(publicEmailConnection));
  });

  app.post('/api/email-connections/:connection_id/default', requireAdmin, (req, res) => {
    const connectionId = sanitizeString(req.params.connection_id, 120);
    const connection = (db.get().email_connections || []).find(item => item.id === connectionId);
    if (!connection) { res.status(404).json({ detail: 'Mailbox connection not found.' }); return; }
    upsertEmailConnection(db, { ...connection, is_default: true });
    const integration = getBrandIntegration(db, connection.brand_id);
    if (integration) {
      upsertBrandIntegration(db, connection.brand_id, {
        email_provider: connection.provider,
        email_sender_address: connection.provider_email,
        email_reply_to: integration.email_reply_to || connection.provider_email,
      });
    }
    db.save();
    res.json(publicEmailConnection((db.get().email_connections || []).find(item => item.id === connectionId)!));
  });

  app.post('/api/email-connections/custom/:brand_id', requireAdmin, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const email = sanitizeString(req.body.provider_email || req.body.email || '', 254).toLowerCase();
    const smtpHost = sanitizeString(req.body.smtp_host || '', 200);
    const smtpPort = sanitizeString(req.body.smtp_port || '587', 8);
    const smtpPasswordEnv = sanitizeString(req.body.smtp_password_env || '', 120);
    const imapPasswordEnv = sanitizeString(req.body.imap_password_env || req.body.smtp_password_env || '', 120);
    if (!email || !smtpHost) {
      res.status(400).json({ detail: 'Email address and SMTP host are required.' });
      return;
    }
    if (!smtpPasswordEnv) {
      res.status(400).json({ detail: 'Add the mailbox password as a server environment variable, then enter that variable name here.' });
      return;
    }
    if (req.body.imap_host && !imapPasswordEnv) {
      res.status(400).json({ detail: 'Add the IMAP password as a server environment variable, then enter that variable name here.' });
      return;
    }
    const connection = upsertEmailConnection(db, {
      brand_id: brandId,
      tenant_id: DEFAULT_TENANT_ID,
      provider: 'custom_smtp_imap',
      provider_email: email,
      display_name: sanitizeString(req.body.display_name || email, 160),
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_secure: Boolean(req.body.smtp_secure),
      smtp_username: sanitizeString(req.body.smtp_username || email, 254),
      smtp_password: '',
      smtp_password_env: smtpPasswordEnv,
      imap_host: sanitizeString(req.body.imap_host || '', 200),
      imap_port: sanitizeString(req.body.imap_port || '993', 8),
      imap_secure: req.body.imap_secure === undefined ? true : Boolean(req.body.imap_secure),
      imap_username: sanitizeString(req.body.imap_username || email, 254),
      imap_password: '',
      imap_password_env: imapPasswordEnv,
      send_enabled: true,
      sync_enabled: Boolean(req.body.imap_host),
      connection_status: 'connected',
      connected_at: new Date().toISOString(),
      created_by_user_id: req.user!.id,
      oauth_mode: 'central',
      is_default: Boolean(req.body.is_default),
    });
    const integration = getBrandIntegration(db, brandId);
    upsertBrandIntegration(db, brandId, {
      email_provider: integration?.email_provider === 'internal' || !integration?.email_provider ? 'custom_smtp_imap' : integration.email_provider,
      email_sender_address: integration?.email_sender_address || email,
      email_reply_to: integration?.email_reply_to || email,
    });
    db.save();
    res.status(201).json(publicEmailConnection(connection));
  });

  app.post('/api/email-connections/:connection_id/sync', requireAdmin, async (req, res) => {
    try {
      const connectionId = sanitizeString(req.params.connection_id, 120);
      const result = await syncCustomImapMailbox(db, connectionId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ detail: sanitizeString(err?.message || 'Could not sync custom mailbox.', 1000) });
    }
  });

  app.post('/api/email-connections/custom/sync/:brand_id', requireAdmin, async (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const connections = getEmailConnections(db, brandId, 'custom_smtp_imap').filter(connection => connection.sync_enabled !== false);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const connection of connections) {
      try {
        const result = await syncCustomImapMailbox(db, connection.id);
        imported += Number(result.imported || 0);
        skipped += Number(result.skipped || 0);
      } catch (err: any) {
        errors.push(`${connection.provider_email}: ${sanitizeString(err?.message || 'sync failed', 300)}`);
      }
    }
    if (errors.length && imported === 0) {
      res.status(400).json({ detail: errors.join(' | '), imported, skipped });
      return;
    }
    res.json({ imported, skipped, errors });
  });

  app.delete('/api/email-connections/:connection_id', requireAdmin, (req, res) => {
    const connectionId = sanitizeString(req.params.connection_id, 120);
    const current = db.get().email_connections || [];
    const connection = current.find(item => item.id === connectionId);
    if (!connection) { res.status(404).json({ detail: 'Mailbox connection not found.' }); return; }
    db.get().email_connections = current.filter(item => item.id !== connectionId);
    const integration = getBrandIntegration(db, connection.brand_id);
    if (integration && connection.provider === 'gmail' && integration.gmail_connected_email === connection.provider_email) {
      upsertBrandIntegration(db, connection.brand_id, {
        gmail_connected_email: '',
        gmail_refresh_token: '',
        gmail_access_token: '',
        gmail_token_expiry: '',
        gmail_connected_at: '',
        email_provider: integration.email_provider === 'gmail' ? 'internal' : integration.email_provider,
      });
    }
    const purged = connection.provider === 'gmail'
      ? purgeProviderMailForBrand(db, connection.brand_id, 'gmail')
      : { emails_removed: 0, notes_removed: 0 };
    if (integration && connection.provider === 'outlook' && integration.outlook_connected_email === connection.provider_email) {
      upsertBrandIntegration(db, connection.brand_id, {
        outlook_connected_email: '',
        outlook_refresh_token: '',
        outlook_access_token: '',
        outlook_token_expiry: '',
        outlook_connected_at: '',
        email_provider: integration.email_provider === 'outlook' ? 'internal' : integration.email_provider,
      });
    }
    if (integration && connection.provider === 'custom_smtp_imap' && integration.email_sender_address === connection.provider_email) {
      upsertBrandIntegration(db, connection.brand_id, {
        email_provider: integration.email_provider === 'custom_smtp_imap' ? 'internal' : integration.email_provider,
        email_sender_address: '',
        email_reply_to: '',
      });
    }
    db.save();
    res.json({ success: true, purged });
  });

  app.get('/api/integrations/gmail/status/:brand_id', requireAdmin, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const integration = getBrandIntegration(db, brandId);
    const config = getGmailOAuthConfig(req);
    let purged = { emails_removed: 0, notes_removed: 0 };
    if (!integration?.gmail_refresh_token && (db.get().emails || []).some(email => getEmailBrandId(db, email) === brandId && email.provider === 'gmail')) {
      purged = purgeProviderMailForBrand(db, brandId, 'gmail');
      if (purged.emails_removed > 0 || purged.notes_removed > 0) db.save();
    }
    res.json({
      brand_id: brandId,
      configured: Boolean(config.clientId && config.clientSecret),
      redirect_uri: config.redirectUri,
      connected: Boolean(integration?.gmail_refresh_token),
      connected_email: integration?.gmail_connected_email || '',
      connected_at: integration?.gmail_connected_at || '',
      provider: integration?.email_provider || 'internal',
      scope: GMAIL_OAUTH_SCOPES.join(' '),
      purged,
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
      // include gmail.modify so CRM can trash messages in Gmail when deleted here
      scope: GMAIL_OAUTH_SCOPES.join(' '),
      access_type: 'offline',
      include_granted_scopes: 'false',
      prompt: 'consent select_account',
      state,
    });
    res.json({ auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, redirect_uri: config.redirectUri });
  });

  app.post('/api/oauth/gmail/start/:brand_id', requireAdmin, (req, res) => {
    res.status(308).json({
      detail: 'Use /api/integrations/gmail/start/:brand_id. This central OAuth route is reserved for the provider-neutral API.',
      provider: 'gmail',
    });
  });

  app.get('/api/integrations/gmail/callback', async (req, res) => {
    // Google redirects here on the API host (Render). State must not be truncated —
    // it carries brandId + absolute Vercel return URL and is often 250–400+ chars.
    const stateRaw = String(req.query.state || '').trim().slice(0, 8000);
    let returnHint = peekGmailStateReturnTo(stateRaw);
    try {
      const code = sanitizeString(req.query.code || '', 4000);
      const error = sanitizeString(req.query.error || '', 500);
      if (error) throw new Error(error);
      const stateEntry = decodeGmailState(stateRaw);
      if (!code || !stateEntry) {
        throw new Error('Gmail connection expired or invalid. Please start the connection again from the CRM.');
      }
      returnHint = stateEntry.returnTo || returnHint;

      const callbackScope = Array.isArray(req.query.scope) ? req.query.scope.join(' ') : String(req.query.scope || '');
      const callbackMissingScopes = callbackScope ? missingScopes(callbackScope, GMAIL_REQUIRED_CONNECT_SCOPES) : [];
      if (callbackMissingScopes.length > 0) {
        throw new Error(`Google returned login-only access instead of Gmail mailbox access. Start again from Integrations > Email > Connect Gmail and approve Gmail permissions. Missing: ${callbackMissingScopes.join(', ')}`);
      }

      const tokenData: any = await exchangeGoogleCodeForToken(code, req);
      const tokenMissingScopes = missingScopes(tokenData.scope || callbackScope, GMAIL_REQUIRED_CONNECT_SCOPES);
      if (tokenMissingScopes.length > 0) {
        throw new Error(`Gmail connected without the required mailbox permissions. Disconnect/reconnect Gmail and approve Gmail send/read/modify access. Missing: ${tokenMissingScopes.join(', ')}`);
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
      upsertEmailConnection(db, {
        tenant_id: DEFAULT_TENANT_ID,
        brand_id: stateEntry.brandId,
        provider: 'gmail',
        provider_email: connectedEmail,
        display_name: connectedEmail || 'Gmail mailbox',
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expiry: new Date(Date.now() + Number(tokenData.expires_in || 3600) * 1000).toISOString(),
        connection_status: 'connected',
        connected_at: new Date().toISOString(),
        created_by_user_id: stateEntry.userId,
        is_default: true,
        oauth_mode: 'central',
        scopes: GMAIL_OAUTH_SCOPES,
      });
      db.save();

      const successUrl = escapeOAuthRedirectHtml(buildOAuthReturnUrl(req, stateEntry.returnTo, 'gmail=success'));
      res.send(`<!doctype html><html><head><title>Gmail connected</title><meta http-equiv="refresh" content="1;url=${successUrl}" /></head><body style="font-family:Arial,sans-serif;padding:32px;"><h2>Gmail connected</h2><p>${connectedEmail || 'Your Gmail account'} is now connected. Returning to CRM...</p><p><a href="${successUrl}">Back to CRM</a></p></body></html>`);
    } catch (err: any) {
      const errorUrl = escapeOAuthRedirectHtml(buildOAuthReturnUrl(req, returnHint, 'gmail=error'));
      res.status(400).send(`<!doctype html><html><head><title>Gmail connection failed</title><meta http-equiv="refresh" content="3;url=${errorUrl}" /></head><body style="font-family:Arial,sans-serif;padding:32px;"><h2>Gmail connection failed</h2><p>${sanitizeString(err?.message || 'Could not connect Gmail.', 1000)}</p><p><a href="${errorUrl}">Back to CRM</a></p></body></html>`);
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
      const baseUrl = getPublicBaseUrl(req);
      const pixelUrl = `${baseUrl}/api/track/open/${emailId}`;
      const brandName = BRAND_NAMES[brandId] || brandId;
      const subject = `DirotiQ CRM Gmail test for ${brandName}`;
      const html = applyBrandEmailHeader(
        db,
        brandId,
        `<p>This is a test email from DirotiQ CRM for <strong>${brandName}</strong>.</p><p>If you received this, Gmail sending is connected.</p><img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;outline:none;text-decoration:none" alt="" />`
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

  app.post('/api/integrations/gmail/sync/:brand_id', requireAuth, async (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    if (!hasBrandAccess(req.user, brandId)) {
      res.status(403).json({ detail: 'You do not have access to this brand.' });
      return;
    }
    const integration = getBrandIntegration(db, brandId);
    if (!integration?.gmail_refresh_token) {
      res.status(400).json({ detail: 'Gmail is not connected for this brand. Connect Gmail under Integrations, then sync again.' });
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
        if (
          !messageId ||
          seenMessageIds.has(messageId) ||
          db.get().emails.some(e => e.provider_message_id === messageId) ||
          isDeletedProviderMessage(db, brandId, 'gmail', messageId)
        ) {
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
        let createdAt = new Date().toISOString();
        try {
          const headerDate = headers.date ? new Date(headers.date) : null;
          if (headerDate && !Number.isNaN(headerDate.getTime())) {
            createdAt = headerDate.toISOString();
          } else if (detail.internalDate) {
            const internal = new Date(Number(detail.internalDate));
            if (!Number.isNaN(internal.getTime())) createdAt = internal.toISOString();
          }
        } catch { /* keep now */ }
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
      // Tombstone even if trash fails — prevents re-import after CRM delete.
      if (brandId) rememberDeletedProviderMessage(db, brandId, 'gmail', providerMessageId);
      await trashGmailMessage(db, brandId, req, providerMessageId);
      db.save();
      res.json({ success: true, deleted: true, trashed: true });
    } catch (err: any) {
      db.save(); // persist tombstone even on Gmail error
      res.status(400).json({
        detail: sanitizeString(err?.message || 'Could not delete Gmail message.', 1000),
        suppressed_reimport: true,
      });
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
    db.get().email_connections = (db.get().email_connections || []).filter(connection => (
      connection.brand_id !== brandId ||
      connection.provider !== 'gmail'
    ));
    const purged = purgeProviderMailForBrand(db, brandId, 'gmail');
    db.save();
    res.json({ success: true, purged });
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
    // Same pattern as Gmail: signed state carries absolute Vercel return_to (survives multi-instance Render).
    const returnTo = extractReturnTo(req);
    const state = createMailboxOAuthState(brandId, req.user!.id, returnTo, 'outlook');
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

  app.post('/api/oauth/outlook/start/:brand_id', requireAdmin, (req, res) => {
    res.status(308).json({
      detail: 'Use /api/integrations/outlook/start/:brand_id. This central OAuth route is reserved for the provider-neutral API.',
      provider: 'outlook',
    });
  });

  app.post('/api/oauth/yahoo/start/:brand_id', requireAdmin, (_req, res) => {
    // Yahoo Mail has no production browser OAuth path in this CRM yet — connect via SMTP/IMAP app password
    // under Integrations (same as custom SMTP). No Render→Vercel redirect applies until OAuth ships.
    res.status(501).json({
      detail: 'Yahoo does not use browser OAuth here yet. Connect Yahoo under Integrations with SMTP/IMAP (app password). Gmail, Outlook/Microsoft, and Social Hub OAuth already bounce back to the Vercel app after the API callback.',
      provider: 'yahoo',
      status: 'smtp_imap_only',
      connect_via: 'integrations_smtp',
    });
  });

  app.get('/api/integrations/outlook/callback', async (req, res) => {
    // Microsoft redirects here on the API host (Render). State must not be truncated —
    // it carries brandId + absolute Vercel return URL (same fix as Gmail).
    const stateRaw = String(req.query.state || '').trim().slice(0, 8000);
    let returnHint = peekMailboxOAuthStateReturnTo(stateRaw);
    try {
      const code = sanitizeString(req.query.code || '', 4000);
      const error = sanitizeString(req.query.error || '', 500);
      if (error) throw new Error(error);
      let stateEntry = decodeMailboxOAuthState(stateRaw);
      // Deploy fallback: older connections may still use short UUID + in-memory Map.
      if (!stateEntry && stateRaw) {
        const legacy = microsoftOAuthStates.get(stateRaw) || microsoftOAuthStates.get(stateRaw.slice(0, 200));
        if (legacy && Date.now() - legacy.createdAt <= 15 * 60 * 1000) {
          stateEntry = { brandId: legacy.brandId, userId: legacy.userId, returnTo: legacy.returnTo || '/', ts: legacy.createdAt };
          microsoftOAuthStates.delete(stateRaw);
          microsoftOAuthStates.delete(stateRaw.slice(0, 200));
        }
      }
      if (!code || !stateEntry) {
        throw new Error('Outlook connection expired or invalid. Please start the connection again from the CRM.');
      }
      returnHint = stateEntry.returnTo || returnHint;
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
      upsertEmailConnection(db, {
        tenant_id: DEFAULT_TENANT_ID,
        brand_id: stateEntry.brandId,
        provider: 'outlook',
        provider_email: connectedEmail,
        display_name: connectedEmail || 'Outlook mailbox',
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expiry: new Date(Date.now() + Number(tokenData.expires_in || 3600) * 1000).toISOString(),
        connection_status: 'connected',
        connected_at: new Date().toISOString(),
        created_by_user_id: stateEntry.userId,
        is_default: true,
        oauth_mode: 'central',
        scopes: MICROSOFT_GRAPH_SCOPES.split(' '),
      });
      db.save();
      const redirectUrl = escapeOAuthRedirectHtml(buildOAuthReturnUrl(req, stateEntry.returnTo, 'outlook=success'));
      res.send(`<!doctype html><html><head><title>Outlook connected</title><meta http-equiv="refresh" content="1;url=${redirectUrl}" /></head><body style="font-family:Arial,sans-serif;padding:32px;"><h2>Outlook connected</h2><p>${connectedEmail || 'Your Outlook account'} is now connected. Returning to DirotiQ CRM...</p><p><a href="${redirectUrl}">Back to CRM</a></p></body></html>`);
    } catch (err: any) {
      const errorUrl = escapeOAuthRedirectHtml(buildOAuthReturnUrl(req, returnHint, 'outlook=error'));
      res.status(400).send(`<!doctype html><html><head><title>Outlook connection failed</title><meta http-equiv="refresh" content="3;url=${errorUrl}" /></head><body style="font-family:Arial,sans-serif;padding:32px;"><h2>Outlook connection failed</h2><p>${sanitizeString(err?.message || 'Could not connect Outlook.', 1000)}</p><p><a href="${errorUrl}">Back to CRM</a></p></body></html>`);
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
          if (
            !messageId ||
            db.get().emails.some(e => e.provider_message_id === messageId) ||
            isDeletedProviderMessage(db, brandId, 'outlook', messageId)
          ) { skipped++; continue; }
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

  app.get('/api/integrations/whatsapp/embedded/config', requireAdmin, (req, res) => {
    const brandId = sanitizeString(req.query.brand_id || '', 40);
    if (!brandId) { res.status(400).json({ detail: 'Brand is required.' }); return; }
    const config = whatsappEmbeddedConfig();
    if (!config.appId || !config.appSecret || !config.configId) {
      res.status(503).json({ detail: 'WhatsApp connection is temporarily unavailable.' });
      return;
    }
    res.json({ app_id: config.appId, configuration_id: config.configId, graph_version: config.graphVersion });
  });

  app.post('/api/integrations/whatsapp/embedded/complete', requireAdmin, async (req, res) => {
    const brandId = sanitizeString(req.body?.brand_id || '', 40);
    const code = sanitizeString(req.body?.code || '', 3000);
    const wabaId = sanitizeString(req.body?.waba_id || '', 120);
    const phoneNumberId = sanitizeString(req.body?.phone_number_id || '', 120);
    if (!brandId || !code || !wabaId || !phoneNumberId) {
      res.status(400).json({ detail: 'Meta did not return all required WhatsApp connection details. Please try connecting again.' });
      return;
    }
    const config = whatsappEmbeddedConfig();
    if (!config.appId || !config.appSecret || !config.configId) {
      res.status(503).json({ detail: 'WhatsApp connection is temporarily unavailable.' });
      return;
    }
    try {
      const params = new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret, code });
      const tokenResponse = await fetch(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token?${params.toString()}`);
      const tokenPayload = await tokenResponse.json().catch(() => ({}));
      const accessToken = sanitizeString(tokenPayload?.access_token || '', 5000);
      if (!tokenResponse.ok || !accessToken) throw new Error('Meta authorization code exchange failed.');
      await whatsappGraphRequest(`${encodeURIComponent(wabaId)}/subscribed_apps`, accessToken, { method: 'POST', body: JSON.stringify({}) });
      const phone = await whatsappGraphRequest(`${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, accessToken);
      const now = new Date().toISOString();
      const saved = upsertBrandIntegration(db, brandId, {
        whatsapp_provider: 'cloud_api',
        whatsapp_phone_number_id: phoneNumberId,
        whatsapp_business_account_id: wabaId,
        whatsapp_access_token_encrypted: encryptSecret(accessToken),
        whatsapp_connected_at: now,
        whatsapp_number: sanitizeString(phone?.display_phone_number || '', 30),
        whatsapp_profile_name: sanitizeString(phone?.verified_name || '', 120),
      });
      db.save();
      res.json({
        success: true,
        connection: publicBrandIntegration(saved),
        phone_number: saved.whatsapp_number || '',
        verified_name: saved.whatsapp_profile_name || '',
      });
    } catch (error) {
      console.error('WhatsApp Embedded Signup completion failed:', error);
      res.status(502).json({ detail: 'WhatsApp could not be connected. Please confirm the selected Meta business and phone number, then try again.' });
    }
  });

  app.delete('/api/integrations/whatsapp/embedded/:brand_id', requireAdmin, async (req, res) => {
    const brandId = sanitizeString(req.params.brand_id || '', 40);
    const integration = getBrandIntegration(db, brandId);
    const accessToken = decryptSecret(integration?.whatsapp_access_token_encrypted);
    const wabaId = sanitizeString(integration?.whatsapp_business_account_id || '', 120);
    if (accessToken && wabaId) {
      try {
        await whatsappGraphRequest(`${encodeURIComponent(wabaId)}/subscribed_apps`, accessToken, { method: 'DELETE' });
      } catch (error) {
        console.warn('Could not unsubscribe WhatsApp app during disconnect:', error);
      }
    }
    const saved = upsertBrandIntegration(db, brandId, {
      whatsapp_provider: 'manual',
      whatsapp_phone_number_id: '',
      whatsapp_business_account_id: '',
      whatsapp_access_token_encrypted: '',
      whatsapp_connected_at: '',
    });
    db.save();
    res.json({ success: true, connection: publicBrandIntegration(saved) });
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
    const hasToken = Boolean(
      decryptSecret(integration?.whatsapp_access_token_encrypted) ||
      process.env[tokenEnvName] ||
      process.env[`WHATSAPP_${prefix}_ACCESS_TOKEN`] ||
      process.env.WHATSAPP_ACCESS_TOKEN
    );
    const hasPhoneNumberId = Boolean(integration?.whatsapp_phone_number_id || process.env[`WHATSAPP_${prefix}_PHONE_NUMBER_ID`] || process.env.WHATSAPP_PHONE_NUMBER_ID);
    const hasVerifyToken = Boolean(integration?.whatsapp_verify_token || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
    const provider = integration?.whatsapp_provider || 'manual';
    const missing: string[] = [];
    const embeddedSignup = {
      available: Boolean(
        (process.env.META_APP_ID || process.env.WHATSAPP_EMBEDDED_SIGNUP_APP_ID) &&
        (process.env.META_APP_SECRET || process.env.WHATSAPP_EMBEDDED_SIGNUP_APP_SECRET) &&
        process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID
      ),
      app_id_configured: Boolean(process.env.META_APP_ID || process.env.WHATSAPP_EMBEDDED_SIGNUP_APP_ID),
      app_secret_configured: Boolean(process.env.META_APP_SECRET || process.env.WHATSAPP_EMBEDDED_SIGNUP_APP_SECRET),
      config_id_configured: Boolean(process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID),
      redirect_uri: process.env.WHATSAPP_EMBEDDED_SIGNUP_REDIRECT_URI || '',
    };
    const callProvider = integration?.call_provider || 'manual';
    const callSoftphone = {
      available: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET && process.env.TWILIO_TWIML_APP_SID),
      account_configured: Boolean(process.env.TWILIO_ACCOUNT_SID),
      api_key_configured: Boolean(process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET),
      twiml_app_configured: Boolean(process.env.TWILIO_TWIML_APP_SID),
      caller_id_configured: Boolean(process.env.TWILIO_CALLER_ID || integration?.call_number),
    };

    if (provider === 'cloud_api') {
      if (!hasPhoneNumberId) missing.push('Phone Number ID');
      if (!hasToken) missing.push(`server .env token (${tokenEnvName})`);
      if (!hasVerifyToken) missing.push('Webhook Verify Token');
    }

    // Webhooks must hit the API host (Render), not the Vercel SPA origin in PUBLIC_CRM_URL.
    const apiBase = getApiBaseUrl(req);

    res.json({
      brand_id: brandId,
      whatsapp: {
        provider,
        api_ready: provider === 'cloud_api' && missing.length === 0,
        missing,
        embedded_signup: embeddedSignup,
        connected: Boolean(integration?.whatsapp_access_token_encrypted && integration?.whatsapp_phone_number_id),
        connected_at: integration?.whatsapp_connected_at || '',
        display_number: integration?.whatsapp_number || '',
        verified_name: integration?.whatsapp_profile_name || '',
        phone_number_id_saved: Boolean(integration?.whatsapp_phone_number_id),
        access_token_env_name: tokenEnvName,
        access_token_found_on_server: hasToken,
        webhook_verify_token_saved: hasVerifyToken,
        webhook_callback_path: '/api/webhooks/whatsapp',
        webhook_callback_url: `${apiBase}/api/webhooks/whatsapp`,
      },
      call: {
        provider: callProvider,
        manual_ready: Boolean(integration?.call_number),
        softphone_ready: callProvider === 'twilio' && callSoftphone.available,
        missing: callProvider === 'twilio'
          ? [
              ...(!callSoftphone.account_configured ? ['Twilio Account SID'] : []),
              ...(!callSoftphone.api_key_configured ? ['Voice provider API key'] : []),
              ...(!callSoftphone.twiml_app_configured ? ['Voice app SID'] : []),
              ...(!callSoftphone.caller_id_configured ? ['Caller ID / brand call number'] : []),
            ]
          : [],
        softphone: callSoftphone,
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
      whatsapp_access_token_encrypted: current[idx]?.whatsapp_access_token_encrypted || '',
      whatsapp_access_token_env: sanitizeString(req.body.whatsapp_access_token_env || '', 120),
      whatsapp_connected_at: current[idx]?.whatsapp_connected_at || '',
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
    res.json(publicBrandIntegration(next));
  });

  app.get('/api/message-templates', requireAuth, (req, res) => {
    const brandId = sanitizeString(req.query.brand_id || '', 40);
    const channel = sanitizeString(req.query.channel || '', 20);
    let templates = db.get().message_templates || [];
    if (brandId) templates = templates.filter(t => t.brand_id === brandId);
    if (channel) templates = templates.filter(t => t.channel === channel);
    res.json(templates);
  });

  app.post('/api/message-templates', requireAuth, (req, res) => {
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

  app.put('/api/message-templates/:template_id', requireAuth, (req, res) => {
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

  app.delete('/api/message-templates/:template_id', requireAuth, (req, res) => {
    const before = db.get().message_templates || [];
    const after = before.filter(t => t.id !== req.params.template_id);
    if (after.length === before.length) { res.status(404).json({ detail: 'Template not found' }); return; }
    db.get().message_templates = after;
    db.save();
    res.json({ success: true });
  });

  registerLeadSourceRoutes(app, {
    db,
    requireAdmin: requireAuth,
    workspaceIdFor: () => '',
    inWorkspace: () => true,
    brandInWorkspace: (brandId: string) => db.get().brand_funnels.some(brand => brand.brand_id === brandId),
    workspaceLimitError: () => '',
    ensureBrandCustomFieldDefinitions: (database, brandId, fields) => ensureBrandCustomFieldDefinitions(database, brandId, fields),
    findExistingLeadByContact,
    newId,
    getPublicBaseUrl,
  });

  registerWebsiteAnalyticsRoutes(app, {
    db,
    requireAdmin: requireAuth,
    workspaceIdFor: () => '',
    inWorkspace: () => true,
    brandInWorkspace: (brandId: string) => db.get().brand_funnels.some(brand => brand.brand_id === brandId),
    newId,
    getPublicBaseUrl,
  });

  const socialHubRouteContext = {
    db,
    requireAuth,
    requireAdmin,
    workspaceIdFor: () => '',
    inWorkspace: () => true,
    brandInWorkspace: (brandId: string) => db.get().brand_funnels.some(brand => brand.brand_id === brandId),
    newId,
    getPublicBaseUrl,
    getApiBaseUrl,
    getFrontendBaseUrl,
    buildOAuthReturnUrl,
    sanitizeReturnTo,
    isAdminUser,
    hasBrandAccess,
  };
  registerSocialHubRoutes(app, socialHubRouteContext);
  startSocialPostScheduler(socialHubRouteContext);

  app.get('/api/intelligence/portfolio-opportunities', requireAuth, (_req, res) => {
    const rules = db.get().portfolio_opportunity_rules || [];
    const opportunities = (db.get().portfolio_opportunities || [])
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map(item => {
        const sourceLead = db.get().leads.find(lead => lead.id === item.source_lead_id);
        const sourceBrand = db.get().brand_funnels.find(brand => brand.brand_id === item.source_brand_id);
        const targetBrand = db.get().brand_funnels.find(brand => brand.brand_id === item.target_brand_id);
        return {
          ...item,
          source_lead: sourceLead ? { id: sourceLead.id, name: sourceLead.name, email: sourceLead.email, phone: sourceLead.phone, funnel_stage: sourceLead.funnel_stage } : null,
          source_brand_name: sourceBrand?.brand_name || item.source_brand_id,
          target_brand_name: targetBrand?.brand_name || item.target_brand_id,
        };
      });
    res.json({
      rules,
      opportunities,
      counts: {
        pending: opportunities.filter(item => item.status === 'pending').length,
        accepted: opportunities.filter(item => item.status === 'accepted').length,
        dismissed: opportunities.filter(item => item.status === 'dismissed').length,
      },
    });
  });

  app.post('/api/intelligence/portfolio-opportunities/rules', requireAuth, (req, res) => {
    const sourceBrandId = sanitizeString(req.body?.source_brand_id || '', 80);
    const targetBrandId = sanitizeString(req.body?.target_brand_id || '', 80);
    const hasSource = db.get().brand_funnels.some(brand => brand.brand_id === sourceBrandId);
    const hasTarget = db.get().brand_funnels.some(brand => brand.brand_id === targetBrandId);
    if (!hasSource || !hasTarget) {
      res.status(404).json({ detail: 'Choose two existing brands.' });
      return;
    }
    if (sourceBrandId === targetBrandId) {
      res.status(400).json({ detail: 'Source and target brands must be different.' });
      return;
    }
    const triggerValue = sanitizeString(req.body?.trigger_value || '', 240);
    const offerLabel = sanitizeString(req.body?.offer_label || '', 240);
    if (!triggerValue || !offerLabel) {
      res.status(400).json({ detail: 'Add the matching value and the opportunity you want to recommend.' });
      return;
    }
    const rule: DbPortfolioOpportunityRule = {
      id: newId('portfolio-rule'),
      name: sanitizeString(req.body?.name || `${sourceBrandId} to ${targetBrandId} opportunity`, 160),
      source_brand_id: sourceBrandId,
      target_brand_id: targetBrandId,
      trigger_field: sanitizeString(req.body?.trigger_field || 'stage', 80),
      trigger_operator: sanitizeString(req.body?.trigger_operator || 'contains', 40),
      trigger_value: triggerValue,
      required_keywords: keywordList(req.body?.required_keywords || []),
      excluded_keywords: keywordList(req.body?.excluded_keywords || []),
      respect_market_scope: req.body?.respect_market_scope !== false,
      minimum_keyword_matches: Math.max(1, Math.min(5, Number(req.body?.minimum_keyword_matches || 1))),
      max_results_per_scan: Math.max(1, Math.min(50, Number(req.body?.max_results_per_scan || 10))),
      offer_label: offerLabel,
      active: req.body?.active !== false,
      created_by_user_id: req.user?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.get().portfolio_opportunity_rules = db.get().portfolio_opportunity_rules || [];
    db.get().portfolio_opportunity_rules!.push(rule);
    db.save();
    res.status(201).json(rule);
  });

  app.delete('/api/intelligence/portfolio-opportunities/rules/:rule_id', requireAuth, (req, res) => {
    const before = (db.get().portfolio_opportunity_rules || []).length;
    db.get().portfolio_opportunity_rules = (db.get().portfolio_opportunity_rules || []).filter(rule => rule.id !== req.params.rule_id);
    if (before === db.get().portfolio_opportunity_rules.length) {
      res.status(404).json({ detail: 'Portfolio opportunity rule not found.' });
      return;
    }
    db.save();
    res.json({ success: true });
  });

  app.post('/api/intelligence/portfolio-opportunities/scan', requireAuth, (_req, res) => {
    const rules = (db.get().portfolio_opportunity_rules || []).filter(rule => rule.active);
    db.get().portfolio_opportunities = db.get().portfolio_opportunities || [];
    const created: DbPortfolioOpportunity[] = [];
    for (const rule of rules) {
      const sourceBrand = db.get().brand_funnels.find(brand => brand.brand_id === rule.source_brand_id);
      const targetBrand = db.get().brand_funnels.find(brand => brand.brand_id === rule.target_brand_id);
      if (!targetBrand) continue;
      const matchingLeads = db.get().leads
        .filter(lead => lead.brand_id === rule.source_brand_id)
        .map(lead => ({ lead, fit: portfolioRuleFit(lead, rule, targetBrand) }))
        .filter(item => item.fit)
        .slice(0, Math.max(1, Math.min(50, Number(rule.max_results_per_scan || 10))));
      for (const { lead, fit } of matchingLeads) {
        const exists = db.get().portfolio_opportunities!.some(item => item.rule_id === rule.id && item.source_lead_id === lead.id);
        if (exists) continue;
        const matchedValue = portfolioFieldValue(lead, rule.trigger_field);
        const opportunity: DbPortfolioOpportunity = {
          id: newId('portfolio-opportunity'),
          rule_id: rule.id,
          source_lead_id: lead.id,
          source_brand_id: rule.source_brand_id,
          target_brand_id: rule.target_brand_id,
          status: 'pending',
          title: `${lead.name || 'This lead'} may be a fit for ${targetBrand?.brand_name || rule.target_brand_id}`,
          reason: `${sourceBrand?.brand_name || rule.source_brand_id} ${rule.trigger_field} matched "${matchedValue}"${fit?.matched_keywords?.length ? ` with audience fit: ${fit.matched_keywords.join(', ')}` : ''}. Suggested opportunity: ${rule.offer_label}.`,
          offer_label: rule.offer_label,
          created_at: new Date().toISOString(),
        };
        db.get().portfolio_opportunities!.push(opportunity);
        created.push(opportunity);
      }
    }
    const brands = db.get().brand_funnels || [];
    const profileCreatedByTarget: Record<string, number> = {};
    for (const lead of db.get().leads || []) {
      const sourceBrand = brands.find(brand => brand.brand_id === lead.brand_id);
      for (const targetBrand of brands) {
        if (targetBrand.brand_id === lead.brand_id) continue;
        if ((profileCreatedByTarget[targetBrand.brand_id] || 0) >= 10) continue;
        const profileMatch = matchLeadToBrandProfile(lead, targetBrand);
        if (!profileMatch) continue;
        const exists = db.get().portfolio_opportunities!.some(item =>
          item.rule_id === 'brand-profile-match' &&
          item.source_lead_id === lead.id &&
          item.target_brand_id === targetBrand.brand_id
        );
        if (exists) continue;
        const offer = sanitizeString(targetBrand.cross_sell_notes || `Introduce ${targetBrand.brand_name}`, 240);
        const opportunity: DbPortfolioOpportunity = {
          id: newId('portfolio-opportunity'),
          rule_id: 'brand-profile-match',
          source_lead_id: lead.id,
          source_brand_id: lead.brand_id,
          target_brand_id: targetBrand.brand_id,
          status: 'pending',
          title: `${lead.name || 'This lead'} may fit ${targetBrand.brand_name}`,
          reason: `${targetBrand.brand_name} audience profile matched ${profileMatch.matched_keywords.join(', ')} from ${sourceBrand?.brand_name || lead.brand_name || lead.brand_id}.`,
          offer_label: offer,
          created_at: new Date().toISOString(),
        };
        db.get().portfolio_opportunities!.push(opportunity);
        created.push(opportunity);
        profileCreatedByTarget[targetBrand.brand_id] = (profileCreatedByTarget[targetBrand.brand_id] || 0) + 1;
      }
    }
    db.save();
    res.json({ scanned_rules: rules.length, created: created.length, opportunities: created });
  });

  app.post('/api/intelligence/portfolio-opportunities/:opportunity_id/accept', requireAuth, (req, res) => {
    const opportunity = (db.get().portfolio_opportunities || []).find(item => item.id === req.params.opportunity_id);
    if (!opportunity) { res.status(404).json({ detail: 'Portfolio opportunity not found.' }); return; }
    if (opportunity.status !== 'pending') { res.status(409).json({ detail: 'This opportunity has already been reviewed.' }); return; }
    const sourceLead = db.get().leads.find(lead => lead.id === opportunity.source_lead_id);
    const targetBrand = db.get().brand_funnels.find(brand => brand.brand_id === opportunity.target_brand_id);
    if (!sourceLead || !targetBrand) { res.status(404).json({ detail: 'The source lead or target brand is no longer available.' }); return; }

    const sourceEmail = normalizedContact(sourceLead.email);
    const sourcePhone = normalizedContact(sourceLead.phone);
    let targetLead = db.get().leads.find(lead =>
      lead.brand_id === opportunity.target_brand_id &&
      ((sourceEmail && normalizedContact(lead.email) === sourceEmail) || (sourcePhone && normalizedContact(lead.phone) === sourcePhone))
    );
    if (!targetLead) {
      targetLead = {
        id: newId('lead'),
        brand_id: targetBrand.brand_id,
        brand_name: targetBrand.brand_name,
        name: sourceLead.name,
        email: sourceLead.email,
        phone: sourceLead.phone,
        funnel_stage: targetBrand.stages?.[0] || 'New Lead',
        notes: `Created from a reviewed portfolio opportunity: ${opportunity.offer_label}.`,
        tags: Array.from(new Set([...(sourceLead.tags || []), 'Portfolio opportunity'])),
        custom_fields: {
          portfolio_source_lead_id: sourceLead.id,
          portfolio_source_brand_id: sourceLead.brand_id,
          portfolio_opportunity_id: opportunity.id,
          portfolio_offer: opportunity.offer_label,
        },
        owner_id: req.user?.id,
        owner_name: req.user?.name,
        created_at: new Date().toISOString(),
      };
      db.get().leads.push(targetLead);
    }
    const now = new Date().toISOString();
    opportunity.status = 'accepted';
    opportunity.target_lead_id = targetLead.id;
    opportunity.reviewed_by_user_id = req.user?.id;
    opportunity.reviewed_at = now;
    opportunity.updated_at = now;
    db.get().notes.push({
      id: newId('note'),
      lead_id: sourceLead.id,
      content: `Portfolio opportunity accepted for ${targetBrand.brand_name}: ${opportunity.offer_label}.`,
      created_by: req.user?.name || 'CRM',
      created_at: now,
    });
    db.save();
    res.json({ opportunity, target_lead: targetLead });
  });

  app.post('/api/intelligence/portfolio-opportunities/:opportunity_id/dismiss', requireAuth, (req, res) => {
    const opportunity = (db.get().portfolio_opportunities || []).find(item => item.id === req.params.opportunity_id);
    if (!opportunity) { res.status(404).json({ detail: 'Portfolio opportunity not found.' }); return; }
    if (opportunity.status !== 'pending') { res.status(409).json({ detail: 'This opportunity has already been reviewed.' }); return; }
    opportunity.status = 'dismissed';
    opportunity.reviewed_by_user_id = req.user?.id;
    opportunity.reviewed_at = new Date().toISOString();
    opportunity.updated_at = opportunity.reviewed_at;
    db.save();
    res.json(opportunity);
  });

  app.post('/api/intelligence/portfolio-opportunities/dismiss-pending', requireAuth, (req, res) => {
    const sourceBrandId = sanitizeString(req.body?.source_brand_id || '', 80);
    const targetBrandId = sanitizeString(req.body?.target_brand_id || '', 80);
    const now = new Date().toISOString();
    let count = 0;
    (db.get().portfolio_opportunities || []).forEach(item => {
      if (item.status !== 'pending') return;
      if (sourceBrandId && item.source_brand_id !== sourceBrandId) return;
      if (targetBrandId && item.target_brand_id !== targetBrandId) return;
      item.status = 'dismissed';
      item.reviewed_by_user_id = req.user?.id;
      item.reviewed_at = now;
      item.updated_at = now;
      count++;
    });
    db.save();
    res.json({ success: true, count });
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

  // â”€â”€â”€ Outgoing messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    const selectedAccount = getEmailAccountForSend(db, integration, sanitizeString(req.body.email_account_id || '', 120));
    const selectedProvider = selectedAccount?.provider || integration?.email_provider || 'internal';
    let providerMessageId = '';
    let sendStatus: DbEmail['status'] = 'sent';
    let errorMessage = '';

    // Generate ID upfront so the pixel URL can reference it
    const emailId = newId('email');
    const baseUrl = getPublicBaseUrl(req);
    const pixelUrl = `${baseUrl}/api/track/open/${emailId}`;
    const trackedHtml = `${html_content}<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;outline:none;text-decoration:none" alt="" />`;
    const storedHtml = ['gmail', 'outlook', 'yahoo', 'smtp', 'custom_smtp_imap'].includes(selectedProvider) ? applyBrandEmailHeader(db, effectiveBrandId, trackedHtml) : trackedHtml;

    if (['gmail', 'outlook', 'yahoo', 'smtp', 'custom_smtp_imap'].includes(selectedProvider)) {
try {
  const accessToken = await refreshGmailAccessToken(db, brandId, req);
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
      content: `${sendStatus === 'sent' ? 'Email sent' : 'Email failed'}${['gmail', 'outlook', 'yahoo', 'smtp', 'custom_smtp_imap'].includes(selectedProvider) ? ` via ${selectedProvider}` : ''}${template_name ? ` ("${template_name}")` : ''}. Subject: "${subject}"${errorMessage ? ` Error: ${errorMessage}` : ''}`,
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
    const selectedAccount = getEmailAccountForSend(db, integration, sanitizeString(req.body.email_account_id || '', 120));
    const selectedProvider = selectedAccount?.provider || integration?.email_provider || 'internal';
    let providerMessageId = '';
    let sendStatus: DbEmail['status'] = 'sent';
    let errorMessage = '';

    // Generate ID upfront for tracking pixel
    const directEmailId = newId('email');
    const baseUrlDirect = getPublicBaseUrl(req);
    const pixelUrlDirect = `${baseUrlDirect}/api/track/open/${directEmailId}`;
    const trackedHtmlDirect = `${htmlContent}<img src="${pixelUrlDirect}" width="1" height="1" style="display:none;border:0;outline:none;text-decoration:none" alt="" />`;
    const storedHtmlDirect = ['gmail', 'outlook', 'yahoo', 'smtp', 'custom_smtp_imap'].includes(selectedProvider) ? applyBrandEmailHeader(db, brandId, trackedHtmlDirect) : trackedHtmlDirect;

    if (['gmail', 'outlook', 'yahoo', 'smtp', 'custom_smtp_imap'].includes(selectedProvider)) {
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

  // â”€â”€â”€ Custom fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get('/api/brands/:brand_id/custom-fields', requireAuth, (req, res) => {
    res.json(db.get().custom_fields.filter(f => f.brand_id === req.params.brand_id));
  });

  /** Names the user permanently deleted â€” auto-seed / required fields must not recreate these. */
  app.get('/api/brands/:brand_id/deleted-custom-fields', requireAuth, (req, res) => {
    const deleted = ((db.get() as any).deleted_custom_fields || {})[req.params.brand_id] || [];
    res.json(Array.isArray(deleted) ? deleted : []);
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
    const deleted = ((db.get() as any).deleted_custom_fields ||= {});
    const brandDeleted: string[] = deleted[brand_id] || [];
    deleted[brand_id] = brandDeleted.filter(name => String(name).toLowerCase() !== field_name.toLowerCase());
    db.save();
    res.status(201).json(newField);
  });

  app.patch('/api/custom-fields/:field_id', requireAuth, (req, res) => {
    const field = db.get().custom_fields.find(f => f.id === req.params.field_id);
    if (!field) { res.status(404).json({ detail: 'Custom field not found' }); return; }
    const nextName = sanitizeString(req.body.field_name, 60);
    const rawNextType = sanitizeString(req.body.field_type, 30);
    const nextType = (['text', 'number', 'boolean', 'date'] as const).includes(rawNextType as any)
      ? rawNextType as 'text' | 'number' | 'boolean' | 'date'
      : '';
    if (!nextName) { res.status(400).json({ detail: 'field_name is required' }); return; }
    const duplicate = db.get().custom_fields.find(
      f => f.id !== field.id && f.brand_id === field.brand_id && f.field_name.toLowerCase() === nextName.toLowerCase()
    );
    if (duplicate) { res.status(409).json({ detail: 'A column with this name already exists for this brand.' }); return; }

    const oldName = field.field_name;
    field.field_name = nextName;
    if (nextType) field.field_type = nextType;
    field.required = !!req.body.required;

    if (oldName !== nextName) {
      db.get().leads
        .filter(l => l.brand_id === field.brand_id && l.custom_fields && Object.prototype.hasOwnProperty.call(l.custom_fields, oldName))
        .forEach(l => {
          l.custom_fields = l.custom_fields || {};
          l.custom_fields[nextName] = l.custom_fields[oldName];
          delete l.custom_fields[oldName];
        });
    }

    db.save();
    res.json(field);
  });

  app.delete('/api/custom-fields/:field_id', requireAuth, (req, res) => {
    const field = db.get().custom_fields.find(f => f.id === req.params.field_id);
    if (field) {
      // Mirror client protected set: search / pipeline / contact cores cannot be permanently deleted.
      const protectedNames = new Set(['name', 'email', 'phone', 'added', 'segment', 'stage', 'tags']);
      if (protectedNames.has(String(field.field_name || '').toLowerCase().trim())) {
        res.status(400).json({
          detail: `Column "${field.field_name}" is protected (used by search/filters) and cannot be deleted.`,
        });
        return;
      }
      const deleted = ((db.get() as any).deleted_custom_fields ||= {});
      const brandDeleted = new Set<string>((deleted[field.brand_id] || []).map((name: string) => String(name).toLowerCase()));
      brandDeleted.add(field.field_name.toLowerCase());
      deleted[field.brand_id] = Array.from(brandDeleted);
      db.get().leads
        .filter(l => l.brand_id === field.brand_id && l.custom_fields)
        .forEach(l => {
          if (l.custom_fields) delete l.custom_fields[field.field_name];
        });
    }
    db.get().custom_fields = db.get().custom_fields.filter(f => f.id !== req.params.field_id);
    db.save();
    res.json({ success: true });
  });

  // â”€â”€â”€ Brand workspace snapshot cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get('/api/brands/:brand_id/snapshot-cards', requireAuth, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const cards = (db.get().brand_workspace_snapshots || []).filter((c: any) => c.brand_id === brandId);
    res.json(cards);
  });

  app.post('/api/brands/:brand_id/snapshot-cards', requireAuth, (req, res) => {
    const brandId = sanitizeString(req.params.brand_id, 40);
    const {
      id, label, fieldKey, matchValue, target, unit, icon, color, active
    } = req.body || {};
    if (!id || !label || !fieldKey || !unit) {
      res.status(400).json({ detail: 'id, label, fieldKey, and unit are required.' });
      return;
    }
    const cards = db.get().brand_workspace_snapshots || [];
    const existing = cards.find((c: any) => c.id === id && c.brand_id === brandId);
    const card: any = {
      id: sanitizeString(id, 80),
      brand_id: brandId,
      label: sanitizeString(label, 120),
      fieldKey: sanitizeString(fieldKey, 60),
      matchValue: matchValue !== undefined ? sanitizeString(String(matchValue), 120) : undefined,
      target: target !== undefined ? Number(target) || undefined : undefined,
      unit: sanitizeString(unit, 40),
      icon: sanitizeString(icon || 'fa-bullseye', 40),
      color: sanitizeString(color || '#8B5CF6', 20),
      active: active !== false,
    };
    if (existing) {
      Object.assign(existing, card);
    } else {
      cards.push(card);
    }
    db.get().brand_workspace_snapshots = cards;
    db.save();
    res.status(existing ? 200 : 201).json(card);
  });

  app.patch('/api/snapshot-cards/:card_id', requireAuth, (req, res) => {
    const cardId = sanitizeString(req.params.card_id, 80);
    const cards = db.get().brand_workspace_snapshots || [];
    const card = cards.find((c: any) => c.id === cardId);
    if (!card) { res.status(404).json({ detail: 'Snapshot card not found.' }); return; }
    const allowed = ['label', 'fieldKey', 'matchValue', 'target', 'unit', 'icon', 'color', 'active'] as const;
    allowed.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        const raw = req.body[key];
        if (key === 'target') {
          card.target = raw !== undefined ? Number(raw) || undefined : undefined;
        } else if (key === 'active') {
          card.active = raw !== false;
        } else {
          (card as any)[key] = sanitizeString(String(raw || ''), key === 'label' ? 120 : key === 'fieldKey' ? 60 : key === 'matchValue' ? 120 : key === 'unit' ? 40 : key === 'icon' ? 40 : key === 'color' ? 20 : 80);
        }
      }
    });
    db.save();
    res.json(card);
  });

  app.delete('/api/snapshot-cards/:card_id', requireAuth, (req, res) => {
    const cardId = sanitizeString(req.params.card_id, 80);
    const cards = db.get().brand_workspace_snapshots || [];
    const idx = cards.findIndex((c: any) => c.id === cardId);
    if (idx === -1) { res.status(404).json({ detail: 'Snapshot card not found.' }); return; }
    cards.splice(idx, 1);
    db.get().brand_workspace_snapshots = cards;
    db.save();
    res.json({ success: true });
  });

  // â”€â”€â”€ Sequences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function sanitizeSequenceSteps(input: unknown) {
    if (!Array.isArray(input)) return [];
    return input
      .map((step: any) => ({
        id: sanitizeString(step?.id || newId('step'), 60),
        name: sanitizeString(step?.name || '', 120),
        delay_days: Math.max(0, Math.min(365, Number.parseInt(String(step?.delay_days ?? 0), 10) || 0)),
        channel: sanitizeString(step?.channel || 'email', 30),
        subject: sanitizeString(step?.subject || '', 200),
        html_content: sanitizeString(step?.html_content || '', 50000),
      }))
      .filter(step => step.name);
  }

  app.get('/api/sequences', requireAuth, (req, res) => {
    const { brand_id } = req.query;
    let seqs = db.get().sequences;
    if (brand_id) seqs = seqs.filter(s => s.brand_id === brand_id);
    res.json(seqs);
  });

  app.get('/api/sequences/stats', requireAuth, (req, res) => {
    const brandId = sanitizeString(req.query.brand_id || '', 40);
    const seqs = db.get().sequences.filter(seq => !brandId || seq.brand_id === brandId);
    const stats = Object.fromEntries(seqs.map(seq => {
      const enrollments = db.get().enrollments.filter(enroll => enroll.sequence_id === seq.id);
      return [seq.id, {
        total: enrollments.length,
        active: enrollments.filter(enroll => enroll.status === 'active').length,
        completed: enrollments.filter(enroll => enroll.status === 'completed').length,
        cancelled: enrollments.filter(enroll => enroll.status === 'cancelled').length,
        next_due: enrollments
          .filter(enroll => enroll.status === 'active')
          .map(enroll => {
            const step = seq.steps?.[enroll.current_step];
            if (!step) return '';
            const date = new Date(enroll.enrolled_at);
            const cumulativeDelayDays = (seq.steps || [])
              .slice(0, enroll.current_step + 1)
              .reduce((total, currentStep) => total + Number(currentStep.delay_days || 0), 0);
            date.setDate(date.getDate() + cumulativeDelayDays);
            return date.toISOString();
          })
          .filter(Boolean)
          .sort()[0] || '',
      }];
    }));
    res.json(stats);
  });

  app.post('/api/sequences', requireAuth, (req, res) => {
    const { brand_id, name, description, trigger_stage, active, steps } = req.body;
    if (!brand_id || !name) { res.status(400).json({ detail: 'brand_id and name are required' }); return; }
    const cleanSteps = sanitizeSequenceSteps(steps);
    if (cleanSteps.length === 0) { res.status(400).json({ detail: 'Add at least one communication step before saving.' }); return; }

    const newSeq: DbSequence = {
      id: newId('seq'),
      brand_id: sanitizeString(brand_id, 40),
      name: sanitizeString(name, 120),
      description: sanitizeString(description, 500),
      trigger_stage: sanitizeString(trigger_stage, 80),
      active: active !== undefined ? active : true,
      steps: cleanSteps,
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
    const cleanSteps = steps !== undefined ? sanitizeSequenceSteps(steps) : orig.steps;
    if (steps !== undefined && cleanSteps.length === 0) { res.status(400).json({ detail: 'Add at least one communication step before saving.' }); return; }
    db.get().sequences[idx] = {
      ...orig,
      name:          name          !== undefined ? sanitizeString(name, 120)         : orig.name,
      description:   description   !== undefined ? sanitizeString(description, 500)  : orig.description,
      trigger_stage: trigger_stage !== undefined ? sanitizeString(trigger_stage, 80) : orig.trigger_stage,
      active:        active        !== undefined ? active                             : orig.active,
      steps:         cleanSteps,
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

  // Bulk enroll â€” uses shared helper
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
      if (!lead || lead.brand_id !== seq.brand_id) continue;

      // Pass session user name through for the note
      const enrolled = enrollLeadInSequence(lead, seq, sessionUserName);
      if (enrolled) enrolledCount++;
    }

    db.save();
    res.json({ success: true, enrolledCount });
  });

  // â”€â”€â”€ CSV upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      const {
        brand_id,
        brand_name,
        funnel_stage,
        mappings,
        dataRows,
        default_custom_fields,
        lead_destination,
        // skip = drop matches (legacy default), merge = fill existing CRM record,
        // create = always insert a new lead (e.g. returning customer / new segment).
        duplicate_strategy: rawStrategy,
        duplicate_segment,
      } = req.body;
      if (!brand_id || !funnel_stage || !dataRows || !mappings) {
        res.status(400).json({ detail: 'brand_id, funnel_stage, mappings, and dataRows are required.' });
        return;
      }

      const allowedStrategies = new Set(['skip', 'merge', 'create']);
      const duplicateStrategy = allowedStrategies.has(String(rawStrategy || '').toLowerCase())
        ? String(rawStrategy).toLowerCase()
        : 'skip';
      const dupSegment = sanitizeString(duplicate_segment || '', 80);
      const leadDestination = sanitizeString(String(lead_destination || 'prospect').toLowerCase(), 20);

      const sessionUser = req.user!;
      const existingCf = db.get().custom_fields.filter(f => f.brand_id === brand_id);
      const existingCfNames = new Set(existingCf.map(f => f.field_name.toLowerCase()));
      const deletedCfNames = new Set((((db.get() as any).deleted_custom_fields || {})[brand_id] || []).map((name: string) => String(name).toLowerCase()));

      Object.keys(mappings).forEach(targetKey => {
        if (!['name', 'name_secondary', 'email', 'phone', 'created_at', 'id'].includes(targetKey)) {
          const cleanKey = sanitizeString(targetKey, 60);
          if (!existingCfNames.has(cleanKey.toLowerCase()) && !deletedCfNames.has(cleanKey.toLowerCase())) {
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
      let mergedCount = 0;
      let skippedCount = 0;

      const buildExtraFields = (row: Record<string, any>, forDuplicate: boolean) => {
        let extraFields: Record<string, string> = { ...(default_custom_fields || {}) };
        // Returning-customer segment only applies when handling a CRM match as create/merge.
        if (forDuplicate && dupSegment) {
          extraFields.segment = dupSegment;
        }
        Object.entries(mappings).forEach(([target, source]) => {
          if (!['name', 'name_secondary', 'email', 'phone', 'created_at'].includes(target) && source) {
            extraFields[sanitizeString(target, 60)] = sanitizeString(row[source as string], 500);
          }
        });
        const brandDefaults = BRAND_DEFAULTS[brand_id] || {};
        for (const [k, v] of Object.entries(brandDefaults)) {
          if (!extraFields[k]) extraFields[k] = v;
        }
        return normalizeImportedCustomFields(brand_id, extraFields);
      };

      const resolveRowAction = (row: Record<string, any>): 'skip' | 'merge' | 'create' => {
        const raw = String(row.__import_action || row.__duplicate_action || '').toLowerCase();
        if (raw === 'skip' || raw === 'merge' || raw === 'create') return raw;
        return duplicateStrategy as 'skip' | 'merge' | 'create';
      };

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
            const first = Object.entries(row).find(([k, v]) => k !== 'id' && !String(k).startsWith('__') && v && String(v).trim().length > 0 && String(v).length < 60);
            name = first ? sanitizeString(first[1], 120) : 'Unnamed Lead';
          }
        }

        // Names are not unique identifiers. A bulk import only treats an exact
        // email or phone match as an existing contact.
        const existing = findExistingLeadByContact(db, email, phone, brand_id);
        const action = resolveRowAction(row);

        if (existing) {
          if (action === 'skip') {
            skippedCount++;
            continue;
          }

          if (action === 'merge') {
            const extraFields = buildExtraFields(row, true);
            // Fill blanks on the CRM record; never wipe existing values.
            if (!existing.email && email) existing.email = email;
            if (!existing.phone && phone) existing.phone = phone;
            if ((!existing.name || isGenericLeadName(existing.name)) && name && !isGenericLeadName(name)) {
              existing.name = name;
            }
            const cf = { ...(existing.custom_fields || {}) };
            for (const [k, v] of Object.entries(extraFields)) {
              if (v === undefined || v === null || String(v).trim() === '') continue;
              // Segment can be intentionally updated for returning customers.
              if (k === 'segment') {
                if (dupSegment || !cf.segment) cf.segment = String(v);
                continue;
              }
              if (!cf[k] || cf[k] === '' || cf[k] === 'N/A') {
                cf[k] = v;
              }
            }
            existing.custom_fields = cf;
            const tagSet = new Set([...(existing.tags || []), 'CSV Merge', 'CSV Aggregator']);
            existing.tags = Array.from(tagSet);

            db.get().notes.push({
              id: newId('note'),
              lead_id: existing.id,
              content: `Lead updated via bulk import merge${dupSegment ? ` (segment: ${dupSegment})` : ''}.`,
              created_by: sessionUser.name,
              created_at: new Date().toISOString(),
            });
            mergedCount++;
            continue;
          }
          // action === 'create' â†’ fall through and insert a new lead
        }

        const extraFields = buildExtraFields(row, Boolean(existing));
        const sourceCreatedAt = mappings.created_at ? parseLeadDateInput(row[mappings.created_at]) : null;
        const newLeadId = newId('lead');

        db.get().leads.push({
          id: newLeadId,
          brand_id,
          brand_name: brand_name || 'Brand',
          name,
          email,
          phone,
          funnel_stage,
          tags: existing ? ['CSV Aggregator', 'Import Duplicate'] : ['CSV Aggregator'],
          custom_fields: extraFields,
          created_at: sourceCreatedAt || new Date().toISOString(),
          lead_classification: leadDestination === 'verified' ? 'verified' : 'prospect',
          classification_updated_at: new Date().toISOString(),
          classification_updated_by: sessionUser.id,
          classification_reason: existing
            ? 'Imported via CSV as additional record (duplicate create)'
            : 'Imported via bulk CSV uploader',
        });

        db.get().notes.push({
          id: newId('note'),
          lead_id: newLeadId,
          content: existing
            ? `Lead imported as a new record alongside existing CRM match "${existing.name}" (${existing.id})${dupSegment ? `. Assigned segment: ${dupSegment}` : ''}.`
            : 'Lead imported via bulk CSV uploader.',
          created_by: sessionUser.name,
          created_at: new Date().toISOString(),
        });

        addedCount++;
      }

      db.save();
      res.json({
        success: true,
        count: addedCount + mergedCount,
        added: addedCount,
        merged: mergedCount,
        skipped: skippedCount,
        strategy: duplicateStrategy,
      });
    } catch (err: any) {
      console.error('CSV upload error:', err);
      res.status(500).json({ detail: err.message || 'Fatal error during CSV ingestion.' });
    }
  });

  // â”€â”€â”€ Dedupe / Merge duplicate leads (admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Identity: same brand + (email || phone). Name-only matches are excluded here
  // because name resolution is ambiguous; the frontend handles name-only warnings
  // at import time. This endpoint permanently merges duplicates into the earliest
  // record per group, re-parents notes/calls/emails/whatsapp/enrollments, and
  // removes the copies from the database.
  function getLeadIdentityKeyForBrand(l: DbLead): string {
    const email = (l.email || '').toLowerCase().trim();
    if (email) return `${l.brand_id}::email:${email}`;
    const phone = normalizePhone(l.phone || '');
    if (phone) return `${l.brand_id}::phone:${phone}`;
    return `${l.brand_id}::name:${(l.name || l.id).toLowerCase().trim()}`;
  }

  app.post('/api/leads/dedupe', requireAuth, (req, res) => {
    const BACKUP_DIR = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    // 1. Backup current db.json
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(BACKUP_DIR, `db-before-dedupe-${stamp}.json`);
    try {
      const current = db.get();
      fs.writeFileSync(backupPath, JSON.stringify(current, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to create pre-dedupe backup:', err);
      res.status(500).json({ detail: 'Could not create safety backup. Aborting merge.' });
      return;
    }

    try {
      const data = db.get();

      // 2. Group leads by brand-scoped identity key (email || phone)
      const groups = new Map<string, DbLead[]>();
      data.leads.filter(l => hasBrandAccess(req.user, l.brand_id)).forEach(l => {
        const key = getLeadIdentityKeyForBrand(l);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(l);
      });

      const dupGroups: DbLead[][] = [];
      groups.forEach(group => {
        if (group.length > 1) {
          // Sort oldest first â€” earliest created_at becomes the canonical lead
          group.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
          dupGroups.push(group);
        }
      });

      if (dupGroups.length === 0) {
        res.json({ success: true, merged: 0, removed: 0, groups: 0, backupPath });
        return;
      }

      let mergedCount = 0;
      let removedCount = 0;
      const canonicalIds = new Set<string>();
      const removedIds = new Set<string>();

      // 3. Merge each group into the canonical (first) lead
      for (const group of dupGroups) {
        const canonical = group[0];
        canonicalIds.add(canonical.id);

        for (let i = 1; i < group.length; i++) {
          const copy = group[i];
          removedIds.add(copy.id);

          // Fill missing canonical fields from the copy
          if (!canonical.email && copy.email) canonical.email = copy.email;
          if (!canonical.phone && copy.phone) canonical.phone = copy.phone;
          if (!canonical.owner_id && copy.owner_id) canonical.owner_id = copy.owner_id;
          if (!canonical.owner_name && copy.owner_name) canonical.owner_name = copy.owner_name;
          if (!canonical.follow_up_date && copy.follow_up_date) canonical.follow_up_date = copy.follow_up_date;

          // Merge tags (union, deduped)
          const tagSet = new Set([...(canonical.tags || []), ...(copy.tags || [])]);
          canonical.tags = Array.from(tagSet);

          // Merge custom_fields: copies fill missing keys on canonical.
          // NEVER overwrite 'segment' â€” it drives kanban placement for optimaviz/idao.
          const cf = { ...canonical.custom_fields };
          const safeSegmentKeys = new Set(['segment']);
          for (const [k, v] of Object.entries(copy.custom_fields || {})) {
            if (safeSegmentKeys.has(k)) continue; // preserve canonical segment
            if (!cf[k] || cf[k] === '' || cf[k] === 'N/A') {
              cf[k] = v;
            }
          }
          canonical.custom_fields = cf;

          // 4. Re-parent notes, calls, emails, whatsapp, enrollments from copy â†’ canonical
          const reParent = (collection: any[], foreignKey: string) => {
            collection.forEach(item => {
              if (item[foreignKey] === copy.id) {
                item[foreignKey] = canonical.id;
              }
            });
          };
          reParent(data.notes, 'lead_id');
          reParent(data.calls, 'lead_id');
          reParent(data.emails, 'lead_id');
          reParent(data.whatsapp, 'lead_id');
          data.enrollments = (data.enrollments || []).map(e =>
            e.lead_id === copy.id ? { ...e, lead_id: canonical.id } : e
          );

          removedCount++;
        }

        mergedCount++;
      }

      // 5. Remove duplicate leads from the array
      data.leads = data.leads.filter(l => !removedIds.has(l.id));
      db.save();

      res.json({
        success: true,
        merged: mergedCount,
        removed: removedCount,
        groups: dupGroups.length,
        backupPath,
      });
    } catch (err: any) {
      console.error('Dedupe merge error:', err);
      res.status(500).json({ detail: err.message || 'Fatal error during dedupe merge.' });
    }
  });

  // â”€â”€â”€ Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get('/api/users', requireAuth, (req, res) => {
    res.json(db.get().users.filter(user => !isProtectedOwnerUser(user)).map(publicUser));
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

  // â”€â”€â”€ Tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  app.put('/api/tasks/:id', requireAuth, (req, res) => {
    if (!db.get().tasks) db.get().tasks = [];
    const idx = db.get().tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) { res.status(404).json({ detail: 'Task not found' }); return; }
    const task = db.get().tasks[idx];
    if (task.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ detail: 'You can only update your own tasks.' });
      return;
    }
    if (req.body.status)  task.status  = req.body.status;
    if (req.body.content) task.content = sanitizeString(req.body.content, 2000);
    db.save();
    res.json(task);
  });

  app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    if (!db.get().tasks) db.get().tasks = [];
    const existing = db.get().tasks.find(t => t.id === req.params.id);
    if (!existing) { res.status(404).json({ detail: 'Task not found' }); return; }
    if (existing.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ detail: 'You can only delete your own tasks.' });
      return;
    }
    db.get().tasks = db.get().tasks.filter(t => t.id !== req.params.id);
    auditSecurityEvent(req, 'task_delete', { task_id: req.params.id, brand_id: existing.brand_id });
    db.save();
    res.json({ success: true });
  });

  // â”€â”€â”€ User management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get('/api/auth/users', requireAdmin, (req, res) => {
    res.json(db.get().users.filter(user => !isProtectedOwnerUser(user)).map(publicUser));
  });

  app.post('/api/auth/users', requireAdmin, (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) { res.status(400).json({ detail: 'Missing required user fields' }); return; }
    const normalizedEmail = sanitizeString(email, 254).toLowerCase();
    if (LEGACY_OWNER_EMAILS.has(normalizedEmail)) {
      res.status(400).json({ detail: 'This email is reserved and cannot be registered.' });
      return;
    }
    if (protectedOwnerEmails.has(normalizedEmail) || normalizedEmail === DEFAULT_SUPERADMIN_EMAIL) {
      res.status(400).json({ detail: 'The platform superadmin account is managed separately.' });
      return;
    }
    const wantsAdmin = role === 'admin';
    // Only the platform superadmin can create other platform admins.
    if (wantsAdmin && !isProtectedOwnerUser(req.user)) {
      res.status(403).json({ detail: 'Only the superadmin can add platform admins.' });
      return;
    }
    const duplicate = db.get().users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (duplicate) { res.status(400).json({ detail: 'User email already registered.' }); return; }
    const newUser: DbUser = {
      id: newId('user'),
      name: sanitizeString(name, 120),
      email: normalizedEmail,
      password: hashPassword(String(password)),
      role: wantsAdmin ? 'admin' : 'user',
      allowed_brand_ids: wantsAdmin ? [] : cleanAllowedBrandIds(req.body?.allowed_brand_ids),
      platform_role: 'none',
      created_at: new Date().toISOString(),
    };
    db.get().users.push(newUser);
    auditSecurityEvent(req, 'user_create', { target_user_id: newUser.id, target_email: newUser.email, target_role: newUser.role });
    db.save();
    res.status(201).json(publicUser(newUser));
  });

  app.put('/api/auth/users/:user_id', requireAuth, (req, res) => {
    const { user_id } = req.params;
    const idx = db.get().users.findIndex(u => u.id === user_id);
    if (idx === -1) { res.status(404).json({ detail: 'User not found' }); return; }
    if (isProtectedOwnerUser(db.get().users[idx]) && req.user!.id !== user_id) { res.status(404).json({ detail: 'User not found' }); return; }
    if (req.user!.id !== user_id && !isAdminUser(req.user)) { res.status(403).json({ detail: 'You can only update your own profile.' }); return; }
    const orig = db.get().users[idx];
    const { name, email, role, allowed_brand_ids, profile_picture_url } = req.body;
    const isSelf = req.user!.id === user_id;
    let nextRole: 'admin' | 'user' = orig.role;
    if (!isSelf && role !== undefined) {
      const desiredAdmin = role === 'admin';
      // Promoting to / demoting from admin requires superadmin.
      if (desiredAdmin !== (orig.role === 'admin') && !isProtectedOwnerUser(req.user)) {
        res.status(403).json({ detail: 'Only the superadmin can change platform admin roles.' });
        return;
      }
      nextRole = desiredAdmin ? 'admin' : 'user';
    }
    const nextEmail = isSelf ? orig.email : (email !== undefined ? sanitizeString(email, 254).toLowerCase() : orig.email);
    if (LEGACY_OWNER_EMAILS.has(String(nextEmail || '').toLowerCase()) || protectedOwnerEmails.has(String(nextEmail || '').toLowerCase())) {
      if (String(nextEmail || '').toLowerCase() !== String(orig.email || '').toLowerCase()) {
        res.status(400).json({ detail: 'This email is reserved.' });
        return;
      }
    }
    db.get().users[idx] = {
      ...orig,
      name:  name  !== undefined ? sanitizeString(name, 120)             : orig.name,
      profile_picture_url: profile_picture_url !== undefined
        ? sanitizeString(profile_picture_url, 400_000)
        : orig.profile_picture_url,
      email: nextEmail,
      role:  nextRole,
      // platform_role is managed only by ensureProtectedOwnerAccounts / bootstrap — never via API.
      platform_role: orig.platform_role,
      allowed_brand_ids: isSelf || nextRole === 'admin'
        ? orig.allowed_brand_ids
        : (allowed_brand_ids !== undefined ? cleanAllowedBrandIds(allowed_brand_ids) : orig.allowed_brand_ids),
    };
    db.save();
    res.json(publicUser(db.get().users[idx]));
  });

  app.post('/api/auth/me/change-password', requireAuth, (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) { res.status(400).json({ detail: 'Current and new password are required' }); return; }
    if (String(new_password).length < 6) { res.status(400).json({ detail: 'Password must be at least 6 characters' }); return; }
    const idx = db.get().users.findIndex(u => u.id === req.user!.id);
    if (idx === -1) { res.status(404).json({ detail: 'User not found' }); return; }
    if (!verifyPassword(String(current_password), db.get().users[idx].password)) { res.status(400).json({ detail: 'Current password is incorrect' }); return; }
    db.get().users[idx].password = hashPassword(String(new_password));
    clearSession(db.get().users[idx]);
    const sessionToken = issueSession(db.get().users[idx]);
    auditSecurityEvent(req, 'password_change_self', { target_user_id: req.user!.id });
    db.save();
    res.setHeader('Set-Cookie', `optima_session_id=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    res.json({ success: true });
  });

  app.delete('/api/auth/users/:user_id', requireAdmin, (req, res) => {
    const { user_id } = req.params;
    const target = db.get().users.find(u => u.id === user_id);
    if (!target || isProtectedOwnerUser(target)) { res.status(404).json({ detail: 'User not found' }); return; }
    if (req.user!.id === user_id) { res.status(400).json({ detail: 'You cannot delete your own account.' }); return; }
    // Only superadmin may delete platform admins; regular admins may delete staff only.
    if (target.role === 'admin' && !isProtectedOwnerUser(req.user)) {
      res.status(403).json({ detail: 'Only the superadmin can delete platform admins.' });
      return;
    }
    db.get().users = db.get().users.filter(u => u.id !== user_id);
    auditSecurityEvent(req, 'user_delete', { target_user_id: user_id });
    db.save();
    res.json({ success: true });
  });

  app.post('/api/auth/users/:user_id/change-password', requireAdmin, (req, res) => {
    const { user_id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) { res.status(400).json({ detail: 'Password must be at least 6 characters' }); return; }
    const idx = db.get().users.findIndex(u => u.id === user_id);
    if (idx === -1) { res.status(404).json({ detail: 'User not found' }); return; }
    if (isProtectedOwnerUser(db.get().users[idx]) && req.user!.id !== user_id) { res.status(404).json({ detail: 'User not found' }); return; }
    const target = db.get().users[idx];
    if (target.role === 'admin' && !isProtectedOwnerUser(req.user) && req.user!.id !== user_id) {
      res.status(403).json({ detail: 'Only the superadmin can reset platform admin passwords.' });
      return;
    }
    db.get().users[idx].password = hashPassword(String(password));
    clearSession(db.get().users[idx]);
    auditSecurityEvent(req, 'password_change_admin', { target_user_id: user_id });
    db.save();
    res.json({ success: true });
  });

  // â”€â”€â”€ Download zip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ Vite dev / production static â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
