/**
 * /seo-analytics — SEO Analytics Dashboard
 * 模块12 验证：数据可视化 + 交互式图表 + 数据聚合
 *
 * 功能：
 * - 概览统计卡片（总数/平均分/占比）
 * - 评分分布直方图
 * - 每日趋势折线图
 * - 问题类型TOP条形图
 * - 域名对比雷达图
 * - 状态码分布饼图
 * - 域名对比柱状图
 * - 时间范围筛选
 * - 导出为图片
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, RadarChart, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell, Area, AreaChart
} from 'recharts';

// ============ Types ============
interface GlobalStats {
  total_pages: number;
  total_domains: number;
  avg_fetch_time: number;
  avg_word_count: number;
  total_words: number;
  ok_pages: number;
  error_pages: number;
  pages_with_og: number;
  pages_with_sitemap: number;
  first_crawl: string;
  last_crawl: string;
}

interface ScoreDistribution {
  a_count: number;
  b_count: number;
  c_count: number;
  d_count: number;
  avg_score: number;
}

interface DailyTrend {
  date: string;
  total: number;
  avg_score: number;
  errors: number;
}

interface IssueType {
  issue_type: string;
  count: number;
}

interface DomainComparison {
  domain: string;
  page_count: number;
  avg_fetch_time: number;
  avg_word_count: number;
  ok_count: number;
  og_count: number;
  last_crawled: string;
}

interface StatusCodeGroup {
  status_group: string;
  count: number;
  percentage: number;
}

interface DomainScore {
  domain: string;
  title_score: number;
  meta_score: number;
  h1_score: number;
  og_score: number;
  sitemap_score: number;
  perf_score: number;
  status_score: number;
}

interface AnalyticsData {
  globalStats: GlobalStats;
  scoreDistribution: ScoreDistribution;
  dailyTrend: DailyTrend[];
  issueTypes: IssueType[];
  domainComparison: DomainComparison[];
  statusCodeDistribution: StatusCodeGroup[];
  domainScores: DomainScore[];
  filters: {
    days: number;
    domain?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

// ============ Constants ============
const COLORS = {
  primary: '#6366f1',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  gray: '#6b7280',
  purple: '#a855f7',
  pink: '#ec4899',
};

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308'];

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
};

const STATUS_COLORS: Record<string, string> = {
  '2xx 正常': '#22c55e',
  '3xx 跳转': '#3b82f6',
  '4xx 客户端错误': '#f59e0b',
  '5xx 服务端错误': '#ef4444',
  '其他': '#6b7280',
};

// ============ Components ============

/** Stat card */
function StatCard({ label, value, sub, color = 'text-gray-900', icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/** Grade badge */
function GradeBadge({ grade, score }: { grade: string; score?: number }) {
  const color = GRADE_COLORS[grade] || '#6b7280';
  return (
    <div className="flex flex-col items-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
        style={{ backgroundColor: color }}>
        {grade}
      </div>
      {score !== undefined && (
        <div className="text-xs text-gray-500 mt-1">{score}分</div>
      )}
    </div>
  );
}

// ============ Main Page ============
export default function SEOAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('30');
  const dashboardRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('days', daysFilter);
      if (domainFilter) params.set('domain', domainFilter);
      const res = await fetch(`/api/analytics/seo?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result: AnalyticsData = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [daysFilter, domainFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Export as PNG
  const handleExportImage = async () => {
    const dashboard = dashboardRef.current;
    if (!dashboard) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(dashboard, {
        backgroundColor: '#f8fafc',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = 'seo-analytics-report.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      // html2canvas might not be installed — fallback
      alert('导出图片需要 html2canvas。可用浏览器截图代替。');
    }
  };

  // Format number
  const fmt = (n: number) => n.toLocaleString();
  const fmtDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // Prepare score distribution data for bar chart
  const scoreDistData = data ? [
    { name: 'A级 (90+)', value: data.scoreDistribution.a_count, fill: GRADE_COLORS.A },
    { name: 'B级 (75-89)', value: data.scoreDistribution.b_count, fill: GRADE_COLORS.B },
    { name: 'C级 (60-74)', value: data.scoreDistribution.c_count, fill: GRADE_COLORS.C },
    { name: 'D级 (<60)', value: data.scoreDistribution.d_count, fill: GRADE_COLORS.D },
  ] : [];

  // Error/Loading state
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">加载数据看板...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">加载失败</h2>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 transition-colors">
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { globalStats: gs, scoreDistribution: sd } = data;
  const totalScored = sd.a_count + sd.b_count + sd.c_count + sd.d_count;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ============ Header ============ */}
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                📊 SEO 数据看板
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                诊断数据分析 · 可视化洞察 · 性能监控
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Domain filter */}
              <div>
                <input
                  type="text"
                  value={domainFilter}
                  onChange={e => setDomainFilter(e.target.value)}
                  placeholder="筛选域名..."
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                />
              </div>

              {/* Days filter */}
              <div>
                <select
                  value={daysFilter}
                  onChange={e => setDaysFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7">最近7天</option>
                  <option value="14">最近14天</option>
                  <option value="30">最近30天</option>
                  <option value="90">最近90天</option>
                  <option value="365">全部</option>
                </select>
              </div>

              <button onClick={() => setDomainFilter('')}
                className="px-3 py-2 text-xs text-gray-400 border border-gray-200 rounded-xl hover:text-red-500 hover:border-red-200 transition-all">
                ✕ 重置
              </button>

              <button onClick={handleExportImage}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                📷 导出报告
              </button>
            </div>
          </div>
        </header>

        <div ref={dashboardRef} className="space-y-6">

          {/* ============ Row 1: Overview Cards ============ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon="📄" label="总页面" value={fmt(gs.total_pages)} color="text-gray-900" />
            <StatCard icon="🌐" label="域名数" value={gs.total_domains} color="text-blue-600" />
            <StatCard icon="💚" label="正常率" value={gs.total_pages > 0 ? `${Math.round(gs.ok_pages / gs.total_pages * 100)}%` : '0%'}
              sub={`${fmt(gs.ok_pages)} / ${fmt(gs.total_pages)}`} color="text-green-600" />
            <StatCard icon="⏱️" label="平均加载" value={`${gs.avg_fetch_time}ms`} sub={gs.avg_fetch_time < 1000 ? '✅ 快' : gs.avg_fetch_time < 2000 ? '⚠️ 一般' : '🔴 慢'}
              color={gs.avg_fetch_time < 1000 ? 'text-green-600' : gs.avg_fetch_time < 2000 ? 'text-amber-600' : 'text-red-600'} />
            <StatCard icon="🔤" label="总字数" value={fmt(gs.total_words || 0)} color="text-purple-600" />
            <StatCard icon="🏷️" label="OG标签率" value={gs.total_pages > 0 ? `${Math.round(gs.pages_with_og / gs.total_pages * 100)}%` : '0%'}
              sub={`${gs.pages_with_og} / ${fmt(gs.total_pages)}`} color="text-indigo-600" />
          </div>

          {/* ============ Row 2: Score + Grade ============ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score distribution histogram */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span>📊 评分分布</span>
                <span className="text-xs text-gray-400 font-normal">（共{fmt(totalScored)}页）</span>
              </h3>
              {totalScored > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={scoreDistData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="value" name="页面数" radius={[6, 6, 0, 0]}>
                      {scoreDistData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                  暂无评分数据
                </div>
              )}
            </div>

            {/* Grade badges + avg score */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">🏆 综合评级</h3>
              <div className="flex items-center justify-center mb-6">
                <GradeBadge
                  grade={
                    sd.avg_score >= 90 ? 'A' :
                    sd.avg_score >= 75 ? 'B' :
                    sd.avg_score >= 60 ? 'C' : 'D'
                  }
                  score={sd.avg_score}
                />
              </div>
              <div className="space-y-3">
                {[
                  { grade: 'A', label: '优秀', count: sd.a_count, color: GRADE_COLORS.A },
                  { grade: 'B', label: '良好', count: sd.b_count, color: GRADE_COLORS.B },
                  { grade: 'C', label: '一般', count: sd.c_count, color: GRADE_COLORS.C },
                  { grade: 'D', label: '需优化', count: sd.d_count, color: GRADE_COLORS.D },
                ].map(item => (
                  <div key={item.grade} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: item.color }}>{item.grade}</div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{item.label}</span>
                        <span>{fmt(item.count)}页 ({totalScored > 0 ? Math.round(item.count / totalScored * 100) : 0}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${totalScored > 0 ? item.count / totalScored * 100 : 0}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ============ Row 3: Trend + Issues ============ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily trend */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">📈 每日趋势</h3>
              {data.dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }}
                      tickFormatter={(val) => fmtDate(val)} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString('zh-CN')}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="total" name="诊断数" stroke={COLORS.primary}
                      strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="right" type="monotone" dataKey="avg_score" name="平均分" stroke={COLORS.success}
                      strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="left" type="monotone" dataKey="errors" name="错误数" stroke={COLORS.danger}
                      strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                  暂无趋势数据
                </div>
              )}
            </div>

            {/* Issue types TOP */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">🔍 常见问题 TOP</h3>
              {data.issueTypes.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.issueTypes.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="issue_type" tick={{ fontSize: 11 }}
                      width={100} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="count" name="出现次数" radius={[0, 6, 6, 0]}>
                      {data.issueTypes.slice(0, 8).map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                  暂无问题数据
                </div>
              )}
            </div>
          </div>

          {/* ============ Row 4: Radar + Pie ============ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Domain radar comparison */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">🎯 域名对比（雷达图）</h3>
              {data.domainScores.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={[
                    { metric: '标题', ...Object.fromEntries(data.domainScores.map(d => [d.domain, d.title_score])) },
                    { metric: 'Meta', ...Object.fromEntries(data.domainScores.map(d => [d.domain, d.meta_score])) },
                    { metric: 'H1', ...Object.fromEntries(data.domainScores.map(d => [d.domain, d.h1_score])) },
                    { metric: 'OG标签', ...Object.fromEntries(data.domainScores.map(d => [d.domain, d.og_score])) },
                    { metric: 'Sitemap', ...Object.fromEntries(data.domainScores.map(d => [d.domain, d.sitemap_score])) },
                    { metric: '性能', ...Object.fromEntries(data.domainScores.map(d => [d.domain, d.perf_score])) },
                    { metric: '状态', ...Object.fromEntries(data.domainScores.map(d => [d.domain, d.status_score])) },
                  ]}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }} />
                    {data.domainScores.map((d, idx) => (
                      <Radar key={d.domain} name={d.domain} dataKey={d.domain}
                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                        fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        fillOpacity={0.1}
                        strokeWidth={2} />
                    ))}
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-gray-400 text-sm">
                  暂无多域名数据
                </div>
              )}
            </div>

            {/* Status code distribution pie */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">📡 状态码分布</h3>
              {data.statusCodeDistribution.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.statusCodeDistribution}
                        dataKey="count"
                        nameKey="status_group"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={55}
                        paddingAngle={3}
                      >
                        {data.statusCodeDistribution.map(entry => (
                          <Cell key={entry.status_group}
                            fill={STATUS_COLORS[entry.status_group] || '#6b7280'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {data.statusCodeDistribution.map(entry => (
                      <div key={entry.status_group} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[entry.status_group] || '#6b7280' }} />
                        <span className="text-xs text-gray-600">{entry.status_group}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                  暂无状态码数据
                </div>
              )}
            </div>
          </div>

          {/* ============ Row 5: Domain Comparison Bar ============ */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">🌐 域名对比（页面数TOP10）</h3>
            {data.domainComparison.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.domainComparison} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="domain" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="page_count" name="页面数" fill={COLORS.primary}
                    radius={[0, 6, 6, 0]} stackId="a" />
                  <Bar dataKey="ok_count" name="正常页" fill={COLORS.success}
                    radius={[0, 6, 6, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                暂无域名数据
              </div>
            )}
          </div>

          {/* ============ Footer Info ============ */}
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">⚡ 模块12验证：数据可视化</h3>
                <p className="text-xs text-gray-400">
                  Recharts 图表 · 交互式仪表盘 · 服务端聚合 · 7种图表类型 · 响应式适配 · 报告导出
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">📊 Recharts</span>
                <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full">🔄 服务端聚合</span>
                <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">🎯 7种图表</span>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">📱 响应式</span>
                <span className="px-2.5 py-1 bg-pink-100 text-pink-700 text-xs rounded-full">📷 导出报告</span>
              </div>
            </div>
            {data.filters.domain && (
              <div className="mt-3 text-xs text-gray-400">
                当前筛选：域名={data.filters.domain} · 时间范围={data.filters.dateFrom || '最近' + data.filters.days + '天'}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
