import fs from 'fs';
import path from 'path';

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    let k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

function score(data) {
  if (!data) return 0;
  return (data.leads?.length || 0) * 1000
    + (data.custom_fields?.length || 0) * 50
    + (data.emails?.length || 0) * 5
    + (data.notes?.length || 0) * 3
    + (data.users?.length || 0);
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  let text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  text = text.replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

async function fetchCloud(env, label) {
  const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';
  const table = env.SUPABASE_TABLE || 'crm_data';
  const id = env.SUPABASE_RECORD_ID || 'main';
  if (!url || !key) {
    console.log(label + ': missing creds');
    return null;
  }
  const res = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=data,updated_at`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.log(label + ': fail', res.status, await res.text());
    return null;
  }
  const rows = await res.json();
  if (!rows[0]?.data) {
    console.log(label + ': empty');
    return null;
  }
  const d = rows[0].data;
  console.log(`${label}: leads=${d.leads?.length || 0} cfs=${d.custom_fields?.length || 0} emails=${d.emails?.length || 0} score=${score(d)} updated=${rows[0].updated_at}`);
  return { data: d, score: score(d), label, url, key, table, id };
}

async function pushCloud(env, data) {
  const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const table = env.SUPABASE_TABLE || 'crm_data';
  const id = env.SUPABASE_RECORD_ID || 'main';
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`push failed ${res.status}: ${await res.text()}`);
  console.log('pushed to', url, table, id);
}

const INTERNAL = 'workspace-optima-internal';
const saasEnv = loadEnv('F:/downloads and backup/downloads/LujuNal CRM SaaS.env');
const cloud = await fetchCloud(saasEnv, 'saas-cloud');

const candidates = [];
if (cloud) candidates.push(cloud);
for (const f of [
  'db-saas.json',
  'db.json',
  'backups/saas/db-latest.json',
  'backups/saas/db-import-2026-07-17.json',
  'backups/db-from-stash-saas-latest.json',
  'backups/db-from-stash-main-full.json',
  'backups/ops/db-from-stash-main-full.json',
]) {
  const d = readJson(f);
  if (d) {
    console.log(`file ${f}: leads=${d.leads?.length || 0} score=${score(d)}`);
    candidates.push({ data: d, score: score(d), label: f });
  }
}

candidates.sort((a, b) => b.score - a.score);
const best = candidates[0];
console.log('BEST:', best.label, best.score);

// Ensure internal workspace stamp
const data = best.data;
data.workspaces = data.workspaces || [];
if (!data.workspaces.some(w => w.id === INTERNAL)) {
  data.workspaces.unshift({
    id: INTERNAL,
    name: 'LujuNal Internal CRM',
    slug: 'lujunal-internal',
    owner_user_id: 'admin-1',
    plan: 'internal',
    status: 'active',
    created_at: new Date().toISOString(),
  });
}
for (const key of ['leads', 'notes', 'calls', 'emails', 'custom_fields', 'brand_funnels', 'brand_integrations', 'users', 'tasks', 'team_messages', 'sequences']) {
  for (const item of data[key] || []) {
    if (!item.workspace_id) item.workspace_id = INTERNAL;
  }
}

const byWs = {};
for (const l of data.leads || []) {
  const w = l.workspace_id || '(none)';
  byWs[w] = (byWs[w] || 0) + 1;
}
console.log('leads by workspace after stamp', byWs);
console.log('users', (data.users || []).map(u => `${u.email}|ws=${u.workspace_id}|role=${u.role}|plat=${u.platform_role}`).join(' ; '));

fs.writeFileSync('db-saas.json', JSON.stringify(data, null, 2));
fs.mkdirSync('backups/saas', { recursive: true });
fs.writeFileSync('backups/saas/db-latest.json', JSON.stringify(data, null, 2));
fs.writeFileSync(`backups/saas/db-restore-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
console.log('local files updated');

if (process.argv.includes('--push')) {
  await pushCloud(saasEnv, data);
  console.log('cloud restored');
}
