import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

const redis = getRedis();

type LimitResult = { success: boolean; remaining?: number };

type Limiter = { limit: (id: string) => Promise<LimitResult> };

function noopLimiter(requests: number): Limiter {
  return {
    limit: async () => ({ success: true, remaining: requests }),
  };
}

function make(prefix: string, requests: number, window: `${number} s` | `${number} m`): Limiter {
  if (!redis) {
    return noopLimiter(requests);
  }
  let rl: Ratelimit;
  try {
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `hw:${prefix}`,
    });
  } catch (e) {
    console.error(`[ratelimit:${prefix}] init failed`, e);
    return noopLimiter(requests);
  }
  return {
    limit: async (id: string) => {
      try {
        return await rl.limit(id);
      } catch (e) {
        // Redis/network errors must not take down API routes (e.g. bad Upstash env on Vercel).
        console.error(`[ratelimit:${prefix}]`, e);
        return { success: true, remaining: requests };
      }
    },
  };
}

/** /api/verify-telegram — 5 per IP per minute */
export const ratelimitTelegram = make("telegram", 5, "1 m");

/** /api/orders/create + /api/create-order — 10 per IP per minute */
export const ratelimitCreateOrder = make("create-order", 10, "1 m");

/** /api/verify-crypto-payment — 20 per IP per minute */
export const ratelimitVerifyCrypto = make("verify-crypto", 20, "1 m");

/** /api/redeem-points — 5 per IP per minute */
export const ratelimitRedeemPoints = make("redeem-points", 5, "1 m");
