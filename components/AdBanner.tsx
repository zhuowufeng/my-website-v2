/**
 * AdBanner — 动态广告位组件
 *
 * 特性：
 * - 从数据库加载活跃广告位
 * - 追踪曝光和点击
 * - 支持自定义广告代码/脚本
 * - 支持 Google AdSense 代码注入
 * - 支持多种位置类型
 * - 回退到静态文案广告（当数据库不可用时）
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface AdData {
  id: number;
  name: string;
  position: string;
  source: string;
  ad_type: string;
  ad_code: string | null;
  ad_script: string | null;
  is_active: boolean;
  priority: number;
  max_impressions_per_session: number;
}

interface AdBannerProps {
  position?: 'bottom' | 'sidebar' | 'inline' | 'header' | 'footer';
  source?: string;
  className?: string;
}

// 静态回落广告文案（数据库不可用时展示）
const FALLBACK_ADS: Record<string, { icon: string; title: string; desc: string; cta: string }[]> = {
  default: [
    {
      icon: '🔥',
      title: 'Pro Membership',
      desc: 'Unlock unlimited usage, advanced SEO tools, scheduled diagnosis',
      cta: 'Upgrade',
    },
    {
      icon: '📝',
      title: 'AI Writing Assistant',
      desc: 'Generate high-quality SEO articles from any topic',
      cta: 'Try Free',
    },
  ],
  seo: [
    {
      icon: '⚡',
      title: 'Bulk SEO Diagnosis',
      desc: 'Analyze up to 100 pages at once, export reports as CSV',
      cta: 'Upgrade Pro',
    },
  ],
  global: [
    {
      icon: '⭐',
      title: 'Sinmoniker Pro',
      desc: 'Unlimited name generation + all tools without restrictions',
      cta: 'Learn More',
    },
  ],
};

// 位置样式映射
const POSITION_STYLES: Record<string, string> = {
  bottom: 'border border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-5',
  sidebar: 'border border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-4',
  inline: 'border border-gray-200 bg-gradient-to-r from-amber-50 to-teal-50 p-4',
  header: 'border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50 p-3',
  footer: 'border-t border-gray-200 bg-gradient-to-r from-gray-50 to-indigo-50 p-4',
};

const ICON_MAP: Record<string, string> = {
  default: '📢', seo: '⚡', global: '⭐',
};

// 广告曝光计数（每个session）
const impressionCounts = new Map<string, number>();

export default function AdBanner({ position = 'bottom', source = 'default', className = '' }: AdBannerProps) {
  const [ads, setAds] = useState<AdData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fallbackIdx, setFallbackIdx] = useState(0);
  const impressedIds = useRef<Set<number>>(new Set());
  const [dbAvailable, setDbAvailable] = useState<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 从后端加载广告
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/ads/placements?position=${position}&active=true`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.placements && data.placements.length > 0) {
          setAds(data.placements);
          setDbAvailable(true);
        } else {
          setDbAvailable(false);
        }
      })
      .catch(() => {
        if (!cancelled) setDbAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [position]);

  // 轮换回落广告
  const fallbackAds = FALLBACK_ADS[source] || FALLBACK_ADS.default;
  useEffect(() => {
    if (fallbackAds.length <= 1) return;
    const interval = setInterval(() => {
      setFallbackIdx(prev => (prev + 1) % fallbackAds.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [fallbackAds.length]);

  // 追踪事件
  const trackEvent = useCallback((adId: number, eventType: 'impression' | 'click') => {
    fetch('/api/ads/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        adId,
        pageUrl: window.location.pathname,
        userAgent: navigator.userAgent.substring(0, 300),
      }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  // 曝光追踪（可见性检测）
  useEffect(() => {
    if (loading || dbAvailable === null) return;
    if (!dbAvailable || ads.length === 0) return;

    const visibleAds = ads.filter(ad => {
      const key = `${ad.id}-${position}`;
      const count = impressionCounts.get(key) || 0;
      return count < ad.max_impressions_per_session;
    });

    if (visibleAds.length === 0 || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            visibleAds.forEach(ad => {
              const key = `${ad.id}-${position}`;
              const count = (impressionCounts.get(key) || 0) + 1;
              impressionCounts.set(key, count);

              if (!impressedIds.current.has(ad.id)) {
                impressedIds.current.add(ad.id);
                trackEvent(ad.id, 'impression');
              }
            });
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loading, dbAvailable, ads, position, trackEvent]);

  // 处理点击
  const handleClick = (ad: AdData) => {
    trackEvent(ad.id, 'click');
  };

  // 处理回落广告点击
  const handleFallbackClick = () => {
    trackEvent(0, 'click');
  };

  // 渲染数据库广告
  const renderDbAd = (ad: AdData) => {
    // 如果是 Google AdSense 脚本
    if (ad.ad_type === 'adsense' && ad.ad_code) {
      return (
        <div
          key={ad.id}
          ref={containerRef}
          className={`ad-container ${className}`}
          dangerouslySetInnerHTML={{ __html: ad.ad_code }}
        />
      );
    }

    // 如果有自定义HTML代码
    if (ad.ad_code) {
      return (
        <div
          key={ad.id}
          ref={containerRef}
          className={`ad-container ${className}`}
          dangerouslySetInnerHTML={{ __html: ad.ad_code }}
          onClick={() => handleClick(ad)}
        />
      );
    }

    // 默认样式广告
    const isSidebar = position === 'sidebar';
    return (
      <div
        key={ad.id}
        ref={containerRef}
        className={`rounded-xl overflow-hidden ${POSITION_STYLES[position] || POSITION_STYLES.bottom} ${className}`}
        onClick={() => handleClick(ad)}
      >
        <div className={`flex items-center gap-4 ${isSidebar ? 'flex-col text-center' : ''}`}>
          <div className="text-2xl flex-shrink-0">{ICON_MAP[ad.source] || '📢'}</div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-800">{ad.name}</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {ad.ad_code ? '✅ Custom ad configured' : 'Configure ad code in admin panel'}
            </p>
          </div>
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Ad</span>
        </div>
      </div>
    );
  };

  // 渲染回落广告
  const renderFallbackAd = () => {
    if (fallbackAds.length === 0) return null;

    const ad = fallbackAds[fallbackIdx % fallbackAds.length];
    const isSidebar = position === 'sidebar';

    return (
      <div
        ref={containerRef}
        className={`
          rounded-xl overflow-hidden border border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50
          ${POSITION_STYLES[position] || POSITION_STYLES.bottom}
          transition-all duration-300 hover:shadow-md ${className}
        `}
      >
        <div className={`flex items-center gap-4 ${isSidebar ? 'flex-col text-center' : ''}`}>
          <div className="text-2xl flex-shrink-0">{ad.icon}</div>
          <div className={`flex-1 ${isSidebar ? '' : ''}`}>
            <h4 className="text-sm font-semibold text-gray-800">{ad.title}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{ad.desc}</p>
          </div>
          <button
            onClick={handleFallbackClick}
            className={`
              flex-shrink-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white
              text-xs font-medium rounded-lg hover:from-indigo-700 hover:to-blue-700
              transition-all shadow-sm whitespace-nowrap cursor-pointer
              ${isSidebar ? 'w-full py-2' : 'px-4 py-2'}
            `}
          >
            {ad.cta} →
          </button>
        </div>
      </div>
    );
  };

  // 加载状态
  if (loading) {
    return (
      <div className={`rounded-xl bg-gray-50 border border-gray-100 animate-pulse ${POSITION_STYLES[position] || POSITION_STYLES.bottom} ${className}`}>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-1/3" />
            <div className="h-2 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // 数据库可用且有广告 → 渲染数据库广告
  if (dbAvailable && ads.length > 0) {
    return <>{ads.map(renderDbAd)}</>;
  }

  // 数据库不可用或无广告 → 渲染回落广告
  return <>{renderFallbackAd()}</>;
}
