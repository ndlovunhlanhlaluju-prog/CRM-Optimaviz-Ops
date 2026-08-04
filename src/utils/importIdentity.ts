/**
 * Identity helpers used while importing leads.  Names are deliberately not
 * identities: two different people can legitimately share one.
 */
export function normalizeImportEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeImportPhone(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  // Do not use short numbers, dates, or miscellaneous numeric cells as phones.
  return digits.length >= 7 && digits.length <= 16 ? digits : '';
}

export function importIdentityKeys(email: unknown, phone: unknown, name?: string): string[] {
  const keys: string[] = [];
  const cleanEmail = normalizeImportEmail(email);
  const cleanPhone = normalizeImportPhone(phone);
  if (cleanEmail) keys.push(`email:${cleanEmail}`);
  if (cleanPhone) keys.push(`phone:${cleanPhone}`);
  if (!keys.length && name) {
    const cleanName = String(name ?? '').trim().toLowerCase();
    if (cleanName) keys.push(`name:${cleanName}`);
  }
  return keys;
}
