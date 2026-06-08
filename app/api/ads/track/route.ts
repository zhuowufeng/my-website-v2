// /api/ads/track — 广告事件追踪（曝光/点击）
import { NextRequest, NextResponse } from 'next/server';
import { trackAdEvent, trackPageView } from '@/models/AdPlacement';
import { checkRateLimit } from '@/lib/rate-limiter';

function getSessionId(request: NextRequest): string {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)mo-yan-session=([^;]+)/);
  if (match) return match[1];
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '0.0.0.0';
}

// POST — 追踪事件
export async function POST(request: NextRequest) {
  try {
    // 速率限制：每个IP每分钟最多100个追踪请求
    const rateCheck = checkRateLimit(request, {
      windowMs: 60000,
      maxRequests: 100,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json({ ok: true }); // 静默拒绝
    }

    const body = await request.json();
    const { eventType, adId, pageUrl, referrer, userAgent, screenSize } = body;

    const sessionId = getSessionId(request);

    if (eventType === 'pageview') {
      // 页面浏览追踪
      await trackPageView({
        pageUrl: (pageUrl || '/').substring(0, 500),
        referrer: (referrer || '(direct)').substring(0, 500),
        userAgent: (userAgent || '').substring(0, 300),
        screenSize: (screenSize || '').substring(0, 30),
        sessionId,
      });
    } else if (eventType === 'impression' || eventType === 'click') {
      // 广告事件追踪
      if (adId) {
        await trackAdEvent({
          adId: parseInt(adId),
          eventType,
          pageUrl: (pageUrl || '/').substring(0, 500),
          referrer: (referrer || '').substring(0, 500),
          userAgent: (userAgent || '').substring(0, 300),
          sessionId,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // 静默失败 — 追踪不应影响用户体验
    console.error('[ads/track] error:', err.message);
    return NextResponse.json({ ok: false });
  }
}
