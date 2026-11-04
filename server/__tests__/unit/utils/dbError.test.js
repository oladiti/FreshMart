import { describeDbConnectionError } from '../../../utils/dbError.js';

describe('describeDbConnectionError', () => {
  it('appends the Atlas access-list hint to a server-selection error', () => {
    const error = new Error('Could not connect to any servers in your MongoDB Atlas cluster');
    error.name = 'MongooseServerSelectionError';

    const result = describeDbConnectionError(error);

    expect(result).toContain('Could not connect to any servers');
    expect(result).toMatch(/Network Access/i);
    expect(result).toMatch(/security-whitelist/);
  });

  it('recognises the error by message when the name is generic', () => {
    const error = new Error('Could not connect to any servers in your MongoDB Atlas cluster');

    expect(describeDbConnectionError(error)).toMatch(/Network Access/i);
  });

  it('appends a reconnect hint when a live connection was closed', () => {
    const error = new Error('connection 13 to 159.41.89.32:27017 closed');
    error.name = 'MongoNetworkError';

    const result = describeDbConnectionError(error);

    expect(result).toContain('closed');
    expect(result).toMatch(/reconnects automatically/i);
    expect(result).not.toMatch(/security-whitelist/);
  });

  it('treats ReplicaSetNoPrimary as a transient reconnect, not a whitelist issue', () => {
    const error = new Error('connection <monitor> to 159.41.89.32:27017 closed');
    error.name = 'MongooseServerSelectionError';

    const result = describeDbConnectionError(error);

    expect(result).toMatch(/ReplicaSetNoPrimary|reconnects automatically/i);
    expect(result).not.toMatch(/security-whitelist/);
  });

  it('recognises a cleared connection pool as transient', () => {
    const error = new Error('Connection pool was cleared because another operation failed');
    error.name = 'MongoPoolClearedError';

    expect(describeDbConnectionError(error)).toMatch(/reconnects automatically/i);
  });

  it('returns the plain message for unrelated errors', () => {
    const result = describeDbConnectionError(new Error('Authentication failed'));

    expect(result).toBe('Authentication failed');
    expect(result).not.toMatch(/Network Access/i);
  });

  it('handles non-Error values without throwing', () => {
    expect(describeDbConnectionError('boom')).toBe('boom');
  });
});
