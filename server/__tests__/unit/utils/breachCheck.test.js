import crypto from 'crypto';
import {
  isPasswordBreached,
  isBreachCheckEnabled,
  resetBreachCache,
} from '../../../utils/breachCheck.js';

const sha1 = (value) =>
  crypto.createHash('sha1').update(value).digest('hex').toUpperCase();

describe('breachCheck', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFlag = process.env.BREACH_CHECK_ENABLED;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.BREACH_CHECK_ENABLED = '1';
    resetBreachCache();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.BREACH_CHECK_ENABLED = originalFlag;
    jest.restoreAllMocks();
  });

  it('detects a breached password via the k-anonymity range API', async () => {
    const password = 'password123';
    const hash = sha1(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        text: async () => `${suffix}:42\r\n0000000000000000000000000000000000:1\r\n`,
      });

    await expect(isPasswordBreached(password)).resolves.toBe(true);
    // Only the 5-char prefix is ever sent.
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(`/range/${prefix}`),
      expect.anything()
    );
  });

  it('allows a password whose suffix is not in the returned range', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => '0000000000000000000000000000000000:1\r\n',
    });

    await expect(isPasswordBreached('a-very-unique-passphrase-9012')).resolves.toBe(false);
  });

  it('fails open when the breach API errors', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(isPasswordBreached('password123')).resolves.toBe(false);
  });

  it('fails open on a non-OK response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => '',
    });
    await expect(isPasswordBreached('password123')).resolves.toBe(false);
  });

  it('is disabled under NODE_ENV=test', async () => {
    process.env.NODE_ENV = 'test';
    const fetchSpy = jest.spyOn(global, 'fetch');
    expect(isBreachCheckEnabled()).toBe(false);
    await expect(isPasswordBreached('password123')).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('honours an explicit BREACH_CHECK_ENABLED=0 opt-out', async () => {
    process.env.BREACH_CHECK_ENABLED = '0';
    expect(isBreachCheckEnabled()).toBe(false);
  });

  it('ignores non-string passwords', async () => {
    await expect(isPasswordBreached(undefined)).resolves.toBe(false);
    await expect(isPasswordBreached(12345)).resolves.toBe(false);
  });
});
