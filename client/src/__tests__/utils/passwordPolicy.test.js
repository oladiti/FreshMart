import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  MIN_PASSWORD_LENGTH,
} from '../../utils/passwordPolicy';

describe('validatePassword', () => {
  it('accepts a strong password', () => {
    expect(validatePassword('FreshMart2024')).toBeNull();
  });

  it('rejects a missing password', () => {
    expect(validatePassword(undefined)).toMatch(/required/i);
    expect(validatePassword('')).toMatch(/required/i);
  });

  it('rejects non-string input', () => {
    expect(validatePassword(1234567890)).toMatch(/required/i);
  });

  it('rejects passwords shorter than the minimum length', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 2) + '1';
    expect(short).toHaveLength(MIN_PASSWORD_LENGTH - 1);
    expect(validatePassword(short)).toMatch(/at least/i);
  });

  it('requires both a letter and a number', () => {
    expect(validatePassword('abcdefghijk')).toMatch(/letter and one number/i);
    expect(validatePassword('12345678901')).toMatch(/letter and one number/i);
  });

  it('rejects common passwords that pass the length rule', () => {
    expect(validatePassword('password123')).toMatch(/too common/i);
    expect(validatePassword('Password123')).toMatch(/too common/i);
  });
});
