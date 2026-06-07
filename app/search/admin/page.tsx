/**
 * /search/admin — 搜索管理仪表盘（中级功能）
 * 模块14：搜索能力
 *
 * 功能：搜索统计、同义词管理、索引管理、零结果分析
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ============ Types ============

interface SearchStats {
  totalSearches: number;
  uniqueUsers: number;
  avgResultsPerSearch: number;
  topKeywords: { keyword: string; searchCount: number; avgResults: number; lastSearched: string }[];
}

interface TodayStats {
  todaySearches: number;
  todayUsers: number;
  todayZeroResults: number;
  topResults: { keyword: string; resultCount: number }[];
  hourlyDistribution: { hour: number; count: number }[];
}

interface PopularSearches {
  weekly: { keyword: string; count: number }[];
  monthly: { keyword: string; count: number }[];
  trending: { keyword: string; weeklyCount: number; prevCount: number; growthPct: number }[];
}

interface ZeroResultAnalysis {
  topMissingTerms: { keyword: string; count: number; lastSearched: string }[];
  bySource: { source: string; count: number }[];
}

interface Synonym {
  id: number;
  word: string;
  synonyms: string[];
  enabled: boolean;
}

interface IndexStatus {
  entity_type: string;
  entity_count: number;
  index_version: number;
  last_indexed_at: string;
}

// ============ Tab Component ============

function TabBar({ tabs, active, onChange }: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-white/10 mb-6 overflow-x-auto">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
            ${active === tab.key
              ? 'text-blue-300 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-500'
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ============ Stat Card ============

function StatCard({ label, value, sub, color }: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ============ Hourly Chart ============

function HourlyChart({ data }: { data: { hour: number; count: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <h3 className="text-sm font-medium text-gray-400 mb-3">📊 今日搜索时段分布</h3>
      <div className="flex items-end gap-1 h-24">
        {Array.from({ length: 24 }, (_, h) => {
          const point = data.find(d => d.hour === h);
          const count = point?.count || 0;
          const height = (count / maxVal) * 100;
          return (
            <div key={h} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              <div
                className="w-full bg-blue-500/30 rounded-t hover:bg-blue-500/50 transition-all"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${h}:00 — ${count}次`}
              />
              {h % 4 === 0 && (
                <span className="text-[8px] text-gray-600">{h}:00</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Trending Badge ============

function TrendingBadge({ pct }: { pct: number }) {
  if (pct > 50) return <span className="text-green-400 text-xs">🔥 +{pct}%</span>;
  if (pct > 0) return <span className="text-green-500/70 text-xs">+{pct}%</span>;
  if (pct === 0) return <span className="text-gray-500 text-xs">0%</span>;
  return <span className="text-red-400 text-xs">{pct}%</span>;
}

// ============ Synonym Manager ============

function SynonymManager() {
  const [synonyms, setSynonyms] = useState<Synonym[]>([]);
  const [loading, setLoading] = useState(true);
  const [word, setWord] = useState('');
  const [synList, setSynList] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/search/synonyms');
      const data = await res.json();
      setSynonyms(data.synonyms || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!word.trim() || !synList.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/search/synonyms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: word.trim(),
          synonyms: synList.split(',').map(s => s.trim()).filter(Boolean),
        }),
      });
      setWord('');
      setSynList('');
      setEditingId(null);
      await load();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除？')) return;
    try {
      await fetch(`/api/search/synonyms?id=${id}`, { method: 'DELETE' });
      await load();
    } catch { /* ignore */ }
  };

  const handleEdit = (syn: Synonym) => {
    setWord(syn.word);
    setSynList(syn.synonyms.join(', '));
    setEditingId(syn.id);
  };

  if (loading) return <div className="text-gray-400 text-sm p-4">加载中...</div>;

  return (
    <div className="space-y-4">
      {/* Add/Edit Form */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">
          {editingId ? '✏️ 编辑同义词' : '➕ 新增同义词'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">关键词</label>
            <input
              type="text"
              value={word}
              onChange={e => setWord(e.target.value)}
              placeholder="如: seo"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white
                         text-sm outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">同义词（逗号分隔）</label>
            <input
              type="text"
              value={synList}
              onChange={e => setSynList(e.target.value)}
              placeholder="搜索引擎优化, 搜索引擎, 排名"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white
                         text-sm outline-none focus:border-blue-500/50"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !word.trim() || !synList.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500
                       disabled:opacity-50 transition-all"
          >
            {saving ? '保存中...' : editingId ? '更新' : '添加'}
          </button>
          {editingId && (
            <button
              onClick={() => { setWord(''); setSynList(''); setEditingId(null); }}
              className="px-4 py-2 bg-white/10 text-gray-300 text-sm rounded-lg hover:bg-white/20"
            >
              取消
            </button>
          )}
        </div>
      </div>

      {/* Synonym List */}
      {synonyms.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-8">暂无同义词配置</div>
      ) : (
        <div className="space-y-2">
          {synonyms.map(syn => (
            <div
              key={syn.id}
              className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/10"
            >
              <div className="flex-1">
                <span className="text-sm font-medium text-white">{syn.word}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {syn.synonyms.map((s, i) => (
                    <span key={i} className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(syn)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(syn.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Index Manager ============

function IndexManager() {
  const [status, setStatus] = useState<IndexStatus[]>([]);
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/search/rebuild-index');
      const data = await res.json();
      setStatus(data.indexes || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleRebuild = async () => {
    if (!confirm('重建索引可能需要几秒到几分钟，确认执行？')) return;
    setBuilding(true);
    setBuildResult(null);
    try {
      const res = await fetch('/api/search/rebuild-index', { method: 'POST' });
      const data = await res.json();
      setBuildResult(data.summary || (data.success ? '✅ 重建完成' : '❌ 部分失败'));
      await loadStatus();
    } catch { /* ignore */ }
    setBuilding(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-300">🗃️ 搜索索引状态</h3>
          <button
            onClick={handleRebuild}
            disabled={building}
            className="px-4 py-2 bg-yellow-600/50 text-yellow-300 text-sm rounded-lg
                       hover:bg-yellow-600/70 disabled:opacity-50 transition-all"
          >
            {building ? '重建中...' : '重建索引'}
          </button>
        </div>

        {buildResult && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-300 mb-4">
            {buildResult}
          </div>
        )}

        {status.length === 0 ? (
          <div className="text-gray-500 text-sm">暂无索引数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-white/10">
                  <th className="pb-2 pr-4">实体类型</th>
                  <th className="pb-2 pr-4">记录数</th>
                  <th className="pb-2 pr-4">索引版本</th>
                  <th className="pb-2">最后索引时间</th>
                </tr>
              </thead>
              <tbody>
                {status.map(idx => (
                  <tr key={idx.entity_type} className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white">{idx.entity_type}</td>
                    <td className="py-2 pr-4 text-gray-300">{idx.entity_count}</td>
                    <td className="py-2 pr-4 text-gray-300">v{idx.index_version}</td>
                    <td className="py-2 text-gray-400">
                      {new Date(idx.last_indexed_at).toLocaleString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Main Admin Page ============

export default function SearchAdminPage() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [today, setToday] = useState<TodayStats | null>(null);
  const [popular, setPopular] = useState<PopularSearches | null>(null);
  const [zeroResults, setZeroResults] = useState<ZeroResultAnalysis | null>(null);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setError('');
    try {
      const [statsRes, todayRes, popularRes, zeroRes] = await Promise.all([
        fetch('/api/search/stats?type=overview'),
        fetch('/api/search/stats?type=today'),
        fetch('/api/search/stats?type=popular'),
        fetch('/api/search/stats?type=zero-results'),
      ]);
      setStats(await statsRes.json());
      setToday(await todayRes.json());
      setPopular(await popularRes.json());
      setZeroResults(await zeroRes.json());
    } catch {
      setError('获取统计数据失败，确保数据库已初始化');
    }
  };

  useEffect(() => {
    if (tab === 'overview' || tab === 'popular') fetchData();
  }, [tab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Header */}
      <div className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link href="/search" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">
            ← 返回搜索
          </Link>
          <h1 className="text-2xl font-bold text-white mb-1">🔍 搜索管理后台</h1>
          <p className="text-sm text-gray-400">搜索统计 · 同义词管理 · 索引管理 · 零结果分析</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <TabBar
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: '📊 总览' },
            { key: 'popular', label: '🔥 热门搜索' },
            { key: 'synonyms', label: '🔗 同义词管理' },
            { key: 'index', label: '🗃️ 索引管理' },
            { key: 'zero', label: '❌ 零结果分析' },
          ]}
        />

        {/* Tab Content */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm">
                {error}
                <button
                  onClick={fetchData}
                  className="ml-3 underline hover:text-red-200"
                >
                  重试
                </button>
              </div>
            )}

            {stats && (
              <>
                {/* Overview Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="总搜索次数" value={stats.totalSearches.toLocaleString()} color="text-blue-300" />
                  <StatCard label="搜索用户数" value={stats.uniqueUsers} color="text-green-300" />
                  <StatCard label="平均结果数" value={stats.avgResultsPerSearch.toFixed(1)} color="text-yellow-300" sub="每次搜索" />
                  {today && (
                    <StatCard label="今日搜索" value={today.todaySearches} color="text-purple-300" />
                  )}
                </div>

                {/* Hourly chart */}
                {today && today.hourlyDistribution.length > 0 && (
                  <HourlyChart data={today.hourlyDistribution} />
                )}

                {/* Top keywords */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">🏆 热门搜索关键词 TOP 10</h3>
                  <div className="space-y-1">
                    {stats.topKeywords.map((k, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-5">{i + 1}</span>
                          <span className="text-sm text-white">{k.keyword}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>{k.searchCount} 次搜索</span>
                          <span>平均 {k.avgResults} 条结果</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!stats && !error && (
              <div className="text-center py-16 text-gray-500">
                <p>加载统计数据中...</p>
              </div>
            )}
          </div>
        )}

        {tab === 'popular' && (
          <div className="space-y-6">
            {popular && (
              <>
                {/* Trending keywords */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">📈 搜索趋势（本周 vs 上周）</h3>
                  {popular.trending.length === 0 ? (
                    <p className="text-gray-500 text-sm">暂无趋势数据</p>
                  ) : (
                    <div className="space-y-1">
                      {popular.trending.map((t, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{i + 1}</span>
                            <span className="text-sm text-white">{t.keyword}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-400">{t.weeklyCount}次</span>
                            <TrendingBadge pct={t.growthPct} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weekly & Monthly */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">📅 本周热门</h3>
                    {popular.weekly.map((k, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <span className="text-sm text-gray-300">{k.keyword}</span>
                        <span className="text-xs text-gray-500">{k.count}次</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">📅 本月热门</h3>
                    {popular.monthly.map((k, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <span className="text-sm text-gray-300">{k.keyword}</span>
                        <span className="text-xs text-gray-500">{k.count}次</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'synonyms' && <SynonymManager />}
        {tab === 'index' && <IndexManager />}

        {tab === 'zero' && (
          <div className="space-y-4">
            {zeroResults ? (
              <>
                {/* Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <StatCard
                    label="零结果搜索词数量"
                    value={zeroResults.topMissingTerms.length}
                    color="text-red-300"
                  />
                  {today && (
                    <StatCard
                      label="今日零结果"
                      value={today.todayZeroResults}
                      color="text-orange-300"
                    />
                  )}
                </div>

                {/* Missing terms */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">❌ 用户搜不到的内容</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    这些关键词用户搜过但没找到结果。考虑补充相关内容增加流量机会！
                  </p>
                  <div className="space-y-1">
                    {zeroResults.topMissingTerms.map((t, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-5">{i + 1}</span>
                          <span className="text-sm text-white">{t.keyword}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {t.count}次搜索 · 最后: {new Date(t.lastSearched).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* By source */}
                {zeroResults.bySource.length > 0 && (
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">按来源分类</h3>
                    <div className="flex flex-wrap gap-2">
                      {zeroResults.bySource.map((s, i) => (
                        <span key={i} className="px-3 py-1.5 text-sm bg-white/10 text-gray-300 rounded-lg">
                          {s.source || '全部'}: {s.count}次
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 text-gray-500">加载中...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
