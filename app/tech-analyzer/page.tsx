/**
 * Tech Stack Analyzer — 网站技术栈检测工具
 * 输入网址 → 自动识别服务器、CMS、前端框架、CDN、分析工具、JS库等
 *
 * 壁垒：
 * - 服务端 HTTP 请求，不受浏览器限制
 * - 30+ 检测规则，覆盖主流 Web 技术
 * - 从 HTTP 响应头 & HTML 内容双重分析
 * - 中文友好展示
 */

'use client';

import { useState, useCallback } from 'react';
import AdBanner from '@/components/AdBanner';

// ============ Types ============

type TechCategory =
  | 'server'
  | 'cms'
  | 'framework'
  | 'cdn'
  | 'analytics'
  | 'js-library'
  | 'css-framework'
  | 'hosting'
  | 'email'
  | 'other';

interface TechItem {
  name: string;
  category: TechCategory;
  confidence: 'high' | 'medium' | 'low';
  version?: string;
  icon: string;
}

interface TechResult {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  responseTime: number;
  status: number;
  technologies: TechItem[];
  summary: {
    server: string;
    cms: string;
    framework: string;
    cdn: string;
    analytics: string[];
  };
}

// ============ Suggested URLs ============

const SUGGESTED_URLS = [
  { label: '我的网站', example: 'sinmoniker.com' },
  { label: '百度', example: 'baidu.com' },
  { label: '谷歌', example: 'google.com' },
  { label: 'B站', example: 'bilibili.com' },
];

// ============ Category Config ============

const CATEGORY_CONFIG: Record<TechCategory, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  server: { label: '服务器', emoji: '🖥️', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  cms: { label: 'CMS', emoji: '📰', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  framework: { label: '框架', emoji: '🧱', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  cdn: { label: 'CDN', emoji: '🌐', color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  analytics: { label: '分析工具', emoji: '📊', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'js-library': { label: 'JS 库', emoji: '📦', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
  'css-framework': { label: 'CSS 框架', emoji: '🎨', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  hosting: { label: '托管', emoji: '🏠', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  email: { label: '邮件服务', emoji: '📧', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  other: { label: '其他', emoji: '🔧', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
};

const CATEGORY_ORDER: TechCategory[] = [
  'server', 'cms', 'framework', 'cdn', 'hosting', 'analytics', 'js-library', 'css-framework', 'email', 'other',
];

// ============ Helpers ============

function getConfidenceBadge(conf: 'high' | 'medium' | 'low'): string {
  switch (conf) {
    case 'high': return '✅ 准确';
    case 'medium': return '🔍 可能';
    case 'low': return '❓ 推测';
  }
}

function getConfidenceColor(conf: 'high' | 'medium' | 'low'): string {
  switch (conf) {
    case 'high': return 'text-green-600 bg-green-50 border-green-200';
    case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'low': return 'text-gray-500 bg-gray-50 border-gray-200';
  }
}

function getStatusEmoji(status: number): string {
  if (status >= 200 && status < 300) return '✅';
  if (status >= 300 && status < 400) return '🔀';
  if (status >= 400 && status < 500) return '⚠️';
  if (status >= 500) return '❌';
  return '❓';
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600 bg-green-50 border-green-200';
  if (status >= 300 && status < 400) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (status >= 400 && status < 500) return 'text-amber-600 bg-amber-50 border-amber-200';
  if (status >= 500) return 'text-red-600 bg-red-50 border-red-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

function formatTime(ms: number): string {
  if (ms === 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getTimeColor(ms: number): string {
  if (ms === 0) return 'text-gray-400';
  if (ms < 500) return 'text-green-600';
  if (ms < 1500) return 'text-amber-600';
  return 'text-red-600';
}

function groupByCategory(technologies: TechItem[]): Map<TechCategory, TechItem[]> {
  const map = new Map<TechCategory, TechItem[]>();
  for (const tech of technologies) {
    const existing = map.get(tech.category) || [];
    existing.push(tech);
    map.set(tech.category, existing);
  }
  return map;
}

// ============ Component ============

export default function TechAnalyzerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TechResult | null>(null);
  const [error, setError] = useState('');

  const analyze = useCallback(async (targetUrl: string) => {
    const u = targetUrl.trim();
    if (!u) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/tech-analyzer/inspect?url=${encodeURIComponent(u)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const data: TechResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || '分析失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyze(url);
  };

  const grouped = result ? groupByCategory(result.technologies) : new Map();
  const techCount = result ? result.technologies.length : 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-cream">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-indigo-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔬</span>
            <div>
              <h1 className="text-lg font-bold text-indigo-900">Tech Stack Analyzer</h1>
              <p className="text-xs text-indigo-500 hidden sm:block">网站技术栈分析器</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <a href="/" className="text-indigo-600 hover:text-amber-600 transition-colors">← 返回首页</a>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="text-5xl mb-3">🔬🧱</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-indigo-900 mb-2">
            这个网站用了什么技术？
          </h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            输入网址，一键识别网站的技术栈 — 服务器、CMS、前端框架、CDN、分析工具、JS 库等
            <span className="block text-xs text-gray-400 mt-1">竞品分析利器 — 30+ 检测规则覆盖主流 Web 技术</span>
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
                className="w-full px-4 py-3.5 rounded-xl border border-indigo-200 bg-white
                  text-indigo-900 placeholder:text-gray-400 text-sm
                  focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
                  transition-all shadow-sm"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 
                text-white font-medium rounded-xl text-sm
                hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50 
                disabled:cursor-not-allowed transition-all shadow-sm
                whitespace-nowrap flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  🔬 分析
                </>
              )}
            </button>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            <span className="text-xs text-gray-400 self-center">快速分析：</span>
            {SUGGESTED_URLS.map(({ label, example }) => (
              <button
                key={example}
                type="button"
                onClick={() => { setUrl(example); analyze(example); }}
                disabled={loading}
                className="text-xs px-3 py-1 rounded-full bg-white border border-indigo-100 
                  text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all
                  disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="max-w-xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
            <div className="h-8 bg-indigo-100 rounded-lg w-1/3" />
            <div className="h-24 bg-indigo-50 rounded-xl" />
            <div className="h-48 bg-indigo-50 rounded-xl" />
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Overview Card */}
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                    <span>{getStatusEmoji(result.status)}</span>
                    <span>{result.status} {result.finalUrl === result.url ? '' : '→ 重定向'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(result.status)}`}>
                      HTTP {result.status}
                    </span>
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 font-mono break-all">
                    {result.url}
                  </p>
                  {result.finalUrl !== result.url && (
                    <p className="text-xs text-gray-400 mt-1 font-mono break-all">
                      → {result.finalUrl}
                    </p>
                  )}
                  {result.title && (
                    <p className="text-sm text-gray-600 mt-2 italic">
                      &ldquo;{result.title.slice(0, 100)}&rdquo;
                    </p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className={`text-3xl font-black ${getTimeColor(result.responseTime)}`}>
                    {formatTime(result.responseTime)}
                  </div>
                  <div className="text-xs text-gray-400">响应时间</div>
                  <div className="mt-2 flex items-center gap-1 text-lg font-bold text-indigo-600">
                    <span>{techCount}</span>
                    <span className="text-xs text-gray-400 font-normal">项技术</span>
                  </div>
                </div>
              </div>

              {/* Summary quick badges */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                {result.summary.server !== '未知' && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                    🖥️ {result.summary.server}
                  </span>
                )}
                {result.summary.cms !== '未知' && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    📰 {result.summary.cms}
                  </span>
                )}
                {result.summary.framework !== '未知' && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    🧱 {result.summary.framework}
                  </span>
                )}
                {result.summary.cdn !== '未知' && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                    🌐 {result.summary.cdn}
                  </span>
                )}
                {result.summary.analytics.map((a, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    📊 {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Description */}
            {result.description && (
              <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-indigo-900 mb-2">📝 网站描述</h3>
                <p className="text-sm text-gray-600">{result.description}</p>
              </div>
            )}

            {/* Tech Stack Categories */}
            {CATEGORY_ORDER.map(category => {
              const items = grouped.get(category);
              if (!items || items.length === 0) return null;
              const cfg = CATEGORY_CONFIG[category];
              return (
                <div key={category} className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
                  <div className={`px-5 py-3 ${cfg.bg} border-b ${cfg.border}`}>
                    <h3 className={`text-sm font-bold ${cfg.color} flex items-center gap-2`}>
                      <span>{cfg.emoji}</span>
                      {cfg.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border} ml-auto`}>
                        {items.length}
                      </span>
                    </h3>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((tech, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg">{tech.icon}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate">
                                {tech.name}
                              </div>
                              {tech.version && (
                                <div className="text-xs text-gray-400">
                                  v{tech.version}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${getConfidenceColor(tech.confidence)}`}>
                            {getConfidenceBadge(tech.confidence)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Share */}
            <div className="text-center">
              <button
                onClick={() => {
                  const lines: string[] = [
                    `🔬 Tech Stack Analyzer 分析报告`,
                    `━━━━━━━━━━━━━━━━`,
                    `目标: ${result.url}`,
                    `状态: HTTP ${result.status} (${formatTime(result.responseTime)})`,
                    `━━━━━━━━━━━━━━━━`,
                  ];
                  for (const category of CATEGORY_ORDER) {
                    const items = grouped.get(category);
                    if (items && items.length > 0) {
                      const cfg = CATEGORY_CONFIG[category];
                      lines.push(`${cfg.emoji} ${cfg.label}: ${items.map(t => t.name + (t.version ? ` v${t.version}` : '')).join(', ')}`);
                    }
                  }
                  lines.push(`━━━━━━━━━━━━━━━━`);
                  lines.push(`立即分析: ${window.location.origin}/tech-analyzer`);
                  navigator.clipboard.writeText(lines.join('\n'))
                    .then(() => alert('✅ 分析报告已复制到剪贴板'))
                    .catch(() => {});
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-200 
                  text-indigo-600 text-sm hover:bg-indigo-50 transition-all"
              >
                📋 复制分析报告
              </button>
            </div>

            <AdBanner position="bottom" source="default" />
          </div>
        )}

        {/* How it works */}
        {!result && !loading && (
          <div className="max-w-2xl mx-auto mt-12">
            <h3 className="text-center text-sm font-bold text-indigo-700 mb-4">🔬 检测原理</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: '📡', title: '服务端请求', desc: '使用 Next.js 服务端 fetch，获取真实 HTTP 响应头和 HTML 内容' },
                { icon: '🧩', title: '智能分析', desc: '30+ 检测规则，从响应头和 HTML 中识别技术栈特征' },
                { icon: '📊', title: '分类展示', desc: '按服务器/CMS/框架/CDN/分析工具等分类，直观展示' },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 bg-white/50 rounded-xl border border-indigo-100">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="text-sm font-medium text-indigo-900">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                </div>
              ))}
            </div>

            {/* Supported technologies preview */}
            <div className="mt-8 text-center">
              <h4 className="text-xs font-medium text-gray-400 mb-3">支持检测 30+ 技术：</h4>
              <div className="flex flex-wrap justify-center gap-1.5">
                {[
                  { icon: '🔶', name: 'Nginx' },
                  { icon: '🟥', name: 'Apache' },
                  { icon: '🟦', name: 'IIS' },
                  { icon: '▲', name: 'Next.js' },
                  { icon: '⚛️', name: 'React' },
                  { icon: '💚', name: 'Vue.js' },
                  { icon: '🔵', name: 'WordPress' },
                  { icon: '👻', name: 'Ghost' },
                  { icon: '☁️', name: 'Cloudflare' },
                  { icon: '📊', name: 'Google Analytics' },
                  { icon: '🇨🇳', name: '百度统计' },
                  { icon: '🟣', name: 'jQuery' },
                  { icon: '🌊', name: 'Tailwind' },
                  { icon: '🐘', name: 'PHP' },
                  { icon: '🔒', name: 'HSTS' },
                ].map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white rounded-full border border-gray-100 text-gray-600">
                    <span>{item.icon}</span>
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no result */}
        {!result && !loading && !error && (
          <div className="max-w-xl mx-auto mt-8 text-center text-gray-400 text-xs">
            输入网址开始分析，看看网站用了哪些技术 🚀
          </div>
        )}
      </div>
    </main>
  );
}
