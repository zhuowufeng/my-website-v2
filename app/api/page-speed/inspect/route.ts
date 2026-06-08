/**
 * Page Speed Analyzer API
 * 服务端页面性能分析：响应时间、HTML结构、资源分析、缓存/压缩/HTTP2检测
 * 壁垒：Node.js dns + tls + fetch 多阶段探测 + cheerio HTML解析
 */

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { lookup } from 'node:dns/promises';
import { connect } from 'node:tls';

// ============ Types ============

interface TimingResult {
  dns: number | null;   // ms
  tcp: number | null;   // ms
  tls: number | null;   // ms
  ttfb: number | null;  // ms
  download: number | null; // ms
  total: number | null; // ms
}

interface ResourceAnalysis {
  total: number;
  scripts: number;
  stylesheets: number;
  images: number;
  fonts: number;
  preloads: number;
  renderBlocking: number;
  externalResources: number;
}

interface PageInfo {
  title: string | null;
  description: string | null;
  canonical: string | null;
  htmlSize: number;
  transferredSize: number | null;
  compression: string | null;  // gzip, br, none
  doctype: boolean;
  viewport: boolean;
}

interface CachingInfo {
  enabled: boolean;
  type: string | null;     // public, private, no-cache, no-store
  maxAge: number | null;   // seconds
  etag: string | null;
  lastModified: string | null;
}

interface PerformanceRecommendation {
  type: 'error' | 'warning' | 'info';
  message: string;
  detail: string;
}

interface PageSpeedResult {
  url: string;
  status: number;
  statusText: string;
  timing: TimingResult;
  page: PageInfo;
  resources: ResourceAnalysis;
  https: boolean;
  http2: boolean;
  caching: CachingInfo;
  headers: Record<string, string>;
  score: number;
  grade: string;
  recommendations: PerformanceRecommendation[];
}

// ============ SSL/TLS & HTTP/2 Detection ============

async function checkTLS(hostname: string, port: number = 443): Promise<{ http2: boolean; tlsTime: number }> {
  return new Promise((resolve) => {
    const start = performance.now();
    try {
      const socket = connect({
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 8000,
      }, () => {
        const tlsTime = Math.round((performance.now() - start) * 100) / 100;
        // Check ALPN for h2 support
        let http2 = false;
        try {
          const alpn = (socket as any).alpnProtocol;
          if (alpn && alpn.toLowerCase() === 'h2') http2 = true;
        } catch {
          // ALPN not available
        }
        socket.destroy();
        resolve({ http2, tlsTime });
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({ http2: false, tlsTime: Math.round((performance.now() - start) * 100) / 100 });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ http2: false, tlsTime: 8000 });
      });
    } catch {
      resolve({ http2: false, tlsTime: 0 });
    }
  });
}

// ============ DNS Lookup with Timing ============

async function checkDNS(hostname: string): Promise<{ ips: string[]; time: number } | null> {
  const start = performance.now();
  try {
    const result = await lookup(hostname, { all: true });
    const time = Math.round((performance.now() - start) * 100) / 100;
    const ips = result.map((addr: any) => addr.address || addr);
    return { ips, time };
  } catch {
    return null;
  }
}

// ============ Resource Analysis via Cheerio ============

function analyzeResources($: cheerio.CheerioAPI): ResourceAnalysis {
  const scripts = $('script[src]').length;
  const stylesheets = $('link[rel="stylesheet"]').length;
  const images = $('img[src]').length;
  const fonts = $('link[rel="preload"][as="font"], link[type*="font"]').length;
  const preloads = $('link[rel="preload"]').length;

  // Count render-blocking resources (scripts without async/defer, CSS)
  const blockingScripts = $('script[src]:not([async]):not([defer])').length;
  const blockingCSS = stylesheets;
  const renderBlocking = blockingScripts + blockingCSS;

  // External resources
  const externalResources = scripts + stylesheets;

  return {
    total: scripts + stylesheets + images + fonts,
    scripts,
    stylesheets,
    images,
    fonts,
    preloads,
    renderBlocking,
    externalResources,
  };
}

// ============ Caching Analysis ============

function analyzeCaching(headers: Record<string, string>): CachingInfo {
  const cacheControl = headers['cache-control'] || headers['Cache-Control'] || '';
  const etag = headers['etag'] || headers['ETag'] || null;
  const lastModified = headers['last-modified'] || headers['Last-Modified'] || null;

  if (!cacheControl) {
    return { enabled: false, type: null, maxAge: null, etag, lastModified };
  }

  const parts = cacheControl.toLowerCase().split(',').map(s => s.trim());
  const type = parts.find(p => ['public', 'private', 'no-cache', 'no-store'].includes(p)) || null;
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : null;

  return {
    enabled: !['no-cache', 'no-store'].some(p => parts.includes(p)),
    type,
    maxAge,
    etag,
    lastModified,
  };
}

// ============ Scoring Algorithm ============

function calculateScore(
  status: number,
  timing: TimingResult,
  page: PageInfo,
  resources: ResourceAnalysis,
  https: boolean,
  http2: boolean,
  caching: CachingInfo,
): { score: number; recommendations: PerformanceRecommendation[] } {
  let score = 100;
  const recommendations: PerformanceRecommendation[] = [];

  // 1. HTTP Status (max -15)
  if (status >= 400) {
    score -= 15;
    recommendations.push({
      type: 'error',
      message: '⚠️ 页面返回错误状态码',
      detail: `HTTP ${status} — 页面无法正常访问，建议检查服务器配置。`,
    });
  } else if (status >= 300) {
    score -= 5;
    recommendations.push({
      type: 'warning',
      message: '🔀 页面存在重定向',
      detail: `HTTP ${status} — 重定向会增加额外延迟，建议直接使用最终 URL。`,
    });
  }

  // 2. SSL/HTTPS (max -10)
  if (!https) {
    score -= 10;
    recommendations.push({
      type: 'error',
      message: '🔓 未启用 HTTPS',
      detail: 'HTTPS 是网站安全的基础，同时影响 SEO 排名。请立即配置 SSL 证书。',
    });
  }

  if (!http2) {
    score -= 5;
    recommendations.push({
      type: 'warning',
      message: '📡 未使用 HTTP/2',
      detail: 'HTTP/2 支持多路复用，可显著提升页面加载速度。建议升级服务器配置启用 HTTP/2。',
    });
  }

  // 3. TTFB (max -20)
  if (timing.ttfb !== null) {
    if (timing.ttfb > 2000) {
      score -= 20;
      recommendations.push({
        type: 'error',
        message: '🐢 首字节时间 (TTFB) 过长',
        detail: `${timing.ttfb}ms — 超过 2 秒，建议优化服务器响应速度、使用 CDN、升级主机。`,
      });
    } else if (timing.ttfb > 1000) {
      score -= 12;
      recommendations.push({
        type: 'warning',
        message: '⏳ 首字节时间 (TTFB) 较长',
        detail: `${timing.ttfb}ms — 超过 1 秒，建议启用 CDN 或优化后端响应。`,
      });
    } else if (timing.ttfb > 500) {
      score -= 5;
      recommendations.push({
        type: 'info',
        message: '🔎 TTFB 可进一步优化',
        detail: `${timing.ttfb}ms — 建议使用 CDN 加速全球访问。`,
      });
    }
  }

  // 4. Total response time (max -15)
  if (timing.total !== null) {
    if (timing.total > 5000) {
      score -= 15;
      recommendations.push({
        type: 'error',
        message: '⏰ 总响应时间过长',
        detail: `${timing.total}ms — 超过 5 秒，严重影响用户体验和 SEO。`,
      });
    } else if (timing.total > 2000) {
      score -= 8;
      recommendations.push({
        type: 'warning',
        message: '⌛ 总响应时间偏长',
        detail: `${timing.total}ms — 目标控制在 2 秒以内。`,
      });
    } else if (timing.total > 1000) {
      score -= 3;
      recommendations.push({
        type: 'info',
        message: '⚡ 响应时间尚可',
        detail: `${timing.total}ms — 可进一步优化到 1 秒以内。`,
      });
    }
  }

  // 5. Page size (max -10)
  if (page.htmlSize > 500000) {
    score -= 10;
    recommendations.push({
      type: 'error',
      message: '📦 HTML 体积过大',
      detail: `${(page.htmlSize / 1024).toFixed(1)}KB — 建议精简 HTML，移除不必要的空格和注释。`,
    });
  } else if (page.htmlSize > 200000) {
    score -= 5;
    recommendations.push({
      type: 'warning',
      message: '📦 HTML 体积偏大',
      detail: `${(page.htmlSize / 1024).toFixed(1)}KB — 建议启用压缩并精简 HTML。`,
    });
  }

  // 6. Render-blocking resources (max -10)
  if (resources.renderBlocking > 10) {
    score -= 10;
    recommendations.push({
      type: 'error',
      message: '🚫 渲染阻塞资源过多',
      detail: `${resources.renderBlocking} 个阻塞资源 — 建议对脚本使用 async/defer，内联关键 CSS。`,
    });
  } else if (resources.renderBlocking > 5) {
    score -= 5;
    recommendations.push({
      type: 'warning',
      message: '🚫 渲染阻塞资源较多',
      detail: `${resources.renderBlocking} 个阻塞资源 — 建议优化脚本加载策略。`,
    });
  } else if (resources.renderBlocking > 2) {
    score -= 2;
    recommendations.push({
      type: 'info',
      message: '💡 可减少渲染阻塞资源',
      detail: `${resources.renderBlocking} 个阻塞资源 — 考虑内联关键 CSS 和异步加载脚本。`,
    });
  }

  // 7. Compression (max -8)
  if (!page.compression || page.compression === 'none') {
    score -= 8;
    recommendations.push({
      type: 'error',
      message: '🗜️ 未启用压缩',
      detail: '建议启用 Gzip 或 Brotli 压缩，可减少 60-80% 传输体积。',
    });
  } else if (page.compression === 'gzip') {
    recommendations.push({
      type: 'info',
      message: '💡 可启用 Brotli 压缩',
      detail: 'Brotli 比 Gzip 压缩率更高，兼容现代浏览器。',
    });
  }

  // 8. Caching (max -7)
  if (!caching.enabled) {
    score -= 7;
    recommendations.push({
      type: 'warning',
      message: '📋 缓存策略未启用',
      detail: '建议配置 Cache-Control 和 ETag 头，利用浏览器缓存减少重复请求。',
    });
  } else if (caching.maxAge !== null && caching.maxAge < 3600) {
    score -= 3;
    recommendations.push({
      type: 'info',
      message: '📋 缓存时长较短',
      detail: `max-age=${caching.maxAge}s — 对于静态资源建议设置更长的缓存时间。`,
    });
  }

  // 9. Resource counts (max -5)
  if (resources.externalResources > 30) {
    score -= 5;
    recommendations.push({
      type: 'warning',
      message: '📎 外部资源请求过多',
      detail: `${resources.externalResources} 个外部资源 — 建议合并 CSS/JS 文件，减少 HTTP 请求。`,
    });
  } else if (resources.externalResources > 15) {
    score -= 2;
    recommendations.push({
      type: 'info',
      message: '📎 可减少外部资源数量',
      detail: `${resources.externalResources} 个外部资源 — 建议定期审计资源必要性。`,
    });
  }

  // 10. Missing meta (max -5)
  if (!page.viewport) {
    score -= 5;
    recommendations.push({
      type: 'warning',
      message: '📱 缺少 viewport meta 标签',
      detail: '缺少 viewport 设置，移动端显示可能不正常，影响移动端 SEO。',
    });
  }

  if (!page.description) {
    score -= 3;
    recommendations.push({
      type: 'warning',
      message: '📝 缺少 meta description',
      detail: '页面没有 meta description，影响搜索结果的点击率。',
    });
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return { score, recommendations };
}

function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ============ URL Helpers ============

interface ParsedURL {
  hostname: string;
  port: number;
  protocol: string;
  full: string;
}

function parseUrl(urlStr: string): ParsedURL | null {
  try {
    // Auto-add protocol
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = 'https://' + urlStr;
    }
    const parsed = new URL(urlStr);
    return {
      hostname: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80),
      protocol: parsed.protocol,
      full: parsed.toString().replace(/\/+$/, ''),
    };
  } catch {
    return null;
  }
}

// ============ Main Route Handler ============

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');

  if (!urlParam || !urlParam.trim()) {
    return NextResponse.json(
      { error: '请提供 URL 参数', detail: 'Example: /api/page-speed/inspect?url=example.com' },
      { status: 400 }
    );
  }

  const parsed = parseUrl(urlParam.trim());
  if (!parsed) {
    return NextResponse.json(
      { error: 'URL 格式不正确', detail: '请输入有效的域名或 URL，如 sinmoniker.com' },
      { status: 400 }
    );
  }

  const { hostname, protocol, full: targetUrl } = parsed;
  const isHttps = protocol === 'https:';

  try {
    // Phase 1: DNS Lookup
    const dnsResult = await checkDNS(hostname);

    // Phase 2: TLS/HTTP2 Check (only for HTTPS)
    let tlsResult = { http2: false, tlsTime: 0 };
    if (isHttps) {
      tlsResult = await checkTLS(hostname, parsed.port);
    }

    // Phase 3: HTTP Fetch with timing
    const fetchStart = performance.now();
    let ttfb: number | null = null;
    let downloadStart: number | null = null;
    let downloadEnd: number | null = null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    let responseBody: string;

    try {
      response = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SinmonikerPageSpeed/1.0; +https://sinmoniker.com)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      });

      ttfb = Math.round((performance.now() - fetchStart) * 100) / 100;
      downloadStart = performance.now();

      responseBody = await response.text();
      downloadEnd = performance.now();
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const errMsg = fetchErr?.message || 'Unknown error';
      return NextResponse.json({
        url: targetUrl,
        status: 0,
        statusText: 'FETCH_ERROR',
        timing: {
          dns: dnsResult?.time ?? null,
          tcp: null,
          tls: null,
          ttfb: null,
          download: null,
          total: null,
        },
        page: { title: null, description: null, canonical: null, htmlSize: 0, transferredSize: null, compression: null, doctype: false, viewport: false },
        resources: { total: 0, scripts: 0, stylesheets: 0, images: 0, fonts: 0, preloads: 0, renderBlocking: 0, externalResources: 0 },
        https: isHttps,
        http2: false,
        caching: { enabled: false, type: null, maxAge: null, etag: null, lastModified: null },
        headers: {},
        score: 0,
        grade: 'F',
        recommendations: [{
          type: 'error',
          message: '❌ 无法连接到目标服务器',
          detail: errMsg,
        }],
      });
    }

    clearTimeout(timeout);

    // Extract headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Parse timing
    const downloadTime = downloadEnd && downloadStart
      ? Math.round((downloadEnd - downloadStart) * 100) / 100
      : null;
    const totalTime = downloadEnd
      ? Math.round((downloadEnd - fetchStart) * 100) / 100
      : null;

    const timing: TimingResult = {
      dns: dnsResult?.time ?? null,
      tcp: null,  // TCP timing from Node fetch is not directly available
      tls: tlsResult.tlsTime > 0 ? tlsResult.tlsTime : null,
      ttfb,
      download: downloadTime,
      total: totalTime,
    };

    // Parse compression info
    const contentEncoding = headers['content-encoding'] || 'none';
    const compression = contentEncoding === 'br' ? 'Brotli'
      : contentEncoding === 'gzip' ? 'Gzip'
      : contentEncoding === 'deflate' ? 'Deflate'
      : null;

    // Phase 4: HTML Analysis with Cheerio
    let $: cheerio.CheerioAPI;
    try {
      $ = cheerio.load(responseBody);
    } catch {
      return NextResponse.json({
        url: targetUrl,
        status: response.status,
        statusText: response.statusText,
        timing,
        page: { title: null, description: null, canonical: null, htmlSize: responseBody.length, transferredSize: null, compression, doctype: responseBody.trimStart().startsWith('<!'), viewport: false },
        resources: { total: 0, scripts: 0, stylesheets: 0, images: 0, fonts: 0, preloads: 0, renderBlocking: 0, externalResources: 0 },
        https: isHttps,
        http2: tlsResult.http2,
        caching: analyzeCaching(headers),
        headers,
        score: 0,
        grade: 'F',
        recommendations: [{
          type: 'error',
          message: '📄 无法解析 HTML',
          detail: '页面内容可能不是有效的 HTML。',
        }],
      });
    }

    const pageTitle = $('title').first().text().trim() || null;
    const metaDesc = $('meta[name="description"]').attr('content') || null;
    const canonical = $('link[rel="canonical"]').attr('href') || null;
    const hasViewport = $('meta[name="viewport"]').length > 0;
    const hasDoctype = responseBody.trimStart().startsWith('<') && responseBody.trimStart().startsWith('<!');

    const page: PageInfo = {
      title: pageTitle,
      description: metaDesc,
      canonical,
      htmlSize: responseBody.length,
      transferredSize: null,
      compression,
      doctype: hasDoctype,
      viewport: hasViewport,
    };

    const resources = analyzeResources($);

    // Phase 5: Scoring
    const caching = analyzeCaching(headers);
    const { score, recommendations } = calculateScore(
      response.status,
      timing,
      page,
      resources,
      isHttps && tlsResult.http2, // consider HTTPS only if TLS connected
      tlsResult.http2,
      caching,
    );

    const grade = getGrade(score);

    const result: PageSpeedResult = {
      url: targetUrl,
      status: response.status,
      statusText: response.statusText,
      timing,
      page,
      resources,
      https: isHttps,
      http2: tlsResult.http2,
      caching,
      headers,
      score,
      grade,
      recommendations,
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });

  } catch (err: any) {
    return NextResponse.json(
      {
        error: '分析失败',
        detail: err?.message || '未知错误',
      },
      { status: 500 }
    );
  }
}
