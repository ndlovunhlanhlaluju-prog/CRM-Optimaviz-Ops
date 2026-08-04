import crypto from 'crypto';
import express from 'express';
import { LocalDb, DbWebsiteAnalyticsSite, DbWebsiteTrafficEvent } from '../../src/db/server_db.js';

function sanitizeString(val: unknown, maxLen = 500): string {
  if (val === undefined || val === null) return '';
  return String(val).replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

interface WebsiteAnalyticsRoutesContext {
  db: LocalDb;
  requireAdmin: express.RequestHandler;
  workspaceIdFor: (req: express.Request) => string;
  inWorkspace: <T extends { workspace_id?: string }>(item: T, workspaceId: string) => boolean;
  brandInWorkspace: (brandId: string, workspaceId: string) => boolean;
  newId: (prefix: string) => string;
  getPublicBaseUrl: (req: express.Request) => string;
}

function analyticsKey() {
  return `wa_${crypto.randomBytes(18).toString('base64url')}`;
}

function siteScriptUrl(req: express.Request, site: DbWebsiteAnalyticsSite, baseUrl: string) {
  return `${baseUrl}/api/analytics/script/${encodeURIComponent(site.id)}.js?key=${encodeURIComponent(site.public_key)}`;
}

function publicSite(req: express.Request, site: DbWebsiteAnalyticsSite, baseUrl: string) {
  return {
    ...site,
    script_url: siteScriptUrl(req, site, baseUrl),
    embed_code: `<script async src="${siteScriptUrl(req, site, baseUrl)}"></script>`,
  };
}

function parseDomain(value: unknown) {
  const raw = sanitizeString(value, 200).toLowerCase();
  if (!raw) return '';
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./, '');
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

function referrerDomain(value: unknown) {
  const raw = sanitizeString(value, 500);
  if (!raw) return 'Direct';
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return 'Other';
  }
}

function inferDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|iphone|android/.test(ua)) return 'mobile';
  return 'desktop';
}

function inferBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('chrome/')) return 'Chrome';
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
  if (ua.includes('firefox/')) return 'Firefox';
  return 'Other';
}

function countryFrom(req: express.Request, body: any) {
  return sanitizeString(
    body?.country ||
    req.get('cf-ipcountry') ||
    req.get('x-vercel-ip-country') ||
    req.get('x-country') ||
    'Unknown',
    80
  ) || 'Unknown';
}

function groupCount<T extends Record<string, any>>(rows: T[], key: keyof T, fallback = 'Unknown') {
  const counts = new Map<string, number>();
  rows.forEach(row => {
    const value = sanitizeString(row[key] || fallback, 180) || fallback;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

function dailyCounts(rows: DbWebsiteTrafficEvent[]) {
  const counts = new Map<string, number>();
  rows.forEach(row => {
    const date = (row.created_at || '').slice(0, 10) || 'Unknown';
    counts.set(date, (counts.get(date) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([date, visits]) => ({ date, visits })).sort((a, b) => a.date.localeCompare(b.date));
}

export function registerWebsiteAnalyticsRoutes(app: express.Express, ctx: WebsiteAnalyticsRoutesContext) {
  const { db, requireAdmin, workspaceIdFor, inWorkspace, brandInWorkspace, newId, getPublicBaseUrl } = ctx;

  app.get('/api/website-analytics/sites', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const brandId = sanitizeString(req.query.brand_id || '', 40);
    const baseUrl = getPublicBaseUrl(req);
    const sites = (db.get().website_analytics_sites || [])
      .filter(site => inWorkspace(site, workspaceId))
      .filter(site => !brandId || site.brand_id === brandId)
      .map(site => publicSite(req, site, baseUrl));
    res.json({ sites });
  });

  app.post('/api/website-analytics/sites', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const brandId = sanitizeString(req.body?.brand_id, 40).toLowerCase();
    if (!brandId || !brandInWorkspace(brandId, workspaceId)) { res.status(400).json({ detail: 'Choose a brand in this workspace first.' }); return; }
    const now = new Date().toISOString();
    const site: DbWebsiteAnalyticsSite = {
      id: newId('website-site'),
      workspace_id: workspaceId,
      brand_id: brandId,
      name: sanitizeString(req.body?.name || 'Website', 140),
      domain: parseDomain(req.body?.domain),
      status: 'active',
      public_key: analyticsKey(),
      created_by_user_id: req.user?.id,
      created_at: now,
      updated_at: now,
    };
    db.get().website_analytics_sites = db.get().website_analytics_sites || [];
    db.get().website_analytics_sites.push(site);
    db.save();
    res.status(201).json(publicSite(req, site, getPublicBaseUrl(req)));
  });

  app.put('/api/website-analytics/sites/:site_id', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const site = (db.get().website_analytics_sites || []).find(item => item.id === req.params.site_id && inWorkspace(item, workspaceId));
    if (!site) { res.status(404).json({ detail: 'Website analytics site not found.' }); return; }
    site.name = sanitizeString(req.body?.name || site.name, 140);
    site.domain = parseDomain(req.body?.domain || site.domain);
    site.status = sanitizeString(req.body?.status || site.status, 40);
    site.updated_at = new Date().toISOString();
    db.save();
    res.json(publicSite(req, site, getPublicBaseUrl(req)));
  });

  app.delete('/api/website-analytics/sites/:site_id', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const before = (db.get().website_analytics_sites || []).length;
    db.get().website_analytics_sites = (db.get().website_analytics_sites || []).filter(site => site.id !== req.params.site_id || !inWorkspace(site, workspaceId));
    if (db.get().website_analytics_sites!.length === before) { res.status(404).json({ detail: 'Website analytics site not found.' }); return; }
    db.save();
    res.json({ success: true });
  });

  app.get('/api/website-analytics/summary', requireAdmin, (req, res) => {
    const workspaceId = workspaceIdFor(req);
    const brandId = sanitizeString(req.query.brand_id || '', 40);
    const siteId = sanitizeString(req.query.site_id || '', 120);
    const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = (db.get().website_traffic_events || [])
      .filter(event => inWorkspace(event, workspaceId))
      .filter(event => !brandId || event.brand_id === brandId)
      .filter(event => !siteId || event.site_id === siteId)
      .filter(event => new Date(event.created_at).getTime() >= since);
    const sessions = new Set(rows.map(row => row.session_id).filter(Boolean));
    const convertedSessions = new Set(rows.filter(row => row.event_type === 'signup_completed' || row.lead_id).map(row => row.session_id).filter(Boolean));
    res.json({
      total_visits: rows.length,
      unique_visitors: sessions.size,
      conversions: convertedSessions.size,
      conversion_rate: sessions.size ? Math.round((convertedSessions.size / sessions.size) * 1000) / 10 : 0,
      by_date: dailyCounts(rows),
      by_country: groupCount(rows, 'country'),
      by_device: groupCount(rows, 'device'),
      by_source: groupCount(rows, 'referrer_domain', 'Direct'),
      top_pages: groupCount(rows, 'path', '/'),
      recent: rows.slice(-20).reverse(),
    });
  });

  app.get('/api/analytics/script/:site_id.js', (req, res) => {
    const siteId = sanitizeString(req.params.site_id.replace(/\.js$/i, ''), 120);
    const key = sanitizeString(req.query.key || '', 120);
    const site = (db.get().website_analytics_sites || []).find(item => item.id === siteId && item.public_key === key && item.status === 'active');
    if (!site) { res.status(404).type('application/javascript').send(''); return; }
    const collectUrl = `${getPublicBaseUrl(req)}/api/public/analytics/collect/${encodeURIComponent(site.id)}?key=${encodeURIComponent(site.public_key)}`;
    const js = `(function(){try{var sid="la_session_"+${JSON.stringify(site.id)};var vid="la_visitor_"+${JSON.stringify(site.id)};var s=localStorage.getItem(sid)||("s_"+Date.now()+"_"+Math.random().toString(36).slice(2));var v=localStorage.getItem(vid)||("v_"+Date.now()+"_"+Math.random().toString(36).slice(2));localStorage.setItem(sid,s);localStorage.setItem(vid,v);var send=function(type,extra){var body=Object.assign({event_type:type||"pageview",session_id:s,visitor_id:v,page_url:location.href,path:location.pathname,title:document.title,referrer:document.referrer,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},extra||{});navigator.sendBeacon?navigator.sendBeacon(${JSON.stringify(collectUrl)},new Blob([JSON.stringify(body)],{type:"application/json"})):fetch(${JSON.stringify(collectUrl)},{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),keepalive:true,mode:"cors"});};send("pageview");window.LujunalAnalytics={track:send,sessionId:s,visitorId:v};}catch(e){}})();`;
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(js);
  });

  app.options('/api/public/analytics/collect/:site_id', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
  });

  app.post('/api/public/analytics/collect/:site_id', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const site = (db.get().website_analytics_sites || []).find(item => item.id === req.params.site_id && item.public_key === sanitizeString(req.query.key || req.body?.key || '', 120));
    if (!site || site.status !== 'active') { res.status(404).json({ success: false }); return; }
    const now = new Date().toISOString();
    const userAgent = sanitizeString(req.get('user-agent') || '', 600);
    const pageUrl = sanitizeString(req.body?.page_url || '', 900);
    let path = sanitizeString(req.body?.path || '/', 240) || '/';
    try { if (pageUrl) path = new URL(pageUrl).pathname || path; } catch {}
    const event: DbWebsiteTrafficEvent = {
      id: newId('traffic'),
      workspace_id: site.workspace_id,
      brand_id: site.brand_id,
      site_id: site.id,
      session_id: sanitizeString(req.body?.session_id || req.body?.visitor_id || crypto.randomUUID(), 180),
      visitor_id: sanitizeString(req.body?.visitor_id || '', 180),
      page_url: pageUrl,
      path,
      title: sanitizeString(req.body?.title || '', 180),
      referrer: sanitizeString(req.body?.referrer || req.get('referer') || '', 900),
      referrer_domain: referrerDomain(req.body?.referrer || req.get('referer') || ''),
      country: countryFrom(req, req.body || {}),
      device: sanitizeString(req.body?.device || inferDevice(userAgent), 40),
      browser: sanitizeString(req.body?.browser || inferBrowser(userAgent), 60),
      event_type: sanitizeString(req.body?.event_type || 'pageview', 80),
      lead_id: sanitizeString(req.body?.lead_id || '', 120),
      metadata: {
        timezone: sanitizeString(req.body?.timezone || '', 120),
        language: sanitizeString(req.get('accept-language') || '', 180),
      },
      created_at: now,
    };
    db.get().website_traffic_events = db.get().website_traffic_events || [];
    db.get().website_traffic_events.push(event);
    site.last_seen_at = now;
    db.save();
    res.json({ success: true });
  });
}
