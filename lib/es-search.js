/**
 * lib/es-search.js — Elasticsearch 高级搜索
 * 
 * 模块14·高级：Elasticsearch 搜索优化
 * 
 * 相比 PostgreSQL 全文搜索，ES 带来的高级能力：
 * 
 * 1. 多字段加权搜索 (multi_match) — 标题权重3x > 内容1x
 * 2. 模糊匹配 (fuzziness) — 自动纠错拼写错误
 * 3. 短语匹配优先 (match_phrase) — 连续词序命中排更前
 * 4. 功能评分 (rank_feature) — 利用 title_boost/recency_boost 字段
 * 5. 搜索建议 (completion suggester) — 实时搜索建议
 * 6. 同义词搜索 (synonym token filter) — 索引时处理同义词
 * 7. 高亮 (highlight) — 搜索结果关键词高亮
 * 8. 聚合统计 (aggregations) — 搜索结果的统计分析
 * 9. 跨索引搜索 — 一次查询多个索引
 * 10. 分面搜索 — 按类型/域名/评分分层统计
 */

import { getESClient, getIndexName, INDEX_DEFINITIONS } from './es-client.js';
import { query, getAvailableDbEnvVars } from './db.js';

const SEARCH_LIMIT = 10;

/**
 * 跨索引全站搜索 — ES 版
 * 
 * @param {Object} params
 * @param {string} params.keyword - 搜索关键词
 * @param {number} params.limit - 返回条数
 * @param {number} params.offset - 分页偏移
 * @param {string} params.source - 可选：articles / scraped / seo / ''
 * @param {boolean} params.fuzzy - 启用模糊匹配 (默认 true)
 * @param {boolean} params.highlight - 启用高亮片段 (默认 true)
 * @param {string} params.sort - 排序: relevance / date / score
 * 
 * @returns {Object} { results, total, aggregations, suggest }
 */
export async function searchES({
  keyword,
  limit = SEARCH_LIMIT,
  offset = 0,
  source = '',
  fuzzy = true,
  highlight = true,
  sort = 'relevance',
}) {
  const es = await getESClient();
  if (!es) {
    throw new Error('Elasticsearch 未配置，请使用 PostgreSQL 搜索回退');
  }

  if (!keyword || !keyword.trim()) {
    return { results: [], total: 0, keyword: '' };
  }

  const cleanKeyword = keyword.trim();
  const searches = [];

  // 构建每个索引的搜索请求
  if (!source || source === 'articles') {
    searches.push({
      index: getIndexName('articles'),
      body: buildSearchBody(cleanKeyword, {
        source: 'articles',
        limit,
        fuzzy,
        highlight,
        sort,
        titleField: 'title',
        contentField: 'content',
        boostFields: ['title^3', 'topic^2', 'content'],
        rankFeatureFields: ['title_boost'],
      }),
    });
  }

  if (!source || source === 'scraped') {
    searches.push({
      index: getIndexName('scraped_pages'),
      body: buildSearchBody(cleanKeyword, {
        source: 'scraped',
        limit,
        fuzzy,
        highlight,
        sort,
        titleField: 'title',
        contentField: 'meta_description',
        boostFields: ['title^3', 'domain^2', 'meta_description', 'og_title^1.5'],
        rankFeatureFields: ['title_boost'],
      }),
    });
  }

  if (!source || source === 'seo') {
    searches.push({
      index: getIndexName('seo_analyses'),
      body: buildSearchBody(cleanKeyword, {
        source: 'seo',
        limit,
        fuzzy,
        highlight: false, // seo 不需要高亮
        sort,
        titleField: 'page_title',
        contentField: null,
        boostFields: ['page_title^2', 'domain^2', 'url'],
        rankFeatureFields: ['score_boost'],
      }),
    });
  }

  if (searches.length === 0) {
    return { results: [], total: 0 };
  }

  // 并发搜索所有索引
  const responses = await Promise.all(
    searches.map(s => es.search(s).catch(err => ({
      error: true,
      index: s.index,
      message: err.message,
      hits: { hits: [], total: { value: 0 } },
    })))
  );

  // 合并结果
  let allResults = [];
  const aggregations = {};
  let totalResults = 0;

  for (const resp of responses) {
    if (resp.error) {
      console.error(`[ES Search] ⚠️ ${resp.index}: ${resp.message}`);
      continue;
    }

    totalResults += typeof resp.hits.total === 'object'
      ? resp.hits.total.value
      : (resp.hits.total || 0);

    for (const hit of resp.hits.hits) {
      const sourceIndex = hit._index;
      let sourceType = 'unknown';

      if (sourceIndex.includes('articles')) sourceType = 'articles';
      else if (sourceIndex.includes('scraped_pages')) sourceType = 'scraped';
      else if (sourceIndex.includes('seo_analyses')) sourceType = 'seo';

      allResults.push({
        id: hit._source.id,
        _score: hit._score,
        source: sourceType,
        index: sourceIndex,
        // 高亮片段
        highlight: hit.highlight || null,
        // 原始字段
        ...hit._source,
      });
    }

    // 收集聚合结果
    if (resp.aggregations) {
      for (const [key, value] of Object.entries(resp.aggregations)) {
        aggregations[key] = value;
      }
    }
  }

  // 按 _score 降序排列
  allResults.sort((a, b) => (b._score || 0) - (a._score || 0));

  // 分页
  const total = allResults.length;
  const paginatedResults = allResults.slice(offset, offset + limit);

  // 搜索建议（拼写纠错）
  let suggest = null;
  try {
    const suggestResponse = await es.search({
      index: searches.map(s => s.index),
      body: {
        suggest: {
          spell_correction: {
            text: cleanKeyword,
            term: {
              field: 'title',
              suggest_mode: 'missing',
              min_word_length: 3,
            },
          },
        },
      },
    });
    suggest = suggestResponse.suggest;
  } catch { /* suggest 失败不阻塞搜索 */ }

  return {
    results: paginatedResults,
    total,
    keyword: cleanKeyword,
    offset,
    limit,
    hasMore: offset + limit < total,
    aggregations: Object.keys(aggregations).length > 0 ? aggregations : undefined,
    suggest: suggest || undefined,
    engine: 'elasticsearch',
  };
}

/**
 * 构建 ES 查询请求体
 * 
 * 高级特性组合：
 * - multi_match: 多字段加权搜索（标题3x > 内容）
 * - fuzziness: 模糊匹配（自动纠错）
 * - match_phrase: 短语匹配（连续词序加分）
 * - rank_feature: 功能评分（热度/时效性加成）
 * - highlight: 高亮片段
 * - aggregations: 聚合统计
 */
function buildSearchBody(keyword, opts) {
  const {
    source,
    limit,
    boostFields = ['title^3', 'content'],
    rankFeatureFields = [],
    fuzzy = true,
    highlight = true,
    sort = 'relevance',
    titleField = 'title',
    contentField = 'content',
  } = opts;

  const mustQueries = [];
  const shouldQueries = [];
  const filterQueries = [];

  // 1. 核心全文搜索 — multi_match (加权 + 模糊)
  const multiMatchQuery = {
    multi_match: {
      query: keyword,
      fields: boostFields,
      type: 'best_fields',
      tie_breaker: 0.3,
      operator: 'or',
      minimum_should_match: '70%',
    },
  };

  if (fuzzy) {
    multiMatchQuery.multi_match.fuzziness = 'AUTO';
    multiMatchQuery.multi_match.prefix_length = 2;
    multiMatchQuery.multi_match.max_expansions = 50;
  }

  mustQueries.push(multiMatchQuery);

  // 2. 短语匹配提升 — 连续词序匹配分数更高
  if (contentField) {
    shouldQueries.push({
      match_phrase: {
        [titleField]: {
          query: keyword,
          boost: 5,
          slop: 2,
        },
      },
    });

    shouldQueries.push({
      match_phrase: {
        [contentField]: {
          query: keyword,
          boost: 2,
          slop: 3,
        },
      },
    });
  } else {
    shouldQueries.push({
      match_phrase: {
        [titleField]: {
          query: keyword,
          boost: 5,
          slop: 2,
        },
      },
    });
  }

  // 3. rank_feature 评分提升（如果存在）
  if (rankFeatureFields.length > 0) {
    for (const field of rankFeatureFields) {
      shouldQueries.push({
        rank_feature: {
          field,
          boost: 0.5,
        },
      });
    }
  }

  // 4. 排序方式
  let sortClause;
  switch (sort) {
    case 'date':
      sortClause = [{ created_at: { order: 'desc' } }, '_score'];
      break;
    case 'score':
      sortClause = [{ score: { order: 'desc' } }, '_score'];
      break;
    default: // relevance
      sortClause = ['_score', { created_at: { order: 'desc' } }];
  }

  // 5. 构建最终请求
  const body = {
    query: {
      bool: {
        must: mustQueries,
        should: shouldQueries,
        filter: filterQueries.length > 0 ? filterQueries : undefined,
      },
    },
    sort: sortClause,
    size: limit,
    from: 0, // 注意：msearch 不支持 from，我们在客户端分页
    _source: {
      excludes: ['content'], // 排除大字段以减小响应体积
    },
  };

  // 6. 高亮
  if (highlight && contentField) {
    body.highlight = {
      fields: {
        [titleField]: {
          fragment_size: 80,
          number_of_fragments: 2,
        },
        [contentField]: {
          fragment_size: 150,
          number_of_fragments: 2,
        },
      },
      pre_tags: ['<mark>'],
      post_tags: ['</mark>'],
    };
  }

  // 7. 聚合统计（仅当搜索所有源时）
  const isSingleSource = source && source !== '';
  if (!isSingleSource) {
    body.aggregations = {
      by_source: {
        terms: { field: '_index', size: 10 },
      },
    };
  }

  return body;
}

/**
 * ES 搜索建议 — completion suggest
 * 
 * 比 PostgreSQL 的 ILIKE 建议更高效：
 * - 基于索引的 completion 建议
 * - 支持前缀匹配
 * - 实时响应（毫秒级）
 */
export async function getESSuggestions(prefix, limit = 5) {
  const es = await getESClient();
  if (!es) return [];

  if (!prefix || prefix.trim().length < 1) return [];

  const cleanPrefix = prefix.trim().toLowerCase();

  try {
    const response = await es.search({
      index: [getIndexName('articles'), getIndexName('scraped_pages')],
      body: {
        _source: false,
        suggest: {
          title_suggest: {
            prefix: cleanPrefix,
            completion: {
              field: 'title',
              size: limit * 2,
              skip_duplicates: true,
              fuzzy: {
                fuzziness: 'AUTO',
              },
            },
          },
        },
      },
    });

    // 提取建议结果
    const suggestions = [];
    if (response.suggest?.title_suggest) {
      for (const entry of response.suggest.title_suggest) {
        for (const option of entry.options || []) {
          if (option.text && !suggestions.includes(option.text)) {
            suggestions.push(option.text);
            if (suggestions.length >= limit) break;
          }
        }
        if (suggestions.length >= limit) break;
      }
    }

    return suggestions;
  } catch (err) {
    console.error('[ES Search] Suggest error:', err.message);
    return [];
  }
}

/**
 * 获取 ES 集群健康状态
 */
export async function getESHealth() {
  const es = await getESClient();
  if (!es) {
    return { status: 'unavailable', message: 'ES 未配置' };
  }

  try {
    const health = await es.cluster.health();
    const stats = await es.nodes.stats();
    const info = await es.info();

    return {
      status: health.status, // green / yellow / red
      clusterName: health.cluster_name,
      nodeCount: health.number_of_nodes,
      activeShards: health.active_shards,
      activePrimaryShards: health.active_primary_shards,
      unassignedShards: health.unassigned_shards,
      esVersion: info.version.number,
      indices: health.active_shards > 0 ? health.initializing_shards + health.active_shards : 0,
      memoryUsage: stats?.nodes
        ? Object.values(stats.nodes)[0]?.jvm?.mem?.heap_used_percent
        : null,
    };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

export default {
  searchES,
  getESSuggestions,
  getESHealth,
};
