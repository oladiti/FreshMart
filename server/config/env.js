// Boot-time environment validation.
//
// Missing or weak configuration is a common source of security incidents
// (default JWT secrets, a DB pointing at the wrong cluster, Stripe left in an
// unverifiable state). Fail fast in production; warn elsewhere so local dev and
// tests are not blocked.

const isProduction = () => process.env.NODE_ENV === 'production';

const has = (key) => Boolean(process.env[key] && String(process.env[key]).trim());

/**
 * @param {{ throwOnError?: boolean }} [options]
 * @returns {string[]} the list of detected problems (empty when valid)
 */
export function validateEnv({ throwOnError = isProduction() } = {}) {
  const fatal = [];
  const warnings = [];

  // Always required.
  for (const key of ['MONGO_URI', 'JWT_SECRET']) {
    if (!has(key)) fatal.push(`Missing required environment variable: ${key}`);
  }

  if (has('JWT_SECRET') && String(process.env.JWT_SECRET).length < 32) {
    fatal.push('JWT_SECRET must be at least 32 characters long');
  }

  if (isProduction()) {
    if (!has('CLIENT_URL')) {
      warnings.push('CLIENT_URL is not set; email links will fall back to localhost');
    }
    if (!has('CORS_ORIGIN')) {
      warnings.push('CORS_ORIGIN is not set; only same-origin requests will be allowed');
    }
    if (!has('STRIPE_SECRET_KEY')) {
      warnings.push('STRIPE_SECRET_KEY is not set; payments cannot be processed');
    } else if (!has('STRIPE_WEBHOOK_SECRET')) {
      warnings.push('STRIPE_WEBHOOK_SECRET is not set; Stripe webhooks will be rejected');
    }
    const provider = (process.env.EMAIL_PROVIDER || 'gmail_api').toLowerCase();
    if (provider === 'gmail_api') {
      const missing = [
        'GMAIL_CLIENT_ID',
        'GMAIL_CLIENT_SECRET',
        'GMAIL_REFRESH_TOKEN',
      ].filter((key) => !has(key));
      if (missing.length) {
        warnings.push(
          `${missing.join(
            ', '
          )} not set; transactional email (verification/reset) is disabled`
        );
      }
      if (!has('EMAIL_FROM') && !has('GMAIL_SENDER')) {
        warnings.push(
          'Neither EMAIL_FROM nor GMAIL_SENDER is set; the Gmail account will be used as the sender'
        );
      }
    } else if (provider === 'smtp') {
      if (!has('EMAIL_USER') || !has('EMAIL_PASS')) {
        warnings.push(
          'EMAIL_USER/EMAIL_PASS not set; transactional email (verification/reset) is disabled'
        );
      }
    } else if (!has('RESEND_API_KEY')) {
      warnings.push(
        'RESEND_API_KEY is not set; transactional email (verification/reset) is disabled'
      );
    }
  }

  if (warnings.length) {
    console.warn(`⚠️  Environment warnings:\n - ${warnings.join('\n - ')}`);
  }

  if (fatal.length) {
    const message = `Environment configuration error(s):\n - ${fatal.join('\n - ')}`;
    if (throwOnError) throw new Error(message);
    console.warn(`⚠️  ${message}`);
    return fatal;
  }

  return [];
}

export default validateEnv;
