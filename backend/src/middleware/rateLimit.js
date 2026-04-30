const buckets = new Map();

function getClientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded || '').split(',')[0].trim();
  const base = ip || req.socket?.remoteAddress || 'unknown';
  return String(base);
}

export function createRateLimiter({ windowMs, max, keyPrefix }) {
  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientKey(req)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    }

    current.count += 1;
    return next();
  };
}

export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  keyPrefix: 'auth',
});

export const taskActionRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  keyPrefix: 'task-action',
});
