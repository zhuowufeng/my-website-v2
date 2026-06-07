import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import logger from '@/lib/logger';

// In-memory analytics (生产环境应写数据库)
const pageViews: Array<{
  page: string;
  referrer: string;
  timestamp: string;
  userAgent: string;
  screen: string;
}> = [];

const MAX_RECORDS = 10000;

export async function POST(request: NextRequest) {
  try {
    // Rate limit: pageviews are high-frequency, so allow more
    const rateCheck = checkRateLimit(request, {
      windowMs: 60000,
      maxRequests: 100,
    });
    if (!rateCheck.allowed) {
      // Don't block silently — just return ok
      return NextResponse.json({ ok: true });
    }

    const body = await request.json();
    const { page, referrer, timestamp, userAgent, screen } = body;

    // Input validation & sanitization
    const sanitizedPage = (page || "/").replace(/[<>]/g, '').substring(0, 500);
    const sanitizedReferrer = (referrer || "(direct)").replace(/[<>]/g, '').substring(0, 500);

    pageViews.push({
      page: sanitizedPage,
      referrer: sanitizedReferrer,
      timestamp: timestamp || new Date().toISOString(),
      userAgent: (userAgent || "").slice(0, 200),
      screen: (screen || "").slice(0, 100),
    });

    if (pageViews.length > MAX_RECORDS) {
      pageViews.splice(0, pageViews.length - MAX_RECORDS);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET() {
  // Dashboard endpoint — in production, protect with auth
  const pageSummary: Record<string, number> = {};
  const referrerSummary: Record<string, number> = {};
  let uniqueKeys = new Set<string>();

  for (const pv of pageViews) {
    pageSummary[pv.page] = (pageSummary[pv.page] || 0) + 1;
    referrerSummary[pv.referrer] = (referrerSummary[pv.referrer] || 0) + 1;
    uniqueKeys.add(`${pv.userAgent}|${pv.screen}`);
  }

  return NextResponse.json({
    total: pageViews.length,
    uniqueSessions: uniqueKeys.size,
    pages: Object.entries(pageSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
    referrers: Object.entries(referrerSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
    lastUpdated: new Date().toISOString(),
  });
}
