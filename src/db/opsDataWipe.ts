import type { Schema } from './server_db';

export function wipeOpsDataButPreserveBrandProfiles(schema: Schema): Schema {
  const brandProfileCollections = [
    'brand_funnels',
    'whatsapp_templates',
    'message_templates',
    'brand_integrations',
    'email_connections',
    'lead_sources',
    'brand_workspace_snapshots',
    'social_content_templates',
    'social_brand_budgets',
    'website_analytics_sites',
    'sequences',
    'custom_fields',
  ] as const;

  const preserved = { ...schema } as Schema;

  for (const key of brandProfileCollections) {
    const value = (preserved as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      (preserved as Record<string, unknown>)[key] = value.filter(Boolean);
    }
  }

  preserved.leads = [];
  preserved.notes = [];
  preserved.calls = [];
  preserved.emails = [];
  preserved.whatsapp = [];
  preserved.lead_source_logs = [];
  preserved.social_connections = [];
  preserved.social_pages = [];
  preserved.social_ad_accounts = [];
  preserved.social_posts = [];
  preserved.social_ad_metrics = [];
  preserved.website_traffic_events = [];
  preserved.portfolio_opportunity_rules = [];
  preserved.portfolio_opportunities = [];
  preserved.enrollments = [];
  preserved.tasks = [];
  preserved.team_messages = [];
  preserved.team_notes = [];
  preserved.usage_events = [];
  preserved.deleted_email_provider_ids = [];

  return preserved;
}
