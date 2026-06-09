'use client';

// 🏭 SEO Content Factory — 内容工厂仪表盘
// 全链路：话题发现 → 批量生成 → 草稿管理 → 排期发布 → 追踪效果

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ==============================
// Types
// ==============================

interface Plan {
  id: number;
  keyword: string;
  title_suggestion: string;
  description: string;
  style: string;
  category: string;
  status: 'planned' | 'generating' | 'draft' | 'scheduled' | 'published';
  blog_post_id: number | null;
  scheduled_for: string | null;
  priority: number;
  created_at: string;
  post_title: string | null;
  post_status: string | null;
  post_views: number | null;
  post_slug: string | null;
  post_published_at: string | null;
}

interface PipelineStats {
  planned_count: number;
  generating_count: number;
  draft_count: number;
  scheduled_count: number;
  published_count: number;
  total_count: number;
}

interface CategoryStat {
  category: string;
  planned: number;
  draft: number;
  published: number;
  total: number;
}

interface PerformanceStats {
  totalPublished: number;
  totalViews: number;
  recentPosts30d: number;
  topPosts: Array<{ id: number; title: string; slug: string; view_count: number; category: string; }>;
}

interface Stats {
  pipeline: PipelineStats;
  categories: CategoryStat[];
  performance: PerformanceStats;
  funnel: Record<string, number>;
}

// ==============================
// Helpers
// ==============================

const STYLE_LABELS = { tutorial: '📚 教程', listicle: '📋 清单', analysis: '🔬 深度', story: '📖 故事', opinion: '💡 观点' };
const STATUS_CONFIG = {
  planned: { label: '待生成', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: '📝' },
  generating: { label: '生成中', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: '⚙️' },
  draft: { label: '草稿', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: '📄' },
  scheduled: { label: '已排期', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: '📅' },
  published: { label: '已发布', color: 'bg-green-100 text-green-700 border-green-300', icon: '✅' },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function pluralize(count, unit) {
  return `${count} ${unit}${count !== 1 ? '' : ''}`;
}

// ==============================
// Main Component
// ==============================

export default function ContentFactoryPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'queue' | 'discover' | 'stats'>('queue');
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoverPreview, setDiscoverPreview] = useState<Array<{ keyword: string; suggestedTitle: string; suggestedCategory: string; suggestedStyle: string }> | null>(null);
  const [batchCount, setBatchCount] = useState(3);

  // Stats panel
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  // Schedule modal
  const [scheduleModal, setScheduleModal] = useState<{ planId: number; show: boolean }>({ planId: 0, show: false });
  const [scheduleDate, setScheduleDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200', stats: 'true', categories: 'true' });
      if (statusFilter) params.set('status', statusFilter);

      const [queueRes, statsRes] = await Promise.all([
        fetch(`/api/content-factory/queue?${params}`),
        fetch('/api/content-factory/stats'),
      ]);

      if (!queueRes.ok || !statsRes.ok) throw new Error('加载失败');

      const queueData = await queueRes.json();
      const statsData = await statsRes.json();

      setPlans(queueData.plans || []);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==============================
  // Actions
  // ==============================

  async function handleDiscover() {
    setDiscovering(true);
    setMessage('');
    try {
      const res = await fetch('/api/content-factory/discover');
      if (!res.ok) throw new Error('发现话题失败');
      const data = await res.json();
      setDiscoverPreview(data.previews || []);
      setMessage(data.message);
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setDiscovering(false);
    }
  }

  async function handleCreatePlans() {
    setDiscovering(true);
    setMessage('');
    try {
      const res = await fetch('/api/content-factory/discover', { method: 'POST' });
      if (!res.ok) throw new Error('创建选题失败');
      const data = await res.json();
      setDiscoverPreview(null);
      setMessage(`✅ ${data.message}`);
      loadData();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setDiscovering(false);
    }
  }

  async function handleGenerateSingle(planId: number) {
    setGenerating(true);
    setMessage('');
    try {
      const res = await fetch('/api/content-factory/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '生成失败');
      }
      const data = await res.json();
      setMessage(`✅ ${data.message}`);
      loadData();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleBatchGenerate() {
    setGenerating(true);
    setMessage('');
    try {
      const res = await fetch('/api/content-factory/generate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: batchCount }),
      });
      if (!res.ok) throw new Error('批量生成失败');
      const data = await res.json();
      setMessage(`✅ ${data.message}`);
      loadData();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeletePlan(planId: number) {
    if (!confirm('确定要删除这个选题吗？')) return;
    setMessage('');
    try {
      const res = await fetch(`/api/content-factory/queue?id=${planId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      setMessage('✅ 选题已删除');
      loadData();
    } catch (err) {
      setMessage('❌ ' + err.message);
    }
  }

  function openSchedule(planId: number) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleDate(tomorrow.toISOString().split('T')[0]);
    setScheduleModal({ planId, show: true });
  }

  async function handleSchedule() {
    if (!scheduleDate) return;
    setMessage('');
    try {
      const res = await fetch('/api/content-factory/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scheduleModal.planId,
          scheduledFor: new Date(scheduleDate + 'T08:00:00Z').toISOString(),
        }),
      });
      if (!res.ok) throw new Error('排期失败');
      setMessage('✅ 已排期发布');
      setScheduleModal({ planId: 0, show: false });
      loadData();
    } catch (err) {
      setMessage('❌ ' + err.message);
    }
  }

  async function handlePublish(postId: number, planId: number) {
    if (!confirm('确定要立即发布这篇文章吗？')) return;
    setMessage('');
    try {
      const res = await fetch(`/api/blog/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      if (!res.ok) throw new Error('发布失败');
      // Update plan status
      await fetch('/api/content-factory/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: planId, status: 'published' }),
      });
      setMessage('✅ 文章已发布');
      loadData();
    } catch (err) {
      setMessage('❌ ' + err.message);
    }
  }

  // ==============================
  // Render
  // ==============================

  const pipelineCards = stats ? [
    { label: '📝 待生成', count: stats.pipeline.planned_count, color: 'bg-gray-50 border-gray-200' },
    { label: '⚙️ 生成中', count: stats.pipeline.generating_count, color: 'bg-blue-50 border-blue-200' },
    { label: '📄 草稿', count: stats.pipeline.draft_count, color: 'bg-yellow-50 border-yellow-200' },
    { label: '📅 已排期', count: stats.pipeline.scheduled_count, color: 'bg-purple-50 border-purple-200' },
    { label: '✅ 已发布', count: stats.pipeline.published_count, color: 'bg-green-50 border-green-200' },
  ] : [];

  const filteredPlans = plans;
  const plannedPlans = filteredPlans.filter(p => p.status === 'planned');
  const draftPlans = filteredPlans.filter(p => p.status === 'draft');
  const scheduledPlans = filteredPlans.filter(p => p.status === 'scheduled');
  const publishedPlans = filteredPlans.filter(p => p.status === 'published');
  const generatingPlans = filteredPlans.filter(p => p.status === 'generating');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <nav className="bg-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-teal-200 hover:text-white text-sm">← 首页</Link>
          <span className="text-teal-400 mx-1">|</span>
          <span className="font-bold text-lg">🏭 内容工厂</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/blog/admin"
            className="text-teal-200 hover:text-white text-xs sm:text-sm transition-colors"
          >
            📝 博客管理
          </Link>
          <Link
            href="/content-factory"
            className="text-white bg-teal-700 px-3 py-1 rounded text-xs sm:text-sm"
          >
            内容工厂
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Global message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200'
            : message.startsWith('❌') ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
            ❌ {error}
            <button onClick={loadData} className="ml-2 underline hover:no-underline">重试</button>
          </div>
        )}

        {/* Pipeline Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {pipelineCards.map(card => (
              <div key={card.label} className={`${card.color} border rounded-lg p-3 sm:p-4 text-center`}>
                <div className="text-2xl sm:text-3xl font-bold text-gray-800">{card.count}</div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Main tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {[
            { key: 'queue', label: '📋 内容队列' },
            { key: 'discover', label: '🔍 话题发现' },
            { key: 'stats', label: '📊 数据看板' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 sm:px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ==================== TAB: Queue ==================== */}
        {activeTab === 'queue' && (
          <div>
            {/* Filters & Actions */}
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <div className="flex gap-1 flex-wrap">
                {['', 'planned', 'draft', 'scheduled', 'published'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      statusFilter === s
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {s === '' ? '全部' : STATUS_CONFIG[s]?.label || s}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={batchCount}
                  onChange={e => setBatchCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 3)))}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                />
                <button
                  onClick={handleBatchGenerate}
                  disabled={generating || !plannedPlans.length}
                  className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generating ? '⏳ 生成中...' : '🚀 批量生成'}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">⏳</div>
                <div>加载内容队列...</div>
              </div>
            ) : filteredPlans.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                <div className="text-5xl mb-3">📭</div>
                <div className="text-gray-500 mb-2">内容队列为空</div>
                <p className="text-sm text-gray-400 mb-4">
                  切换到「话题发现」标签，从关键词数据中发现内容机会
                </p>
                <button
                  onClick={() => setActiveTab('discover')}
                  className="text-teal-600 hover:text-teal-700 text-sm underline"
                >
                  🔍 发现话题 →
                </button>
              </div>
            ) : (
              /* Content Queue Table */
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2.5 font-medium text-gray-600">状态</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-600">关键词 / 标题</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-600 hidden sm:table-cell">分类</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-600 hidden md:table-cell">风格</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-600 hidden lg:table-cell">创建时间</th>
                        <th className="text-right px-3 py-2.5 font-medium text-gray-600">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPlans.map(plan => {
                        const sc = STATUS_CONFIG[plan.status] || STATUS_CONFIG.planned;
                        return (
                          <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${sc.color}`}>
                                {sc.icon} {sc.label}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-medium text-gray-800">
                                {plan.title_suggestion || plan.keyword}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {plan.keyword}
                                {plan.post_title && <span className="ml-2 text-teal-500">→ {plan.post_title.substring(0, 40)}...</span>}
                              </div>
                              {plan.status === 'published' && plan.post_views !== null && (
                                <div className="text-xs text-green-600 mt-0.5">
                                  👁️ {plan.post_views} 次浏览
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-gray-500 hidden sm:table-cell">
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{plan.category}</span>
                            </td>
                            <td className="px-3 py-3 text-gray-500 hidden md:table-cell">
                              {STYLE_LABELS[plan.style] || plan.style}
                            </td>
                            <td className="px-3 py-3 text-gray-400 text-xs hidden lg:table-cell">
                              {formatDate(plan.created_at)}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex gap-1 justify-end flex-wrap">
                                {plan.status === 'planned' && (
                                  <>
                                    <button
                                      onClick={() => handleGenerateSingle(plan.id)}
                                      disabled={generating}
                                      className="px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 transition-colors"
                                    >
                                      生成
                                    </button>
                                    <button
                                      onClick={() => openSchedule(plan.id)}
                                      className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                                    >
                                      排期
                                    </button>
                                  </>
                                )}
                                {plan.status === 'draft' && plan.blog_post_id && (
                                  <>
                                    <Link
                                      href={`/blog/admin/${plan.blog_post_id}`}
                                      className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                                    >
                                      编辑
                                    </Link>
                                    <button
                                      onClick={() => handlePublish(plan.blog_post_id!, plan.id)}
                                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                    >
                                      发布
                                    </button>
                                    <button
                                      onClick={() => openSchedule(plan.id)}
                                      className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                                    >
                                      排期
                                    </button>
                                  </>
                                )}
                                {plan.status === 'scheduled' && (
                                  <span className="text-xs text-purple-600 px-2">
                                    📅 {plan.scheduled_for ? formatDate(plan.scheduled_for) : ''}
                                  </span>
                                )}
                                {plan.status === 'published' && plan.post_slug && (
                                  <Link
                                    href={`/blog/${plan.post_slug}`}
                                    target="_blank"
                                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                  >
                                    查看
                                  </Link>
                                )}
                                {plan.status !== 'published' && (
                                  <button
                                    onClick={() => handleDeletePlan(plan.id)}
                                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary */}
            {!loading && filteredPlans.length > 0 && (
              <div className="mt-3 text-xs text-gray-400 text-right">
                共 {filteredPlans.length} 个选题
                {plannedPlans.length > 0 && ` · ${plannedPlans.length} 个待生成`}
                {draftPlans.length > 0 && ` · ${draftPlans.length} 个草稿`}
                {generatingPlans.length > 0 && ` · ${generatingPlans.length} 个生成中`}
                {scheduledPlans.length > 0 && ` · ${scheduledPlans.length} 个已排期`}
                {publishedPlans.length > 0 && ` · ${publishedPlans.length} 个已发布`}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: Discover ==================== */}
        {activeTab === 'discover' && (
          <div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">🔍 从关键词发现内容机会</h2>
              <p className="text-sm text-gray-500 mb-4">
                扫描已保存的关键词数据，找出还没有对应内容选题的关键词，一键批量创建选题计划。
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDiscover}
                  disabled={discovering}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {discovering ? '⏳ 扫描中...' : '🔍 扫描关键词'}
                </button>
                {discoverPreview && discoverPreview.length > 0 && (
                  <button
                    onClick={handleCreatePlans}
                    disabled={discovering}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    📥 导入所有选题 ({discoverPreview.length})
                  </button>
                )}
              </div>
            </div>

            {/* Discover Preview */}
            {discoverPreview === null && !discovering && (
              <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
                <div className="text-5xl mb-3">🔍</div>
                <div className="text-gray-500">点击「扫描关键词」查看可发现的内容机会</div>
              </div>
            )}

            {discovering && discoverPreview === null && (
              <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
                <div className="text-4xl mb-3 animate-pulse">⏳</div>
                <div className="text-gray-500">正在扫描关键词数据...</div>
              </div>
            )}

            {discoverPreview && discoverPreview.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                <div className="text-5xl mb-3">🎉</div>
                <div className="text-gray-500 mb-1">没有新的关键词内容机会</div>
                <p className="text-sm text-gray-400">所有已保存的关键词都已有对应的选题计划了</p>
              </div>
            )}

            {discoverPreview && discoverPreview.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    预览 ({discoverPreview.length} 个可导入选题)
                  </span>
                  <span className="text-xs text-gray-400">点击「导入所有选题」创建到队列</span>
                </div>
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {discoverPreview.map((item, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-700">{item.keyword}</span>
                          <div className="text-xs text-gray-400 mt-0.5 max-w-xl truncate">
                            {item.suggestedTitle}
                          </div>
                        </div>
                        <div className="flex gap-2 items-center shrink-0">
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{item.suggestedCategory}</span>
                          <span className="text-xs text-gray-400">
                            {STYLE_LABELS[item.suggestedStyle] || item.suggestedStyle}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: Stats ==================== */}
        {activeTab === 'stats' && (
          <div>
            {!stats ? (
              <div className="text-center py-12 text-gray-500">加载中...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Performance Overview */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">📈 内容表现</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-700">
                        {stats.performance.totalPublished}
                      </div>
                      <div className="text-xs text-green-600">已发布文章</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-700">
                        {stats.performance.totalViews.toLocaleString()}
                      </div>
                      <div className="text-xs text-blue-600">总浏览</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-purple-700">
                        {stats.performance.recentPosts30d}
                      </div>
                      <div className="text-xs text-purple-600">近30天发布</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-amber-700">
                        {stats.pipeline.planned_count}
                      </div>
                      <div className="text-xs text-amber-600">待生成选题</div>
                    </div>
                  </div>
                </div>

                {/* Pipeline Funnel */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">🔄 内容管线</h3>
                  <div className="space-y-2">
                    {[
                      { label: '已规划', count: stats.funnel.planned_total || stats.pipeline.total_count, color: 'bg-gray-200' },
                      { label: '待生成', count: stats.pipeline.planned_count, color: 'bg-gray-400' },
                      { label: '待发布', count: (stats.pipeline.draft_count + stats.pipeline.scheduled_count), color: 'bg-yellow-400' },
                      { label: '已发布', count: stats.pipeline.published_count, color: 'bg-green-400' },
                    ].map((item, i) => {
                      const maxVal = Math.max(item.count, 1);
                      const total = Math.max(stats.funnel.planned_total || 1, 1);
                      const pct = Math.round((item.count / total) * 100);
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{item.label}</span>
                            <span>{item.count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className={`${item.color} h-2 rounded-full transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Posts */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 md:col-span-2">
                  <h3 className="font-semibold text-gray-800 mb-3">🏆 热门文章 Top 10</h3>
                  {stats.performance.topPosts.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">暂无已发布文章</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left px-2 py-2 text-gray-500 font-medium">#</th>
                            <th className="text-left px-2 py-2 text-gray-500 font-medium">标题</th>
                            <th className="text-right px-2 py-2 text-gray-500 font-medium">浏览</th>
                            <th className="text-left px-2 py-2 text-gray-500 font-medium hidden sm:table-cell">分类</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {stats.performance.topPosts.map((post, i) => (
                            <tr key={post.id} className="hover:bg-gray-50">
                              <td className="px-2 py-2 text-gray-400">{i + 1}</td>
                              <td className="px-2 py-2">
                                <Link
                                  href={`/blog/${post.slug}`}
                                  target="_blank"
                                  className="text-teal-700 hover:text-teal-800 hover:underline"
                                >
                                  {post.title?.substring(0, 50)}{post.title?.length > 50 ? '...' : ''}
                                </Link>
                              </td>
                              <td className="px-2 py-2 text-right font-medium">{post.view_count}</td>
                              <td className="px-2 py-2 text-gray-500 hidden sm:table-cell">
                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{post.category}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Category Breakdown */}
                {stats.categories.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4 md:col-span-2">
                    <h3 className="font-semibold text-gray-800 mb-3">📂 分类分布</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {stats.categories.map(cat => {
                        const pct = cat.total > 0 ? Math.round((cat.published / cat.total) * 100) : 0;
                        return (
                          <div key={cat.category} className="border border-gray-200 rounded-lg p-3">
                            <div className="font-medium text-gray-700 text-sm mb-2">{cat.category}</div>
                            <div className="flex gap-2 text-xs">
                              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">📄 {cat.planned}</span>
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">📝 {cat.draft}</span>
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">✅ {cat.published}</span>
                            </div>
                            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                              <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="text-xs text-gray-400 mt-1">完成度 {pct}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== Schedule Modal ==================== */}
      {scheduleModal.show && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setScheduleModal({ planId: 0, show: false })}>
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-3">📅 设置排期</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">选择发布日期</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <p className="text-xs text-gray-400 mb-4">文章将在选定的日期上午8:00自动发布</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setScheduleModal({ planId: 0, show: false })}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSchedule}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                确认排期
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
