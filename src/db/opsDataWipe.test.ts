import { describe, expect, it } from 'vitest';
import type { Schema } from './server_db';
import { wipeOpsDataButPreserveBrandProfiles } from './opsDataWipe';

describe('wipeOpsDataButPreserveBrandProfiles', () => {
  it('removes operational brand data while preserving brand profile configuration', () => {
    const schema: Schema = {
      users: [{ id: 'u1', name: 'Admin', email: 'admin@example.com', created_at: '2024-01-01' } as any],
      brand_funnels: [{ id: 'bf1', brand_id: 'brand-a', brand_name: 'Brand A', stages: ['lead'], created_at: '2024-01-01' } as any],
      leads: [{ id: 'l1', brand_id: 'brand-a', brand_name: 'Brand A', name: 'Jane', email: 'jane@example.com', phone: '123', funnel_stage: 'lead', tags: [], custom_fields: {}, created_at: '2024-01-01' } as any],
      notes: [{ id: 'n1', lead_id: 'l1', content: 'Note', created_at: '2024-01-01' } as any],
      calls: [{ id: 'c1', lead_id: 'l1', outcome: 'completed', created_at: '2024-01-01' } as any],
      emails: [{ id: 'e1', lead_id: 'l1', subject: 'Hello', html_content: '<p>Hello</p>', status: 'sent', created_at: '2024-01-01' } as any],
      whatsapp: [{ id: 'w1', lead_id: 'l1', message: 'Hi', created_at: '2024-01-01' } as any],
      whatsapp_templates: [{ id: 'wt1', brand_id: 'brand-a', name: 'Welcome', message: 'Hi', created_at: '2024-01-01' } as any],
      message_templates: [{ id: 'mt1', brand_id: 'brand-a', channel: 'email', name: 'Welcome', body: 'Hi', created_at: '2024-01-01' } as any],
      brand_integrations: [{ id: 'bi1', brand_id: 'brand-a', email_provider: 'gmail', updated_at: '2024-01-01' } as any],
      email_connections: [{ id: 'ec1', tenant_id: 't1', brand_id: 'brand-a', provider: 'gmail', provider_email: 'mail@example.com', connection_status: 'connected', connected_at: '2024-01-01' } as any],
      lead_sources: [{ id: 'ls1', brand_id: 'brand-a', name: 'Website', provider: 'website', status: 'active', secret_key: 'secret', field_mappings: {}, created_at: '2024-01-01' } as any],
      lead_source_logs: [{ id: 'lsl1', source_id: 'ls1', brand_id: 'brand-a', status: 'created', created_at: '2024-01-01' } as any],
      brand_workspace_snapshots: [{ id: 'bws1', brand_id: 'brand-a', label: 'Overview', fieldKey: 'status', unit: 'Leads', icon: 'fa-chart', color: '#111111' } as any],
      social_connections: [{ id: 'sc1', provider: 'meta', status: 'connected', created_at: '2024-01-01' } as any],
      social_pages: [{ id: 'spg1', provider: 'meta', page_id: 'page-1', page_name: 'Page', status: 'connected', created_at: '2024-01-01' } as any],
      social_ad_accounts: [{ id: 'saa1', provider: 'meta', ad_account_id: 'acct-1', ad_account_name: 'Ads', status: 'connected', created_at: '2024-01-01' } as any],
      social_posts: [{ id: 'sps1', brand_id: 'brand-a', provider: 'meta', caption: 'Post', media_urls: [], post_type: 'text', publish_targets: [], status: 'draft', created_at: '2024-01-01' } as any],
      social_ad_metrics: [{ id: 'sam1', brand_id: 'brand-a', provider: 'meta', ad_account_id: 'acct-1', campaign_name: 'Camp', date: '2024-01-01', spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, leads: 0, cost_per_lead: 0, created_at: '2024-01-01' } as any],
      social_content_templates: [{ id: 'sct1', brand_id: 'brand-a', name: 'Template', caption: 'Caption', hashtags: ['#tag'], created_at: '2024-01-01' } as any],
      social_brand_budgets: [{ id: 'sbb1', brand_id: 'brand-a', monthly_budget: 1000, cpl_alert_threshold: 50, created_at: '2024-01-01' } as any],
      website_analytics_sites: [{ id: 'was1', brand_id: 'brand-a', name: 'Site', public_key: 'pk', status: 'active', created_by_user_id: 'u1', created_at: '2024-01-01' } as any],
      website_traffic_events: [{ id: 'wte1', brand_id: 'brand-a', site_id: 'was1', session_id: 's1', event_type: 'pageview', created_at: '2024-01-01' } as any],
      portfolio_opportunity_rules: [{ id: 'por1', name: 'Rule', source_brand_id: 'brand-a', target_brand_id: 'brand-b', trigger_field: 'status', trigger_operator: 'equals', trigger_value: 'ready', offer_label: 'Offer', active: true, created_by_user_id: 'u1', created_at: '2024-01-01', updated_at: '2024-01-01' } as any],
      portfolio_opportunities: [{ id: 'po1', brand_id: 'brand-a', title: 'Opportunity', created_at: '2024-01-01' } as any],
      sequences: [{ id: 'seq1', brand_id: 'brand-a', name: 'Sequence', active: true, steps: [], created_at: '2024-01-01' } as any],
      custom_fields: [{ id: 'cf1', brand_id: 'brand-a', field_name: 'segment', field_type: 'text', required: false } as any],
      enrollments: [{ id: 'en1', lead_id: 'l1', sequence_id: 'seq1', enrolled_at: '2024-01-01', current_step: 0, status: 'active' } as any],
      tasks: [{ id: 't1', brand_id: 'brand-a', user_id: 'u1', user_name: 'Admin', user_location: 'AUS', content: 'Task', status: 'Pending', created_at: '2024-01-01' } as any],
      team_messages: [{ id: 'tm1', content: 'Message', user_id: 'u1', user_name: 'Admin', created_at: '2024-01-01' } as any],
      team_notes: [{ id: 'tn1', title: 'Note', content: 'Body', created_by: 'u1', created_at: '2024-01-01', updated_at: '2024-01-01' } as any],
      usage_events: [{ id: 'ue1', brand_id: 'brand-a', feature: 'crm', event_type: 'view', created_at: '2024-01-01' } as any],
      deleted_email_provider_ids: [{ brand_id: 'brand-a', provider: 'gmail', provider_message_id: 'msg-1', deleted_at: '2024-01-01' }],
      audit_log: [{ id: 'al1', entity_type: 'lead', entity_id: 'l1', action: 'create', changed_by: 'u1', changed_by_name: 'Admin', before: null, after: null, timestamp: '2024-01-01' } as any],
    };

    const wiped = wipeOpsDataButPreserveBrandProfiles(schema);

    expect(wiped.leads).toEqual([]);
    expect(wiped.notes).toEqual([]);
    expect(wiped.calls).toEqual([]);
    expect(wiped.emails).toEqual([]);
    expect(wiped.whatsapp).toEqual([]);
    expect(wiped.tasks).toEqual([]);
    expect(wiped.enrollments).toEqual([]);
    expect(wiped.team_messages).toEqual([]);
    expect(wiped.team_notes).toEqual([]);
    expect(wiped.usage_events).toEqual([]);
    expect(wiped.lead_source_logs).toEqual([]);
    expect(wiped.social_posts).toEqual([]);
    expect(wiped.social_ad_metrics).toEqual([]);
    expect(wiped.website_traffic_events).toEqual([]);
    expect(wiped.portfolio_opportunities).toEqual([]);

    expect(wiped.brand_funnels).toHaveLength(1);
    expect(wiped.brand_integrations).toHaveLength(1);
    expect(wiped.custom_fields).toHaveLength(1);
    expect(wiped.sequences).toHaveLength(1);
    expect(wiped.brand_workspace_snapshots).toHaveLength(1);
    expect(wiped.users).toHaveLength(1);
    expect(wiped.audit_log).toHaveLength(1);
  });
});
