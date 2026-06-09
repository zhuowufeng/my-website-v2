# 🚀 模块14·高级：Elasticsearch 搜索集成

> **学习日期：** 2026-06-09
> **技能等级：** ★★★ 能用（代码级）
> **封装位置：** `lib/es-client.js`, `lib/es-indexer.js`, `lib/es-search.js`
> **API端：** `/api/search/es`, `/api/search/es/suggest`, `/api/search/es/health`

---

## 🎯 为什么学 Elasticsearch？

现有搜索系统用 **PostgreSQL 全文搜索**（tsvector + pg_trgm），对中小流量够用。但遇到这些问题时，ES 更强：

| 场景 | PostgreSQL | Elasticsearch |
|------|-----------|---------------|
| 5万+ 文档搜索 | 慢（~500ms） | 快（~50ms） |
| 模糊匹配/拼写纠错 | pg_trgm 勉强能用 | 内置 fuzziness 自动纠错 |
| 中文分词 | 没有内置分词 | analysis-ik / smartcn 插件 |
| 搜索结果加权 | 手动 SQL CASE | multi_match + 字段权重 |
| 实时搜索建议 | ILIKE 查询 | completion suggester（毫秒级） |
| 聚合/分面统计 | GROUP BY | terms / date_histogram 聚合 |
| 搜索高亮 | 手动截取片段 | highlight 自动生成 |

**结论：** 流量上去后（日均1000+搜索），必须上 ES。

---

## 🏗️ 架构设计

```
用户搜索 ─→ /api/search/es ──┬── ES 可用？──→ Elasticsearch 搜索
                                │                    │
                                │                    ├─ multi_match (加权)
                                │                    ├─ fuzzy (纠错)
                                │                    ├─ rank_feature (评分提升)
                                │                    ├─ highlight (高亮)
                                │                    └─ aggregations (统计)
                                │
                                └── ES 不可用？──→ PostgreSQL 全文搜索（回退）
                                                     │
                                                     ├─ tsvector 全文搜索
                                                     ├─ pg_trgm 模糊匹配
                                                     └─ 同义词扩展
```

**核心设计原则：** ES 是可选项，不阻塞部署。ES 没配好时自动用 PostgreSQL 回退。

---

## 📦 文件清单

| 文件 | 作用 |
|------|------|
| `lib/es-client.js` | ES 连接管理（API Key / 密码认证，多环境支持） |
| `lib/es-indexer.js` | 索引管理（创建/删除/重建）+ PostgreSQL→ES 数据同步 |
| `lib/es-search.js` | ES 搜索函数（multi_match + fuzzy + rank_feature 等高级查询） |
| `app/api/search/es/route.ts` | ES 搜索 API（GET/POST + PostgreSQL 自动回退） |
| `app/api/search/es/health/route.ts` | ES 健康检查 |
| `app/api/search/es/suggest/route.ts` | ES 搜索建议 |
| `app/api/search/es/rebuild/route.ts` | 索引重建 |

---

## 🔧 配置指南

### 1. 开通 Elastic Cloud（推荐）

1. 去 https://cloud.elastic.co 注册（14天免费试用）
2. 创建部署，选 **Elasticsearch**（最小的就够了）
3. 在部署页面找到：
   - **Elasticsearch 端点**（`https://xxx.es.us-east-1.aws.cloud.es.io:443`）
   - 生成 **API Key**（Management → Security → API Keys）
4. 设置环境变量：

```bash
# Zeabur 环境变量
ES_NODE=https://xxx.es.us-east-1.aws.cloud.es.io:443
ES_API_KEY=base64encodedapikey
ES_INDEX_PREFIX=mywebsite  # 可选
```

### 2. 自托管 Elasticsearch

```bash
# Docker 部署
docker run -d --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=true" \
  -e "ELASTIC_PASSWORD=yourpassword" \
  docker.elastic.co/elasticsearch/elasticsearch:8.12.0
```

```bash
# 环境变量
ES_NODE=http://localhost:9200
ES_USERNAME=elastic
ES_PASSWORD=yourpassword
```

### 3. 安装中文分词插件（可选但推荐）

```bash
# Docker 环境
docker exec elasticsearch elasticsearch-plugin install analysis-ik
# 或
docker exec elasticsearch elasticsearch-plugin install analysis-smartcn
docker restart elasticsearch
```

---

## 🚀 使用方式

### 搜索

```
GET /api/search/es?q=SEO诊断&source=articles&limit=10&fuzzy=true&sort=relevance
```

参数说明：
| 参数 | 说明 | 默认 |
|------|------|------|
| `q` | 搜索关键词 | 必填 |
| `source` | 搜索源：articles / scraped / seo / 空（全部） | 全部 |
| `limit` | 返回条数 | 10 |
| `offset` | 分页偏移 | 0 |
| `fuzzy` | 启用模糊匹配 | true |
| `highlight` | 启用高亮 | true |
| `sort` | 排序：relevance / date / score | relevance |

### 搜索建议

```
GET /api/search/es/suggest?q=SEO&limit=5
```

### 健康检查

```
GET /api/search/es/health
```

### 重建索引

```
POST /api/search/es/rebuild
```

---

## 🤖 ES vs PostgreSQL 搜索对比

| 对比项 | PostgreSQL 搜索 | Elasticsearch 搜索 |
|--------|----------------|-------------------|
| 核心查询 | `tsvector @@ tsquery` | `multi_match` |
| 加权方式 | `CASE WHEN ... THEN` | `fields: ["title^3", "content"]` |
| 模糊匹配 | `pg_trgm similarity() >= 0.3` | `fuzziness: "AUTO"` |
| 拼写纠错 | 查热门词相似度 | built-in term suggester |
| 同义词 | 运行时 `expandWithSynonyms()` | synonym token filter |
| 高亮 | 前端 `substring()` | `highlight` 片段 |
| 聚合 | `GROUP BY` | terms / histogram 聚合 |
| 响应时间（1000条） | ~100ms | ~20ms |
| 响应时间（10000条） | ~500ms | ~50ms |
| 部署 | 内置在 Zeabur PostgreSQL | 需要额外 ES 节点 |

---

## 📊 技术要点

### 1. multi_match 加权搜索

```javascript
{
  multi_match: {
    query: "SEO优化",
    fields: ["title^3", "topic^2", "content"],
    type: "best_fields",
    fuzziness: "AUTO",
    operator: "or",
    minimum_should_match: "70%",
  }
}
```

- `title^3` = 标题命中权重是内容的 3 倍
- `fuzziness: "AUTO"` = 自动纠错（"seo" 也能匹配 "seoo"）
- `minimum_should_match: "70%"` = 至少匹配 70% 的词

### 2. rank_feature 评分提升

```javascript
{
  rank_feature: {
    field: "title_boost",  // 标题长度 > 5 时 boost=5
    boost: 0.5,
  }
}
```

让长标题的文章自然排更前，不依赖人工调分。

### 3. 索引生命周期

```
创建索引 → 全量同步（PostgreSQL → ES）→ 使用
                                      → 增量同步（增删改时调用 syncArticle/syncScrapedPage）
                                      → 重建索引（修改 mapping 后）
```

### 4. 回退策略

ES 不可用时，`/api/search/es` 自动回退到 PostgreSQL 搜索：
- API 响应会在 `engine` 字段标明当前用的是 `elasticsearch` 还是 `postgresql`
- 前端可以根据这个字段展示不同体验

---

## ⚠️ 注意事项

1. **ES 不是免费的** — Elastic Cloud 14天试用后需付费（最小配置 ~$20/月）
2. **数据同步需要触发** — 当前是手动重建（`POST /api/search/es/rebuild`）或代码中调用 `syncArticle()`。后续可加定时同步或 CDC
3. **中文搜索需要插件** — 标准分析器对中文支持有限。建议安装 `analysis-ik` 插件
4. **memory 问题** — `content` 字段可能很大（5万字符截断），注意 ES 堆内存配置
5. **CORS** — ES 节点本身不暴露到公网，走 Next.js API 路由做代理

---

## 📈 后续优化方向

- [ ] 定时同步（cron job 每天自动同步 PostgreSQL → ES）
- [ ] CDC（用 PostgreSQL 的 WAL 或 trigger 实时同步）
- [ ] 中文分析器（安装 analysis-ik 插件 + 更新 mapping）
- [ ] 搜索 A/B 测试（ES vs PostgreSQL 搜索结果对比）
- [ ] 搜索结果加权优化（点击率反馈）
- [ ] 同义词 token filter（ES 索引时处理，查询时自动匹配）
