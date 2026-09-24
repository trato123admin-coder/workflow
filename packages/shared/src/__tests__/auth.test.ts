import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  ResetPasswordSchema,
  MfaVerifySchema,
  CreateRoleSchema,
  PERMISSION_CODES,
} from '../index.js';

describe('Shared Auth & Identity Schemas', () => {
  it('validates correct login credentials', () => {
    const valid = LoginSchema.safeParse({
      email: 'admin@docuai.pe',
      password: 'StrongPassword123!',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects invalid email and short password', () => {
    const invalid = LoginSchema.safeParse({
      email: 'not-an-email',
      password: 'short',
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.errors.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('validates password match and complexity in ResetPasswordSchema', () => {
    const match = ResetPasswordSchema.safeParse({
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    expect(match.success).toBe(true);

    const mismatch = ResetPasswordSchema.safeParse({
      password: 'Password123',
      confirmPassword: 'DifferentPassword123',
    });
    expect(mismatch.success).toBe(false);
  });

  it('validates MFA 6-digit code', () => {
    expect(MfaVerifySchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(MfaVerifySchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(MfaVerifySchema.safeParse({ code: '12345a' }).success).toBe(false);
  });

  it('contains canonical 40 permissions', () => {
    expect(PERMISSION_CODES.length).toBe(40);
    expect(PERMISSION_CODES).toContain('users.manage');
    expect(PERMISSION_CODES).toContain('roles.manage');
    expect(PERMISSION_CODES).toContain('parties.read');
    expect(PERMISSION_CODES).toContain('estate.write');
    expect(PERMISSION_CODES).toContain('cash.close');
  });

  it('validates role creation schema', () => {
    const valid = CreateRoleSchema.safeParse({
      code: 'SUPERVISOR',
      name: 'Supervisor de Casos',
      description: 'Supervisa trámites notariales',
      requiresMfa: true,
      permissionCodes: ['cases.read.all', 'parties.read', 'filings.read'],
    });
    expect(valid.success).toBe(true);
  });
});
