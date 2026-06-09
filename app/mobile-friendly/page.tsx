'use client';

// 📱 Mobile-Friendly Test — 移动友好检测工具
// 服务端 HTML 解析 + 15项移动友好检测 + 评分系统

import { useState, useCallback } from 'react';
import Link from 'next/link';
import AdBanner from '@/components/AdBanner';

// ==============================
// Types
// ==============================

type CheckStatus = 'pass' | 'warning' | 'fail';

interface CheckResult {
  status: CheckStatus;
  label: string;
  detail: string;
  suggestion: string;
}

interface AnalysisResult {
  url: string;
  score: number;
  checks: CheckResult[];
  suggestions: string[];
  timestamp: string;
  details: {
    viewport: {
      content: string;
      hasWidth: boolean;
      hasInitialScale: boolean;
      hasMaximumScale: boolean;
      hasUserScalable: boolean;
      isResponsive: boolean;
    };
    fonts: {
      minFontSize: number;
      smallTextCount: number;
      totalTextElements: number;
    };
    touchTargets: {
      totalLinks: number;
      smallLinks: number;
      smallButtons: number;
      smallInputs: number;
    };
    responsive: {
      hasMediaQueries: boolean;
      mediaQueryCount: number;
      hasFlexbox: boolean;
      hasGrid: boolean;
      hasFluidImages: boolean;
      hasOverflowHidden: boolean;
    };
    metaViewportRaw: string | null;
    doctype: string | null;
    hasMobileNav: boolean;
    hasAppleTouchIcon: boolean;
    hasTapHighlightColor: boolean;
  };
}

// ==============================
// Quick Test URLs
// ==============================

const QUICK_URLS = [
  { label: '我的网站', url: 'sinmoniker.com' },
  { label: 'Wikipedia', url: 'en.wikipedia.org' },
  { label: '百度', url: 'baidu.com' },
  { label: 'Google', url: 'google.com' },
];

// ==============================
// Helpers
// ==============================

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getStatusIcon(status: CheckStatus): string {
  switch (status) {
    case 'pass': return '✅';
    case 'warning': return '⚠️';
    case 'fail': return '❌';
  }
}

function getStatusBadge(status: CheckStatus): { text: string; className: string } {
  switch (status) {
    case 'pass':
      return { text: '通过', className: 'bg-green-100 text-green-700 border-green-200' };
    case 'warning':
      return { text: '建议', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    case 'fail':
      return { text: '未通过', className: 'bg-red-100 text-red-700 border-red-200' };
  }
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function pluralize(count: number, unit: string): string {
  return `${count} ${unit}`;
}

// ==============================
// Main Component
// ==============================

export default function MobileFriendlyPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mfHistory') || '[]');
    } catch { return []; }
  });

  // ==============================
  // Analysis
  // ==============================

  const runAnalysis = useCallback(async (targetUrl: string) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/mobile-friendly/inspect?url=${encodeURIComponent(targetUrl)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '检测失败' }));
        throw new Error(err.error || `请求失败 (${res.status})`);
      }
      const data: AnalysisResult = await res.json();
      setResult(data);

      // Save to history
      setHistory(prev => {
        const updated = [data.url, ...prev.filter(h => h !== data.url)].slice(0, 10);
        try { localStorage.setItem('mfHistory', JSON.stringify(updated)); } catch {}
        return updated;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    runAnalysis(url.trim());
  };

  const handleQuickUrl = (u: string) => {
    setUrl(u);
    runAnalysis(u);
  };

  const handleCopyReport = () => {
    if (!result) return;
    const lines = [
      '📱 移动友好检测报告',
      '━'.repeat(30),
      `检测 URL: ${result.url}`,
      `检测时间: ${formatTimestamp(result.timestamp)}`,
      `移动友好评分: ${result.score}/100`,
      '',
      '━'.repeat(30),
      '检测结果',
      '━'.repeat(30),
    ];

    for (const check of result.checks) {
      lines.push(`${getStatusIcon(check.status)} ${check.label}`);
      lines.push(`   ${check.detail}`);
      if (check.status !== 'pass') {
        lines.push(`   建议: ${check.suggestion}`);
      }
      lines.push('');
    }

    if (result.suggestions.length > 0) {
      lines.push('━'.repeat(30));
      lines.push('优化建议');
      lines.push('━'.repeat(30));
      result.suggestions.forEach((s, i) => {
        lines.push(`${i + 1}. ${s}`);
      });
    }

    lines.push('');
    lines.push('由 Sinmoniker 移动友好检测工具生成');
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  };

  // ==============================
  // Render
  // ==============================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-teal-200 hover:text-white text-sm">← 首页</Link>
          <span className="text-teal-400 mx-1">|</span>
          <span className="font-bold text-lg">📱 移动友好检测</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Hero */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 shadow-sm">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
            📱 移动友好检测
          </h1>
          <p className="text-sm sm:text-base text-gray-500">
            检测网页在移动设备上的表现。分析视口配置、字体大小、触摸目标、响应式 CSS 等 <strong className="text-gray-700">15 项</strong> 移动友好指标，给出综合评分和优化建议。
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="输入网址，例如 sinmoniker.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 justify-center"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  检测中...
                </>
              ) : (
                <>
                  🔍 检测
                </>
              )}
            </button>
          </form>

          {/* Quick URLs */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-gray-400 self-center">快速检测：</span>
            {QUICK_URLS.map(item => (
              <button
                key={item.label}
                onClick={() => handleQuickUrl(item.url)}
                disabled={loading}
                className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-400">历史记录：</span>
              {history.map((h, i) => (
                <button
                  key={`${h}-${i}`}
                  onClick={() => { setUrl(h); runAnalysis(h); }}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-teal-50 text-teal-700 rounded-full hover:bg-teal-100 disabled:opacity-50 transition-colors truncate max-w-[160px]"
                  title={h}
                >
                  {h.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </button>
              ))}
              <button
                onClick={() => {
                  setHistory([]);
                  try { localStorage.removeItem('mfHistory'); } catch {}
                }}
                className="px-2 py-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                清空
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2">
              <span className="text-lg">❌</span>
              <div>
                <div className="font-medium text-red-700 text-sm">检测失败</div>
                <div className="text-red-600 text-sm mt-1">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 mb-4 shadow-sm">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-100 flex items-center justify-center animate-pulse">
                <span className="text-3xl">📱</span>
              </div>
              <div className="text-gray-500 mb-2">正在检测移动友好性...</div>
              <div className="text-sm text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="inline-block w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="inline-block w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Score Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                {/* Score Circle */}
                <div className="relative w-28 h-28 shrink-0">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="52"
                      fill="none"
                      stroke={result.score >= 80 ? '#22c55e' : result.score >= 60 ? '#eab308' : '#ef4444'}
                      strokeWidth="8"
                      strokeDasharray={`${(result.score / 100) * 326.7} 326.7`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getScoreColor(result.score)}`}>
                        {result.score}
                      </div>
                      <div className="text-xs text-gray-400">/ 100</div>
                    </div>
                  </div>
                </div>

                {/* Score Info */}
                <div className="flex-1 text-center sm:text-left">
                  <div className={`text-lg font-bold mb-1 ${getScoreColor(result.score)}`}>
                    {result.score >= 80 ? '✅ 移动友好度高' :
                     result.score >= 60 ? '⚠️ 需要优化' :
                     '❌ 移动友好度低'}
                  </div>
                  <div className="text-sm text-gray-500 mb-3">
                    检测 {result.checks.length} 项指标，其中{' '}
                    {result.checks.filter(c => c.status === 'pass').length} 项通过，{' '}
                    {result.checks.filter(c => c.status === 'warning').length} 项建议，{' '}
                    {result.checks.filter(c => c.status === 'fail').length} 项未通过
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <button
                      onClick={handleCopyReport}
                      className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      📋 复制报告
                    </button>
                    <div className="text-xs text-gray-400 self-center">
                      检测于 {formatTimestamp(result.timestamp)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick stats bar */}
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-700">{result.checks.filter(c => c.status === 'pass').length}</div>
                  <div className="text-[10px] text-green-600">通过</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-yellow-700">{result.checks.filter(c => c.status === 'warning').length}</div>
                  <div className="text-[10px] text-yellow-600">建议</div>
                </div>
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-700">{result.checks.filter(c => c.status === 'fail').length}</div>
                  <div className="text-[10px] text-red-600">未通过</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-700">{result.details.touchTargets.totalLinks}</div>
                  <div className="text-[10px] text-blue-600">链接数</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-purple-700">{result.details.responsive.mediaQueryCount}</div>
                  <div className="text-[10px] text-purple-600">媒体查询</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-amber-700">{result.details.fonts.totalTextElements}</div>
                  <div className="text-[10px] text-amber-600">字体声明</div>
                </div>
              </div>
            </div>

            {/* Detail Checks */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="font-semibold text-gray-700 text-sm">📋 检测详情</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {result.checks.map((check, i) => {
                  const badge = getStatusBadge(check.status);
                  return (
                    <div key={i} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="text-lg mt-0.5 shrink-0">{getStatusIcon(check.status)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-gray-800 text-sm">{check.label}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${badge.className}`}>
                              {badge.text}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mb-1">{check.detail}</div>
                          {check.status !== 'pass' && (
                            <div className="text-sm text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg mt-1 border border-teal-100">
                              💡 {check.suggestion}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Technical Details (collapsible) */}
            <details className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <summary className="px-4 sm:px-6 py-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2">
                <span className="text-sm">🔧</span>
                <span className="font-medium text-gray-700 text-sm">移动友好技术详情</span>
                <span className="text-xs text-gray-400 ml-auto">点击展开</span>
              </summary>
              <div className="px-4 sm:px-6 py-4 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {/* Viewport */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-medium text-gray-700 mb-2">📐 Viewport 配置</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">原始内容</span>
                        <span className="text-gray-700 font-mono">{result.details.metaViewportRaw || '未设置'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Responsive</span>
                        <span className={result.details.viewport.isResponsive ? 'text-green-600' : 'text-red-600'}>
                          {result.details.viewport.isResponsive ? '是' : '否'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">width=device-width</span>
                        <span className={result.details.viewport.hasWidth ? 'text-green-600' : 'text-red-600'}>
                          {result.details.viewport.hasWidth ? '✔' : '✘'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">initial-scale</span>
                        <span className={result.details.viewport.hasInitialScale ? 'text-green-600' : 'text-gray-400'}>
                          {result.details.viewport.hasInitialScale ? '✔' : '✘'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">DOCTYPE</span>
                        <span className="text-gray-700 font-mono text-[10px]">{result.details.doctype || '未设置'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fonts */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-medium text-gray-700 mb-2">🔤 字体</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">最小字体</span>
                        <span className="text-gray-700">{result.details.fonts.minFontSize}px</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">小字体个数</span>
                        <span className={result.details.fonts.smallTextCount > 0 ? 'text-yellow-600' : 'text-green-600'}>
                          {result.details.fonts.smallTextCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">总字体声明</span>
                        <span className="text-gray-700">{result.details.fonts.totalTextElements}</span>
                      </div>
                    </div>
                  </div>

                  {/* Touch Targets */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-medium text-gray-700 mb-2">👆 触摸目标</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">链接总数</span>
                        <span className="text-gray-700">{result.details.touchTargets.totalLinks}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">偏小链接</span>
                        <span className={result.details.touchTargets.smallLinks > 0 ? 'text-yellow-600' : 'text-green-600'}>
                          {result.details.touchTargets.smallLinks}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">偏小按钮</span>
                        <span className={result.details.touchTargets.smallButtons > 0 ? 'text-yellow-600' : 'text-green-600'}>
                          {result.details.touchTargets.smallButtons}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">偏小输入框</span>
                        <span className={result.details.touchTargets.smallInputs > 0 ? 'text-yellow-600' : 'text-green-600'}>
                          {result.details.touchTargets.smallInputs}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Responsive CSS */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-medium text-gray-700 mb-2">🎨 响应式 CSS</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">媒体查询数</span>
                        <span className="text-gray-700">{result.details.responsive.mediaQueryCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Flexbox</span>
                        <span className={result.details.responsive.hasFlexbox ? 'text-green-600' : 'text-gray-400'}>
                          {result.details.responsive.hasFlexbox ? '✔' : '✘'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">CSS Grid</span>
                        <span className={result.details.responsive.hasGrid ? 'text-green-600' : 'text-gray-400'}>
                          {result.details.responsive.hasGrid ? '✔' : '✘'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">图片自适应</span>
                        <span className={result.details.responsive.hasFluidImages ? 'text-green-600' : 'text-gray-400'}>
                          {result.details.responsive.hasFluidImages ? '✔' : '✘'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">移动端导航</span>
                        <span className={result.details.hasMobileNav ? 'text-green-600' : 'text-gray-400'}>
                          {result.details.hasMobileNav ? '有' : '未检测到'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </details>

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-6 shadow-sm">
                <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <span>💡</span> 优化建议 ({result.suggestions.length})
                </h3>
                <ul className="space-y-2">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                      <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Target URL info */}
            <div className="text-center text-xs text-gray-400">
              检测目标：<a href={result.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">{result.url}</a>
            </div>
          </div>
        )}
      </div>

      {/* Ad Banner */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <AdBanner />
      </div>
    </div>
  );
}
