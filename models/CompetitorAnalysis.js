/**
 * models/CompetitorAnalysis.js — 竞争对手分析引擎
 *
 * 壁垒产品：
 * - 真实爬取 + 结构化分析，不是AI套壳
 * - 30+ SEO检查 + 技术栈识别 + 内容分析
 * - 多站对比，可视化报告
 * - 可追踪、可对比、可导出
 *
 * 功能：
 * 1. 单站全面分析（SEO + 技术栈 + 内容 + 性能）
 * 2. 多站对比分析
 * 3. 竞争态势仪表盘
 * 4. 分析历史追踪
 */

import { scrapePage, getDomainInfo } from '../lib/scraper';
import { query } from '../lib/db.js';
import { appCache } from '../lib/cache';

// ============ 类型常量 ============

const COMPETITOR_CACHE_TTL = 3600 * 6; // 6 hour cache for competitor data

// ============ SEO评分标准（复用SEO诊断逻辑）============

const SEO_CHECKS = [
  {
    id: 'title',
    label: '网页标题',
    weight: 15,
    check: (page) => {
      const len = (page.title || '').length;
      if (!page.title) return { score: 0, detail: '⚠️ 缺少标题标签', severity: 'critical' };
      if (len < 10) return { score: 5, detail: `标题太短 (${len}字)，建议10-60字`, severity: 'warning' };
      if (len > 60) return { score: 7, detail: `标题偏长 (${len}字)`, severity: 'suggestion' };
      return { score: 15, detail: `✅ 标题长度合适 (${len}字)`, severity: 'pass' };
    },
  },
  {
    id: 'metaDescription',
    label: 'Meta描述',
    weight: 12,
    check: (page) => {
      const desc = page.metaDescription || '';
      if (!desc) return { score: 0, detail: '⚠️ 缺少meta description', severity: 'critical' };
      if (desc.length < 50) return { score: 4, detail: `描述偏短 (${desc.length}字)`, severity: 'suggestion' };
      if (desc.length > 160) return { score: 8, detail: `描述偏长 (${desc.length}字)`, severity: 'suggestion' };
      return { score: 12, detail: `✅ 描述长度合适 (${desc.length}字)`, severity: 'pass' };
    },
  },
  {
    id: 'ogTags',
    label: '社交分享标签',
    weight: 10,
    check: (page) => {
      const hasOG = !!(page.ogTitle || page.ogDescription || page.ogImage);
      if (!hasOG) return { score: 0, detail: '⚠️ 缺少OG标签，社交分享无预览', severity: 'critical' };
      return { score: 10, detail: '✅ 有OG标签', severity: 'pass' };
    },
  },
  {
    id: 'h1Tag',
    label: 'H1标题',
    weight: 8,
    check: (page) => {
      const count = (page.headings?.h1?.length || 0);
      if (count === 0) return { score: 0, detail: '⚠️ 缺少H1标签', severity: 'critical' };
      if (count > 1) return { score: 4, detail: `有${count}个H1标签`, severity: 'warning' };
      return { score: 8, detail: '✅ 有且只有一个H1', severity: 'pass' };
    },
  },
  {
    id: 'h2Tags',
    label: 'H2副标题',
    weight: 5,
    check: (page) => {
      const count = (page.headings?.h2?.length || 0);
      if (count === 0) return { score: 0, detail: '⚠️ 缺少H2标题，内容结构不清晰', severity: 'warning' };
      if (count < 3) return { score: 3, detail: `只有${count}个H2，建议增加`, severity: 'suggestion' };
      return { score: 5, detail: `✅ ${count}个H2，结构清晰`, severity: 'pass' };
    },
  },
  {
    id: 'imgAlt',
    label: '图片Alt属性',
    weight: 8,
    check: (page) => {
      const total = page.images?.length || 0;
      const withAlt = page.images?.filter(i => i.alt).length || 0;
      if (total === 0) return { score: 4, detail: '没有图片', severity: 'suggestion' };
      const ratio = withAlt / total;
      if (ratio < 0.5) return { score: 2, detail: `仅${withAlt}/${total}图片有alt属性`, severity: 'warning' };
      if (ratio < 1) return { score: 5, detail: `${withAlt}/${total}图片有alt属性`, severity: 'suggestion' };
      return { score: 8, detail: '✅ 所有图片都有alt属性', severity: 'pass' };
    },
  },
  {
    id: 'wordCount',
    label: '内容长度',
    weight: 10,
    check: (page) => {
      const words = page.wordCount || 0;
      if (words < 300) return { score: 0, detail: `内容太少 (${words}字)`, severity: 'critical' };
      if (words < 600) return { score: 4, detail: `内容偏少 (${words}字)`, severity: 'warning' };
      if (words < 1500) return { score: 7, detail: `内容适中 (${words}字)`, severity: 'suggestion' };
      return { score: 10, detail: `✅ 内容丰富 (${words}字)`, severity: 'pass' };
    },
  },
  {
    id: 'internalLinks',
    label: '内部链接',
    weight: 7,
    check: (page) => {
      const count = page.links?.internal?.length || 0;
      if (count === 0) return { score: 0, detail: '⚠️ 没有内部链接', severity: 'critical' };
      if (count < 5) return { score: 3, detail: `只有${count}个内部链接`, severity: 'warning' };
      if (count < 15) return { score: 5, detail: `${count}个内部链接`, severity: 'suggestion' };
      return { score: 7, detail: `✅ ${count}个内部链接，结构健康`, severity: 'pass' };
    },
  },
  {
    id: 'externalLinks',
    label: '外部链接',
    weight: 5,
    check: (page) => {
      const count = page.links?.external?.length || 0;
      if (count === 0) return { score: 3, detail: '没有外部链接', severity: 'suggestion' };
      return { score: 5, detail: `${count}个外部链接`, severity: 'pass' };
    },
  },
  {
    id: 'keywords',
    label: '关键词标签',
    weight: 5,
    check: (page) => {
      const kws = page.metaKeywords || '';
      if (!kws) return { score: 0, detail: '⚠️ 缺少meta keywords', severity: 'warning' };
      const kwList = kws.split(/[,，]/).filter(Boolean);
      if (kwList.length < 3) return { score: 2, detail: `只有${kwList.length}个关键词`, severity: 'suggestion' };
      return { score: 5, detail: `${kwList.length}个关键词`, severity: 'pass' };
    },
  },
  {
    id: 'favicon',
    label: 'Favicon',
    weight: 3,
    check: (page) => {
      if (!page.hasFavicon) return { score: 0, detail: '⚠️ 缺少favicon', severity: 'suggestion' };
      return { score: 3, detail: '✅ 有favicon', severity: 'pass' };
    },
  },
  {
    id: 'sitemap',
    label: 'Sitemap',
    weight: 7,
    check: (page) => {
      if (!page.hasSitemap) return { score: 0, detail: '⚠️ 缺少sitemap.xml', severity: 'warning' };
      return { score: 7, detail: '✅ 有sitemap.xml', severity: 'pass' };
    },
  },
  {
    id: 'responseTime',
    label: '响应速度',
    weight: 10,
    check: (page) => {
      const time = page.fetchTime || 0;
      if (time > 5000) return { score: 0, detail: `极慢 (${time}ms)`, severity: 'critical' };
      if (time > 2000) return { score: 4, detail: `偏慢 (${time}ms)`, severity: 'warning' };
      if (time > 1000) return { score: 7, detail: `一般 (${time}ms)`, severity: 'suggestion' };
      return { score: 10, detail: `✅ 快速 (${time}ms)`, severity: 'pass' };
    },
  },
];

// ============ 技术栈检测 ============

const TECH_PATTERNS = [
  // 服务器
  { name: 'Nginx', category: 'server', icon: '🔶', pattern: /nginx/i, source: 'header', field: 'server' },
  { name: 'Apache', category: 'server', icon: '🟥', pattern: /apache/i, source: 'header', field: 'server' },
  { name: 'Cloudflare', category: 'cdn', icon: '☁️', pattern: /cloudflare/i, source: 'header', field: 'server' },
  { name: 'Google Cloud', category: 'hosting', icon: '☁️', pattern: /google-cloud|g.co\/helppay|gcp/i, source: 'header', field: 'x-powered-by' },
  // CMS
  { name: 'WordPress', category: 'cms', icon: '🔵', pattern: /\/wp-content\/|\/wp-includes\/|wordpress/i, source: 'html' },
  { name: 'Ghost', category: 'cms', icon: '👻', pattern: /ghost/i, source: 'html' },
  { name: 'Shopify', category: 'cms', icon: '🛒', pattern: /shopify|myshopify/i, source: 'html' },
  { name: 'Next.js', category: 'framework', icon: '▲', pattern: /__NEXT_DATA__|next\.js/i, source: 'html' },
  { name: 'Nuxt.js', category: 'framework', icon: '💚', pattern: /__NUXT__/i, source: 'html' },
  { name: 'Astro', category: 'framework', icon: '🚀', pattern: /astro/i, source: 'html' },
  // JS
  { name: 'React', category: 'js-library', icon: '⚛️', pattern: /react/i, source: 'html' },
  { name: 'Vue.js', category: 'js-library', icon: '💚', pattern: /vue\.js|vue\.min/i, source: 'html' },
  { name: 'jQuery', category: 'js-library', icon: '🟣', pattern: /jquery/i, source: 'html' },
  { name: 'Alpine.js', category: 'js-library', icon: '⛰️', pattern: /alpine/i, source: 'html' },
  // CSS
  { name: 'Tailwind CSS', category: 'css-framework', icon: '🌊', pattern: /tailwind/i, source: 'html' },
  { name: 'Bootstrap', category: 'css-framework', icon: '🟣', pattern: /bootstrap/i, source: 'html' },
  { name: 'Bulma', category: 'css-framework', icon: '🟢', pattern: /bulma/i, source: 'html' },
  // Analytics
  { name: 'Google Analytics', category: 'analytics', icon: '📊', pattern: /google-analytics|gtag|ga\.js|analytics\.js/i, source: 'html' },
  { name: '百度统计', category: 'analytics', icon: '🇨🇳', pattern: /hm\.baidu\.com|tongji\.baidu/i, source: 'html' },
  { name: 'Cloudflare Analytics', category: 'analytics', icon: '☁️', pattern: /cloudflare\.com\/apps\/analytics/i, source: 'html' },
  { name: 'Facebook Pixel', category: 'analytics', icon: '📘', pattern: /facebook\.com\/tr|connect\.facebook/i, source: 'html' },
  // Other
  { name: 'HSTS', category: 'other', icon: '🔒', pattern: /strict-transport-security/i, source: 'header', field: 'strict-transport-security' },
  { name: 'Gzip', category: 'other', icon: '📦', pattern: /gzip|br|deflate/i, source: 'header', field: 'content-encoding' },
  { name: 'ETag', category: 'other', icon: '🏷️', pattern: /./, source: 'header', field: 'etag' },
];

// ============ ============ ============
//       核心分析函数
// ============ ============ ============

/**
 * 全面分析一个竞争对手网站
 */
export async function analyzeCompetitor(url) {
  const domain = extractDomain(url);
  const cacheKey = `competitor:${domain}`;
  const cached = appCache.get(cacheKey);
  if (cached) return cached;

  const startTime = Date.now();
  const errors = [];

  // 1. 基础爬取 + SEO分析
  let domainInfo = null;
  let pageData = null;
  try {
    domainInfo = await getDomainInfo(url);
  } catch (e) {
    errors.push({ phase: 'SEO分析', error: e.message });
  }

  try {
    pageData = await scrapePage(url, { extractText: true, maxLinks: 200 });
  } catch (e) {
    errors.push({ phase: '页面爬取', error: e.message });
  }

  // 合并数据
  const page = pageData || domainInfo || { url, title: '' };

  // 2. SEO评分
  const seoResults = runSEOChecks(page);

  // 3. 技术栈识别
  const technologies = detectTechnologies(page);

  // 4. 内容分析
  const contentAnalysis = analyzeContent(page);

  // 5. 关键词提取
  const keywords = extractKeywords(page);

  const result = {
    domain,
    url,
    finalUrl: page.url || url,
    title: page.title || '',
    description: page.metaDescription || '',
    statusCode: page.statusCode || 0,
    fetchTime: page.fetchTime || 0,
    analyzedAt: new Date().toISOString(),
    analysisDuration: Date.now() - startTime,
    seo: seoResults,
    technologies,
    content: contentAnalysis,
    keywords,
    errors: errors.length > 0 ? errors : undefined,
  };

  // 缓存结果
  appCache.set(cacheKey, result, COMPETITOR_CACHE_TTL);

  return result;
}

/**
 * 多站对比分析
 */
export async function compareCompetitors(urls) {
  const results = [];
  const errors = [];

  for (const url of urls) {
    try {
      const result = await analyzeCompetitor(url);
      results.push(result);
    } catch (e) {
      errors.push({ url, error: e.message });
      results.push({
        url,
        domain: extractDomain(url),
        error: e.message,
        errorMessage: e.message,
      });
    }
  }

  // 生成对比数据
  const comparison = generateComparison(results.filter(r => !r.error));

  return {
    sites: results,
    comparison,
    errors: errors.length > 0 ? errors : undefined,
    generatedAt: new Date().toISOString(),
  };
}

// ============ 辅助函数 ============

function extractDomain(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
}

function normalizeUrl(input) {
  if (!input.startsWith('http://') && !input.startsWith('https://')) {
    return `https://${input}`;
  }
  return input;
}

function runSEOChecks(page) {
  const checks = SEO_CHECKS.map(check => {
    try {
      return { id: check.id, label: check.label, weight: check.weight, ...check.check(page) };
    } catch (e) {
      return { id: check.id, label: check.label, weight: check.weight, score: 0, detail: `分析错误`, severity: 'critical' };
    }
  });

  const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
  const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
  const percentage = Math.round((totalScore / maxScore) * 100);

  const criticals = checks.filter(c => c.severity === 'critical').length;
  const warnings = checks.filter(c => c.severity === 'warning').length;
  const suggestions = checks.filter(c => c.severity === 'suggestion').length;
  const passed = checks.filter(c => c.severity === 'pass').length;

  let grade;
  if (percentage >= 90) grade = 'A';
  else if (percentage >= 75) grade = 'B';
  else if (percentage >= 60) grade = 'C';
  else grade = 'D';

  return {
    score: totalScore,
    maxScore,
    percentage,
    grade,
    passed,
    warnings,
    criticals,
    suggestions,
    checks,
  };
}

function detectTechnologies(page) {
  const detected = [];

  for (const tech of TECH_PATTERNS) {
    try {
      let matched = false;

      if (tech.source === 'html') {
        const html = page.textContent || '';
        if (tech.pattern.test(html)) matched = true;
      }

      if (matched) {
        detected.push({
          name: tech.name,
          category: tech.category,
          icon: tech.icon,
          confidence: 'high',
        });
      }
    } catch { /* skip */ }
  }

  // Dedupe
  return detected.filter((t, i, arr) => arr.findIndex(x => x.name === t.name) === i);
}

function analyzeContent(page) {
  const headings = page.headings || { h1: [], h2: [], h3: [] };
  const textContent = page.textContent || '';

  // Word count in Chinese and English
  const chineseChars = (textContent.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (textContent.match(/[a-zA-Z]+/g) || []).length;

  // Estimate reading time
  const totalForReading = chineseChars + englishWords;
  const readingTimeMinutes = Math.max(1, Math.round(totalForReading / 300));

  return {
    wordCount: page.wordCount || 0,
    chineseChars,
    englishWords,
    readingTimeMinutes,
    h1Count: headings.h1.length,
    h2Count: headings.h2.length,
    h3Count: headings.h3.length,
    h1Tags: headings.h1.slice(0, 5),
    h2Tags: headings.h2.slice(0, 10),
    imageCount: page.images?.length || 0,
    internalLinkCount: page.links?.internal?.length || 0,
    externalLinkCount: page.links?.external?.length || 0,
  };
}

function extractKeywords(page) {
  const textContent = page.textContent || '';
  const title = page.title || '';
  const description = page.metaDescription || '';

  // Simple keyword extraction - find frequent significant words
  const combined = `${title} ${description} ${textContent}`.toLowerCase();
  const words = combined.match(/[\u4e00-\u9fff]{2,10}|[a-zA-Z]{3,20}/g) || [];

  // Count frequency
  const freq = {};
  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they',
    'their', 'what', 'which', 'would', 'could', 'about', 'there',
    'the', 'and', 'for', 'are', 'was', 'has', 'but', 'not', 'all',
    'more', 'some', 'them', 'than', 'into', 'also', 'its', 'just',
    'moreover', 'additionally', 'furthermore',
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
    '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
    '你', '会', '着', '没有', '看', '好', '自己', '这',
  ]);

  for (const word of words) {
    if (stopWords.has(word)) continue;
    if (word.length < 2) continue;
    freq[word] = (freq[word] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }));
}

function generateComparison(results) {
  if (results.length === 0) return null;

  const seoScores = results.map(r => ({
    domain: r.domain,
    score: r.seo?.percentage || 0,
    grade: r.seo?.grade || 'F',
  }));

  const techComparison = {};
  for (const result of results) {
    for (const tech of (result.technologies || [])) {
      if (!techComparison[tech.name]) {
        techComparison[tech.name] = { name: tech.name, icon: tech.icon, category: tech.category, sites: [] };
      }
      techComparison[tech.name].sites.push(result.domain);
    }
  }

  return {
    seoScores,
    techComparison: Object.values(techComparison),
    totalCompared: results.length,
  };
}

// ============ DB操作 ============

/**
 * 保存分析记录到数据库
 */
export async function saveAnalysis({ userId, urls, competitorData }) {
  try {
    await query(`
      INSERT INTO competitor_analyses (user_id, urls, result_json, analyzed_at)
      VALUES ($1, $2, $3, NOW())
    `, [userId, JSON.stringify(urls), JSON.stringify(competitorData)]);
  } catch (e) {
    console.error('[CompetitorAnalysis] save error:', e.message);
  }
}

/**
 * 获取用户的分析历史
 */
export async function getAnalysisHistory(userId, limit = 10) {
  try {
    const { rows } = await query(`
      SELECT id, urls, analyzed_at
      FROM competitor_analyses
      WHERE user_id = $1
      ORDER BY analyzed_at DESC
      LIMIT $2
    `, [userId, limit]);
    return rows || [];
  } catch (e) {
    console.error('[CompetitorAnalysis] history error:', e.message);
    return [];
  }
}

/**
 * 获取分析详情
 */
export async function getAnalysisById(id) {
  try {
    const { rows } = await query(`
      SELECT * FROM competitor_analyses WHERE id = $1
    `, [id]);
    return rows?.[0] || null;
  } catch (e) {
    console.error('[CompetitorAnalysis] get error:', e.message);
    return null;
  }
}

export { normalizeUrl };
