import AuditLog from '../models/AuditLog.js';

export function getClientIp(req) {
  if (!req) return '';
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 100);
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).trim().slice(0, 100);
  }
  return req.ip || req.connection?.remoteAddress || '';
}

export function getUserAgent(req) {
  if (!req) return '';
  const ua = req.headers?.['user-agent'];
  if (typeof ua !== 'string') return '';
  return ua.slice(0, 300);
}

export async function auditLog({
  req = null,
  actor = null,
  action,
  target = null,
  metadata = {},
  success = true,
} = {}) {
  try {
    await AuditLog.create({
      actor: actor?._id || actor?.id || null,
      action,
      target,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata,
      success,
    });
  } catch (err) {
    // Never throw on audit logging failures
    console.error('Failed to write audit log:', err.message);
  }
}

export default { auditLog, getClientIp, getUserAgent };
