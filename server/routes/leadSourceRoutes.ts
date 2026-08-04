import crypto from 'crypto';
import express from 'express';
import { LocalDb, DbLead, DbLeadSource, DbLeadSourceLog } from '../../src/db/server_db.js';

const BRAND_NAMES: Record<string, string> = {
  optimaviz: 'Optimaviz',
  taskgo: 'TaskGo',
  idao: 'IDAO',
  optimaclean: 'OptimaClean',
  nestwise: 'NestWise',
};

function sanitizeString(val: unknown, maxLen = 500): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

function sanitizeCustomFields(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[sanitizeString(key, 60)] = sanitizeString(value, 500);
  }
  return out;
}

function sanitizeLead(body: Record<string, any>) {
  return {
    name: sanitizeString(body.name, 120),
    email: sanitizeString(body.email, 254).toLowerCase(),
    phone: sanitizeString(body.phone, 30),
    notes: sanitizeString(body.notes, 2000),
    brand_id: sanitizeString(body.brand_id, 40),
    brand_name: sanitizeString(body.brand_name, 80),
    funnel_stage: sanitizeString(body.funnel_stage, 120),
    tags: Array.isArray(body.tags) ? body.tags.map((tag: any) => sanitizeString(tag, 50)).filter(Boolean) : [],
    custom_fields: sanitizeCustomFields(body.custom_fields),
  };
}

type LeadSourceStatus = DbLeadSource['status'];

interface LeadSourceRoutesContext {
  db: LocalDb;
  requireAdmin: express.RequestHandler;
  workspaceIdFor: (req: express.Request) => string;
  inWorkspace: (item: any, workspaceId: string) => boolean;
  brandInWorkspace: (brandId: string, workspaceId: string) => boolean;
  workspaceLimitError: (workspaceId: string, resource: 'brands' | 'users' | 'leads', add?: number) => string;
  ensureBrandCustomFieldDefinitions: (db: LocalDb, brandId: string, fields: Record<string, string>, workspaceId: string) => void;
  findExistingLeadByContact: (db: LocalDb, email: string, phone: string, brandId: string, workspaceId?: string) => DbLead | undefined;
  newId: (prefix: string) => string;
  getPublicBaseUrl: (req: express.Request) => string;
}

const DEFAULT_SOURCE_MAPPINGS: Record<string, string> = {
  name: 'name',
  full_name: 'name',
  email: 'email',
  phone: 'phone',
  message: 'notes',
  notes: 'notes',
  campaign: 'custom_fields.campaign',
  campaign_name: 'custom_fields.campaign',
  page_url: 'custom_fields.page_url',
  url: 'custom_fields.page_url',
  source_url: 'custom_fields.page_url',
  external_lead_id: 'custom_fields.external_lead_id',
  id: 'custom_fields.external_lead_id',
};

const PROVIDER_LABELS: Record<string, string> = {
  website: 'Website',
  facebook: 'Facebook Lead Ad',
  linkedin: 'LinkedIn Lead Gen Form',
  api: 'Manual/API',
  webhook: 'Webhook',
};

function sourceKey() {
  return `ls_${crypto.randomBytes(24).toString('base64url')}`;
}

function authKey(req: express.Request) {
  const authorization = String(req.get('authorization') || '');
  return sanitizeString(
    authorization.replace(/^Bearer\s+/i, '') ||
    req.get('x-lead-source-key') ||
    req.get('x-crm-source-key') ||
    req.body?.api_key ||
    req.body?.source_key ||
    '',
    300
  );
}

function flattenProviderPayload(raw: any): Record<string, unknown> {
  const payload = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  if (Array.isArray(raw?.field_data)) {
    raw.field_data.forEach((field: any) => {
      const key = sanitizeString(field?.name || field?.key || '', 100);
      const value = Array.isArray(field?.values) ? field.values[0] : field?.value;
      if (key && payload[key] === undefined) payload[key] = value;
    });
  }
  if (raw?.lead && typeof raw.lead === 'object') Object.assign(payload, raw.lead);
  if (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) Object.assign(payload, raw.data);
  return payload;
}

function valueAt(payload: Record<string, unknown>, key: string): string {
  if (!key) return '';
  const direct = payload[key];
  if (direct !== undefined && direct !== null) return sanitizeString(direct, 2000);
  return key.split('.').reduce<any>((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), payload) ?? '';
}

function captureStatus(raw: any, payload: Record<string, unknown>) {
  const statusText = sanitizeString(
    raw?.capture_status ||
    raw?.signup_status ||
    raw?.status ||
    raw?.event ||
    payload.capture_status ||
    payload.signup_status ||
    payload.status ||
    payload.event ||
    '',
    80
  ).toLowerCase();
  if (/(partial|progress|abandon|draft|blur|change|step)/.test(statusText)) return 'partial';
  if (/(complete|completed|submit|submitted|signup_complete|conversion)/.test(statusText)) return 'completed';
  return 'submitted';
}

function mapPayload(source: DbLeadSource, raw: any) {
  const payload = flattenProviderPayload(raw);
  const mappings = { ...DEFAULT_SOURCE_MAPPINGS, ...(source.field_mappings || {}) };
  const unmappedStrategy = sanitizeString((source as any).unmapped_field_strategy || 'auto', 20);
  const lead: Record<string, any> = {};
  const customFields: Record<string, string> = {};

  Object.entries(mappings).forEach(([from, to]) => {
    if (!to || to === 'ignore') return;
    const value = valueAt(payload, from);
    if (!value) return;
    if (to.startsWith('custom_fields.')) customFields[to.replace('custom_fields.', '')] = value;
    else lead[to] = value;
  });

  Object.entries(payload).forEach(([key, value]) => {
    const cleanKey = sanitizeString(key, 60);
    if (!cleanKey || Object.prototype.hasOwnProperty.call(mappings, key)) return;
    if (['api_key', 'source_key'].includes(cleanKey)) return;
    if (unmappedStrategy === 'ignore') return;
    const cleanValue = sanitizeString(value, 500);
    if (cleanValue) customFields[`source_${cleanKey}`] = cleanValue;
  });

  return { lead, customFields, payload };
}

function publicSource(req: express.Request, source: DbLeadSource) {
  return {
    ...source,
    webhook_url: `${req.protocol}://${req.get('host')}/api/public/leads/webhook/${source.id}`,
  };
}

function logSource(db: LocalDb, newId: (prefix: string) => string, entry: Omit<DbLeadSourceLog, 'id' | 'created_at'>) {
  db.get().lead_source_logs = db.get().lead_source_logs || [];
  db.get().lead_source_logs.push({
    id: newId('lead-source-log'),
    created_at: new Date().toISOString(),
    ...entry,
  });
}

export function registerLeadSourceRoutes(app: express.Express, ctx: LeadSourceRoutesContext) {
  const {
    db,
    requireAdmin,
    workspaceIdFor,
    inWorkspace,
    brandInWorkspace,
    workspaceLimitError,
    ensureBrandCustomFieldDefinitions,
    findExistingLeadByContact,
    newId,
    getPublicBaseUrl,
  } = ctx;

  app.get('/api/lead-sources', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const brandId = sanitizeString(req.query.brand_id || '', 40);
    const rows = (db.get().lead_sources || [])
      .filter(source => inWorkspace(source, workspaceId))
      .filter(source => !brandId || source.brand_id === brandId)
      .map(source => ({ ...publicSource(req, source), webhook_url: `${getPublicBaseUrl(req)}/api/public/leads/webhook/${source.id}` }));
    res.json({ sources: rows });
  });

  app.get('/api/lead-sources/logs', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const sourceId = sanitizeString(req.query.source_id || '', 120);
    const logs = (db.get().lead_source_logs || [])
      .filter(log => inWorkspace(log, workspaceId))
      .filter(log => !sourceId || log.source_id === sourceId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 80);
    res.json({ logs });
  });

  app.post('/api/lead-sources', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const brandId = sanitizeString(req.body?.brand_id, 40).toLowerCase();
    if (!brandId || !brandInWorkspace(brandId, workspaceId)) { res.status(400).json({ detail: 'Choose a brand in this workspace first.' }); return; }
    const provider = sanitizeString(req.body?.provider || 'website', 40) || 'website';
    const now = new Date().toISOString();
    const source: DbLeadSource = {
      id: newId('lead-source'),
      workspace_id: workspaceId,
      brand_id: brandId,
      name: sanitizeString(req.body?.name || `${PROVIDER_LABELS[provider] || 'Lead Source'} - ${BRAND_NAMES[brandId] || brandId}`, 140),
      provider,
      status: sanitizeString(req.body?.status || (provider === 'website' || provider === 'api' || provider === 'webhook' ? 'active' : 'needs_setup'), 40) as LeadSourceStatus,
      secret_key: sourceKey(),
      field_mappings: { ...DEFAULT_SOURCE_MAPPINGS, ...(req.body?.field_mappings || {}) },
      default_stage: sanitizeString(req.body?.default_stage || 'New Lead', 120),
      duplicate_strategy: sanitizeString(req.body?.duplicate_strategy || 'update_existing', 40),
      unmapped_field_strategy: sanitizeString(req.body?.unmapped_field_strategy || 'auto', 20),
      external_account_id: sanitizeString(req.body?.external_account_id || '', 160),
      external_page_id: sanitizeString(req.body?.external_page_id || '', 160),
      external_form_id: sanitizeString(req.body?.external_form_id || '', 160),
      leads_imported: 0,
      created_by_user_id: req.user?.id,
      created_at: now,
      updated_at: now,
    };
    db.get().lead_sources = db.get().lead_sources || [];
    db.get().lead_sources.push(source);
    db.save();
    res.status(201).json(publicSource(req, { ...source, secret_key: source.secret_key }));
  });

  app.put('/api/lead-sources/:source_id', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const idx = (db.get().lead_sources || []).findIndex(source => source.id === req.params.source_id && inWorkspace(source, workspaceId));
    if (idx === -1) { res.status(404).json({ detail: 'Lead source not found.' }); return; }
    const current = db.get().lead_sources![idx];
    const brandId = sanitizeString(req.body?.brand_id || current.brand_id, 40).toLowerCase();
    if (!brandInWorkspace(brandId, workspaceId)) { res.status(400).json({ detail: 'Choose a brand in this workspace first.' }); return; }
    db.get().lead_sources![idx] = {
      ...current,
      brand_id: brandId,
      name: sanitizeString(req.body?.name || current.name, 140),
      provider: sanitizeString(req.body?.provider || current.provider, 40),
      status: sanitizeString(req.body?.status || current.status, 40),
      field_mappings: { ...(current.field_mappings || {}), ...(req.body?.field_mappings || {}) },
      default_stage: sanitizeString(req.body?.default_stage || current.default_stage || 'New Lead', 120),
      duplicate_strategy: sanitizeString(req.body?.duplicate_strategy || current.duplicate_strategy || 'update_existing', 40),
      unmapped_field_strategy: sanitizeString(req.body?.unmapped_field_strategy || (current as any).unmapped_field_strategy || 'auto', 20),
      external_account_id: sanitizeString(req.body?.external_account_id || current.external_account_id || '', 160),
      external_page_id: sanitizeString(req.body?.external_page_id || current.external_page_id || '', 160),
      external_form_id: sanitizeString(req.body?.external_form_id || current.external_form_id || '', 160),
      updated_at: new Date().toISOString(),
    };
    db.save();
    res.json(publicSource(req, db.get().lead_sources![idx]));
  });

  app.post('/api/lead-sources/:source_id/rotate-key', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const source = (db.get().lead_sources || []).find(item => item.id === req.params.source_id && inWorkspace(item, workspaceId));
    if (!source) { res.status(404).json({ detail: 'Lead source not found.' }); return; }
    source.secret_key = sourceKey();
    source.updated_at = new Date().toISOString();
    db.save();
    res.json(publicSource(req, source));
  });

  app.delete('/api/lead-sources/:source_id', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const before = (db.get().lead_sources || []).length;
    db.get().lead_sources = (db.get().lead_sources || []).filter(source => source.id !== req.params.source_id || !inWorkspace(source, workspaceId));
    if (db.get().lead_sources!.length === before) { res.status(404).json({ detail: 'Lead source not found.' }); return; }
    db.save();
    res.json({ success: true });
  });

  app.post('/api/lead-sources/:source_id/connect', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const source = (db.get().lead_sources || []).find(item => item.id === req.params.source_id && inWorkspace(item, workspaceId));
    if (!source) { res.status(404).json({ detail: 'Lead source not found.' }); return; }
    if (source.provider === 'facebook') {
      res.status(501).json({ detail: 'Facebook Lead Ads OAuth needs a Meta app ID, app secret, webhook verification, and Meta app review before live connection.' });
      return;
    }
    if (source.provider === 'linkedin') {
      res.status(501).json({ detail: 'LinkedIn Lead Gen requires LinkedIn developer app access and lead retrieval permissions before live connection.' });
      return;
    }
    res.json({ success: true, detail: 'Website/API sources are connected by using the secure webhook URL.' });
  });

  app.options('/api/public/leads/webhook/:source_id', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Lead-Source-Key, X-CRM-Source-Key');
    res.status(204).end();
  });

  app.post('/api/public/leads/webhook/:source_id', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const source = (db.get().lead_sources || []).find(item => item.id === req.params.source_id);
    if (!source) { res.status(404).json({ detail: 'Lead source not found.' }); return; }
    if (source.status !== 'active') { res.status(423).json({ detail: 'This lead source is not accepting submissions.' }); return; }
    if (!authKey(req) || authKey(req) !== source.secret_key) { res.status(401).json({ detail: 'Lead source authentication failed.' }); return; }

    const workspaceId = source.workspace_id || '';
    const brandId = source.brand_id;
    const now = new Date().toISOString();
    try {
      const { lead, customFields, payload } = mapPayload(source, req.body || {});
      const status = captureStatus(req.body || {}, payload);
      const sessionId = sanitizeString(req.body?.session_id || req.body?.signup_session_id || payload.session_id || payload.signup_session_id || '', 180);
      const externalLeadId = customFields.external_lead_id || sanitizeString(req.body?.external_lead_id || req.body?.id || payload.external_lead_id || payload.id || sessionId, 180);
      const isPartial = status === 'partial';
      const clean = sanitizeLead({
        ...lead,
        brand_id: brandId,
        brand_name: BRAND_NAMES[brandId] || brandId,
        funnel_stage: lead.funnel_stage || source.default_stage || 'New Lead',
        custom_fields: customFields,
      });
      if (!clean.name) clean.name = clean.email ? clean.email.split('@')[0] : clean.phone ? `Contact ${clean.phone}` : externalLeadId ? `Partial signup ${externalLeadId.slice(-6)}` : '';
      if (!clean.name || (!clean.email && !clean.phone && !externalLeadId)) throw new Error('A lead needs a name plus either email, phone, or a signup session ID.');

      const sourceLabel = PROVIDER_LABELS[source.provider] || source.provider || 'Lead Source';
      const mergedCustomFields = sanitizeCustomFields({
        ...(clean.custom_fields || {}),
        ...customFields,
        external_lead_id: externalLeadId,
        signup_session_id: sessionId,
        capture_status: status,
        partial_signup: isPartial ? 'yes' : 'no',
        last_capture_at: now,
        lead_source_id: source.id,
        lead_source_name: source.name,
        lead_source_provider: source.provider,
        intake_channel: source.provider,
      });
      ensureBrandCustomFieldDefinitions(db, brandId, mergedCustomFields, workspaceId);

      const byExternalId = externalLeadId
        ? db.get().leads.find(leadRow => inWorkspace(leadRow, workspaceId) && leadRow.brand_id === brandId && leadRow.custom_fields?.lead_source_id === source.id && leadRow.custom_fields?.external_lead_id === externalLeadId)
        : undefined;
      const existing = byExternalId || findExistingLeadByContact(db, clean.email, clean.phone, brandId, workspaceId);
      const duplicateStrategy = source.duplicate_strategy || 'update_existing';

      if (existing && duplicateStrategy !== 'create_new') {
        if (duplicateStrategy === 'skip') {
          logSource(db, newId, { workspace_id: workspaceId, source_id: source.id, brand_id: brandId, status: 'duplicate_skipped', lead_id: existing.id, external_lead_id: externalLeadId, message: 'Duplicate skipped.', payload_summary: { email: clean.email, phone: clean.phone, name: clean.name } });
          db.save();
          res.json({ success: true, status: 'duplicate_skipped', lead_id: existing.id });
          return;
        }

        existing.name = clean.name || existing.name;
        existing.email = clean.email || existing.email;
        existing.phone = clean.phone || existing.phone;
        existing.notes = clean.notes || existing.notes;
        existing.funnel_stage = !isPartial && existing.custom_fields?.partial_signup === 'yes' ? (clean.funnel_stage || existing.funnel_stage) : existing.funnel_stage;
        existing.tags = Array.from(new Set([...(existing.tags || []), sourceLabel, source.name, ...(isPartial ? ['Partial signup'] : ['Signup completed'])]));
        existing.custom_fields = { ...(existing.custom_fields || {}), ...mergedCustomFields };
        db.get().notes.push({ id: newId('note'), lead_id: existing.id, content: `${isPartial ? 'Partial signup updated' : 'Lead updated'} from ${source.name}.`, created_by: source.name, created_at: now });
        source.last_sync_at = now;
        source.leads_imported = Number(source.leads_imported || 0) + 1;
        logSource(db, newId, { workspace_id: workspaceId, source_id: source.id, brand_id: brandId, status: isPartial ? 'partial_updated' : 'duplicate_updated', lead_id: existing.id, external_lead_id: externalLeadId, message: isPartial ? 'Partial signup updated.' : 'Existing lead updated.', payload_summary: { email: clean.email, phone: clean.phone, name: clean.name, capture_status: status } });
        db.save();
        res.json({ success: true, status: isPartial ? 'partial_updated' : 'duplicate_updated', lead_id: existing.id });
        return;
      }

      const limitError = workspaceLimitError(workspaceId, 'leads');
      if (limitError) { res.status(402).json({ detail: 'Lead capture is temporarily unavailable.', code: 'lead_capture_unavailable' }); return; }

      const newLead: DbLead = {
        id: newId('lead'),
        brand_id: brandId,
        brand_name: BRAND_NAMES[brandId] || brandId,
        name: clean.name,
        email: clean.email,
        phone: clean.phone,
        funnel_stage: clean.funnel_stage || source.default_stage || 'New Lead',
        notes: clean.notes,
        tags: Array.from(new Set([...(clean.tags || []), sourceLabel, source.name, ...(isPartial ? ['Partial signup'] : ['Signup completed'])])),
        custom_fields: mergedCustomFields,
        created_at: now,
      };
      db.get().leads.push(newLead);
      db.get().notes.push({ id: newId('note'), lead_id: newLead.id, content: `${isPartial ? 'Partial signup captured' : 'Lead created'} from ${source.name}.`, created_by: source.name, created_at: now });
      source.last_sync_at = now;
      source.leads_imported = Number(source.leads_imported || 0) + 1;
      source.last_error = '';
      logSource(db, newId, { workspace_id: workspaceId, source_id: source.id, brand_id: brandId, status: isPartial ? 'partial_created' : 'created', lead_id: newLead.id, external_lead_id: externalLeadId, message: isPartial ? 'Partial signup captured.' : 'Lead created.', payload_summary: { email: clean.email, phone: clean.phone, name: clean.name, capture_status: status } });
      db.save();
      res.status(201).json({ success: true, status: isPartial ? 'partial_created' : 'created', lead_id: newLead.id });
    } catch (err: any) {
      source.last_error = sanitizeString(err?.message || 'Lead import failed.', 500);
      logSource(db, newId, { workspace_id: workspaceId, source_id: source.id, brand_id: brandId, status: 'failed', message: source.last_error, payload_summary: { provider: source.provider } });
      db.save();
      res.status(400).json({ detail: 'Lead could not be captured. Check the source logs inside CRM.' });
    }
  });
}
