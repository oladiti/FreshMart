// Friendly diagnostics for MongoDB connection failures.
//
// The raw driver message for a blocked Atlas connection ("Could not connect to
// any servers in your MongoDB Atlas cluster...") is easy to misread as an
// application bug. This helper keeps the original message but appends the most
// common fix so a crashed boot is self-explanatory.

const WHITELIST_HINT =
  'The most common cause is an IP that is not on the cluster\'s access list. ' +
  'Add this machine\'s public IP under Atlas -> Network Access ' +
  '(https://www.mongodb.com/docs/atlas/security-whitelist/). ' +
  'Also confirm the cluster is not paused and the database user exists.';

const TRANSIENT_HINT =
  'The connection dropped mid-session (a network blip, Atlas failover, or ' +
  'maintenance). The driver reconnects automatically, so this usually clears ' +
  'on its own. If it persists, check your network and the cluster status in ' +
  'Atlas -> Clusters, then confirm this IP is still on the access list.';

// Runtime errors raised after a healthy connection that point at a lost
// connection (as opposed to a blocked initial handshake).
function looksLikeTransientNetworkError(error, message) {
  const name = error && error.name ? String(error.name) : '';
  return (
    name === 'MongoNetworkError' ||
    name === 'MongoPoolClearedError' ||
    /connection .*closed/i.test(message) ||
    /ReplicaSetNoPrimary/i.test(message) ||
    /pool (was )?cleared/i.test(message) ||
    /server selection timed out/i.test(message)
  );
}

/**
 * @param {unknown} error
 * @returns {string} the driver message, with an Atlas access-list hint appended
 *   when the failure looks like a server-selection/whitelist problem, a
 *   transient-reconnect hint when an established connection was dropped, or the
 *   plain message otherwise.
 */
export function describeDbConnectionError(error) {
  const message =
    error && error.message ? String(error.message) : String(error);

  const isSelectionError =
    (error && error.name === 'MongooseServerSelectionError') ||
    message.includes('Could not connect to any servers');

  // A blocked initial handshake and a dropped live connection both surface as
  // selection errors, so disambiguate by the message before appending a hint.
  if (message.includes('Could not connect to any servers')) {
    return `${message}\nHint: ${WHITELIST_HINT}`;
  }

  if (looksLikeTransientNetworkError(error, message)) {
    return `${message}\nHint: ${TRANSIENT_HINT}`;
  }

  if (!isSelectionError) return message;

  return `${message}\nHint: ${WHITELIST_HINT}`;
}

export default describeDbConnectionError;
