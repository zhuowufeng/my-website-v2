/**
 * UsageTracker — 使用量追踪 + 变现组件
 * 
 * 功能：
 * - 每日免费诊断次数限制（10次/天）
 * - localStorage 持久化
 * - 次数快用完时展示Pro升级提示
 * - 次数用完时展示付费墙
 * 
 * 用法：
 * import UsageTracker from '@/components/UsageTracker';
 * <UsageTracker action="seo_analysis" />
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface UsageState {
  date: string;
  [key: string]: number | string;
}

const FREE_LIMITS: Record<string, number> = {
  seo_analysis: 5,    // 单个SEO诊断
  batch_analysis: 2,  // 批量SEO诊断
  scheduler: 3,       // 定时任务
  article_gen: 3,     // 文章生成
  dashboard: 10,      // 数据看板
};

interface UsageTrackerProps {
  action: keyof typeof FREE_LIMITS;
  onLimitReached?: () => void;
  showBanner?: boolean;
}

export default function UsageTracker({ action, onLimitReached, showBanner = true }: UsageTrackerProps) {
  const [usage, setUsage] = useState<number>(0);
  const [limit, setLimit] = useState(FREE_LIMITS[action] || 5);
  const [isMounted, setIsMounted] = useState(false);

  const getToday = () => new Date().toISOString().split('T')[0];

  const loadUsage = useCallback(() => {
    if (typeof window === 'undefined') return;
    const today = getToday();
    const raw = localStorage.getItem('usage_tracker');
    if (raw) {
      const data: UsageState = JSON.parse(raw);
      if (data.date === today) {
        const count = (data[action] as number) || 0;
        setUsage(count);
      } else {
        // 新的一天，重置
        localStorage.setItem('usage_tracker', JSON.stringify({ date: today }));
        setUsage(0);
      }
    } else {
      localStorage.setItem('usage_tracker', JSON.stringify({ date: today }));
      setUsage(0);
    }
  }, [action]);

  const increment = useCallback(() => {
    if (typeof window === 'undefined') return;
    const today = getToday();
    const raw = localStorage.getItem('usage_tracker');
    const data: UsageState = raw ? JSON.parse(raw) : { date: today };
    if (data.date !== today) {
      // 跨天了，重置
      const newData: UsageState = { date: today, [action]: 1 };
      localStorage.setItem('usage_tracker', JSON.stringify(newData));
      setUsage(1);
      return;
    }
    const newCount = ((data[action] as number) || 0) + 1;
    data[action] = newCount;
    localStorage.setItem('usage_tracker', JSON.stringify(data));
    setUsage(newCount);
  }, [action]);

  useEffect(() => {
    loadUsage();
    setIsMounted(true);
  }, [loadUsage]);

  const remaining = Math.max(0, limit - usage);
  const isLimited = remaining <= 0;
  const isWarning = remaining <= 2 && remaining > 0;

  // Expose increment and check functions
  useEffect(() => {
    registerTracker(action, {
      increment,
      canUse: () => usage < limit,
      remaining: () => limit - usage,
    });
  }, [action, increment, usage, limit]);

  if (!isMounted || !showBanner) return null;

  if (isLimited) {
    return (
      <div className="bg-gradient-to-r from-amber-900/80 to-orange-900/80 border border-amber-500/30 rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="text-white font-bold text-lg mb-2">今日免费次数已用完</h3>
        <p className="text-amber-200 text-sm mb-4">
          每天免费 {limit} 次 · 升级 Pro 解锁无限制使用
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => alert('🚀 Pro版本即将上线，敬请期待！')}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-400 hover:to-orange-400 transition shadow-lg"
          >
            ⭐ 升级 Pro
          </button>
          <button
            onClick={() => alert('明天再来吧！每天重置免费次数')}
            className="px-4 py-2.5 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 transition"
          >
            明天再来
          </button>
        </div>
        <p className="text-gray-500 text-xs mt-3">Pro 会员 · 无限诊断 · 优先队列 · 更多功能</p>
      </div>
    );
  }

  if (isWarning) {
    return (
      <div className="bg-amber-900/30 border border-amber-500/20 rounded-lg px-4 py-2.5 text-sm flex items-center justify-between">
        <span className="text-amber-200">
          ⚡ 今日免费次数还剩 <strong>{remaining}</strong> 次
        </span>
        <button
          onClick={() => alert('🚀 Pro版本即将上线！')}
          className="text-xs bg-amber-600/50 hover:bg-amber-600 text-white px-3 py-1 rounded transition"
        >
          升级 Pro 解锁无限
        </button>
      </div>
    );
  }

  return null;
}

// 全局存储（客户端专用）
let _globalUsageTracker: Record<string, { increment: () => void; canUse: () => boolean; remaining: () => number }> = {};

if (typeof window !== 'undefined') {
  (window as any).__usageTracker = (window as any).__usageTracker || {};
}

/**
 * 注册tracker到全局（由组件在mount时调用）
 */
export function registerTracker(
  action: string,
  tracker: { increment: () => void; canUse: () => boolean; remaining: () => number }
) {
  _globalUsageTracker[action] = tracker;
  if (typeof window !== 'undefined') {
    (window as any).__usageTracker[action] = tracker;
  }
}

/**
 * 检查当前action是否还能使用
 * 在API调用前调用
 */
export function canUse(action: string): boolean {
  const tracker = _globalUsageTracker[action];
  if (!tracker) return true;
  return tracker.canUse();
}

/**
 * 使用一次额度
 */
export function useOne(action: string): void {
  const tracker = _globalUsageTracker[action];
  if (tracker) {
    tracker.increment();
  }
}
