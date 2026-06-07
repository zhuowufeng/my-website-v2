/**
 * /search — 全站搜索
 * 模块14：搜索能力
 *
 * 搜索所有内容：文章、爬取页面、SEO报告
 * 支持：关键词高亮、分页、搜索建议、搜索历史、热词
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';

// ============ Types ============

interface SearchResult {
  id: number;
  title?: string;
  topic?: string;
  content_preview?: string;
  url?: string;
  domain?: string;
  meta_description?: string;
  word_count?: number;
  score?: number;
  grade?: string;
  rank: number;
  source: 'articles' | 'scraped' | 'seo';
  created_at: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  keyword: string;
  correctedFrom?: string;
  wasCorrected?: boolean;
  expandedTerms?: string[];
  hasMore: boolean;
}

// ============ Components ============

function SearchSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="h-5 bg-white/10 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-white/10 rounded w-full mb-1"></div>
          <div className="h-4 bg-white/10 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { label: string; color: string }> = {
    articles: { label: '📝 文章', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    scraped: { label: '🕷️ 爬取页面', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    seo: { label: '🔍 SEO报告', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  };
  const c = config[source] || { label: source, color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${c.color}`}>
      {c.label}
    </span>
  );
}

function HighlightText({ text, keyword }: { text?: string | null; keyword: string }) {
  if (!text || !keyword) return <>{text || ''}</>;
  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase()
          ? <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">{part}</mark>
          : part
      )}
    </>
  );
}

function ResultCard({ result, keyword }: { result: SearchResult; keyword: string }) {
  const linkUrl = result.source === 'articles'
    ? `/blog/${result.id}`
    : result.source === 'scraped'
      ? `/data-browser?id=${result.id}`
      : `/seo-diagnosis/history/${result.id}`;

  const title = result.title || result.topic || result.url || '(无标题)';

  return (
    <Link
      href={linkUrl}
      className="block bg-white/5 rounded-xl p-4 border border-white/10 
                 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-200
                 group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-medium text-white group-hover:text-blue-300 transition-colors">
          <HighlightText text={title} keyword={keyword} />
        </h3>
        <SourceBadge source={result.source} />
      </div>

      {result.content_preview && (
        <p className="text-sm text-gray-400 line-clamp-2 mb-2">
          <HighlightText text={result.content_preview} keyword={keyword} />
        </p>
      )}
      {result.meta_description && (
        <p className="text-sm text-gray-400 line-clamp-2 mb-2">
          <HighlightText text={result.meta_description} keyword={keyword} />
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500">
        {result.source === 'articles' && result.word_count && (
          <span>{result.word_count} 字</span>
        )}
        {result.source === 'seo' && result.score != null && (
          <span className={result.score >= 80 ? 'text-green-400' : result.score >= 60 ? 'text-yellow-400' : 'text-red-400'}>
            评分: {result.score}/100 ({result.grade})
          </span>
        )}
        {result.url && (
          <span className="truncate max-w-[200px]">{result.url}</span>
        )}
        <span>{new Date(result.created_at).toLocaleDateString('zh-CN')}</span>
      </div>
    </Link>
  );
}

// ============ Main Page ============

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [source, setSource] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [correctedFrom, setCorrectedFrom] = useState<string | null>(null);
  const [expandedTerms, setExpandedTerms] = useState<string[] | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hotTerms, setHotTerms] = useState<{ keyword: string; search_count: number }[]>([]);
  const [history, setHistory] = useState<{ keyword: string; last_searched: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const PAGE_SIZE = 10;

  // Load hot terms on mount
  useEffect(() => {
    fetch('/api/search/hot?limit=8&days=30')
      .then(r => r.json())
      .then(d => setHotTerms(d.terms || []))
      .catch(() => {});
    fetch('/api/search/history')
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .catch(() => {});
  }, []);

  // Search function
  const doSearch = useCallback(async (q: string, pageNum: number = 0) => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const params = new URLSearchParams({
        q: q.trim(),
        limit: String(PAGE_SIZE),
        offset: String(pageNum * PAGE_SIZE),
      });
      if (source) params.set('source', source);

      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error('搜索请求失败');
      const data: SearchResponse = await res.json();

      setResults(prev => pageNum === 0 ? data.results : [...prev, ...data.results]);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setPage(pageNum);
      setCorrectedFrom(data.wasCorrected ? (data.correctedFrom || null) : null);
      setExpandedTerms(data.expandedTerms ? [...data.expandedTerms] : null);
    } catch (err: any) {
      setError(err.message || '搜索出错');
    } finally {
      setLoading(false);
    }
  }, [source]);

  // Search suggestions (debounced)
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setShowSuggestions(val.length > 0);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setShowSuggestions(false);
    setResults([]);
    setPage(0);
    doSearch(query, 0);
  };

  const handleSuggestionClick = (s: string) => {
    setQuery(s);
    setShowSuggestions(false);
    setResults([]);
    doSearch(s, 0);
  };

  const handleHotClick = (term: string) => {
    setQuery(term);
    setShowSuggestions(false);
    setResults([]);
    doSearch(term, 0);
  };

  // Click outside to close suggestions
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Header */}
      <div className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
              ← 返回首页
            </Link>
            <Link href="/search/admin" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              ⚙️ 管理后台
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">🔍 全站搜索</h1>
          <p className="text-sm text-gray-400">搜索文章、爬取页面和SEO报告</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="relative mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={() => setShowSuggestions(query.length > 0)}
                placeholder="搜索文章、页面、域名..."
                className="w-full px-4 py-3 pl-10 bg-white/10 border border-white/20 rounded-xl 
                           text-white placeholder-gray-500 outline-none
                           focus:border-blue-500/50 focus:bg-white/15 transition-all"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔎</span>

              {/* Source filter */}
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="absolute right-16 top-1/2 -translate-y-1/2 bg-transparent text-xs text-gray-400 
                           border border-white/10 rounded-lg px-2 py-1 outline-none cursor-pointer
                           hover:border-white/30"
              >
                <option value="">全部</option>
                <option value="articles">文章</option>
                <option value="scraped">页面</option>
                <option value="seo">SEO</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium
                         hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all"
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestRef}
              className="absolute z-20 top-full mt-1 left-0 right-0 bg-gray-800 border border-white/10 
                         rounded-xl overflow-hidden shadow-xl"
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 
                             hover:text-white transition-colors"
                >
                  🔎 {s}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Hot terms & History */}
        {!searched && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Hot search terms */}
            {hotTerms.length > 0 && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-sm font-medium text-gray-400 mb-3">🔥 热门搜索</h3>
                <div className="flex flex-wrap gap-2">
                  {hotTerms.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => handleHotClick(t.keyword)}
                      className="px-3 py-1.5 text-sm bg-white/10 hover:bg-blue-500/20 
                                 text-gray-300 hover:text-blue-300 rounded-lg transition-colors"
                    >
                      {t.keyword}
                      <span className="text-xs text-gray-500 ml-1">×{t.search_count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search history */}
            {history.length > 0 && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-400">🕐 搜索历史</h3>
                  <button
                    onClick={async () => {
                      await fetch('/api/search/history', { method: 'DELETE' });
                      setHistory([]);
                    }}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    清空
                  </button>
                </div>
                <div className="space-y-1">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => handleHotClick(h.keyword)}
                      className="block w-full text-left text-sm text-gray-400 hover:text-white 
                                 py-1.5 px-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      🔎 {h.keyword}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {loading && results.length === 0 && <SearchSkeleton />}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {searched && !loading && results.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-gray-400 text-lg mb-2">没有找到相关结果</p>
            <p className="text-gray-500 text-sm">
              试试其他关键词，或换个筛选条件
            </p>
          </div>
        )}

        {/* Typo correction notice */}
        {correctedFrom && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-yellow-300">
              🔄 您是不是想搜 <strong>&ldquo;{query}&rdquo;</strong>？已将 &ldquo;{correctedFrom}&rdquo; 自动纠正
            </p>
          </div>
        )}

        {/* Synonym expansion notice */}
        {expandedTerms && expandedTerms.length > 1 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-blue-300">
              🔗 已扩展同义词搜索：
              {expandedTerms.map((term, i) => (
                <span key={i} className="ml-1">
                  {i > 0 && <span className="text-gray-500 mx-1">·</span>}
                  <span className="text-blue-200">{term}</span>
                </span>
              ))}
            </p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
              <span>共找到 <strong className="text-white">{total}</strong> 条结果</span>
              {source && <span className="text-gray-500">（筛选: {source}）</span>}
            </div>

            <div className="space-y-3">
              {results.map((r, i) => (
                <ResultCard key={`${r.source}-${r.id}-${i}`} result={r} keyword={query} />
              ))}
            </div>

            {/* Load more or pagination */}
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => doSearch(query, page + 1)}
                  disabled={loading}
                  className="px-8 py-3 bg-white/10 text-white rounded-xl font-medium
                             hover:bg-white/20 disabled:opacity-50 transition-all"
                >
                  {loading ? '加载中...' : `加载更多（${total - (page + 1) * PAGE_SIZE} 条剩余）`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
