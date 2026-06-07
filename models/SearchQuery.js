/**
 * models/SearchQuery.js — 模块14：搜索能力
 *
 * 全站搜索核心层
 * 功能：
 * - 跨表全文搜索（articles / scraped_pages / seo_analyses）
 * - PostgreSQL tsvector 全文搜索 + ILIKE 回退
 * - 中文搜索支持（pg_trgm 模糊匹配）
 * - 搜索建议
 * - 搜索历史记录
 * - 搜索统计/热词
 */

import { query } from '../lib/db.js';
import { appCache, SEARCH_CACHE_TTL } from '../lib/cache';

const SEARCH_LIMIT = 10;
const SUGGESTION_LIMIT = 5;
const TYPO_THRESHOLD = 0.3; // pg_trgm similarity threshold for typo correction

// ==================== 同义词管理 ====================

/**
 * 获取同义词映射
 * 如果用户搜 "SEO"，也会匹配 "搜索引擎优化"、"搜索引擎" 等
 */
let synonymCache = null;
let synonymCacheTime = 0;
const SYNONYM_CACHE_TTL = 600_000; // 10 min

async function getSynonymMap() {
  const now = Date.now();
  if (synonymCache && now - synonymCacheTime < SYNONYM_CACHE_TTL) {
    return synonymCache;
  }

  const synonymMap = new Map();
  try {
    const result = await query('SELECT word, synonyms FROM search_synonyms WHERE enabled = true', []);
    for (const row of result.rows) {
      const words = JSON.parse(row.synonyms || '[]');
      if (Array.isArray(words)) {
        // Normalize: lowercase for matching
        const normalized = words.map(w => w.toLowerCase());
        synonymMap.set(row.word.toLowerCase(), normalized);
        // Also map each synonym back to the full group
        for (const w of normalized) {
          const existing = synonymMap.get(w) || [];
          synonymMap.set(w, [...new Set([...existing, ...normalized, row.word.toLowerCase()])]);
        }
      }
    }
  } catch (err) {
    // Table might not exist yet
    if (!err.message.includes('does not exist')) {
      console.error('[SearchQuery] Failed to load synonyms:', err.message);
    }
  }

  synonymCache = synonymMap;
  synonymCacheTime = now;
  return synonymMap;
}

/**
 * 扩展查询词：加入同义词
 * 如 "SEO" → ["seo", "搜索引擎优化", "搜索引擎"]
 */
async function expandWithSynonyms(keyword) {
  const synonymMap = await getSynonymMap();
  const expanded = synonymMap.get(keyword.toLowerCase());
  if (expanded && expanded.length > 0) {
    return [...new Set([keyword.toLowerCase(), ...expanded])];
  }
  return [keyword];
}

/**
 * 拼写纠错 — 基于 pg_trgm 相似度
 * 用户搜 "seoo" → 纠错为 "seo"
 */
async function correctTypo(keyword) {
  if (!keyword || keyword.length < 3) return keyword;

  try {
    // Check if pg_trgm is available
    const extCheck = await query(
      "SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'", []
    );
    if (extCheck.rows.length === 0) return keyword;

    // Collect candidate terms from various sources
    const terms = new Set();

    // From search history (most popular keywords)
    const historyTerms = await query(
      `SELECT keyword, COUNT(*) as cnt
       FROM search_history
       WHERE searched_at > CURRENT_TIMESTAMP - INTERVAL '90 days'
       GROUP BY keyword
       ORDER BY cnt DESC
       LIMIT 50`,
      []
    );
    for (const row of historyTerms.rows) {
      terms.add(row.keyword);
    }

    // From articles
    const articleTerms = await query(
      `SELECT lower(unnest(regexp_split_to_array(topic, E'\\s+'))) as word
       FROM articles WHERE topic IS NOT NULL
       LIMIT 100`,
      []
    );
    for (const row of articleTerms.rows) {
      if (row.word && row.word.length > 1) terms.add(row.word);
    }

    if (terms.size === 0) return keyword;

    // Find best match by pg_trgm similarity
    let bestMatch = keyword;
    let bestScore = 0;

    for (const term of terms) {
      if (term.toLowerCase() === keyword.toLowerCase()) {
        // Exact match already exists, no correction needed
        return keyword;
      }
      try {
        const simResult = await query(
          `SELECT similarity($1, $2) as sim`,
          [keyword.toLowerCase(), term.toLowerCase()]
        );
        const sim = parseFloat(simResult.rows[0]?.sim || 0);
        if (sim > bestScore) {
          bestScore = sim;
          bestMatch = term;
        }
      } catch { /* skip */ }
    }

    // Only correct if similarity is above threshold
    if (bestScore >= TYPO_THRESHOLD && bestMatch.toLowerCase() !== keyword.toLowerCase()) {
      console.log(`[SearchQuery] Typo corrected: "${keyword}" → "${bestMatch}" (sim: ${bestScore.toFixed(2)})`);
      return bestMatch;
    }
  } catch (err) {
    console.error('[SearchQuery] Typo correction failed:', err.message);
  }

  return keyword;
}

/**
 * 初始化同义词表
 */
export async function initSynonymTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS search_synonyms (
      id SERIAL PRIMARY KEY,
      word VARCHAR(255) NOT NULL UNIQUE,
      synonyms TEXT NOT NULL DEFAULT '[]',
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('[SearchQuery] search_synonyms table ready');

  // Seed default synonyms if table is empty
  const count = await query('SELECT COUNT(*) as cnt FROM search_synonyms', []);
  if (parseInt(count.rows[0].cnt) === 0) {
    const defaultSynonyms = [
      { word: 'seo', synonyms: ['搜索引擎优化', '搜索引擎', 'search engine optimization', '排名', '排名优化'] },
      { word: '爬虫', synonyms: ['爬取', '抓取', '数据采集', 'crawler', 'spider', '网络爬虫'] },
      { word: '网站', synonyms: ['站点', '网页', '页面', 'web', 'website', 'site'] },
      { word: '诊断', synonyms: ['检测', '检查', '分析', 'audit', 'analyze', 'diag'] },
      { word: '速度', synonyms: ['性能', '加载速度', 'performance', 'speed', '加载时间'] },
      { word: '手机', synonyms: ['移动', 'mobile', '移动端', '移动设备', '响应式'] },
      { word: '缓存', synonyms: ['cache', '缓存技术', '页面缓存'] },
      { word: '图片', synonyms: ['image', '图片优化', '图片压缩', 'img', '图像'] },
      { word: '文章', synonyms: ['博客', 'blog', '文章内容', '帖子', 'post'] },
      { word: '安全', synonyms: ['security', 'ssl', 'https', '证书', '加密'] },
      { word: '链接', synonyms: ['link', '外部链接', '内链', '外链', 'backlink', '反向链接'] },
      { word: '域名', synonyms: ['domain', '网址', '网站地址', 'url'] },
      { word: '关键词', synonyms: ['关键字', 'keyword', '搜索词', '搜索关键词'] },
    ];

    for (const syn of defaultSynonyms) {
      try {
        await query(
          `INSERT INTO search_synonyms (word, synonyms) VALUES ($1, $2)`,
          [syn.word, JSON.stringify(syn.synonyms)]
        );
      } catch { /* skip duplicates */ }
    }
    console.log('[SearchQuery] Default synonyms seeded');
  }

  synonymCache = null; // Reset cache
}

/**
 * 搜索索引元数据表
 */
export async function initSearchIndexMetadata() {
  await query(`
    CREATE TABLE IF NOT EXISTS search_index_meta (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL, -- articles, scraped_pages, seo_analyses
      entity_count INTEGER DEFAULT 0,
      index_size_bytes BIGINT DEFAULT 0,
      last_indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      index_version INTEGER DEFAULT 1
    );
  `);
  console.log('[SearchQuery] search_index_meta table ready');
}

/**
 * 更新搜索索引元数据
 */
export async function updateSearchIndexMetadata() {
  const entities = ['articles', 'scraped_pages', 'seo_analyses'];

  for (const entity of entities) {
    try {
      const countResult = await query(
        `SELECT COUNT(*) as cnt FROM ${entity}`,
        []
      );
      const count = parseInt(countResult.rows[0]?.cnt || '0');

      await query(`
        INSERT INTO search_index_meta (entity_type, entity_count, index_version, last_indexed_at)
        VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (entity_type)
        DO UPDATE SET
          entity_count = EXCLUDED.entity_count,
          index_version = search_index_meta.index_version + 1,
          last_indexed_at = CURRENT_TIMESTAMP
      `, [entity, count]);
    } catch (err) {
      console.error(`[SearchQuery] Failed to update index meta for ${entity}:`, err.message);
    }
  }
}

/**
 * 获取搜索索引状态
 */
export async function getSearchIndexStatus() {
  try {
    const result = await query(
      'SELECT * FROM search_index_meta ORDER BY entity_type', []
    );
    return result.rows;
  } catch (err) {
    console.error('[SearchQuery] Failed to get index status:', err.message);
    return [];
  }
}

/**
 * 重建搜索索引（重新创建全文索引）
 */
export async function rebuildSearchIndex() {
  const results = [];

  const indexes = [
    {
      entity: 'articles',
      name: 'idx_articles_search_rebuilt',
      sql: `CREATE INDEX IF NOT EXISTS idx_articles_search_rebuilt
            ON articles USING gin(to_tsvector('simple',
              coalesce(title, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(content, '')
            ))`,
    },
    {
      entity: 'articles',
      name: 'idx_articles_title_trgm',
      sql: `CREATE INDEX IF NOT EXISTS idx_articles_title_trgm
            ON articles USING gin (title gin_trgm_ops)`,
    },
    {
      entity: 'scraped_pages',
      name: 'idx_scraped_pages_search',
      sql: `CREATE INDEX IF NOT EXISTS idx_scraped_pages_search
            ON scraped_pages USING gin(to_tsvector('simple',
              coalesce(title, '') || ' ' || coalesce(meta_description, '') || ' ' || coalesce(domain, '')
            ))`,
    },
    {
      entity: 'scraped_pages',
      name: 'idx_scraped_pages_title_trgm',
      sql: `CREATE INDEX IF NOT EXISTS idx_scraped_pages_title_trgm
            ON scraped_pages USING gin (title gin_trgm_ops)`,
    },
  ];

  for (const idx of indexes) {
    try {
      const startTime = Date.now();
      await query(idx.sql, []);
      results.push({
        entity: idx.entity,
        index: idx.name,
        status: 'created',
        duration: Date.now() - startTime,
      });
    } catch (err) {
      results.push({
        entity: idx.entity,
        index: idx.name,
        status: 'failed',
        error: err.message,
      });
    }
  }

  // Update metadata after rebuild
  await updateSearchIndexMetadata();

  return results;
}


// ==================== 搜索历史 ====================

/**
 * 记录搜索历史
 */
export async function recordSearch({ userId, keyword, resultCount, source }) {
  if (!keyword || !keyword.trim()) return;
  try {
    await query(
      `INSERT INTO search_history (user_id, keyword, result_count, source, searched_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [userId || null, keyword.trim().toLowerCase(), resultCount || 0, source || 'site']
    );
  } catch (err) {
    console.error('[SearchQuery] Failed to record search:', err.message);
  }
}

/**
 * 获取用户搜索历史（最近N条）
 */
export async function getSearchHistory(userId, limit = 10) {
  if (!userId) return [];
  const result = await query(
    `SELECT DISTINCT keyword, MAX(searched_at) as last_searched, SUM(result_count) as total_results
     FROM search_history
     WHERE user_id = $1
     GROUP BY keyword
     ORDER BY last_searched DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * 删除搜索历史
 */
export async function deleteSearchHistory(userId, keyword) {
  if (keyword) {
    await query(
      'DELETE FROM search_history WHERE user_id = $1 AND keyword = $2',
      [userId, keyword]
    );
  } else {
    await query(
      'DELETE FROM search_history WHERE user_id = $1',
      [userId]
    );
  }
}

// ==================== 搜索热词统计 ====================

/**
 * 获取热门搜索词
 */
export async function getHotSearchTerms(limit = 10, days = 7) {
  const cacheKey = `search:hot:${limit}:${days}`;
  const cached = appCache.get(cacheKey);
  if (cached) return cached;

  const result = await query(
    `SELECT keyword,
            COUNT(*) as search_count,
            AVG(result_count)::int as avg_results,
            MAX(searched_at) as last_searched
     FROM search_history
     WHERE searched_at > CURRENT_TIMESTAMP - INTERVAL '${days} days'
     GROUP BY keyword
     ORDER BY search_count DESC
     LIMIT $1`,
    [limit]
  );

  appCache.set(cacheKey, result.rows, { ttl: 300_000 }); // 5 min cache
  return result.rows;
}

/**
 * 获取零结果搜索词（用户搜了但没找到内容）
 */
export async function getZeroResultTerms(limit = 20, days = 30) {
  const cacheKey = `search:zero:${limit}:${days}`;
  const cached = appCache.get(cacheKey);
  if (cached) return cached;

  const result = await query(
    `SELECT keyword, COUNT(*) as search_count, MAX(searched_at) as last_searched
     FROM search_history
     WHERE result_count = 0
       AND searched_at > CURRENT_TIMESTAMP - INTERVAL '${days} days'
     GROUP BY keyword
     ORDER BY search_count DESC
     LIMIT $1`,
    [limit]
  );

  appCache.set(cacheKey, result.rows, { ttl: 600_000 });
  return result.rows;
}

// ==================== 全文搜索 ====================

/**
 * 全站搜索 — 跨表搜索，统一返回格式
 *
 * 搜索范围：
 * - articles: title + topic + content
 * - scraped_pages: title + meta_description
 * - seo_analyses: url + domain
 *
 * 中级功能：
 * - 同义词扩展：搜 "SEO" 也能匹配 "搜索引擎优化"
 * - 拼写纠错：搜 "seoo" 自动纠正为 "seo"
 * - 优化排序：标题权重 > 内容权重 + 时间衰减 + 热门度
 */
export async function searchAll({ keyword, limit = SEARCH_LIMIT, offset = 0, source, userId, enableTypoCorrection = true, enableSynonyms = true }) {
  if (!keyword || !keyword.trim()) {
    return { results: [], total: 0 };
  }

  let cleanKeyword = keyword.trim();
  let wasCorrected = false;
  let correctedFrom = null;

  // Typo correction (intermediate feature)
  if (enableTypoCorrection) {
    const corrected = await correctTypo(cleanKeyword);
    if (corrected.toLowerCase() !== cleanKeyword.toLowerCase()) {
      correctedFrom = cleanKeyword;
      cleanKeyword = corrected;
      wasCorrected = true;
    }
  }

  // Synonym expansion (intermediate feature)
  let searchTerms = [cleanKeyword];
  if (enableSynonyms) {
    const expanded = await expandWithSynonyms(cleanKeyword);
    searchTerms = expanded;
  }

  const results = [];
  const seen = new Set(); // Deduplicate across synonym groups

  // Search with primary keyword, then fall back to synonyms if few results
  for (let termIndex = 0; termIndex < searchTerms.length; termIndex++) {
    const term = searchTerms[termIndex];

    // 1. Search articles
    if (!source || source === 'articles') {
      try {
        const articleResults = await searchArticles(term, { limit, offset: 0 });
        for (const r of articleResults.results) {
          const key = `articles-${r.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            // Boost synonym results slightly less than primary
            const synonymBoost = termIndex === 0 ? 1.0 : 0.85;
            results.push({ ...r, source: 'articles', rank: (r.rank || 0) * synonymBoost });
          }
        }
      } catch (err) {
        console.error('[SearchQuery] Articles search error:', err.message);
      }
    }

    // 2. Search scraped_pages
    if (!source || source === 'scraped') {
      try {
        const scrapedResults = await searchScrapedPages(term, { limit, offset: 0 });
        for (const r of scrapedResults.results) {
          const key = `scraped-${r.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            const synonymBoost = termIndex === 0 ? 1.0 : 0.85;
            results.push({ ...r, source: 'scraped', rank: (r.rank || 0) * synonymBoost });
          }
        }
      } catch (err) {
        console.error('[SearchQuery] Scraped search error:', err.message);
      }
    }

    // 3. Search seo_analyses
    if (!source || source === 'seo') {
      try {
        const seoResults = await searchSEOAnalyses(term, { limit, offset: 0 });
        for (const r of seoResults.results) {
          const key = `seo-${r.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            const synonymBoost = termIndex === 0 ? 1.0 : 0.85;
            results.push({ ...r, source: 'seo', rank: (r.rank || 0) * synonymBoost });
          }
        }
      } catch (err) {
        console.error('[SearchQuery] SEO search error:', err.message);
      }
    }

    // If primary keyword already returned enough results, skip synonym search
    if (termIndex === 0 && results.length >= limit * 2) break;
  }

  // Sort by relevance (rank desc) with time decay
  const now = Date.now();
  results.sort((a, b) => {
    const rankDiff = (b.rank || 0) - (a.rank || 0);
    if (Math.abs(rankDiff) > 0.1) return rankDiff;

    // Time boost: newer content gets higher rank when relevance is close
    const aTime = a.created_at ? now - new Date(a.created_at).getTime() : Infinity;
    const bTime = b.created_at ? now - new Date(b.created_at).getTime() : Infinity;
    return aTime - bTime;
  });

  // Paginate combined results
  const total = results.length;
  const paginatedResults = results.slice(offset, offset + limit);

  return {
    results: paginatedResults,
    total,
    keyword: cleanKeyword,
    correctedFrom,
    wasCorrected,
    expandedTerms: searchTerms.length > 1 ? searchTerms : undefined,
    offset,
    limit,
    hasMore: offset + limit < total,
  };
}

/**
 * 搜索文章（标题 + 主题 + 内容摘要）
 * 中级：优化排序 — 标题关键词命中加成，内容长度归一化
 */
async function searchArticles(keyword, { limit, offset }) {
  // Try PostgreSQL full-text search first
  try {
    const searchSql = `
      SELECT id, title, topic, article_type,
             substring(content, 1, 250) as content_preview,
             word_count, created_at,
             (
               -- Full-text rank
               COALESCE(ts_rank(
                 to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(content, '')),
                 plainto_tsquery('simple', $1)
               ), 0)
               +
               -- Title exact match boost (权重 2x)
               CASE WHEN lower(title) LIKE lower('%' || $1 || '%') THEN 2.0 ELSE 0 END
               +
               -- Topic match boost
               CASE WHEN lower(topic) LIKE lower('%' || $1 || '%') THEN 1.0 ELSE 0 END
             ) AS rank
      FROM articles
      WHERE to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(content, ''))
            @@ plainto_tsquery('simple', $1)
         OR lower(title) LIKE lower('%' || $1 || '%')
         OR lower(topic) LIKE lower('%' || $1 || '%')
      ORDER BY rank DESC, created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await query(searchSql, [keyword, limit, offset]);

    const countSql = `
      SELECT COUNT(*) as total
      FROM articles
      WHERE to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(content, ''))
            @@ plainto_tsquery('simple', $1)
         OR lower(title) LIKE lower('%' || $1 || '%')
         OR lower(topic) LIKE lower('%' || $1 || '%');
    `;
    const countResult = await query(countSql, [keyword]);
    return {
      results: result.rows,
      total: parseInt(countResult.rows[0].total),
    };
  } catch (err) {
    // Fallback to ILIKE
    console.log('[SearchQuery] Full-text search failed, fallback to ILIKE:', err.message);
    return searchArticlesILIKE(keyword, { limit, offset });
  }
}

/**
 * ILIKE 模糊搜索文章（全文搜索回退方案）
 * 中级：优化排序 — 标题/内容权重差异化
 */
async function searchArticlesILIKE(keyword, { limit, offset }) {
  const likePattern = `%${keyword}%`;
  const result = await query(
    `SELECT id, title, topic, article_type,
            substring(content, 1, 250) as content_preview,
            word_count, created_at,
            CASE
              WHEN title ILIKE $1 AND topic ILIKE $1 THEN 3.5
              WHEN title ILIKE $1 THEN 3.0
              WHEN topic ILIKE $1 THEN 2.0
              ELSE 0.5
            END as rank
     FROM articles
     WHERE title ILIKE $1 OR topic ILIKE $1 OR content ILIKE $1
     ORDER BY rank DESC, created_at DESC
     LIMIT $2 OFFSET $3`,
    [likePattern, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM articles
     WHERE title ILIKE $1 OR topic ILIKE $1 OR content ILIKE $1`,
    [likePattern]
  );

  return {
    results: result.rows,
    total: parseInt(countResult.rows[0].total),
  };
}

/**
 * 搜索爬取页面（标题 + 描述）
 * 中级：domain精确匹配加成，OG数据权重
 */
async function searchScrapedPages(keyword, { limit, offset }) {
  const likePattern = `%${keyword}%`;
  const result = await query(
    `SELECT id, url, domain, title, meta_description,
            og_title, og_image,
            word_count, status_code, crawled_at,
            CASE
              WHEN domain ILIKE $1 AND title ILIKE $1 THEN 3.0
              WHEN title ILIKE $1 OR og_title ILIKE $1 THEN 2.0
              WHEN domain ILIKE $1 THEN 1.5
              WHEN meta_description ILIKE $1 THEN 1.0
              ELSE 0.5
            END as rank
     FROM scraped_pages
     WHERE title ILIKE $1 OR meta_description ILIKE $1 OR domain ILIKE $1 OR og_title ILIKE $1
     ORDER BY rank DESC, crawled_at DESC
     LIMIT $2 OFFSET $3`,
    [likePattern, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM scraped_pages
     WHERE title ILIKE $1 OR meta_description ILIKE $1 OR domain ILIKE $1 OR og_title ILIKE $1`,
    [likePattern]
  );

  return {
    results: result.rows,
    total: parseInt(countResult.rows[0].total),
  };
}

/**
 * 搜索SEO分析报告（URL + 域名）
 * 中级：评分加权，多维度匹配
 */
async function searchSEOAnalyses(keyword, { limit, offset }) {
  const likePattern = `%${keyword}%`;
  const result = await query(
    `SELECT id, url, domain, score, grade,
            report->>'title' as page_title,
            created_at,
            (
              CASE
                WHEN domain ILIKE $1 AND (report->>'title') ILIKE $1 THEN 3.0
                WHEN domain ILIKE $1 THEN 2.0
                WHEN url ILIKE $1 THEN 1.5
                WHEN (report->>'title') ILIKE $1 THEN 1.0
                ELSE 0.5
              END
              +
              -- Score boost: higher scored pages slightly prioritized for same relevance
              CASE WHEN score > 80 THEN 0.3 WHEN score > 60 THEN 0.2 WHEN score > 40 THEN 0.1 ELSE 0 END
            ) as rank
     FROM seo_analyses
     WHERE url ILIKE $1 OR domain ILIKE $1 OR (report->>'title') ILIKE $1
     ORDER BY rank DESC, created_at DESC
     LIMIT $2 OFFSET $3`,
    [likePattern, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM seo_analyses
     WHERE url ILIKE $1 OR domain ILIKE $1 OR (report->>'title') ILIKE $1`,
    [likePattern]
  );

  return {
    results: result.rows,
    total: parseInt(countResult.rows[0].total),
  };
}

// ==================== 搜索建议（自动补全） ====================

/**
 * 搜索建议 — 基于已有内容生成自动补全建议（中级优化版）
 *
 * 中级改进：
 * 1. 按热门度排序建议（搜的多的排前面）
 * 2. 同义词扩展：输入 "se" 建议 "seo", "搜索引擎优化"
 * 3. 模糊匹配支持（pg_trgm）
 * 4. 去重 + 智能排序（完全匹配 > 前缀匹配 > 模糊匹配）
 */
export async function getSearchSuggestions(prefix, limit = SUGGESTION_LIMIT) {
  if (!prefix || prefix.trim().length < 1) return [];

  const cleanPrefix = prefix.trim().toLowerCase();
  const cacheKey = `search:suggest:v2:${cleanPrefix}`;
  const cached = appCache.get(cacheKey);
  if (cached) return cached;

  const suggestions = new Map(); // word → score

  // 1. From search history — most popular searches first
  try {
    const historyResult = await query(
      `SELECT keyword, COUNT(*) as cnt
       FROM search_history
       WHERE LOWER(keyword) % $1 OR LOWER(keyword) ILIKE $2
       GROUP BY keyword
       ORDER BY
         CASE WHEN LOWER(keyword) = $1 THEN 100
              WHEN LOWER(keyword) ILIKE $3 THEN 50
              ELSE similarity(LOWER(keyword), $1) * 30
         END DESC,
         cnt DESC
       LIMIT $4`,
      [cleanPrefix, `${cleanPrefix}%`, `${cleanPrefix}%`, limit * 2]
    );
    for (const row of historyResult.rows) {
      const score = row.keyword.toLowerCase() === cleanPrefix ? 100
                  : row.keyword.toLowerCase().startsWith(cleanPrefix) ? 50 + Math.min(row.cnt, 20)
                  : 20 + Math.min(row.cnt, 10);
      suggestions.set(row.keyword, Math.max(suggestions.get(row.keyword) || 0, score));
    }
  } catch { /* skip if trigram operator not available */ }

  // Fallback to ILIKE if no history suggestions
  if (suggestions.size < 2) {
    try {
      const historyFallback = await query(
        `SELECT keyword, COUNT(*) as cnt
         FROM search_history
         WHERE LOWER(keyword) ILIKE $1
         GROUP BY keyword
         ORDER BY cnt DESC
         LIMIT $2`,
        [`${cleanPrefix}%`, limit]
      );
      for (const row of historyFallback.rows) {
        if (!suggestions.has(row.keyword)) {
          suggestions.set(row.keyword, 40 + Math.min(row.cnt, 15));
        }
      }
    } catch { /* skip */ }
  }

  // 2. From articles — suggest topic keywords
  try {
    const articleResult = await query(
      `SELECT DISTINCT lower(unnest(regexp_split_to_array(topic, E'\\s+'))) as word
       FROM articles
       WHERE LOWER(topic) ILIKE $1
          OR LOWER(title) ILIKE $1
       LIMIT $2`,
      [`${cleanPrefix}%`, limit]
    );
    for (const row of articleResult.rows) {
      if (row.word && row.word.length > 1 && !suggestions.has(row.word)) {
        const score = row.word.startsWith(cleanPrefix) ? 30 : 15;
        suggestions.set(row.word, score);
      }
    }
  } catch { /* skip */ }

  // 3. From scraped pages — suggest domains
  try {
    const scrapedResult = await query(
      `SELECT DISTINCT lower(split_part(domain, '.', 1)) as word
       FROM scraped_pages
       WHERE LOWER(domain) ILIKE $1
       LIMIT $2`,
      [`${cleanPrefix}%`, limit]
    );
    for (const row of scrapedResult.rows) {
      if (row.word && row.word.length > 1 && !suggestions.has(row.word)) {
        const score = row.word.startsWith(cleanPrefix) ? 20 : 10;
        suggestions.set(row.word, score);
      }
    }
  } catch { /* skip */ }

  // 4. Include synonym keywords that match the prefix
  try {
    const synonymMap = await getSynonymMap();
    for (const [word, synonyms] of synonymMap) {
      if (word.startsWith(cleanPrefix) && !suggestions.has(word)) {
        suggestions.set(word, 25);
      }
      for (const syn of synonyms) {
        if (syn.startsWith(cleanPrefix) && !suggestions.has(syn)) {
          suggestions.set(syn, 20);
        }
      }
    }
  } catch { /* skip */ }

  // Sort by score descending, then alphabetically
  const result = Array.from(suggestions.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);

  appCache.set(cacheKey, result, { ttl: 300_000 }); // 5 min cache
  return result;
}

// ==================== 数据库初始化 ====================

/**
 * 创建搜索相关表和扩展
 * 包含中级功能：同义词表、索引元数据
 */
export async function initSearchTables() {
  // 尝试启用 pg_trgm 扩展（用于模糊搜索和相似度排序）
  try {
    await query('CREATE EXTENSION IF NOT EXISTS pg_trgm', []);
    console.log('[SearchQuery] pg_trgm extension enabled');
  } catch (err) {
    console.log('[SearchQuery] pg_trgm extension not available (might need superuser):', err.message);
  }

  // 搜索历史表
  await query(`
    CREATE TABLE IF NOT EXISTS search_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      keyword VARCHAR(500) NOT NULL,
      result_count INTEGER DEFAULT 0,
      source VARCHAR(50) DEFAULT 'site',
      searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('[SearchQuery] search_history table ready');

  // 索引
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, searched_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_search_history_keyword ON search_history(keyword)',
    'CREATE INDEX IF NOT EXISTS idx_search_history_searched ON search_history(searched_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_search_history_zero ON search_history(searched_at DESC) WHERE result_count = 0',
    // pg_trgm 索引（如果扩展可用）
    'CREATE INDEX IF NOT EXISTS idx_search_history_keyword_trgm ON search_history USING gin (keyword gin_trgm_ops)',
  ];

  for (const idx of indexes) {
    try {
      await query(idx, []);
    } catch {
      // Index may not be supported (e.g., gin_trgm_ops without pg_trgm)
    }
  }
  console.log('[SearchQuery] search_history indexes ready');

  // 同义词表（中级功能）
  await initSynonymTable();

  // 索引元数据表（中级功能）
  await initSearchIndexMetadata();

  // 更新索引元数据
  await updateSearchIndexMetadata();
}

export default {
  searchAll,
  getSearchSuggestions,
  recordSearch,
  getSearchHistory,
  deleteSearchHistory,
  getHotSearchTerms,
  getZeroResultTerms,
  expandWithSynonyms,
  correctTypo,
  initSynonymTable,
  initSearchIndexMetadata,
  updateSearchIndexMetadata,
  getSearchIndexStatus,
  rebuildSearchIndex,
  initSearchTables,
};
