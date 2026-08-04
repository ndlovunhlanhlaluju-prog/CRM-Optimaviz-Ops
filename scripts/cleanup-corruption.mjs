/**
 * One-shot cleanup: strip BOM from local JSON DBs, light-sanitize strings,
 * and scrub mojibake / replacement chars from CSS comments.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function cleanString(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/\u00E2\u20AC\u2122/g, '\u2019')
    .replace(/\u00E2\u20AC\u0153/g, '\u201C')
    .replace(/\u00E2\u20AC\u009D/g, '\u201D')
    .replace(/\u00E2\u20AC\u201D/g, '\u201D')
    .replace(/\u00E2\u20AC\u201C/g, '\u201C')
    .replace(/\u00E2\u20AC\u2013/g, '\u2013')
    .replace(/\u00E2\u20AC\u2014/g, '\u2014')
    .replace(/\u00E2\u20AC\u00A6/g, '\u2026')
    .replace(/â€™/g, '\u2019')
    .replace(/â€˜/g, '\u2018')
    .replace(/â€œ/g, '\u201C')
    .replace(/â€/g, '\u201D')
    .replace(/â€“/g, '\u2013')
    .replace(/â€”/g, '\u2014')
    .replace(/â€¦/g, '\u2026')
    .replace(/\u00C2\u00A0/g, ' ')
    .replace(/\u00C2([\u00A1-\u00BF])/g, '$1')
    .replace(/\u00C2 /g, ' ')
    .replace(/\uFFFD+/g, '');
}

function walk(o) {
  if (typeof o === 'string') return cleanString(o);
  if (Array.isArray(o)) return o.map(walk);
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) out[k] = walk(v);
    return out;
  }
  return o;
}

function cleanJsonFile(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.log('skip missing', rel);
    return;
  }
  let text = fs.readFileSync(file, 'utf8');
  const hadBom = text.charCodeAt(0) === 0xfeff;
  if (hadBom) text = text.slice(1);
  const data = JSON.parse(text);
  const cleaned = walk(data);
  const out = `${JSON.stringify(cleaned, null, 2)}\n`;
  const prevNorm = `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  if (hadBom || out !== prevNorm) {
    fs.writeFileSync(file, out, 'utf8');
    console.log(
      `cleaned ${rel} hadBom=${hadBom} leads=${cleaned.leads?.length ?? '?'} users=${cleaned.users?.length ?? '?'}`
    );
  } else {
    console.log(`unchanged ${rel}`);
  }
}

function cleanCssComments(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return;
  let css = fs.readFileSync(file, 'utf8');
  const before = css.length;
  css = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => {
    let t = comment;
    // box-drawing ─ misread as â + ” + €
    t = t.replace(/\u00E2\u201D\u20AC/g, '-');
    t = t.replace(/\u00E2\u20AC[\u0000-\u00FF]/g, '-');
    t = t.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
    t = t.replace(/-{4,}/g, '----');
    t = t.replace(/[ \t]{2,}/g, ' ');
    t = t.replace(/ \*\//g, ' */');
    t = t.replace(/\/\* +/g, '/* ');
    return t;
  });
  if (css.length !== before) {
    fs.writeFileSync(file, css, 'utf8');
    console.log(`cleaned ${rel} bytes ${before} -> ${css.length}`);
  } else {
    console.log(`unchanged ${rel}`);
  }
}

// Delete known junk: accidental empty prompt-word files + empty stubs
const junkExact = [
  'and',
  'clean,',
  'column',
  'columns',
  'compact',
  'fixed',
  'for',
  'heights',
  'in',
  'instead',
  'intuitive',
  'is',
  'it',
  'Keep',
  'kicks',
  'leads',
  'make',
  'names',
  'of',
  'optimize',
  'readable,',
  'rows',
  'scrolling',
  'Set',
  'so',
  'stretching',
  'table',
  'text',
  'the',
  'widths',
  '_nul',
  'docs/_nul',
  'src/components/LeadTable.tsx',
  'src/components/LeadsTable.tsx',
  'src/components/LeadsTable.css',
  'truncation/overflow',
  // zero-byte logo placeholders
  'attached_assets/idao_1780842413793.png',
  'attached_assets/nestwise_1780842413797.png',
  'attached_assets/optimaclean_1780842413797.png',
  'attached_assets/optimaviz_1780842413798.png',
  'attached_assets/taskgo_1780842413799.png',
  'docs/attached_assets/idao_1780842413793.png',
  'docs/attached_assets/nestwise_1780842413797.png',
  'docs/attached_assets/optimaclean_1780842413797.png',
  'docs/attached_assets/optimaviz_1780842413798.png',
  'docs/attached_assets/taskgo_1780842413799.png',
];

function deleteJunk() {
  let n = 0;
  for (const rel of junkExact) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const st = fs.statSync(file);
    if (st.isDirectory()) {
      fs.rmSync(file, { recursive: true, force: true });
      console.log('rm dir', rel);
      n++;
      continue;
    }
    // Only delete empty files for safety on assets/stubs
    if (st.size === 0) {
      fs.unlinkSync(file);
      console.log('rm', rel);
      n++;
    } else {
      console.log('skip non-empty', rel, st.size);
    }
  }
  // Remove empty truncation dir if empty
  const trunc = path.join(root, 'truncation');
  if (fs.existsSync(trunc) && fs.readdirSync(trunc).length === 0) {
    fs.rmdirSync(trunc);
    console.log('rm dir truncation');
    n++;
  }
  console.log(`deleted ${n} junk paths`);
}

cleanJsonFile('db.json');
cleanJsonFile('db-saas.json');
cleanCssComments('src/index.css');
deleteJunk();
console.log('done');
