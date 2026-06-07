/**
 * 🕷️ 模块9 实战：爬虫 → 结构化存储
 * 
 * 完整流程：
 * 1. 爬取页面（fetch + cheerio）
 * 2. 提取结构化数据
 * 3. 存入数据库 / JSON 文件
 * 4. 查询验证
 * 
 * 运行：node scripts/crawl-demo.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(__dirname, '..');
const outputDir = path.resolve(workspaceDir, '..', 'claude-learning', 'docs', 'crawler');

// ============ 配置 ============
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/17.4',
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ============ 1. 爬取页面 ============

async function fetchPage(url) {
  const start = Date.now();
  const resp = await fetch(url, {
    headers: {
      'User-Agent': getRandomUA(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  const html = await resp.text();
  return { html, status: resp.status, fetchTime: Date.now() - start };
}

async function parsePage(url, html) {
  const cheerio = await import('cheerio');
  const $ = cheerio.load(html);

  let domain = '';
  try { domain = new URL(url).hostname; } catch {}

  const title = $('title').text().trim();
  
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDescription = $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  
  const headings = {
    h1: $('h1').map((i, el) => $(el).text().trim()).get(),
    h2: $('h2').map((i, el) => $(el).text().trim()).get(),
    h3: $('h3').map((i, el) => $(el).text().trim()).get(),
  };
  
  const internalLinks = [];
  const externalLinks = [];
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim().substring(0, 60);
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      const fullUrl = new URL(href, url).href;
      const linkDomain = new URL(fullUrl).hostname;
      if (linkDomain === domain || linkDomain.endsWith('.' + domain)) {
        internalLinks.push({ text, href: fullUrl });
      } else {
        externalLinks.push({ text, href: fullUrl });
      }
    } catch {}
  });
  
  const images = [];
  $('img[src]').each((i, el) => {
    const src = $(el).attr('src');
    const alt = $(el).attr('alt') || '';
    try {
      images.push({ src: new URL(src, url).href, alt });
    } catch {}
  });
  
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  return {
    url, domain, title, metaDescription, metaKeywords,
    ogTitle, ogDescription, ogImage,
    headings,
    links: { internal: internalLinks.slice(0, 20), external: externalLinks.slice(0, 10) },
    images: images.slice(0, 10),
    wordCount: bodyText.length,
  };
}

// ============ 2. 数据库保存 ============

async function saveToDatabase(pages) {
  const dbModule = await import('../lib/db.js');
  const db = dbModule;

  // 确保表存在
  await db.query(`
    CREATE TABLE IF NOT EXISTS scraped_pages (
      id SERIAL PRIMARY KEY,
      url VARCHAR(2048) NOT NULL UNIQUE,
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
      status_code INTEGER DEFAULT 200,
      fetch_time_ms INTEGER DEFAULT 0,
      has_og_tags BOOLEAN DEFAULT FALSE,
      crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  for (const p of pages) {
    await db.query(`
      INSERT INTO scraped_pages (url, domain, title, meta_description, meta_keywords,
        og_title, og_description, og_image, h1_count, h2_count, h3_count,
        internal_links_count, external_links_count, image_count, images_with_alt,
        word_count, status_code, fetch_time_ms, has_og_tags, crawled_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
      ON CONFLICT (url) DO UPDATE SET
        title=EXCLUDED.title, fetch_time_ms=EXCLUDED.fetch_time_ms, crawled_at=NOW()
      RETURNING id;
    `, [
      p.url, p.domain, (p.title||'').substring(0,500), p.metaDescription||'', p.metaKeywords||'',
      (p.ogTitle||'').substring(0,500), p.ogDescription||'', p.ogImage||'',
      p.headings.h1.length, p.headings.h2.length, p.headings.h3.length,
      p.links.internal.length, p.links.external.length,
      p.images.length, p.images.filter(i=>i.alt).length,
      p.wordCount, p.statusCode, p.fetchTime,
      !!(p.ogTitle||p.ogDescription||p.ogImage)
    ]);
    console.log(`   💾 DB: ${p.domain} ✓`);
  }

  // 查询验证
  const { rows } = await db.query(`
    SELECT id, url, domain, title, fetch_time_ms, 
           to_char(crawled_at, 'YYYY-MM-DD HH24:MI:SS') as crawled_at
    FROM scraped_pages ORDER BY crawled_at DESC LIMIT 5;
  `);

  if (db.pool) await db.pool.end();
  return rows;
}

// ============ 3. JSON 保存（备选） ============

function saveToJson(pages) {
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, 'crawl-results.json');
  
  // 结构化摘要版本（更清晰）
  const summary = pages.map(p => ({
    url: p.url,
    domain: p.domain,
    title: p.title,
    status: p.statusCode,
    fetchTimeMs: p.fetchTime,
    extracted: {
      metaDescription: p.metaDescription?.substring(0, 100),
      headings: `${p.headings.h1.length}x H1, ${p.headings.h2.length}x H2`,
      internalLinks: p.links.internal.length,
      externalLinks: p.links.external.length,
      images: p.images.length,
      wordCount: p.wordCount,
    }
  }));
  
  fs.writeFileSync(filePath, JSON.stringify({ 
    crawledAt: new Date().toISOString(),
    totalPages: pages.length,
    summary,
    fullData: pages,
  }, null, 2));
  
  console.log(`   💾 JSON: ${filePath}`);
  return summary;
}

// ============ 4. 主流程 ============

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('🕷️  爬虫实战 · 完整流程演示');
  console.log('   爬取 → 提取 → 结构化 → 存储');
  console.log('='.repeat(60) + '\n');

  // 目标页面
  const urls = [
    { url: 'https://example.com', label: 'Example（静态）' },
  ];

  const scrapedPages = [];

  for (const { url, label } of urls) {
    console.log(`📡 [${label}] ${url}`);
    try {
      const { html, status, fetchTime } = await fetchPage(url);
      const data = await parsePage(url, html);
      data.statusCode = status;
      data.fetchTime = fetchTime;
      scrapedPages.push(data);

      console.log(`   ✅ 状态: ${status} | ${fetchTime}ms`);
      console.log(`   📄 标题: ${data.title}`);
      console.log(`   📊 H1:${data.headings.h1.length} H2:${data.headings.h2.length} 链接:${data.links.internal.length+data.links.external.length} 图片:${data.images.length} 字数:${data.wordCount}`);
      console.log(`   🔗 OG标签: ${data.ogTitle ? '有' : '无'} | 描述: ${(data.metaDescription||data.ogDescription||'无').substring(0, 60)}`);
      console.log();
    } catch (err) {
      console.log(`   ❌ ${err.message}\n`);
    }
  }

  if (scrapedPages.length === 0) {
    console.log('❌ 没有成功爬取的页面\n');
    return;
  }

  // 存储
  console.log('='.repeat(60));
  console.log('💾 存储爬取结果');
  console.log('='.repeat(60) + '\n');

  let dbResult = null;
  try {
    dbResult = await saveToDatabase(scrapedPages);
    console.log('\n✅ 数据库存储成功！\n');
  } catch (dbErr) {
    console.log(`⚠️  数据库不可用: ${dbErr.message}`);
    console.log('   切换到 JSON 文件存储...\n');
  }

  const jsonSummary = saveToJson(scrapedPages);
  console.log('✅ JSON 文件存储成功！\n');

  // 输出报告
  console.log('='.repeat(60));
  console.log('📋 模块9 学习成果');
  console.log('='.repeat(60) + '\n');
  
  console.log('✅ 已掌握:');
  console.log('   1. fetch + cheerio → 爬取静态页面');
  console.log('   2. puppeteer → 爬取动态页面（02-dynamic-scraper.js）');
  console.log('   3. 反爬策略：UA轮换 / 请求间隔 / 重试 / Cookie');
  console.log('   4. 结构化数据提取：标题/meta/OG/链接/图片');
  console.log('   5. 数据清洗与规范化');
  console.log('   6. 数据库持久化（scraped_pages 表）');
  console.log('   7. JSON 文件备选存储');
  console.log('   8. 产品级代码：lib/scraper.ts + models/ScrapedData.js');
  console.log();
  console.log('📁 文件清单:');
  console.log('   - lib/scraper.ts       爬虫核心模块');
  console.log('   - models/ScrapedData.js 爬取数据模型');
  console.log('   - scripts/crawl-demo.mjs  实战演示脚本');
  console.log('   - docs/crawler/          学习笔记目录');
  console.log();

  // 爬取摘要
  console.log('='.repeat(60));
  console.log('📊 爬取结果摘要');
  console.log('='.repeat(60));
  
  for (const p of jsonSummary) {
    console.log(`\n  📄 ${p.url}`);
    for (const [k, v] of Object.entries(p.extracted)) {
      console.log(`     ${k}: ${v}`);
    }
  }
  console.log('\n' + '='.repeat(60));
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
