import { notFound, errorHandler } from '../../../middleware/errorMiddleware.js';

describe('notFound middleware', () => {
  it('creates a 404 error with the original URL', () => {
    const req = { originalUrl: '/api/unknown' };
    const res = {};
    const next = jest.fn();
    notFound(req, res, next);
    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Not Found - /api/unknown');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('errorHandler middleware', () => {
  it('returns the error status code and message', () => {
    const err = new Error('Something broke');
    err.statusCode = 400;
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();
    process.env.NODE_ENV = 'production';
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Something broke', stack: null });
  });

  it('defaults to status 500 when no status code set', () => {
    const err = new Error('Server crash');
    delete err.statusCode;
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();
    process.env.NODE_ENV = 'development';
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Server crash');
    expect(typeof body.stack).toBe('string');
  });
});
