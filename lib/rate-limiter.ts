// lib/rate-limiter.ts — 轻量级内存限流器
// 模块8 安全：防止 API 滥用和爬虫

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;   // 时间窗口 (ms)
  maxRequests: number; // 窗口内最大请求数
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,     // 30 requests per minute
};

const AUTH_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,     // 10 login/register attempts per minute
};

const GENERATE_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 15,     // 15 generation requests per minute
};

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60_000);

/**
 * 获取请求的限流 key（基于 IP）
 */
function getRateLimitKey(request: Request): string {
  // Try X-Forwarded-For header (behind proxy)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    return `rl:${ip}`;
  }

  // Fall back to CF-Connecting-IP or random
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return `rl:${cfIp}`;

  // Use a combination of headers for fingerprinting
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `rl:${userAgent.substring(0, 20)}`;
}

/**
 * 检查是否超过限流
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  entry.count++;
  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * 生成 RateLimit 中间件响应
 */
export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({
      error: '请求过于频繁，请稍后再试',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
      },
    }
  );
}

/**
 * 检查生成 API 的限流
 */
export function checkGenerateRateLimit(request: Request) {
  return checkRateLimit(request, GENERATE_CONFIG);
}

/**
 * 检查认证 API 的限流
 */
export function checkAuthRateLimit(request: Request) {
  return checkRateLimit(request, AUTH_CONFIG);
}

export { DEFAULT_CONFIG, AUTH_CONFIG, GENERATE_CONFIG };
