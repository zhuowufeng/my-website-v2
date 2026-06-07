/**
 * /keyword-research — 关键词挖掘工具
 * 🔑 壁垒产品：爬取多源搜索建议聚合分析，不是AI能替代的
 * 
 * 功能：
 * - 输入种子关键词 → 获取百度/Google搜索建议
 * - 深挖二级扩展关键词
 * - 收藏/导出CSV
 * - 研究历史记录
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import AdBanner from '@/components/AdBanner';
import ShareButton from '@/components/ShareButton';

// ============ Types ============

interface KeywordResult {
  seedKeyword: string;
  totalKeywords: number;
  baiduKeywords: string[];
  googleKeywords: string[];
  expandedKeywords: string[];
  fetchedAt: string;
  saved?: { id: number; created_at: string } | null;
}

interface HistoryItem {
  id: number;
  seed_keyword: string;
  keyword_count: number;
  is_favorite: boolean;
  created_at: string;
}

interface Stats {
  total_searches: number;
  total_keywords_found: number;
  favorites: number;
}

// ============ Header Component ============

function PageHeader() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">关键词挖掘工具</h1>
            <p className="text-xs text-gray-500">Keyword Research Tool</p>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============ Stats Card ============

function StatsCard({ stats }: { stats: Stats | null }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div className="text-2xl font-bold text-violet-600">{stats.total_searches}</div>
        <div className="text-xs text-gray-500 mt-1">总搜索次数</div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div className="text-2xl font-bold text-blue-600">{stats.total_keywords_found}</div>
        <div className="text-xs text-gray-500 mt-1">发现关键词</div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div className="text-2xl font-bold text-emerald-600">{stats.favorites}</div>
        <div className="text-xs text-gray-500 mt-1">收藏</div>
      </div>
    </div>
  );
}

// ============ Keyword Card Grid ============

function KeywordCard({ keyword, source, onSave }: { 
  keyword: string; 
  source: 'baidu' | 'google' | 'expanded';
  onSave: (kw: string) => void;
}) {
  const sourceColors = {
    baidu: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', label: '百度' },
    google: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', label: '谷歌' },
    expanded: { bg: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700', label: '扩展' },
  };
  const s = sourceColors[source];

  return (
    <div className={`${s.bg} border rounded-lg p-3 flex items-center justify-between group hover:shadow-md transition-all`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.badge} shrink-0`}>
          {s.label}
        </span>
        <span className="text-sm text-gray-800 truncate">{keyword}</span>
      </div>
      <button
        onClick={() => onSave(keyword)}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/60 rounded"
        title="保存关键词"
      >
        <svg className="w-4 h-4 text-gray-400 hover:text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  );
}

// ============ Results Section ============

function ResultsSection({ result, onSaveKeyword }: {
  result: KeywordResult | null;
  onSaveKeyword: (kw: string) => void;
}) {
  if (!result) return null;

  const allCount = result.baiduKeywords.length + result.googleKeywords.length + result.expandedKeywords.length;
  if (allCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">没有找到相关关键词</h3>
        <p className="text-sm text-gray-500">试试换个更具体的关键词搜索</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">
              以 &ldquo;<span className="text-violet-600">{result.seedKeyword}</span>&rdquo; 为基础
            </h3>
            <p className="text-xs text-gray-500">找到 <strong>{result.totalKeywords}</strong> 个相关关键词</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportCSV(result)}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              导出CSV
            </button>
          </div>
        </div>

        {/* Source breakdown */}
        <div className="flex gap-4 text-xs text-gray-500">
          <span>🔵 百度建议: {result.baiduKeywords.length}</span>
          <span>🟡 谷歌建议: {result.googleKeywords.length}</span>
          <span>🟣 深度扩展: {result.expandedKeywords.length}</span>
        </div>
      </div>

      {/* Baidu keywords */}
      {result.baiduKeywords.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            百度搜索建议 ({result.baiduKeywords.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.baiduKeywords.map((kw, i) => (
              <KeywordCard key={`bd-${i}`} keyword={kw} source="baidu" onSave={onSaveKeyword} />
            ))}
          </div>
        </div>
      )}

      {/* Google keywords */}
      {result.googleKeywords.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            谷歌搜索建议 ({result.googleKeywords.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.googleKeywords.map((kw, i) => (
              <KeywordCard key={`gg-${i}`} keyword={kw} source="google" onSave={onSaveKeyword} />
            ))}
          </div>
        </div>
      )}

      {/* Expanded keywords */}
      {result.expandedKeywords.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            深度扩展关键词 ({result.expandedKeywords.length})
          </h4>
          <p className="text-xs text-gray-400 mb-2">基于前3个百度建议进一步挖掘</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.expandedKeywords.map((kw, i) => (
              <KeywordCard key={`ex-${i}`} keyword={kw} source="expanded" onSave={onSaveKeyword} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ History Sidebar ============

function HistorySection({ history, onLoad, onToggleFavorite, onDelete }: {
  history: HistoryItem[];
  onLoad: (keyword: string) => void;
  onToggleFavorite: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">搜索历史</h3>
      <div className="space-y-2">
        {history.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 group">
            <button
              onClick={() => onLoad(item.seed_keyword)}
              className="text-sm text-gray-700 hover:text-violet-600 truncate flex-1 text-left"
            >
              {item.seed_keyword}
              <span className="text-xs text-gray-400 ml-2">({item.keyword_count}个)</span>
            </button>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onToggleFavorite(item.id)}
                className={`p-1 rounded ${item.is_favorite ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}`}
                title={item.is_favorite ? '取消收藏' : '收藏'}
              >
                <svg className="w-3.5 h-3.5" fill={item.is_favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="p-1 rounded text-gray-300 hover:text-red-500"
                title="删除"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Export CSV ============

function exportCSV(result: KeywordResult) {
  const rows: string[] = ['关键词,来源,类型'];
  
  result.baiduKeywords.forEach(kw => rows.push(`"${kw}",baidu,搜索建议`));
  result.googleKeywords.forEach(kw => rows.push(`"${kw}",google,搜索建议`));
  result.expandedKeywords.forEach(kw => rows.push(`"${kw}",baidu,深度扩展`));

  const csv = rows.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `keywords-${result.seedKeyword}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============ Loading Skeleton ============

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 bg-gray-100 rounded-xl"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg"></div>
        ))}
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function KeywordResearchPage() {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch('/api/keyword-research');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
        setStats(data.stats || null);
      }
    } catch {
      // silently fail - user might not be logged in
    }
  }

  const doResearch = useCallback(async (searchKeyword?: string) => {
    const kw = (searchKeyword || keyword).trim();
    if (!kw) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/keyword-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '研究失败');
      }

      const data = await res.json();
      setResult(data);
      setKeyword(kw);
      fetchHistory(); // refresh history
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  async function handleToggleFavorite(id: number) {
    try {
      const res = await fetch(`/api/keyword-research/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-favorite' }),
      });
      if (res.ok) fetchHistory();
    } catch {}
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/keyword-research/${id}`, { method: 'DELETE' });
      if (res.ok) fetchHistory();
    } catch {}
  }

  async function handleSaveKeyword(kw: string) {
    try {
      const res = await fetch('/api/keyword-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw }),
      });
      if (res.ok) {
        setSuccessMsg(`已保存: ${kw}`);
        setTimeout(() => setSuccessMsg(''), 2000);
      } else {
        const data = await res.json();
        if (data.error === '请先登录') {
          setError('请先登录才能保存关键词');
        }
      }
    } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !loading) doResearch();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <PageHeader />

      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
        {/* Search Input */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            输入种子关键词
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例如：SEO优化、网站推广、减肥..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-sm transition-all"
              disabled={loading}
            />
            <button
              onClick={() => doResearch()}
              disabled={loading || !keyword.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl font-medium
                         hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all shadow-sm text-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  挖掘中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  挖掘
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              ✅ {successMsg}
            </div>
          )}

          {/* Toggle History */}
          {stats && stats.total_searches > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="mt-3 text-xs text-gray-500 hover:text-violet-600 flex items-center gap-1"
            >
              <svg className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {showHistory ? '隐藏历史' : `查看搜索历史 (${stats.total_searches}次)`}
            </button>
          )}
        </div>

        {/* Stats + History */}
        {showHistory && stats && (
          <div className="mb-6">
            <StatsCard stats={stats} />
            <HistorySection
              history={history}
              onLoad={(kw) => { setKeyword(kw); doResearch(kw); }}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDelete}
            />
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Results */}
        {!loading && result && <ResultsSection result={result} onSaveKeyword={handleSaveKeyword} />}

        {/* Empty State */}
        {!loading && !result && !error && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔑</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">关键词挖掘工具</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
              输入一个种子关键词，自动从百度搜索建议和谷歌搜索建议中挖掘相关长尾关键词，
              帮你发现更多流量机会。
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['SEO优化', '网站推广', '减肥方法', 'AI写作', '副业赚钱'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => { setKeyword(tag); doResearch(tag); }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 text-gray-600 rounded-full text-xs border border-gray-200 transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ad Banner */}
        <div className="mt-8">
          <AdBanner />
        </div>
      </main>
    </div>
  );
}
