import { protect, adminOnly } from '../../../middleware/authMiddleware.js';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));
jest.mock('../../../models/User.js', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

import jwt from 'jsonwebtoken';
import User from '../../../models/User.js';

const mockUser = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  name: 'Test User',
  email: 'user@test.com',
  role: 'user',
};

describe('protect middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildReq = (headers = {}) => ({ headers });

  it('returns 401 when no authorization header present', async () => {
    const req = buildReq({});
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, no token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const req = buildReq({ authorization: 'Bearer badtoken' });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, token failed' });
    expect(next).not.toHaveBeenCalled();
  });

  // Helper: User.findById called in middleware is chained with .select('-password')
  const mockFindById = (user) => jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

  it('returns 401 when user is not found for valid token', async () => {
    jwt.verify.mockReturnValue({ id: 'nonexistent' });
    User.findById.mockImplementation(mockFindById(null));
    const req = buildReq({ authorization: 'Bearer goodtoken' });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user and calls next for a valid token', async () => {
    jwt.verify.mockReturnValue({ id: mockUser.id });
    User.findById.mockImplementation(mockFindById(mockUser));
    const req = buildReq({ authorization: 'Bearer goodtoken' });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await protect(req, res, next);
    expect(User.findById).toHaveBeenCalled();
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('adminOnly middleware', () => {
  it('calls next for an admin user', () => {
    const req = { user: { role: 'admin' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    adminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin user', () => {
    const req = { user: { role: 'user' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied: Admins only' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when no user on request', () => {
    const req = { user: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
