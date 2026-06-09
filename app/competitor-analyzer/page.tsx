/**
 * 竞争对手分析工具 (Competitor Analyzer)
 * 
 * 壁垒产品：
 * - 真实爬取 + 结构化分析，不是AI套壳
 * - 30+ SEO检查 + 技术栈识别 + 内容分析 + 关键词提取
 * - 多站对比，可视化报告
 * - 竞品追踪
 */

'use client';

import { useState, useCallback } from 'react';
import AdBanner from '@/components/AdBanner';

// ============ Types ============

interface SEOCheck {
  id: string;
  label: string;
  weight: number;
  score: number;
  detail: string;
  severity: string;
}

interface SEOAnalysis {
  score: number;
  maxScore: number;
  percentage: number;
  grade: string;
  passed: number;
  warnings: number;
  criticals: number;
  suggestions: number;
  checks: SEOCheck[];
}

interface TechItem {
  name: string;
  category: string;
  icon: string;
  confidence: string;
}

interface ContentAnalysis {
  wordCount: number;
  chineseChars: number;
  englishWords: number;
  readingTimeMinutes: number;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h1Tags: string[];
  h2Tags: string[];
  imageCount: number;
  internalLinkCount: number;
  externalLinkCount: number;
}

interface KeywordItem {
  word: string;
  count: number;
}

interface SiteAnalysis {
  domain: string;
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  statusCode: number;
  fetchTime: number;
  analyzedAt: string;
  analysisDuration: number;
  seo: SEOAnalysis;
  technologies: TechItem[];
  content: ContentAnalysis;
  keywords: KeywordItem[];
  errors?: { phase: string; error: string }[];
}

interface TechComparison {
  name: string;
  icon: string;
  category: string;
  sites: string[];
}

interface ComparisonData {
  seoScores: { domain: string; score: number; grade: string }[];
  techComparison: TechComparison[];
  totalCompared: number;
}

interface CompareResult {
  sites: SiteAnalysis[];
  comparison: ComparisonData;
  errors?: { url: string; error: string }[];
}

// ============ Constants ============

const CATEGORY_EMOJIS: Record<string, string> = {
  server: '🖥️', cdn: '🌐', hosting: '🏠', cms: '📰',
  framework: '🧱', 'js-library': '📦', 'css-framework': '🎨',
  analytics: '📊', other: '🔧',
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  server: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  cdn: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  hosting: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  cms: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  framework: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'js-library': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  'css-framework': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  analytics: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  other: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

const SUGGESTED_SITES = [
  { label: '我的网站', url: 'sinmoniker.com' },
  { label: 'B站', url: 'bilibili.com' },
  { label: '知乎', url: 'zhihu.com' },
  { label: '掘金', url: 'juejin.cn' },
  { label: '36氪', url: '36kr.com' },
];

// ============ Helpers ============

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-green-600 bg-green-50 border-green-300';
    case 'B': return 'text-blue-600 bg-blue-50 border-blue-300';
    case 'C': return 'text-amber-600 bg-amber-50 border-amber-300';
    case 'D': return 'text-red-600 bg-red-50 border-red-300';
    default: return 'text-gray-600 bg-gray-50 border-gray-300';
  }
}

function getGradeEmoji(grade: string): string {
  switch (grade) {
    case 'A': return '🏆'; case 'B': return '👍';
    case 'C': return '👌'; case 'D': return '⚠️';
    default: return '❓';
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴'; case 'warning': return '🟡';
    case 'suggestion': return '🔵'; case 'pass': return '✅';
    default: return '⚪';
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-700 bg-red-50 border-red-200';
    case 'warning': return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'suggestion': return 'text-blue-700 bg-blue-50 border-blue-200';
    case 'pass': return 'text-green-700 bg-green-50 border-green-200';
    default: return 'text-gray-500 bg-gray-50 border-gray-200';
  }
}

function formatTime(ms: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getDomain(url: string): string {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname; }
  catch { return url; }
}

// ============ Components ============

function ScoreRing({ percentage, grade, size = 'lg' }: { percentage: number; grade: string; size?: 'sm' | 'lg' }) {
  const r = size === 'lg' ? 60 : 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percentage / 100) * circ;
  const color = percentage >= 90 ? '#16a34a' : percentage >= 75 ? '#2563eb' : percentage >= 60 ? '#d97706' : '#dc2626';
  const sz = size === 'lg' ? 'w-40 h-40' : 'w-24 h-24';
  const textSz = size === 'lg' ? 'text-3xl' : 'text-xl';

  return (
    <div className={`relative ${sz} flex items-center justify-center`}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${2*(r+8)} ${2*(r+8)}`}>
        <circle cx={r+8} cy={r+8} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size === 'lg' ? '8' : '6'} />
        <circle cx={r+8} cy={r+8} r={r} fill="none" stroke={color} strokeWidth={size === 'lg' ? '8' : '6'}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textSz} font-black`} style={{ color }}>{percentage}</span>
        <span className="text-xs font-bold" style={{ color }}>{grade}级</span>
      </div>
    </div>
  );
}

// ============ Main Page ============

type Mode = 'single' | 'compare';

export default function CompetitorAnalyzerPage() {
  const [mode, setMode] = useState<Mode>('single');
  const [url, setUrl] = useState('');
  const [compareUrls, setCompareUrls] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SiteAnalysis | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState('');

  const analyze = useCallback(async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setCompareResult(null);

    try {
      const res = await fetch(`/api/competitor-analyzer/analyze?url=${encodeURIComponent(targetUrl)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const data: SiteAnalysis = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || '分析失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeCompare = useCallback(async () => {
    const valid = compareUrls.filter(u => u.trim());
    if (valid.length < 2) {
      setError('请至少输入2个网站进行对比');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setCompareResult(null);

    try {
      const res = await fetch('/api/competitor-analyzer/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: valid }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const data: CompareResult = await res.json();
      setCompareResult(data);
    } catch (err: any) {
      setError(err.message || '分析失败');
    } finally {
      setLoading(false);
    }
  }, [compareUrls]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'single') analyze(url);
    else analyzeCompare();
  };

  const addCompareUrl = () => {
    if (compareUrls.length < 6) setCompareUrls([...compareUrls, '']);
  };

  const updateCompareUrl = (i: number, val: string) => {
    const newUrls = [...compareUrls];
    newUrls[i] = val;
    setCompareUrls(newUrls);
  };

  const removeCompareUrl = (i: number) => {
    if (compareUrls.length > 2) setCompareUrls(compareUrls.filter((_, idx) => idx !== i));
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🕵️</span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Competitor Analyzer</h1>
              <p className="text-xs text-slate-500 hidden sm:block">竞争对手分析工具</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <a href="/" className="text-slate-500 hover:text-amber-600 transition-colors">← 返回首页</a>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-6 animate-fade-in">
          <div className="text-5xl mb-3">🕵️🔍📊</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            知己知彼，百战不殆
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto text-sm">
            输入竞争对手的网站 URL，自动分析其 SEO 表现、技术栈、内容策略和关键词分布
            <span className="block text-xs text-slate-400 mt-1">支持多站对比 · 可视化报告 · 一键导出</span>
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => { setMode('single'); setResult(null); setCompareResult(null); setError(''); }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'single' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🔍 单站分析
            </button>
            <button
              onClick={() => { setMode('compare'); setResult(null); setCompareResult(null); setError(''); }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'compare' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ⚔️ 多站对比
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-8">
          {mode === 'single' ? (
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="输入网址，如 example.com"
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white
                    text-slate-900 placeholder:text-slate-400 text-sm
                    focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
                    transition-all shadow-sm"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="px-6 py-3.5 bg-gradient-to-r from-slate-700 to-slate-600 
                  text-white font-medium rounded-xl text-sm
                  hover:from-slate-800 hover:to-slate-700 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all shadow-sm whitespace-nowrap flex items-center gap-2"
              >
                {loading ? (
                  <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />分析中...</>
                ) : (<>🕵️ 分析</>)}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {compareUrls.map((u, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs font-medium text-slate-400 w-6 text-right shrink-0">#{i + 1}</span>
                  <input
                    type="text"
                    value={u}
                    onChange={e => updateCompareUrl(i, e.target.value)}
                    placeholder={`竞争对手网站 ${i + 1} 的 URL`}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white
                      text-slate-900 placeholder:text-slate-400 text-sm
                      focus:outline-none focus:ring-2 focus:ring-amber-400
                      transition-all shadow-sm"
                    disabled={loading}
                  />
                  {compareUrls.length > 2 && (
                    <button type="button" onClick={() => removeCompareUrl(i)}
                      className="text-red-400 hover:text-red-500 text-lg px-1">×</button>
                  )}
                </div>
              ))}
              {compareUrls.length < 6 && (
                <button type="button" onClick={addCompareUrl}
                  className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg border border-dashed border-slate-200 w-full">
                  + 添加更多网站
                </button>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-slate-700 to-slate-600 
                  text-white font-medium rounded-xl text-sm
                  hover:from-slate-800 hover:to-slate-700 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2 mt-3">
                {loading ? (
                  <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />分析中...</>
                ) : (<>⚔️ 开始对比</>)}
              </button>
            </div>
          )}

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            <span className="text-xs text-slate-400 self-center">快速分析：</span>
            {SUGGESTED_SITES.map((s) => (
              <button key={s.url} type="button"
                onClick={() => {
                  if (mode === 'single') { setUrl(s.url); analyze(s.url); }
                }}
                disabled={loading || mode === 'compare'}
                className="text-xs px-3 py-1 rounded-full bg-white border border-slate-100
                  text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50">
                {s.label}
              </button>
            ))}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
            <div className="h-8 bg-slate-100 rounded-lg w-1/3" />
            <div className="h-32 bg-slate-50 rounded-xl" />
            <div className="h-64 bg-slate-50 rounded-xl" />
          </div>
        )}

        {/* ================ Single Analysis Results ================ */}
        {result && !loading && mode === 'single' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Overview */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex flex-col lg:flex-row items-center gap-6">
                <ScoreRing percentage={result.seo?.percentage || 0} grade={result.seo?.grade || 'F'} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-900 truncate max-w-md">
                      {result.title || getDomain(result.url)}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getGradeColor(result.seo?.grade || 'F')}`}>
                      {getGradeEmoji(result.seo?.grade || 'F')} SEO {result.seo?.grade || 'F'}级
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1 font-mono break-all">{result.url}</p>
                  {result.description && (
                    <p className="text-sm text-slate-600 mt-2 italic line-clamp-2">&ldquo;{result.description}&rdquo;</p>
                  )}
                  
                  {/* Quick stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <div className="text-lg font-bold text-slate-900">{result.seo?.checks?.length || 0}</div>
                      <div className="text-[10px] text-slate-400">检查项</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-center">
                      <div className="text-lg font-bold text-green-700">{result.seo?.passed || 0}</div>
                      <div className="text-[10px] text-green-500">通过</div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                      <div className="text-lg font-bold text-amber-700">{result.seo?.warnings || 0}</div>
                      <div className="text-[10px] text-amber-500">警告</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-center">
                      <div className="text-lg font-bold text-red-700">{result.seo?.criticals || 0}</div>
                      <div className="text-[10px] text-red-500">严重</div>
                    </div>
                  </div>

                  {/* Response time & status */}
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400">
                    <span>⏱️ 响应: {formatTime(result.fetchTime)}</span>
                    <span>📡 HTTP {result.statusCode}</span>
                    <span>🕐 分析耗时: {formatTime(result.analysisDuration)}</span>
                    <span>📅 {new Date(result.analyzedAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SEO Check Details */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">📋 SEO 详细检查</h3>
                <span className="text-xs text-slate-400">{result.seo?.score}/{result.seo?.maxScore} 分</span>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  {result.seo?.checks?.map((check) => (
                    <div key={check.id} className={`flex items-start gap-3 p-3 rounded-xl border ${getSeverityColor(check.severity)}`}>
                      <span className="text-base mt-0.5">{getSeverityIcon(check.severity)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-800">{check.label}</span>
                          <span className={`text-xs font-bold ${check.score >= check.weight / 2 ? 'text-green-600' : 'text-red-500'}`}>
                            {check.score}/{check.weight}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{check.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tech Stack */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">🧰 技术栈</h3>
              </div>
              <div className="p-4">
                {result.technologies?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {result.technologies.map((tech, i) => {
                      const colors = CATEGORY_COLORS[tech.category] || CATEGORY_COLORS.other;
                      return (
                        <div key={i} className={`flex items-center gap-2 p-3 rounded-xl ${colors.bg} border ${colors.border}`}>
                          <span className="text-lg">{tech.icon}</span>
                          <div>
                            <div className="text-sm font-medium text-slate-800">{tech.name}</div>
                            <div className={`text-[10px] ${colors.text}`}>{tech.category}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">未能识别到技术栈信息</p>
                )}
              </div>
            </div>

            {/* Content Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Content Stats */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">📝 内容分析</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: '总字数', value: result.content?.wordCount?.toLocaleString() || 0, icon: '📄' },
                      { label: '中文数', value: result.content?.chineseChars?.toLocaleString() || 0, icon: '🀄' },
                      { label: '英文数', value: result.content?.englishWords?.toLocaleString() || 0, icon: '🔤' },
                      { label: '阅读时间', value: `${result.content?.readingTimeMinutes || 0} 分钟`, icon: '⏱️' },
                      { label: 'H1标签', value: result.content?.h1Count || 0, icon: '📑' },
                      { label: 'H2标签', value: result.content?.h2Count || 0, icon: '📋' },
                      { label: '图片', value: result.content?.imageCount || 0, icon: '🖼️' },
                      { label: '内部链接', value: result.content?.internalLinkCount || 0, icon: '🔗' },
                    ].map((item, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                        <div className="text-lg font-bold text-slate-900">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Keywords */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">🔑 高频关键词</h3>
                  <p className="text-xs text-slate-400 mt-0.5">从页面内容中提取的前30个高频词</p>
                </div>
                <div className="p-4">
                  {result.keywords?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((kw, i) => {
                        const maxCount = result.keywords[0]?.count || 1;
                        const scale = kw.count / maxCount;
                        const size = scale > 0.7 ? 'text-base' : scale > 0.4 ? 'text-sm' : 'text-xs';
                        const weight = scale > 0.7 ? 'font-bold' : scale > 0.4 ? 'font-semibold' : 'font-normal';
                        const color = scale > 0.7 ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                          : scale > 0.4 ? 'text-indigo-600 bg-indigo-50/50 border-indigo-100'
                          : 'text-slate-500 bg-slate-50 border-slate-100';
                        return (
                          <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${color} ${size} ${weight}`}>
                            {kw.word}
                            <span className="text-[10px] opacity-60">×{kw.count}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4">未能提取关键词</p>
                  )}
                </div>
              </div>
            </div>

            {/* H1 & H2 Tags */}
            {((result.content?.h1Tags?.length || 0) > 0 || (result.content?.h2Tags?.length || 0) > 0) && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">🏷️ 页面标题结构</h3>
                </div>
                <div className="p-4">
                  {result.content?.h1Tags?.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase">H1</h4>
                      {result.content.h1Tags.map((h1, i) => (
                        <div key={i} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-sm font-medium text-slate-800 mb-1">
                          {h1}
                        </div>
                      ))}
                    </div>
                  )}
                  {result.content?.h2Tags?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase">H2</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {result.content.h2Tags.map((h2, i) => (
                          <div key={i} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-700">
                            {h2}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Errors */}
            {result.errors && result.errors.length > 0 && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
                <h3 className="text-sm font-bold text-amber-800 mb-2">⚠️ 部分分析异常</h3>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-amber-600">{e.phase}: {e.error}</p>
                ))}
              </div>
            )}

            {/* Share */}
            <div className="text-center">
              <button
                onClick={() => {
                  const lines = [
                    `🕵️ Competitor Analyzer 分析报告`,
                    `━━━━━━━━━━━━━━━━━━`,
                    `目标: ${result.domain}`,
                    `SEO评分: ${result.seo?.percentage}分 (${result.seo?.grade}级)`,
                    `HTTP ${result.statusCode} | 响应 ${formatTime(result.fetchTime)}`,
                    `━━━━━━━━━━━━━━━━━━`,
                    `📋 检查项: ${result.seo?.passed}✅ ${result.seo?.warnings}🟡 ${result.seo?.criticals}🔴 ${result.seo?.suggestions}🔵`,
                    `🧰 技术: ${result.technologies?.map(t => t.name).join(', ') || '未知'}`,
                    `📝 内容: ${result.content?.wordCount?.toLocaleString()}字 | ${result.content?.readingTimeMinutes}分钟阅读`,
                    `━━━━━━━━━━━━━━━━━━`,
                    `立即分析: ${window.location.origin}/competitor-analyzer`,
                  ];
                  navigator.clipboard.writeText(lines.join('\n'))
                    .then(() => alert('✅ 报告已复制到剪贴板'))
                    .catch(() => {});
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 
                  text-slate-600 text-sm hover:bg-slate-50 transition-all"
              >
                📋 复制报告
              </button>
            </div>

            <AdBanner position="bottom" source="default" />
          </div>
        )}

        {/* ================ Comparison Results ================ */}
        {compareResult && !loading && mode === 'compare' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Comparison Overview */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">⚔️ 对比结果</h3>
              
              {/* SEO Score Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {compareResult.comparison?.seoScores?.map((s, i) => (
                  <div key={i} className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-sm font-medium text-slate-700 mb-2 truncate max-w-full">{s.domain}</div>
                    <ScoreRing percentage={s.score} grade={s.grade} size="sm" />
                  </div>
                ))}
              </div>

              {/* Quick compare table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">指标</th>
                      {compareResult.sites.map((s, i) => (
                        <th key={i} className="text-center py-2 px-3 text-xs text-slate-400 font-medium">{s.domain}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'SEO评分', get: (s: SiteAnalysis) => `${s.seo?.percentage || 0}分 (${s.seo?.grade || 'F'}级)` },
                      { label: '响应时间', get: (s: SiteAnalysis) => formatTime(s.fetchTime) },
                      { label: 'HTTP状态', get: (s: SiteAnalysis) => `${s.statusCode}` },
                      { label: '内容字数', get: (s: SiteAnalysis) => `${(s.content?.wordCount || 0).toLocaleString()}字` },
                      { label: '阅读时间', get: (s: SiteAnalysis) => `${s.content?.readingTimeMinutes || 0}分钟` },
                      { label: 'H1数量', get: (s: SiteAnalysis) => `${s.content?.h1Count || 0}` },
                      { label: 'H2数量', get: (s: SiteAnalysis) => `${s.content?.h2Count || 0}` },
                      { label: '图片数量', get: (s: SiteAnalysis) => `${s.content?.imageCount || 0}` },
                      { label: '内部链接', get: (s: SiteAnalysis) => `${s.content?.internalLinkCount || 0}` },
                      { label: '技术栈', get: (s: SiteAnalysis) => `${s.technologies?.length || 0}项` },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{row.label}</td>
                        {compareResult.sites.map((s, j) => {
                          const val = row.get(s);
                          // Highlight winner
                          const isBest = i === 0 && compareResult.comparison?.seoScores 
                            ? s.seo?.percentage === Math.max(...compareResult.comparison.seoScores.map(x => x.score))
                            : false;
                          return (
                            <td key={j} className={`text-center py-2.5 px-3 ${isBest ? 'text-green-700 font-bold' : 'text-slate-600'}`}>
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tech Stack Comparison */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">🧰 技术栈对比</h3>
                <p className="text-xs text-slate-400 mt-0.5">各站使用的技术对比，快速识别差异</p>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">技术</th>
                        {compareResult.sites.map((s, i) => (
                          <th key={i} className="text-center py-2 px-3 text-xs text-slate-400 font-medium">{s.domain}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(compareResult.comparison?.techComparison || []).map((tech, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-700">
                            <span className="mr-1">{tech.icon}</span>
                            {tech.name}
                            <span className="text-[10px] text-slate-400 ml-1">({tech.category})</span>
                          </td>
                          {compareResult.sites.map((s, j) => (
                            <td key={j} className="text-center py-2 px-3">
                              {tech.sites.includes(s.domain) ? '✅' : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Detailed breakdown by site */}
            {compareResult.sites.map((site, idx) => (
              <details key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <summary className="px-6 py-4 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      {getGradeEmoji(site.seo?.grade || 'F')} {site.domain}
                    </h3>
                    <span className="text-xs text-slate-400">
                      SEO {site.seo?.percentage || 0}分 ({site.seo?.grade || 'F'}级) 
                    </span>
                  </div>
                </summary>
                <div className="p-4 space-y-4">
                  {site.title && <p className="text-sm text-slate-700 font-mono">{site.title}</p>}
                  
                  {/* Key metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2 bg-slate-50 rounded-lg text-center">
                      <div className="text-sm font-bold">{site.seo?.percentage || 0}</div>
                      <div className="text-[10px] text-slate-400">SEO分</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg text-center">
                      <div className="text-sm font-bold">{site.technologies?.length || 0}</div>
                      <div className="text-[10px] text-slate-400">技术项</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg text-center">
                      <div className="text-sm font-bold">{site.content?.wordCount?.toLocaleString() || 0}</div>
                      <div className="text-[10px] text-slate-400">字数</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg text-center">
                      <div className="text-sm font-bold">{formatTime(site.fetchTime)}</div>
                      <div className="text-[10px] text-slate-400">响应</div>
                    </div>
                  </div>

                  {/* Top keywords */}
                  {site.keywords?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 mb-2">🔑 高频关键词</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {site.keywords.slice(0, 15).map((kw, ki) => (
                          <span key={ki} className="text-xs px-2 py-0.5 bg-slate-50 rounded-full border border-slate-100 text-slate-600">
                            {kw.word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {site.errors && site.errors.length > 0 && (
                    <div className="text-xs text-amber-600 p-2 bg-amber-50 rounded-lg">
                      ⚠️ {site.errors.map(e => e.error).join('; ')}
                    </div>
                  )}
                </div>
              </details>
            ))}

            <AdBanner position="bottom" source="default" />
          </div>
        )}

        {/* Empty State / How it works */}
        {!result && !compareResult && !loading && !error && (
          <div className="max-w-3xl mx-auto mt-8">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-8">
              {[
                { step: '1', title: '输入网址', desc: '输入竞争对手的网站URL', icon: '🔗' },
                { step: '2', title: '自动爬取', desc: '爬取页面、分析SEO和技术栈', icon: '🕷️' },
                { step: '3', title: '智能分析', desc: '30+检查项，打分+建议', icon: '🧠' },
                { step: '4', title: '对比报告', desc: '多站对比，可视化展示', icon: '📊' },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 bg-white/50 rounded-xl border border-slate-100">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="text-sm font-medium text-slate-900">第{item.step}步</div>
                  <div className="text-xs text-slate-500 mt-1">{item.desc}</div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <h4 className="text-xs font-medium text-slate-400 mb-3">可分析的内容维度：</h4>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'SEO评分', '技术栈', '页面标题', 'Meta描述', 'OG标签',
                  'H1/H2结构', '关键词', '内容长度', '图片Alt', '内部链接',
                  '响应速度', 'Sitemap', 'Favicon', '多站对比',
                ].map((tag, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 bg-white rounded-full border border-slate-100 text-slate-500">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
