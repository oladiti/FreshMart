import { startTestDB, stopTestDB } from '../../testDB.js';
import User from '../../../models/User.js';
import bcrypt from 'bcryptjs';

describe('User Model', () => {
  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('schema validation', () => {
    it('creates a user with valid fields', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@test.com',
        password: 'password123',
      });
      expect(user.name).toBe('John Doe');
      expect(user.email).toBe('john@test.com');
      expect(user.role).toBe('user');
    });

    it('requires a name', async () => {
      await expect(
        User.create({ email: 'no@name.com', password: 'password123' })
      ).rejects.toThrow();
    });

    it('requires a valid email format', async () => {
      await expect(
        User.create({ name: 'Bad', email: 'not-an-email', password: 'password123' })
      ).rejects.toThrow();
    });

    it('requires a password of at least 6 characters', async () => {
      await expect(
        User.create({ name: 'Short', email: 'short@test.com', password: '123' })
      ).rejects.toThrow();
    });

    it('normalizes email to lowercase', async () => {
      const user = await User.create({
        name: 'Case',
        email: 'Case@TEST.com',
        password: 'password123',
      });
      expect(user.email).toBe('case@test.com');
    });

    it('enforces unique email', async () => {
      await User.create({ name: 'One', email: 'dup@test.com', password: 'password123' });
      await expect(
        User.create({ name: 'Two', email: 'dup@test.com', password: 'password123' })
      ).rejects.toThrow();
    });
  });

  describe('password hashing', () => {
    it('hashes password before saving', async () => {
      const user = await User.create({
        name: 'Hashed',
        email: 'hash@test.com',
        password: 'plainpassword',
      });
      expect(user.password).not.toBe('plainpassword');
      expect(await bcrypt.compare('plainpassword', user.password)).toBe(true);
    });

    it('does not re-hash an unchanged password', async () => {
      const user = await User.create({
        name: 'Keep',
        email: 'keep@test.com',
        password: 'samerawpassword',
      });
      const originalHash = user.password;
      user.name = 'Keep Changed';
      await user.save();
      expect(user.password).toBe(originalHash);
    });
  });

  describe('matchPassword method', () => {
    it('returns true for correct password', async () => {
      const user = await User.create({
        name: 'Match',
        email: 'match@test.com',
        password: 'correct-password',
      });
      expect(await user.matchPassword('correct-password')).toBe(true);
    });

    it('returns false for incorrect password', async () => {
      const user = await User.create({
        name: 'NoMatch',
        email: 'nomatch@test.com',
        password: 'correct-password',
      });
      expect(await user.matchPassword('wrong-password')).toBe(false);
    });
  });

  describe('toJSON method', () => {
    it('strips password from JSON representation', async () => {
      const user = await User.create({
        name: 'Json',
        email: 'json@test.com',
        password: 'password123',
      });
      const json = user.toJSON();
      expect(json.password).toBeUndefined();
      expect(json.name).toBe('Json');
      expect(json.email).toBe('json@test.com');
    });
  });
});
