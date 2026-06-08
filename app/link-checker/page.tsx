/**
 * Link Checker — 链接健康检查器
 *
 * 输入网址 → 提取所有链接 → 批量检测 HTTP 状态
 * 壁垒：服务端爬取 + cheerio 解析 + 并发批量探测 + 智能分类
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import AdBanner from '@/components/AdBanner';

// ============ Types ============

interface LinkResult {
  href: string;
  text: string;
  status: number;
  statusText: string;
  category: 'healthy' | 'redirect' | 'broken' | 'error' | 'skipped';
  isInternal: boolean;
  responseTime: number;
}

interface Summary {
  healthy: number;
  redirect: number;
  broken: number;
  error: number;
  skipped: number;
  internal: number;
  external: number;
}

interface InspectResult {
  pageUrl: string;
  pageTitle: string;
  totalLinks: number;
  checkedLinks: number;
  skippedLinks: number;
  results: LinkResult[];
  summary: Summary;
  fetchTime: number;
}

// ============ Suggested URLs ============

const SUGGESTED_URLS = [
  { label: '我的网站', url: 'sinmoniker.com' },
  { label: '百度', url: 'baidu.com' },
  { label: '谷歌', url: 'google.com' },
  { label: 'B站', url: 'bilibili.com' },
];

// ============ Constants ============

type FilterMode = 'all' | 'healthy' | 'broken' | 'redirect' | 'error' | 'internal' | 'external';

const FILTER_OPTIONS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'healthy', label: '正常' },
  { key: 'broken', label: '损坏' },
  { key: 'redirect', label: '重定向' },
  { key: 'error', label: '错误' },
  { key: 'internal', label: '站内' },
  { key: 'external', label: '站外' },
];

// ============ Helpers ============

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600 bg-green-50 border-green-200';
  if (status >= 300 && status < 400) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (status >= 400 && status < 500) return 'text-amber-600 bg-amber-50 border-amber-200';
  if (status >= 500) return 'text-red-600 bg-red-50 border-red-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

function getCategoryIcon(category: string): string {
  switch (category) {
    case 'healthy': return '✅';
    case 'redirect': return '🔀';
    case 'broken': return '❌';
    case 'error': return '⚠️';
    case 'skipped': return '⏭️';
    default: return '❓';
  }
}

function getCategoryBadge(category: string): { bg: string; text: string; label: string } {
  switch (category) {
    case 'healthy': return { bg: 'bg-green-100', text: 'text-green-700', label: '正常' };
    case 'redirect': return { bg: 'bg-blue-100', text: 'text-blue-700', label: '重定向' };
    case 'broken': return { bg: 'bg-red-100', text: 'text-red-700', label: '损坏' };
    case 'error': return { bg: 'bg-amber-100', text: 'text-amber-700', label: '错误' };
    case 'skipped': return { bg: 'bg-gray-100', text: 'text-gray-500', label: '跳过' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-500', label: '未知' };
  }
}

function formatTime(ms: number): string {
  if (ms === 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateUrl(url: string, maxLen: number = 60): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + '...';
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ============ Storage ============

const HISTORY_KEY = 'link-checker-history';
const MAX_HISTORY = 10;

interface HistoryItem {
  url: string;
  title: string;
  timestamp: number;
  summary: Summary;
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(item: HistoryItem) {
  try {
    const history = loadHistory();
    history.unshift(item);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore storage errors
  }
}

// ============ Summary Card Component ============

function SummaryCard({
  icon,
  label,
  value,
  color,
  sublabel,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
  sublabel?: string;
}) {
  return (
    <div className={`rounded-xl border ${color} p-4 text-center transition-all hover:shadow-md`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl sm:text-3xl font-bold">{value}</div>
      <div className="text-xs sm:text-sm mt-1">{label}</div>
      {sublabel && <div className="text-[10px] text-gray-400 mt-0.5">{sublabel}</div>}
    </div>
  );
}

// ============ Main Component ============

export default function LinkCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<InspectResult | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const inspect = useCallback(async (targetUrl: string) => {
    const u = targetUrl.trim();
    if (!u) return;

    setLoading(true);
    setError('');
    setResult(null);
    setProgress('正在抓取页面...');
    setFilter('all');

    try {
      const res = await fetch(`/api/link-checker/inspect?url=${encodeURIComponent(u)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const data: InspectResult = await res.json();
      setResult(data);
      setProgress('');

      // Save to history
      const item: HistoryItem = {
        url: data.pageUrl,
        title: data.pageTitle,
        timestamp: Date.now(),
        summary: data.summary,
      };
      saveHistory(item);
      setHistory(loadHistory());
    } catch (err: any) {
      setError(err.message || '检查失败，请稍后重试');
      setProgress('');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inspect(url);
  };

  // Filter results
  const filteredResults = result
    ? result.results.filter(r => {
        switch (filter) {
          case 'healthy': return r.category === 'healthy';
          case 'broken': return r.category === 'broken';
          case 'redirect': return r.category === 'redirect';
          case 'error': return r.category === 'error';
          case 'internal': return r.isInternal;
          case 'external': return !r.isInternal;
          default: return true;
        }
      })
    : [];

  const brokenCount = result
    ? result.summary.broken + result.summary.error
    : 0;

  // Copy report
  const copyReport = () => {
    if (!result) return;
    const lines = [
      `🔗 链接健康检查报告`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📄 页面: ${result.pageTitle}`,
      `🔗 URL: ${result.pageUrl}`,
      `⏱ 耗时: ${formatTime(result.fetchTime)}`,
      ``,
      `📊 汇总`,
      `  ✅ 正常: ${result.summary.healthy}`,
      `  🔀 重定向: ${result.summary.redirect}`,
      `  ❌ 损坏: ${result.summary.broken}`,
      `  ⚠️ 错误: ${result.summary.error}`,
      `  📌 站内: ${result.summary.internal}`,
      `  🌐 站外: ${result.summary.external}`,
      `  📊 总计: ${result.totalLinks} 个链接`,
      ``,
      `❌ 损坏链接:`,
    ];
    result.results
      .filter(r => r.category === 'broken' || r.category === 'error')
      .forEach(r => {
        lines.push(`  ${r.status} ${r.href}`);
      });
    navigator.clipboard.writeText(lines.join('\n'));
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-teal-50 to-cream">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-teal-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔗</span>
            <div>
              <h1 className="text-lg font-bold text-teal-900">Link Checker</h1>
              <p className="text-xs text-teal-500 hidden sm:block">链接健康检查器</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-teal-600 hover:text-amber-600 transition-colors"
              >
                📋 历史
              </button>
            )}
            <a href="/" className="text-teal-600 hover:text-amber-600 transition-colors">
              ← 返回首页
            </a>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="text-5xl mb-3">🔗🔍</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-teal-900 mb-2">
            你的网页有死链吗？
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto text-sm">
            输入网址，自动抓取页面中所有链接，批量检测每个链接的健康状态
            <span className="block text-xs text-gray-400 mt-1">
              SEO 必备 — 快速发现 404 死链、重定向链、连接错误
            </span>
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="max-w-xl mx-auto mb-8">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="输入网址，如 sinmoniker.com"
                className="w-full px-4 py-3.5 rounded-xl border border-teal-200 bg-white
                  text-teal-900 placeholder:text-gray-400 text-sm
                  focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
                  transition-all shadow-sm"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3.5 bg-gradient-to-r from-teal-600 to-teal-500 
                text-white font-medium rounded-xl text-sm
                hover:from-teal-700 hover:to-teal-600 disabled:opacity-50 
                disabled:cursor-not-allowed transition-all shadow-sm
                whitespace-nowrap flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  检查中...
                </>
              ) : (
                <>🔗 检查链接</>
              )}
            </button>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            <span className="text-xs text-gray-400 self-center">快速检查：</span>
            {SUGGESTED_URLS.map(({ label, url: suggestUrl }) => (
              <button
                key={suggestUrl}
                type="button"
                onClick={() => {
                  setUrl(suggestUrl);
                  inspect(suggestUrl);
                }}
                disabled={loading}
                className="text-xs px-3 py-1 rounded-full bg-white border border-teal-100 
                  text-teal-600 hover:bg-teal-50 hover:border-teal-300 transition-all
                  disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </form>

        {/* Progress */}
        {loading && (
          <div className="max-w-xl mx-auto mb-8 text-center animate-fade-in">
            <div className="bg-white rounded-xl border border-teal-100 p-6 shadow-sm">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="inline-block w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-teal-700 font-medium text-sm">{progress}</span>
              </div>
              <div className="w-48 h-1.5 bg-teal-100 rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="max-w-xl mx-auto mb-8 animate-fade-in">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">⚠️</div>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* History Panel */}
        {showHistory && history.length > 0 && (
          <div className="max-w-xl mx-auto mb-8 animate-fade-in">
            <div className="bg-white rounded-xl border border-teal-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-teal-50 border-b border-teal-100 flex items-center justify-between">
                <span className="text-sm font-medium text-teal-700">📋 查询历史</span>
                <button
                  onClick={() => {
                    localStorage.removeItem(HISTORY_KEY);
                    setHistory([]);
                    setShowHistory(false);
                  }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  清空
                </button>
              </div>
              <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                {history.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setUrl(item.url);
                      inspect(item.url);
                      setShowHistory(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-teal-50 transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {item.title || item.url}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                      <span className="truncate max-w-[200px]">{item.url}</span>
                      <span className="text-green-600">{item.summary.healthy}✅</span>
                      {item.summary.broken + item.summary.error > 0 && (
                        <span className="text-red-600">{item.summary.broken + item.summary.error}❌</span>
                      )}
                      <span className="text-gray-300">
                        {new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="animate-fade-in">
            {/* Page Info */}
            <div className="bg-white rounded-xl border border-teal-100 p-4 sm:p-6 mb-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-teal-900 truncate">
                    {result.pageTitle}
                  </h3>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {result.pageUrl}
                    <span className="ml-2 text-teal-500">
                      {result.totalLinks} 个链接 · {formatTime(result.fetchTime)}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={copyReport}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200
                      text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    📋 复制报告
                  </button>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <SummaryCard
                icon="✅"
                label="正常"
                value={result.summary.healthy}
                color="border-green-200 bg-green-50/50"
                sublabel={`${result.totalLinks ? Math.round(result.summary.healthy / result.totalLinks * 100) : 0}%`}
              />
              <SummaryCard
                icon="🔀"
                label="重定向"
                value={result.summary.redirect}
                color="border-blue-200 bg-blue-50/50"
              />
              <SummaryCard
                icon="❌"
                label="损坏"
                value={result.summary.broken}
                color={`border-red-200 bg-red-50/50 ${result.summary.broken > 0 ? 'ring-1 ring-red-300' : ''}`}
              />
              <SummaryCard
                icon="⚠️"
                label="错误"
                value={result.summary.error}
                color={`border-amber-200 bg-amber-50/50 ${result.summary.error > 0 ? 'ring-1 ring-amber-300' : ''}`}
              />
              <SummaryCard
                icon="📌"
                label="站内"
                value={result.summary.internal}
                color="border-teal-200 bg-teal-50/50"
              />
              <SummaryCard
                icon="🌐"
                label="站外"
                value={result.summary.external}
                color="border-purple-200 bg-purple-50/50"
              />
            </div>

            {/* Broken Links Alert */}
            {brokenCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 animate-fade-in">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0">🚨</span>
                  <div>
                    <p className="font-bold text-red-700 text-sm">
                      发现 {brokenCount} 个问题链接
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      这些链接可能影响 SEO 排名和用户体验。建议尽快修复。
                      {brokenCount > 10 && `（显示前 10 个）`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {result.results
                    .filter(r => r.category === 'broken' || r.category === 'error')
                    .slice(0, 10)
                    .map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-red-500 shrink-0">{r.status || '✕'}</span>
                        <span className="text-gray-700 truncate">{r.text || r.href}</span>
                        <a
                          href={r.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-red-600 shrink-0"
                        >
                          🔗
                        </a>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Ad Banner */}
            <AdBanner position="inline" source="seo" />

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {FILTER_OPTIONS.map(opt => {
                const active = filter === opt.key;
                const count = result
                  ? opt.key === 'all'
                    ? result.results.length
                    : opt.key === 'internal'
                      ? result.summary.internal
                      : opt.key === 'external'
                        ? result.summary.external
                        : result.results.filter(r => r.category === opt.key).length
                  : 0;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setFilter(opt.key)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                      active
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Link Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {filteredResults.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  没有匹配的链接
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">状态</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">链接文字</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">URL</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 w-16">耗时</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 w-16">类型</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredResults.map((r, i) => {
                        const badge = getCategoryBadge(r.category);
                        return (
                          <tr
                            key={i}
                            className={`hover:bg-gray-50 transition-colors ${
                              r.category === 'broken' || r.category === 'error'
                                ? 'bg-red-50/30'
                                : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span>{getCategoryIcon(r.category)}</span>
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.bg} ${badge.text}`}>
                                  {r.status > 0 ? r.status : badge.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 max-w-[200px]">
                              <div className="truncate text-gray-800" title={r.text}>
                                {r.text || <span className="text-gray-400 italic">(无文字)</span>}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5 sm:hidden truncate">
                                {truncateUrl(r.href, 40)}
                              </div>
                            </td>
                            <td className="px-4 py-3 max-w-[300px] hidden sm:table-cell">
                              <a
                                href={r.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline truncate block"
                                title={r.href}
                              >
                                {truncateUrl(r.href)}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-gray-500 text-[11px]">
                                {r.responseTime > 0 ? `${r.responseTime}ms` : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs ${r.isInternal ? 'text-teal-600' : 'text-purple-600'}`}>
                                {r.isInternal ? '站内' : '站外'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer note */}
            <p className="text-xs text-gray-400 mt-4 text-center">
              共检查 {result.checkedLinks} 个链接
              {result.skippedLinks > 0 && `（${result.skippedLinks} 个因超出限制跳过）`}
              · 使用 HEAD 请求快速检测 · 超时 10s
            </p>
          </div>
        )}

        {/* Ad Banner */}
        <div className="mt-8">
          <AdBanner position="bottom" source="seo" />
        </div>
      </div>
    </main>
  );
}
