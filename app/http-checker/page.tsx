/**
 * HTTP Checker — HTTP/SSL 探测器
 * 输入网址 → HTTP 状态码 + 响应头 + SSL 证书 + 重定向链路 + 响应时间
 * 
 * 壁垒：
 * - 服务端 fetch 探测，不受 CORS 限制
 * - 手动追踪重定向链路（redirect: 'manual'）
 * - Node.js tls 模块获取完整 SSL 证书信息
 * - 一键诊断 + 中文建议
 */

'use client';

import { useState, useCallback } from 'react';
import AdBanner from '@/components/AdBanner';

// ============ Types ============

interface RedirectStep {
  url: string;
  status: number;
  statusText: string;
}

interface SSLInfo {
  valid: boolean;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  sni: string;
  altNames: string[];
}

interface DNSEntry {
  ip: string;
  time: number;
}

interface HttpResult {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  redirectChain: RedirectStep[];
  responseTime: number;
  ssl: SSLInfo | null;
  bodyPreview: string;
  contentType: string | null;
  dns: DNSEntry | null;
}

// ============ Suggested URLs ============

const SUGGESTED_URLS = [
  { label: '我的网站', example: 'sinmoniker.com' },
  { label: '百度', example: 'baidu.com' },
  { label: '谷歌', example: 'google.com' },
  { label: 'B站', example: 'bilibili.com' },
];

// ============ Helpers ============

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

function getStatusLabel(status: number): string {
  if (status === 0) return '请求失败';
  if (status >= 200 && status < 300) return '正常';
  if (status >= 300 && status < 400) return '重定向';
  if (status === 400) return '错误请求';
  if (status === 401) return '未授权';
  if (status === 403) return '禁止访问';
  if (status === 404) return '页面未找到';
  if (status === 429) return '请求过多';
  if (status === 500) return '服务器内部错误';
  if (status === 502) return '网关错误';
  if (status === 503) return '服务不可用';
  if (status === 504) return '网关超时';
  return `状态码 ${status}`;
}

function formatHeaderName(name: string): string {
  return name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('-');
}

function formatTime(ms: number): string {
  if (ms === 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getTimeColor(ms: number): string {
  if (ms === 0) return 'text-gray-400';
  if (ms < 300) return 'text-green-600';
  if (ms < 1000) return 'text-amber-600';
  return 'text-red-600';
}

function getServerInfo(headers: Record<string, string>): string {
  const server = headers['server'];
  const poweredBy = headers['x-powered-by'];
  const parts: string[] = [];
  if (server) parts.push(server);
  if (poweredBy) parts.push(poweredBy);
  return parts.join(' · ') || '未知';
}

function getSSLColor(days: number): string {
  if (days > 90) return 'text-green-600 bg-green-50 border-green-200';
  if (days > 30) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function getSSLIcon(valid: boolean): string {
  return valid ? '🔒' : '⚠️';
}

function getServerEmoji(server: string): string {
  if (!server || server === '未知') return '🖥️';
  const s = server.toLowerCase();
  if (s.includes('nginx')) return '🔶';
  if (s.includes('apache') || s.includes('httpd')) return '🟥';
  if (s.includes('cloudflare')) return '☁️';
  if (s.includes('iis') || s.includes('microsoft')) return '🟦';
  if (s.includes('gws') || s.includes('google')) return '🟢';
  if (s.includes('vercel')) return '▲';
  return '🖥️';
}

function getContentTypeEmoji(ct: string | null): string {
  if (!ct) return '📄';
  if (ct.includes('text/html')) return '🌐';
  if (ct.includes('application/json')) return '📋';
  if (ct.includes('application/xml') || ct.includes('text/xml')) return '📰';
  if (ct.includes('image/')) return '🖼️';
  if (ct.includes('text/plain')) return '📝';
  if (ct.includes('application/pdf')) return '📕';
  return '📄';
}

// ============ Component ============

export default function HTTPCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HttpResult | null>(null);
  const [error, setError] = useState('');
  const [showHeaders, setShowHeaders] = useState(false);
  const [showSSL, setShowSSL] = useState(true);
  const [showRedirect, setShowRedirect] = useState(true);

  const inspect = useCallback(async (targetUrl: string) => {
    const u = targetUrl.trim();
    if (!u) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/http/inspect?url=${encodeURIComponent(u)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const data: HttpResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || '探测失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inspect(url);
  };

  const headerCount = result ? Object.keys(result.headers).length : 0;
  const serverInfo = result ? getServerInfo(result.headers) : '';

  return (
    <main className="min-h-screen bg-gradient-to-b from-teal-50 to-cream">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-teal-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔬</span>
            <div>
              <h1 className="text-lg font-bold text-teal-900">HTTP Checker</h1>
              <p className="text-xs text-teal-500 hidden sm:block">HTTP / SSL 探测器</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <a href="/" className="text-teal-600 hover:text-amber-600 transition-colors">← 返回首页</a>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="text-5xl mb-3">🔬🌐</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-teal-900 mb-2">
            你的网站正常响应吗？
          </h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            输入网址，一键探测 HTTP 状态码、响应头、SSL 证书详情、重定向链路
            <span className="block text-xs text-gray-400 mt-1">站长 & 开发者必备 — 不依赖浏览器，服务端直接探测</span>
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
                  探测中...
                </>
              ) : (
                <>
                  🔬 探测
                </>
              )}
            </button>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            <span className="text-xs text-gray-400 self-center">快速探测：</span>
            {SUGGESTED_URLS.map(({ label, example }) => (
              <button
                key={example}
                type="button"
                onClick={() => { setUrl(example); inspect(example); }}
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
            {/* Status Summary Card */}
            <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-teal-900 flex items-center gap-2">
                    <span className="text-2xl">{getStatusEmoji(result.status)}</span>
                    {result.status > 0 ? `${result.status} ${result.statusText}` : '请求失败'}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(result.status)}`}>
                      {getStatusLabel(result.status)}
                    </span>
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 font-mono break-all">
                    {result.url}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    探测时间：{new Date().toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-black ${getTimeColor(result.responseTime)}`}>
                    {formatTime(result.responseTime)}
                  </div>
                  <div className="text-xs text-gray-400">响应时间</div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-xl">{getStatusEmoji(result.status)}</div>
                  <div className="text-xs text-gray-400 mt-1">HTTP 状态</div>
                </div>
                <div className="text-center">
                  <div className="text-xl">{getContentTypeEmoji(result.contentType)}</div>
                  <div className="text-xs text-gray-400 mt-1 truncate">
                    {result.contentType ? result.contentType.split(';')[0].split('/').pop() : '未知'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xl">{getServerEmoji(serverInfo)}</div>
                  <div className="text-xs text-gray-400 mt-1 truncate">
                    {serverInfo === '未知' ? serverInfo : serverInfo.split('·')[0].trim()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xl">{result.redirectChain.length > 1 ? '🔀' : '➡️'}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {result.redirectChain.length > 1 ? `${result.redirectChain.length - 1} 次跳转` : '无重定向'}
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* DNS Info */}
              <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-4 sm:p-5">
                <h3 className="text-sm font-bold text-teal-900 mb-3">🌐 DNS 解析</h3>
                {result.dns ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">解析IP</span>
                      <span className="font-mono font-medium">{result.dns.ip}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">解析耗时</span>
                      <span className={`font-mono font-medium ${getTimeColor(result.dns.time)}`}>
                        {result.dns.time}ms
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">DNS 解析失败</p>
                )}
              </div>

              {/* SSL Info */}
              <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-teal-900">🔒 SSL 证书</h3>
                  <button
                    onClick={() => setShowSSL(!showSSL)}
                    className="text-xs text-gray-400 hover:text-teal-600 transition-colors"
                  >
                    {showSSL ? '收起' : '展开'}
                  </button>
                </div>
                {result.ssl ? (
                  showSSL && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">状态</span>
                        <span className={`flex items-center gap-1 font-medium ${result.ssl.valid ? 'text-green-600' : 'text-red-600'}`}>
                          {getSSLIcon(result.ssl.valid)}
                          {result.ssl.valid ? '有效' : '过期/无效'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">颁发者</span>
                        <span className="font-medium truncate ml-2 text-right">{result.ssl.issuer}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">域名</span>
                        <span className="font-mono">{result.ssl.subject}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">有效至</span>
                        <span className={getSSLColor(result.ssl.daysRemaining)}>
                          {result.ssl.validTo} ({result.ssl.daysRemaining}天)
                        </span>
                      </div>
                      {result.ssl.altNames.length > 0 && (
                        <div className="text-xs pt-1">
                          <span className="text-gray-500">SANs：</span>
                          <span className="text-gray-700 truncate block">
                            {result.ssl.altNames.slice(0, 5).join(', ')}
                            {result.ssl.altNames.length > 5 && ` +${result.ssl.altNames.length - 5}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    {result.url.startsWith('https://') ? 'SSL 信息不可用' : '非 HTTPS 连接'}
                  </p>
                )}
              </div>
            </div>

            {/* Redirect Chain */}
            {result.redirectChain.length > 1 && (
              <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-teal-900">🔀 重定向链路</h3>
                  <button
                    onClick={() => setShowRedirect(!showRedirect)}
                    className="text-xs text-gray-400 hover:text-teal-600 transition-colors"
                  >
                    {showRedirect ? '收起' : '展开'}
                  </button>
                </div>
                {showRedirect && (
                  <div className="space-y-2">
                    {result.redirectChain.map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getStatusColor(step.status)}`}>
                            {step.status}
                          </div>
                          {i < result.redirectChain.length - 1 && (
                            <div className="w-0.5 h-6 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <p className="text-xs font-mono text-gray-700 break-all">{step.url}</p>
                          {step.statusText && (
                            <p className="text-xs text-gray-400 mt-0.5">{step.statusText}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Response Headers */}
            <div className="bg-white rounded-2xl border border-teal-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowHeaders(!showHeaders)}
                className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-bold text-teal-900">
                  📋 响应头 ({headerCount})
                </h3>
                <span className="text-gray-300">{showHeaders ? '▲' : '▼'}</span>
              </button>
              {showHeaders && (
                <div className="border-t border-gray-100 px-4 sm:px-5 pb-4 sm:pb-5">
                  <div className="space-y-1 mt-3">
                    {Object.entries(result.headers).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-xs py-0.5">
                        <span className="text-teal-600 font-medium whitespace-nowrap min-w-[160px]">
                          {formatHeaderName(key)}
                        </span>
                        <span className="text-gray-600 break-all font-mono">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const text = Object.entries(result.headers)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\n');
                      navigator.clipboard.writeText(text).catch(() => {});
                    }}
                    className="mt-3 text-xs text-teal-600 hover:text-teal-800 transition-colors"
                  >
                    📋 复制头信息
                  </button>
                </div>
              )}
            </div>

            {/* Body Preview */}
            {result.bodyPreview && (
              <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-6">
                <h3 className="text-sm font-bold text-teal-900 mb-3">👁️ 响应内容预览</h3>
                <pre className="text-xs text-gray-600 font-mono bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                  {result.bodyPreview.slice(0, 400)}
                </pre>
                <p className="text-xs text-gray-400 mt-2">
                  {result.bodyPreview.length >= 500 ? `（预览截断，仅显示前 500 字符）` : `（全文 ${result.bodyPreview.length} 字符）`}
                </p>
              </div>
            )}

            {/* Share */}
            <div className="text-center">
              <button
                onClick={() => {
                  const summaryLines = [
                    `🔬 HTTP Checker 诊断报告`,
                    `━━━━━━━━━━━━━━━━`,
                    `目标: ${result.url}`,
                    `状态: ${result.status} ${result.statusText}`,
                    `响应时间: ${formatTime(result.responseTime)}`,
                    ...(result.ssl ? [`SSL: ${result.ssl.valid ? '有效' : '⚠️ 异常'}，剩余 ${result.ssl.daysRemaining} 天`] : []),
                    ...(result.redirectChain.length > 1 ? [`重定向: ${result.redirectChain.length - 1} 次跳转`] : []),
                    `━━━━━━━━━━━━━━━━`,
                    `立即检测: ${window.location.origin}/http-checker`,
                  ].join('\n');
                  navigator.clipboard.writeText(summaryLines)
                    .then(() => alert('✅ 诊断报告已复制到剪贴板'))
                    .catch(() => {});
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

        {/* How it works */}
        {!result && !loading && (
          <div className="max-w-2xl mx-auto mt-12">
            <h3 className="text-center text-sm font-bold text-teal-700 mb-4">🔬 探测原理</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: '🌐', title: '服务端探测', desc: '使用 Next.js 服务端 fetch，不受 CORS 和浏览器限制' },
                { icon: '🔀', title: '重定向追踪', desc: '手动 follow 301/302/307/308，完整记录跳转链路' },
                { icon: '🔒', title: 'SSL 检查', desc: 'Node.js tls 连接，获取证书详情、有效期、SANs' },
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
