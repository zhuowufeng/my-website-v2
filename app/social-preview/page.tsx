/**
 * Social Preview Inspector v2 — 社交分享预览检查器
 * 
 * v2 增强：
 * - LinkedIn / WhatsApp / Telegram / Slack 可视化预览
 * - JSON-LD / Schema.org 结构化数据检测
 * - 结构化数据完整性评分
 *
 * 壁垒：
 * - 服务端抓取，不受浏览器跨域限制
 * - 15+ 项标签完整性检查 + 结构化数据分析
 * - 6 平台可视化分享预览（Facebook/Twitter/LinkedIn/WhatsApp/Telegram/Slack）
 * - JSON-LD 解析与评分
 */

'use client';

import { useState, useCallback } from 'react';
import AdBanner from '@/components/AdBanner';

// ============ Types ============

interface MetaTag {
  name: string;
  content: string;
  type: 'og' | 'twitter' | 'standard' | 'other';
}

interface MissingTag {
  tag: string;
  severity: 'error' | 'warning' | 'info';
  reason: string;
}

interface JsonLdSchema {
  type: string;
  valid: boolean;
  content: string;
  fields: string[];
  issues: string[];
}

interface SocialPreviewResult {
  url: string;
  finalUrl: string;
  title: string;
  status: number;
  responseTime: number;
  description: string;
  favicon: string;
  tags: MetaTag[];
  summary: {
    og: { count: number; complete: boolean };
    twitter: { count: number; complete: boolean };
    standard: { count: number };
    hasFavicon: boolean;
  };
  missing: MissingTag[];
  preview: {
    facebook: { title: string; description: string; image: string; url: string; };
    twitter: { title: string; description: string; image: string; url: string; };
  };
  structuredData: {
    schemas: JsonLdSchema[];
    count: number;
    types: string[];
    score: 'good' | 'fair' | 'poor';
  };
  errors: string[];
}

type PlatformPreview = {
  title: string;
  description: string;
  image: string;
  url: string;
};

// ============ Suggested URLs ============

const SUGGESTED_URLS = [
  { label: '我的网站', example: 'sinmoniker.com' },
  { label: '百度', example: 'baidu.com/s' },
  { label: '谷歌', example: 'google.com' },
  { label: 'B站', example: 'bilibili.com' },
];

// ============ Helpers ============

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600 bg-green-50 border-green-200';
  if (status >= 300 && status < 400) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (status >= 400 && status < 500) return 'text-amber-600 bg-amber-50 border-amber-200';
  if (status >= 500) return 'text-red-600 bg-red-50 border-red-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

function getStatusEmoji(status: number): string {
  if (status >= 200 && status < 300) return '✅';
  if (status >= 300 && status < 400) return '🔀';
  if (status >= 400 && status < 500) return '⚠️';
  if (status >= 500) return '❌';
  return '❓';
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

function getSeverityBadge(severity: 'error' | 'warning' | 'info'): { text: string; color: string } {
  switch (severity) {
    case 'error': return { text: '❌ 错误', color: 'text-red-600 bg-red-50 border-red-200' };
    case 'warning': return { text: '⚠️ 警告', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    case 'info': return { text: '💡 建议', color: 'text-blue-600 bg-blue-50 border-blue-200' };
  }
}

function getTagTypeBadge(type: MetaTag['type']): { text: string; color: string; bg: string; border: string } {
  switch (type) {
    case 'og': return { text: 'Open Graph', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' };
    case 'twitter': return { text: 'Twitter Card', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' };
    case 'standard': return { text: '标准', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' };
    case 'other': return { text: '其他', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' };
  }
}

function truncateUrl(url: string, max = 42): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 3) + '...';
}

function cleanUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// ============ Image Fallback Component ============

function CardImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-4xl ${className || ''}`}>
        <span className="opacity-40">🖼️</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className || ''}
      onError={() => setFailed(true)}
    />
  );
}

// ============ Platform Preview Components ============

function LinkedInPreview({ preview, url }: { preview: PlatformPreview; url: string }) {
  return (
    <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-300 overflow-hidden">
      {/* Card image */}
      <CardImage
        src={preview.image}
        alt="LinkedIn Image"
        className="w-full aspect-[1.91/1] object-cover"
      />
      {/* Card content */}
      <div className="p-3">
        <div className="text-xs text-gray-500 font-medium truncate">
          {cleanUrl(url)}
        </div>
        <div className="text-sm font-semibold text-gray-900 mt-0.5 line-clamp-2">
          {preview.title || '(无标题)'}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
          {preview.description || '(无描述)'}
        </div>
      </div>
    </div>
  );
}

function WhatsAppPreview({ preview, url }: { preview: PlatformPreview; url: string }) {
  return (
    <div className="max-w-md mx-auto bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      {/* Card image */}
      <CardImage
        src={preview.image}
        alt="WhatsApp Image"
        className="w-full aspect-[1.91/1] object-cover"
      />
      {/* Card content */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider truncate">
          {cleanUrl(url)}
        </div>
        <div className="text-sm font-medium text-gray-900 mt-0.5 line-clamp-2">
          {preview.title || '(无标题)'}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
          {preview.description || '(无描述)'}
        </div>
      </div>
    </div>
  );
}

function TelegramPreview({ preview, url }: { preview: PlatformPreview; url: string }) {
  return (
    <div className="max-w-md mx-auto bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      {/* Card image */}
      <CardImage
        src={preview.image}
        alt="Telegram Image"
        className="w-full aspect-[2/1] object-cover"
      />
      {/* Card content */}
      <div className="p-3">
        <div className="text-sm font-semibold text-gray-900 line-clamp-2">
          {preview.title || '(无标题)'}
        </div>
        <div className="text-xs text-gray-500 mt-1 line-clamp-3">
          {preview.description || '(无描述)'}
        </div>
        <div className="text-[10px] text-gray-400 mt-2 truncate">
          {cleanUrl(url)}
        </div>
      </div>
    </div>
  );
}

function SlackPreview({ preview, url }: { preview: PlatformPreview; url: string }) {
  const domain = cleanUrl(url);
  return (
    <div className="max-w-md mx-auto">
      <div className="flex border-l-4 border-green-500 bg-white rounded shadow-sm overflow-hidden">
        {/* Left color bar */}
        <div className="w-1 bg-green-500 shrink-0" />
        <div className="flex-1 min-w-0">
          {/* Card image */}
          {preview.image && (
            <CardImage
              src={preview.image}
              alt="Slack Image"
              className="w-full aspect-[2/1] object-cover"
            />
          )}
          <div className="p-3">
            <div className="text-sm font-semibold text-gray-900 line-clamp-2">
              {preview.title || '(无标题)'}
            </div>
            <div className="text-xs text-gray-500 mt-1 line-clamp-2">
              {preview.description || '(无描述)'}
            </div>
            <div className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
              <span>🔗</span>
              <span className="truncate">{domain}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Structured Data Score Badge ============

function ScoreBadge({ score }: { score: 'good' | 'fair' | 'poor' }) {
  const config = {
    good: { label: '✅ 良好', color: 'text-green-700 bg-green-50 border-green-200' },
    fair: { label: '⚠️ 一般', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    poor: { label: '❌ 缺失', color: 'text-red-700 bg-red-50 border-red-200' },
  }[score];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

// ============ Main Component ============

export default function SocialPreviewPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SocialPreviewResult | null>(null);
  const [error, setError] = useState('');
  const [showAllTags, setShowAllTags] = useState(false);
  const [showJsonLd, setShowJsonLd] = useState(false);
  const [copied, setCopied] = useState(false);

  const inspect = useCallback(async (targetUrl: string) => {
    const u = targetUrl.trim();
    if (!u) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/social-preview/inspect?url=${encodeURIComponent(u)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const data: SocialPreviewResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || '分析失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inspect(url);
  };

  const handleCopyReport = () => {
    if (!result) return;
    const sdScore = result.structuredData.score === 'good' ? '✅ 良好' :
      result.structuredData.score === 'fair' ? '⚠️ 一般' : '❌ 缺失';
    const lines: string[] = [
      `📱 Social Preview Inspector v2 分析报告`,
      `━━━━━━━━━━━━━━━━`,
      `目标: ${result.url}`,
      `状态: HTTP ${result.status} (${formatTime(result.responseTime)})`,
      `━━━━━━━━━━━━━━━━`,
      `📋 OG 标签: ${result.summary.og.complete ? '✅ 完整' : '❌ 不完整'} (${result.summary.og.count} 个)`,
      `🐦 Twitter Cards: ${result.summary.twitter.complete ? '✅ 完整' : '❌ 不完整'} (${result.summary.twitter.count} 个)`,
      `🔗 结构化数据: ${sdScore} (${result.structuredData.count} 个, ${result.structuredData.types.join(', ')})`,
      `━━━━━━━━━━━━━━━━`,
      `❌ 问题 (${result.missing.filter(m => m.severity === 'error').length} 错误 + ${result.missing.filter(m => m.severity === 'warning').length} 警告):`,
      ...result.missing.map(m => `  ${getSeverityBadge(m.severity).text.split(' ')[0]} ${m.tag}: ${m.reason}`),
      `━━━━━━━━━━━━━━━━`,
      `Facebook: ${result.preview.facebook.title}`,
      `Twitter: ${result.preview.twitter.title}`,
      `━━━━━━━━━━━━━━━━`,
      `立即分析: ${window.location.origin}/social-preview`,
    ];
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  const ogCount = result?.summary.og.count || 0;
  const twitterCount = result?.summary.twitter.count || 0;
  const missingErrors = result?.missing.filter(m => m.severity === 'error').length || 0;
  const missingWarnings = result?.missing.filter(m => m.severity === 'warning').length || 0;
  const missingInfos = result?.missing.filter(m => m.severity === 'info').length || 0;

  // Build preview data for all platforms
  const basePreview = result ? {
    title: result.preview.facebook.title,
    description: result.preview.facebook.description,
    image: result.preview.facebook.image,
    url: result.preview.facebook.url,
  } : { title: '', description: '', image: '', url: '' };

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-cream">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📱</span>
            <div>
              <h1 className="text-lg font-bold text-purple-900">Social Preview Inspector</h1>
              <p className="text-xs text-purple-500 hidden sm:block">社交分享预览检查器 v2</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <a href="/" className="text-purple-600 hover:text-amber-600 transition-colors">← 返回首页</a>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="text-5xl mb-3">📱🔍</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-purple-900 mb-2">
            你的网站在各社交平台长什么样？
          </h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            输入网址，一键预览 Facebook / Twitter / LinkedIn / WhatsApp 等 6 个平台的分享效果
            <span className="block text-xs text-gray-400 mt-1">
              检测 OG 标签、Twitter Cards、JSON-LD 结构化数据，全方位优化社交分享体验
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
                className="w-full px-4 py-3.5 rounded-xl border border-purple-200 bg-white
                  text-purple-900 placeholder:text-gray-400 text-sm
                  focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
                  transition-all shadow-sm"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3.5 bg-gradient-to-r from-purple-600 to-purple-500 
                text-white font-medium rounded-xl text-sm
                hover:from-purple-700 hover:to-purple-600 disabled:opacity-50 
                disabled:cursor-not-allowed transition-all shadow-sm
                whitespace-nowrap flex items-center gap-2"
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
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            <span className="text-xs text-gray-400 self-center">快速检测：</span>
            {SUGGESTED_URLS.map(({ label, example }) => (
              <button
                key={example}
                type="button"
                onClick={() => { setUrl(example); inspect(example); }}
                disabled={loading}
                className="text-xs px-3 py-1 rounded-full bg-white border border-purple-100 
                  text-purple-600 hover:bg-purple-50 hover:border-purple-300 transition-all
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
            <div className="h-8 bg-purple-100 rounded-lg w-1/3" />
            <div className="h-32 bg-purple-50 rounded-xl" />
            <div className="h-48 bg-purple-50 rounded-xl" />
            <div className="h-24 bg-purple-50 rounded-xl" />
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Overview Card */}
            <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                    <span>{getStatusEmoji(result.status)}</span>
                    <span>HTTP {result.status}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(result.status)}`}>
                      {result.status >= 200 && result.status < 300 ? '正常' : '异常'}
                    </span>
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 font-mono break-all">{result.url}</p>
                  {result.finalUrl !== result.url && (
                    <p className="text-xs text-gray-400 mt-1 font-mono break-all">→ {result.finalUrl}</p>
                  )}
                  {result.title && (
                    <p className="text-sm text-gray-600 mt-2 italic">&ldquo;{result.title.slice(0, 100)}&rdquo;</p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <div>
                    <div className={`text-3xl font-black ${getTimeColor(result.responseTime)}`}>
                      {formatTime(result.responseTime)}
                    </div>
                    <div className="text-xs text-gray-400">响应时间</div>
                  </div>
                  {result.favicon && (
                    <img
                      src={result.favicon}
                      alt="favicon"
                      className="w-8 h-8 rounded"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Status Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`bg-white rounded-xl border p-4 shadow-sm ${
                result.summary.og.complete ? 'border-green-200' : 'border-red-200'
              }`}>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <span>📋</span> OG 标签
                </div>
                <div className={`text-lg font-bold mt-1 ${result.summary.og.complete ? 'text-green-600' : 'text-red-600'}`}>
                  {result.summary.og.complete ? '✅ 完整' : '❌ 不完整'}
                </div>
                <div className="text-xs text-gray-400 mt-1">{ogCount} 个标签</div>
              </div>
              <div className={`bg-white rounded-xl border p-4 shadow-sm ${
                result.summary.twitter.complete ? 'border-green-200' : 'border-amber-200'
              }`}>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <span>🐦</span> Twitter Cards
                </div>
                <div className={`text-lg font-bold mt-1 ${result.summary.twitter.complete ? 'text-green-600' : 'text-amber-600'}`}>
                  {result.summary.twitter.complete ? '✅ 完整' : '⚠️ 不完整'}
                </div>
                <div className="text-xs text-gray-400 mt-1">{twitterCount} 个标签</div>
              </div>
              <div className={`bg-white rounded-xl border p-4 shadow-sm ${
                result.structuredData.score === 'good' ? 'border-green-200' :
                result.structuredData.score === 'fair' ? 'border-amber-200' : 'border-red-200'
              }`}>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <span>🔗</span> 结构化数据
                </div>
                <div className="text-lg font-bold mt-1">
                  <ScoreBadge score={result.structuredData.score} />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {result.structuredData.count > 0
                    ? `${result.structuredData.count} 个 · ${result.structuredData.types.join(', ').slice(0, 30)}${result.structuredData.types.join(', ').length > 30 ? '…' : ''}`
                    : '未检测到 JSON-LD'}
                </div>
              </div>
              <div className={`bg-white rounded-xl border p-4 shadow-sm ${
                missingErrors > 0 ? 'border-red-200' : missingWarnings > 0 ? 'border-amber-200' : 'border-green-200'
              }`}>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <span>🔍</span> 优化建议
                </div>
                <div className="text-lg font-bold mt-1 text-gray-700">
                  {missingErrors > 0 && <span className="text-red-600">{missingErrors} 错误 </span>}
                  {missingWarnings > 0 && <span className="text-amber-600">{missingWarnings} 警告 </span>}
                  {missingErrors === 0 && missingWarnings === 0 && (
                    <span className="text-green-600">✅ 良好</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">{missingInfos} 条建议</div>
              </div>
            </div>

            {/* Missing Tags / Suggestions */}
            {result.missing.length > 0 && (
              <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
                  <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <span>🔍</span>
                    优化建议
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-auto">
                      {result.missing.length} 项
                    </span>
                  </h3>
                </div>
                <div className="p-5 max-h-[400px] overflow-y-auto space-y-3">
                  {result.missing.map((item, i) => {
                    const badge = getSeverityBadge(item.severity);
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${badge.color}`}>
                          {badge.text}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-800 font-mono">{item.tag}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{item.reason}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===== 6 Platform Previews ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Facebook Preview */}
              <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-200">
                  <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                    <span>📘</span>
                    Facebook
                  </h3>
                </div>
                <div className="p-5">
                  <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <CardImage
                      src={result.preview.facebook.image}
                      alt="FB Image"
                      className="w-full aspect-[2/1] object-cover"
                    />
                    <div className="p-4">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider truncate">
                        {truncateUrl(result.preview.facebook.url, 36)}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 mt-1 line-clamp-2">
                        {result.preview.facebook.title || '(无标题)'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {result.preview.facebook.description || '(无描述)'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Twitter Preview */}
              <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-sky-50 border-b border-sky-200">
                  <h3 className="text-sm font-bold text-sky-800 flex items-center gap-2">
                    <span>🐦</span>
                    Twitter
                  </h3>
                </div>
                <div className="p-5">
                  <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <CardImage
                      src={result.preview.twitter.image}
                      alt="Twitter Image"
                      className="w-full aspect-[2/1] object-cover"
                    />
                    <div className="p-4">
                      <div className="text-sm font-semibold text-gray-900 line-clamp-2">
                        {result.preview.twitter.title || '(无标题)'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {result.preview.twitter.description || '(无描述)'}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-2 truncate">
                        {truncateUrl(result.preview.twitter.url, 48)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LinkedIn Preview */}
              <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-blue-50 border-b border-blue-200">
                  <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                    <span>💼</span>
                    LinkedIn
                  </h3>
                </div>
                <div className="p-5">
                  <LinkedInPreview preview={basePreview} url={result.url} />
                </div>
              </div>

              {/* WhatsApp Preview */}
              <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-green-50 border-b border-green-200">
                  <h3 className="text-sm font-bold text-green-800 flex items-center gap-2">
                    <span>💬</span>
                    WhatsApp
                  </h3>
                </div>
                <div className="p-5">
                  <WhatsAppPreview preview={basePreview} url={result.url} />
                </div>
              </div>

              {/* Telegram Preview */}
              <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-sky-50 border-b border-cyan-200">
                  <h3 className="text-sm font-bold text-cyan-800 flex items-center gap-2">
                    <span>✈️</span>
                    Telegram
                  </h3>
                </div>
                <div className="p-5">
                  <TelegramPreview preview={basePreview} url={result.url} />
                </div>
              </div>

              {/* Slack Preview */}
              <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
                  <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <span>💬</span>
                    Slack
                  </h3>
                </div>
                <div className="p-5">
                  <SlackPreview preview={basePreview} url={result.url} />
                </div>
              </div>
            </div>

            {/* JSON-LD / Structured Data */}
            <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowJsonLd(!showJsonLd)}
                className="w-full px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between hover:bg-indigo-100 transition-colors"
              >
                <h3 className="text-sm font-bold text-indigo-700 flex items-center gap-2">
                  <span>🔗</span>
                  JSON-LD 结构化数据 ({result.structuredData.count} 个)
                  <ScoreBadge score={result.structuredData.score} />
                </h3>
                <span className="text-xs text-indigo-400 transition-transform" style={{ transform: showJsonLd ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </button>
              {showJsonLd && (
                <div className="p-5 space-y-4">
                  {result.structuredData.count === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      🔍 未检测到 JSON-LD 结构化数据
                      <p className="text-xs text-gray-400 mt-2">
                        建议为页面添加 Schema.org 结构化数据，帮助搜索引擎更好地理解页面内容
                      </p>
                    </div>
                  ) : (
                    result.structuredData.schemas.map((schema, i) => (
                      <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              schema.valid
                                ? 'text-green-700 bg-green-50 border border-green-200'
                                : 'text-amber-700 bg-amber-50 border border-amber-200'
                            }`}>
                              {schema.valid ? '✅ 有效' : '⚠️ 问题'}
                            </span>
                            <span className="text-sm font-medium text-gray-800">{schema.type}</span>
                            <span className="text-xs text-gray-400">({schema.fields.length} 个字段)</span>
                          </div>
                        </div>
                        {schema.issues.length > 0 && (
                          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                            {schema.issues.map((issue, j) => (
                              <p key={j} className="text-xs text-amber-700">⚠️ {issue}</p>
                            ))}
                          </div>
                        )}
                        <div className="p-4 bg-gray-50">
                          <pre className="text-xs font-mono text-gray-600 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre">
                            {schema.content}
                          </pre>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* All Meta Tags */}
            <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowAllTags(!showAllTags)}
                className="w-full px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <span>🏷️</span>
                  全部 Meta 标签 ({result.tags.length} 个)
                </h3>
                <span className="text-xs text-gray-400 transition-transform" style={{ transform: showAllTags ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </button>
              {showAllTags && (
                <div className="p-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">标签名</th>
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">内容</th>
                          <th className="text-right py-2 text-gray-400 font-medium">类型</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.tags.map((tag, i) => {
                          const badge = getTagTypeBadge(tag.type);
                          return (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 pr-3 font-mono text-gray-800 max-w-[140px] truncate" title={tag.name}>
                                {tag.name}
                              </td>
                              <td className="py-2 pr-3 text-gray-500 max-w-[200px] sm:max-w-[300px] truncate" title={tag.content}>
                                {tag.content}
                              </td>
                              <td className="py-2 text-right">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.color} ${badge.border}`}>
                                  {badge.text}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Copy Report */}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleCopyReport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-200 
                  text-purple-600 text-sm hover:bg-purple-50 transition-all"
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
            <h3 className="text-center text-sm font-bold text-purple-700 mb-4">🔍 检测原理</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: '📡', title: '服务端抓取', desc: '使用 Next.js 服务端 fetch，获取页面 HTML 和 Meta 标签' },
                { icon: '🏷️', title: '全面解析', desc: '提取 OG、Twitter、标准 Meta 标签 + JSON-LD 结构化数据' },
                { icon: '📱', title: '6 平台预览', desc: '模拟 Facebook/Twitter/LinkedIn/WhatsApp/Telegram/Slack 分享效果' },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 bg-white/50 rounded-xl border border-purple-100">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="text-sm font-medium text-purple-900">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                </div>
              ))}
            </div>

            {/* Supported tags preview */}
            <div className="mt-8 text-center">
              <h4 className="text-xs font-medium text-gray-400 mb-3">支持检测的标签与数据：</h4>
              <div className="flex flex-wrap justify-center gap-1.5">
                {[
                  { text: 'og:title', type: 'purple' },
                  { text: 'og:description', type: 'purple' },
                  { text: 'og:image', type: 'purple' },
                  { text: 'twitter:card', type: 'sky' },
                  { text: 'twitter:image', type: 'sky' },
                  { text: 'meta description', type: 'gray' },
                  { text: 'JSON-LD', type: 'indigo' },
                  { text: 'Schema.org', type: 'indigo' },
                ].map((item, i) => {
                  const color = item.type === 'purple' ? 'text-purple-600 bg-purple-50 border-purple-200' :
                    item.type === 'sky' ? 'text-sky-600 bg-sky-50 border-sky-200' :
                    item.type === 'indigo' ? 'text-indigo-600 bg-indigo-50 border-indigo-200' :
                    'text-gray-600 bg-gray-50 border-gray-200';
                  return (
                    <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${color}`}>
                      {item.text}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no result */}
        {!result && !loading && !error && (
          <div className="max-w-xl mx-auto mt-8 text-center text-gray-400 text-xs">
            输入网址开始检测，看看你的网站在各社交平台的表现 🚀
          </div>
        )}
      </div>
    </main>
  );
}
