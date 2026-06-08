/**
 * Link Checker API — 链接健康检查器
 *
 * 功能：
 * 1. 抓取目标页面 HTML
 * 2. 用 cheerio 提取所有 <a href> 链接
 * 3. 并发批量检测每个链接的 HTTP 状态
 * 4. 分类返回：正常 / 重定向 / 损坏 / 跳过
 *
 * 壁垒：
 * - cheerio 解析 + 并发池控制（最多 10 并发）
 * - URL 规范化（相对→绝对、去重、协议补全）
 * - 智能分类：死亡链接 / 重定向 / 正常 / 外部
 */

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// ============ Types ============

interface LinkResult {
  href: string;
  text: string;
  status: number;
  statusText: string;
  category: 'healthy' | 'redirect' | 'broken' | 'error' | 'skipped';
  isInternal: boolean;
  responseTime: number;
}

interface InspectResult {
  pageUrl: string;
  pageTitle: string;
  totalLinks: number;
  checkedLinks: number;
  skippedLinks: number;
  results: LinkResult[];
  summary: {
    healthy: number;
    redirect: number;
    broken: number;
    error: number;
    skipped: number;
    internal: number;
    external: number;
  };
  fetchTime: number;
}

// ============ Config ============

const MAX_CONCURRENCY = 10;
const LINK_TIMEOUT = 10000;
const FETCH_TIMEOUT = 15000;
const MAX_LINKS_TO_CHECK = 80; // 最多检查 80 个链接

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

// ============ Helpers ============

function sanitizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  try {
    const u = new URL(url);
    if (!u.hostname || !u.hostname.includes('.')) return '';
    return url;
  } catch {
    return '';
  }
}

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    // Handle protocol-relative URLs
    if (href.startsWith('//')) {
      return new URL(href, baseUrl).href;
    }
    // Handle absolute paths
    if (href.startsWith('/')) {
      return new URL(href, baseUrl).href;
    }
    // Handle full URLs
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }
    // Handle relative paths
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function getCategory(status: number): 'healthy' | 'redirect' | 'broken' | 'error' {
  if (status >= 200 && status < 300) return 'healthy';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'broken';
  if (status >= 500) return 'broken';
  return 'error';
}

function getBaseDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function isSkippable(href: string): boolean {
  const skipPatterns = [
    /^javascript:/i,
    /^mailto:/i,
    /^tel:/i,
    /^sms:/i,
    /^#/,
    /^data:/i,
    /^blob:/i,
    /^ftp:/i,
    /^file:/i,
  ];
  return skipPatterns.some(p => p.test(href));
}

// ============ Single Link Checker ============

async function checkLink(
  url: string,
  text: string,
  baseDomain: string,
  index: number
): Promise<LinkResult> {
  const targetDomain = getBaseDomain(url);
  const isInternal = targetDomain === baseDomain;

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LINK_TIMEOUT);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': '*/*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const elapsed = Date.now() - start;

    // If redirect, follow it once with GET to check the final destination
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) {
        try {
          const redirectUrl = new URL(location, url).toString();
          const start2 = Date.now();
          const res2 = await fetch(redirectUrl, {
            method: 'HEAD',
            redirect: 'manual',
            headers: { 'User-Agent': getRandomUA() },
            signal: AbortSignal.timeout(LINK_TIMEOUT),
          });
          const elapsed2 = Date.now() - start2;
          const cat = getCategory(res2.status);
          return {
            href: url,
            text: text.slice(0, 100),
            status: response.status,
            statusText: `→ ${res2.status} ${res2.statusText || ''}`,
            category: cat,
            isInternal,
            responseTime: elapsed + elapsed2,
          };
        } catch {
          // fall through, just report the redirect
        }
      }
    }

    const category = getCategory(response.status);
    return {
      href: url,
      text: text.slice(0, 100),
      status: response.status,
      statusText: response.statusText || '',
      category,
      isInternal,
      responseTime: elapsed,
    };
  } catch (err: any) {
    return {
      href: url,
      text: text.slice(0, 100),
      status: 0,
      statusText: err?.name === 'AbortError' ? '超时' : (err?.message?.slice(0, 60) || '连接失败'),
      category: 'error' as const,
      isInternal,
      responseTime: 0,
    };
  }
}

// ============ Batch Link Checker ============

async function checkLinksInBatches(
  links: { href: string; text: string }[],
  baseDomain: string
): Promise<LinkResult[]> {
  const results: LinkResult[] = [];
  const limited = links.slice(0, MAX_LINKS_TO_CHECK);

  for (let i = 0; i < limited.length; i += MAX_CONCURRENCY) {
    const batch = limited.slice(i, i + MAX_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((link, idx) =>
        checkLink(link.href, link.text, baseDomain, i + idx)
      )
    );
    results.push(...batchResults);
  }

  return results;
}

// ============ Route Handler ============

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json(
      { error: '请提供 url 参数，如 ?url=https://example.com' },
      { status: 400 }
    );
  }

  const cleanUrl = sanitizeUrl(urlParam);
  if (!cleanUrl) {
    return NextResponse.json(
      { error: 'URL 格式不正确，请输入有效网址（如 example.com 或 https://example.com）' },
      { status: 400 }
    );
  }

  try {
    const pageStart = Date.now();

    // Step 1: Fetch the page HTML
    const pageResponse = await fetch(cleanUrl, {
      method: 'GET',
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!pageResponse.ok) {
      return NextResponse.json(
        { error: `无法抓取页面 (HTTP ${pageResponse.status})，请确认网址可访问` },
        { status: 422 }
      );
    }

    const html = await pageResponse.text();
    const contentType = pageResponse.headers.get('content-type') || '';

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return NextResponse.json(
        { error: `页面不是 HTML（${contentType}），无法提取链接` },
        { status: 422 }
      );
    }

    // Step 2: Parse HTML and extract links
    const $ = cheerio.load(html);
    const pageTitle = $('title').first().text().trim() || '无标题';
    const baseUrl = $('base').attr('href') || cleanUrl;

    const linkSet = new Set<string>();
    const linkEntries: { href: string; text: string }[] = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim() || href;

      if (!href || isSkippable(href)) return;

      const normalized = normalizeUrl(href, baseUrl);
      if (!normalized) return;

      // Deduplicate
      const key = normalized.toLowerCase().replace(/\/$/, '');
      if (linkSet.has(key)) return;
      linkSet.add(key);

      linkEntries.push({ href: normalized, text });
    });

    // Step 3: Batch check all links
    const baseDomain = getBaseDomain(cleanUrl);
    const results = await checkLinksInBatches(linkEntries, baseDomain);

    // Step 4: Compute summary
    const summary = {
      healthy: results.filter(r => r.category === 'healthy').length,
      redirect: results.filter(r => r.category === 'redirect').length,
      broken: results.filter(r => r.category === 'broken').length,
      error: results.filter(r => r.category === 'error').length,
      skipped: Math.max(0, linkEntries.length - results.length),
      internal: results.filter(r => r.isInternal).length,
      external: results.filter(r => !r.isInternal).length,
    };

    const totalFetchTime = Date.now() - pageStart;

    const result: InspectResult = {
      pageUrl: cleanUrl,
      pageTitle,
      totalLinks: linkEntries.length,
      checkedLinks: results.length,
      skippedLinks: Math.max(0, linkEntries.length - results.length),
      results,
      summary,
      fetchTime: totalFetchTime,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: `检查失败: ${err?.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
