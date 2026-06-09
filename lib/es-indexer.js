/**
 * lib/es-indexer.js — Elasticsearch 索引管理 + 数据同步
 * 
 * 模块14·高级：Elasticsearch 搜索优化
 * 
 * 功能：
 * - 创建/删除索引（基于 INDEX_DEFINITIONS）
 * - 全量数据同步（从 PostgreSQL 同步到 ES）
 * - 增量同步（新增/更新的文档）
 * - 索引健康检查
 * - 批量操作，带进度反馈
 * 
 * 使用方式：
 *   import { rebuildAllIndexes, syncArticle } from '../lib/es-indexer';
 *   
 *   // 全量重建
 *   await rebuildAllIndexes();
 *   
 *   // 单文档同步（增删改时调用）
 *   await syncArticle(articleId);
 */

import { getESClient, getIndexName, INDEX_DEFINITIONS, isESAvailable } from './es-client.js';
import { query } from './db.js';

const BATCH_SIZE = 100; // 每批处理文档数

// ==================== 索引管理 ====================

/**
 * 创建索引（如果不存在）
 */
async function createIndex(indexType) {
  const es = await getESClient();
  if (!es) return { status: 'skipped', reason: 'ES not available' };

  const def = INDEX_DEFINITIONS[indexType];
  if (!def) throw new Error(`Unknown index type: ${indexType}`);

  const indexName = def.name();
  const exists = await es.indices.exists({ index: indexName });

  if (!exists) {
    await es.indices.create({
      index: indexName,
      body: def.mappings,
    });
    console.log(`[ES Indexer] ✅ 索引创建: ${indexName}`);
    return { status: 'created', index: indexName };
  }

  console.log(`[ES Indexer] ℹ️ 索引已存在: ${indexName}`);
  return { status: 'exists', index: indexName };
}

/**
 * 删除索引
 */
async function deleteIndex(indexType) {
  const es = await getESClient();
  if (!es) return { status: 'skipped', reason: 'ES not available' };

  const indexName = INDEX_DEFINITIONS[indexType].name();
  const exists = await es.indices.exists({ index: indexName });

  if (exists) {
    await es.indices.delete({ index: indexName });
    console.log(`[ES Indexer] 🗑️ 索引删除: ${indexName}`);
    return { status: 'deleted', index: indexName };
  }

  return { status: 'not_found', index: indexName };
}

/**
 * 重建单个索引（删除+创建）
 */
async function rebuildIndex(indexType) {
  await deleteIndex(indexType);
  return await createIndex(indexType);
}

// ==================== 数据同步 ====================

/**
 * 同步全部 articles 到 ES
 */
async function syncArticles() {
  const es = await getESClient();
  if (!es) return { indexed: 0, skipped: true, reason: 'ES not available' };

  const indexName = getIndexName('articles');
  let indexed = 0;
  let offset = 0;

  while (true) {
    const result = await query(
      `SELECT id, title, COALESCE(topic, '') as topic, 
              COALESCE(content, '') as content, 
              COALESCE(article_type, 'blog') as article_type,
              word_count, created_at
       FROM articles
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    if (result.rows.length === 0) break;

    const body = result.rows.flatMap(row => [
      { index: { _index: indexName, _id: `article-${row.id}` } },
      {
        id: row.id,
        title: row.title,
        content: row.content?.substring(0, 50000) || '', // 截断避免过大
        topic: row.topic,
        article_type: row.article_type,
        word_count: row.word_count || 0,
        created_at: row.created_at,
        // rank_feature 字段用于搜索结果排序
        title_boost: row.title?.length > 5 ? 5 : 3,
        recency_boost: row.created_at 
          ? Math.max(0, 1 - (Date.now() - new Date(row.created_at).getTime()) / (365 * 24 * 60 * 60 * 1000))
          : 0.1,
      },
    ]);

    const bulkResponse = await es.bulk({ refresh: true, body });
    indexed += result.rows.length;

    if (bulkResponse.errors) {
      const errorItems = bulkResponse.items.filter(i => i.index?.error);
      console.error(`[ES Indexer] ⚠️ articles 同步错误 (offset=${offset}):`, 
        errorItems.slice(0, 3).map(i => i.index.error?.reason));
    }

    console.log(`[ES Indexer] 📄 articles: ${indexed} 条已同步`);
    offset += BATCH_SIZE;
  }

  console.log(`[ES Indexer] ✅ articles 同步完成: ${indexed} 条`);
  return { indexed };
}

/**
 * 同步全部 scraped_pages 到 ES
 */
async function syncScrapedPages() {
  const es = await getESClient();
  if (!es) return { indexed: 0, skipped: true };

  const indexName = getIndexName('scraped_pages');
  let indexed = 0;
  let offset = 0;

  while (true) {
    const result = await query(
      `SELECT id, url, domain, COALESCE(title, '') as title,
              COALESCE(meta_description, '') as meta_description,
              COALESCE(og_title, '') as og_title,
              COALESCE(og_image, '') as og_image,
              word_count, status_code, crawled_at
       FROM scraped_pages
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    if (result.rows.length === 0) break;

    const body = result.rows.flatMap(row => [
      { index: { _index: indexName, _id: `scraped-${row.id}` } },
      {
        id: row.id,
        url: row.url,
        domain: row.domain,
        title: row.title,
        meta_description: row.meta_description,
        og_title: row.og_title,
        og_image: row.og_image,
        word_count: row.word_count || 0,
        status_code: row.status_code,
        crawled_at: row.crawled_at,
        title_boost: row.title?.length > 5 ? 4 : 2,
        recency_boost: row.crawled_at
          ? Math.max(0, 1 - (Date.now() - new Date(row.crawled_at).getTime()) / (90 * 24 * 60 * 60 * 1000))
          : 0.1,
      },
    ]);

    const bulkResponse = await es.bulk({ refresh: true, body });
    indexed += result.rows.length;

    if (bulkResponse.errors) {
      console.error(`[ES Indexer] ⚠️ scraped_pages 同步错误 (offset=${offset})`);
    }

    console.log(`[ES Indexer] 📄 scraped_pages: ${indexed} 条已同步`);
    offset += BATCH_SIZE;
  }

  console.log(`[ES Indexer] ✅ scraped_pages 同步完成: ${indexed} 条`);
  return { indexed };
}

/**
 * 同步全部 seo_analyses 到 ES
 */
async function syncSEOAnalyses() {
  const es = await getESClient();
  if (!es) return { indexed: 0, skipped: true };

  const indexName = getIndexName('seo_analyses');
  let indexed = 0;
  let offset = 0;

  while (true) {
    const result = await query(
      `SELECT id, url, domain, score, grade, 
              COALESCE(report->>'title', '') as page_title,
              created_at
       FROM seo_analyses
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    if (result.rows.length === 0) break;

    const body = result.rows.flatMap(row => [
      { index: { _index: indexName, _id: `seo-${row.id}` } },
      {
        id: row.id,
        url: row.url,
        domain: row.domain,
        score: row.score,
        grade: row.grade,
        page_title: row.page_title,
        created_at: row.created_at,
        score_boost: Math.max(0, (row.score - 30) / 100), // 0~0.7
      },
    ]);

    const bulkResponse = await es.bulk({ refresh: true, body });
    indexed += result.rows.length;

    if (bulkResponse.errors) {
      console.error(`[ES Indexer] ⚠️ seo_analyses 同步错误 (offset=${offset})`);
    }

    console.log(`[ES Indexer] 📄 seo_analyses: ${indexed} 条已同步`);
    offset += BATCH_SIZE;
  }

  console.log(`[ES Indexer] ✅ seo_analyses 同步完成: ${indexed} 条`);
  return { indexed };
}

// ==================== 增量同步（单个文档） ====================

/**
 * 同步单篇文章到 ES
 */
export async function syncArticle(articleId) {
  const es = await getESClient();
  if (!es) return { status: 'skipped' };

  const result = await query(
    `SELECT id, title, COALESCE(topic, '') as topic,
            COALESCE(content, '') as content,
            COALESCE(article_type, 'blog') as article_type,
            word_count, created_at
     FROM articles WHERE id = $1`,
    [articleId]
  );

  if (result.rows.length === 0) {
    // 文章被删了，同步删除 ES 文档
    await es.delete({
      index: getIndexName('articles'),
      id: `article-${articleId}`,
    }).catch(() => {});
    return { status: 'deleted' };
  }

  const row = result.rows[0];
  await es.index({
    index: getIndexName('articles'),
    id: `article-${articleId}`,
    document: {
      id: row.id,
      title: row.title,
      content: row.content?.substring(0, 50000),
      topic: row.topic,
      article_type: row.article_type,
      word_count: row.word_count || 0,
      created_at: row.created_at,
      title_boost: row.title?.length > 5 ? 5 : 3,
      recency_boost: row.created_at
        ? Math.max(0, 1 - (Date.now() - new Date(row.created_at).getTime()) / (365 * 24 * 60 * 60 * 1000))
        : 0.1,
    },
  });

  return { status: 'indexed', id: articleId };
}

/**
 * 同步单个 scraped_page 到 ES
 */
export async function syncScrapedPage(pageId) {
  const es = await getESClient();
  if (!es) return { status: 'skipped' };

  const result = await query(
    `SELECT id, url, domain, COALESCE(title, '') as title,
            COALESCE(meta_description, '') as meta_description,
            COALESCE(og_title, '') as og_title,
            COALESCE(og_image, '') as og_image,
            word_count, status_code, crawled_at
     FROM scraped_pages WHERE id = $1`,
    [pageId]
  );

  if (result.rows.length === 0) {
    await es.delete({
      index: getIndexName('scraped_pages'),
      id: `scraped-${pageId}`,
    }).catch(() => {});
    return { status: 'deleted' };
  }

  const row = result.rows[0];
  await es.index({
    index: getIndexName('scraped_pages'),
    id: `scraped-${pageId}`,
    document: {
      id: row.id,
      url: row.url,
      domain: row.domain,
      title: row.title,
      meta_description: row.meta_description,
      og_title: row.og_title,
      og_image: row.og_image,
      word_count: row.word_count || 0,
      status_code: row.status_code,
      crawled_at: row.crawled_at,
      title_boost: row.title?.length > 5 ? 4 : 2,
      recency_boost: row.crawled_at
        ? Math.max(0, 1 - (Date.now() - new Date(row.crawled_at).getTime()) / (90 * 24 * 60 * 60 * 1000))
        : 0.1,
    },
  });

  return { status: 'indexed', id: pageId };
}

// ==================== 批量操作 ====================

/**
 * 全量重建所有索引
 * 1. 删除旧索引
 * 2. 创建新索引（用最新 mapping）
 * 3. 从 PostgreSQL 全量同步数据
 */
export async function rebuildAllIndexes() {
  const es = await getESClient();
  if (!es) {
    console.log('[ES Indexer] ⏭️ ES 未配置，跳过索引重建');
    return { status: 'skipped', reason: 'ES not configured' };
  }

  const results = {
    indexes: {},
    sync: {},
    timing: {},
    startedAt: new Date().toISOString(),
  };

  console.log('\n===== ES 索引重建开始 =====');

  // 1. 重建索引结构
  for (const type of ['articles', 'scraped_pages', 'seo_analyses']) {
    const start = Date.now();
    const idxResult = await rebuildIndex(type);
    results.indexes[type] = { ...idxResult, duration: Date.now() - start };
  }

  // 2. 全量同步数据
  const syncStart = Date.now();

  const [articlesResult, pagesResult, seoResult] = await Promise.all([
    syncArticles(),
    syncScrapedPages(),
    syncSEOAnalyses(),
  ]);

  results.sync.articles = articlesResult;
  results.sync.scraped_pages = pagesResult;
  results.sync.seo_analyses = seoResult;
  results.sync.duration = Date.now() - syncStart;

  // 3. 获取索引统计
  for (const type of ['articles', 'scraped_pages', 'seo_analyses']) {
    try {
      const stats = await es.indices.stats({ index: INDEX_DEFINITIONS[type].name() });
      results.indexes[type].docCount = stats._all?.primaries?.docs?.count || 0;
      results.indexes[type].sizeInBytes = stats._all?.primaries?.store?.size_in_bytes || 0;
    } catch { /* ignore */ }
  }

  results.completedAt = new Date().toISOString();
  results.totalDuration = Date.now() - new Date(results.startedAt).getTime();

  const totalIndexed = 
    (articlesResult.indexed || 0) + 
    (pagesResult.indexed || 0) + 
    (seoResult.indexed || 0);

  console.log(`\n===== ES 索引重建完成 =====`);
  console.log(`📊 总计索引: ${totalIndexed} 条文档`);
  console.log(`⏱️ 耗时: ${(results.totalDuration / 1000).toFixed(1)}s`);
  console.log(`📦 索引: articles=${results.indexes.articles?.docCount || 0}` +
    `, scraped_pages=${results.indexes.scraped_pages?.docCount || 0}` +
    `, seo_analyses=${results.indexes.seo_analyses?.docCount || 0}`);

  return results;
}

/**
 * 获取 ES 索引状态
 */
export async function getESIndexStatus() {
  const es = await getESClient();
  if (!es) {
    return { available: false, indexes: [] };
  }

  const statuses = [];

  for (const [type, def] of Object.entries(INDEX_DEFINITIONS)) {
    try {
      const indexName = def.name();
      const exists = await es.indices.exists({ index: indexName });
      
      if (exists) {
        const stats = await es.indices.stats({ index: indexName });
        const indexInfo = await es.indices.get({ index: indexName });

        statuses.push({
          type,
          index: indexName,
          exists: true,
          docCount: stats._all?.primaries?.docs?.count || 0,
          sizeInBytes: stats._all?.primaries?.store?.size_in_bytes || 0,
          createdAt: indexInfo[indexName]?.settings?.index?.creation_date
            ? new Date(parseInt(indexInfo[indexName].settings.index.creation_date)).toISOString()
            : null,
        });
      } else {
        statuses.push({
          type,
          index: indexName,
          exists: false,
          docCount: 0,
        });
      }
    } catch (err) {
      statuses.push({
        type,
          index: def.name(),
        exists: false,
        docCount: 0,
        error: err.message,
      });
    }
  }

  return { available: true, indexes: statuses };
}

export default {
  rebuildAllIndexes,
  getESIndexStatus,
  syncArticle,
  syncScrapedPage,
  createIndex,
  deleteIndex,
};
