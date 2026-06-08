/**
 * Page Speed Analyzer — 页面速度 & 性能分析工具
 * 输入网址 → 响应时间分解 + HTML结构分析 + 资源分析 + 缓存/压缩/HTTP2检测 + 评分
 *
 * 壁垒：
 * - 服务端多阶段探测（DNS + TLS + Fetch）
 * - cheerio HTML深度解析（资源提取）
 * - 性能评分算法（10项考核，中文优化建议）
 * - 缓存策略分析
 */

'use client';

import { useState, useCallback } from 'react';
import AdBanner from '@/components/AdBanner';

// ============ Types ============

interface TimingResult {
  dns: number | null;
  tcp: number | null;
  tls: number | null;
  ttfb: number | null;
  download: number | null;
  total: number | null;
}

interface ResourceAnalysis {
  total: number;
  scripts: number;
  stylesheets: number;
  images: number;
  fonts: number;
  preloads: number;
  renderBlocking: number;
  externalResources: number;
}

interface PageInfo {
  title: string | null;
  description: string | null;
  canonical: string | null;
  htmlSize: number;
  transferredSize: number | null;
  compression: string | null;
  doctype: boolean;
  viewport: boolean;
}

interface CachingInfo {
  enabled: boolean;
  type: string | null;
  maxAge: number | null;
  etag: string | null;
  lastModified: string | null;
}

interface Recommendation {
  type: 'error' | 'warning' | 'info';
  message: string;
  detail: string;
}

interface PageSpeedResult {
  url: string;
  status: number;
  statusText: string;
  timing: TimingResult;
  page: PageInfo;
  resources: ResourceAnalysis;
  https: boolean;
  http2: boolean;
  caching: CachingInfo;
  headers: Record<string, string>;
  score: number;
  grade: string;
  recommendations: Recommendation[];
}

// ============ Suggested URLs ============

const SUGGESTED_URLS = [
  { label: '我的网站', example: 'sinmoniker.com' },
  { label: '百度', example: 'baidu.com' },
  { label: '谷歌', example: 'google.com' },
  { label: '必应', example: 'bing.com' },
];

// ============ Helpers ============

function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    'A': 'text-green-600 bg-green-50 border-green-300',
    'B': 'text-blue-600 bg-blue-50 border-blue-300',
    'C': 'text-amber-600 bg-amber-50 border-amber-300',
    'D': 'text-orange-600 bg-orange-50 border-orange-300',
    'F': 'text-red-600 bg-red-50 border-red-300',
  };
  return colors[grade] || 'text-gray-600 bg-gray-50 border-gray-300';
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600 bg-green-50 border-green-200';
  if (status >= 300 && status < 400) return 'text-amber-600 bg-amber-50 border-amber-200';
  if (status >= 400) return 'text-red-600 bg-red-50 border-red-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

function getRecommendationIcon(type: string): string {
  if (type === 'error') return '🔴';
  if (type === 'warning') return '🟡';
  return '💡';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return ms.toFixed(0) + ' ms';
  return (ms / 1000).toFixed(2) + ' s';
}

function getTimingBarColor(label: string): string {
  const colors: Record<string, string> = {
    'DNS': 'bg-blue-500',
    'TCP': 'bg-cyan-500',
    'TLS': 'bg-purple-500',
    'TTFB': 'bg-amber-500',
    '下载': 'bg-green-500',
  };
  return colors[label] || 'bg-gray-400';
}

// ============ Main Component ============

export default function PageSpeedPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PageSpeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('page_speed_history') || '[]');
      } catch { return []; }
    }
    return [];
  });
  const [showHeaders, setShowHeaders] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const saveToHistory = useCallback((url: string) => {
    const updated = [url, ...history.filter(h => h !== url)].slice(0, 10);
    setHistory(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('page_speed_history', JSON.stringify(updated));
    }
  }, [history]);

  const doInspect = useCallback(async (targetUrl: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    // Format URL
    let formattedUrl = targetUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    setUrl(formattedUrl);

    try {
      const res = await fetch(`/api/page-speed/inspect?url=${encodeURIComponent(formattedUrl)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.detail || '请求失败');
        setLoading(false);
        return;
      }

      setResult(data);
      saveToHistory(formattedUrl);
    } catch (e: any) {
      setError('网络请求失败，请检查网络连接后重试。');
    }
    setLoading(false);
  }, [saveToHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    doInspect(url);
  };

  const getFilteredRecommendations = useCallback(() => {
    if (!result) return [];
    if (activeFilter === 'all') return result.recommendations;
    return result.recommendations.filter(r => r.type === activeFilter);
  }, [result, activeFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
            ⚡ Page Speed Analyzer
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-2xl mx-auto">
            输入网址，一键分析页面加载速度、性能得分和优化建议。
            从 DNS 到页面渲染，全面诊断网站性能瓶颈。
          </p>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="输入网址，如 sinmoniker.com"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none transition-shadow"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg text-sm transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  分析中...
                </span>
              ) : '开始分析 ⚡'}
            </button>
          </div>

          {/* Quick URLs */}
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {SUGGESTED_URLS.map((s) => (
              <button
                key={s.example}
                type="button"
                onClick={() => doInspect(s.example)}
                disabled={loading}
                className="px-3 py-1.5 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-700 text-xs rounded-full transition-colors cursor-pointer disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 mb-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-gray-700 font-medium mb-1">正在分析页面性能...</p>
                <p className="text-xs text-gray-400">
                  检测中：DNS解析 → TLS握手 → HTTP请求 → HTML解析 → 性能评分
                </p>
              </div>
              <div className="w-full max-w-md bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 sm:space-y-6">
            {/* Score Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                {/* Grade Badge */}
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 flex items-center justify-center flex-shrink-0 ${getGradeColor(result.grade)}`}>
                  <span className="text-3xl sm:text-4xl font-bold">{result.grade}</span>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    性能评分：{result.score}/100
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500">
                    目标页面：<code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-700 text-xs">{result.url}</code>
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(result.status)}`}>
                      HTTP {result.status}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {result.http2 ? '✅ HTTP/2' : '⚠️ HTTP/1.x'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                      🔒 {result.https ? 'HTTPS' : 'HTTP'}
                    </span>
                    {result.page.compression && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        🗜️ {result.page.compression}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Score Bar */}
              <div className="mt-4">
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      result.score >= 90 ? 'bg-green-500' :
                      result.score >= 70 ? 'bg-blue-500' :
                      result.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>
            </div>

            {/* Timing Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">⏱️ 耗时分解</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-4">
                <TimingItem label="DNS" value={formatMs(result.timing.dns)} />
                <TimingItem label="TLS" value={formatMs(result.timing.tls)} />
                <TimingItem label="TTFB" value={formatMs(result.timing.ttfb)} />
                <TimingItem label="下载" value={formatMs(result.timing.download)} />
                <TimingItem label="总计" value={formatMs(result.timing.total)} highlight />
              </div>

              {/* Visual Timing Bar */}
              {result.timing.total && result.timing.total > 0 && (
                <div className="space-y-2">
                  <TimingBar label="DNS" value={result.timing.dns} total={result.timing.total} />
                  <TimingBar label="TLS" value={result.timing.tls} total={result.timing.total} />
                  <TimingBar label="TTFB" value={result.timing.ttfb} total={result.timing.total} />
                  <TimingBar label="下载" value={result.timing.download} total={result.timing.total} />
                </div>
              )}
            </div>

            {/* Page Info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">📄 页面信息</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InfoItem label="页面标题" value={result.page.title || '—'} />
                <InfoItem label="Meta描述" value={result.page.description || '—' || '缺失'} />
                <InfoItem label="HTML大小" value={formatBytes(result.page.htmlSize)} />
                <InfoItem label="压缩方式" value={result.page.compression || '未压缩'} />
                <InfoItem label="Canonical" value={result.page.canonical || '—'} />
                <InfoItem label="Viewport设置" value={result.page.viewport ? '✅ 已配置' : '❌ 未配置'} />
              </div>
            </div>

            {/* Resource Analysis */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">📦 资源分析</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <ResourceCard label="脚本" count={result.resources.scripts} emoji="📜" />
                <ResourceCard label="样式表" count={result.resources.stylesheets} emoji="🎨" />
                <ResourceCard label="图片" count={result.resources.images} emoji="🖼️" />
                <ResourceCard label="字体" count={result.resources.fonts} emoji="🔤" />
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-amber-700">{result.resources.renderBlocking}</p>
                  <p className="text-xs text-amber-600">渲染阻塞资源</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-700">{result.resources.externalResources}</p>
                  <p className="text-xs text-blue-600">外部资源总数</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-gray-700">{result.resources.total}</p>
                  <p className="text-xs text-gray-600">资源总数</p>
                </div>
              </div>
            </div>

            {/* Caching Info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">📋 缓存策略</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InfoItem label="缓存状态" value={result.caching.enabled ? '✅ 已启用' : '❌ 未启用'} />
                <InfoItem label="缓存类型" value={result.caching.type || '—'} />
                <InfoItem label="缓存时长" value={result.caching.maxAge !== null ? `${result.caching.maxAge}s (${(result.caching.maxAge / 3600).toFixed(1)}h)` : '—'} />
                <InfoItem label="ETag" value={result.caching.etag ? '✅ 已配置' : '—'} />
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">💡 优化建议</h3>
                <div className="flex gap-1">
                  {['all', 'error', 'warning', 'info'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-2.5 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                        activeFilter === f
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {f === 'all' ? '全部' : f === 'error' ? '严重' : f === 'warning' ? '警告' : '建议'}
                    </button>
                  ))}
                </div>
              </div>

              {getFilteredRecommendations().length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-lg mb-1">🎉</p>
                  <p className="text-sm">该分类下没有建议，做得很棒！</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getFilteredRecommendations().map((rec, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        rec.type === 'error' ? 'bg-red-50 border-red-200' :
                        rec.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                        'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0 mt-0.5">{getRecommendationIcon(rec.type)}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{rec.message}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{rec.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Response Headers */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <button
                onClick={() => setShowHeaders(!showHeaders)}
                className="flex items-center justify-between w-full cursor-pointer"
              >
                <h3 className="text-base font-bold text-gray-900">📋 原始响应头</h3>
                <span className="text-gray-400 text-sm">{showHeaders ? '收起 ▲' : '展开 ▼'}</span>
              </button>
              {showHeaders && (
                <div className="mt-3 bg-gray-900 rounded-lg p-3 sm:p-4 overflow-x-auto">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                    {Object.entries(result.headers).map(([key, val]) => (
                      <span key={key}>
                        <span className="text-blue-300">{key}</span>: {val}{'\n'}
                      </span>
                    ))}
                  </pre>
                </div>
              )}
            </div>

            {/* Copy Report */}
            <div className="text-center">
              <button
                onClick={() => {
                  const report = [
                    `⚡ Page Speed Analyzer Report`,
                    `━━━━━━━━━━━━━━━━━━━`,
                    `URL: ${result.url}`,
                    `Grade: ${result.grade} (${result.score}/100)`,
                    `Status: HTTP ${result.status}`,
                    `TTFB: ${formatMs(result.timing.ttfb)}`,
                    `Total: ${formatMs(result.timing.total)}`,
                    `HTML Size: ${formatBytes(result.page.htmlSize)}`,
                    `Compression: ${result.page.compression || 'None'}`,
                    `HTTP/2: ${result.http2 ? 'Yes' : 'No'}`,
                    `Cache: ${result.caching.enabled ? 'Enabled' : 'Disabled'}`,
                    `Resources: ${result.resources.total} (${result.resources.renderBlocking} blocking)`,
                    ``,
                    `Recommendations:`,
                    ...result.recommendations.map(r => `  ${r.message}`),
                    ``,
                    `Generated by Sinmoniker Page Speed Analyzer`,
                  ].join('\n');
                  navigator.clipboard.writeText(report).then(() => {
                    alert('诊断报告已复制到剪贴板！');
                  }).catch(() => {
                    // Fallback
                    const textarea = document.createElement('textarea');
                    textarea.value = report;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                  });
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors cursor-pointer"
              >
                📋 复制诊断报告
              </button>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">最近查询</h3>
                <div className="flex flex-wrap gap-2">
                  {history.slice(0, 10).map((h, i) => (
                    <button
                      key={`${h}-${i}`}
                      onClick={() => doInspect(h)}
                      className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs rounded border border-gray-200 transition-colors cursor-pointer"
                    >
                      {h.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 30)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ad Banner */}
        <div className="mt-6 sm:mt-8">
          <AdBanner position="bottom" source="seo" />
        </div>
      </div>
    </div>
  );
}

// ============ Sub-components ============

function TimingItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`text-center p-2 sm:p-3 rounded-lg ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`font-bold ${highlight ? 'text-blue-700 text-base' : 'text-gray-800 text-sm'}`}>{value}</p>
    </div>
  );
}

function TimingBar({ label, value, total }: { label: string; value: number | null; total: number }) {
  if (value === null) return null;
  const pct = Math.max(1, (value / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-10 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full rounded-full ${getTimingBarColor(label)} transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-14 text-right shrink-0">{formatMs(value)}</span>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 truncate" title={value}>{value}</p>
    </div>
  );
}

function ResourceCard({ label, count, emoji }: { label: string; count: number; emoji: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <span className="text-lg block mb-1">{emoji}</span>
      <p className="text-lg font-bold text-gray-800">{count}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
