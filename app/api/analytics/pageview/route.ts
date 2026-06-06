import { NextRequest, NextResponse } from "next/server";

// Simple in-memory analytics store
// In production, this would write to a database or file
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
    const body = await request.json();
    const { page, referrer, timestamp, userAgent, screen } = body;

    pageViews.push({
      page: page || "/",
      referrer: referrer || "(direct)",
      timestamp: timestamp || new Date().toISOString(),
      userAgent: (userAgent || "").slice(0, 200),
      screen: screen || "",
    });

    // Keep memory bounded
    if (pageViews.length > MAX_RECORDS) {
      pageViews.splice(0, pageViews.length - MAX_RECORDS);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET() {
  // Aggregate page views for dashboard
  const pageSummary: Record<string, number> = {};
  const referrerSummary: Record<string, number> = {};
  let uniqueSessions = new Set<string>();

  for (const pv of pageViews) {
    pageSummary[pv.page] = (pageSummary[pv.page] || 0) + 1;
    referrerSummary[pv.referrer] = (referrerSummary[pv.referrer] || 0) + 1;
    // Simple unique session detection by IP proxy — using (userAgent + screen)
    uniqueSessions.add(`${pv.userAgent}|${pv.screen}`);
  }

  return NextResponse.json({
    total: pageViews.length,
    uniqueSessions: uniqueSessions.size,
    pages: Object.entries(pageSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
    referrers: Object.entries(referrerSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
    lastUpdated: new Date().toISOString(),
  });
}
