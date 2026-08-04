import { describe, expect, it } from 'vitest';
import { buildAutoMapping } from './importMapping';

describe('import mapping', () => {
  it('does not map a date column as a phone number', () => {
    const headers = ['created_date', 'First name', 'Last name', 'Email address'];
    const rows = [
      { created_date: '7/24/2026', 'First name': 'Ada', 'Last name': 'Lovelace', 'Email address': 'ada@example.com' },
      { created_date: '7/24/2026', 'First name': 'Grace', 'Last name': 'Hopper', 'Email address': 'grace@example.com' },
    ];

    const mapping = buildAutoMapping(headers, [], rows);
    expect(mapping.name).toBe('First name');
    expect(mapping.email).toBe('Email address');
    expect(mapping.phone).toBe('');
  });

  it('still maps a valid phone column', () => {
    const mapping = buildAutoMapping(
      ['Name', 'Mobile', 'Email'],
      [],
      [{ Name: 'Ada', Mobile: '+61 412 345 678', Email: 'ada@example.com' }],
    );

    expect(mapping.phone).toBe('Mobile');
  });
});
