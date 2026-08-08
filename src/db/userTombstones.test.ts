import { describe, expect, it } from 'vitest';
import type { Schema } from './server_db';
import {
  applyUserTombstones,
  clearUserTombstonesFromSchema,
  isUserTombstoned,
  mergeDeletedUsers,
} from './server_db';

function baseSchema(overrides: Partial<Schema> = {}): Schema {
  return {
    users: [],
    brand_funnels: [],
    leads: [],
    notes: [],
    calls: [],
    emails: [],
    whatsapp: [],
    whatsapp_templates: [],
    message_templates: [],
    brand_integrations: [],
    email_connections: [],
    lead_sources: [],
    lead_source_logs: [],
    brand_workspace_snapshots: [],
    social_connections: [],
    social_pages: [],
    social_ad_accounts: [],
    social_posts: [],
    social_ad_metrics: [],
    social_content_templates: [],
    social_brand_budgets: [],
    website_analytics_sites: [],
    website_traffic_events: [],
    portfolio_opportunity_rules: [],
    portfolio_opportunities: [],
    sequences: [],
    custom_fields: [],
    enrollments: [],
    tasks: [],
    team_messages: [],
    team_notes: [],
    usage_events: [],
    deleted_email_provider_ids: [],
    deleted_users: [],
    audit_log: [],
    ...overrides,
  } as Schema;
}

describe('user tombstones', () => {
  it('merges tombstones by id and email without duplicating entries', () => {
    const merged = mergeDeletedUsers(
      [{ id: 'u1', email: 'a@example.com', deleted_at: '2026-01-01T00:00:00.000Z' }],
      [{ id: 'u1', email: 'a@example.com', deleted_at: '2026-02-01T00:00:00.000Z', deleted_by: 'admin' }],
      [{ id: 'email:b@example.com', deleted_at: '2026-01-15T00:00:00.000Z' }],
    );

    expect(merged).toHaveLength(2);
    const a = merged.find(t => t.id === 'u1');
    expect(a?.email).toBe('a@example.com');
    expect(a?.deleted_at).toBe('2026-02-01T00:00:00.000Z');
    expect(a?.deleted_by).toBe('admin');
    expect(merged.some(t => String(t.id).includes('b@example.com') || t.email === 'b@example.com')).toBe(true);
  });

  it('strips resurrected users from richer snapshots by id or email', () => {
    const data = baseSchema({
      users: [
        { id: 'u1', name: 'Keep', email: 'keep@example.com', role: 'user', created_at: '2026-01-01' } as any,
        { id: 'u2', name: 'Gone', email: 'gone@example.com', role: 'admin', created_at: '2026-01-01' } as any,
        { id: 'u3', name: 'AlsoGone', email: 'also@example.com', role: 'user', created_at: '2026-01-01' } as any,
      ],
      deleted_users: [
        { id: 'u2', email: 'gone@example.com', deleted_at: '2026-03-01T00:00:00.000Z' },
        { id: 'email:also@example.com', deleted_at: '2026-03-02T00:00:00.000Z' },
      ],
    });

    applyUserTombstones(data);

    expect(data.users.map(u => u.id)).toEqual(['u1']);
    expect(isUserTombstoned(data, { id: 'u2' })).toBe(true);
    expect(isUserTombstoned(data, { email: 'also@example.com' })).toBe(true);
    expect(isUserTombstoned(data, { email: 'keep@example.com' })).toBe(false);
  });

  it('clears tombstones so intentional re-create is not immediately stripped', () => {
    const data = baseSchema({
      users: [],
      deleted_users: [
        { id: 'old-id', email: 'staff@example.com', deleted_at: '2026-03-01T00:00:00.000Z' },
      ],
    });

    const removed = clearUserTombstonesFromSchema(data, { email: 'staff@example.com' });
    expect(removed).toBe(1);
    expect(data.deleted_users).toEqual([]);

    data.users.push({
      id: 'new-id',
      name: 'Staff',
      email: 'staff@example.com',
      role: 'user',
      created_at: '2026-04-01',
    } as any);
    applyUserTombstones(data);
    expect(data.users).toHaveLength(1);
    expect(data.users[0].id).toBe('new-id');
  });

  it('unions tombstones from multiple lists like live + richer backup', () => {
    const live = baseSchema({
      users: [{ id: 'u1', name: 'Alive', email: 'alive@example.com', role: 'user', created_at: '2026-01-01' } as any],
      deleted_users: [{ id: 'del-1', email: 'deleted@example.com', deleted_at: '2026-04-01T00:00:00.000Z' }],
    });
    const richerBackupUsers = [
      { id: 'u1', name: 'Alive', email: 'alive@example.com', role: 'user', created_at: '2026-01-01' } as any,
      { id: 'del-1', name: 'ShouldNotReturn', email: 'deleted@example.com', role: 'admin', created_at: '2026-01-01' } as any,
      { id: 'extra', name: 'Extra', email: 'extra@example.com', role: 'user', created_at: '2026-01-01' } as any,
    ];

    const recovered = baseSchema({
      users: richerBackupUsers,
      leads: Array.from({ length: 50 }, (_, i) => ({ id: `l${i}` })) as any,
      deleted_users: [],
    });

    recovered.deleted_users = mergeDeletedUsers(recovered.deleted_users, live.deleted_users);
    applyUserTombstones(recovered);

    expect(recovered.users.map(u => u.email).sort()).toEqual(['alive@example.com', 'extra@example.com']);
    expect(recovered.users.some(u => u.email === 'deleted@example.com')).toBe(false);
  });
});
