// app/api/sitemap-inspector/inspect/route.ts
// 🗺️ Sitemap Inspector API
// 服务端 XML 抓取 + sitemap 协议验证 + 多层索引追踪 + 质量评分

import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// Types
// ============================================================

interface SitemapUrl {
  loc: string;
  lastmod: string | null;
  changefreq: string | null;
  priority: number | null;
}

interface SitemapIndexEntry {
  loc: string;
  lastmod: string | null;
}

interface SitemapIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  detail: string;
}

interface SitemapResult {
  url: string;
  type: 'sitemap' | 'sitemapindex';
  totalUrls: number;
  urls: SitemapUrl[];
  childSitemaps: SitemapIndexEntry[];
  resolvedChildren: SitemapResult[];
  issues: SitemapIssue[];
  score: number;
  fileSize: number;
  namespaces: string[];
  timestamp: string;
}

// ============================================================
// URL Helpers
// ============================================================

function normalizeUrl(url: string): string {
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function resolveUrl(baseUrl: string, relative: string): string {
  try {
    return new URL(relative, baseUrl).href;
  } catch {
    return relative;
  }
}

function getFileExtension(url: string): string {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\.([a-z]+)(?:\?|$)/i);
  return match ? match[1].toLowerCase() : '';
}

// ============================================================
// Sitemap Regex Patterns
// ============================================================

function extractTextBetween(text: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function extractTagAttribute(text: string, tag: string, attr: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*\\s${attr}\\s*=\\s*["']([^"']*)["'][^>]*>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function parseSitemapUrls(xml: string): SitemapUrl[] {
  const urlBlocks = xml.match(/<url[\s>][\s\S]*?<\/url>/gi) || [];
  const urls: SitemapUrl[] = [];

  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc[^>]*>([\s\S]*?)<\/loc>/i);
    const loc = locMatch ? locMatch[1].trim() : '';
    if (!loc) continue;

    const lastmodMatch = block.match(/<lastmod[^>]*>([\s\S]*?)<\/lastmod>/i);
    const changefreqMatch = block.match(/<changefreq[^>]*>([\s\S]*?)<\/changefreq>/i);
    const priorityMatch = block.match(/<priority[^>]*>([\s\S]*?)<\/priority>/i);

    urls.push({
      loc,
      lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
      changefreq: changefreqMatch ? changefreqMatch[1].trim().toLowerCase() : null,
      priority: priorityMatch ? Math.round(parseFloat(priorityMatch[1].trim()) * 100) / 100 : null,
    });
  }

  return urls;
}

function parseSitemapIndex(xml: string): SitemapIndexEntry[] {
  const sitemapBlocks = xml.match(/<sitemap[\s>][\s\S]*?<\/sitemap>/gi) || [];
  const entries: SitemapIndexEntry[] = [];

  for (const block of sitemapBlocks) {
    const locMatch = block.match(/<loc[^>]*>([\s\S]*?)<\/loc>/i);
    const loc = locMatch ? locMatch[1].trim() : '';
    if (!loc) continue;

    const lastmodMatch = block.match(/<lastmod[^>]*>([\s\S]*?)<\/lastmod>/i);
    entries.push({
      loc,
      lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
    });
  }

  return entries;
}

function detectNamespaces(xml: string): string[] {
  const nsMatches = xml.match(/xmlns[^=]*=\s*["']([^"']+)["']/gi) || [];
  return nsMatches.map(m => {
    const valMatch = m.match(/["']([^"']+)["']/);
    return valMatch ? valMatch[1] : m;
  });
}

// ============================================================
// Validation & Scoring
// ============================================================

const VALID_CHANGEFREQ = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
const MAX_SITEMAP_URLS = 50000;
const MAX_SITEMAP_SIZE = 50 * 1024 * 1024; // 50MB (uncompressed)

function validateSitemap(
  urls: SitemapUrl[],
  type: 'sitemap' | 'sitemapindex',
  totalSize: number,
  depth: number
): SitemapIssue[] {
  const issues: SitemapIssue[] = [];

  // Size check
  if (totalSize > MAX_SITEMAP_SIZE) {
    issues.push({
      type: 'error',
      message: 'Sitemap 文件过大',
      detail: `文件大小 ${(totalSize / 1024 / 1024).toFixed(1)}MB，超过 50MB 限制。考虑分割 sitemap 或启用压缩。`,
    });
  }

  if (type === 'sitemap') {
    // URL count check
    if (urls.length === 0) {
      issues.push({
        type: 'error',
        message: 'Sitemap 为空',
        detail: '未找到任何 <url> 条目。请检查 XML 格式是否正确。',
      });
    } else if (urls.length > MAX_SITEMAP_URLS) {
      issues.push({
        type: 'error',
        message: 'URL 数量超限',
        detail: `当前 ${urls.length} 个 URL，超过 50,000 限制。需拆分为多个 sitemap 文件。`,
      });
    } else if (urls.length > 10000) {
      issues.push({
        type: 'warning',
        message: 'URL 数量较多',
        detail: `当前 ${urls.length} 个 URL，建议保持在 10,000 以内以优化搜索引擎爬取效率。`,
      });
    }

    // Individual URL validations
    const locs = new Set<string>();
    const duplicateLocs: string[] = [];
    let missingLoc = 0;
    let missingLastmod = 0;
    let invalidPriority = 0;
    let invalidChangefreq = 0;
    let httpUrls = 0;
    let orphanUrls = 0;

    for (const u of urls) {
      if (!u.loc) { missingLoc++; continue; }

      if (locs.has(u.loc)) duplicateLocs.push(u.loc);
      locs.add(u.loc);

      if (!u.lastmod) missingLastmod++;
      if (u.priority !== null && (u.priority < 0 || u.priority > 1)) invalidPriority++;
      if (u.changefreq && !VALID_CHANGEFREQ.includes(u.changefreq)) invalidChangefreq++;
      if (u.loc.startsWith('http://')) httpUrls++;
    }

    if (missingLoc > 0) {
      issues.push({
        type: 'error',
        message: `${missingLoc} 个 URL 缺少 <loc> 标签`,
        detail: '每个 <url> 必须包含 <loc> 标签。',
      });
    }

    if (duplicateLocs.length > 0) {
      issues.push({
        type: 'warning',
        message: `发现 ${duplicateLocs.length} 个重复 URL`,
        detail: `${duplicateLocs.slice(0, 3).join(', ')}${duplicateLocs.length > 3 ? ` 等 ${duplicateLocs.length} 个` : ''}`,
      });
    }

    if (missingLastmod > 0) {
      issues.push({
        type: 'info',
        message: `${missingLastmod} 个 URL 缺少 <lastmod> 标签`,
        detail: '搜索引擎建议为每个 URL 提供 lastmod 以辅助爬取决策。',
      });
    }

    if (invalidPriority > 0) {
      issues.push({
        type: 'warning',
        message: `${invalidPriority} 个 URL 的 priority 值无效`,
        detail: 'priority 必须在 0.0 到 1.0 之间。',
      });
    }

    if (invalidChangefreq > 0) {
      issues.push({
        type: 'warning',
        message: `${invalidChangefreq} 个 URL 的 changefreq 值无效`,
        detail: '有效值：always, hourly, daily, weekly, monthly, yearly, never',
      });
    }

    if (httpUrls > 0) {
      issues.push({
        type: 'warning',
        message: `${httpUrls} 个 URL 使用 HTTP 而非 HTTPS`,
        detail: '建议将所有 URL 升级为 HTTPS。',
      });
    }

    // Orphan detection - URLs not within the domain
    const domain = urls.length > 0 ? extractDomain(urls[0].loc) : null;
    if (domain) {
      for (const u of urls) {
        if (u.loc && extractDomain(u.loc) !== domain) {
          orphanUrls++;
        }
      }
      if (orphanUrls > 0) {
        issues.push({
          type: 'warning',
          message: `${orphanUrls} 个 URL 指向外部域名`,
          detail: `所有 URL 应该属于同一域名 (${domain})，否则搜索引擎可能无法正确索引。`,
        });
      }
    }
  }

  if (type === 'sitemapindex') {
    if (urls.length > MAX_SITEMAP_URLS) {
      issues.push({
        type: 'error',
        message: 'Sitemap Index 子 sitemap 超限',
        detail: `Sitemap index 最多包含 50,000 个子 sitemap。`,
      });
    }
  }

  return issues;
}

function calculateScore(
  urls: SitemapUrl[],
  issues: SitemapIssue[],
  type: 'sitemap' | 'sitemapindex',
  resolvedChildren: SitemapResult[]
): number {
  let score = 100;

  // Errors
  const errors = issues.filter(i => i.type === 'error').length;
  score -= errors * 15;

  // Warnings
  const warnings = issues.filter(i => i.type === 'warning').length;
  score -= warnings * 5;

  // Info
  const infos = issues.filter(i => i.type === 'info').length;
  score -= infos * 2;

  // Bonus: good lastmod coverage
  if (type === 'sitemap' && urls.length > 0) {
    const withLastmod = urls.filter(u => u.lastmod).length;
    const coverage = withLastmod / urls.length;
    if (coverage > 0.9) score += 5;
    else if (coverage > 0.7) score += 2;
  }

  // Deduction: no URLs
  if (urls.length === 0) {
    score -= 25;
  }

  // Bonus: child sitemaps resolved successfully
  if (type === 'sitemapindex' && resolvedChildren.length > 0) {
    const resolved = resolvedChildren.filter(c => c.issues.filter(i => i.type === 'error').length === 0).length;
    const ratio = resolved / resolvedChildren.length;
    if (ratio > 0.8) score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================================
// Main Analysis
// ============================================================

async function fetchXml(url: string): Promise<{ text: string; size: number; finalUrl: string; contentType: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SitemapInspector/1.0; +https://sinmoniker.com/sitemap-inspector)',
      'Accept': 'application/xml, text/xml, application/xhtml+xml, text/html;q=0.9, */*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });

  const text = await response.text();
  const size = new TextEncoder().encode(text).length;

  return {
    text,
    size,
    finalUrl: response.url,
    contentType: response.headers.get('content-type') || '',
  };
}

async function analyzeSitemap(
  targetUrl: string,
  depth: number = 0,
  maxDepth: number = 2
): Promise<SitemapResult> {
  const normalizedUrl = normalizeUrl(targetUrl);
  const { text, size, finalUrl, contentType } = await fetchXml(normalizedUrl);

  // Detect sitemap type
  const isSitemapIndex = /<sitemapindex[\s>]/i.test(text);
  const isSitemap = /<urlset[\s>]/i.test(text) || /<url[\s>][\s\S]*?<\/url>/i.test(text);

  if (!isSitemapIndex && !isSitemap) {
    // Maybe it's an HTML page with robots.txt link to sitemap
    if (contentType.includes('text/html')) {
      throw new Error('该 URL 返回的是 HTML 页面而非 XML Sitemap。请检查 URL 是否正确，或使用 robots.txt 中声明的 sitemap 地址。');
    }
    throw new Error('无法识别的 XML 格式：未找到 <urlset> 或 <sitemapindex> 标签。请确保 URL 指向有效的 XML Sitemap 文件。');
  }

  const namespaces = detectNamespaces(text);

  if (isSitemapIndex && isSitemap) {
    // Ambiguous - try sitemapindex first
  }

  if (isSitemapIndex && depth < maxDepth) {
    const childEntries = parseSitemapIndex(text);
    const resolvedChildren: SitemapResult[] = [];
    const allUrls: SitemapUrl[] = [];

    // Resolve child sitemaps (limited)
    const entriesToResolve = childEntries.slice(0, 20); // Max 20 child sitemaps
    for (const entry of entriesToResolve) {
      try {
        const childResult = await analyzeSitemap(entry.loc, depth + 1, maxDepth);
        resolvedChildren.push(childResult);
        allUrls.push(...childResult.urls);
      } catch (err: any) {
        resolvedChildren.push({
          url: entry.loc,
          type: 'sitemap',
          totalUrls: 0,
          urls: [],
          childSitemaps: [],
          resolvedChildren: [],
          issues: [{ type: 'error', message: '子 sitemap 加载失败', detail: err.message }],
          score: 0,
          fileSize: 0,
          namespaces: [],
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Info about non-resolved sitemaps
    if (childEntries.length > entriesToResolve.length) {
      const remaining = childEntries.length - entriesToResolve.length;
      resolvedChildren.push({
        url: '',
        type: 'sitemap',
        totalUrls: 0,
        urls: [],
        childSitemaps: [],
        resolvedChildren: [],
        issues: [{ type: 'info', message: `还有 ${remaining} 个子 sitemap 未解析`, detail: '仅限解析前 20 个子 sitemap。' }],
        score: 0,
        fileSize: 0,
        namespaces: [],
        timestamp: new Date().toISOString(),
      });
    }

    const issues = validateSitemap(allUrls, 'sitemapindex', size, depth);
    const score = calculateScore(allUrls, issues, 'sitemapindex', resolvedChildren);

    return {
      url: finalUrl,
      type: 'sitemapindex',
      totalUrls: allUrls.length,
      urls: allUrls,
      childSitemaps: childEntries,
      resolvedChildren,
      issues,
      score,
      fileSize: size,
      namespaces,
      timestamp: new Date().toISOString(),
    };
  }

  // Regular sitemap
  const urls = parseSitemapUrls(text);
  const issues = validateSitemap(urls, 'sitemap', size, depth);
  const score = calculateScore(urls, issues, 'sitemap', []);

  return {
    url: finalUrl,
    type: 'sitemap',
    totalUrls: urls.length,
    urls,
    childSitemaps: [],
    resolvedChildren: [],
    issues,
    score,
    fileSize: size,
    namespaces,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');

  if (!urlParam || !urlParam.trim()) {
    return NextResponse.json(
      { error: '请提供要检查的 Sitemap URL' },
      { status: 400 }
    );
  }

  try {
    // Validate URL format
    const testUrl = normalizeUrl(urlParam);
    new URL(testUrl);

    // Check if it looks like a sitemap
    const extension = getFileExtension(testUrl);
    if (extension && !['xml', 'gz', 'txt'].includes(extension) && !testUrl.includes('sitemap')) {
      // Not a sitemap extension, but still try
    }

    const result = await analyzeSitemap(urlParam);
    return NextResponse.json(result);
  } catch (err: any) {
    const message = err.message || '检查过程中发生错误';

    if (message.includes('fetch') || message.includes('fetch failed')) {
      return NextResponse.json(
        { error: `无法访问目标 URL，请检查 URL 是否正确或目标网站是否可访问` },
        { status: 502 }
      );
    }

    if (message.includes('Invalid URL') || message.includes('Invalid protocol')) {
      return NextResponse.json(
        { error: 'URL 格式无效，请输入有效的网址' },
        { status: 400 }
      );
    }

    if (message.includes('aborted') || message.includes('timeout')) {
      return NextResponse.json(
        { error: '请求超时（15秒），目标文件加载时间过长' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
