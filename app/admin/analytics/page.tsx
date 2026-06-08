// app/admin/analytics/page.tsx — 数据分析与管理看板
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface OverviewData {
  totalPageviews: number;
  totalImpressions: number;
  totalClicks: number;
  ctr: string;
  days: number;
}

interface AdStat {
  ad_name: string;
  position: string;
  impressions: string;
  clicks: string;
  ctr: string;
}

interface PageStat {
  page_url: string;
  pageviews: string;
  unique_sessions: string;
  last_visit: string;
}

interface DailyStat {
  date: string;
  total_pageviews: string;
  total_sessions: string;
  total_ad_impressions: string;
  total_ad_clicks: string;
  daily_ctr: string;
}

interface SummaryData {
  overview: OverviewData;
  adStats: AdStat[];
  topPages: PageStat[];
  daily: DailyStat[];
}

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'ads' | 'pages' | 'daily'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ads/stats?type=summary&days=${days}`);
      if (!res.ok) {
        if (res.status === 401) {
          setError('需要登录。请先登录后再查看分析数据。');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setSummary(data);
    } catch (err: any) {
      setError('加载分析数据失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format number with commas
  const fmt = (n: string | number) => {
    const num = typeof n === 'string' ? parseInt(n) : n;
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  // Format percentage
  const pct = (v: string) => {
    const num = parseFloat(v);
    return isNaN(num) ? '0.00%' : num.toFixed(2) + '%';
  };

  if (error && !summary) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-3">🚫</div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">无法加载数据</h2>
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">📊 数据分析</h1>
          <p className="text-sm text-gray-500 mt-1">
            实时查看流量、广告表现和页面分析数据
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">时间范围:</span>
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${
                days === d
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}天
            </button>
          ))}
          <button
            onClick={fetchData}
            disabled={loading}
            className="ml-2 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading ? '刷新中...' : '🔄 刷新'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && !summary && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Overview Cards */}
      {summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">📄 总浏览量</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(summary.overview.totalPageviews)}</div>
              <div className="text-[10px] text-gray-400 mt-1">近{summary.overview.days}天</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">👁️ 广告曝光</div>
              <div className="text-2xl font-bold text-indigo-600">{fmt(summary.overview.totalImpressions)}</div>
              <div className="text-[10px] text-gray-400 mt-1">近{summary.overview.days}天</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">🖱️ 广告点击</div>
              <div className="text-2xl font-bold text-amber-600">{fmt(summary.overview.totalClicks)}</div>
              <div className="text-[10px] text-gray-400 mt-1">近{summary.overview.days}天</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">📈 点击率 (CTR)</div>
              <div className="text-2xl font-bold text-green-600">{pct(summary.overview.ctr)}</div>
              <div className="text-[10px] text-gray-400 mt-1">近{summary.overview.days}天</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            {[
              { key: 'overview' as const, label: '概览' },
              { key: 'ads' as const, label: '广告表现' },
              { key: 'pages' as const, label: '热门页面' },
              { key: 'daily' as const, label: '每日趋势' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.key
                    ? 'border-amber-500 text-amber-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Pages */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">热门页面 Top 5</h3>
                {summary.topPages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">暂无数据</p>
                ) : (
                  <div className="space-y-2">
                    {summary.topPages.map((page, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate flex-1 mr-2">
                          {page.page_url}
                        </span>
                        <span className="text-gray-500 font-mono text-xs shrink-0">
                          {fmt(page.pageviews)} 次浏览
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ad Performance */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">广告表现</h3>
                {summary.adStats.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">暂无广告数据</p>
                ) : (
                  <div className="space-y-2">
                    {summary.adStats.map((ad, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex-1 min-w-0 mr-2">
                          <span className="text-gray-700 truncate block">{ad.ad_name}</span>
                          <span className="text-[10px] text-gray-400">{ad.position}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-gray-500 font-mono text-xs">
                            {fmt(ad.impressions)}次 → {fmt(ad.clicks)}次点击
                          </span>
                          <div className="text-[10px] text-green-600 font-medium">
                            CTR: {pct(ad.ctr)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Daily Trend */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">每日趋势</h3>
                {summary.daily.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">暂无数据</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">日期</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">浏览量</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">独立访客</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">广告曝光</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">点击</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">CTR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.daily.map((day, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-2 text-gray-700">{day.date}</td>
                            <td className="py-2 px-2 text-right font-mono text-gray-700">{fmt(day.total_pageviews)}</td>
                            <td className="py-2 px-2 text-right font-mono text-gray-700">{fmt(day.total_sessions)}</td>
                            <td className="py-2 px-2 text-right font-mono text-gray-700">{fmt(day.total_ad_impressions)}</td>
                            <td className="py-2 px-2 text-right font-mono text-amber-600">{fmt(day.total_ad_clicks)}</td>
                            <td className="py-2 px-2 text-right font-mono text-green-600">{pct(day.daily_ctr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'ads' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">各广告位表现</h3>
              {summary.adStats.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">
                  暂无广告数据。广告位创建并启用后，用户浏览页面时会自动追踪曝光和点击。
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-2 text-gray-500 font-medium">广告位</th>
                        <th className="text-left py-2 px-2 text-gray-500 font-medium">位置</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium">曝光</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium">点击</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.adStats.map((ad, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-2 text-gray-700 font-medium">{ad.ad_name}</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                              {ad.position}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono">{fmt(ad.impressions)}</td>
                          <td className="py-2 px-2 text-right font-mono text-amber-600">{fmt(ad.clicks)}</td>
                          <td className="py-2 px-2 text-right font-mono text-green-600">{pct(ad.ctr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pages' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">页面流量排行</h3>
              {summary.topPages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">暂无页面数据</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-2 text-gray-500 font-medium">#</th>
                        <th className="text-left py-2 px-2 text-gray-500 font-medium">页面</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium">浏览量</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium">独立访客</th>
                        <th className="text-right py-2 px-2 text-gray-500 font-medium">最近访问</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topPages.map((page, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-2 text-gray-400 text-xs">{i + 1}</td>
                          <td className="py-2 px-2 text-gray-700 max-w-[300px] truncate">{page.page_url}</td>
                          <td className="py-2 px-2 text-right font-mono">{fmt(page.pageviews)}</td>
                          <td className="py-2 px-2 text-right font-mono">{fmt(page.unique_sessions)}</td>
                          <td className="py-2 px-2 text-right text-xs text-gray-400">
                            {page.last_visit ? new Date(page.last_visit).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'daily' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">每日汇总</h3>
                {summary.daily.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-12">暂无每日数据</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">日期</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">浏览量</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">访客数</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">广告曝光</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">广告点击</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">CTR</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">每访客曝光</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.daily.map((day, i) => {
                          const sessions = parseInt(day.total_sessions) || 1;
                          const impressionsPerSession = (parseInt(day.total_ad_impressions) / sessions).toFixed(1);
                          return (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 px-2 text-gray-700 font-medium">{day.date}</td>
                              <td className="py-2 px-2 text-right font-mono">{fmt(day.total_pageviews)}</td>
                              <td className="py-2 px-2 text-right font-mono">{fmt(day.total_sessions)}</td>
                              <td className="py-2 px-2 text-right font-mono">{fmt(day.total_ad_impressions)}</td>
                              <td className="py-2 px-2 text-right font-mono text-amber-600">{fmt(day.total_ad_clicks)}</td>
                              <td className="py-2 px-2 text-right font-mono text-green-600">{pct(day.daily_ctr)}</td>
                              <td className="py-2 px-2 text-right font-mono text-gray-500">{impressionsPerSession}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg">💡</span>
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-800 mb-1">优化建议</h4>
                    <ul className="text-xs text-indigo-700 space-y-1">
                      <li>• 查看<Link href="/admin/ads" className="underline">广告管理</Link>，确保每个页面都有合适的广告位</li>
                      <li>• 在热门页面（Top 5）添加更多广告位可提升曝光</li>
                      <li>• 尝试不同的广告位置和文案，对比CTR变化</li>
                      <li>• 定期查看数据，了解哪些页面流量最大、广告效果最好</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
