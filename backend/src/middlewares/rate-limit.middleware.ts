import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import { type AuthRequest } from './auth.middleware.js';

/**
 * Keyed on the user id rather than the IP that express-rate-limit uses by
 * default: these routes all sit behind requireAuth, and on a shared NAT one
 * heavy user would otherwise throttle everyone around them.
 */
const perUserLimiter = (max: number, message: string): ReturnType<typeof rateLimit> =>
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max,
    message: { message },
    standardHeaders: true,
    legacyHeaders: false,
    // The IP fallback goes through ipKeyGenerator so an IPv6 client cannot walk
    // its own /128 for a fresh bucket per request.
    keyGenerator: ((req: AuthRequest) =>
      req.userId ?? ipKeyGenerator(req.ip ?? '')) as Options['keyGenerator'],
  });

export const contentWriteLimiter = (max: number): ReturnType<typeof rateLimit> =>
  perUserLimiter(max, "You're saving faster than we can keep up. Try again in a little while.");

export const searchLimiter = (max: number): ReturnType<typeof rateLimit> =>
  perUserLimiter(max, 'Too many searches. Try again in a little while.');
