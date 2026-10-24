import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

interface TrafficBucket {
  count: number;
  resetAt: number;
}

interface TrafficLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skip?: (req: Request) => boolean;
}

/**
 * High-performance sliding-window in-memory traffic limiter
 * Protects backend services, database connections, and memory during high-traffic spikes.
 */
export const createTrafficLimiter = (options: TrafficLimiterOptions) => {
  const {
    windowMs = 60 * 1000,
    maxRequests = 300,
    message = 'High traffic detected. Please slow down and try again shortly.',
    skip,
  } = options;

  const buckets = new Map<string, TrafficBucket>();

  // Periodically sweep expired buckets to prevent memory accumulation
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(ip);
      }
    }
  }, Math.max(30000, windowMs));

  // Allow process cleanup if server terminates
  if (sweepInterval.unref) {
    sweepInterval.unref();
  }

  const getClientIp = (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      const parts = forwarded.split(',');
      if (parts[0]) return parts[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0 && typeof forwarded[0] === 'string') {
      return forwarded[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim();
    }
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
  };

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip && skip(req)) {
      return next();
    }

    const ip = getClientIp(req);
    const now = Date.now();

    const current = buckets.get(ip);
    const bucket: TrafficBucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + windowMs };

    const remaining = Math.max(0, maxRequests - bucket.count);
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count >= maxRequests) {
      res.setHeader('Retry-After', String(retryAfter));
      logger.warn(`Traffic limiter triggered for IP ${ip} on ${req.method} ${req.originalUrl}`);
      return res.status(429).json({
        error: message,
        retryAfter,
        status: 429,
      });
    }

    bucket.count += 1;
    buckets.set(ip, bucket);

    next();
  };
};

/**
 * General API traffic limiter: 350 requests per minute per IP
 * Generous for normal browsing and multi-tab use, but prevents denial-of-service / bot storms.
 */
export const generalTrafficLimiter = createTrafficLimiter({
  windowMs: 60 * 1000,
  maxRequests: 350,
  message: 'The website is experiencing high traffic. Please wait a few seconds and try again.',
  skip: (req) => {
    // Exempt health checks, static asset uploads, and options preflights
    return (
      req.method === 'OPTIONS' ||
      req.path === '/health' ||
      req.path === '/' ||
      req.path.startsWith('/uploads')
    );
  },
});
