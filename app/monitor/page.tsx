/**
 * /monitor — 网站内容监控面板
 * 🚀 壁垒产品：定时爬取+内容比对+变化追踪
 *
 * 功能：
 * - 添加要监控的URL
 * - 自动检测变化（标题/描述/内容/状态码）
 * - 变化历史追踪
 * - 手动触发立即检查
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import AdBanner from '@/components/AdBanner';

// ============ Types ============

interface MonitoredSite {
  id: number;
  url: string;
  name: string;
  check_interval: string;
  is_active: boolean;
  last_checked: string | null;
  last_changed_at: string | null;
  change_count: number;
  last_status_code: number;
  created_at: string;
}

interface ChangeRecord {
  id: number;
  change_type: string;
  field_name: string;
  old_value: string;
  new_value: string;
  summary: string;
  detected_at: string;
}

interface SiteDetail extends MonitoredSite {
  snapshots: Array<{
    id: number;
    content_hash: string;
    title: string;
    word_count: number;
    status_code: number;
    fetch_time_ms: number;
    is_initial: boolean;
    checked_at: string;
  }>;
  changes: ChangeRecord[];
}

interface MonitorStats {
  total: number;
  active: number;
  total_changes: number;
  last_check_all: string | null;
}

interface RecentChange {
  id: number;
  change_type: string;
  field_name: string;
  summary: string;
  detected_at: string;
  url: string;
  site_name: string;
}

// ============ Helpers ============

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '从未';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}天前`;
  return d.toLocaleDateString('zh-CN');
}

function getStatusEmoji(code: number): string {
  if (code === 0) return '❓';
  if (code >= 200 && code < 300) return '✅';
  if (code >= 300 && code < 400) return '↪️';
  if (code >= 400 && code < 500) return '⚠️';
  if (code >= 500) return '❌';
  return '❓';
}

function getChangeTypeIcon(type: string): string {
  switch (type) {
    case 'title': return '📝';
    case 'meta_description': return '📋';
    case 'content': return '📄';
    case 'status_code': return '🔗';
    case 'h1_count': return '🏷️';
    default: return '🔔';
  }
}

// ============ Page Header ============

function PageHeader() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">网站内容监控</h1>
            <p className="text-xs text-gray-500">Website Change Monitor</p>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============ Stats Overview ============

function StatsOverview({ stats }: { stats: MonitorStats | null }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div className="text-2xl font-bold text-emerald-600">{stats.total}</div>
        <div className="text-xs text-gray-500 mt-1">总监控数</div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div className="text-2xl font-bold text-teal-600">{stats.active}</div>
        <div className="text-xs text-gray-500 mt-1">活跃中</div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div className="text-2xl font-bold text-amber-600">{stats.total_changes}</div>
        <div className="text-xs text-gray-500 mt-1">累计变化</div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
        <div className="text-sm font-bold text-gray-600">{stats.last_check_all ? formatTime(stats.last_check_all) : '—'}</div>
        <div className="text-xs text-gray-500 mt-1">最近检查</div>
      </div>
    </div>
  );
}

// ============ Add Site Form ============

function AddSiteForm({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '添加失败');
      } else {
        setUrl('');
        setName('');
        onAdded();
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">添加监控站点</h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
          required
        />
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="备注名称（可选）"
          className="sm:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all"
        >
          {loading ? '添加中...' : '➕ 添加监控'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </form>
  );
}

// ============ Site Card ============

function SiteCard({ site, onCheck, onDelete }: {
  site: MonitoredSite;
  onCheck: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${site.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {site.name || site.url}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate">{site.url}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-lg">{getStatusEmoji(site.last_status_code)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span>📊 {site.change_count} 次变化</span>
        <span>🕐 {formatTime(site.last_checked)}</span>
        <span>{site.is_active ? '🟢 活跃' : '⚪ 已停用'}</span>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onCheck(site.id)}
          className="flex-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-100 transition-colors"
        >
          🔄 立即检查
        </button>
        <button
          onClick={() => onDelete(site.id)}
          className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors"
        >
          🗑️ 移除
        </button>
      </div>
    </div>
  );
}

// ============ Site Detail Modal ============

function SiteDetailModal({ siteId, onClose }: { siteId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetail();
  }, [siteId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/monitor/${siteId}`);
      if (res.ok) {
        setDetail(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 sm:pt-20" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">站点详情</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400">加载中...</div>
        ) : detail ? (
          <div className="p-6 space-y-6">
            {/* 基本信息 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">基本信息</h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <p><span className="text-gray-500">URL：</span>{detail.url}</p>
                <p><span className="text-gray-500">名称：</span>{detail.name || '(无)'}</p>
                <p><span className="text-gray-500">状态码：</span>{getStatusEmoji(detail.last_status_code)} {detail.last_status_code || '未知'}</p>
                <p><span className="text-gray-500">检查间隔：</span>{detail.check_interval}</p>
                <p><span className="text-gray-500">累计变化：</span>{detail.change_count}</p>
              </div>
            </div>

            {/* 最近快照 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">最近快照</h3>
              {detail.snapshots.length === 0 ? (
                <p className="text-xs text-gray-400">暂无快照</p>
              ) : (
                <div className="space-y-2">
                  {detail.snapshots.map((s, i) => (
                    <div key={s.id} className="bg-gray-50 rounded-lg p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{i === 0 ? '🆕 最新' : `#${i + 1}`}</span>
                        <span className="text-gray-500">{formatTime(s.checked_at)}</span>
                        {s.is_initial && <span className="text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">初始</span>}
                      </div>
                      <p className="text-gray-600 mt-1">标题：{s.title || '(空)'}</p>
                      <p className="text-gray-400">字数：{s.word_count} | 状态：{s.status_code} | 耗时：{s.fetch_time_ms}ms</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 变化记录 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">变化记录</h3>
              {detail.changes.length === 0 ? (
                <p className="text-xs text-gray-400">暂无变化记录</p>
              ) : (
                <div className="space-y-2">
                  {detail.changes.map(c => (
                    <div key={c.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span>{getChangeTypeIcon(c.change_type)}</span>
                        <span className="font-medium text-gray-800">{c.field_name}</span>
                        <span className="text-gray-400 ml-auto">{formatTime(c.detected_at)}</span>
                      </div>
                      <p className="text-gray-600 mt-1">{c.summary}</p>
                      {c.change_type === 'title' && (
                        <div className="mt-1.5 space-y-0.5">
                          <p className="text-gray-400 line-through">{c.old_value.substring(0, 100)}</p>
                          <p className="text-green-700">→ {c.new_value.substring(0, 100)}</p>
                        </div>
                      )}
                      {c.change_type === 'status_code' && (
                        <p className="mt-1">
                          <span className="text-gray-400">{c.old_value}</span>
                          <span className="mx-1">→</span>
                          <span className={`font-medium ${parseInt(c.new_value) >= 400 ? 'text-red-500' : 'text-green-600'}`}>{c.new_value}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-10 text-center text-gray-400">加载失败</div>
        )}
      </div>
    </div>
  );
}

// ============ Recent Changes Feed ============

function RecentChanges({ changes }: { changes: RecentChange[] }) {
  if (!changes || changes.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">最近变化</h2>
      <div className="space-y-2">
        {changes.map(c => (
          <div key={c.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0">
            <span className="shrink-0">{getChangeTypeIcon(c.change_type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 truncate">{c.summary}</p>
              <p className="text-gray-400 truncate mt-0.5">{c.url}</p>
            </div>
            <span className="text-gray-400 shrink-0">{formatTime(c.detected_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function MonitorPage() {
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [recentChanges, setRecentChanges] = useState<RecentChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [detailSiteId, setDetailSiteId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [sitesRes, statsRes] = await Promise.all([
        fetch('/api/monitor'),
        fetch('/api/monitor/stats'),
      ]);
      if (sitesRes.ok) {
        const data = await sitesRes.json();
        setSites(data.sites || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
        setRecentChanges(data.recentChanges || []);
      }
    } catch {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckAll = async () => {
    setChecking(true);
    setError('');
    try {
      const res = await fetch('/api/monitor/check', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        await fetchData();
      } else {
        setError(data.error || '检查失败');
      }
    } catch {
      setError('检查失败，请重试');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckOne = async (id: number) => {
    try {
      await fetch(`/api/monitor/check?id=${id}`, { method: 'POST' });
      await fetchData();
    } catch {
      setError('检查失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要移除此监控吗？')) return;
    try {
      await fetch(`/api/monitor/${id}`, { method: 'DELETE' });
      await fetchData();
    } catch {
      setError('删除失败');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader />
      <AdBanner />

      <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
            {error}
            <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">&times;</button>
          </div>
        )}

        <StatsOverview stats={stats} />

        {/* 操作栏 */}
        <div className="flex items-center justify-between mb-4">
          <AddSiteForm onAdded={fetchData} />
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleCheckAll}
            disabled={checking}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all"
          >
            {checking ? '⏳ 检查中...' : '🔍 检查全部'}
          </button>
        </div>

        {/* 最近变化 */}
        <RecentChanges changes={recentChanges} />

        {/* 站点列表 */}
        {loading ? (
          <div className="text-center py-10 text-gray-400">加载中...</div>
        ) : sites.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">👀</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">还没有监控任何站点</h3>
            <p className="text-sm text-gray-500">在上方输入URL开始监控吧</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map(site => (
              <div key={site.id} onClick={() => setDetailSiteId(site.id)} className="cursor-pointer">
                <SiteCard
                  site={site}
                  onCheck={(id) => { handleCheckOne(id); }}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 详情弹窗 */}
      {detailSiteId && (
        <SiteDetailModal
          siteId={detailSiteId}
          onClose={() => setDetailSiteId(null)}
        />
      )}
    </div>
  );
}
