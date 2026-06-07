/**
 * /data-browser — 数据浏览器页面
 * 模块10 验证：全文搜索 + 筛选 + 排序 + 游标分页 + 缓存 + 统计
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ScrapedPage {
  id: number;
  url: string;
  domain: string;
  title: string;
  meta_description: string;
  og_title: string;
  og_image: string;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  internal_links_count: number;
  external_links_count: number;
  image_count: number;
  images_with_alt: number;
  word_count: number;
  status_code: number;
  fetch_time_ms: number;
  has_favicon: boolean;
  has_sitemap: boolean;
  has_og_tags: boolean;
  crawled_at: string;
  status_category: string;
}

interface GlobalStats {
  total_pages: number;
  total_domains: number;
  avg_fetch_time: number;
  avg_word_count: number;
  ok_pages: number;
  error_pages: number;
  pages_with_og: number;
  pages_with_sitemap: number;
  last_crawl: string;
  total_words?: number;
  first_crawl?: string;
}

interface SearchResponse {
  data: ScrapedPage[];
  nextCursor: { sortValue: any; id: number } | null;
  hasMore: boolean;
  stats: GlobalStats | null;
  cached: boolean;
}

const STATUS_CATEGORIES: Record<string, { label: string; color: string }> = {
  ok: { label: '正常', color: 'bg-green-100 text-green-800' },
  redirect: { label: '跳转', color: 'bg-blue-100 text-blue-800' },
  client_error: { label: '客户端错误', color: 'bg-yellow-100 text-yellow-800' },
  server_error: { label: '服务端错误', color: 'bg-red-100 text-red-800' },
  unknown: { label: '未知', color: 'bg-gray-100 text-gray-800' },
};

export default function DataBrowserPage() {
  const [data, setData] = useState<ScrapedPage[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cached, setCached] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [statusCodeFilter, setStatusCodeFilter] = useState('');
  const [sortField, setSortField] = useState('crawled_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Build query params
  const buildUrl = useCallback((cursor?: any) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (domainFilter) params.set('domain', domainFilter);
    if (statusCodeFilter) params.set('status_code', statusCodeFilter);
    params.set('sort', sortField);
    params.set('order', sortOrder);
    if (cursor) {
      params.set('cursor', btoa(JSON.stringify(cursor)));
    }
    return `/api/data-browser/search?${params.toString()}`;
  }, [searchQuery, domainFilter, statusCodeFilter, sortField, sortOrder]);

  // Fetch data
  const fetchData = useCallback(async (cursor?: any, append = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(buildUrl(cursor));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result: SearchResponse = await res.json();

      if (append) {
        setData(prev => [...prev, ...result.data]);
      } else {
        setData(result.data);
      }
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
      setCached(result.cached || false);

      if (!cursor && result.stats) {
        setStats(result.stats);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search with debounce
  const handleSearch = () => {
    setIsSearching(true);
    fetchData();
    setTimeout(() => setIsSearching(false), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Load more
  const handleLoadMore = () => {
    if (nextCursor && !loading) {
      fetchData(nextCursor, true);
    }
  };

  // Sort change
  const handleSortChange = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Reset filters
  const handleReset = () => {
    setSearchQuery('');
    setDomainFilter('');
    setStatusCodeFilter('');
    setSortField('crawled_at');
    setSortOrder('desc');
  };

  // Format time
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                📊 数据浏览器
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                浏览、搜索、分析爬取的数据 — 全文搜索 · 智能分页 · 实时缓存
              </p>
            </div>
            {cached && (
              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                ⚡ 缓存命中
              </span>
            )}
          </div>

          {/* Stats bar */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-400 uppercase tracking-wide">总页面</div>
                <div className="text-xl font-bold text-gray-900">{stats.total_pages.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-400 uppercase tracking-wide">域名数</div>
                <div className="text-xl font-bold text-gray-900">{stats.total_domains}</div>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-400 uppercase tracking-wide">正常率</div>
                <div className="text-xl font-bold text-green-600">
                  {stats.total_pages > 0
                    ? Math.round(stats.ok_pages / stats.total_pages * 100)
                    : 0}%
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-400 uppercase tracking-wide">总字数</div>
                <div className="text-xl font-bold text-blue-600">
                  {(stats.total_words || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-400 uppercase tracking-wide">平均加载</div>
                <div className="text-xl font-bold text-gray-900">{stats.avg_fetch_time}ms</div>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-400 uppercase tracking-wide">有OG标签</div>
                <div className="text-xl font-bold text-indigo-600">{stats.pages_with_og}</div>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-400 uppercase tracking-wide">最近爬取</div>
                <div className="text-xs font-semibold text-gray-600 mt-1">
                  {stats.last_crawl ? formatTime(stats.last_crawl) : '-'}
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Search & Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-400 mb-1 font-medium">🔍 全文搜索</label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="搜索标题或描述..."
                  className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           text-sm transition-all"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 
                           bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 
                           transition-colors disabled:opacity-50"
                >
                  {loading ? '...' : '搜索'}
                </button>
              </div>
            </div>

            {/* Domain filter */}
            <div className="w-40">
              <label className="block text-xs text-gray-400 mb-1 font-medium">🌐 域名</label>
              <input
                type="text"
                value={domainFilter}
                onChange={e => setDomainFilter(e.target.value)}
                placeholder="example.com"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Status filter */}
            <div className="w-36">
              <label className="block text-xs text-gray-400 mb-1 font-medium">📡 状态码</label>
              <select
                value={statusCodeFilter}
                onChange={e => setStatusCodeFilter(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              >
                <option value="">全部</option>
                <option value="200">200 OK</option>
                <option value="301">301 跳转</option>
                <option value="302">302 临时跳转</option>
                <option value="403">403 禁止</option>
                <option value="404">404 未找到</option>
                <option value="500">500 服务器错误</option>
                <option value="502">502 网关错误</option>
                <option value="503">503 服务不可用</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">📋 排序</label>
              <div className="flex gap-1">
                {[
                  { key: 'crawled_at', label: '时间' },
                  { key: 'word_count', label: '字数' },
                  { key: 'domain', label: '域名' },
                  { key: 'fetch_time', label: '速度' },
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => handleSortChange(s.key)}
                    className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                      sortField === s.key
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {s.label} {sortField === s.key && (sortOrder === 'desc' ? '↓' : '↑')}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="px-3 py-2.5 text-xs text-gray-400 hover:text-red-500 
                       border border-gray-200 rounded-xl hover:border-red-200 transition-all"
            >
              ✕ 重置
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Data table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {loading && data.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
              <p className="text-gray-400 text-sm">正在加载数据...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm">暂无数据 — 先用爬虫采集一些页面吧</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden lg:grid grid-cols-12 gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wider">
                <div className="col-span-4">页面</div>
                <div className="col-span-2">域名</div>
                <div className="col-span-1 text-right">状态</div>
                <div className="col-span-1 text-right">字数</div>
                <div className="col-span-1 text-right">加载</div>
                <div className="col-span-1 text-right">图片</div>
                <div className="col-span-1 text-center">OG</div>
                <div className="col-span-1 text-right">爬取时间</div>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-gray-50">
                {data.map((page) => {
                  const statusInfo = STATUS_CATEGORIES[page.status_category] || STATUS_CATEGORIES.unknown;
                  return (
                    <div key={page.id} className="lg:grid lg:grid-cols-12 gap-3 px-6 py-4 hover:bg-blue-50/30 transition-colors">
                      {/* Page info */}
                      <div className="col-span-4 mb-2 lg:mb-0">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 
                                   line-clamp-1 transition-colors"
                        >
                          {page.title || page.og_title || page.url}
                        </a>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                          {page.meta_description 
                            ? page.meta_description.substring(0, 100)
                            : page.url}
                        </p>
                      </div>

                      {/* Domain */}
                      <div className="col-span-2 mb-1 lg:mb-0">
                        <span className="inline-block lg:hidden text-xs text-gray-400 mr-2">域名:</span>
                        <span className="text-xs text-gray-600 font-mono">{page.domain}</span>
                      </div>

                      {/* Status */}
                      <div className="col-span-1 text-right mb-1 lg:mb-0">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${statusInfo.color}`}>
                          {page.status_code}
                        </span>
                      </div>

                      {/* Word count */}
                      <div className="col-span-1 text-right mb-1 lg:mb-0">
                        <span className="inline-block lg:hidden text-xs text-gray-400 mr-2">字数:</span>
                        <span className="text-xs text-gray-600">
                          {page.word_count > 1000
                            ? `${(page.word_count / 1000).toFixed(1)}k`
                            : page.word_count}
                        </span>
                      </div>

                      {/* Fetch time */}
                      <div className="col-span-1 text-right mb-1 lg:mb-0">
                        <span className="inline-block lg:hidden text-xs text-gray-400 mr-2">加载:</span>
                        <span className="text-xs" style={{
                          color: page.fetch_time_ms < 500 ? '#059669' :
                                 page.fetch_time_ms < 2000 ? '#d97706' : '#dc2626'
                        }}>
                          {page.fetch_time_ms}ms
                        </span>
                      </div>

                      {/* Images */}
                      <div className="col-span-1 text-right mb-1 lg:mb-0">
                        <span className="inline-block lg:hidden text-xs text-gray-400 mr-2">图片:</span>
                        <span className="text-xs text-gray-600">
                          {page.images_with_alt}/{page.image_count}
                        </span>
                      </div>

                      {/* OG tags */}
                      <div className="col-span-1 text-center mb-1 lg:mb-0">
                        <span className={page.has_og_tags ? 'text-green-500' : 'text-gray-300'}>
                          {page.has_og_tags ? '✅' : '—'}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="col-span-1 text-right">
                        <span className="inline-block lg:hidden text-xs text-gray-400 mr-2">时间:</span>
                        <span className="text-xs text-gray-500">{formatTime(page.crawled_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="px-6 py-4 border-t border-gray-100 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="px-6 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium
                             hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></span>
                        加载中...
                      </span>
                    ) : (
                      `加载更多 (${data.length} 条已加载)`
                    )}
                  </button>
                </div>
              )}

              {/* Footer info */}
              <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                <span>共 {data.length} 条</span>
                <span className={cached ? 'text-purple-500' : ''}>
                  {cached ? '⚡ 响应来自缓存' : '📡 实时数据'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Technical notes */}
        <div className="mt-6 p-4 bg-white/60 backdrop-blur rounded-xl border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">⚡ 技术特点</h3>
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              🗃️ 游标分页
            </span>
            <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full">
              ⚡ 缓存层 (TTL)
            </span>
            <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
              🔍 全文搜索
            </span>
            <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
              📊 聚合统计
            </span>
            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
              🧩 Data Mapper
            </span>
            <span className="px-2.5 py-1 bg-pink-100 text-pink-700 text-xs rounded-full">
              📋 复合索引
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
