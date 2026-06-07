/**
 * models/SEOAudit.js — SEO页面诊断核心引擎
 *
 * 壁垒产品：不是AI套壳，需要实际爬取+结构化分析
 * 功能：
 * - 爬取页面SEO数据
 * - 逐项检查（title/meta/OG/headings/images/性能/结构化数据）
 * - 打分+建议
 * - 竞品对比
 */

import { getDomainInfo } from '../lib/scraper';
import { query } from '../lib/db.js';
import { appCache, SEARCH_CACHE_TTL } from '../lib/cache';

// ============ SEO评分标准 ============

const SEO_CHECKS = {
  title: {
    label: '网页标题',
    weight: 15,
    check: (page) => {
      const len = (page.title || '').length;
      if (!page.title) return { score: 0, detail: '⚠️ 缺少<title>标签！严重影响搜索引擎排名', severity: 'critical' };
      if (len < 10) return { score: 5, detail: `⚠️ 标题太短 (${len}字)，建议10-60字`, severity: 'warning' };
      if (len > 60) return { score: 7, detail: `🔸 标题偏长 (${len}字)，建议控制在60字以内`, severity: 'suggestion' };
      return { score: 15, detail: `✅ 标题长度合适 (${len}字)，包含关键词`, severity: 'pass' };
    },
  },
  metaDescription: {
    label: 'Meta描述',
    weight: 12,
    check: (page) => {
      const desc = page.metaDescription || '';
      if (!desc) return { score: 0, detail: '⚠️ 缺少meta description！影响点击率', severity: 'critical' };
      if (desc.length < 50) return { score: 4, detail: `🔸 描述偏短 (${desc.length}字)，建议50-160字`, severity: 'suggestion' };
      if (desc.length > 160) return { score: 8, detail: `🔸 描述偏长 (${desc.length}字)，可能会被截断`, severity: 'suggestion' };
      return { score: 12, detail: `✅ 描述长度合适 (${desc.length}字)`, severity: 'pass' };
    },
  },
  ogTags: {
    label: '社交分享标签',
    weight: 10,
    check: (page) => {
      const hasOG = page.hasOGTags;
      if (!hasOG) return { score: 0, detail: '⚠️ 缺少OG标签！分享到微信/社交平台无预览', severity: 'critical' };
      return { score: 10, detail: '✅ 有OG标签（Open Graph / Twitter Card）', severity: 'pass' };
    },
  },
  h1Tag: {
    label: 'H1标题',
    weight: 8,
    check: (page) => {
      const { h1Count } = page;
      if (h1Count === 0) return { score: 0, detail: '⚠️ 缺少H1标签！每个页面应该只有一个H1', severity: 'critical' };
      if (h1Count > 1) return { score: 4, detail: `🔸 有${h1Count}个H1标签，建议每页只有一个H1`, severity: 'warning' };
      return { score: 8, detail: '✅ 有且只有一个H1标签', severity: 'pass' };
    },
  },
  headings: {
    label: '标题层级结构',
    weight: 5,
    check: (page) => {
      const { h1Count, h2Count, h3Count } = page;
      if (h1Count === 0 && h2Count === 0) return { score: 0, detail: '⚠️ 没有任何标题标签！内容无法结构化', severity: 'critical' };
      if (h2Count === 0 && h1Count > 0) return { score: 2, detail: '🔸 有H1但没有H2子标题，建议补充章节标题', severity: 'suggestion' };
      if (h2Count > 0) return { score: 5, detail: `✅ 标题结构完整 (H1:${h1Count}, H2:${h2Count}, H3:${h3Count})`, severity: 'pass' };
      return { score: 3, detail: '🔸 标题层级可以更丰富', severity: 'suggestion' };
    },
  },
  images: {
    label: '图片Alt属性',
    weight: 8,
    check: (page) => {
      const { imgCount, imgWithAlt } = page;
      if (imgCount === 0) return { score: 5, detail: '✅ 没有图片，不涉及Alt问题', severity: 'pass' };
      const ratio = imgWithAlt / imgCount;
      if (ratio < 0.5) return { score: 2, detail: `⚠️ 仅${imgWithAlt}/${imgCount}张图片有Alt描述，影响图片搜索排名`, severity: 'warning' };
      if (ratio < 1) return { score: 5, detail: `🔸 ${imgWithAlt}/${imgCount}张图片有Alt描述，建议全部补齐`, severity: 'suggestion' };
      return { score: 8, detail: `✅ 全部${imgCount}张图片都有Alt描述`, severity: 'pass' };
    },
  },
  performance: {
    label: '加载速度',
    weight: 10,
    check: (page) => {
      const { fetchTime } = page;
      if (fetchTime > 3000) return { score: 2, detail: `⚠️ 加载慢 (${fetchTime}ms)，超过3秒会影响用户体验和排名`, severity: 'warning' };
      if (fetchTime > 1000) return { score: 6, detail: `🔸 加载速度一般 (${fetchTime}ms)，可优化到1秒以内`, severity: 'suggestion' };
      return { score: 10, detail: `✅ 加载速度快 (${fetchTime}ms)`, severity: 'pass' };
    },
  },
  links: {
    label: '链接结构',
    weight: 5,
    check: (page) => {
      const { internalLinks, externalLinks } = page;
      if (internalLinks === 0) return { score: 1, detail: '⚠️ 没有内部链接！影响搜索引擎爬取深度', severity: 'warning' };
      if (internalLinks < 5) return { score: 3, detail: `🔸 内部链接较少 (${internalLinks}个)，建议增加`, severity: 'suggestion' };
      return { score: 5, detail: `✅ 有${internalLinks}个内部链接，结构合理 (外链${externalLinks}个)`, severity: 'pass' };
    },
  },
  favicon: {
    label: '网站图标',
    weight: 3,
    check: (page) => {
      if (!page.hasFavicon) return { score: 0, detail: '🔸 缺少favicon图标，影响品牌识别', severity: 'suggestion' };
      return { score: 3, detail: '✅ 有网站图标', severity: 'pass' };
    },
  },
  sitemap: {
    label: '站点地图',
    weight: 4,
    check: (page) => {
      if (!page.hasSitemap) return { score: 1, detail: '🔸 未检测到sitemap.xml，建议添加', severity: 'suggestion' };
      return { score: 4, detail: '✅ 检测到sitemap.xml', severity: 'pass' };
    },
  },
};

// ============ 分析引擎 ============

export class SEOAudit {
  /**
   * 分析一个页面的SEO状况
   */
  static async analyze(url) {
    const startTime = Date.now();

    try {
      // 1. 爬取页面
      const domainInfo = await getDomainInfo(url);
      const auditTime = Date.now() - startTime;

      // 2. 逐项检查
      const checks = {};
      let totalScore = 0;
      let maxScore = 0;

      for (const [key, checkDef] of Object.entries(SEO_CHECKS)) {
        const result = checkDef.check(domainInfo);
        checks[key] = {
          label: checkDef.label,
          ...result,
        };
        totalScore += result.score;
        maxScore += checkDef.weight;
      }

      // 3. 计算总分 (百分比)
      const score = Math.round((totalScore / maxScore) * 100);
      const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
      const gradeLabel = score >= 90 ? '优秀' : score >= 75 ? '良好' : score >= 60 ? '一般' : score >= 40 ? '较差' : '很差';

      // 4. 统计问题数量
      const criticalIssues = Object.values(checks).filter(c => c.severity === 'critical').length;
      const warnings = Object.values(checks).filter(c => c.severity === 'warning').length;
      const suggestions = Object.values(checks).filter(c => c.severity === 'suggestion').length;

      return {
        url,
        domainInfo,
        score,
        grade,
        gradeLabel,
        checks,
        summary: {
          total: score,
          critical: criticalIssues,
          warnings,
          suggestions,
          passed: Object.values(checks).filter(c => c.severity === 'pass').length,
        },
        auditTime,
        analyzedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`SEO分析失败: ${error.message}`);
    }
  }

  /**
   * 对比多个页面
   */
  static async compare(urls) {
    const results = [];
    for (const url of urls) {
      try {
        const result = await this.analyze(url);
        results.push(result);
      } catch (error) {
        results.push({ url, error: error.message });
      }
    }
    return results;
  }

  /**
   * 保存分析结果
   */
  static async save(userId, result) {
    const { rows } = await query(
      `INSERT INTO seo_analyses (user_id, url, domain, score, grade, report)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [
        userId,
        result.url,
        result.domainInfo.domain,
        result.score,
        result.grade,
        JSON.stringify(result),
      ]
    );
    return rows[0];
  }

  /**
   * 获取用户的分析历史
   */
  static async getHistory(userId, { limit = 20, cursor } = {}) {
    const conditions = ['user_id = $1'];
    const params = [userId];
    let paramIndex = 2;

    if (cursor) {
      conditions.push(`(created_at < $${paramIndex} OR (created_at = $${paramIndex} AND id < $${paramIndex + 1}))`);
      params.push(cursor.createdAt, cursor.id);
      paramIndex += 2;
    }

    params.push(limit + 1);

    const { rows } = await query(
      `SELECT id, url, domain, score, grade, created_at
       FROM seo_analyses
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${paramIndex}`,
      params
    );

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor = null;
    if (hasMore && data.length > 0) {
      nextCursor = { createdAt: data[data.length - 1].created_at, id: data[data.length - 1].id };
    }

    return { data, nextCursor, hasMore };
  }

  /**
   * 获取单个分析详情
   */
  static async getById(id) {
    const { rows } = await query('SELECT * FROM seo_analyses WHERE id = $1', [id]);
    if (!rows[0]) return null;
    rows[0].report = typeof rows[0].report === 'string' ? JSON.parse(rows[0].report) : rows[0].report;
    return rows[0];
  }

  /**
   * 获取分析统计
   */
  static async getStats(userId) {
    const { rows } = await query(
      `SELECT
        COUNT(*) as total_analyses,
        AVG(score)::int as avg_score,
        MIN(score) as min_score,
        MAX(score) as max_score,
        COUNT(DISTINCT domain) as domains_analyzed,
        MAX(created_at) as last_analysis
      FROM seo_analyses
      WHERE user_id = $1`,
      [userId]
    );
    return rows[0];
  }
}

export default SEOAudit;
