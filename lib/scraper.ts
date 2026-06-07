// lib/scraper.ts
// 爬虫核心模块 — 模块9：爬虫入门
//
// 功能：
// 1. 基础HTML爬取：fetch + cheerio 解析
// 2. 动态页面爬取：puppeteer 无头浏览器
// 3. 反爬策略：User-Agent伪装、请求间隔
// 4. 数据清洗：提取结构化数据

import * as cheerio from 'cheerio';
import { URL } from 'url';

// ============ 配置 ============

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

const REQUEST_TIMEOUT = 15000; // 15 seconds
const MIN_REQUEST_INTERVAL = 1000; // 1 second minimum between requests

// ============ 类型定义 ============

export interface ScrapedPage {
  url: string;
  title: string;
  metaDescription: string;
  metaKeywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  links: {
    internal: { text: string; href: string }[];
    external: { text: string; href: string }[];
  };
  images: { src: string; alt: string }[];
  textContent: string;
  wordCount: number;
  statusCode: number;
  fetchTime: number; // ms
  robotsTxt?: string;
}

export interface ScrapeOptions {
  /** Use puppeteer for JS-rendered pages */
  dynamic?: boolean;
  /** Custom user agent */
  userAgent?: string;
  /** Timeout in ms */
  timeout?: number;
  /** Extract full text content */
  extractText?: boolean;
  /** Maximum links to extract (0 = unlimited) */
  maxLinks?: number;
}

export interface DomainInfo {
  domain: string;
  title: string;
  description: string;
  keywords: string[];
  hasOGTags: boolean;
  hasTwitterCard: boolean;
  h1Count: number;
  h2Count: number;
  imgCount: number;
  imgWithAlt: number;
  internalLinks: number;
  externalLinks: number;
  wordCount: number;
  hasFavicon: boolean;
  hasSitemap: boolean;
  fetchTime: number;
  statusCode: number;
}

// ============ 工具函数 ============

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function normalizeUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).href.split('#')[0]; // Remove fragments
  } catch {
    return null;
  }
}

function isInternalUrl(url: string, baseDomain: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === baseDomain || u.hostname.endsWith('.' + baseDomain);
  } catch {
    return false;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ 核心爬取函数 ============

/**
 * 基础爬取：使用 fetch + cheerio 解析静态HTML
 */
export async function scrapePage(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapedPage> {
  const startTime = Date.now();
  const userAgent = options.userAgent || getRandomUserAgent();
  const timeout = options.timeout || REQUEST_TIMEOUT;

  // 礼貌性延迟
  await sleep(MIN_REQUEST_INTERVAL);

  // 发送请求
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const html = await response.text();
    const fetchTime = Date.now() - startTime;
    const $ = cheerio.load(html);

    // 域名信息
    const domain = extractDomain(url);
    const baseUrl = `${new URL(url).protocol}//${domain}`;

    // 提取meta标签
    const metaDescription =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';
    const metaKeywords =
      $('meta[name="keywords"]').attr('content') || '';
    const ogTitle =
      $('meta[property="og:title"]').attr('content') || '';
    const ogDescription =
      $('meta[property="og:description"]').attr('content') || '';
    const ogImage =
      $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || '';

    // 提取标题
    const title = $('title').text().trim() || ogTitle || '';

    // 提取标题
    const headings = {
      h1: $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean),
      h2: $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean),
      h3: $('h3').map((_, el) => $(el).text().trim()).get().filter(Boolean),
    };

    // 提取链接
    const maxLinks = options.maxLinks || 100;
    const links: { text: string; href: string }[] = [];
    $('a[href]').each((_, el) => {
      if (maxLinks > 0 && links.length >= maxLinks) return false;
      const href = $(el).attr('href')!;
      const text = $(el).text().trim().substring(0, 100);
      const normalized = normalizeUrl(href, baseUrl);
      if (normalized) {
        links.push({ text, href: normalized });
      }
    });

    const internal = links.filter((l) => isInternalUrl(l.href, domain));
    const external = links.filter((l) => !isInternalUrl(l.href, domain) && !l.href.startsWith('mailto:'));

    // 提取图片
    const images: { src: string; alt: string }[] = [];
    $('img[src]').each((_, el) => {
      const src = normalizeUrl($(el).attr('src')!, baseUrl);
      const alt = $(el).attr('alt') || '';
      if (src) {
        images.push({ src, alt });
      }
    });

    // 提取文本内容
    let textContent = '';
    if (options.extractText) {
      // Remove script, style, nav, footer
      $('script, style, nav, footer, header, noscript').remove();
      textContent = $('body').text().replace(/\s+/g, ' ').trim();
    }

    const wordCount = $('body').text().replace(/\s+/g, ' ').trim().length;

    return {
      url,
      title,
      metaDescription,
      metaKeywords,
      ogTitle,
      ogDescription,
      ogImage,
      headings,
      links: { internal, external },
      images,
      textContent,
      wordCount,
      statusCode: response.status,
      fetchTime,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const fetchTime = Date.now() - startTime;
    throw new Error(`Failed to scrape ${url}: ${error.message}`);
  }
}

/**
 * 获取域名整体信息（SEO诊断用）
 */
export async function getDomainInfo(url: string): Promise<DomainInfo> {
  const page = await scrapePage(url, { extractText: false, maxLinks: 50 });

  // 尝试获取 robots.txt 和 sitemap
  const domain = extractDomain(url);
  const protocol = new URL(url).protocol;
  const baseUrl = `${protocol}//${domain}`;

  let hasSitemap = false;
  try {
    const sitemapResp = await fetch(`${baseUrl}/sitemap.xml`, {
      signal: AbortSignal.timeout(5000),
    });
    hasSitemap = sitemapResp.ok;
  } catch {
    hasSitemap = false;
  }

  let hasFavicon = false;
  try {
    const faviconResp = await fetch(`${baseUrl}/favicon.ico`, {
      signal: AbortSignal.timeout(3000),
      method: 'HEAD',
    });
    hasFavicon = faviconResp.ok;
  } catch {
    hasFavicon = false;
  }

  return {
    domain,
    title: page.title,
    description: page.metaDescription,
    keywords: page.metaKeywords
      ? page.metaKeywords.split(/[,，]/).map((k) => k.trim()).filter(Boolean)
      : [],
    hasOGTags: !!(page.ogTitle || page.ogDescription || page.ogImage),
    hasTwitterCard: !!page.ogImage,
    h1Count: page.headings.h1.length,
    h2Count: page.headings.h2.length,
    imgCount: page.images.length,
    imgWithAlt: page.images.filter((img) => img.alt).length,
    internalLinks: page.links.internal.length,
    externalLinks: page.links.external.length,
    wordCount: page.wordCount,
    hasFavicon,
    hasSitemap,
    fetchTime: page.fetchTime,
    statusCode: page.statusCode,
  };
}

/**
 * 批量爬取多个URL（带间隔限制）
 */
export async function scrapePages(
  urls: string[],
  options: ScrapeOptions = {}
): Promise<(ScrapedPage | { url: string; error: string })[]> {
  const results: (ScrapedPage | { url: string; error: string })[] = [];

  for (const url of urls) {
    try {
      const result = await scrapePage(url, options);
      results.push(result);
    } catch (error: any) {
      results.push({ url, error: error.message });
    }
    // 间隔请求，避免被ban
    await sleep(MIN_REQUEST_INTERVAL + Math.random() * 1000);
  }

  return results;
}

/**
 * 检查 robots.txt 是否允许爬取
 */
export async function checkRobotsTxt(url: string): Promise<{
  allowed: boolean;
  rules: { path: string; allowed: boolean }[];
}> {
  const domain = extractDomain(url);
  const protocol = new URL(url).protocol;
  const robotsUrl = `${protocol}//${domain}/robots.txt`;

  try {
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { allowed: true, rules: [] }; // No robots.txt = assume allowed
    }

    const text = await response.text();
    const rules: { path: string; allowed: boolean }[] = [];
    let currentAgent = '';
    const targetPath = new URL(url).pathname;

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('User-agent:')) {
        currentAgent = trimmed.split(':')[1].trim();
      } else if (trimmed.startsWith('Disallow:') && currentAgent === '*') {
        const disallowPath = trimmed.split(':').slice(1).join(':').trim();
        if (disallowPath) {
          rules.push({ path: disallowPath, allowed: false });
        }
      } else if (trimmed.startsWith('Allow:') && currentAgent === '*') {
        const allowPath = trimmed.split(':').slice(1).join(':').trim();
        if (allowPath) {
          rules.push({ path: allowPath, allowed: true });
        }
      }
    }

    // Check if our path matches any disallow rule
    const matchingRule = rules.find((r) => targetPath.startsWith(r.path));
    const allowed = matchingRule ? matchingRule.allowed : true;

    return { allowed, rules };
  } catch {
    return { allowed: true, rules: [] };
  }
}
