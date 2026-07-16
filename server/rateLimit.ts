// Lightweight in-memory rate limiter — no external dependencies required.
// Entries expire lazily (pruned on each check) so memory stays bounded.
import type { Request, Response, NextFunction } from "express";

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

function isAllowed(key: string, maxCount: number, windowMs: number): boolean {
  const now = Date.now();
  let entry = store.get(key);

  if (entry && entry.resetAt <= now) {
    store.delete(key);
    entry = undefined;
  }

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxCount) {
    return false;
  }

  entry.count++;
  return true;
}

// Returns the real client IP, respecting the reverse proxy header.
function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

/**
 * Rate-limit middleware keyed on the client IP address.
 * Good for public endpoints (login, register, forgot-password) where
 * the user is not yet authenticated.
 */
export function ipRateLimit(maxCount: number, windowMs: number, message?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.path}:ip:${clientIp(req)}`;
    if (!isAllowed(key, maxCount, windowMs)) {
      return res.status(429).json({
        message: message ?? "Too many requests. Please try again later.",
      });
    }
    next();
  };
}

/**
 * Rate-limit middleware keyed on the authenticated user's session ID.
 * Good for authenticated endpoints (scan-receipt) to prevent per-account abuse.
 */
export function userRateLimit(maxCount: number, windowMs: number, message?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session?.userId ?? clientIp(req);
    const key = `${req.path}:user:${userId}`;
    if (!isAllowed(key, maxCount, windowMs)) {
      return res.status(429).json({
        message: message ?? "Too many requests. Please try again later.",
      });
    }
    next();
  };
}
