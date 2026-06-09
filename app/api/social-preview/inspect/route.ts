/**
 * Social Preview Inspector API
 * 抓取目标页面 → 提取 OG / Twitter / 通用 meta 标签
 * 分析标签完整性，给出优化建议
 */

import { NextRequest, NextResponse } from 'next/server';

// ============ Types ============

export interface MetaTag {
  name: string;
  content: string;
  type: 'og' | 'twitter' | 'standard' | 'other';
}

export interface MissingTag {
  tag: string;
  severity: 'error' | 'warning' | 'info';
  reason: string;
}

export interface JsonLdSchema {
  type: string;
  valid: boolean;
  content: string;
  fields: string[];
  issues: string[];
}

export interface SocialPreviewResult {
  url: string;
  finalUrl: string;
  title: string;
  status: number;
  responseTime: number;
  description: string;
  favicon: string;
  tags: MetaTag[];
  summary: {
    og: { count: number; complete: boolean };
    twitter: { count: number; complete: boolean };
    standard: { count: number };
    hasFavicon: boolean;
  };
  missing: MissingTag[];
  preview: {
    facebook: { title: string; description: string; image: string; url: string; };
    twitter: { title: string; description: string; image: string; url: string; };
  };
  errors: string[];
  /** @deprecated Use structuredData instead */
  jsonld?: JsonLdSchema[];
  structuredData: {
    schemas: JsonLdSchema[];
    count: number;
    types: string[];
    score: 'good' | 'fair' | 'poor';
  };
}

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

function extractJsonLd(html: string, baseUrl: string): JsonLdSchema[] {
  const schemas: JsonLdSchema[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      // Handle @graph arrays
      const items = parsed['@graph'] || [parsed];
      for (const item of (Array.isArray(items) ? items : [items])) {
        const type = item['@type'] || 'Unknown';
        const fields = Object.keys(item).filter(k => !k.startsWith('@'));
        const issues: string[] = [];
        // Validate common required fields
        if (!item.description && !item['@id']) {
          issues.push('缺少 description 字段');
        }
        if (!item.name && type !== 'WebPage') {
          issues.push('缺少 name 字段');
        }
        schemas.push({
          type: Array.isArray(type) ? type.join(' / ') : type,
          valid: issues.length === 0,
          content: JSON.stringify(item, null, 2),
          fields,
          issues,
        });
      }
    } catch {
      // Invalid JSON, skip silently
    }
  }
  return schemas;
}

function getStructuredDataScore(schemas: JsonLdSchema[]): 'good' | 'fair' | 'poor' {
  if (schemas.length === 0) return 'poor';
  const validCount = schemas.filter(s => s.valid).length;
  if (schemas.length >= 2 && validCount === schemas.length) return 'good';
  if (validCount > 0) return 'fair';
  return 'poor';
}

function extractMetaTags(html: string): MetaTag[] {
  const tags: MetaTag[] = [];
  const patterns = [
    // OG tags: <meta property="og:..." content="...">
    ...html.matchAll(/<meta[^>]+property=["'](og:[^"']+)["'][^>]*content=["']([^"']*)["'][^>]*\/?>/gi),
    ...html.matchAll(/<meta[^>]+content=["']([^"']*)["'][^>]*property=["'](og:[^"']+)["'][^>]*\/?>/gi),
    // Twitter tags: <meta name="twitter:..." content="...">
    ...html.matchAll(/<meta[^>]+name=["'](twitter:[^"']+)["'][^>]*content=["']([^"']*)["'][^>]*\/?>/gi),
    ...html.matchAll(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["'](twitter:[^"']+)["'][^>]*\/?>/gi),
    // Standard meta (description, keywords, author, etc.)
    ...html.matchAll(/<meta[^>]+name=["'](description|keywords|author|viewport|robots|theme-color|application-name)["'][^>]*content=["']([^"']*)["'][^>]*\/?>/gi),
    ...html.matchAll(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["'](description|keywords|author|viewport|robots|theme-color|application-name)["'][^>]*\/?>/gi),
  ];

  for (const match of patterns) {
    if (!match || match.length < 3) continue;
    const name = (match[1] || match[2] || '').toLowerCase().trim();
    const content = (match[2] || match[1] || '').trim();
    if (!name || !content) continue;

    let type: MetaTag['type'] = 'other';
    if (name.startsWith('og:')) type = 'og';
    else if (name.startsWith('twitter:')) type = 'twitter';
    else if (['description', 'keywords', 'author', 'viewport', 'robots', 'theme-color', 'application-name'].includes(name)) type = 'standard';

    // Deduplicate — keep first occurrence
    if (!tags.some(t => t.name === name)) {
      tags.push({ name, content, type });
    }
  }

  return tags;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractFavicon(html: string, baseUrl: string): string {
  const patterns = [
    /<link[^>]+rel=["']?icon["']?[^>]+href=["']([^"']+)["']/i,
    /<link[^>]+rel=["']?shortcut icon["']?[^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']?icon["']?/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']?shortcut icon["']?/i,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      let href = m[1];
      if (!href.startsWith('http')) {
        try {
          href = new URL(href, baseUrl).href;
        } catch { /* skip */ }
      }
      return href;
    }
  }
  return `${baseUrl}/favicon.ico`;
}

function checkMissingTags(tags: MetaTag[], html: string): MissingTag[] {
  const missing: MissingTag[] = [];
  const tagNames = new Set(tags.map(t => t.name));

  // OG tags
  if (!tagNames.has('og:title')) {
    missing.push({
      tag: 'og:title',
      severity: 'error',
      reason: '缺少 og:title，社交分享时将使用页面标题，可能不够精准',
    });
  } else {
    const t = tags.find(t => t.name === 'og:title')!;
    if (t.content.length < 10) {
      missing.push({
        tag: 'og:title',
        severity: 'warning',
        reason: 'og:title 太短（仅 ' + t.content.length + ' 字），建议 20-60 字',
      });
    }
    if (t.content.length > 80) {
      missing.push({
        tag: 'og:title',
        severity: 'warning',
        reason: 'og:title 过长（' + t.content.length + ' 字），Facebook 可能截断，建议 40-60 字',
      });
    }
  }

  if (!tagNames.has('og:description')) {
    missing.push({
      tag: 'og:description',
      severity: 'error',
      reason: '缺少 og:description，社交分享无摘要',
    });
  } else {
    const t = tags.find(t => t.name === 'og:description')!;
    if (t.content.length < 50) {
      missing.push({
        tag: 'og:description',
        severity: 'warning',
        reason: 'og:description 偏短（' + t.content.length + ' 字），建议 80-200 字',
      });
    }
    if (t.content.length > 300) {
      missing.push({
        tag: 'og:description',
        severity: 'warning',
        reason: 'og:description 过长（' + t.content.length + ' 字），可能被截断',
      });
    }
  }

  if (!tagNames.has('og:image')) {
    missing.push({
      tag: 'og:image',
      severity: 'error',
      reason: '缺少 og:image，分享时无配图，影响点击率',
    });
  }

  if (!tagNames.has('og:url')) {
    missing.push({
      tag: 'og:url',
      severity: 'info',
      reason: '缺少 og:url，建议指定规范 URL 避免分享时地址混乱',
    });
  }

  if (!tagNames.has('og:type')) {
    missing.push({
      tag: 'og:type',
      severity: 'info',
      reason: '缺少 og:type，默认使用 "website"，建议显式声明',
    });
  }

  // Twitter tags
  if (!tagNames.has('twitter:card')) {
    missing.push({
      tag: 'twitter:card',
      severity: 'warning',
      reason: '缺少 twitter:card，Twitter 分享显示效果受限。建议设为 "summary_large_image"',
    });
  }

  if (!tagNames.has('twitter:title')) {
    missing.push({
      tag: 'twitter:title',
      severity: 'info',
      reason: '缺少 twitter:title，Twitter 将使用 og:title 作为后备',
    });
  }

  if (!tagNames.has('twitter:description')) {
    missing.push({
      tag: 'twitter:description',
      severity: 'info',
      reason: '缺少 twitter:description，Twitter 将使用 og:description 作为后备',
    });
  }

  if (!tagNames.has('twitter:image')) {
    missing.push({
      tag: 'twitter:image',
      severity: 'info',
      reason: '缺少 twitter:image，Twitter 将使用 og:image 作为后备',
    });
  }

  // Standard meta
  if (!tagNames.has('description')) {
    missing.push({
      tag: 'description',
      severity: 'error',
      reason: '缺少 meta description，影响 SEO 搜索摘要显示',
    });
  }

  // Check charset
  if (!/charset=["']?utf-?8["']?/i.test(html) && !/<meta[^>]+charset\s*=/i.test(html)) {
    missing.push({
      tag: 'charset',
      severity: 'info',
      reason: '未显式声明 charset=utf-8，建议添加以保证正确编码',
    });
  }

  return missing;
}

// ============ Route Handler ============

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json(
      { error: '请提供 url 参数，如 ?url=example.com' },
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
    const start = Date.now();

    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SinmonikerSocialPreview/1.0; +https://sinmoniker.com/social-preview)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    const responseTime = Date.now() - start;
    const finalUrl = response.url || cleanUrl;
    const html = await response.text();

    // Extract tags
    const tags = extractMetaTags(html);
    const pageTitle = extractTitle(html);
    const favicon = extractFavicon(html, new URL(finalUrl).origin);

    // Build summary
    const ogTags = tags.filter(t => t.type === 'og');
    const twitterTags = tags.filter(t => t.type === 'twitter');
    const standardTags = tags.filter(t => t.type === 'standard');

    const requiredOg = ['og:title', 'og:description', 'og:image'];
    const requiredTwitter = ['twitter:card', 'twitter:title', 'twitter:description'];
    const ogComplete = requiredOg.every(t => tags.some(tg => tg.name === t));
    const twitterComplete = requiredTwitter.every(t => tags.some(tg => tg.name === t));

    // Extract JSON-LD / Schema.org
    const jsonld = extractJsonLd(html, new URL(finalUrl).origin);
    const jsonldTypes = [...new Set(jsonld.map(s => s.type))];

  // Check missing
    const missing = checkMissingTags(tags, html);

    // Add JSON-LD checks to missing
    if (jsonld.length === 0) {
      missing.push({
        tag: 'structured-data (JSON-LD)',
        severity: 'info',
        reason: '未检测到 JSON-LD / Schema.org 结构化数据，添加后可提升搜索引擎对页面内容的理解',
      });
    }
    const hasArticle = jsonldTypes.some(t => t.includes('Article') || t.includes('BlogPosting'));
    if (jsonld.length > 0 && !hasArticle) {
      missing.push({
        tag: 'Article/NewsArticle structured data',
        severity: 'info',
        reason: '未检测到 Article 类型的结构化数据，建议为内容页添加 Article Schema',
      });
    }
    const invalidSchemas = jsonld.filter(s => !s.valid);
    for (const s of invalidSchemas) {
      missing.push({
        tag: `Invalid JSON-LD (${s.type})`,
        severity: 'warning',
        reason: `${s.type} 结构化数据存在验证问题：${s.issues.join('; ')}`,
      });
    }

    // Build preview data
    const ogTitle = tags.find(t => t.name === 'og:title')?.content || pageTitle;
    const ogDesc = tags.find(t => t.name === 'og:description')?.content ||
      tags.find(t => t.name === 'description')?.content || '';
    const ogImage = tags.find(t => t.name === 'og:image')?.content || '';
    const ogUrl = tags.find(t => t.name === 'og:url')?.content || finalUrl;

    const twitterTitle = tags.find(t => t.name === 'twitter:title')?.content || ogTitle;
    const twitterDesc = tags.find(t => t.name === 'twitter:description')?.content || ogDesc;
    const twitterImage = tags.find(t => t.name === 'twitter:image')?.content || ogImage;

    const errors: string[] = [];

    const result: SocialPreviewResult = {
      url: cleanUrl,
      finalUrl,
      title: pageTitle,
      status: response.status,
      responseTime,
      description: tags.find(t => t.name === 'description')?.content || '',
      favicon,
      tags,
      summary: {
        og: { count: ogTags.length, complete: ogComplete },
        twitter: { count: twitterTags.length, complete: twitterComplete },
        standard: { count: standardTags.length },
        hasFavicon: favicon.length > 0,
      },
      missing,
      preview: {
        facebook: { title: ogTitle, description: ogDesc, image: ogImage, url: ogUrl },
        twitter: { title: twitterTitle, description: twitterDesc, image: twitterImage, url: ogUrl },
      },
      errors,
      jsonld,
      structuredData: {
        schemas: jsonld,
        count: jsonld.length,
        types: jsonldTypes,
        score: getStructuredDataScore(jsonld),
      },
    };

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: `抓取失败: ${err?.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
