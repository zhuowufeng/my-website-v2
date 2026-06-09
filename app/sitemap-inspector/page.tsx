'use client';

// 🗺️ Sitemap Inspector — 站点地图检查器
// 服务端 XML 解析 + sitemap 协议验证 + 多层索引追踪 + 健康评分

import { useState, useCallback } from 'react';
import Link from 'next/link';
import AdBanner from '@/components/AdBanner';

// ==============================
// Types
// ==============================

interface SitemapUrl {
  loc: string;
  lastmod: string | null;
  changefreq: string | null;
  priority: number | null;
}

interface SitemapIndexEntry {
  loc: string;
  lastmod: string | null;
}

interface SitemapIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  detail: string;
}

interface SitemapResult {
  url: string;
  type: 'sitemap' | 'sitemapindex';
  totalUrls: number;
  urls: SitemapUrl[];
  childSitemaps: SitemapIndexEntry[];
  resolvedChildren: SitemapResult[];
  issues: SitemapIssue[];
  score: number;
  fileSize: number;
  namespaces: string[];
  timestamp: string;
}

// ==============================
// Quick Test URLs
// ==============================

const QUICK_URLS = [
  { label: '我的网站', url: 'sinmoniker.com/sitemap.xml' },
  { label: 'Google', url: 'google.com/sitemap.xml' },
  { label: 'GitHub', url: 'github.com/sitemap.xml' },
  { label: '百度', url: 'baidu.com/sitemap.xml' },
];

// ==============================
// Helpers
// ==============================

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100 border-green-300';
  if (score >= 60) return 'bg-yellow-100 border-yellow-300';
  return 'bg-red-100 border-red-300';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-green-500';
  if (score >= 60) return 'stroke-yellow-500';
  return 'stroke-red-500';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getChangefreqLabel(freq: string | null): string {
  const labels: Record<string, string> = {
    always: '始终',
    hourly: '每小时',
    daily: '每天',
    weekly: '每周',
    monthly: '每月',
    yearly: '每年',
    never: '从不',
  };
  return freq ? (labels[freq] || freq) : '-';
}

function getChangefreqColor(freq: string | null): string {
  const colors: Record<string, string> = {
    always: 'bg-red-100 text-red-700',
    hourly: 'bg-orange-100 text-orange-700',
    daily: 'bg-yellow-100 text-yellow-700',
    weekly: 'bg-blue-100 text-blue-700',
    monthly: 'bg-green-100 text-green-700',
    yearly: 'bg-gray-100 text-gray-600',
    never: 'bg-gray-200 text-gray-500',
  };
  return freq ? (colors[freq] || 'bg-gray-100 text-gray-600') : 'bg-gray-100 text-gray-400';
}

// ==============================
// Score Ring Component
// ==============================

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-2xl font-bold" style={{ color: score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : '#dc2626' }}>
        {score}
      </span>
    </div>
  );
}

// ==============================
// Issue Badge
// ==============================

function IssueIcon({ type }: { type: 'error' | 'warning' | 'info' }) {
  if (type === 'error') return <span className="text-red-500 font-bold">✕</span>;
  if (type === 'warning') return <span className="text-yellow-500 font-bold">⚠</span>;
  return <span className="text-blue-500 font-bold">ℹ</span>;
}

// ==============================
// Main Component
// ==============================

export default function SitemapInspectorPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SitemapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('sitemapInspectorHistory') || '[]');
      } catch { return []; }
    }
    return [];
  });
  const [showAllUrls, setShowAllUrls] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyze = useCallback(async (targetUrl: string) => {
    const trimmedUrl = targetUrl.trim();
    if (!trimmedUrl) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setShowAllUrls(false);

    try {
      const encodedUrl = encodeURIComponent(trimmedUrl);
      const res = await fetch(`/api/sitemap-inspector/inspect?url=${encodedUrl}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '检查失败');
      }

      const data: SitemapResult = await res.json();
      setResult(data);

      // Save to history
      setHistory(prev => {
        const updated = [trimmedUrl, ...prev.filter(h => h !== trimmedUrl)].slice(0, 10);
        localStorage.setItem('sitemapInspectorHistory', JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      setError(err.message || '检查过程中发生错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQuickUrl = useCallback((u: string) => {
    setUrl(u);
    analyze(u);
  }, [analyze]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    analyze(url);
  }, [url, analyze]);

  const copyReport = useCallback(() => {
    if (!result) return;
    const lines = [
      '=== Sitemap Inspector 检查报告 ===',
      `URL: ${result.url}`,
      `类型: ${result.type === 'sitemap' ? 'Sitemap' : 'Sitemap Index'}`,
      `Sitemap 评分: ${result.score}/100`,
      `URL 总数: ${result.totalUrls}`,
      `文件大小: ${formatFileSize(result.fileSize)}`,
      ``,
      `--- 问题列表 (${result.issues.length}) ---`,
      ...result.issues.map(i => `[${i.type.toUpperCase()}] ${i.message}: ${i.detail}`),
      ``,
      `--- URL 列表 (前 20 条) ---`,
      ...result.urls.slice(0, 20).map(u => `${u.loc}${u.lastmod ? ` (${u.lastmod})` : ''}`),
      result.urls.length > 20 ? `... 还有 ${result.urls.length - 20} 条` : '',
      ``,
      `报告生成: ${new Date(result.timestamp).toLocaleString('zh-CN')}`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  // Counts for stats
  const errorCount = result?.issues.filter(i => i.type === 'error').length || 0;
  const warningCount = result?.issues.filter(i => i.type === 'warning').length || 0;
  const infoCount = result?.issues.filter(i => i.type === 'info').length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 sm:px-6 py-4 sm:py-5 shadow-lg">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="text-white/70 hover:text-white text-sm mr-2">← 返回首页</Link>
            <span className="text-2xl">🗺️</span>
            <h1 className="text-xl sm:text-2xl font-bold">Sitemap Inspector</h1>
          </div>
          <p className="text-indigo-100 text-sm sm:text-base">
            XML 站点地图验证工具 — 检查 sitemap 格式、URL 完整性、协议合规性
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              输入 Sitemap URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="例如: https://sinmoniker.com/sitemap.xml"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none transition-all"
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
              >
                {loading ? '检查中...' : '检查 →'}
              </button>
            </div>
          </form>

          {/* Quick URLs */}
          <div className="flex flex-wrap gap-2 mt-3">
            {QUICK_URLS.map((item) => (
              <button
                key={item.label}
                onClick={() => handleQuickUrl(item.url)}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-400 self-center">历史:</span>
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickUrl(h)}
                  disabled={loading}
                  className="px-2 py-0.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded transition-colors disabled:opacity-50 truncate max-w-[200px]"
                >
                  {h.replace(/^https?:\/\//, '')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="animate-spin text-4xl mb-3">🗺️</div>
            <p className="text-gray-500">正在抓取并分析 Sitemap...</p>
            <div className="max-w-xs mx-auto mt-4 bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-red-800 mb-1">检查失败</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Score Overview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ScoreRing score={result.score} />
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-lg font-semibold text-gray-800 mb-1">
                    {result.score >= 80 ? '👍 Sitemap 状态良好' :
                     result.score >= 60 ? '⚠️ Sitemap 需要优化' :
                     '🔴 Sitemap 问题较多'}
                  </h2>
                  <p className="text-sm text-gray-500 mb-3">
                    {result.type === 'sitemap' ? '标准 Sitemap' : 'Sitemap Index (索引)'}
                    {result.type === 'sitemapindex' && ` — ${result.childSitemaps.length} 个子 sitemap`}
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                    <div className="bg-indigo-50 rounded-lg px-3 py-2 text-center min-w-[80px]">
                      <div className="text-lg font-bold text-indigo-700">{result.totalUrls.toLocaleString()}</div>
                      <div className="text-xs text-indigo-500">URL 总数</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center min-w-[80px]">
                      <div className="text-lg font-bold text-gray-700">{formatFileSize(result.fileSize)}</div>
                      <div className="text-xs text-gray-500">文件大小</div>
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-center min-w-[80px] ${errorCount > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <div className={`text-lg font-bold ${errorCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {errorCount}
                      </div>
                      <div className="text-xs text-gray-500">错误</div>
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-center min-w-[80px] ${warningCount > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                      <div className={`text-lg font-bold ${warningCount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {warningCount}
                      </div>
                      <div className="text-xs text-gray-500">警告</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg px-3 py-2 text-center min-w-[80px]">
                      <div className="text-lg font-bold text-blue-600">{infoCount}</div>
                      <div className="text-xs text-gray-500">建议</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Namespaces */}
            {result.namespaces.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">XML 命名空间</h3>
                <div className="flex flex-wrap gap-2">
                  {result.namespaces.map((ns, i) => (
                    <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-mono truncate max-w-full">{ns}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span>📋 问题列表</span>
                  <span className="text-xs text-gray-400">({result.issues.length})</span>
                </h3>
                <div className="space-y-2">
                  {/* Errors first */}
                  {result.issues.filter(i => i.type === 'error').map((issue, i) => (
                    <div key={`err-${i}`} className="flex gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <IssueIcon type="error" />
                      <div>
                        <div className="font-medium text-red-800 text-sm">{issue.message}</div>
                        <div className="text-xs text-red-600 mt-0.5">{issue.detail}</div>
                      </div>
                    </div>
                  ))}
                  {/* Warnings */}
                  {result.issues.filter(i => i.type === 'warning').map((issue, i) => (
                    <div key={`warn-${i}`} className="flex gap-3 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                      <IssueIcon type="warning" />
                      <div>
                        <div className="font-medium text-yellow-800 text-sm">{issue.message}</div>
                        <div className="text-xs text-yellow-600 mt-0.5">{issue.detail}</div>
                      </div>
                    </div>
                  ))}
                  {/* Info */}
                  {result.issues.filter(i => i.type === 'info').map((issue, i) => (
                    <div key={`info-${i}`} className="flex gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <IssueIcon type="info" />
                      <div>
                        <div className="font-medium text-blue-800 text-sm">{issue.message}</div>
                        <div className="text-xs text-blue-600 mt-0.5">{issue.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* URL List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">📄 URL 列表</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{result.urls.length} 条</span>
                  {result.urls.length > 20 && (
                    <button
                      onClick={() => setShowAllUrls(!showAllUrls)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {showAllUrls ? '收起' : `显示全部`}
                    </button>
                  )}
                </div>
              </div>

              {result.urls.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">未找到 URL 条目</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-2 pr-2 text-gray-500 font-medium">#</th>
                        <th className="py-2 px-2 text-gray-500 font-medium">URL</th>
                        <th className="py-2 px-2 text-gray-500 font-medium whitespace-nowrap">更新日期</th>
                        <th className="py-2 px-2 text-gray-500 font-medium whitespace-nowrap">更新频率</th>
                        <th className="py-2 px-2 text-gray-500 font-medium text-right">优先级</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllUrls ? result.urls : result.urls.slice(0, 20)).map((u, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-2 pr-2 text-gray-400 text-xs align-top">{i + 1}</td>
                          <td className="py-2 px-2">
                            <a
                              href={u.loc}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                            >
                              {u.loc}
                            </a>
                          </td>
                          <td className="py-2 px-2 text-gray-600 text-xs whitespace-nowrap align-top">
                            {formatDate(u.lastmod)}
                          </td>
                          <td className="py-2 px-2 align-top">
                            {u.changefreq ? (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${getChangefreqColor(u.changefreq)}`}>
                                {getChangefreqLabel(u.changefreq)}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right align-top">
                            {u.priority !== null ? (
                              <span className="text-xs font-mono text-gray-600">{u.priority.toFixed(1)}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.urls.length > 20 && !showAllUrls && (
                <p className="text-center text-xs text-gray-400 mt-3">
                  还有 {result.urls.length - 20} 条 URL 未显示
                  <button onClick={() => setShowAllUrls(true)} className="ml-2 text-indigo-600 hover:underline">显示全部</button>
                </p>
              )}
            </div>

            {/* Sitemap Index Children (if applicable) */}
            {result.type === 'sitemapindex' && result.childSitemaps.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">📂 子 Sitemap ({result.childSitemaps.length})</h3>
                <div className="space-y-2">
                  {result.childSitemaps.map((child, i) => {
                    const resolved = result.resolvedChildren.find(r => r.url === child.loc);
                    return (
                      <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-gray-400 text-xs mt-0.5">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <a
                              href={child.loc}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:underline text-sm break-all"
                            >
                              {child.loc}
                            </a>
                            {child.lastmod && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                更新: {formatDate(child.lastmod)}
                              </div>
                            )}
                            {resolved && resolved.issues.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {resolved.issues.filter(iss => iss.type === 'error').map((iss, j) => (
                                  <div key={j} className="text-xs text-red-500">✕ {iss.message}</div>
                                ))}
                              </div>
                            )}
                            {resolved && (
                              <div className="mt-1 text-xs text-gray-500">
                                URL: {resolved.totalUrls} | 评分: {resolved.score}
                              </div>
                            )}
                          </div>
                          {resolved && (
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                              resolved.score >= 80 ? 'bg-green-100 text-green-700' :
                              resolved.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {resolved.score}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Technical Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
              <button
                onClick={() => setShowTechnical(!showTechnical)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className="font-semibold text-gray-800">🔧 技术详情</h3>
                <span className={`text-gray-400 transition-transform ${showTechnical ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {showTechnical && (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">最终 URL</span>
                    <span className="text-gray-800 font-mono text-xs">{result.url}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Sitemap 类型</span>
                    <span className="text-gray-800">{result.type === 'sitemap' ? '标准 Sitemap (urlset)' : 'Sitemap Index'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">URL 总数</span>
                    <span className="text-gray-800">{result.totalUrls.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">文件大小</span>
                    <span className="text-gray-800">{formatFileSize(result.fileSize)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">命名空间</span>
                    <span className="text-gray-800 text-xs">{result.namespaces.join(', ') || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">子 Sitemap 数</span>
                    <span className="text-gray-800">{result.childSitemaps.length}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">检查时间</span>
                    <span className="text-gray-800">{new Date(result.timestamp).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={copyReport}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                {copied ? '✅ 已复制' : '📋 复制报告'}
              </button>
              <button
                onClick={() => { setUrl(''); setResult(null); setError(null); }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                🔄 重新检查
              </button>
              <a
                href="https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-600"
              >
                📖 Sitemap 规范文档
              </a>
            </div>
          </>
        )}

        {/* Ad Banner */}
        <div className="mb-6">
          <AdBanner />
        </div>

        {/* Info Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="font-semibold text-gray-800 mb-3">💡 关于 Sitemap</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="space-y-2">
              <p><strong>Sitemap</strong> 是 XML 格式的文件，向搜索引擎列出网站的所有页面及其重要信息。</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>&lt;loc&gt;</strong> — 页面 URL（必填）</li>
                <li><strong>&lt;lastmod&gt;</strong> — 最后修改时间</li>
                <li><strong>&lt;changefreq&gt;</strong> — 更新频率</li>
                <li><strong>&lt;priority&gt;</strong> — 优先级 (0.0 ~ 1.0)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p><strong>Sitemap Index</strong> 是包含多个子 sitemap 的索引文件。</p>
              <ul className="list-disc list-inside space-y-1">
                <li>单文件最多 50,000 个 URL 或 50MB</li>
                <li>超过限制需拆分为多个 sitemap</li>
                <li>在 robots.txt 中声明 sitemap 位置</li>
                <li>提交到 Google Search Console</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
