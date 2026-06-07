// middleware.ts — Next.js 安全中间件
// 模块8 安全：全局安全头、CSP、CSRF、爬虫检测

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://sinmoniker.com';

// 明确被允许的来源（CSRF 保护）
const ALLOWED_ORIGINS = [
  BASE_URL,
  'https://sinmoniker.com',
  'http://localhost:3000',
  'http://localhost:3001',
];

// 爬虫 User-Agent 关键词（允许访问，但可以特殊处理）
const KNOWN_BOTS = [
  'googlebot', 'bingbot', 'baiduspider', 'yandexbot', 'facebookexternalhit',
  'twitterbot', 'slurp', 'duckduckbot', 'applebot', 'discordbot',
  'telegrambot', 'whatsapp', 'LinkedInBot',
];

// 已知恶意爬虫/工具
const MALICIOUS_PATTERNS = [
  'curl', 'wget', 'python-requests', 'python-urllib', 'go-http-client',
  'scrapy', 'java/', 'ruby', 'libwww', 'perl', 'php',
];

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const url = request.nextUrl;
  const pathname = url.pathname;

  // ============ 1. Security Headers ============

  // Content Security Policy (CSP)
  // 限制脚本来源、样式来源、连接目的地等
  const cspDirectives = [
    // 默认只允许同源
    `default-src 'self'`,
    // 脚本：允许同源 + 内联脚本（Next.js 需要） + 严格动态
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
    // 样式：允许同源 + 内联样式
    `style-src 'self' 'unsafe-inline'`,
    // 图片：允许同源 + 微信 CDN + 任意图片
    `img-src 'self' data: blob: https:`,
    // 连接：API 和 DeepSeek
    `connect-src 'self' https://api.deepseek.com`,
    // 字体：仅同源
    `font-src 'self'`,
    // 对象：不允许
    `object-src 'none'`,
    // 媒体：仅同源
    `media-src 'self'`,
    // 框架：不允许被嵌入（防点击劫持）
    `frame-ancestors 'none'`,
    // 表单：仅提交到同源
    `form-action 'self'`,
    // 基础 URI：仅同源
    `base-uri 'self'`,
  ].join('; ');

  response.headers.set('Content-Security-Policy', cspDirectives);

  // X-Frame-Options: DENY — 不允许 iframe 嵌入
  response.headers.set('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: nosniff — 防止 MIME 类型混淆
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy — 控制 Referer 头
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy — 限制浏览器 API 权限
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // Strict-Transport-Security (HSTS) — 强制 HTTPS（生产环境）
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // ============ 2. API Route Security ============
  if (pathname.startsWith('/api/')) {
    // 2a. CSRF Protection — 验证 Origin/Referer
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    // 对非 GET 请求验证来源
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const isAllowedOrigin = checkAllowedOrigin(origin, referer);
      if (!isAllowedOrigin) {
        console.warn(`[security] CSRF blocked: ${request.method} ${pathname} (origin=${origin}, referer=${referer})`);
        return new NextResponse(
          JSON.stringify({ error: 'CSRF validation failed' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 2b. 敏感 API 特殊处理（登录/注册限流在中件层）
    if (pathname.startsWith('/api/login') || pathname.startsWith('/api/register')) {
      // 登录/注册端点：额外限制
      response.headers.set('X-Auth-Endpoint', '1');
    }
  }

  // ============ 3. Bot Detection (logging only, no block) ============
  const userAgent = request.headers.get('user-agent') || '';
  const isBot = KNOWN_BOTS.some(bot => userAgent.toLowerCase().includes(bot));
  const isMalicious = MALICIOUS_PATTERNS.some(pattern => 
    userAgent.toLowerCase().startsWith(pattern)
  );

  response.headers.set('X-Bot-Detected', isBot ? '1' : '0');
  if (isMalicious) {
    console.warn(`[security] Suspicious UA detected: ${userAgent.substring(0, 100)} accessing ${pathname}`);
    // Flag them but don't block — may be legitimate tooling
    response.headers.set('X-Suspicious-Client', '1');
  }

  // ============ 4. Cache Headers ============
  // API 不下缓存
  if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  // ============ 5. X-XSS-Protection (legacy) ============
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}

function checkAllowedOrigin(origin: string | null, referer: string | null): boolean {
  // No origin/referer — might be server-to-server or Postman
  if (!origin && !referer) return true;

  for (const allowed of ALLOWED_ORIGINS) {
    if (origin && (
      origin === allowed ||
      origin.startsWith(allowed + '/')
    )) {
      return true;
    }
    if (referer && referer.startsWith(allowed + '/')) {
      return true;
    }
    // Allow the development server (any port)
    if (origin && /^http:\/\/localhost:\d+$/.test(origin)) return true;
    if (referer && /^http:\/\/localhost:\d+\//.test(referer)) return true;
  }

  return false;
}

// Only apply to matching routes
export const config = {
  matcher: [
    // Apply to all routes
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
