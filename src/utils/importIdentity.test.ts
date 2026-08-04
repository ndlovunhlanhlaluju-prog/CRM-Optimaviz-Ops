import { describe, expect, it } from 'vitest';
import { importIdentityKeys, normalizeImportPhone, normalizeImportEmail } from './importIdentity';

describe('import identity', () => {
  it('matches emails case-insensitively', () => {
    expect(importIdentityKeys(' Ada@Example.com ', '')).toEqual(['email:ada@example.com']);
  });

  it('matches formatted versions of the same phone number', () => {
    expect(normalizeImportPhone('+61 412 345 678')).toBe('61412345678');
    expect(normalizeImportPhone('0412-345-678')).toBe('0412345678');
  });

  it('does not treat short numeric values as a phone identity', () => {
    expect(importIdentityKeys('', '2026')).toEqual([]);
  });

  it('falls back to name when neither email nor phone is present', () => {
    expect(importIdentityKeys('', '', 'John Doe')).toEqual(['name:john doe']);
  });

  it('does not fall back to name when email or phone is present', () => {
    expect(importIdentityKeys('john@example.com', '', 'John Doe')).toEqual(['email:john@example.com']);
    expect(importIdentityKeys('', '0412345678', 'John Doe')).toEqual(['phone:0412345678']);
  });

  it('does not fall back to empty name', () => {
    expect(importIdentityKeys('', '', '')).toEqual([]);
    expect(importIdentityKeys('', '', '   ')).toEqual([]);
  });
});
