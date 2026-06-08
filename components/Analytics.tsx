"use client";

import { useEffect, useRef } from "react";

/**
 * 页面分析组件
 * 
 * 1. 本地 localStorage 追踪（即时反馈）
 * 2. 后端 API 持久化（PostgreSQL）
 * 3. 广告事件追踪（与 AdBanner 配合）
 */
export default function Analytics() {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    const pageUrl = window.location.pathname;
    const referrer = document.referrer || "(direct)";
    const timestamp = new Date().toISOString();
    const screenSize = `${window.innerWidth}x${window.innerHeight}`;

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

    // 2. Send to backend analytics API (fire-and-forget, to PostgreSQL)
    fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "pageview",
        pageUrl,
        referrer: referrer.substring(0, 500),
        userAgent: navigator.userAgent.slice(0, 300),
        screenSize,
      }),
      keepalive: true,
    }).catch(() => {
      // silently fail
    });

    // 3. Also send to legacy API for backward compatibility
    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: pageUrl,
        referrer,
        timestamp,
        userAgent: navigator.userAgent.slice(0, 200),
        screen: screenSize,
      }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
