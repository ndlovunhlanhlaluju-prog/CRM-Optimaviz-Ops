import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  DbSocialAdAccount,
  DbSocialAdMetric,
  DbSocialBrandBudget,
  DbSocialConnection,
  DbSocialContentTemplate,
  DbSocialPage,
  DbSocialPost,
  LocalDb,
} from '../../src/db/server_db.js';
import { decryptSecret, encryptSecret } from '../utils/secretVault';

type Provider = 'meta' | 'linkedin';

interface SocialHubRoutesContext {
  db: LocalDb;
  requireAuth: express.RequestHandler;
  requireAdmin: express.RequestHandler;
  workspaceIdFor: (req: express.Request) => string;
  inWorkspace: <T extends { workspace_id?: string }>(item: T, workspaceId: string) => boolean;
  brandInWorkspace: (brandId: string, workspaceId: string) => boolean;
  newId: (prefix: string) => string;
  getPublicBaseUrl: (req: express.Request) => string;
  /** API host (Render) — OAuth provider callbacks must hit this, not the Vercel SPA. */
  getApiBaseUrl?: (req: express.Request) => string;
  /** SPA origin (Vercel) — browser bounce-back after OAuth. */
  getFrontendBaseUrl?: (req: express.Request) => string;
  buildOAuthReturnUrl?: (req: express.Request, returnTo: unknown, statusQuery: string) => string;
  sanitizeReturnTo?: (value: unknown, fallback?: string) => string;
  isAdminUser?: (user: any) => boolean;
  hasBrandAccess?: (user: any, brandId: string) => boolean;
}

function sanitizeString(value: unknown, maxLen = 1000): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function cleanProvider(value: unknown): Provider {
  return sanitizeString(value, 40).toLowerCase() === 'linkedin' ? 'linkedin' : 'meta';
}

function nowIso() {
  return new Date().toISOString();
}

function providerLabel(provider: Provider) {
  return provider === 'linkedin' ? 'LinkedIn' : 'Meta';
}

function metaVersion() {
  return process.env.META_GRAPH_VERSION || 'v25.0';
}

function publicBaseUrl(req: express.Request, ctx: SocialHubRoutesContext) {
  return (process.env.PUBLIC_CRM_URL || ctx.getPublicBaseUrl(req)).replace(/\/$/, '');
}

/** Provider OAuth redirect_uri must be the API host (Render), never the Vercel SPA. */
function apiBaseUrl(req: express.Request, ctx: SocialHubRoutesContext) {
  if (ctx.getApiBaseUrl) return ctx.getApiBaseUrl(req).replace(/\/$/, '');
  const explicit = sanitizeString(
    process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || process.env.SAAS_API_URL || '',
    300,
  ).replace(/\/$/, '');
  if (explicit) return explicit;
  // Fall back to request host rather than PUBLIC_CRM_URL (which is often the Vercel UI).
  return ctx.getPublicBaseUrl(req).replace(/\/$/, '');
}

function frontendBaseUrl(req: express.Request, ctx: SocialHubRoutesContext) {
  if (ctx.getFrontendBaseUrl) return ctx.getFrontendBaseUrl(req).replace(/\/$/, '');
  return sanitizeString(
    process.env.FRONTEND_URL || process.env.APP_BASE_URL || process.env.PUBLIC_CRM_URL || '',
    300,
  ).replace(/\/$/, '') || publicBaseUrl(req, ctx);
}

function redirectUri(req: express.Request, ctx: SocialHubRoutesContext, provider: Provider) {
  const base = apiBaseUrl(req, ctx);
  const host = sanitizeString(req.get('host') || '', 300);
  const isLocalRequest = /^localhost(?::\d+)?$/i.test(host) || /^127\.0\.0\.1(?::\d+)?$/i.test(host);
  const pick = (configuredRaw: string | undefined, path: string) => {
    const configured = sanitizeString(configuredRaw || '', 500);
    const configuredIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configured);
    // Prefer explicit env when it matches this environment; never leave production on a localhost redirect.
    if (configured && (!configuredIsLocal || isLocalRequest)) return configured;
    return `${base}${path}`;
  };
  if (provider === 'linkedin') return pick(process.env.LINKEDIN_REDIRECT_URI, '/api/social/linkedin/callback');
  return pick(process.env.META_REDIRECT_URI, '/api/social/meta/callback');
}

function socialSanitizeReturnTo(ctx: SocialHubRoutesContext, value: unknown, fallback = '/'): string {
  if (ctx.sanitizeReturnTo) return ctx.sanitizeReturnTo(value, fallback);
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      if (!['http:', 'https:'].includes(url.protocol)) return fallback;
      return `${url.origin}${url.pathname || '/'}${url.search || ''}`.split('#')[0];
    } catch {
      return fallback;
    }
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw.split('#')[0] || fallback;
}

function socialBuildReturnUrl(req: express.Request, ctx: SocialHubRoutesContext, returnTo: unknown, statusQuery: string): string {
  if (ctx.buildOAuthReturnUrl) return ctx.buildOAuthReturnUrl(req, returnTo, statusQuery);
  const frontendBase = frontendBaseUrl(req, ctx);
  const cleaned = socialSanitizeReturnTo(ctx, returnTo, '/');
  let target: string;
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) target = cleaned;
  else if (frontendBase) target = `${frontendBase}${cleaned === '/' ? '' : cleaned}` || frontendBase;
  else target = cleaned || '/';
  const join = target.includes('?') ? '&' : '?';
  return `${target}${join}${statusQuery}`;
}

/** Escape bounce-back URLs for HTML meta refresh / anchor href attributes. */
function escapeSocialRedirectHtml(url: string): string {
  return String(url || '/')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function extractSocialReturnTo(req: express.Request, ctx: SocialHubRoutesContext): string {
  const fromQuery = socialSanitizeReturnTo(ctx, req.query?.return_to);
  if (fromQuery && fromQuery !== '/') return fromQuery;
  const referer = String(req.headers.referer || '').trim();
  if (referer) {
    try {
      const url = new URL(referer);
      const absolute = socialSanitizeReturnTo(ctx, `${url.origin}${url.pathname}${url.search}`);
      if (absolute && absolute !== '/') return absolute;
    } catch { /* ignore */ }
  }
  const origin = String(req.headers.origin || '').trim().replace(/\/$/, '');
  if (origin) return `${origin}/`;
  return '/';
}

function envFlag(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function linkedinScopes() {
  const explicit = sanitizeString(process.env.LINKEDIN_SOCIAL_SCOPES || '', 1000);
  if (explicit) return explicit.split(/\s+/).filter(Boolean);
  const base = ['openid', 'profile', 'email', 'w_member_social'];
  if (!envFlag(process.env.LINKEDIN_ORG_SCOPES_ENABLED)) return base;
  return ['openid', 'profile', 'email', 'r_organization_social', 'w_organization_social', 'w_member_social'];
}

function usesLinkedInOrgScopes(scopes: string[]) {
  return scopes.includes('r_organization_social') || scopes.includes('w_organization_social');
}

function linkedinApiVersion() {
  return process.env.LINKEDIN_API_VERSION || '202606';
}

function linkedinRestHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': linkedinApiVersion(),
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

function getLinkedInOrganizationName(org: any, id: string) {
  const localized = org?.localizedName || org?.vanityName || org?.name?.localized;
  if (typeof localized === 'string' && localized.trim()) return localized;
  if (localized && typeof localized === 'object') {
    const first = Object.values(localized).find(value => typeof value === 'string' && value.trim());
    if (first) return String(first);
  }
  return `LinkedIn Organization ${id}`;
}

function getLinkedInAdAccountName(account: any, id: string) {
  const name = account?.name || account?.localizedName || account?.reference || account?.accountName;
  if (typeof name === 'string' && name.trim()) return name;
  return `LinkedIn Ad Account ${id}`;
}

function linkedInAdAccountIdFrom(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return linkedInAdAccountIdFrom(obj.id || obj.account || obj.sponsoredAccount || obj.urn || obj.entity || obj.value);
  }
  return sanitizeString(value, 220)
    .replace(/^urn:li:sponsoredAccount:/, '')
    .replace(/^urn:li:adAccount:/, '')
    .replace(/^urn:li:organization:/, '');
}

function providerConfig(req: express.Request, ctx: SocialHubRoutesContext, provider: Provider) {
  if (provider === 'linkedin') {
    return {
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      redirectUri: redirectUri(req, ctx, provider),
      scopes: linkedinScopes(),
    };
  }
  return {
    clientId: process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '',
    clientSecret: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '',
    redirectUri: redirectUri(req, ctx, provider),
    scopes: (process.env.META_SOCIAL_SCOPES || 'pages_show_list pages_read_engagement pages_manage_posts instagram_basic instagram_content_publish ads_read business_management').split(/\s+/).filter(Boolean),
  };
}

function stateSecret(provider: Provider, configSecret: string) {
  return process.env.SESSION_SECRET || configSecret || process.env.DATA_ENCRYPTION_KEY || `${provider}-development-state`;
}

function encodeState(payload: Record<string, unknown>, provider: Provider, secret: string) {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret(provider, secret)).update(json).digest('base64url');
  return `${json}.${sig}`;
}

function decodeState(state: unknown, provider: Provider, secret: string) {
  // State can include absolute return_to (Vercel) and is often well over 200 chars — do not over-truncate.
  const raw = String(state || '').trim().slice(0, 8000);
  const [json, sig] = raw.split('.');
  if (!json || !sig) throw new Error('Invalid social connection state.');
  const expected = crypto.createHmac('sha256', stateSecret(provider, secret)).update(json).digest('base64url');
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid social connection state.');
  }
  const payload = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
  if (Date.now() - Number(payload.created_at || 0) > 15 * 60 * 1000) throw new Error('Social connection expired. Please start again.');
  return payload;
}

function peekSocialReturnTo(state: unknown): string {
  try {
    const raw = String(state || '').trim().slice(0, 8000);
    const json = raw.split('.')[0];
    if (!json) return '/';
    const payload = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
    return String(payload?.return_to || '/');
  } catch {
    return '/';
  }
}

function decodeMetaSignedRequest(signedRequest: unknown, appSecret: string) {
  const raw = sanitizeString(signedRequest, 8000);
  const [encodedSig, encodedPayload] = raw.split('.');
  if (!encodedSig || !encodedPayload || !appSecret) throw new Error('Invalid Meta signed request.');
  const expected = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest('base64url');
  if (Buffer.byteLength(encodedSig) !== Buffer.byteLength(expected)) throw new Error('Meta signed request could not be verified.');
  if (!crypto.timingSafeEqual(Buffer.from(encodedSig), Buffer.from(expected))) throw new Error('Meta signed request could not be verified.');
  return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
}

async function fetchJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const message = sanitizeString(data?.error?.message || data?.message || data?.error_description || text || 'Provider request failed.', 700);
    throw new Error(message);
  }
  return data;
}

function safeEncrypt(value: string) {
  if (!value) return '';
  return encryptSecret(value);
}

function safeToken(value: unknown) {
  return decryptSecret(value);
}

function extensionFromMime(mimeType: string) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('quicktime')) return 'mov';
  return 'jpg';
}

function mediaKindFromMime(mimeType: string) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  return 'image';
}

function supabaseStorageConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || '';
  return { url, key, bucket, configured: Boolean(url && key && bucket) };
}

async function uploadSocialMedia(req: express.Request, ctx: SocialHubRoutesContext, workspaceId: string, fileName: string, detectedMime: string, buffer: Buffer) {
  const storage = supabaseStorageConfig();
  if (storage.configured) {
    const objectPath = `${workspaceId}/${fileName}`;
    const uploadUrl = `${storage.url}/storage/v1/object/${encodeURIComponent(storage.bucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: storage.key,
        Authorization: `Bearer ${storage.key}`,
        'Content-Type': detectedMime,
        'Cache-Control': '3600',
        'x-upsert': 'false',
      },
      body: buffer,
    });
    const text = await response.text();
    if (!response.ok) {
      let detail = text;
      try { detail = JSON.parse(text)?.message || detail; } catch { /* leave text detail */ }
      throw new Error(`Storage upload failed: ${sanitizeString(detail, 300)}`);
    }
    return `${storage.url}/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
  }

  const uploadDir = path.join(process.cwd(), 'public', 'social-uploads', workspaceId);
  fs.mkdirSync(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return `${publicBaseUrl(req, ctx)}/public/social-uploads/${encodeURIComponent(workspaceId)}/${encodeURIComponent(fileName)}`;
}

async function downloadSocialMedia(url: string) {
  const safeUrl = sanitizeString(url, 1200);
  if (!/^https?:\/\//i.test(safeUrl)) throw new Error('Media URL is not available for publishing.');
  const response = await fetch(safeUrl);
  if (!response.ok) throw new Error(`Could not read attached media: ${response.status}`);
  const mimeType = sanitizeString(response.headers.get('content-type') || '', 120).split(';')[0] || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length) throw new Error('Attached media is empty.');
  return { buffer, mimeType, kind: mediaKindFromMime(mimeType), url: safeUrl };
}

async function uploadLinkedInImage(token: string, author: string, media: { buffer: Buffer; mimeType: string }) {
  const init = await fetchJson('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: {
      ...linkedinRestHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
  });
  const uploadUrl = sanitizeString(init?.value?.uploadUrl, 2000);
  const imageUrn = sanitizeString(init?.value?.image, 300);
  if (!uploadUrl || !imageUrn) throw new Error('LinkedIn did not return an image upload URL.');

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': media.mimeType || 'application/octet-stream',
    },
    body: media.buffer,
  });
  const detail = await upload.text();
  if (!upload.ok) throw new Error(sanitizeString(detail || 'LinkedIn image upload failed.', 700));
  await waitForLinkedInAsset(token, 'images', imageUrn);
  return imageUrn;
}

async function uploadLinkedInVideo(token: string, author: string, media: { buffer: Buffer; mimeType: string }) {
  const init = await fetchJson('https://api.linkedin.com/rest/videos?action=initializeUpload', {
    method: 'POST',
    headers: {
      ...linkedinRestHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: author, fileSizeBytes: media.buffer.length } }),
  });
  const value = init?.value || {};
  const videoUrn = sanitizeString(value.video, 300);
  const uploadToken = sanitizeString(value.uploadToken, 500);
  const instructions = Array.isArray(value.uploadInstructions) ? value.uploadInstructions : [];
  if (!videoUrn || !instructions.length) throw new Error('LinkedIn did not return video upload instructions.');

  const uploadedPartIds: string[] = [];
  for (const instruction of instructions) {
    const uploadUrl = sanitizeString(instruction.uploadUrl, 2000);
    const firstByte = Number(instruction.firstByte || 0);
    const lastByte = Number(instruction.lastByte ?? media.buffer.length - 1);
    if (!uploadUrl || Number.isNaN(firstByte) || Number.isNaN(lastByte)) continue;
    const chunk = media.buffer.subarray(firstByte, lastByte + 1);
    const upload = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': media.mimeType || 'application/octet-stream',
      },
      body: chunk,
    });
    const detail = await upload.text();
    if (!upload.ok) throw new Error(sanitizeString(detail || 'LinkedIn video upload failed.', 700));
    const etag = upload.headers.get('etag') || upload.headers.get('ETag') || '';
    if (etag) uploadedPartIds.push(etag.replace(/^"|"$/g, ''));
  }

  if (uploadToken) {
    await fetchJson('https://api.linkedin.com/rest/videos?action=finalizeUpload', {
      method: 'POST',
      headers: {
        ...linkedinRestHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds } }),
    });
  }
  await waitForLinkedInAsset(token, 'videos', videoUrn);
  return videoUrn;
}

async function waitForLinkedInAsset(token: string, endpoint: 'images' | 'videos', assetUrn: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const data = await fetchJson(`https://api.linkedin.com/rest/${endpoint}/${encodeURIComponent(assetUrn)}`, {
        headers: linkedinRestHeaders(token),
      });
      const status = sanitizeString(data?.status || data?.processingStatus || data?.state || '', 80).toUpperCase();
      if (!status || status === 'AVAILABLE' || status === 'READY') return;
      if (status.includes('FAILED')) throw new Error(`LinkedIn media processing failed: ${status}`);
    } catch (err) {
      if (attempt >= 7) throw err;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

function publicConnection(connection: DbSocialConnection, isAdmin: boolean) {
  const { access_token: _a, refresh_or_long_lived_token: _b, ...safe } = connection;
  if (!isAdmin) {
    const { connected_name: _n, connected_email: _e, ...adminSafe } = safe;
    return adminSafe;
  }
  return safe;
}

function publicPage(page: DbSocialPage) {
  const { page_access_token: _token, ...safe } = page;
  return safe;
}

function findConnection(db: LocalDb, provider: Provider, workspaceId: string) {
  return (db.get().social_connections || [])
    .filter(item => item.provider === provider && (!item.workspace_id || item.workspace_id === workspaceId))
    .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))[0];
}

function upsertConnection(ctx: SocialHubRoutesContext, connection: DbSocialConnection) {
  const rows = ctx.db.get().social_connections = ctx.db.get().social_connections || [];
  const idx = rows.findIndex(item => item.workspace_id === connection.workspace_id && item.provider === connection.provider);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...connection, id: rows[idx].id, created_at: rows[idx].created_at, updated_at: nowIso() };
  else rows.push(connection);
  return idx >= 0 ? rows[idx] : connection;
}

function upsertPage(ctx: SocialHubRoutesContext, page: DbSocialPage) {
  const rows = ctx.db.get().social_pages = ctx.db.get().social_pages || [];
  const idx = rows.findIndex(item => item.workspace_id === page.workspace_id && item.provider === page.provider && item.page_id === page.page_id);
  if (idx >= 0) {
    // Preserve CRM brand mapping across provider sync refreshes.
    const prevBrand = rows[idx].brand_id;
    rows[idx] = {
      ...rows[idx],
      ...page,
      id: rows[idx].id,
      brand_id: page.brand_id || prevBrand || rows[idx].brand_id,
      created_at: rows[idx].created_at,
      updated_at: nowIso(),
    };
  } else rows.push(page);
}

function upsertAdAccount(ctx: SocialHubRoutesContext, account: DbSocialAdAccount) {
  const rows = ctx.db.get().social_ad_accounts = ctx.db.get().social_ad_accounts || [];
  const idx = rows.findIndex(item => item.workspace_id === account.workspace_id && item.provider === account.provider && item.ad_account_id === account.ad_account_id);
  if (idx >= 0) {
    const prevBrand = rows[idx].brand_id;
    rows[idx] = {
      ...rows[idx],
      ...account,
      id: rows[idx].id,
      brand_id: account.brand_id || prevBrand || rows[idx].brand_id,
      created_at: rows[idx].created_at,
      updated_at: nowIso(),
    };
  } else rows.push(account);
}

async function exchangeMetaToken(req: express.Request, ctx: SocialHubRoutesContext, code: string) {
  const config = providerConfig(req, ctx, 'meta');
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  });
  const short = await fetchJson(`https://graph.facebook.com/${metaVersion()}/oauth/access_token?${params.toString()}`);
  const longParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    fb_exchange_token: short.access_token,
  });
  const long = await fetchJson(`https://graph.facebook.com/${metaVersion()}/oauth/access_token?${longParams.toString()}`);
  return {
    accessToken: long.access_token || short.access_token,
    expiresIn: Number(long.expires_in || short.expires_in || 60 * 24 * 60 * 60),
  };
}

async function syncMetaProfile(connection: DbSocialConnection) {
  const token = safeToken(connection.access_token);
  try {
    const me = await fetchJson(`https://graph.facebook.com/${metaVersion()}/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`);
    connection.provider_user_id = sanitizeString(me.id, 180) || connection.provider_user_id;
    connection.connected_name = sanitizeString(me.name, 180) || connection.connected_name;
    connection.connected_email = sanitizeString(me.email, 180) || connection.connected_email;
  } catch {}
}

async function syncMetaAssets(ctx: SocialHubRoutesContext, workspaceId: string, connection: DbSocialConnection) {
  const token = safeToken(connection.access_token);
  const pageData = await fetchJson(`https://graph.facebook.com/${metaVersion()}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100&access_token=${encodeURIComponent(token)}`);
  for (const item of pageData.data || []) {
    upsertPage(ctx, {
      id: ctx.newId('social-page'),
      workspace_id: workspaceId,
      provider: 'meta',
      connection_id: connection.id,
      page_id: sanitizeString(item.id, 120),
      page_name: sanitizeString(item.name || 'Facebook Page', 180),
      page_access_token: safeEncrypt(item.access_token || ''),
      instagram_business_account_id: sanitizeString(item.instagram_business_account?.id, 120),
      instagram_username: sanitizeString(item.instagram_business_account?.username, 120),
      status: 'connected',
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  }
  try {
    const adData = await fetchJson(`https://graph.facebook.com/${metaVersion()}/me/adaccounts?fields=id,name,currency,account_status&limit=100&access_token=${encodeURIComponent(token)}`);
    for (const item of adData.data || []) {
      upsertAdAccount(ctx, {
        id: ctx.newId('social-ad'),
        workspace_id: workspaceId,
        provider: 'meta',
        connection_id: connection.id,
        ad_account_id: sanitizeString(item.id, 120),
        ad_account_name: sanitizeString(item.name || item.id, 180),
        currency: sanitizeString(item.currency || '', 20),
        status: Number(item.account_status || 1) === 1 ? 'connected' : 'needs_attention',
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    }
  } catch (err) {
    connection.last_error = `Meta ad accounts not available yet: ${(err as Error).message}`;
    connection.updated_at = nowIso();
  }
}

async function exchangeLinkedInToken(req: express.Request, ctx: SocialHubRoutesContext, code: string) {
  const config = providerConfig(req, ctx, 'linkedin');
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const data = await fetchJson('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresIn: Number(data.expires_in || 60 * 24 * 60 * 60),
  };
}

async function syncLinkedInAssets(ctx: SocialHubRoutesContext, workspaceId: string, connection: DbSocialConnection) {
  const token = safeToken(connection.access_token);
  try {
    const me = await fetchJson('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    connection.provider_user_id = sanitizeString(me.sub, 180) || connection.provider_user_id;
    connection.connected_email = sanitizeString(me.email, 180) || connection.connected_email;
    connection.connected_name = sanitizeString(me.name, 180) || connection.connected_name;
  } catch {}

  const rows = ctx.db.get().social_pages = ctx.db.get().social_pages || [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const page = rows[i];
    if (page.workspace_id === workspaceId && page.provider === 'linkedin' && String(page.page_id || '').startsWith('person:')) {
      rows.splice(i, 1);
    }
  }

  const scopes = linkedinScopes();
  if (!usesLinkedInOrgScopes(scopes)) {
    connection.last_error = 'LinkedIn account connected. Company pages will appear after LinkedIn approves organization social access for this app.';
    connection.updated_at = nowIso();
    return;
  }

  try {
    const orgs = await fetchJson('https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR', {
      headers: linkedinRestHeaders(token),
    });
    for (const item of orgs.elements || []) {
      const id = sanitizeString(item.organization || item.organizationUrn || item['organization~']?.id, 160).replace(/^urn:li:organization:/, '');
      if (!id) continue;
      let org = item['organization~'] || {};
      try {
        org = await fetchJson(`https://api.linkedin.com/rest/organizations/${encodeURIComponent(id)}`, {
          headers: linkedinRestHeaders(token),
        });
      } catch {
        try {
          org = await fetchJson(`https://api.linkedin.com/rest/organization/${encodeURIComponent(id)}`, {
            headers: linkedinRestHeaders(token),
          });
        } catch {
          org = item['organization~'] || {};
        }
      }
      upsertPage(ctx, {
        id: ctx.newId('social-page'),
        workspace_id: workspaceId,
        provider: 'linkedin',
        connection_id: connection.id,
        page_id: id,
        page_name: sanitizeString(getLinkedInOrganizationName(org, id), 180),
        status: 'connected',
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    }
    connection.last_error = '';
    connection.updated_at = nowIso();
  } catch (err) {
    connection.last_error = `LinkedIn company pages could not be loaded yet. Confirm the account is a page super admin and the app has organization scopes enabled. ${(err as Error).message}`;
    connection.updated_at = nowIso();
  }
  await syncLinkedInAdAccounts(ctx, workspaceId, connection);
}

async function syncLinkedInAdAccounts(ctx: SocialHubRoutesContext, workspaceId: string, connection: DbSocialConnection) {
  const token = safeToken(connection.access_token);
  if (!token || !linkedinScopes().some(scope => scope === 'r_ads' || scope === 'rw_ads' || scope === 'r_ads_reporting')) return;
  try {
    const accountIds = new Set<string>();
    const discoveryUrls = [
      'https://api.linkedin.com/rest/adAccountUsers?q=authenticatedUser',
      'https://api.linkedin.com/rest/adAccounts?q=authenticatedUser',
    ];
    for (const url of discoveryUrls) {
      try {
        const data = await fetchJson(url, { headers: linkedinRestHeaders(token) });
        for (const item of data.elements || data.data || []) {
          const id = linkedInAdAccountIdFrom(item.account || item.sponsoredAccount || item.adAccount || item.accountUrn || item.id);
          if (id) accountIds.add(id);
        }
      } catch {}
    }
    for (const id of accountIds) {
      let account: any = {};
      try {
        account = await fetchJson(`https://api.linkedin.com/rest/adAccounts/${encodeURIComponent(id)}`, {
          headers: linkedinRestHeaders(token),
        });
      } catch {}
      upsertAdAccount(ctx, {
        id: ctx.newId('social-ad'),
        workspace_id: workspaceId,
        provider: 'linkedin',
        connection_id: connection.id,
        ad_account_id: id,
        ad_account_name: sanitizeString(getLinkedInAdAccountName(account, id), 220),
        currency: sanitizeString(account?.currency || account?.currencyCode || '', 20),
        status: sanitizeString(account?.status || 'connected', 60).toLowerCase(),
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    }
  } catch (err) {
    connection.last_error = `LinkedIn ad accounts could not be loaded yet. Confirm the account has LinkedIn Campaign Manager access and r_ads permission is enabled. ${(err as Error).message}`;
    connection.updated_at = nowIso();
  }
}

function createPostFromBody(ctx: SocialHubRoutesContext, req: express.Request, status: DbSocialPost['status']) {
  const workspaceId = ctx.workspaceIdFor(req);
  const brandId = sanitizeString(req.body?.brand_id, 80).toLowerCase();
  if (!brandId || !ctx.brandInWorkspace(brandId, workspaceId)) throw new Error('Choose a valid CRM brand.');
  const provider = cleanProvider(req.body?.provider);
  const media = Array.isArray(req.body?.media_urls) ? req.body.media_urls : String(req.body?.media_urls || '').split(',');
  const targets = Array.isArray(req.body?.publish_targets) ? req.body.publish_targets : String(req.body?.publish_targets || '').split(',');
  return {
    id: ctx.newId('social-post'),
    workspace_id: workspaceId,
    brand_id: brandId,
    provider,
    page_id: sanitizeString(req.body?.page_id, 160),
    instagram_account_id: sanitizeString(req.body?.instagram_account_id, 160),
    linkedin_organization_id: sanitizeString(req.body?.linkedin_organization_id || req.body?.page_id, 160),
    caption: sanitizeString(req.body?.caption, 12000),
    media_urls: media.map(item => sanitizeString(item, 900)).filter(Boolean),
    post_type: sanitizeString(req.body?.post_type || (media.filter(Boolean).length ? 'image' : 'text'), 30),
    publish_targets: targets.map(item => sanitizeString(item, 40).toLowerCase()).filter(Boolean),
    status,
    scheduled_for: req.body?.scheduled_for ? new Date(req.body.scheduled_for).toISOString() : undefined,
    created_by: req.user?.id,
    created_at: nowIso(),
    updated_at: nowIso(),
  } as DbSocialPost;
}

async function publishMetaPost(ctx: SocialHubRoutesContext, post: DbSocialPost) {
  const page = (ctx.db.get().social_pages || []).find(item => item.provider === 'meta' && item.workspace_id === post.workspace_id && item.page_id === post.page_id);
  if (!page) throw new Error('Connected Facebook page was not found for this workspace.');
  const pageToken = safeToken(page.page_access_token);
  if (!pageToken) throw new Error('Facebook page token is unavailable. Reconnect Meta.');
  const publishedIds: string[] = [];
  const targets = post.publish_targets.length ? post.publish_targets : ['facebook'];

  if (targets.includes('facebook')) {
    if (post.media_urls[0]) {
      const data = await fetchJson(`https://graph.facebook.com/${metaVersion()}/${encodeURIComponent(page.page_id)}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ url: post.media_urls[0], caption: post.caption, published: 'true', access_token: pageToken }).toString(),
      });
      publishedIds.push(data.post_id || data.id);
    } else {
      const data = await fetchJson(`https://graph.facebook.com/${metaVersion()}/${encodeURIComponent(page.page_id)}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ message: post.caption, access_token: pageToken }).toString(),
      });
      publishedIds.push(data.id);
    }
  }

  if (targets.includes('instagram')) {
    const igId = post.instagram_account_id || page.instagram_business_account_id;
    if (!igId) throw new Error('This Facebook page does not have a connected Instagram Business or Creator account.');
    if (!post.media_urls[0]) throw new Error('Instagram publishing needs an image URL for this first version.');
    const container = await fetchJson(`https://graph.facebook.com/${metaVersion()}/${encodeURIComponent(igId)}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ image_url: post.media_urls[0], caption: post.caption, access_token: pageToken }).toString(),
    });
    const published = await fetchJson(`https://graph.facebook.com/${metaVersion()}/${encodeURIComponent(igId)}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: container.id, access_token: pageToken }).toString(),
    });
    publishedIds.push(published.id);
  }

  return publishedIds.filter(Boolean).join(',');
}

async function publishLinkedInPost(ctx: SocialHubRoutesContext, post: DbSocialPost) {
  const connection = findConnection(ctx.db, 'linkedin', post.workspace_id || '');
  if (!connection) throw new Error('LinkedIn is not connected yet.');
  const token = safeToken(connection.access_token);
  const organizationId = post.linkedin_organization_id || post.page_id;
  if (!organizationId) throw new Error('Choose a LinkedIn organization page before publishing.');
  const isPerson = organizationId.startsWith('person:');
  const author = isPerson
    ? `urn:li:person:${organizationId.replace(/^person:/, '')}`
    : `urn:li:organization:${organizationId}`;
  const payload: any = {
    author,
    commentary: post.caption,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  if (post.media_urls.length) {
    const media = await Promise.all(post.media_urls.map(url => downloadSocialMedia(url)));
    const videos = media.filter(item => item.kind === 'video');
    const images = media.filter(item => item.kind === 'image');
    if (videos.length && images.length) throw new Error('LinkedIn posts can use images or one video, not both in the same post.');
    if (videos.length > 1) throw new Error('LinkedIn supports one video per post.');
    if (videos.length) {
      const videoUrn = await uploadLinkedInVideo(token, author, videos[0]);
      payload.content = { media: { id: videoUrn, title: sanitizeString(post.caption, 180) || 'Video' } };
    } else {
      const imageUrns = [];
      for (const image of images) imageUrns.push(await uploadLinkedInImage(token, author, image));
      payload.content = imageUrns.length === 1
        ? { media: { id: imageUrns[0], altText: sanitizeString(post.caption, 250) || 'Post image' } }
        : { multiImage: { images: imageUrns.map(id => ({ id, altText: sanitizeString(post.caption, 250) || 'Post image' })) } };
    }
  }

  const response = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': linkedinApiVersion(),
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(sanitizeString(text || 'LinkedIn publish failed.', 800));
  return response.headers.get('x-restli-id') || text || '';
}

export async function publishSocialPost(ctx: SocialHubRoutesContext, post: DbSocialPost) {
  const posts = ctx.db.get().social_posts || [];
  const current = posts.find(item => item.id === post.id);
  if (!current || current.status === 'published' || current.status === 'cancelled') return current;
  current.status = 'publishing';
  current.failure_reason = '';
  current.updated_at = nowIso();
  ctx.db.save();
  try {
    const providerId = current.provider === 'linkedin'
      ? await publishLinkedInPost(ctx, current)
      : await publishMetaPost(ctx, current);
    current.status = 'published';
    current.provider_post_id = providerId;
    current.published_at = nowIso();
    current.updated_at = nowIso();
  } catch (err) {
    current.status = 'failed';
    current.failure_reason = sanitizeString((err as Error).message || 'Publishing failed.', 900);
    current.updated_at = nowIso();
  }
  ctx.db.save();
  return current;
}

function summarize(ctx: SocialHubRoutesContext, req: express.Request) {
  const workspaceId = ctx.workspaceIdFor(req);
  const user = req.user || null;
  const isAdmin = Boolean(ctx.isAdminUser?.(user));
  const connections = (ctx.db.get().social_connections || []).filter(item => ctx.inWorkspace(item, workspaceId));
  const pages = (ctx.db.get().social_pages || []).filter(item => ctx.inWorkspace(item, workspaceId) && !String(item.page_id || '').startsWith('person:'));
  const adAccounts = (ctx.db.get().social_ad_accounts || []).filter(item => ctx.inWorkspace(item, workspaceId));
  const posts = (ctx.db.get().social_posts || []).filter(item => ctx.inWorkspace(item, workspaceId));
  const metrics = (ctx.db.get().social_ad_metrics || []).filter(item => ctx.inWorkspace(item, workspaceId));
  const spend = metrics.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const leads = metrics.reduce((sum, row) => sum + Number(row.leads || 0), 0);
  const accessiblePages = isAdmin
    ? pages
    : pages.filter(page => {
        if (!page.brand_id) return false;
        if (!ctx.hasBrandAccess || !user) return Boolean(page.brand_id);
        return ctx.hasBrandAccess(user, page.brand_id);
      });
  const accessibleAdAccounts = isAdmin
    ? adAccounts
    : adAccounts.filter(account => {
        if (!account.brand_id) return false;
        if (!ctx.hasBrandAccess || !user) return Boolean(account.brand_id);
        return ctx.hasBrandAccess(user, account.brand_id);
      });
  return {
    connections: connections.map(c => publicConnection(c, isAdmin)),
    pages: accessiblePages.map(publicPage),
    ad_accounts: accessibleAdAccounts,
    stats: {
      connected_facebook_pages: accessiblePages.filter(p => p.provider === 'meta').length,
      connected_instagram_accounts: accessiblePages.filter(p => p.provider === 'meta' && p.instagram_business_account_id).length,
      connected_linkedin_pages: accessiblePages.filter(p => p.provider === 'linkedin').length,
      scheduled_posts: posts.filter(p => p.status === 'scheduled').length,
      published_posts: posts.filter(p => p.status === 'published').length,
      failed_posts: posts.filter(p => p.status === 'failed').length,
      ad_spend: Math.round(spend * 100) / 100,
      leads_generated: leads,
      cost_per_lead: leads ? Math.round((spend / leads) * 100) / 100 : 0,
    },
  };
}

function linkedInDateParts(isoDate: string) {
  const [year, month, day] = String(isoDate || '').split('-').map(part => Number(part) || 0);
  return { year, month, day };
}

function linkedInDateRangeParam(since: string, until: string) {
  const start = linkedInDateParts(since);
  const end = linkedInDateParts(until);
  return `(start:(year:${start.year},month:${start.month},day:${start.day}),end:(year:${end.year},month:${end.month},day:${end.day}))`;
}

function upsertMetricRow(rows: DbSocialAdMetric[], metric: DbSocialAdMetric) {
  const idx = rows.findIndex(row =>
    row.workspace_id === metric.workspace_id
    && row.provider === metric.provider
    && row.ad_account_id === metric.ad_account_id
    && String(row.campaign_id || '') === String(metric.campaign_id || '')
    && row.date === metric.date,
  );
  if (idx >= 0) rows[idx] = { ...rows[idx], ...metric, id: rows[idx].id, created_at: rows[idx].created_at };
  else rows.push(metric);
}

async function syncMetaAdInsights(
  ctx: SocialHubRoutesContext,
  workspaceId: string,
  accounts: DbSocialAdAccount[],
  rows: DbSocialAdMetric[],
  since: string,
  until: string,
) {
  const connection = findConnection(ctx.db, 'meta', workspaceId);
  const token = connection ? safeToken(connection.access_token) : '';
  if (!token) return;
  for (const account of accounts) {
    if (account.provider !== 'meta') continue;
    try {
      const params = new URLSearchParams({
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions',
        level: 'campaign',
        time_increment: '1',
        time_range: JSON.stringify({ since, until }),
        access_token: token,
      });
      const data = await fetchJson(`https://graph.facebook.com/${metaVersion()}/${encodeURIComponent(account.ad_account_id)}/insights?${params.toString()}`);
      for (const item of data.data || []) {
        const date = sanitizeString(item.date_start || since, 20);
        const leads = Array.isArray(item.actions)
          ? item.actions.filter((a: any) => /lead/i.test(String(a.action_type || ''))).reduce((sum: number, a: any) => sum + Number(a.value || 0), 0)
          : 0;
        const spend = Number(item.spend || 0);
        const impressions = Number(item.impressions || 0);
        const clicks = Number(item.clicks || 0);
        upsertMetricRow(rows, {
          id: ctx.newId('social-metric'),
          workspace_id: workspaceId,
          brand_id: sanitizeString(account.brand_id || '', 80) || undefined,
          provider: 'meta',
          ad_account_id: account.ad_account_id,
          campaign_id: sanitizeString(item.campaign_id || '', 120),
          campaign_name: sanitizeString(item.campaign_name || 'Campaign', 220),
          date,
          spend,
          impressions,
          clicks,
          ctr: Number(item.ctr || 0),
          cpc: Number(item.cpc || 0),
          leads,
          cost_per_lead: leads ? spend / leads : 0,
          created_at: nowIso(),
          updated_at: nowIso(),
        });
      }
      if (connection?.last_error && /meta ad insights failed/i.test(connection.last_error)) {
        connection.last_error = undefined;
        connection.updated_at = nowIso();
      }
    } catch (err) {
      if (connection) {
        connection.last_error = `Meta ad insights failed for ${account.ad_account_name || account.ad_account_id}: ${(err as Error).message}`;
        connection.updated_at = nowIso();
      }
    }
  }
}

async function syncLinkedInAdInsights(
  ctx: SocialHubRoutesContext,
  workspaceId: string,
  accounts: DbSocialAdAccount[],
  rows: DbSocialAdMetric[],
  since: string,
  until: string,
) {
  const connection = findConnection(ctx.db, 'linkedin', workspaceId);
  const token = connection ? safeToken(connection.access_token) : '';
  if (!token) return;
  const linkedinAccounts = accounts.filter(account => account.provider === 'linkedin');
  if (!linkedinAccounts.length) return;

  const campaignNameCache = new Map<string, string>();
  const dateRange = linkedInDateRangeParam(since, until);

  for (const account of linkedinAccounts) {
    const accountUrn = `urn:li:sponsoredAccount:${account.ad_account_id}`;
    try {
      // Prefer campaign pivot; fall back to account-level daily totals.
      let elements: any[] = [];
      let pivot: 'CAMPAIGN' | 'ACCOUNT' = 'CAMPAIGN';
      try {
        const url = `https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY&dateRange=${encodeURIComponent(dateRange)}&accounts=List(${encodeURIComponent(accountUrn)})&fields=dateRange,pivotValues,impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,costInUsd`;
        const data = await fetchJson(url, { headers: linkedinRestHeaders(token) });
        elements = data.elements || data.data || [];
      } catch {
        pivot = 'ACCOUNT';
        const url = `https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=ACCOUNT&timeGranularity=DAILY&dateRange=${encodeURIComponent(dateRange)}&accounts=List(${encodeURIComponent(accountUrn)})&fields=dateRange,pivotValues,impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,costInUsd`;
        const data = await fetchJson(url, { headers: linkedinRestHeaders(token) });
        elements = data.elements || data.data || [];
      }

      for (const item of elements) {
        const start = item?.dateRange?.start || {};
        const y = Number(start.year || 0);
        const m = Number(start.month || 0);
        const d = Number(start.day || 0);
        const date = y && m && d
          ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          : since;
        const pivotValue = Array.isArray(item.pivotValues) ? String(item.pivotValues[0] || '') : '';
        const campaignId = pivot === 'CAMPAIGN'
          ? sanitizeString(pivotValue.replace(/^urn:li:sponsoredCampaign:/, '') || pivotValue, 120)
          : account.ad_account_id;
        let campaignName = pivot === 'ACCOUNT'
          ? sanitizeString(account.ad_account_name || 'LinkedIn account', 220)
          : campaignNameCache.get(campaignId) || '';
        if (pivot === 'CAMPAIGN' && campaignId && !campaignName) {
          try {
            const campaign = await fetchJson(`https://api.linkedin.com/rest/adCampaigns/${encodeURIComponent(campaignId)}`, {
              headers: linkedinRestHeaders(token),
            });
            campaignName = sanitizeString(campaign?.name || campaign?.campaignName || `Campaign ${campaignId}`, 220);
            campaignNameCache.set(campaignId, campaignName);
          } catch {
            campaignName = `Campaign ${campaignId}`;
            campaignNameCache.set(campaignId, campaignName);
          }
        }
        const spend = Number(item.costInLocalCurrency ?? item.costInUsd ?? 0) || 0;
        const impressions = Number(item.impressions || 0);
        const clicks = Number(item.clicks || 0);
        const leads = Number(item.oneClickLeads || item.externalWebsiteConversions || 0);
        upsertMetricRow(rows, {
          id: ctx.newId('social-metric'),
          workspace_id: workspaceId,
          brand_id: sanitizeString(account.brand_id || '', 80) || undefined,
          provider: 'linkedin',
          ad_account_id: account.ad_account_id,
          campaign_id: campaignId,
          campaign_name: campaignName || `Campaign ${campaignId}`,
          date,
          spend,
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          leads,
          cost_per_lead: leads ? spend / leads : 0,
          created_at: nowIso(),
          updated_at: nowIso(),
        });
      }
      if (connection?.last_error && /linkedin ad (accounts|insights)/i.test(connection.last_error)) {
        connection.last_error = undefined;
        connection.updated_at = nowIso();
      }
    } catch (err) {
      if (connection) {
        connection.last_error = `LinkedIn ad insights failed for ${account.ad_account_name || account.ad_account_id}: ${(err as Error).message}`;
        connection.updated_at = nowIso();
      }
    }
  }
}

/** Pull Meta + LinkedIn campaign metrics for mapped (and unmapped) ad accounts. Skips providers that are not connected. */
async function syncAds(ctx: SocialHubRoutesContext, req: express.Request) {
  const workspaceId = ctx.workspaceIdFor(req);
  const since = sanitizeString(req.query.since || '', 20) || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const until = sanitizeString(req.query.until || '', 20) || new Date().toISOString().slice(0, 10);
  const providerFilter = sanitizeString(req.query.provider || '', 40).toLowerCase();
  const accounts = (ctx.db.get().social_ad_accounts || []).filter(item => ctx.inWorkspace(item, workspaceId));
  const rows = ctx.db.get().social_ad_metrics = ctx.db.get().social_ad_metrics || [];

  const wantMeta = !providerFilter || providerFilter === 'meta';
  const wantLinkedIn = !providerFilter || providerFilter === 'linkedin';

  if (wantMeta) await syncMetaAdInsights(ctx, workspaceId, accounts, rows, since, until);
  if (wantLinkedIn) await syncLinkedInAdInsights(ctx, workspaceId, accounts, rows, since, until);
  ctx.db.save();
}

export function registerSocialHubRoutes(app: express.Express, ctx: SocialHubRoutesContext) {
  app.get('/api/social/settings', ctx.requireAuth, (req, res) => {
    const meta = providerConfig(req, ctx, 'meta');
    const linkedin = providerConfig(req, ctx, 'linkedin');
    res.json({
      providers: {
        meta: { configured: Boolean(meta.clientId && meta.clientSecret), redirect_uri: meta.redirectUri, scopes: meta.scopes },
        linkedin: {
          configured: Boolean(linkedin.clientId && linkedin.clientSecret),
          redirect_uri: linkedin.redirectUri,
          scopes: linkedin.scopes,
          organization_scopes_enabled: usesLinkedInOrgScopes(linkedin.scopes),
          organization_scopes_required: ['r_organization_social', 'w_organization_social'],
        },
      },
    });
  });

  app.get('/api/social/:provider/connect', ctx.requireAdmin, (req, res) => {
    const provider = cleanProvider(req.params.provider);
    const config = providerConfig(req, ctx, provider);
    if (!config.clientId || !config.clientSecret) {
      res.status(503).json({ detail: `${providerLabel(provider)} connection is not configured on the server yet.` });
      return;
    }
    // Absolute SPA return (Vercel) so callback on Render can bounce the browser back — same pattern as Gmail.
    const returnTo = extractSocialReturnTo(req, ctx);
    const state = encodeState({
      workspace_id: ctx.workspaceIdFor(req),
      user_id: req.user?.id,
      provider,
      return_to: returnTo,
      created_at: Date.now(),
    }, provider, config.clientSecret);
    if (provider === 'linkedin') {
      const params = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri, state, scope: config.scopes.join(' ') });
      res.json({ auth_url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`, redirect_uri: config.redirectUri });
      return;
    }
    const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, state, scope: config.scopes.join(','), response_type: 'code' });
    res.json({ auth_url: `https://www.facebook.com/${metaVersion()}/dialog/oauth?${params.toString()}`, redirect_uri: config.redirectUri });
  });

  app.get('/api/social/:provider/callback', async (req, res) => {
    const provider = cleanProvider(req.params.provider);
    let returnHint = socialSanitizeReturnTo(ctx, peekSocialReturnTo(req.query.state), '/');
    try {
      const config = providerConfig(req, ctx, provider);
      if (!config.clientId || !config.clientSecret) throw new Error(`${providerLabel(provider)} is not configured.`);
      const state = decodeState(req.query.state, provider, config.clientSecret);
      returnHint = socialSanitizeReturnTo(ctx, state.return_to || returnHint, '/');
      const workspaceId = sanitizeString(state.workspace_id, 120);
      if (req.query.error) {
        const detail = sanitizeString(req.query.error_description || req.query.error, 900);
        if (provider === 'linkedin' && /w_organization_social|r_organization_social|not authorized/i.test(detail)) {
          throw new Error('LinkedIn has not approved company-page publishing for this app yet. Connect can work now with the basic LinkedIn scopes, then enable organization scopes after LinkedIn grants r_organization_social and w_organization_social.');
        }
        throw new Error(detail || `${providerLabel(provider)} did not authorize the connection.`);
      }
      const code = sanitizeString(req.query.code, 4000);
      if (!code) throw new Error(`${providerLabel(provider)} did not return an authorization code. Check the redirect URL and requested scopes.`);
      const token = provider === 'linkedin'
        ? await exchangeLinkedInToken(req, ctx, code)
        : await exchangeMetaToken(req, ctx, code);
      const connection = upsertConnection(ctx, {
        id: ctx.newId('social-conn'),
        workspace_id: workspaceId,
        user_id: sanitizeString(state.user_id, 120),
        provider,
        access_token: safeEncrypt(token.accessToken),
        refresh_or_long_lived_token: safeEncrypt((token as any).refreshToken || token.accessToken),
        expires_at: new Date(Date.now() + Number(token.expiresIn || 0) * 1000).toISOString(),
        connected_name: providerLabel(provider),
        connected_email: '',
        status: 'connected',
        created_at: nowIso(),
        updated_at: nowIso(),
      });
      if (provider === 'linkedin') await syncLinkedInAssets(ctx, workspaceId, connection);
      else {
        await syncMetaProfile(connection);
        await syncMetaAssets(ctx, workspaceId, connection);
      }
      ctx.db.save();
      const successUrl = escapeSocialRedirectHtml(socialBuildReturnUrl(
        req,
        ctx,
        returnHint && returnHint !== '/' ? returnHint : '/?tab=social-hub',
        `social=${provider}&social_status=success`,
      ));
      res.send(`<!doctype html><html><head><title>Social Hub connected</title><meta http-equiv="refresh" content="1;url=${successUrl}" /></head><body style="font-family:Arial,sans-serif;padding:32px"><h2>${providerLabel(provider)} connected</h2><p>Returning you to Social Hub...</p><p><a href="${successUrl}">Back to CRM</a></p></body></html>`);
    } catch (err) {
      const errorUrl = escapeSocialRedirectHtml(socialBuildReturnUrl(req, ctx, returnHint, `social=${provider}&social_status=error`));
      res.status(400).send(`<!doctype html><html><head><title>Connection failed</title><meta http-equiv="refresh" content="3;url=${errorUrl}" /></head><body style="font-family:Arial,sans-serif;padding:32px"><h2>Connection could not be completed</h2><p>${sanitizeString((err as Error).message, 900)}</p><p><a href="${errorUrl}">Back to CRM</a></p></body></html>`);
    }
  });

  app.post('/api/social/meta/deauthorize', (req, res) => {
    try {
      const config = providerConfig(req, ctx, 'meta');
      if (!config.clientSecret) throw new Error('Meta app secret is not configured.');
      const payload = decodeMetaSignedRequest(req.body?.signed_request || req.query.signed_request, config.clientSecret);
      const metaUserId = sanitizeString(payload.user_id || payload.user?.id, 180);
      if (!metaUserId) {
        res.json({ success: true, disconnected: 0 });
        return;
      }
      const rows = ctx.db.get().social_connections || [];
      let disconnected = 0;
      for (const connection of rows) {
        if (connection.provider !== 'meta') continue;
        if (connection.provider_user_id !== metaUserId) continue;
        connection.status = 'not_connected';
        connection.access_token = '';
        connection.refresh_or_long_lived_token = '';
        connection.expires_at = '';
        connection.last_error = metaUserId ? 'Meta access was removed by the connected user.' : 'Meta access was removed.';
        connection.updated_at = nowIso();
        disconnected += 1;
      }
      if (disconnected) ctx.db.save();
      res.json({ success: true, disconnected });
    } catch (err) {
      res.status(400).json({ success: false, detail: sanitizeString((err as Error).message, 400) });
    }
  });

  app.get('/api/social/accounts', ctx.requireAuth, (req, res) => res.json(summarize(ctx, req)));
  app.get('/api/social/pages', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const user = req.user || null;
    const isAdmin = Boolean(ctx.isAdminUser?.(user));
    const pages = (ctx.db.get().social_pages || []).filter(item => ctx.inWorkspace(item, workspaceId) && !String(item.page_id || '').startsWith('person:'));
    const accessiblePages = isAdmin
      ? pages
      : pages.filter(page => {
          if (!page.brand_id) return false;
          if (!ctx.hasBrandAccess || !user) return Boolean(page.brand_id);
          return ctx.hasBrandAccess(user, page.brand_id);
        });
    res.json({ pages: accessiblePages.map(publicPage) });
  });

  /** Map a connected Facebook/LinkedIn page to a CRM brand (portfolio). */
  app.patch('/api/social/pages/:id/brand', ctx.requireAuth, (req, res) => {
    const id = sanitizeString(req.params.id, 80);
    const brandId = sanitizeString(req.body?.brand_id || '', 80);
    const workspaceId = ctx.workspaceIdFor(req);
    const page = (ctx.db.get().social_pages || []).find(p => p.id === id && ctx.inWorkspace(p, workspaceId));
    if (!page) { res.status(404).json({ detail: 'Page not found.' }); return; }
    page.brand_id = brandId || '';
    page.updated_at = nowIso();
    ctx.db.save();
    res.json(publicPage(page));
  });

  /** Map a connected ad account to a CRM brand for spend/CPL reporting. */
  app.patch('/api/social/ad-accounts/:id/brand', ctx.requireAuth, (req, res) => {
    const id = sanitizeString(req.params.id, 80);
    const brandId = sanitizeString(req.body?.brand_id || '', 80);
    const workspaceId = ctx.workspaceIdFor(req);
    const account = (ctx.db.get().social_ad_accounts || []).find(a => a.id === id && ctx.inWorkspace(a, workspaceId));
    if (!account) { res.status(404).json({ detail: 'Ad account not found.' }); return; }
    account.brand_id = brandId || '';
    account.updated_at = nowIso();
    (ctx.db.get().social_ad_metrics || []).forEach(m => {
      if (m.ad_account_id === account.ad_account_id && ctx.inWorkspace(m, workspaceId)) {
        m.brand_id = brandId || m.brand_id;
        m.updated_at = nowIso();
      }
    });
    ctx.db.save();
    res.json({
      id: account.id,
      brand_id: account.brand_id,
      ad_account_id: account.ad_account_id,
      ad_account_name: account.ad_account_name,
      provider: account.provider,
      status: account.status,
      currency: account.currency,
    });
  });

  app.post('/api/social/pages/disconnect', ctx.requireAdmin, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const provider = cleanProvider(req.body?.provider);
    const pageId = sanitizeString(req.body?.page_id, 160);
    const pages = ctx.db.get().social_pages || [];
    const page = pages.find(item => item.provider === provider && item.page_id === pageId && ctx.inWorkspace(item, workspaceId));
    if (!page) { res.status(404).json({ detail: 'Social page not found.' }); return; }
    page.status = 'not_connected';
    page.updated_at = nowIso();
    ctx.db.save();
    res.json({ success: true, page: publicPage(page) });
  });

  app.post('/api/social/ad-accounts/:id/connect', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const id = sanitizeString(req.params.id, 80);
    const accounts = ctx.db.get().social_ad_accounts || [];
    const account = accounts.find(a => a.id === id && ctx.inWorkspace(a, workspaceId));
    if (!account) { res.status(404).json({ detail: 'Ad account not found.' }); return; }
    account.status = 'connected';
    account.updated_at = nowIso();
    ctx.db.save();
    res.json({
      id: account.id,
      status: account.status,
      ad_account_id: account.ad_account_id,
      ad_account_name: account.ad_account_name,
      provider: account.provider,
      brand_id: account.brand_id,
      currency: account.currency,
    });
  });

  app.post('/api/social/:provider/sync', ctx.requireAdmin, async (req, res) => {
    const provider = cleanProvider(req.params.provider);
    const workspaceId = ctx.workspaceIdFor(req);
    const connection = findConnection(ctx.db, provider, workspaceId);
    if (!connection) { res.status(404).json({ detail: `${providerLabel(provider)} is not connected yet.` }); return; }
    try {
      if (provider === 'linkedin') await syncLinkedInAssets(ctx, workspaceId, connection);
      else await syncMetaAssets(ctx, workspaceId, connection);
      ctx.db.save();
      res.json(summarize(ctx, req));
    } catch (err) {
      connection.status = 'needs_attention';
      connection.last_error = sanitizeString((err as Error).message, 800);
      connection.updated_at = nowIso();
      ctx.db.save();
      res.status(400).json({ detail: connection.last_error });
    }
  });

  app.post('/api/social/media/upload', ctx.requireAuth, async (req, res) => {
    try {
      const workspaceId = ctx.workspaceIdFor(req);
      const name = sanitizeString(req.body?.name || 'social-media', 180).replace(/[^a-z0-9._-]+/gi, '-');
      const mimeType = sanitizeString(req.body?.mime_type || '', 100);
      const dataUrl = String(req.body?.data_url || '');
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error('Choose a valid image or video file.');
      const detectedMime = sanitizeString(match[1] || mimeType, 100);
      if (!/^image\/(jpeg|jpg|png|webp|gif)$|^video\/(mp4|quicktime)$/i.test(detectedMime)) {
        throw new Error('Use JPG, PNG, WEBP, GIF, MP4, or MOV media.');
      }
      const buffer = Buffer.from(match[2], 'base64');
      const maxBytes = Number(process.env.SOCIAL_UPLOAD_MAX_BYTES || 12 * 1024 * 1024);
      if (!buffer.length || buffer.length > maxBytes) throw new Error(`Media must be smaller than ${Math.floor(maxBytes / 1024 / 1024)}MB.`);
      const fileName = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}-${name.replace(/\.[^.]+$/, '')}.${extensionFromMime(detectedMime)}`;
      const url = await uploadSocialMedia(req, ctx, workspaceId, fileName, detectedMime, buffer);
      res.status(201).json({
        url,
        name,
        mime_type: detectedMime,
        size: buffer.length,
      });
    } catch (err) {
      res.status(400).json({ detail: sanitizeString((err as Error).message, 600) });
    }
  });

  app.post('/api/social/posts/draft', ctx.requireAuth, (req, res) => {
    try {
      const post = createPostFromBody(ctx, req, 'draft');
      ctx.db.get().social_posts = ctx.db.get().social_posts || [];
      ctx.db.get().social_posts!.push(post);
      ctx.db.save();
      res.status(201).json(post);
    } catch (err) {
      res.status(400).json({ detail: sanitizeString((err as Error).message, 600) });
    }
  });

  app.post('/api/social/posts/schedule', ctx.requireAuth, (req, res) => {
    try {
      const post = createPostFromBody(ctx, req, 'scheduled');
      if (!post.scheduled_for) throw new Error('Choose a schedule date and time.');
      ctx.db.get().social_posts = ctx.db.get().social_posts || [];
      ctx.db.get().social_posts!.push(post);
      ctx.db.save();
      res.status(201).json(post);
    } catch (err) {
      res.status(400).json({ detail: sanitizeString((err as Error).message, 600) });
    }
  });

  app.post('/api/social/posts/publish', ctx.requireAuth, async (req, res) => {
    try {
      const isAdmin = req.user?.role === 'admin' || ['superadmin', 'owner'].includes(String((req.user as any)?.platform_role || ''));
      // Non-admins cannot go live directly — they submit for approval (Phase 2).
      if (!isAdmin) {
        const post = createPostFromBody(ctx, req, 'pending_approval');
        post.approval_requested_by = req.user?.id;
        post.approval_requested_by_name = req.user?.name;
        post.approval_requested_at = nowIso();
        ctx.db.get().social_posts = ctx.db.get().social_posts || [];
        ctx.db.get().social_posts!.push(post);
        ctx.db.save();
        res.status(201).json(post);
        return;
      }
      const post = createPostFromBody(ctx, req, 'publishing');
      ctx.db.get().social_posts = ctx.db.get().social_posts || [];
      ctx.db.get().social_posts!.push(post);
      ctx.db.save();
      const published = await publishSocialPost(ctx, post);
      res.status(published?.status === 'failed' ? 400 : 201).json(published);
    } catch (err) {
      res.status(400).json({ detail: sanitizeString((err as Error).message, 600) });
    }
  });

  /** Agent submits draft/schedule for admin approval. */
  app.post('/api/social/posts/submit-approval', ctx.requireAuth, (req, res) => {
    try {
      const post = createPostFromBody(ctx, req, 'pending_approval');
      post.approval_requested_by = req.user?.id;
      post.approval_requested_by_name = req.user?.name;
      post.approval_requested_at = nowIso();
      if (req.body?.scheduled_for) post.scheduled_for = new Date(req.body.scheduled_for).toISOString();
      ctx.db.get().social_posts = ctx.db.get().social_posts || [];
      ctx.db.get().social_posts!.push(post);
      ctx.db.save();
      res.status(201).json(post);
    } catch (err) {
      res.status(400).json({ detail: sanitizeString((err as Error).message, 600) });
    }
  });

  app.post('/api/social/posts/:id/approve', ctx.requireAdmin, async (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const post = (ctx.db.get().social_posts || []).find(item => item.id === req.params.id && ctx.inWorkspace(item, workspaceId));
    if (!post) { res.status(404).json({ detail: 'Social post not found.' }); return; }
    if (!['pending_approval', 'rejected', 'draft', 'failed'].includes(post.status)) {
      res.status(400).json({ detail: 'Only pending/rejected/draft/failed posts can be approved for publish.' });
      return;
    }
    post.approved_by = req.user?.id;
    post.approved_by_name = req.user?.name;
    post.approved_at = nowIso();
    post.rejection_reason = '';
    post.updated_at = nowIso();
    // If scheduled in the future, leave as scheduled; else publish now.
    if (post.scheduled_for && new Date(post.scheduled_for).getTime() > Date.now() + 60_000) {
      post.status = 'scheduled';
      ctx.db.save();
      res.json(post);
      return;
    }
    const published = await publishSocialPost(ctx, post);
    res.status(published?.status === 'failed' ? 400 : 200).json(published);
  });

  app.post('/api/social/posts/:id/reject', ctx.requireAdmin, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const post = (ctx.db.get().social_posts || []).find(item => item.id === req.params.id && ctx.inWorkspace(item, workspaceId));
    if (!post) { res.status(404).json({ detail: 'Social post not found.' }); return; }
    if (post.status !== 'pending_approval') {
      res.status(400).json({ detail: 'Only pending posts can be rejected.' });
      return;
    }
    post.status = 'rejected';
    post.rejection_reason = sanitizeString(req.body?.reason || 'Needs changes', 500);
    post.updated_at = nowIso();
    ctx.db.save();
    res.json(post);
  });

  app.get('/api/social/posts', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const brandId = sanitizeString(req.query.brand_id, 80);
    const provider = sanitizeString(req.query.provider, 40);
    const status = sanitizeString(req.query.status, 40);
    const sinceDays = Math.max(0, Math.min(3650, Number(req.query.since_days || 0) || 0));
    const sinceTime = sinceDays ? Date.now() - sinceDays * 24 * 60 * 60 * 1000 : 0;
    const posts = (ctx.db.get().social_posts || [])
      .filter(item => ctx.inWorkspace(item, workspaceId))
      .filter(item => !brandId || item.brand_id === brandId)
      .filter(item => !provider || item.provider === provider)
      .filter(item => !status || item.status === status)
      .filter(item => {
        if (!sinceTime) return true;
        const dateValue = Date.parse(String(item.scheduled_for || item.published_at || item.updated_at || item.created_at || ''));
        return Number.isFinite(dateValue) && dateValue >= sinceTime;
      })
      .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    res.json({ posts });
  });

  app.get('/api/social/calendar', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const posts = (ctx.db.get().social_posts || [])
      .filter(item => ctx.inWorkspace(item, workspaceId))
      .sort((a, b) => String(a.scheduled_for || a.published_at || a.created_at).localeCompare(String(b.scheduled_for || b.published_at || b.created_at)));
    res.json({ posts });
  });

  app.put('/api/social/posts/:id', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const post = (ctx.db.get().social_posts || []).find(item => item.id === req.params.id && ctx.inWorkspace(item, workspaceId));
    if (!post) { res.status(404).json({ detail: 'Social post not found.' }); return; }
    if (post.status === 'published') { res.status(400).json({ detail: 'Published posts cannot be edited from the CRM.' }); return; }
    post.caption = req.body?.caption !== undefined ? sanitizeString(req.body.caption, 12000) : post.caption;
    post.media_urls = req.body?.media_urls !== undefined ? (Array.isArray(req.body.media_urls) ? req.body.media_urls : String(req.body.media_urls).split(',')).map((item: unknown) => sanitizeString(item, 900)).filter(Boolean) : post.media_urls;
    post.scheduled_for = req.body?.scheduled_for ? new Date(req.body.scheduled_for).toISOString() : post.scheduled_for;
    post.status = req.body?.status ? sanitizeString(req.body.status, 40) : post.status;
    post.updated_at = nowIso();
    ctx.db.save();
    res.json(post);
  });

  app.delete('/api/social/posts/clear', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const status = sanitizeString(req.query.status || 'published', 40);
    const brandId = sanitizeString(req.query.brand_id, 80);
    const provider = sanitizeString(req.query.provider, 40);
    const before = ctx.db.get().social_posts || [];
    const kept = before.filter(item => {
      const matches = ctx.inWorkspace(item, workspaceId) &&
        item.status === status &&
        (!brandId || item.brand_id === brandId) &&
        (!provider || item.provider === provider);
      return !matches;
    });
    ctx.db.get().social_posts = kept;
    ctx.db.save();
    res.json({ success: true, removed: before.length - kept.length });
  });

  app.delete('/api/social/posts/:id', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const post = (ctx.db.get().social_posts || []).find(item => item.id === req.params.id && ctx.inWorkspace(item, workspaceId));
    if (!post) { res.status(404).json({ detail: 'Social post not found.' }); return; }
    if (req.query.mode === 'remove' || post.status === 'published' || post.status === 'cancelled') {
      ctx.db.get().social_posts = (ctx.db.get().social_posts || []).filter(item => !(item.id === req.params.id && ctx.inWorkspace(item, workspaceId)));
      ctx.db.save();
      res.json({ success: true, removed: true });
      return;
    }
    post.status = 'cancelled';
    post.updated_at = nowIso();
    ctx.db.save();
    res.json({ success: true, post });
  });

  app.post('/api/social/posts/:id/retry', ctx.requireAuth, async (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const post = (ctx.db.get().social_posts || []).find(item => item.id === req.params.id && ctx.inWorkspace(item, workspaceId));
    if (!post) { res.status(404).json({ detail: 'Social post not found.' }); return; }
    const result = await publishSocialPost(ctx, post);
    res.status(result?.status === 'failed' ? 400 : 200).json(result);
  });

  app.get('/api/social/ads/metrics', ctx.requireAuth, async (req, res) => {
    try {
      await syncAds(ctx, req);
    } catch (err) {
      // Never fail the whole Ads tab if one provider is missing — return cached metrics.
      console.warn('[social] ads metrics sync warning:', (err as Error).message);
    }
    const workspaceId = ctx.workspaceIdFor(req);
    const brandId = sanitizeString(req.query.brand_id, 80);
    const provider = sanitizeString(req.query.provider, 40);
    const adAccountId = sanitizeString(req.query.ad_account_id, 140);
    const metrics = (ctx.db.get().social_ad_metrics || [])
      .filter(item => ctx.inWorkspace(item, workspaceId))
      .filter(item => !brandId || item.brand_id === brandId)
      .filter(item => !provider || item.provider === provider)
      .filter(item => !adAccountId || item.ad_account_id === adAccountId)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    res.json({ metrics });
  });

  /**
   * Phase 2: Ads platform "leads" vs CRM leads that look social-sourced.
   * Helps operators see truth gap between Meta lead counts and CRM pipeline.
   */
  app.get('/api/social/ads/attribution', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const brandId = sanitizeString(req.query.brand_id, 80).toLowerCase();
    const days = Math.max(1, Math.min(365, Number(req.query.days || 30) || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceKey = since.toISOString().slice(0, 10);
    const sinceMs = since.getTime();

    const metrics = (ctx.db.get().social_ad_metrics || [])
      .filter(item => ctx.inWorkspace(item, workspaceId))
      .filter(item => !brandId || item.brand_id === brandId)
      .filter(item => !item.date || item.date >= sinceKey);

    const adSpend = metrics.reduce((s, m) => s + Number(m.spend || 0), 0);
    const adLeads = metrics.reduce((s, m) => s + Number(m.leads || 0), 0);
    const adCpl = adLeads > 0 ? adSpend / adLeads : 0;

    const socialSourceRe = /facebook|meta|instagram|linkedin|social|paid.?social|fb\b|ig\b/i;
    const leads = (ctx.db.get().leads || []).filter(lead => {
      if (brandId && lead.brand_id !== brandId) return false;
      if (!ctx.brandInWorkspace(lead.brand_id, workspaceId)) return false;
      const created = Date.parse(String(lead.created_at || ''));
      if (!Number.isFinite(created) || created < sinceMs) return false;
      const hay = [
        lead.custom_fields?.source,
        lead.custom_fields?.lead_source,
        lead.custom_fields?.source_name,
        lead.custom_fields?.utm_source,
        lead.custom_fields?.utm_medium,
        lead.custom_fields?.channel,
        (lead as any).source,
      ].map(v => String(v || '')).join(' ');
      return socialSourceRe.test(hay);
    });

    const crmSocialLeads = leads.length;
    const verified = leads.filter(l => String((l as any).lead_classification || 'verified') !== 'prospect').length;
    const crmCpl = crmSocialLeads > 0 ? adSpend / crmSocialLeads : 0;
    const gap = adLeads - crmSocialLeads;

    const byBrand = new Map<string, { brand_id: string; ad_spend: number; ad_leads: number; crm_social_leads: number; verified: number }>();
    for (const m of metrics) {
      const bid = m.brand_id || '_unmapped';
      const row = byBrand.get(bid) || { brand_id: bid, ad_spend: 0, ad_leads: 0, crm_social_leads: 0, verified: 0 };
      row.ad_spend += Number(m.spend || 0);
      row.ad_leads += Number(m.leads || 0);
      byBrand.set(bid, row);
    }
    for (const lead of leads) {
      const bid = lead.brand_id || '_unmapped';
      const row = byBrand.get(bid) || { brand_id: bid, ad_spend: 0, ad_leads: 0, crm_social_leads: 0, verified: 0 };
      row.crm_social_leads += 1;
      if (String((lead as any).lead_classification || 'verified') !== 'prospect') row.verified += 1;
      byBrand.set(bid, row);
    }

    res.json({
      days,
      brand_id: brandId || null,
      summary: {
        ad_spend: Math.round(adSpend * 100) / 100,
        ad_leads: adLeads,
        ad_cpl: Math.round(adCpl * 100) / 100,
        crm_social_leads: crmSocialLeads,
        crm_verified_social_leads: verified,
        crm_cpl: Math.round(crmCpl * 100) / 100,
        lead_gap: gap,
        note: gap > 0
          ? 'Ads report more leads than CRM social-sourced leads — check form sync / source fields.'
          : gap < 0
            ? 'CRM has more social-tagged leads than ads reported — sources may be broader than paid.'
            : 'Ads lead count aligns with CRM social-sourced leads for this window.',
      },
      by_brand: Array.from(byBrand.values()).map(row => ({
        ...row,
        ad_spend: Math.round(row.ad_spend * 100) / 100,
        ad_cpl: row.ad_leads ? Math.round((row.ad_spend / row.ad_leads) * 100) / 100 : 0,
        crm_cpl: row.crm_social_leads ? Math.round((row.ad_spend / row.crm_social_leads) * 100) / 100 : 0,
      })),
    });
  });

  // ── Content templates (brand caption + hashtag packs) ─────────────────────
  app.get('/api/social/templates', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const brandId = sanitizeString(req.query.brand_id, 80).toLowerCase();
    const rows = ((ctx.db.get() as any).social_content_templates || []) as DbSocialContentTemplate[];
    const templates = rows
      .filter(t => !t.workspace_id || t.workspace_id === workspaceId)
      .filter(t => !brandId || t.brand_id === brandId)
      .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    res.json({ templates });
  });

  app.post('/api/social/templates', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const brandId = sanitizeString(req.body?.brand_id, 80).toLowerCase();
    if (!brandId || !ctx.brandInWorkspace(brandId, workspaceId)) {
      res.status(400).json({ detail: 'Choose a valid brand for this template.' });
      return;
    }
    const name = sanitizeString(req.body?.name || 'Untitled template', 120);
    const caption = sanitizeString(req.body?.caption || '', 12000);
    const hashtagsRaw = Array.isArray(req.body?.hashtags)
      ? req.body.hashtags
      : String(req.body?.hashtags || '').split(/[\s,]+/);
    const hashtags = hashtagsRaw
      .map((h: unknown) => sanitizeString(h, 80).replace(/^#/, ''))
      .filter(Boolean)
      .map((h: string) => (h.startsWith('#') ? h : h));
    const template: DbSocialContentTemplate = {
      id: ctx.newId('social-tpl'),
      workspace_id: workspaceId,
      brand_id: brandId,
      name,
      caption,
      hashtags,
      created_by: req.user?.id,
      created_by_name: req.user?.name,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    const store = (ctx.db.get() as any);
    store.social_content_templates = store.social_content_templates || [];
    store.social_content_templates.push(template);
    ctx.db.save();
    res.status(201).json(template);
  });

  app.put('/api/social/templates/:id', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const store = (ctx.db.get() as any);
    const rows = (store.social_content_templates || []) as DbSocialContentTemplate[];
    const tpl = rows.find(t => t.id === req.params.id && (!t.workspace_id || t.workspace_id === workspaceId));
    if (!tpl) { res.status(404).json({ detail: 'Template not found.' }); return; }
    if (req.body?.name !== undefined) tpl.name = sanitizeString(req.body.name, 120);
    if (req.body?.caption !== undefined) tpl.caption = sanitizeString(req.body.caption, 12000);
    if (req.body?.hashtags !== undefined) {
      const hashtagsRaw = Array.isArray(req.body.hashtags) ? req.body.hashtags : String(req.body.hashtags || '').split(/[\s,]+/);
      tpl.hashtags = hashtagsRaw.map((h: unknown) => sanitizeString(h, 80).replace(/^#/, '')).filter(Boolean);
    }
    if (req.body?.brand_id !== undefined) {
      const brandId = sanitizeString(req.body.brand_id, 80).toLowerCase();
      if (brandId && ctx.brandInWorkspace(brandId, workspaceId)) tpl.brand_id = brandId;
    }
    tpl.updated_at = nowIso();
    ctx.db.save();
    res.json(tpl);
  });

  app.delete('/api/social/templates/:id', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const store = (ctx.db.get() as any);
    const before = (store.social_content_templates || []) as DbSocialContentTemplate[];
    store.social_content_templates = before.filter(t => !(t.id === req.params.id && (!t.workspace_id || t.workspace_id === workspaceId)));
    ctx.db.save();
    res.json({ success: true, removed: before.length - store.social_content_templates.length });
  });

  // ── Brand budgets + CPL alerts ────────────────────────────────────────────
  app.get('/api/social/budgets', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const brandId = sanitizeString(req.query.brand_id, 80).toLowerCase();
    const rows = ((ctx.db.get() as any).social_brand_budgets || []) as DbSocialBrandBudget[];
    const budgets = rows
      .filter(b => !b.workspace_id || b.workspace_id === workspaceId)
      .filter(b => !brandId || b.brand_id === brandId);
    res.json({ budgets });
  });

  app.put('/api/social/budgets/:brand_id', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const brandId = sanitizeString(req.params.brand_id, 80).toLowerCase();
    if (!brandId || !ctx.brandInWorkspace(brandId, workspaceId)) {
      res.status(400).json({ detail: 'Invalid brand.' });
      return;
    }
    const monthly = Math.max(0, Number(req.body?.monthly_budget || 0) || 0);
    const cplAlert = Math.max(0, Number(req.body?.cpl_alert_threshold || 0) || 0);
    const currency = sanitizeString(req.body?.currency || 'USD', 12) || 'USD';
    const store = (ctx.db.get() as any);
    store.social_brand_budgets = store.social_brand_budgets || [];
    const rows = store.social_brand_budgets as DbSocialBrandBudget[];
    let row = rows.find(b => b.brand_id === brandId && (!b.workspace_id || b.workspace_id === workspaceId));
    if (row) {
      row.monthly_budget = monthly;
      row.cpl_alert_threshold = cplAlert;
      row.currency = currency;
      row.updated_at = nowIso();
    } else {
      row = {
        id: ctx.newId('social-budget'),
        workspace_id: workspaceId,
        brand_id: brandId,
        monthly_budget: monthly,
        cpl_alert_threshold: cplAlert,
        currency,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      rows.push(row);
    }
    ctx.db.save();
    res.json(row);
  });

  /** Compute spend-vs-budget and CPL alerts for the current month (or N days). */
  app.get('/api/social/ads/alerts', ctx.requireAuth, (req, res) => {
    const workspaceId = ctx.workspaceIdFor(req);
    const brandId = sanitizeString(req.query.brand_id, 80).toLowerCase();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthKey = monthStart.toISOString().slice(0, 10);

    const budgets = (((ctx.db.get() as any).social_brand_budgets || []) as DbSocialBrandBudget[])
      .filter(b => !b.workspace_id || b.workspace_id === workspaceId)
      .filter(b => !brandId || b.brand_id === brandId);

    const metrics = (ctx.db.get().social_ad_metrics || [])
      .filter(m => ctx.inWorkspace(m, workspaceId))
      .filter(m => !brandId || m.brand_id === brandId)
      .filter(m => !m.date || m.date >= monthKey);

    const spendByBrand = new Map<string, { spend: number; leads: number }>();
    for (const m of metrics) {
      const bid = m.brand_id || '_unmapped';
      const cur = spendByBrand.get(bid) || { spend: 0, leads: 0 };
      cur.spend += Number(m.spend || 0);
      cur.leads += Number(m.leads || 0);
      spendByBrand.set(bid, cur);
    }

    const alerts: Array<{
      type: string;
      severity: 'info' | 'warning' | 'critical';
      brand_id: string;
      message: string;
      spend?: number;
      budget?: number;
      pct?: number;
      cpl?: number;
      threshold?: number;
    }> = [];

    for (const budget of budgets) {
      const stats = spendByBrand.get(budget.brand_id) || { spend: 0, leads: 0 };
      const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;
      if (budget.monthly_budget > 0) {
        const pct = (stats.spend / budget.monthly_budget) * 100;
        if (pct >= 100) {
          alerts.push({
            type: 'budget_exceeded',
            severity: 'critical',
            brand_id: budget.brand_id,
            message: `Monthly ad budget exceeded (${Math.round(pct)}% of ${budget.monthly_budget}).`,
            spend: stats.spend,
            budget: budget.monthly_budget,
            pct,
          });
        } else if (pct >= 80) {
          alerts.push({
            type: 'budget_warning',
            severity: 'warning',
            brand_id: budget.brand_id,
            message: `Ad spend at ${Math.round(pct)}% of monthly budget.`,
            spend: stats.spend,
            budget: budget.monthly_budget,
            pct,
          });
        }
      }
      if (budget.cpl_alert_threshold > 0 && stats.leads > 0 && cpl > budget.cpl_alert_threshold) {
        alerts.push({
          type: 'cpl_high',
          severity: 'warning',
          brand_id: budget.brand_id,
          message: `CPL $${cpl.toFixed(2)} is above alert threshold $${budget.cpl_alert_threshold.toFixed(2)}.`,
          cpl,
          threshold: budget.cpl_alert_threshold,
          spend: stats.spend,
        });
      }
    }

    res.json({
      month_start: monthKey,
      alerts,
      budgets,
      spend_by_brand: Array.from(spendByBrand.entries()).map(([brand_id, v]) => ({
        brand_id,
        spend: Math.round(v.spend * 100) / 100,
        leads: v.leads,
        cpl: v.leads ? Math.round((v.spend / v.leads) * 100) / 100 : 0,
      })),
    });
  });
}

export function startSocialPostScheduler(ctx: SocialHubRoutesContext) {
  const intervalMs = Math.max(30_000, Number(process.env.SOCIAL_SCHEDULER_INTERVAL_MS || 60_000));
  return setInterval(async () => {
    const due = (ctx.db.get().social_posts || [])
      .filter(post => post.status === 'scheduled' && post.scheduled_for && new Date(post.scheduled_for).getTime() <= Date.now())
      .slice(0, 10);
    for (const post of due) {
      await publishSocialPost(ctx, post);
    }
  }, intervalMs);
}
