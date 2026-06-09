/**
 * Content Analyzer — 网页内容结构分析工具
 * 输入网址 → 分析标题层级、字数、阅读时间、关键词密度、
 * 图片Alt属性、内外链分布、可读性评分 → 优化建议
 *
 * 壁垒：
 * - 服务端 cheerio 内容解析引擎
 * - 7 维评分体系（内容长度/标题结构/图片/链接/可读性）
 * - 关键词密度分析（去停用词）
 * - 可读性评分（Flesch Reading Ease）
 */

'use client';

import { useState, useCallback } from 'react';
import AdBanner from '@/components/AdBanner';

// ============ Types ============

interface HeadingInfo {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  hasContent: boolean;
}

interface KeywordDensity {
  keyword: string;
  count: number;
  density: number;
}

interface LinkStats {
  total: number;
  internal: number;
  external: number;
  internalPercent: number;
  externalPercent: number;
  broken: number;
  noFollow: number;
}

interface ImageStats {
  total: number;
  withAlt: number;
  withoutAlt: number;
  altPercent: number;
}

interface ScoreBreakdown {
  category: string;
  score: number;
  max: number;
  note: string;
}

interface ContentAnalyzerResult {
  url: string;
  finalUrl: string;
  status: number;
  responseTime: number;
  title: string;
  description: string;
  wordCount: number;
  charCount: number;
  paragraphCount: number;
  readingTimeMinutes: number;
  readingTimeSeconds: number;
  headings: HeadingInfo[];
  headingIssues: string[];
  keywordDensity: KeywordDensity[];
  topKeywords: KeywordDensity[];
  links: LinkStats;
  images: ImageStats;
  avgWordsPerSentence: number;
  longSentences: number;
  fleschReadingEase: number;
  score: number;
  scoreBreakdown: ScoreBreakdown[];
  errors: string[];
}

// ============ Suggested URLs ============

const SUGGESTED_URLS = [
  { label: '我的网站', example: 'sinmoniker.com' },
  { label: '维基百科', example: 'en.wikipedia.org/wiki/SEO' },
  { label: 'Medium 博客', example: 'medium.com' },
  { label: '百度百科', example: 'baike.baidu.com/item/SEO' },
];

// ============ Helpers ============

function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getTimeColor(ms: number): string {
  if (ms === 0) return 'text-gray-400';
  if (ms < 800) return 'text-green-600';
  if (ms < 2000) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 60) return 'bg-amber-50 border-amber-200';
  if (score >= 40) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return '优秀 🏆';
  if (score >= 80) return '很好 ✅';
  if (score >= 70) return '不错 👍';
  if (score >= 60) return '合格 ⚠️';
  if (score >= 40) return '需改进 🔧';
  return '差 ❌';
}

function getFleschLabel(score: number): string {
  if (score >= 90) return '非常容易';
  if (score >= 80) return '容易';
  if (score >= 70) return '较容易';
  if (score >= 60) return '标准';
  if (score >= 50) return '较难';
  if (score >= 30) return '难';
  return '非常难';
}

function getFleschColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

// ============ Component ============

export default function ContentAnalyzerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentAnalyzerResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAllKeywords, setShowAllKeywords] = useState(false);

  const analyze = useCallback(async (targetUrl: string) => {
    const u = targetUrl.trim();
    if (!u) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/content-analyzer/analyze?url=${encodeURIComponent(u)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const data: ContentAnalyzerResult = await res.json();
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

  const handleCopyReport = () => {
    if (!result) return;
    const lines: string[] = [
      `📄 Content Analyzer 分析报告`,
      `━━━━━━━━━━━━━━━━`,
      `目标: ${result.url}`,
      `状态: HTTP ${result.status} (${formatTime(result.responseTime)})`,
      `━━━━━━━━━━━━━━━━`,
      `总分: ${result.score}/100 (${getScoreLabel(result.score)})`,
      `━━━━━━━━━━━━━━━━`,
      `📝 基础信息`,
      `  标题: ${result.title || '(无)'}`,
      `  字数: ${result.wordCount} 词 / ${result.charCount} 字`,
      `  段落: ${result.paragraphCount}`,
      `  阅读时间: ~${result.readingTimeMinutes} 分钟`,
      `━━━━━━━━━━━━━━━━`,
      `📐 标题结构`,
      ...result.headings.map(h => `  H${h.level}: ${h.text.slice(0, 60)}`),
      ...result.headingIssues.map(issue => `  ⚠️ ${issue}`),
      `━━━━━━━━━━━━━━━━`,
      `🔗 链接 (${result.links.total})`,
      `  站内: ${result.links.internal} (${result.links.internalPercent}%)`,
      `  站外: ${result.links.external} (${result.links.externalPercent}%)`,
      `  外链nofollow: ${result.links.noFollow}`,
      `━━━━━━━━━━━━━━━━`,
      `🖼️ 图片 (${result.images.total})`,
      `  有Alt: ${result.images.withAlt}`,
      `  无Alt: ${result.images.withoutAlt}`,
      `━━━━━━━━━━━━━━━━`,
      `📊 可读性`,
      `  平均句长: ${result.avgWordsPerSentence} 词`,
      `  长句: ${result.longSentences}`,
      `  Flesch评分: ${result.fleschReadingEase} (${getFleschLabel(result.fleschReadingEase)})`,
      `━━━━━━━━━━━━━━━━`,
      `🏷️ 高频关键词 (Top 10)`,
      ...result.topKeywords.slice(0, 10).map(k => `  ${k.keyword}: ${k.count} 次 (${k.density}%)`),
      `━━━━━━━━━━━━━━━━`,
      `立即分析: ${window.location.origin}/content-analyzer`,
    ];
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-cream">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-emerald-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <div>
              <h1 className="text-lg font-bold text-emerald-900">Content Analyzer</h1>
              <p className="text-xs text-emerald-500 hidden sm:block">网页内容分析 &amp; SEO 诊断</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <a href="/" className="text-emerald-600 hover:text-amber-600 transition-colors">← 返回首页</a>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="text-5xl mb-3">📄🔬</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-emerald-900 mb-2">
            你的网页内容质量怎么样？
          </h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            输入网址，一键分析内容结构、可读性和 SEO 质量
            <span className="block text-xs text-gray-400 mt-1">
              标题层级、关键词密度、图片Alt、内外链、7维评分
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
                className="w-full px-4 py-3.5 rounded-xl border border-emerald-200 bg-white
                  text-emerald-900 placeholder:text-gray-400 text-sm
                  focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
                  transition-all shadow-sm"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500
                text-white font-medium rounded-xl text-sm
                hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50
                disabled:cursor-not-allowed transition-all shadow-sm
                whitespace-nowrap flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  分析中...
                </>
              ) : (
                <>🔬 分析</>
              )}
            </button>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            <span className="text-xs text-gray-400 self-center">快速检测：</span>
            {SUGGESTED_URLS.map(({ label, example }) => (
              <button
                key={example}
                type="button"
                onClick={() => { setUrl(example); analyze(example); }}
                disabled={loading}
                className="text-xs px-3 py-1 rounded-full bg-white border border-emerald-100
                  text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 transition-all
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
            <div className="h-8 bg-emerald-100 rounded-lg w-1/3" />
            <div className="h-32 bg-emerald-50 rounded-xl" />
            <div className="h-48 bg-emerald-50 rounded-xl" />
            <div className="h-24 bg-emerald-50 rounded-xl" />
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Overview Card */}
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-2xl font-black ${getScoreColor(result.score)}`}>
                      {result.score}
                    </span>
                    <span className="text-xs text-gray-400">/ 100</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getScoreBg(result.score)}`}>
                      {getScoreLabel(result.score)}
                    </span>
                  </div>
                  {result.title && (
                    <p className="text-sm text-gray-600 font-medium truncate max-w-lg" title={result.title}>
                      &ldquo;{result.title.slice(0, 80)}&rdquo;
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 font-mono truncate">{result.url}</p>
                  {result.finalUrl !== result.url && (
                    <p className="text-xs text-gray-400 font-mono truncate">→ {result.finalUrl}</p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-1 shrink-0">
                  <div>
                    <div className={`text-2xl font-black ${getTimeColor(result.responseTime)}`}>
                      {formatTime(result.responseTime)}
                    </div>
                    <div className="text-xs text-gray-400">响应时间</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200">
                <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <span>📊</span>
                  评分详情
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ml-auto">
                    {result.score}/100
                  </span>
                </h3>
              </div>
              <div className="p-5 space-y-4">
                {result.scoreBreakdown.map((item, i) => {
                  const pct = item.max > 0 ? (item.score / item.max) * 100 : 0;
                  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : pct >= 40 ? 'bg-orange-500' : 'bg-red-500';
                  const textColor = pct >= 60 ? 'text-green-700' : 'text-amber-700';
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-gray-700">{item.category}</div>
                        <div className={`text-xs font-bold ${textColor}`}>
                          {item.score}/{item.max}
                        </div>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">{item.note}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                <div className="text-xs text-gray-400">📝 字数</div>
                <div className="text-lg font-bold text-gray-800 mt-1">{result.wordCount.toLocaleString()}</div>
                <div className="text-xs text-gray-400">{result.paragraphCount} 段落</div>
              </div>
              <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                <div className="text-xs text-gray-400">⏱ 阅读时间</div>
                <div className="text-lg font-bold text-gray-800 mt-1">~{result.readingTimeMinutes} 分钟</div>
                <div className="text-xs text-gray-400">约 {result.readingTimeSeconds}s</div>
              </div>
              <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                <div className="text-xs text-gray-400">🔗 链接</div>
                <div className="text-lg font-bold text-gray-800 mt-1">{result.links.total}</div>
                <div className="text-xs text-gray-400">
                  内{result.links.internal} 外{result.links.external}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                <div className="text-xs text-gray-400">📖 可读性</div>
                <div className={`text-lg font-bold mt-1 ${getFleschColor(result.fleschReadingEase)}`}>
                  {result.fleschReadingEase > 0 ? result.fleschReadingEase : 'N/A'}
                </div>
                <div className="text-xs text-gray-400">{getFleschLabel(result.fleschReadingEase)}</div>
              </div>
            </div>

            {/* Heading Structure */}
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200">
                <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <span>📐</span>
                  标题层级结构
                  {result.headingIssues.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-auto">
                      {result.headingIssues.length} 个问题
                    </span>
                  )}
                </h3>
              </div>
              <div className="p-5">
                {/* Heading list */}
                {result.headings.length > 0 ? (
                  <div className="space-y-1.5 mb-4">
                    {result.headings.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-1.5 rounded-lg hover:bg-gray-50"
                        style={{ paddingLeft: `${12 + (h.level - 1) * 20}px` }}
                      >
                        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-mono font-bold
                          ${h.level === 1 ? 'bg-emerald-100 text-emerald-700' :
                            h.level === 2 ? 'bg-blue-100 text-blue-700' :
                            h.level === 3 ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-600'}`}>
                          H{h.level}
                        </span>
                        <span className={`text-sm ${h.text ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                          {h.text || '(空标题)'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic text-center py-3">页面未使用标题标签</p>
                )}

                {/* Heading issues */}
                {result.headingIssues.length > 0 && (
                  <div className="space-y-2 mt-2 pt-4 border-t border-gray-100">
                    {result.headingIssues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                        <span className="text-xs shrink-0">⚠️</span>
                        <span className="text-xs text-amber-800">{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Keywords */}
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200">
                <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <span>🏷️</span>
                  高频关键词
                  <span className="text-xs text-emerald-600 font-normal ml-auto">
                    前 {showAllKeywords ? result.topKeywords.length : 10} /
                    共 {result.keywordDensity.length} 个
                  </span>
                </h3>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-1.5">
                  {(showAllKeywords ? result.keywordDensity : result.topKeywords).map((kw, i) => {
                    // Color based on rank
                    const colors = [
                      'bg-red-50 border-red-200 text-red-700',
                      'bg-orange-50 border-orange-200 text-orange-700',
                      'bg-amber-50 border-amber-200 text-amber-700',
                      'bg-yellow-50 border-yellow-200 text-yellow-700',
                      'bg-lime-50 border-lime-200 text-lime-700',
                      'bg-emerald-50 border-emerald-200 text-emerald-700',
                      'bg-teal-50 border-teal-200 text-teal-700',
                      'bg-cyan-50 border-cyan-200 text-cyan-700',
                      'bg-sky-50 border-sky-200 text-sky-700',
                      'bg-blue-50 border-blue-200 text-blue-700',
                    ];
                    const color = i < 10 ? colors[i] : 'bg-gray-50 border-gray-200 text-gray-600';
                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${color}`}
                        title={`${kw.keyword}: ${kw.count} 次 (${kw.density}%)`}
                      >
                        <span className="opacity-60">#{i + 1}</span>
                        {kw.keyword}
                        <span className="text-[10px] opacity-60">{kw.count}</span>
                      </span>
                    );
                  })}
                </div>

                {!showAllKeywords && result.keywordDensity.length > 10 && (
                  <button
                    onClick={() => setShowAllKeywords(true)}
                    className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    显示全部 {result.keywordDensity.length} 个关键词 →
                  </button>
                )}
                {showAllKeywords && result.keywordDensity.length > 10 && (
                  <button
                    onClick={() => setShowAllKeywords(false)}
                    className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    收起 ←
                  </button>
                )}
              </div>
            </div>

            {/* Images & Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Image Stats */}
              <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200">
                  <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    <span>🖼️</span> 图片分析
                  </h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <div className="text-2xl font-bold text-gray-700">{result.images.total}</div>
                      <div className="text-xs text-gray-400 mt-1">总数</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                      <div className="text-2xl font-bold text-green-600">{result.images.withAlt}</div>
                      <div className="text-xs text-gray-400 mt-1">有 Alt</div>
                    </div>
                    {result.images.withoutAlt > 0 && (
                      <div className="text-center p-3 bg-red-50 rounded-xl col-span-2">
                        <div className="text-2xl font-bold text-red-600">{result.images.withoutAlt}</div>
                        <div className="text-xs text-gray-400 mt-1">缺少 Alt 属性</div>
                        {result.images.withoutAlt > 0 && (
                          <p className="text-xs text-red-500 mt-1">建议为所有图片添加描述性 Alt 文本</p>
                        )}
                      </div>
                    )}
                  </div>
                  {result.images.total > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Alt 覆盖率</span>
                        <span className={`font-bold ${result.images.altPercent >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                          {result.images.altPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${result.images.altPercent >= 80 ? 'bg-green-500' : 'bg-amber-500'}`}
                          style={{ width: `${result.images.altPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {result.images.total === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">页面没有图片</p>
                  )}
                </div>
              </div>

              {/* Link Stats */}
              <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200">
                  <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    <span>🔗</span> 链接分析
                  </h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <div className="text-xl font-bold text-gray-700">{result.links.total}</div>
                      <div className="text-xs text-gray-400 mt-1">总数</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-xl">
                      <div className="text-xl font-bold text-blue-600">{result.links.internal}</div>
                      <div className="text-xs text-gray-400 mt-1">站内</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-xl">
                      <div className="text-xl font-bold text-purple-600">{result.links.external}</div>
                      <div className="text-xs text-gray-400 mt-1">站外</div>
                    </div>
                  </div>

                  {/* Donut-style ratio bar */}
                  {result.links.total > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>站内/站外比例</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${result.links.internalPercent}%` }}
                          title={`站内 ${result.links.internalPercent}%`}
                        />
                        <div
                          className="h-full bg-purple-500 transition-all"
                          style={{ width: `${result.links.externalPercent}%` }}
                          title={`站外 ${result.links.externalPercent}%`}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>🔵 站内 {result.links.internalPercent}%</span>
                        <span>🟣 站外 {result.links.externalPercent}%</span>
                      </div>
                      {result.links.noFollow > 0 && (
                        <p className="text-xs text-amber-600 mt-2">
                          ⚠️ 有 {result.links.noFollow} 个 nofollow 外链
                        </p>
                      )}
                    </div>
                  )}
                  {result.links.total === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">页面没有链接</p>
                  )}
                </div>
              </div>
            </div>

            {/* Readability */}
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200">
                <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <span>📖</span> 可读性分析
                </h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className={`text-2xl font-black ${getFleschColor(result.fleschReadingEase)}`}>
                      {result.fleschReadingEase > 0 ? result.fleschReadingEase.toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Flesch 可读性</div>
                    <div className={`text-[10px] font-medium mt-1 ${getFleschColor(result.fleschReadingEase)}`}>
                      {getFleschLabel(result.fleschReadingEase)}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className={`text-2xl font-black ${result.avgWordsPerSentence <= 20 ? 'text-green-600' : result.avgWordsPerSentence <= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                      {result.avgWordsPerSentence}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">平均句长（词）</div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {result.avgWordsPerSentence <= 20 ? '✅ 良好' : result.avgWordsPerSentence <= 30 ? '⚠️ 偏长' : '❌ 过长'}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className={`text-2xl font-black ${result.longSentences === 0 ? 'text-green-600' : result.longSentences <= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                      {result.longSentences}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">长句（&gt;30 词）</div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {result.longSentences === 0 ? '✅ 无长句' : `建议拆短`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Copy Report */}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleCopyReport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-200
                  text-emerald-600 text-sm hover:bg-emerald-50 transition-all"
              >
                {copied ? '✅ 已复制' : '📋 复制分析报告'}
              </button>
            </div>

            <AdBanner position="bottom" source="default" />
          </div>
        )}

        {/* How it works */}
        {!result && !loading && (
          <div className="max-w-2xl mx-auto mt-12">
            <h3 className="text-center text-sm font-bold text-emerald-700 mb-4">🔬 分析原理</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: '📡', title: '服务端抓取', desc: '使用 Next.js 服务端 fetch 获取页面完整 HTML' },
                { icon: '🔬', title: 'Cheerio 解析', desc: '提取标题层级、图片Alt、链接分布、全文内容' },
                { icon: '📊', title: '7维评分', desc: '内容长度/标题/图片/链接/可读性综合评估' },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 bg-white/50 rounded-xl border border-emerald-100">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="text-sm font-medium text-emerald-900">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <h4 className="text-xs font-medium text-gray-400 mb-3">分析维度：</h4>
              <div className="flex flex-wrap justify-center gap-1.5">
                {[
                  { text: '标题层级', color: 'emerald' },
                  { text: '字数统计', color: 'emerald' },
                  { text: '阅读时间', color: 'emerald' },
                  { text: '关键词密度', color: 'emerald' },
                  { text: '图片Alt', color: 'emerald' },
                  { text: '内外链', color: 'emerald' },
                  { text: '可读性评分', color: 'amber' },
                ].map((item, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border
                      ${item.color === 'emerald' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-amber-600 bg-amber-50 border-amber-200'}`}
                  >
                    {item.text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="max-w-xl mx-auto mt-8 text-center text-gray-400 text-xs">
            输入网址开始分析，看看你网页的内容质量 🚀
          </div>
        )}
      </div>
    </main>
  );
}
