/**
 * /seo-diagnosis — SEO页面诊断工具
 * 🏗 壁垒产品：爬取+分析+评分，不是AI能替代的
 * 
 * 验证：Module 9 (爬虫) + Module 10 (缓存/分页/搜索)
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import UsageTracker, { canUse, useOne } from '@/components/UsageTracker';
import ShareButton from '@/components/ShareButton';
import AdBanner from '@/components/AdBanner';

// ============ Types ============

interface SEOCheck {
  label: string;
  score: number;
  detail: string;
  severity: 'pass' | 'warning' | 'critical' | 'suggestion';
}

interface SEOSummary {
  total: number;
  critical: number;
  warnings: number;
  suggestions: number;
  passed: number;
}

interface DomainInfo {
  domain: string;
  title: string;
  description: string;
  hasOGTags: boolean;
  hasTwitterCard: boolean;
  h1Count: number;
  h2Count: number;
  imgCount: number;
  imgWithAlt: number;
  internalLinks: number;
  externalLinks: number;
  wordCount: number;
  hasFavicon: boolean;
  hasSitemap: boolean;
  fetchTime: number;
  statusCode: number;
}

interface AuditResult {
  url: string;
  domainInfo: DomainInfo;
  score: number;
  grade: string;
  gradeLabel: string;
  checks: Record<string, SEOCheck>;
  summary: SEOSummary;
  auditTime: number;
  analyzedAt: string;
  cached?: boolean;
  saved?: { id: number; created_at: string } | null;
}

// ============ Grade Badge ============

function GradeBadge({ grade, score }: { grade: string; score: number }) {
  const colors: Record<string, string> = {
    A: 'from-emerald-400 to-green-500',
    B: 'from-blue-400 to-blue-500',
    C: 'from-yellow-400 to-amber-500',
    D: 'from-orange-400 to-red-500',
    F: 'from-red-400 to-rose-600',
  };

  return (
    <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${colors[grade] || colors.F} 
                    flex items-center justify-center shadow-xl`}>
      <div className="text-center">
        <div className="text-5xl font-black text-white drop-shadow">{grade}</div>
        <div className="text-xs text-white/80 mt-0.5">{score}分</div>
      </div>
    </div>
  );
}

// ============ Severity Icon ============

function SeverityIcon({ severity }: { severity: string }) {
  const icons: Record<string, string> = {
    pass: '✅',
    suggestion: '💡',
    warning: '⚠️',
    critical: '🚫',
  };
  return <span>{icons[severity] || '❓'}</span>;
}

// ============ Stats Bar ============

function StatsBar({ summary }: { summary: SEOSummary }) {
  return (
    <div className="flex flex-wrap gap-3 justify-center my-4">
      <div className="px-5 py-2 bg-green-50 rounded-xl border border-green-200 text-center">
        <div className="text-lg font-bold text-green-600">{summary.passed}</div>
        <div className="text-xs text-green-500">通过</div>
      </div>
      <div className="px-5 py-2 bg-yellow-50 rounded-xl border border-yellow-200 text-center">
        <div className="text-lg font-bold text-yellow-600">{summary.suggestions}</div>
        <div className="text-xs text-yellow-500">建议优化</div>
      </div>
      <div className="px-5 py-2 bg-orange-50 rounded-xl border border-orange-200 text-center">
        <div className="text-lg font-bold text-orange-600">{summary.warnings}</div>
        <div className="text-xs text-orange-500">警告</div>
      </div>
      <div className="px-5 py-2 bg-red-50 rounded-xl border border-red-200 text-center">
        <div className="text-lg font-bold text-red-600">{summary.critical}</div>
        <div className="text-xs text-red-500">严重问题</div>
      </div>
    </div>
  );
}

// ============ Check Item ============

function CheckItem({ check }: { check: SEOCheck }) {
  const severityColors: Record<string, string> = {
    pass: 'border-green-200 bg-green-50',
    suggestion: 'border-yellow-200 bg-yellow-50',
    warning: 'border-orange-200 bg-orange-50',
    critical: 'border-red-200 bg-red-50',
  };

  const barColors: Record<string, string> = {
    pass: 'bg-green-500',
    suggestion: 'bg-yellow-500',
    warning: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  const weights: Record<string, number> = {
    title: 15,
    metaDescription: 12,
    ogTags: 10,
    h1Tag: 8,
    headings: 5,
    images: 8,
    performance: 10,
    links: 5,
    favicon: 3,
    sitemap: 4,
  };

  // Calculate percentage score for this item
  const maxWeight = weights.title; // Default max
  const percentage = Math.min(100, Math.round((check.score / 15) * 100));

  return (
    <div className={`rounded-xl border p-4 ${severityColors[check.severity] || 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <SeverityIcon severity={check.severity} />
          <span className="font-semibold text-gray-800 text-sm">{check.label}</span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/60">
          {check.score}/{Math.ceil(check.score / (check.severity === 'pass' ? 1 : 1))}分
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-2">{check.detail}</p>
      {/* Mini progress bar */}
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColors[check.severity]}`}
          style={{ width: `${Math.max(5, percentage)}%` }}
        />
      </div>
    </div>
  );
}

// ============ Score Gauge ============

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 90 ? '#059669' : score >= 75 ? '#2563eb' : score >= 60 ? '#d97706' : '#dc2626';

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="3"
              strokeDasharray="100, 100"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeDasharray={`${score}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold" style={{ color }}>{score}</span>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800">SEO评分</div>
          <div className="text-xs text-gray-500">
            满分100 · {score >= 90 ? '非常优秀' : score >= 75 ? '表现良好' : score >= 60 ? '有待改进' : '需要大修'}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function SEODiagnosisPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState('');
  const [usageBlocked, setUsageBlocked] = useState(false);
  const [usageKey, setUsageKey] = useState(0);

  // Analyze URL
  const handleAnalyze = useCallback(async () => {
    if (!url.trim()) return;

    // Check usage limit
    if (!canUse('seo_analysis')) {
      setUsageBlocked(true);
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setUsageBlocked(false);

    try {
      const res = await fetch('/api/seo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), userId: null }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `分析失败 (${res.status})`);
      }

      // Record usage on success
      useOne('seo_analysis');
      setUsageKey(k => k + 1);

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  // Keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  // Show checks
  const checks = result?.checks || {};
  const checkKeys = Object.keys(checks);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              🔍 SEO 页面诊断
            </h1>
            <a
              href="/seo-diagnosis/batch"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700
                       rounded-lg text-xs font-medium hover:bg-indigo-200 transition-all"
            >
              📦 批量版
            </a>
          </div>
          <p className="text-gray-500 mt-2 text-sm">
            输入网址，AI引擎自动爬取并分析页面SEO健康状况
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              🕷️ 实际爬取
            </span>
            <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full">
              📊 结构化分析
            </span>
            <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
              📋 可执行建议
            </span>
          </div>
        </header>

        {/* Usage limit banner */}
        <div className="mb-4" key={usageKey}>
          <UsageTracker action="seo_analysis" showBanner={usageBlocked || true} />
        </div>

        {/* Input */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔗</span>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入网址，如 example.com 或 https://example.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         text-sm transition-all"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !url.trim()}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white 
                       rounded-xl font-medium text-sm shadow-md hover:shadow-lg
                       hover:from-blue-700 hover:to-indigo-700 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  分析中...
                </>
              ) : (
                <>
                  🚀 开始诊断
                </>
              )}
            </button>
          </div>
          {loading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
              正在爬取页面数据...
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2">
              <span className="text-lg">❌</span>
              <div>
                <p className="font-medium text-red-800 text-sm">分析失败</p>
                <p className="text-red-600 text-xs mt-1">{error}</p>
                <p className="text-gray-400 text-xs mt-2">请检查网址是否正确，或者稍后重试</p>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <>
            {/* Score Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex flex-col lg:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <GradeBadge grade={result.grade} score={result.score} />
                </div>
                <div className="flex-1 text-center lg:text-left">
                  <div className="flex items-start justify-between w-full">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {result.url}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {result.domainInfo.domain} · 分析耗时 {result.auditTime}ms
                      {result.cached && <span className="ml-2 text-purple-500">⚡ 缓存数据</span>}
                    </p>
                  </div>
                  <ShareButton
                    title={`SEO诊断: ${result.url} 评分${result.score}/100`}
                    text={`我用SEO诊断工具分析了 ${result.url}，得分 ${result.score}/100 (${result.grade}级)`}
                    size="sm"
                  />
                </div>
                  <p className="text-2xl font-bold mt-2" style={{
                    color: result.score >= 90 ? '#059669' : result.score >= 75 ? '#2563eb' : result.score >= 60 ? '#d97706' : '#dc2626'
                  }}>
                    {result.gradeLabel} ({result.grade}级)
                  </p>
                  <StatsBar summary={result.summary} />
                </div>
              </div>
            </div>

            {/* Detailed Checks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {checkKeys.map(key => (
                <CheckItem key={key} check={checks[key]} />
              ))}
            </div>

            {/* Domain Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">📋 页面详情</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <DetailItem label="页面标题" value={result.domainInfo.title || '-'} />
                <DetailItem label="响应状态" value={`${result.domainInfo.statusCode}`} />
                <DetailItem label="加载速度" value={`${result.domainInfo.fetchTime}ms`} />
                <DetailItem label="字数" value={`${result.domainInfo.wordCount}`} />
                <DetailItem label="H1标题" value={`${result.domainInfo.h1Count} 个`} />
                <DetailItem label="H2标题" value={`${result.domainInfo.h2Count} 个`} />
                <DetailItem label="图片" value={`${result.domainInfo.imgWithAlt}/${result.domainInfo.imgCount} 有Alt`} />
                <DetailItem label="内部链接" value={`${result.domainInfo.internalLinks} 个`} />
                <DetailItem label="外部链接" value={`${result.domainInfo.externalLinks} 个`} />
                <DetailItem label="OG标签" value={result.domainInfo.hasOGTags ? '✅ 有' : '❌ 无'} />
                <DetailItem label="网站图标" value={result.domainInfo.hasFavicon ? '✅ 有' : '❌ 无'} />
                <DetailItem label="站点地图" value={result.domainInfo.hasSitemap ? '✅ 有' : '❌ 无'} />
              </div>
            </div>
          </>
        )}

        {/* Ad Banner - only show after diagnosis */}
        <div className="mt-6">
          <AdBanner position="bottom" source="seo" />
        </div>

        {/* SEO Tips */}
        <div className="mt-6 p-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100">
          <h3 className="text-sm font-semibold text-indigo-800 mb-3">💡 为什么这个工具有壁垒？</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-indigo-700">
            <div className="bg-white/60 rounded-xl p-3">
              <strong>🕷️ 不是问AI就行</strong>
              <p className="mt-1 text-indigo-500">AI不知道你的页面长了什么。需要实际爬取、分析每个元素。</p>
            </div>
            <div className="bg-white/60 rounded-xl p-3">
              <strong>📊 结构化评分</strong>
              <p className="mt-1 text-indigo-500">10项检查 + 权重评分 = 可行动的报告。不是一堆文字。</p>
            </div>
            <div className="bg-white/60 rounded-xl p-3">
              <strong>⏱️ 持续监控</strong>
              <p className="mt-1 text-indigo-500">可以对比历史数据，追踪SEO改善效果。AI问一次是一次。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ DetailItem Component ============

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm font-medium text-gray-800 truncate" title={value}>{value}</div>
    </div>
  );
}
