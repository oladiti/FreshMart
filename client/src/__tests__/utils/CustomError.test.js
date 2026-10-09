import { describe, it, expect } from 'vitest';
import CustomError from '../../utils/CustomError';

describe('CustomError', () => {
  it('is an instance of Error', () => {
    const err = new CustomError('Something failed', 500);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CustomError);
  });

  it('sets the message', () => {
    const err = new CustomError('Bad request', 400);
    expect(err.message).toBe('Bad request');
  });

  it('sets the statusCode', () => {
    const err = new CustomError('Not found', 404);
    expect(err.statusCode).toBe(404);
  });

  it('has a name of Error', () => {
    const err = new CustomError('Test', 500);
    expect(err.name).toBe('Error');
  });
});
