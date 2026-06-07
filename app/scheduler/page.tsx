/**
 * /scheduler — ⏰ 定时诊断管理页面 v2
 * 功能：趋势监控 + 频率自定义 + 执行历史
 */

'use client';

import { useState, useEffect } from 'react';

interface SchedulerTask {
  id: number;
  url: string;
  user_id: number;
  cron_expression: string;
  is_active: boolean;
  last_run: string | null;
  created_at: string;
}

interface HistoryItem {
  id: number;
  url: string;
  score: number;
  grade: string;
  status: string;
  error_message: string | null;
  executed_at: string;
}

interface TrendData {
  url: string;
  direction: 'up' | 'down' | 'stable';
  change: number;
  scores: Array<{ score: number; executed_at: string }>;
}

const FREQ_OPTIONS = [
  { value: '0 8 * * *', label: '每天 08:00' },
  { value: '0 8,20 * * *', label: '每天 08:00 & 20:00' },
  { value: '0 */6 * * *', label: '每 6 小时' },
  { value: '0 0 * * *', label: '每天 00:00' },
  { value: '0 9 * * 1-5', label: '工作日 09:00' },
  { value: '0 */12 * * *', label: '每 12 小时' },
  { value: '0 0 * * 0', label: '每周日 00:00' },
];

function parseCronToLabel(expr: string): string {
  const found = FREQ_OPTIONS.find(o => o.value === expr);
  return found ? found.label : expr;
}

export default function SchedulerPage() {
  const [tasks, setTasks] = useState<SchedulerTask[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editFreq, setEditFreq] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');

  const showMessage = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, historyRes, statsRes, trendsRes] = await Promise.all([
        fetch('/api/scheduler/tasks'),
        fetch('/api/scheduler/history?limit=20'),
        fetch('/api/scheduler/history?type=stats'),
        fetch('/api/scheduler/history?type=trends&limit=10'),
      ]);

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
      }
      if (historyRes.ok) {
        const histData = await historyRes.json();
        setHistory(histData.history || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats || null);
      }
      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setTrends(trendsData.trends || []);
      }
    } catch (err: any) {
      showMessage('加载数据失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setRunning(true);
    try {
      const res = await fetch('/api/scheduler/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (res.ok) {
        showMessage(`✅ 已添加定时诊断: ${url}`, 'success');
        setUrl('');
        await loadData();
      } else {
        const err = await res.json();
        showMessage(err.error || '添加失败', 'error');
      }
    } catch (err: any) {
      showMessage('操作失败: ' + err.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleRemoveTask = async (id: number) => {
    try {
      const res = await fetch(`/api/scheduler/tasks?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('已停用该定时任务', 'info');
        await loadData();
      }
    } catch (err: any) {
      showMessage('操作失败', 'error');
    }
  };

  const handleSaveFreq = async (taskId: number) => {
    try {
      const res = await fetch('/api/scheduler/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, cron_expression: editFreq }),
      });
      if (res.ok) {
        showMessage('✅ 频率已更新', 'success');
        setEditingTaskId(null);
        await loadData();
      }
    } catch {
      showMessage('更新失败', 'error');
    }
  };

  const handleToggleTask = async (task: SchedulerTask) => {
    try {
      await fetch('/api/scheduler/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, is_active: !task.is_active }),
      });
      await loadData();
    } catch {
      showMessage('操作失败', 'error');
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    showMessage('⏳ 正在执行诊断...', 'info');
    try {
      const res = await fetch('/api/cron/daily-diagnosis');
      const data = await res.json();
      showMessage(
        `✅ 完成！${data.success}/${data.total} 成功`,
        data.failed > 0 ? 'info' : 'success'
      );
      await loadData();
    } catch (err: any) {
      showMessage('执行失败: ' + err.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const getTrendForUrl = (url: string): TrendData | undefined => {
    return trends.find(t => t.url === url);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '从未';
    return new Date(d).toLocaleString('zh-CN');
  };

  // ─── 渲染 ───

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">⏰ 定时诊断</h1>
            <p className="text-gray-400 mt-1">趋势监控 · 频率自定义 · 自动执行</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRunNow}
              disabled={running}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition flex items-center gap-2"
            >
              {running ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  执行中...
                </>
              ) : (
                <>▶️ 立即执行</>
              )}
            </button>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm ${
            messageType === 'error' ? 'bg-red-900/50 text-red-200 border border-red-500/30' :
            messageType === 'success' ? 'bg-green-900/50 text-green-200 border border-green-500/30' :
            'bg-blue-900/50 text-blue-200 border border-blue-500/30'
          }`}>
            {message}
          </div>
        )}

        {/* 概览卡片 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: '总执行次数', value: stats.total_runs ?? 0, icon: '🔄', color: 'from-blue-600 to-blue-800' },
              { label: '成功次数', value: stats.successful_runs ?? 0, icon: '✅', color: 'from-green-600 to-green-800' },
              { label: '失败次数', value: stats.failed_runs ?? 0, icon: '❌', color: 'from-red-600 to-red-800' },
              { label: '平均评分', value: stats.avg_score ?? '-', icon: '⭐', color: 'from-purple-600 to-purple-800' },
            ].map((card, idx) => (
              <div key={idx} className={`bg-gradient-to-br ${card.color} rounded-xl p-4 text-white`}>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-sm opacity-80">{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* 添加任务 */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">➕ 添加诊断目标</h2>
          <form onSubmit={handleAddTask} className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="输入要定时诊断的URL，如 https://example.com"
              className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              disabled={running}
            />
            <button
              type="submit"
              disabled={running || !url.trim()}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition whitespace-nowrap"
            >
              添加
            </button>
          </form>
          <p className="text-gray-500 text-xs mt-2">
            ⏰ 默认每天早上8:00自动诊断 · 添加后可自定义频率
          </p>
        </div>

        {/* 当前任务列表 */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">📋 诊断任务列表</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="inline-block w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-2" />
              <p>加载中...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">📭</p>
              <p>还没有定时诊断任务</p>
              <p className="text-xs mt-1">在上方输入URL添加</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const trend = getTrendForUrl(task.url);
                return (
                  <div
                    key={task.id}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border transition ${
                      task.is_active
                        ? 'bg-white/5 border-white/10'
                        : 'bg-white/[0.02] border-white/5 opacity-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleTask(task)}
                          className={`inline-block w-2 h-2 rounded-full cursor-pointer ${
                            task.is_active ? 'bg-green-400' : 'bg-gray-500'
                          }`}
                          title={task.is_active ? '点击停用' : '点击启用'}
                        />
                        <p className="text-white font-medium truncate">{task.url}</p>
                        {/* 趋势指示器 */}
                        {trend && trend.scores.length >= 2 && (
                          <span className={`text-xs flex items-center gap-0.5 font-medium ${
                            trend.direction === 'up' ? 'text-green-400' :
                            trend.direction === 'down' ? 'text-red-400' :
                            'text-gray-400'
                          }`}>
                            {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '―'}
                            {trend.direction !== 'stable' && `${Math.abs(trend.change)}分`}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                        <span>频率: {parseCronToLabel(task.cron_expression)}</span>
                        <span>上次: {formatDate(task.last_run)}</span>
                        <span>添加于: {formatDate(task.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                      {editingTaskId === task.id ? (
                        <div className="flex items-center gap-2 flex-1 sm:flex-none">
                          <select
                            value={editFreq}
                            onChange={(e) => setEditFreq(e.target.value)}
                            className="px-2 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white"
                          >
                            {FREQ_OPTIONS.map(o => (
                              <option key={o.value} value={o.value} className="bg-gray-800">{o.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSaveFreq(task.id)}
                            className="px-2 py-1 text-xs bg-green-700 hover:bg-green-600 text-white rounded"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingTaskId(null)}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingTaskId(task.id); setEditFreq(task.cron_expression); }}
                            className="px-3 py-1.5 text-xs bg-blue-900/30 hover:bg-blue-800/50 text-blue-300 rounded transition"
                          >
                            ⏱ 频率
                          </button>
                          <button
                            onClick={() => handleRemoveTask(task.id)}
                            className="px-3 py-1.5 text-xs bg-red-900/30 hover:bg-red-800/50 text-red-300 rounded transition"
                          >
                            停用
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 执行历史 */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">📜 执行历史</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无执行历史</p>
              <p className="text-xs mt-1">点击「立即执行」开始第一次诊断</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="text-left py-3 px-2">状态</th>
                    <th className="text-left py-3 px-2">URL</th>
                    <th className="text-center py-3 px-2">评分</th>
                    <th className="text-center py-3 px-2">等级</th>
                    <th className="text-right py-3 px-2">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center gap-1 ${
                          item.status === 'success' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {item.status === 'success' ? '✅' : '❌'}
                          {item.status === 'success' ? '成功' : '失败'}
                        </span>
                        {item.error_message && (
                          <span className="block text-xs text-red-500 mt-0.5 max-w-[200px] truncate" title={item.error_message}>
                            {item.error_message}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-gray-300 max-w-[200px] truncate">{item.url}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={`font-bold ${
                          (item.score ?? 0) >= 90 ? 'text-green-400' :
                          (item.score ?? 0) >= 75 ? 'text-blue-400' :
                          (item.score ?? 0) >= 60 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {item.score ?? '-'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-block w-6 h-6 rounded-full text-center leading-6 text-xs font-bold text-white ${
                          item.grade === 'A' ? 'bg-green-600' :
                          item.grade === 'B' ? 'bg-blue-600' :
                          item.grade === 'C' ? 'bg-yellow-600' :
                          item.grade === 'D' ? 'bg-orange-600' :
                          'bg-red-600'
                        }`}>
                          {item.grade || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right text-gray-500 text-xs">
                        {formatDate(item.executed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 趋势监控面板 */}
        {trends.length > 0 && (
          <div className="mt-8 bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">📈 评分趋势</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trends.slice(0, 6).map((trend) => (
                <div key={trend.url} className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
                  <p className="text-white text-sm truncate mb-2" title={trend.url}>{trend.url}</p>
                  <div className="flex items-center gap-3">
                    {trend.scores.length >= 2 ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 text-xs">上次</span>
                          <span className="text-white font-bold text-sm">{trend.scores[0].score}</span>
                        </div>
                        <span className="text-gray-500 text-xs">→</span>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 text-xs">最新</span>
                          <span className={`font-bold text-sm ${
                            trend.scores[trend.scores.length - 1].score >= 90 ? 'text-green-400' :
                            trend.scores[trend.scores.length - 1].score >= 75 ? 'text-blue-400' :
                            trend.scores[trend.scores.length - 1].score >= 60 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {trend.scores[trend.scores.length - 1].score}
                          </span>
                        </div>
                        <span className={`text-xs font-bold ${
                          trend.direction === 'up' ? 'text-green-400' :
                          trend.direction === 'down' ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {trend.direction === 'up' ? `▲ +${trend.change}` :
                           trend.direction === 'down' ? `▼ ${trend.change}` :
                           '― 持平'}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500 text-xs">仅有一次记录，暂无法对比趋势</span>
                    )}
                  </div>
                  {/* 简易趋势条 */}
                  {trend.scores.length >= 2 && (
                    <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden flex">
                      {trend.scores.map((s, i) => (
                        <div
                          key={i}
                          className="h-full rounded-full"
                          style={{
                            width: `${100 / trend.scores.length}%`,
                            backgroundColor: s.score >= 90 ? '#22c55e' : s.score >= 75 ? '#3b82f6' : s.score >= 60 ? '#eab308' : '#ef4444',
                            opacity: 0.6 + (i / trend.scores.length) * 0.4,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 配置说明 */}
        <div className="mt-8 bg-blue-900/20 border border-blue-500/20 rounded-xl p-6">
          <h3 className="text-white font-medium mb-3">🔧 外部Cron服务配置</h3>
          <p className="text-gray-300 text-sm mb-2">
            本站点部署在Zeabur（serverless），自带的node-cron不持久运行。
            推荐使用免费的外部cron服务触发定时任务：
          </p>
          <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
            <li>注册 <a href="https://cron-job.org" target="_blank" rel="noopener" className="text-blue-400 hover:underline">cron-job.org</a>（免费）</li>
            <li>添加定时任务，URL设为：<code className="bg-white/10 px-2 py-0.5 rounded text-xs">https://你的域名/api/cron/daily-diagnosis</code></li>
            <li>设置执行频率（如每天8:00）</li>
            <li>如果设置了 CRON_SECRET 环境变量，在URL后加 <code className="bg-white/10 px-2 py-0.5 rounded text-xs">?key=你的密钥</code></li>
          </ol>
        </div>

        {/* 底部 */}
        <div className="text-center text-gray-500 text-xs py-4 mt-8 border-t border-white/5">
          定时自动诊断系统 · 趋势监控 · 频率自定义 · API驱动
        </div>
      </div>
    </div>
  );
}
