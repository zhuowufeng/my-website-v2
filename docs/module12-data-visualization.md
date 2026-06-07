# 模块12：📊 数据可视化与报表

> **学完时间：** 2026-06-07
> **验证项目：** `/visual-dashboard` 数据仪表盘
> **API端点：** `/api/visual-dashboard/stats`

## 学到的技能

### 1. 图表库集成（recharts）

安装时已有 `recharts` 依赖，无需额外安装：
```json
"recharts": "^3.8.1"
```

使用到的图表类型：
| 图表 | 类型 | 展示内容 |
|------|------|---------|
| PieChart | 饼图（环形） | 评分等级分布、状态码分布 |
| AreaChart | 面积图 | 评分趋势（含最高/最低线） |
| BarChart | 柱状图（横向） | 域名分析排名 |
| BarChart | 柱状图（纵向） | 每日分析量 |

关键配置：
- `ResponsiveContainer` 自适应容器宽度
- `CartesianGrid` 网格线
- `Tooltip` 自定义悬浮提示
- `Legend` 图例自定义颜色
- 自定义 `label` 函数显示百分比

### 2. 数据统计（多维度聚合）

API 端实现了 6 种统计类型，全部用原生 SQL 聚合：

**概览统计** — 两张表联合：
```sql
-- scraped_pages 统计
COUNT(*) as total_pages
COUNT(DISTINCT domain) as total_domains
AVG(fetch_time_ms) as avg_fetch_time
-- 状态码分布
SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)
```

**评分统计 — seo_analyses 表：**
```sql
AVG(score) as avg_score
MIN(score), MAX(score)
COUNT(DISTINCT domain) as domains_analyzed
```

**趋势统计 — 按天分组：**
```sql
DATE(created_at) as date
AVG(score) as avg_score
```

### 3. 数据仪表盘（多维度展示）

页面布局：
- **顶部**：8个概览卡片（渐变背景）
  - 总分析次数 / 平均评分 / 已爬取页面 / 分析域名数
  - 正常页面 / 错误页面 / 平均加载 / 有OG标签
- **中间**：5个图表
  - 评分等级分布（环形饼图）
  - 状态码分布（环形饼图）
  - 评分趋势（面积图 + 7/14/30/90天切换）
  - 域名分析排名（横向柱状图）
  - 每日分析量（纵向柱状图）
- **底部**：数据表格

设计风格：
- 深色渐变背景（`from-gray-900 via-slate-800 to-gray-900`）
- 毛玻璃效果卡片（`backdrop-blur` + `border-white/10`）
- 悬停缩放交互（`hover:scale-[1.02]`）
- 加载/错误/空数据三种状态处理

### 4. CSV导出功能

纯前端实现，无需后端依赖：
```typescript
function exportCSV(rows: TableRow[], filename = 'seo-analysis-export.csv') {
  const headers = ['ID', 'URL', '域名', '评分', '等级', '严重问题', '警告', '建议', '分析时间'];
  const csvRows = [headers.join(',')];
  // ...数据行拼接
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
```

## 验证结论

| 要求 | 实现 |
|------|------|
| 图表库集成 | ✅ recharts（Pie/Bar/Area/Line） |
| 数据统计：计数/平均/排名/趋势 | ✅ 6种API统计 + 8个卡片 |
| 数据仪表盘：多维度展示 | ✅ 8卡片 + 5图表 + 1表格 |
| CSV/Excel导出 | ✅ 纯前端CSV导出 |
| 做一个简单数据看板 | ✅ `/visual-dashboard` |

**模块12：学完了 ✅**
