/**
 * /api/seo/analyze — SEO页面诊断API
 * 壁垒产品：爬取+结构化分析，不是AI问答能解决的
 * 验证：Module 9 (爬虫) + Module 10 (数据能力) 的综合应用
 */

import { NextRequest, NextResponse } from 'next/server';
import SEOAudit from '../../../../models/SEOAudit';
import { appCache } from '../../../../lib/cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, userId } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '请提供有效的URL' }, { status: 400 });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json({ error: 'URL格式不正确' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = `seo:audit:${normalizedUrl}`;
    const cached = appCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...(cached as any),
        cached: true,
      });
    }

    // Run analysis
    const result = await (SEOAudit.analyze as any)(normalizedUrl);

    // Save to history if user is logged in
    let saved = null;
    if (userId) {
      try {
        saved = await (SEOAudit.save as any)(userId, result);
      } catch (err) {
        console.log('[seo] Failed to save history:', (err as any).message);
      }
    }

    // Cache for 5 minutes (TTL较短，因为页面内容可能变化)
    appCache.set(cacheKey, { ...result, saved }, { ttl: 300_000 });

    return NextResponse.json({
      ...result,
      saved,
      cached: false,
    });
  } catch (error: any) {
    console.error('[seo] Analysis error:', error.message);
    return NextResponse.json(
      { error: error.message || '分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}
