// models/ScrapedData.js
// 🕷️ 模块9：爬虫入门 — 爬取数据的结构化存储
// 用 PostgreSQL 存储爬取的页面数据

import { query } from '../lib/db.js';

/**
 * 创建 scraped_pages 表
 * 存储爬虫抓取的每个页面的结构化数据
 */
export async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS scraped_pages (
      id SERIAL PRIMARY KEY,
      url VARCHAR(2048) NOT NULL,
      domain VARCHAR(255) NOT NULL,
      title VARCHAR(500) DEFAULT '',
      meta_description TEXT DEFAULT '',
      meta_keywords TEXT DEFAULT '',
      og_title VARCHAR(500) DEFAULT '',
      og_description TEXT DEFAULT '',
      og_image VARCHAR(2048) DEFAULT '',
      h1_count INTEGER DEFAULT 0,
      h2_count INTEGER DEFAULT 0,
      h3_count INTEGER DEFAULT 0,
      internal_links_count INTEGER DEFAULT 0,
      external_links_count INTEGER DEFAULT 0,
      image_count INTEGER DEFAULT 0,
      images_with_alt INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      word_count_est INTEGER DEFAULT 0,
      status_code INTEGER DEFAULT 200,
      fetch_time_ms INTEGER DEFAULT 0,
      has_favicon BOOLEAN DEFAULT FALSE,
      has_sitemap BOOLEAN DEFAULT FALSE,
      has_og_tags BOOLEAN DEFAULT FALSE,
      headings_json JSONB DEFAULT '[]',
      links_json JSONB DEFAULT '[]',
      images_json JSONB DEFAULT '[]',
      raw_content_hash VARCHAR(64) DEFAULT '',
      crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(url)
    );
  `;
  await query(sql);

  // 索引：按域名查询、按时间排序
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_scraped_domain ON scraped_pages(domain);');
    await query('CREATE INDEX IF NOT EXISTS idx_scraped_crawled_at ON scraped_pages(crawled_at DESC);');
    await query('CREATE INDEX IF NOT EXISTS idx_scraped_url ON scraped_pages(url);');
  } catch (_) {
    // 索引可能已存在
  }
}

/**
 * 保存爬取数据到数据库
 */
export async function saveScrapedPage(pageData) {
  const sql = `
    INSERT INTO scraped_pages (
      url, domain, title, meta_description, meta_keywords,
      og_title, og_description, og_image,
      h1_count, h2_count, h3_count,
      internal_links_count, external_links_count,
      image_count, images_with_alt,
      word_count, status_code, fetch_time_ms,
      has_favicon, has_sitemap, has_og_tags,
      crawled_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
              $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
    ON CONFLICT (url) DO UPDATE SET
      title = EXCLUDED.title,
      meta_description = EXCLUDED.meta_description,
      meta_keywords = EXCLUDED.meta_keywords,
      og_title = EXCLUDED.og_title,
      og_description = EXCLUDED.og_description,
      og_image = EXCLUDED.og_image,
      h1_count = EXCLUDED.h1_count,
      h2_count = EXCLUDED.h2_count,
      h3_count = EXCLUDED.h3_count,
      internal_links_count = EXCLUDED.internal_links_count,
      external_links_count = EXCLUDED.external_links_count,
      image_count = EXCLUDED.image_count,
      images_with_alt = EXCLUDED.images_with_alt,
      word_count = EXCLUDED.word_count,
      status_code = EXCLUDED.status_code,
      fetch_time_ms = EXCLUDED.fetch_time_ms,
      has_favicon = EXCLUDED.has_favicon,
      has_sitemap = EXCLUDED.has_sitemap,
      has_og_tags = EXCLUDED.has_og_tags,
      crawled_at = NOW()
    RETURNING id, url, title, crawled_at;
  `;

  try {
    // 从 URL 提取域名
    let domain = '';
    try { domain = new URL(pageData.url).hostname; } catch {}

    const result = await query(sql, [
      pageData.url,
      domain,
      (pageData.title || '').substring(0, 500),
      (pageData.metaDescription || ''),
      (pageData.metaKeywords || ''),
      (pageData.ogTitle || '').substring(0, 500),
      (pageData.ogDescription || ''),
      (pageData.ogImage || ''),
      pageData.headings?.h1?.length || 0,
      pageData.headings?.h2?.length || 0,
      pageData.headings?.h3?.length || 0,
      pageData.links?.internal?.length || 0,
      pageData.links?.external?.length || 0,
      pageData.images?.length || 0,
      pageData.images?.filter(i => i.alt).length || 0,
      pageData.wordCount || 0,
      pageData.statusCode || 200,
      pageData.fetchTime || 0,
      pageData.hasFavicon ?? false,
      pageData.hasSitemap ?? false,
      !!(pageData.ogTitle || pageData.ogDescription || pageData.ogImage),
    ]);

    console.log(`  [db] 已保存: ${pageData.url} → id=${result.rows[0].id}`);
    return result.rows[0];
  } catch (err) {
    console.error(`  [db] 保存失败: ${pageData.url}`, err.message);
    throw err;
  }
}

/**
 * 批量保存多条爬取记录
 */
export async function saveMultiplePages(pages) {
  const results = [];
  for (const page of pages) {
    try {
      const saved = await saveScrapedPage(page);
      results.push(saved);
    } catch (err) {
      results.push({ url: page.url, error: err.message });
    }
  }
  return results;
}

/**
 * 查询已爬取的页面
 */
export async function getScrapedPages({
  domain,
  limit = 20,
  offset = 0,
  orderBy = 'crawled_at',
  order = 'DESC',
} = {}) {
  let sql = 'SELECT id, url, domain, title, status_code, fetch_time_ms, crawled_at FROM scraped_pages';
  const params = [];
  let paramIndex = 1;

  if (domain) {
    sql += ` WHERE domain = $${paramIndex}`;
    params.push(domain);
    paramIndex++;
  }

  // 防止 SQL 注入—只允许白名单字段
  const allowedOrderBy = ['crawled_at', 'title', 'fetch_time_ms', 'status_code'];
  const safeOrderBy = allowedOrderBy.includes(orderBy) ? orderBy : 'crawled_at';
  const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

  sql += ` ORDER BY ${safeOrderBy} ${safeOrder}`;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return result.rows;
}

/**
 * 按域名统计爬取数据
 */
export async function getDomainStats() {
  const sql = `
    SELECT 
      domain,
      COUNT(*) as page_count,
      MAX(crawled_at) as last_crawled,
      AVG(fetch_time_ms)::int as avg_fetch_time,
      AVG(word_count)::int as avg_word_count,
      BOOL_OR(has_og_tags) as has_any_og_tags
    FROM scraped_pages
    GROUP BY domain
    ORDER BY page_count DESC;
  `;
  const result = await query(sql, []);
  return result.rows;
}

/**
 * 创建一个完整的爬取任务：爬取 → 分析 → 保存
 */
export async function crawlAndSave(url, scraperFn) {
  console.log(`\n🕷️ 开始爬取: ${url}`);
  
  // 1. 爬取页面
  const pageData = await scraperFn(url);
  console.log(`   ✅ 爬取完成: ${pageData.title || '(无标题)'}`);
  console.log(`   ⏱️  耗时: ${pageData.fetchTime}ms`);
  
  // 2. 提取域名信息
  let domain = '';
  try { domain = new URL(url).hostname; } catch {}
  
  // 3. 检查和保存 robots.txt 信息
  let robotsAllowed = true;
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const resp = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
    robotsAllowed = resp.ok;
  } catch {}
  
  // 4. 保存到数据库
  const saved = await saveScrapedPage({
    ...pageData,
    hasFavicon: false,
    hasSitemap: false,
  });
  
  console.log(`   💾 已保存到数据库`);
  console.log(`   📊 数据摘要:`);
  console.log(`      标题: ${pageData.title}`);
  console.log(`      H1: ${pageData.headings?.h1?.length || 0}个`);
  console.log(`      链接: ${pageData.links?.internal?.length || 0}个内部`);
  console.log(`      图片: ${pageData.images?.length || 0}张`);
  console.log(`      ⚠️  robots.txt: ${robotsAllowed ? '允许爬取' : '⚠️ 禁止爬取!'}`);
  
  return saved;
}
