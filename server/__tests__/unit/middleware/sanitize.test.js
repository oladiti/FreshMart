import { sanitizeRequest } from '../../../middleware/sanitize.js';

const run = (body, query) => {
  const req = { body, query };
  const next = jest.fn();
  sanitizeRequest(req, {}, next);
  return { body: req.body, query: req.query, next };
};

describe('sanitizeRequest middleware', () => {
  it('strips Mongo operator keys from the top level', () => {
    const { body } = run({ email: { $gt: '' }, password: 'x' });
    expect(body).toEqual({ email: {}, password: 'x' });
  });

  it('strips nested operator keys', () => {
    const { body } = run({ filter: { a: { $ne: null }, b: 1 } });
    expect(body).toEqual({ filter: { a: {}, b: 1 } });
  });

  it('strips dotted keys used for path traversal', () => {
    const { body } = run({ 'user.role': 'admin', name: 'ok' });
    expect(body).toEqual({ name: 'ok' });
  });

  it('strips prototype-pollution keys', () => {
    // JSON.parse creates an own enumerable `__proto__` key (unlike an object
    // literal, which would set the prototype), matching what express.json does.
    const payload = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{},"prototype":{},"name":"ok"}'
    );
    const { body } = run(payload);
    expect(body).toEqual({ name: 'ok' });
    expect({}.polluted).toBeUndefined();
  });

  it('does not let an own constructor key smuggle operators past the filter', () => {
    const payload = JSON.parse(
      '{"constructor":{},"$where":"this.password","email":"a@b.com"}'
    );
    const { body } = run(payload);
    expect(body).toEqual({ email: 'a@b.com' });
  });

  it('sanitizes objects inside arrays', () => {
    const { body } = run({ items: [{ $where: 'x', keep: 1 }] });
    expect(body).toEqual({ items: [{ keep: 1 }] });
  });

  it('leaves primitive values untouched', () => {
    const { body } = run({ name: 'Ali', age: 30, active: true, nothing: null });
    expect(body).toEqual({ name: 'Ali', age: 30, active: true, nothing: null });
  });

  it('calls next and does not throw for a missing body', () => {
    const req = {};
    const next = jest.fn();
    sanitizeRequest(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toBeUndefined();
  });

  it('strips operator keys from the query string', () => {
    const { query } = run(undefined, { filter: { $ne: 'x' }, page: '2' });
    expect(query).toEqual({ filter: {}, page: '2' });
  });

  it('leaves a query string without operators untouched', () => {
    const { query } = run(undefined, { page: '2', search: 'apples' });
    expect(query).toEqual({ page: '2', search: 'apples' });
  });

  it('preserves Buffer bodies (used by raw body parsers)', () => {
    const buffer = Buffer.from('{"a":1}');
    const req = { body: buffer };
    sanitizeRequest(req, {}, jest.fn());
    expect(req.body).toBe(buffer);
  });
});
