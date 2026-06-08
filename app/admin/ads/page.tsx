// app/admin/ads/page.tsx — 广告位管理页面
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface AdPlacement {
  id: number;
  name: string;
  position: string;
  source: string;
  ad_type: string;
  ad_code: string | null;
  ad_script: string | null;
  is_active: boolean;
  priority: number;
  max_impressions_per_session: number;
  created_at: string;
  updated_at: string;
}

const POSITIONS = ['bottom', 'sidebar', 'inline', 'header', 'footer', 'popup', 'banner'];
const AD_TYPES = ['custom', 'adsense', 'carbon', 'buysellads', 'affiliate'];

export default function AdsManagementPage() {
  const [placements, setPlacements] = useState<AdPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 新增/编辑表单
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    position: 'bottom',
    source: 'default',
    ad_type: 'custom',
    ad_code: '',
    ad_script: '',
    is_active: true,
    priority: 0,
    max_impressions_per_session: 1,
  });

  const [initializing, setInitializing] = useState(false);

  const fetchPlacements = useCallback(async () => {
    try {
      const res = await fetch('/api/ads/placements');
      const data = await res.json();
      if (data.placements) {
        setPlacements(data.placements);
      }
    } catch (err: any) {
      setError('加载广告位失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlacements();
  }, [fetchPlacements]);

  // 初始化广告系统
  const handleInit = async () => {
    setInitializing(true);
    setMessage({ text: '正在初始化广告系统...', type: 'info' });
    try {
      const res = await fetch('/api/ads/init', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: '✅ 广告系统初始化成功！', type: 'success' });
        fetchPlacements();
      } else {
        setMessage({ text: '初始化失败: ' + (data.error || '未知错误'), type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: '初始化失败: ' + err.message, type: 'error' });
    } finally {
      setInitializing(false);
    }
  };

  // 打开新增表单
  const handleNew = () => {
    setEditingId(null);
    setFormData({
      name: '',
      position: 'bottom',
      source: 'default',
      ad_type: 'custom',
      ad_code: '',
      ad_script: '',
      is_active: true,
      priority: 0,
      max_impressions_per_session: 1,
    });
    setShowForm(true);
  };

  // 打开编辑表单
  const handleEdit = (ad: AdPlacement) => {
    setEditingId(ad.id);
    setFormData({
      name: ad.name,
      position: ad.position,
      source: ad.source,
      ad_type: ad.ad_type,
      ad_code: ad.ad_code || '',
      ad_script: ad.ad_script || '',
      is_active: ad.is_active,
      priority: ad.priority,
      max_impressions_per_session: ad.max_impressions_per_session,
    });
    setShowForm(true);
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      let res;
      if (editingId) {
        // 更新
        res = await fetch('/api/ads/placements', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...formData }),
        });
      } else {
        // 新建
        res = await fetch('/api/ads/placements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      const data = await res.json();
      if (data.success) {
        setMessage({
          text: editingId ? '✅ 广告位已更新' : '✅ 广告位已创建',
          type: 'success',
        });
        setShowForm(false);
        fetchPlacements();
      } else {
        setMessage({ text: (data.error || '操作失败'), type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: '操作失败: ' + err.message, type: 'error' });
    }
  };

  // 切换启用/禁用
  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      const res = await fetch('/api/ads/placements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({
          text: currentActive ? '⏸️ 广告位已禁用' : '▶️ 广告位已启用',
          type: 'success',
        });
        fetchPlacements();
      }
    } catch (err: any) {
      setMessage({ text: '操作失败: ' + err.message, type: 'error' });
    }
  };

  // 删除广告位
  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这个广告位吗？')) return;
    try {
      const res = await fetch(`/api/ads/placements?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: '🗑️ 广告位已删除', type: 'success' });
        fetchPlacements();
      }
    } catch (err: any) {
      setMessage({ text: '删除失败: ' + err.message, type: 'error' });
    }
  };

  // 位置标签颜色
  const positionColors: Record<string, string> = {
    bottom: 'bg-blue-100 text-blue-800',
    sidebar: 'bg-purple-100 text-purple-800',
    inline: 'bg-green-100 text-green-800',
    header: 'bg-cyan-100 text-cyan-800',
    footer: 'bg-gray-100 text-gray-800',
    popup: 'bg-red-100 text-red-800',
    banner: 'bg-amber-100 text-amber-800',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">📢 广告位管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            管理网站上的广告位，追踪曝光和点击数据
          </p>
        </div>
        <div className="flex gap-3">
          {placements.length === 0 && (
            <button
              onClick={handleInit}
              disabled={initializing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition disabled:opacity-50"
            >
              {initializing ? '初始化中...' : '⚡ 初始化广告系统'}
            </button>
          )}
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition"
          >
            + 新增广告位
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
          message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="float-right text-current opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                {editingId ? '编辑广告位' : '新增广告位'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">广告位名称</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="如: 首页底部广告"
                />
              </div>

              {/* Position + Source */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
                  <select
                    value={formData.position}
                    onChange={e => setFormData(p => ({ ...p, position: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {POSITIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={e => setFormData(p => ({ ...p, source: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="default / seo / global"
                  />
                </div>
              </div>

              {/* Ad Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">广告类型</label>
                <select
                  value={formData.ad_type}
                  onChange={e => setFormData(p => ({ ...p, ad_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {AD_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Ad Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  广告代码
                  <span className="text-gray-400 font-normal ml-1">(支持 AdSense 脚本)</span>
                </label>
                <textarea
                  value={formData.ad_code}
                  onChange={e => setFormData(p => ({ ...p, ad_code: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  placeholder="<script>...</script> 或 HTML 代码"
                />
              </div>

              {/* Ad Script (extra config) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  额外配置
                  <span className="text-gray-400 font-normal ml-1">(可选)</span>
                </label>
                <textarea
                  value={formData.ad_script}
                  onChange={e => setFormData(p => ({ ...p, ad_script: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  placeholder="额外的 JavaScript 配置"
                />
              </div>

              {/* Priority + Max Impressions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={e => setFormData(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">每Session曝光上限</label>
                  <input
                    type="number"
                    value={formData.max_impressions_per_session}
                    onChange={e => setFormData(p => ({ ...p, max_impressions_per_session: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    min={1}
                    max={100}
                  />
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">启用</label>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition"
                >
                  {editingId ? '保存修改' : '创建广告位'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Placements List */}
      {placements.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">还没有广告位</h3>
          <p className="text-sm text-gray-500 mb-4">点击"初始化广告系统"或手动创建第一个广告位</p>
          <button
            onClick={handleInit}
            disabled={initializing}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition disabled:opacity-50"
          >
            {initializing ? '初始化中...' : '⚡ 初始化广告系统'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {placements.map(ad => (
            <div
              key={ad.id}
              className={`bg-white rounded-xl border p-4 transition ${
                ad.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{ad.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${positionColors[ad.position] || 'bg-gray-100 text-gray-700'}`}>
                      {ad.position}
                    </span>
                    <span className="text-xs text-gray-400">#{ad.id}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>类型: {ad.ad_type}</span>
                    <span>来源: {ad.source}</span>
                    <span>优先级: {ad.priority}</span>
                    <span>曝光上限: {ad.max_impressions_per_session}/session</span>
                    {ad.ad_code && (
                      <span className="text-green-600" title={ad.ad_code.substring(0, 100)}>
                        ✅ 有代码
                      </span>
                    )}
                    {!ad.ad_code && (
                      <span className="text-gray-400">⚠️ 无代码</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(ad.id, ad.is_active)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition ${
                      ad.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {ad.is_active ? '启用' : '禁用'}
                  </button>
                  <button
                    onClick={() => handleEdit(ad)}
                    className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(ad.id)}
                    className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage Tips */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">💡 使用提示</h3>
        <ul className="text-xs text-blue-700 space-y-1.5">
          <li>• 广告类型选择 <strong>adsense</strong> 并填入 Google AdSense 代码即可正常显示广告</li>
          <li>• 同一个位置可以有多个广告位，按优先级排序展示</li>
          <li>• <strong>max_impressions_per_session</strong> 控制同一用户每次访问能看到广告的次数</li>
          <li>• 禁用广告位后，页面会展示回落（静态）广告</li>
          <li>• 查看 <Link href="/admin/analytics" className="underline">数据分析</Link> 了解各广告位的曝光和点击数据</li>
        </ul>
      </div>
    </div>
  );
}
