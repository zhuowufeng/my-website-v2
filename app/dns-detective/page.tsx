/**
 * 域名侦探 — DNS Detective
 * 输入域名 → 多DNS服务器解析 → 健康检查 → 中文友好诊断报告
 * 
 * 本产品壁垒：
 * - 自研多源DNS探测引擎
 * - 多公共DNS对比分析
 * - DNS健康评分 + 易懂修复建议
 * - 历史记录追踪
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import AdBanner from '@/components/AdBanner';

// ============ Types ============

interface DNSRecord {
  type: string;
  value: string;
  ttl?: number;
  priority?: number;
}

interface ResolverResult {
  resolver: string;
  location: string;
  records: DNSRecord[];
  time: number;
  error?: string;
}

interface HealthCheck {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  detail?: string;
}

interface DNSResult {
  domain: string;
  resolvers: ResolverResult[];
  summary: {
    totalResolvers: number;
    successCount: number;
    errorCount: number;
    avgTime: number;
  };
  health: HealthCheck[];
}

// ============ Helpers ============

function getRecordIcon(type: string): string {
  switch (type) {
    case 'A': return '🌐';
    case 'AAAA': return '🌍';
    case 'CNAME': return '🔗';
    case 'MX': return '📧';
    case 'NS': return '🏷️';
    case 'TXT': return '📝';
    default: return '📄';
  }
}

function getRecordColor(type: string): string {
  switch (type) {
    case 'A': case 'AAAA': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'CNAME': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'MX': return 'bg-green-50 text-green-700 border-green-200';
    case 'NS': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'TXT': return 'bg-gray-50 text-gray-700 border-gray-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function getHealthIcon(type: string): string {
  switch (type) {
    case 'success': return '✅';
    case 'warning': return '⚠️';
    case 'error': return '❌';
    case 'info': return '💡';
    default: return '❓';
  }
}

function getHealthColor(type: string): string {
  switch (type) {
    case 'success': return 'bg-green-50 border-green-200 text-green-800';
    case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'error': return 'bg-red-50 border-red-200 text-red-800';
    case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
    default: return 'bg-gray-50 border-gray-200 text-gray-800';
  }
}

function getScoreEmoji(score: number): string {
  if (score >= 90) return '🟢';
  if (score >= 70) return '🟡';
  if (score >= 50) return '🟠';
  return '🔴';
}

function calculateScore(health: HealthCheck[]): number {
  let score = 100;
  for (const h of health) {
    if (h.type === 'error') score -= 25;
    else if (h.type === 'warning') score -= 10;
    else if (h.type === 'info') score -= 2;
  }
  return Math.max(0, score);
}

// ============ Suggested Domains ============

const SUGGESTED_DOMAINS = [
  { label: '我的网站', example: 'sinmoniker.com' },
  { label: '百度', example: 'baidu.com' },
  { label: '谷歌', example: 'google.com' },
  { label: 'GitHub', example: 'github.com' },
];

// ============ Component ============

export default function DNSDetectivePage() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DNSResult | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [expandedResolver, setExpandedResolver] = useState<string | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dns-detective-history');
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const saveToHistory = useCallback((domain: string) => {
    setHistory(prev => {
      const next = [domain, ...prev.filter(d => d !== domain)].slice(0, 10);
      try { localStorage.setItem('dns-detective-history', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const lookupDNS = useCallback(async (targetDomain: string) => {
    const d = targetDomain.trim();
    if (!d) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/dns/lookup?domain=${encodeURIComponent(d)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const data: DNSResult = await res.json();
      setResult(data);
      saveToHistory(d);
    } catch (err: any) {
      setError(err.message || '查询失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [saveToHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupDNS(domain);
  };

  const score = result ? calculateScore(result.health) : 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-teal-50 to-cream">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-teal-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            <div>
              <h1 className="text-lg font-bold text-teal-900">域名侦探</h1>
              <p className="text-xs text-teal-500 hidden sm:block">DNS Detective</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <a href="/" className="text-teal-600 hover:text-amber-600 transition-colors">← 返回首页</a>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="text-5xl mb-3">🔍🌐</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-teal-900 mb-2">
            你的域名健不健康？
          </h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            输入域名，一键检测 DNS 解析状态、响应速度、配置健康度
            <span className="block text-xs text-gray-400 mt-1">支持多地 DNS 对比分析</span>
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="max-w-xl mx-auto mb-8">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="输入域名，如 sinmoniker.com"
                className="w-full px-4 py-3.5 rounded-xl border border-teal-200 bg-white
                  text-teal-900 placeholder:text-gray-400 text-sm
                  focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
                  transition-all shadow-sm"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !domain.trim()}
              className="px-6 py-3.5 bg-gradient-to-r from-teal-600 to-teal-500 
                text-white font-medium rounded-xl text-sm
                hover:from-teal-700 hover:to-teal-600 disabled:opacity-50 
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
            {SUGGESTED_DOMAINS.map(({ label, example }) => (
              <button
                key={example}
                type="button"
                onClick={() => { setDomain(example); lookupDNS(example); }}
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

        {/* Error */}
        {error && (
          <div className="max-w-xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
            <div className="h-8 bg-teal-100 rounded-lg w-1/3" />
            <div className="h-24 bg-teal-50 rounded-xl" />
            <div className="h-48 bg-teal-50 rounded-xl" />
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Score Card */}
            <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-teal-900">
                    {getScoreEmoji(score)} DNS 健康评分
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {result.domain} — {new Date().toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`
                    text-4xl font-black
                    ${score >= 90 ? 'text-green-600' : score >= 70 ? 'text-amber-600' : score >= 50 ? 'text-orange-600' : 'text-red-600'}
                  `}>
                    {score}
                  </span>
                  <span className="text-sm text-gray-400">/100</span>
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-lg font-bold text-teal-700">{result.summary.totalResolvers}</div>
                  <div className="text-xs text-gray-400">DNS 探测点</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{result.summary.successCount}</div>
                  <div className="text-xs text-gray-400">解析成功</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-600">{result.summary.avgTime}ms</div>
                  <div className="text-xs text-gray-400">平均响应</div>
                </div>
              </div>
            </div>

            {/* Health Checks */}
            <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-6">
              <h3 className="text-base font-bold text-teal-900 mb-4">🩺 健康检查结果</h3>
              <div className="space-y-3">
                {result.health.map((check, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 ${getHealthColor(check.type)}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">{getHealthIcon(check.type)}</span>
                      <div>
                        <p className="font-medium text-sm">{check.message}</p>
                        {check.detail && (
                          <p className="text-xs mt-1 opacity-80">{check.detail}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resolver Details */}
            <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-6">
              <h3 className="text-base font-bold text-teal-900 mb-4">📡 多 DNS 解析详情</h3>
              <div className="space-y-3">
                {result.resolvers.map((r, i) => {
                  const isExpanded = expandedResolver === r.resolver || expandedResolver === null;
                  const hasRecords = r.records.length > 0;
                  return (
                    <div
                      key={i}
                      className="border border-gray-100 rounded-xl overflow-hidden"
                    >
                      {/* Resolver header */}
                      <button
                        onClick={() => setExpandedResolver(isExpanded ? null : r.resolver)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-2 h-2 rounded-full flex-shrink-0
                            ${hasRecords ? 'bg-green-500' : 'bg-red-400'}
                          `} />
                          <div className="text-left">
                            <span className="font-medium text-sm text-teal-900">{r.resolver}</span>
                            <span className="text-xs text-gray-400 ml-2">{r.location}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-mono ${r.time < 200 ? 'text-green-600' : r.time < 500 ? 'text-amber-600' : 'text-red-500'}`}>
                            {r.time}ms
                          </span>
                          <span className="text-gray-300">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {/* Records (expandable) */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 p-3 bg-gray-50/50">
                          {r.error && (
                            <div className="text-xs text-red-500 mb-2">⚠ {r.error}</div>
                          )}
                          {hasRecords ? (
                            <div className="space-y-1.5">
                              {r.records.map((rec, j) => (
                                <div
                                  key={j}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${getRecordColor(rec.type)}`}
                                >
                                  <span>{getRecordIcon(rec.type)}</span>
                                  <span className="font-medium">{rec.type}</span>
                                  <span className="flex-1 truncate font-mono">{rec.value}</span>
                                  {rec.priority !== undefined && (
                                    <span className="text-gray-400">prio:{rec.priority}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">该解析器无返回记录</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Share Button */}
            <div className="text-center">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `🔍 域名侦探 - DNS 诊断报告\n域名: ${result.domain}\n健康评分: ${score}/100\n平均响应: ${result.summary.avgTime}ms\n立即检测: ${window.location.origin}/dns-detective`
                  ).then(() => alert('✅ 报告已复制到剪贴板')).catch(() => {});
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-teal-200 
                  text-teal-600 text-sm hover:bg-teal-50 transition-all"
              >
                📋 复制诊断报告
              </button>
            </div>

            <AdBanner position="bottom" source="default" />
          </div>
        )}

        {/* History */}
        {history.length > 0 && !result && !loading && (
          <div className="max-w-xl mx-auto mt-8">
            <details className="bg-white/50 rounded-xl border border-teal-100">
              <summary className="px-4 py-3 text-sm font-medium text-teal-700 cursor-pointer hover:bg-teal-50/50 rounded-xl">
                📋 最近查询记录 ({history.length})
              </summary>
              <div className="px-4 pb-3 space-y-1">
                {history.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => { setDomain(d); lookupDNS(d); }}
                    className="block w-full text-left px-3 py-2 text-sm text-teal-600 
                      hover:bg-teal-50 rounded-lg transition-colors"
                  >
                    🔄 {d}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem('dns-detective-history');
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 mt-2"
                >
                  清除历史
                </button>
              </div>
            </details>
          </div>
        )}

        {/* How it works */}
        {!result && !loading && (
          <div className="max-w-2xl mx-auto mt-12">
            <h3 className="text-center text-sm font-bold text-teal-700 mb-4">🔬 检测原理</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: '🌐', title: '多源探测', desc: '使用 Cloudflare、Google、114DNS 等 5 个公共 DNS 同时查询' },
                { icon: '⚡', title: '响应测速', desc: '对比不同 DNS 服务器的响应时间，判断 CDN 加速效果' },
                { icon: '🩺', title: '健康检查', desc: '自动检测配置问题，给出中文友好建议' },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 bg-white/50 rounded-xl border border-teal-100">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="text-sm font-medium text-teal-900">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
