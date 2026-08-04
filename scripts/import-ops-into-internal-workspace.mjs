#!/usr/bin/env node
/**
 * Architecture B helper:
 * Merge an operational CRM snapshot into the SaaS database under
 * workspace-optima-internal, then optionally push to Supabase.
 *
 * Usage:
 *   node scripts/import-ops-into-internal-workspace.mjs
 *   node scripts/import-ops-into-internal-workspace.mjs --source db.json --target db-saas.json --push
 *   node scripts/import-ops-into-internal-workspace.mjs --env-file "F:/path/to/LujuNal CRM SaaS.env" --push
 *
 * Env for --push (from process env or --env-file):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_TABLE, SUPABASE_RECORD_ID
 */

import fs from 'fs';
import path from 'path';

const INTERNAL_WORKSPACE_ID = 'workspace-optima-internal';
const INTERNAL_WORKSPACE = {
  id: INTERNAL_WORKSPACE_ID,
  name: 'LujuNal Internal CRM',
  slug: 'lujunal-internal',
  owner_user_id: 'admin-1',
  plan: 'internal',
  status: 'active',
  created_at: '2026-06-29T00:00:00.000Z',
};

const ARRAY_KEYS = [
  'workspaces',
  'users',
  'workspace_invites',
  'password_reset_tokens',
  'brand_funnels',
  'leads',
  'notes',
  'calls',
  'emails',
  'whatsapp',
  'whatsapp_templates',
  'message_templates',
  'brand_integrations',
  'email_connections',
  'lead_sources',
  'lead_source_logs',
  'social_connections',
  'social_pages',
  'social_ad_accounts',
  'social_posts',
  'social_ad_metrics',
  'website_analytics_sites',
  'website_traffic_events',
  'lead_enrichments',
  'workflow_rules',
  'workflow_runs',
  'conversation_insights',
  'user_dashboard_preferences',
  'portfolio_opportunity_rules',
  'portfolio_opportunities',
  'sequences',
  'custom_fields',
  'enrollments',
  'tasks',
  'team_messages',
  'team_notes',
  'usage_events',
  'audit_log',
  'billing_events',
];

function parseArgs(argv) {
  const out = {
    source: 'db.json',
    target: 'db-saas.json',
    out: '',
    push: false,
    envFile: '',
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--push') out.push = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--source') out.source = argv[++i];
    else if (a === '--target') out.target = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--env-file') out.envFile = argv[++i];
  }
  if (!out.out) out.out = out.target;
  return out;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  const buf = fs.readFileSync(filePath);
  let text;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) text = buf.toString('utf16le');
  else text = buf.toString('utf8');
  text = text.replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function loadEnvFile(filePath) {
  if (!filePath) return;
  if (!fs.existsSync(filePath)) throw new Error(`Env file not found: ${filePath}`);
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function ensureArray(schema, key) {
  if (!Array.isArray(schema[key])) schema[key] = [];
  return schema[key];
}

function stampWorkspace(item) {
  if (!item || typeof item !== 'object') return item;
  if (!item.workspace_id) item.workspace_id = INTERNAL_WORKSPACE_ID;
  return item;
}

function isCustomerWorkspaceId(id) {
  return id && id !== INTERNAL_WORKSPACE_ID;
}

function richness(schema) {
  if (!schema) return 0;
  const leads = Array.isArray(schema.leads) ? schema.leads.length : 0;
  const cfs = Array.isArray(schema.custom_fields) ? schema.custom_fields.length : 0;
  const emails = Array.isArray(schema.emails) ? schema.emails.length : 0;
  const notes = Array.isArray(schema.notes) ? schema.notes.length : 0;
  return leads * 1000 + cfs * 50 + emails * 5 + notes * 3;
}

function mergeById(targetArr, sourceArr, idKey = 'id') {
  const map = new Map();
  for (const item of targetArr || []) {
    if (item && item[idKey] != null) map.set(String(item[idKey]), item);
  }
  let added = 0;
  let updated = 0;
  for (const item of sourceArr || []) {
    if (!item || item[idKey] == null) continue;
    const id = String(item[idKey]);
    if (!map.has(id)) {
      map.set(id, item);
      added += 1;
    } else {
      // Prefer non-empty fields from source onto existing
      const existing = map.get(id);
      const merged = { ...existing };
      for (const [k, v] of Object.entries(item)) {
        if (v === undefined || v === null || v === '') continue;
        if (existing[k] === undefined || existing[k] === null || existing[k] === '') {
          merged[k] = v;
          updated += 1;
        } else if (typeof v === 'object' && !Array.isArray(v) && typeof existing[k] === 'object' && existing[k]) {
          merged[k] = { ...existing[k], ...v };
        }
      }
      map.set(id, merged);
    }
  }
  return { items: Array.from(map.values()), added, updated };
}

function mergeOpsIntoSaas(ops, saas) {
  const result = { ...(saas || {}) };
  for (const key of ARRAY_KEYS) ensureArray(result, key);
  if (!result.whatsapp_numbers || typeof result.whatsapp_numbers !== 'object') result.whatsapp_numbers = {};

  // Ensure internal workspace exists; keep any customer workspaces already on SaaS
  if (!result.workspaces.some(w => w.id === INTERNAL_WORKSPACE_ID)) {
    result.workspaces.unshift({ ...INTERNAL_WORKSPACE });
  }

  const stats = {};

  // Collections that belong to internal ops (stamp + merge by id)
  const internalCollections = [
    'leads',
    'notes',
    'calls',
    'emails',
    'whatsapp',
    'whatsapp_templates',
    'message_templates',
    'brand_integrations',
    'email_connections',
    'lead_sources',
    'lead_source_logs',
    'social_connections',
    'social_pages',
    'social_ad_accounts',
    'social_posts',
    'social_ad_metrics',
    'website_analytics_sites',
    'website_traffic_events',
    'lead_enrichments',
    'workflow_rules',
    'workflow_runs',
    'conversation_insights',
    'user_dashboard_preferences',
    'portfolio_opportunity_rules',
    'portfolio_opportunities',
    'sequences',
    'custom_fields',
    'enrollments',
    'tasks',
    'team_messages',
    'team_notes',
    'usage_events',
    'brand_funnels',
  ];

  for (const key of internalCollections) {
    const sourceItems = (ops[key] || []).map(item => stampWorkspace({ ...item }));
    // Keep customer-workspace rows already in SaaS target
    const customerRows = (result[key] || []).filter(item => isCustomerWorkspaceId(item.workspace_id));
    const internalExisting = (result[key] || []).filter(item => !isCustomerWorkspaceId(item.workspace_id));
    const merged = mergeById(internalExisting.map(stampWorkspace), sourceItems);
    result[key] = [...customerRows, ...merged.items];
    stats[key] = { added: merged.added, total: result[key].length };
  }

  // Users: merge carefully — keep customer workspace users, merge internal/platform users by email/id
  const customerUsers = (result.users || []).filter(u => isCustomerWorkspaceId(u.workspace_id));
  const internalUsers = (result.users || []).filter(u => !isCustomerWorkspaceId(u.workspace_id));
  const opsUsers = (ops.users || []).map(u => {
    const copy = { ...u };
    if (!isCustomerWorkspaceId(copy.workspace_id)) copy.workspace_id = INTERNAL_WORKSPACE_ID;
    return copy;
  });
  const usersMerged = mergeById(internalUsers, opsUsers);
  // Prefer platform_role owner flags from either side
  result.users = [...customerUsers, ...usersMerged.items];
  stats.users = { added: usersMerged.added, total: result.users.length };

  // whatsapp_numbers object merge
  result.whatsapp_numbers = { ...(ops.whatsapp_numbers || {}), ...(result.whatsapp_numbers || {}) };

  // audit_log / billing: append unique by id
  for (const key of ['audit_log', 'billing_events', 'workspace_invites', 'password_reset_tokens']) {
    const sourceItems = (ops[key] || []).map(item => {
      const copy = { ...item };
      if (!copy.workspace_id) copy.workspace_id = INTERNAL_WORKSPACE_ID;
      return copy;
    });
    const merged = mergeById(result[key] || [], sourceItems);
    result[key] = merged.items;
    stats[key] = { added: merged.added, total: result[key].length };
  }

  stats._richness = { ops: richness(ops), saas_before: richness(saas), saas_after: richness(result) };
  stats._internal_leads = result.leads.filter(l => (l.workspace_id || INTERNAL_WORKSPACE_ID) === INTERNAL_WORKSPACE_ID).length;
  stats._customer_leads = result.leads.filter(l => isCustomerWorkspaceId(l.workspace_id)).length;
  return { result, stats };
}

async function pushToSupabase(schema) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || '';
  const table = process.env.SUPABASE_TABLE || 'crm_data';
  const recordId = process.env.SUPABASE_RECORD_ID || 'main';
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --push');

  const endpoint = `${url}/rest/v1/${table}`;
  const body = {
    id: recordId,
    data: schema,
    updated_at: new Date().toISOString(),
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase upsert failed (${response.status}): ${text}`);
  }
  return { ok: true, table, recordId, url };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.envFile) loadEnvFile(args.envFile);

  const sourcePath = path.resolve(args.source);
  const targetPath = path.resolve(args.target);
  const outPath = path.resolve(args.out);

  console.log(`[import] source=${sourcePath}`);
  console.log(`[import] target=${targetPath}`);
  console.log(`[import] out=${outPath}`);

  const ops = readJson(sourcePath);
  const saas = fs.existsSync(targetPath) ? readJson(targetPath) : { workspaces: [], users: [], leads: [] };
  const { result, stats } = mergeOpsIntoSaas(ops, saas);

  console.log('[import] stats:', JSON.stringify(stats, null, 2));

  if (args.dryRun) {
    console.log('[import] dry-run — not writing files or pushing');
    return;
  }

  writeJson(outPath, result);
  // Also refresh product-scoped backup
  const backupDir = path.resolve('backups', 'saas');
  writeJson(path.join(backupDir, 'db-latest.json'), result);
  writeJson(path.join(backupDir, `db-import-${new Date().toISOString().slice(0, 10)}.json`), result);
  console.log(`[import] wrote ${outPath} and backups/saas/*`);

  if (args.push) {
    const pushResult = await pushToSupabase(result);
    console.log('[import] pushed to Supabase:', pushResult);
  } else {
    console.log('[import] skip cloud push (pass --push to upload)');
  }
}

main().catch(err => {
  console.error('[import] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
