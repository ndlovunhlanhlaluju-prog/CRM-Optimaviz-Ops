import express from 'express';
import { describe, expect, it } from 'vitest';
import { registerLeadSourceRoutes } from './leadSourceRoutes';
import { registerWebsiteAnalyticsRoutes } from './websiteAnalyticsRoutes';

function makeDb() {
  const data: any = {
    users: [],
    brand_funnels: [],
    leads: [],
    notes: [],
    calls: [],
    emails: [],
    whatsapp: [],
    lead_sources: [
      {
        id: 'source_website',
        workspace_id: 'ops',
        brand_id: 'taskgo',
        name: 'TaskGo website',
        provider: 'website',
        status: 'active',
        secret_key: 'source_secret',
        field_mappings: {},
        default_stage: 'New Lead',
        duplicate_strategy: 'update_existing',
        unmapped_field_strategy: 'auto',
        leads_imported: 0,
        created_at: new Date().toISOString(),
      },
    ],
    lead_source_logs: [],
    website_analytics_sites: [
      {
        id: 'site_taskgo',
        workspace_id: 'ops',
        brand_id: 'taskgo',
        name: 'TaskGo website',
        domain: 'taskgo.example',
        status: 'active',
        public_key: 'analytics_secret',
        created_at: new Date().toISOString(),
      },
    ],
    website_traffic_events: [],
    custom_fields: [],
    enrollments: [],
    tasks: [],
    team_messages: [],
    audit_log: [],
  };
  return {
    get: () => data,
    save: () => undefined,
    data,
  };
}

function createApp(db: ReturnType<typeof makeDb>) {
  const app = express();
  app.use(express.json());
  const ctx = {
    db: db as any,
    requireAdmin: ((req: any, _res: any, next: any) => {
      req.user = { id: 'admin_1', role: 'admin' };
      next();
    }) as express.RequestHandler,
    workspaceIdFor: () => 'ops',
    inWorkspace: (item: any, workspaceId: string) => !item.workspace_id || item.workspace_id === workspaceId,
    brandInWorkspace: (brandId: string) => brandId === 'taskgo',
    workspaceLimitError: () => '',
    ensureBrandCustomFieldDefinitions: () => undefined,
    findExistingLeadByContact: (innerDb: any, email: string, phone: string, brandId: string, workspaceId?: string) => {
      return innerDb.get().leads.find((lead: any) => (
        (!workspaceId || !lead.workspace_id || lead.workspace_id === workspaceId) &&
        lead.brand_id === brandId &&
        ((email && lead.email === email) || (phone && lead.phone === phone))
      ));
    },
    newId: (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`,
    getPublicBaseUrl: () => 'https://crm.example',
  };
  registerLeadSourceRoutes(app, ctx as any);
  registerWebsiteAnalyticsRoutes(app, ctx as any);
  return app;
}

async function withServer<T>(app: express.Express, run: (baseUrl: string) => Promise<T>) {
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start test server');
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

describe('public website capture routes', () => {
  it('accepts browser preflight and captures partial then completed website leads', async () => {
    const db = makeDb();
    const app = createApp(db);

    await withServer(app, async baseUrl => {
      const preflight = await fetch(`${baseUrl}/api/public/leads/webhook/source_website`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://taskgo.example',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,x-lead-source-key',
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
      expect(preflight.headers.get('access-control-allow-headers') || '').toContain('X-Lead-Source-Key');

      const partial = await fetch(`${baseUrl}/api/public/leads/webhook/source_website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-lead-source-key': 'source_secret' },
        body: JSON.stringify({
          email: 'new-provider@example.com',
          session_id: 'signup_session_1',
          capture_status: 'partial',
          service_category: 'Cleaning',
          city: 'Sydney',
        }),
      });
      expect(partial.status).toBe(201);
      const partialBody = await partial.json();
      expect(partialBody.status).toBe('partial_created');
      expect(db.data.leads).toHaveLength(1);
      expect(db.data.leads[0].custom_fields.capture_status).toBe('partial');
      expect(db.data.leads[0].custom_fields.source_service_category).toBe('Cleaning');

      const completed = await fetch(`${baseUrl}/api/public/leads/webhook/source_website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-lead-source-key': 'source_secret' },
        body: JSON.stringify({
          name: 'New Provider',
          email: 'new-provider@example.com',
          phone: '+61400000000',
          session_id: 'signup_session_1',
          capture_status: 'completed',
          message: 'Ready to finish onboarding',
        }),
      });
      expect(completed.status).toBe(200);
      const completedBody = await completed.json();
      expect(completedBody.status).toBe('duplicate_updated');
      expect(db.data.leads).toHaveLength(1);
      expect(db.data.leads[0].name).toBe('New Provider');
      expect(db.data.leads[0].phone).toBe('+61400000000');
      expect(db.data.leads[0].custom_fields.capture_status).toBe('completed');
      expect(db.data.lead_source_logs.map((log: any) => log.status)).toEqual(['partial_created', 'duplicate_updated']);
    });
  });

  it('collects website traffic events and summarizes visits', async () => {
    const db = makeDb();
    const app = createApp(db);

    await withServer(app, async baseUrl => {
      const script = await fetch(`${baseUrl}/api/analytics/script/site_taskgo.js?key=analytics_secret`);
      expect(script.status).toBe(200);
      expect(await script.text()).toContain('/api/public/analytics/collect/site_taskgo');

      const collect = await fetch(`${baseUrl}/api/public/analytics/collect/site_taskgo?key=analytics_secret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15',
          'CF-IPCountry': 'MY',
        },
        body: JSON.stringify({
          event_type: 'pageview',
          session_id: 'session_1',
          visitor_id: 'visitor_1',
          page_url: 'https://taskgo.example/signup?utm=ad',
          title: 'TaskGo signup',
          referrer: 'https://google.com/search?q=taskgo',
        }),
      });
      expect(collect.status).toBe(200);
      expect(db.data.website_traffic_events).toHaveLength(1);
      expect(db.data.website_traffic_events[0].path).toBe('/signup');
      expect(db.data.website_traffic_events[0].country).toBe('MY');
      expect(db.data.website_traffic_events[0].device).toBe('mobile');

      const summary = await fetch(`${baseUrl}/api/website-analytics/summary?brand_id=taskgo&days=30`);
      expect(summary.status).toBe(200);
      const body = await summary.json();
      expect(body.total_visits).toBe(1);
      expect(body.unique_visitors).toBe(1);
      expect(body.by_country[0]).toEqual({ label: 'MY', count: 1 });
      expect(body.top_pages[0]).toEqual({ label: '/signup', count: 1 });
    });
  });
});
