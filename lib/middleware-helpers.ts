// lib/middleware-helpers.ts — 安全中间件辅助函数
// 模块8 安全：可复用的请求验证

import { checkRateLimit, checkAuthRateLimit, rateLimitResponse, DEFAULT_CONFIG, AUTH_CONFIG } from './rate-limiter';
import { getAuthUserFromRequest } from './auth';
import logger, { getRequestId } from './logger';
import type { TokenPayload } from './auth';

export interface AuthResult {
  user: TokenPayload | null;
  error: Response | null;
}

/**
 * 验证请求：鉴权 + 限流
 * 返回 { user, error } — 如果 error 非空，直接返回 error
 */
export async function authenticateRequest(
  request: Request,
  options: {
    requireAuth?: boolean;
    rateLimitConfig?: typeof DEFAULT_CONFIG;
  } = {}
): Promise<AuthResult> {
  const { requireAuth = false, rateLimitConfig } = options;

  // Rate limiting
  const rateCheck = rateLimitConfig
    ? checkRateLimit(request, rateLimitConfig)
    : checkRateLimit(request);

  if (!rateCheck.allowed) {
    return { user: null, error: rateLimitResponse(rateCheck.resetAt) };
  }

  // Authentication
  const user = await getAuthUserFromRequest(request);
  if (requireAuth && !user) {
    return {
      user: null,
      error: new Response(JSON.stringify({ error: '请先登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  return { user, error: null };
}

/**
 * 包装 API 处理函数，统一错误处理和日志
 */
export function withErrorHandler(
  handler: (request: Request, user: TokenPayload | null) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const reqId = getRequestId(request);
    const startTime = Date.now();
    const url = new URL(request.url);

    try {
      const response = await handler(request, null);
      const duration = Date.now() - startTime;

      // Log request
      logger.request(request, request.method, url.pathname, response.status, duration);

      // Add request ID to response
      const newHeaders = new Headers(response.headers);
      newHeaders.set('X-Request-ID', reqId);
      newHeaders.set('X-Response-Time', `${duration}ms`);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('api', `Unhandled error in ${request.method} ${url.pathname}`, error, {
        duration,
      });

      // Don't leak error details to client in production
      const isDev = process.env.NODE_ENV === 'development';
      return new Response(
        JSON.stringify({
          error: '服务器内部错误',
          ...(isDev ? { debug: error.message } : {}),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

/**
 * 安全地解析 JSON 请求体，防止畸形数据
 */
export async function safeParseJson<T = any>(request: Request): Promise<{ data: T | null; error: string | null }> {
  try {
    const text = await request.text();
    if (!text || !text.trim()) {
      return { data: null, error: '请求体为空' };
    }
    if (text.length > 100000) {
      return { data: null, error: '请求体过大' };
    }
    const data = JSON.parse(text);
    return { data, error: null };
  } catch {
    return { data: null, error: '请求体格式错误（非法 JSON）' };
  }
}

/**
 * 验证 Origin 或 Referer，防止 CSRF
 */
export function checkOrigin(request: Request, allowedOrigins?: string[]): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // If no origin/referer, it might be a direct API call (non-browser)
  // Allow it for server-to-server communication
  if (!origin && !referer) return true;

  const defaultAllowed = [
    process.env.NEXT_PUBLIC_BASE_URL || 'https://sinmoniker.com',
    'https://sinmoniker.com',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  const allowed = allowedOrigins || defaultAllowed;

  // Check origin
  if (origin) {
    return allowed.some(a => origin === a || origin.startsWith(a + '/'));
  }

  // Check referer
  if (referer) {
    return allowed.some(a => referer.startsWith(a));
  }

  return false;
}
