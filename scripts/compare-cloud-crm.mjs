import fs from 'fs';

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const env = {};
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
  return (data.leads?.length || 0) * 1000 + (data.custom_fields?.length || 0) * 50 + (data.emails?.length || 0) * 5;
}

async function fetchCrm(env, label) {
  const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';
  const table = env.SUPABASE_TABLE || 'crm_data';
  const id = env.SUPABASE_RECORD_ID || 'main';
  if (!url || !key) {
    console.log(`${label}: missing credentials`);
    return null;
  }
  const ep = `${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=data,updated_at`;
  const res = await fetch(ep, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    console.log(`${label}: read failed ${res.status} ${await res.text()}`);
    return null;
  }
  const rows = await res.json();
  if (!rows.length || !rows[0].data) {
    console.log(`${label}: empty`);
    return null;
  }
  const d = rows[0].data;
  const s = score(d);
  console.log(`${label}: leads=${d.leads?.length || 0} cfs=${d.custom_fields?.length || 0} emails=${d.emails?.length || 0} score=${s} updated=${rows[0].updated_at}`);
  return { data: d, label, score: s, updated_at: rows[0].updated_at };
}

const saas = loadEnv('F:/downloads and backup/downloads/LujuNal CRM SaaS.env');
const opsFile = loadEnv('F:/downloads and backup/downloads/CRM-Optima-updated.env');
const local = loadEnv('.env');
const a = await fetchCrm(saas, 'saas-cloud');
const b = await fetchCrm({ ...local, ...opsFile }, 'ops-cloud');
const localFile = JSON.parse(fs.readFileSync('db-saas.json', 'utf8'));
const lf = { data: localFile, label: 'local-file', score: score(localFile) };
console.log(`local-file: leads=${localFile.leads?.length || 0} score=${lf.score}`);
const candidates = [a, b, lf].filter(Boolean).sort((x, y) => y.score - x.score);
console.log('richest:', candidates[0].label, candidates[0].score);
