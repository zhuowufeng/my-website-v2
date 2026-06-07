/**
 * /visual-dashboard — 数据可视化仪表盘
 * 模块12 验证：图表库集成 + 数据统计 + 仪表盘 + CSV导出
 *
 * 学什么：
 * - ✅ 图表库集成（recharts）
 * - ✅ 数据统计：计数、平均数、排名、趋势
 * - ✅ 数据仪表盘：多维度展示
 * - ✅ CSV/Excel导出功能
 *
 * 怎么算学完：✅ 做一个简单数据看板，有图表和表格
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart,
} from 'recharts';

// ─── 类型定义 ───

interface OverviewData {
  scraped: {
    total_pages: number;
    total_domains: number;
    avg_fetch_time: number;
    avg_word_count: number;
    ok_pages: number;
    error_pages: number;
    pages_with_og: number;
    pages_with_sitemap: number;
    last_crawl: string;
    first_crawl: string;
  };
  analyses: {
    total_analyses: number;
    avg_score: number;
    min_score: number;
    max_score: number;
    domains_analyzed: number;
    last_analysis: string;
  };
}

interface GradeItem {
  grade: string;
  count: number;
  avg_score: number;
}

interface TrendItem {
  date: string;
  count: number;
  avg_score: number;
  min_score: number;
  max_score: number;
}

interface DomainItem {
  domain: string;
  analysis_count: number;
  avg_score: number;
  best_score: number;
  worst_score: number;
  last_analysis: string;
}

interface StatusCodeItem {
  category: string;
  count: number;
}

interface TableRow {
  id: number;
  url: string;
  domain: string;
  score: number;
  grade: string;
  created_at: string;
  user_id: number;
  critical_issues: number;
  warnings: number;
  suggestions: number;
}

interface TableData {
  rows: TableRow[];
  total: number;
  limit: number;
  offset: number;
}

// ─── 颜色配置 ───

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

const STATUS_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7'];

const GRADE_ORDER = ['A', 'B', 'C', 'D', 'F'];

// ─── API 工厂 ───

async function fetchStats<T>(type: string, extra = ''): Promise<T> {
  const res = await fetch(`/api/visual-dashboard/stats?type=${type}${extra}`);
  const json = await res.json();
  return json.data as T;
}

// ─── 工具函数 ───

function exportCSV(rows: TableRow[], filename = 'seo-analysis-export.csv') {
  const headers = ['ID', 'URL', '域名', '评分', '等级', '严重问题', '警告', '建议', '分析时间'];
  const csvRows = [headers.join(',')];

  for (const row of rows) {
    csvRows.push([
      row.id,
      `"${row.url}"`,
      `"${row.domain}"`,
      row.score,
      row.grade,
      row.critical_issues ?? 0,
      row.warnings ?? 0,
      row.suggestions ?? 0,
      `"${new Date(row.created_at).toLocaleString('zh-CN')}"`,
    ].join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN');
}

// ─── 主组件 ───

export default function VisualDashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [statusCodes, setStatusCodes] = useState<StatusCodeItem[]>([]);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendDays, setTrendDays] = useState(30);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ov, gr, tr, dm, sc, tb] = await Promise.all([
        fetchStats<OverviewData>('overview'),
        fetchStats<GradeItem[]>('grades'),
        fetchStats<TrendItem[]>('trend', `&days=${trendDays}`),
        fetchStats<DomainItem[]>('domains'),
        fetchStats<StatusCodeItem[]>('status_codes'),
        fetchStats<TableData>('table', '&limit=100'),
      ]);
      setOverview(ov);
      setGrades(gr);
      setTrend(tr);
      setDomains(dm);
      setStatusCodes(sc);
      setTableData(tb);
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [trendDays]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── 自定义 Tooltip ───

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white shadow-lg rounded-lg p-3 border border-gray-200 text-sm">
          <p className="font-medium text-gray-700 mb-1">{label}</p>
          {payload.map((entry: any, idx: number) => (
            <p key={idx} style={{ color: entry.color }}>
              {entry.name}: <span className="font-semibold">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // ─── 状态处理 ───

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white text-lg">加载数据中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex items-center justify-center">
        <div className="bg-red-900/50 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
          <p className="text-red-300 text-lg mb-2">⚠️ 加载失败</p>
          <p className="text-red-200 text-sm">{error}</p>
          <button
            onClick={loadAll}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // ─── 渲染：仪表盘内容 ───

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
      {/* 头部 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">📊 数据仪表盘</h1>
            <p className="text-gray-400 mt-1">SEO分析数据可视化 · 模块12验证</p>
          </div>
          <button
            onClick={loadAll}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition flex items-center gap-2"
          >
            <span>🔄</span> 刷新
          </button>
        </div>

        {/* ── 概览卡片 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: '总分析次数', value: overview?.analyses.total_analyses ?? 0, icon: '🔍', color: 'from-blue-500 to-blue-700' },
            { label: '平均评分', value: overview?.analyses.avg_score ?? 0, icon: '⭐', color: 'from-green-500 to-green-700', suffix: '分' },
            { label: '已爬取页面', value: overview?.scraped.total_pages ?? 0, icon: '📄', color: 'from-purple-500 to-purple-700' },
            { label: '分析域名数', value: overview?.analyses.domains_analyzed ?? 0, icon: '🌐', color: 'from-orange-500 to-orange-700' },
          ].map((card, idx) => (
            <div
              key={idx}
              className={`bg-gradient-to-br ${card.color} rounded-xl p-5 text-white shadow-lg transform hover:scale-[1.02] transition`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{card.icon}</span>
              </div>
              <p className="text-3xl font-bold">
                {card.value}
                {card.suffix && <span className="text-lg ml-1 opacity-80">{card.suffix}</span>}
              </p>
              <p className="text-sm opacity-80 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* 第二行卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: '正常页面', value: overview?.scraped.ok_pages ?? 0, icon: '✅', color: 'from-emerald-600 to-emerald-800' },
            { label: '错误页面', value: overview?.scraped.error_pages ?? 0, icon: '❌', color: 'from-red-600 to-red-800' },
            { label: '平均加载', value: overview?.scraped.avg_fetch_time ?? 0, icon: '⏱️', color: 'from-cyan-600 to-cyan-800', suffix: 'ms' },
            { label: '有OG标签', value: overview?.scraped.pages_with_og ?? 0, icon: '🔗', color: 'from-indigo-600 to-indigo-800' },
          ].map((card, idx) => (
            <div
              key={idx}
              className={`bg-gradient-to-br ${card.color} rounded-xl p-5 text-white shadow-lg transform hover:scale-[1.02] transition`}
            >
              <p className="text-2xl font-bold">
                {card.value}
                {card.suffix && <span className="text-sm ml-1 opacity-80">{card.suffix}</span>}
              </p>
              <p className="text-sm opacity-80 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* ── 图表区域 — 第一行 ── */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* 评分等级分布（饼图） */}
          <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">🎯 评分等级分布</h2>
            {grades.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={grades.map(g => ({ ...g, name: `${g.grade}级 (${g.avg_score}分)` }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="count"
                    nameKey="name"
                    label={(entry: any) => `${entry.name || ''} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {grades.map((entry) => (
                      <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || '#888'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value: string) => <span className="text-gray-300">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">
                暂无评分数据
              </div>
            )}
          </div>

          {/* 状态码分布（饼图） */}
          <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">📡 状态码分布</h2>
            {statusCodes.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusCodes}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="count"
                    nameKey="category"
                    label={(entry: any) => `${entry.category || ''} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {statusCodes.map((_, idx) => (
                      <Cell key={idx} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value: string) => <span className="text-gray-300">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">
                暂无页面数据
              </div>
            )}
          </div>
        </div>

        {/* ── 图表区域 — 第二行 ── */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* 分数趋势（折线图） */}
          <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">📈 评分趋势</h2>
              <select
                value={trendDays}
                onChange={(e) => setTrendDays(Number(e.target.value))}
                className="bg-white/10 text-white border border-white/20 rounded px-2 py-1 text-sm"
              >
                <option value={7}>7天</option>
                <option value={14}>14天</option>
                <option value={30}>30天</option>
                <option value={90}>90天</option>
              </select>
            </div>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => formatDate(d)}
                    stroke="#ffffff60"
                    tick={{ fill: '#ffffff60', fontSize: 12 }}
                  />
                  <YAxis domain={[0, 100]} stroke="#ffffff60" tick={{ fill: '#ffffff60', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value: string) => <span className="text-gray-300">{value}</span>}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_score"
                    name="平均评分"
                    stroke="#3b82f6"
                    fill="url(#scoreGradient)"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="min_score"
                    name="最低评分"
                    stroke="#ef4444"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="max_score"
                    name="最高评分"
                    stroke="#22c55e"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">
                暂无趋势数据
              </div>
            )}
          </div>

          {/* 域名分析排名（柱状图） */}
          <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">🏆 域名分析排名</h2>
            {domains.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={domains.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    stroke="#ffffff60"
                    tick={{ fill: '#ffffff60', fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="domain"
                    stroke="#ffffff60"
                    tick={{ fill: '#ffffff60', fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value: string) => <span className="text-gray-300">{value}</span>}
                  />
                  <Bar dataKey="avg_score" name="平均评分" fill="#a855f7" radius={[0, 4, 4, 0]}>
                    {domains.slice(0, 10).map((_, idx) => (
                      <Cell key={idx} fill={['#a855f7', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87'][idx]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">
                暂无域名数据
              </div>
            )}
          </div>
        </div>

        {/* ── 图表区域 — 第三行：每日分析计数 ── */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">📊 每日分析量</h2>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatDate(d)}
                  stroke="#ffffff60"
                  tick={{ fill: '#ffffff60', fontSize: 12 }}
                />
                <YAxis stroke="#ffffff60" tick={{ fill: '#ffffff60', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="分析次数" fill="#f97316" radius={[4, 4, 0, 0]}>
                  {trend.map((_, idx) => (
                    <Cell key={idx} fill={idx % 2 === 0 ? '#f97316' : '#fb923c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-500">
              暂无数据
            </div>
          )}
        </div>

        {/* ── 数据表格 + CSV导出 ── */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">📋 分析记录</h2>
              <p className="text-gray-400 text-sm mt-1">
                共 {tableData?.total ?? 0} 条记录
              </p>
            </div>
            <button
              onClick={() => {
                if (tableData?.rows) {
                  exportCSV(tableData.rows);
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition flex items-center gap-2"
            >
              <span>📥</span> 导出CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="text-left py-3 px-2">评分</th>
                  <th className="text-left py-3 px-2">等级</th>
                  <th className="text-left py-3 px-2">域名</th>
                  <th className="text-left py-3 px-2 hidden md:table-cell">URL</th>
                  <th className="text-center py-3 px-2">问题</th>
                  <th className="text-center py-3 px-2 hidden sm:table-cell">警告</th>
                  <th className="text-right py-3 px-2 hidden lg:table-cell">时间</th>
                </tr>
              </thead>
              <tbody>
                {tableData?.rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="py-3 px-2">
                      <span className={`font-bold ${
                        row.score >= 90 ? 'text-green-400' :
                        row.score >= 75 ? 'text-blue-400' :
                        row.score >= 60 ? 'text-yellow-400' :
                        row.score >= 40 ? 'text-orange-400' :
                        'text-red-400'
                      }`}>
                        {row.score}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-block w-7 h-7 rounded-full text-center leading-7 text-xs font-bold text-white ${
                        row.grade === 'A' ? 'bg-green-600' :
                        row.grade === 'B' ? 'bg-blue-600' :
                        row.grade === 'C' ? 'bg-yellow-600' :
                        row.grade === 'D' ? 'bg-orange-600' :
                        'bg-red-600'
                      }`}>
                        {row.grade}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-300 max-w-[120px] truncate">{row.domain}</td>
                    <td className="py-3 px-2 text-gray-400 max-w-[200px] truncate hidden md:table-cell">
                      <a href={row.url} target="_blank" rel="noopener" className="hover:text-blue-400 transition">
                        {row.url}
                      </a>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`inline-block min-w-[24px] px-1.5 py-0.5 rounded text-xs font-medium ${
                        (row.critical_issues ?? 0) > 0 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
                      }`}>
                        {row.critical_issues ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center hidden sm:table-cell">
                      <span className="text-yellow-400">
                        {row.warnings ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right text-gray-500 text-xs hidden lg:table-cell">
                      {formatDateTime(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!tableData || tableData.rows.length === 0) && (
              <div className="text-center py-12 text-gray-500">
                暂无分析记录，先去 <a href="/seo-diagnosis" className="text-blue-400 hover:underline">SEO诊断</a> 分析几个页面吧
              </div>
            )}
          </div>
        </div>

        {/* ── 底部 ── */}
        <div className="text-center text-gray-500 text-xs py-4 border-t border-white/5">
          模块12验证 · 数据可视化与报表 · 使用 recharts + Tailwind CSS
        </div>
      </div>
    </div>
  );
}
