"use client";

import { useEffect, useRef } from "react";

/**
 * Simple self-hosted page view analytics.
 * Stores page views in localStorage for now.
 * When a backend analytics API is ready, send data there instead.
 */
export default function Analytics() {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    const pageUrl = window.location.pathname;
    const referrer = document.referrer || "(direct)";
    const timestamp = new Date().toISOString();

    // 1. Local storage tracking (for immediate feedback)
    try {
      const key = "analytics_pageviews";
      const raw = localStorage.getItem(key);
      const views: Record<string, { count: number; lastVisit: string; referrers: Record<string, number> }> =
        raw ? JSON.parse(raw) : {};

      if (!views[pageUrl]) {
        views[pageUrl] = { count: 0, lastVisit: "", referrers: {} };
      }
      views[pageUrl].count += 1;
      views[pageUrl].lastVisit = timestamp;
      views[pageUrl].referrers[referrer] = (views[pageUrl].referrers[referrer] || 0) + 1;

      localStorage.setItem(key, JSON.stringify(views));
    } catch {
      // localStorage might be full or disabled
    }

    // 2. Send to backend API (fire-and-forget)
    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: pageUrl,
        referrer,
        timestamp,
        userAgent: navigator.userAgent.slice(0, 200),
        screen: `${window.innerWidth}x${window.innerHeight}`,
      }),
      // Keep alive so it doesn't block page unload
      keepalive: true,
    }).catch(() => {
      // silently fail — analytics shouldn't break the user experience
    });
  }, []);

  return null; // This component doesn't render anything
}
