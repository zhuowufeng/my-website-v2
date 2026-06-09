/**
 * models/SiteMonitor.js — 🚀 网站内容监控工具
 *
 * 壁垒产品：需要定时爬取+内容比对+变化跟踪，AI套壳搞不定
 * 功能：
 * - 添加要监控的URL
 * - 定时爬取并计算内容hash
 * - 自动检测变化（标题/描述/内容/状态码）
 * - 变化历史追踪
 * - 监控仪表盘
 */

import { query } from '../lib/db.js';
import { appCache } from '../lib/cache';
import { saveScrapedPage } from './ScrapedData.js';

// ==================== 数据库表创建 ====================

/**
 * 创建监控相关数据库表
 */
export async function createTables() {
  // 监控站点表
  await query(`
    CREATE TABLE IF NOT EXISTS monitored_sites (
      id SERIAL PRIMARY KEY,
      url VARCHAR(2048) NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) DEFAULT '',
      check_interval VARCHAR(20) DEFAULT '24h',
      is_active BOOLEAN DEFAULT true,
      last_checked TIMESTAMP,
      last_changed_at TIMESTAMP,
      change_count INTEGER DEFAULT 0,
      last_status_code INTEGER DEFAULT 0,
      last_snapshot_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(url, user_id)
    );
  `);

  // 快照表 — 每次检查的内容快照
  await query(`
    CREATE TABLE IF NOT EXISTS site_snapshots (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES monitored_sites(id) ON DELETE CASCADE,
      content_hash VARCHAR(64) DEFAULT '',
      title VARCHAR(500) DEFAULT '',
      meta_description TEXT DEFAULT '',
      h1_count INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      status_code INTEGER DEFAULT 200,
      fetch_time_ms INTEGER DEFAULT 0,
      snapshot_data JSONB DEFAULT '{}',
      is_initial BOOLEAN DEFAULT false,
      checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 变化记录表 — 检测到的变化
  await query(`
    CREATE TABLE IF NOT EXISTS site_changes (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES monitored_sites(id) ON DELETE CASCADE,
      from_snapshot_id INTEGER REFERENCES site_snapshots(id),
      to_snapshot_id INTEGER REFERENCES site_snapshots(id),
      change_type VARCHAR(50) NOT NULL,
      field_name VARCHAR(100) DEFAULT '',
      old_value TEXT DEFAULT '',
      new_value TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 索引
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_monitored_user ON monitored_sites(user_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_monitored_active ON monitored_sites(is_active);');
    await query('CREATE INDEX IF NOT EXISTS idx_snapshots_site ON site_snapshots(site_id, checked_at DESC);');
    await query('CREATE INDEX IF NOT EXISTS idx_changes_site ON site_changes(site_id, detected_at DESC);');
    await query('CREATE INDEX IF NOT EXISTS idx_changes_type ON site_changes(site_id, change_type);');
  } catch (_) {
    // 索引可能已存在
  }

  console.log('[SiteMonitor] Tables ready');
}

// ==================== CRUD ====================

/**
 * 添加要监控的URL
 */
export async function addMonitoredSite({ url, name, userId = 1, checkInterval = '24h' }) {
  await createTables();

  const result = await query(`
    INSERT INTO monitored_sites (url, name, user_id, check_interval)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (url, user_id) DO UPDATE SET
      is_active = true,
      name = EXCLUDED.name,
      check_interval = EXCLUDED.check_interval,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, url, name, is_active, created_at
  `, [url, name || '', userId, checkInterval]);

  console.log(`[SiteMonitor] Added: ${url}`);
  return result.rows[0];
}

/**
 * 移除监控（软删除 → 停用）
 */
export async function removeMonitoredSite(id, userId = 1) {
  await query(`
    UPDATE monitored_sites SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND user_id = $2
  `, [id, userId]);
  console.log(`[SiteMonitor] Removed: id=${id}`);
}

/**
 * 重新激活监控
 */
export async function activateMonitoredSite(id, userId = 1) {
  await query(`
    UPDATE monitored_sites SET is_active = true, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND user_id = $2
  `, [id, userId]);
}

/**
 * 获取用户的所有监控站点
 */
export async function getUserMonitoredSites(userId = 1) {
  const result = await query(`
    SELECT id, url, name, check_interval, is_active,
           last_checked, last_changed_at, change_count, last_status_code,
           created_at
    FROM monitored_sites
    WHERE user_id = $1
    ORDER BY is_active DESC, updated_at DESC
  `, [userId]);
  return result.rows;
}

/**
 * 获取单个监控站点详情（含最新快照）
 */
export async function getMonitoredSiteDetail(id, userId = 1) {
  const siteResult = await query(`
    SELECT * FROM monitored_sites WHERE id = $1 AND user_id = $2
  `, [id, userId]);

  if (siteResult.rows.length === 0) return null;
  const site = siteResult.rows[0];

  // 获取最近5条快照
  const snapshots = await query(`
    SELECT id, content_hash, title, word_count, status_code, fetch_time_ms, is_initial, checked_at
    FROM site_snapshots
    WHERE site_id = $1
    ORDER BY checked_at DESC
    LIMIT 5
  `, [id]);

  // 获取最近20条变化记录
  const changes = await query(`
    SELECT id, change_type, field_name, old_value, new_value, summary, detected_at
    FROM site_changes
    WHERE site_id = $1
    ORDER BY detected_at DESC
    LIMIT 20
  `, [id]);

  return { ...site, snapshots: snapshots.rows, changes: changes.rows };
}

/**
 * 获取所有活跃的监控站点（用于定时任务）
 */
export async function getActiveSites() {
  const result = await query(`
    SELECT id, url, name, check_interval, last_checked, last_snapshot_id
    FROM monitored_sites
    WHERE is_active = true
    ORDER BY last_checked ASC NULLS FIRST
  `);
  return result.rows;
}

/**
 * 获取监控统计概览
 */
export async function getMonitorStats(userId = 1) {
  const totalResult = await query(`
    SELECT
      COUNT(*)::int as total,
      SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int as active,
      SUM(change_count)::int as total_changes,
      MAX(last_checked) as last_check_all
    FROM monitored_sites
    WHERE user_id = $1
  `, [userId]);

  return totalResult.rows[0] || { total: 0, active: 0, total_changes: 0, last_check_all: null };
}

// ==================== 内容比对引擎 ====================

/**
 * 计算内容hash（用于快速比对变化）
 * 归一化：去空白、转小写、去HTML标签
 */
export function computeContentHash(text) {
  if (!text) return '';
  const normalized = text
    .replace(/<[^>]*>/g, '')     // 去掉HTML标签
    .replace(/\\s+/g, ' ')        // 归一化空白
    .trim()
    .toLowerCase();
  // 使用简单但够用的hash — 避免引入crypto依赖（Vercel Edge限制）
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit int
  }
  // 取绝对值，转hex
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * 比对两个字段，生成变化记录
 */
export function detectFieldChange(siteId, fromSnapshotId, toSnapshotId, fieldName, oldVal, newVal) {
  const oldStr = (oldVal || '').toString().trim();
  const newStr = (newVal || '').toString().trim();

  if (oldStr === newStr) return null;

  return {
    site_id: siteId,
    from_snapshot_id: fromSnapshotId,
    to_snapshot_id: toSnapshotId,
    change_type: 'field_changed',
    field_name: fieldName,
    old_value: oldStr.substring(0, 500),
    new_value: newStr.substring(0, 500),
    summary: `🔔 "${fieldName}" 发生了变化`,
  };
}

/**
 * 比对两次快照，生成所有变化
 */
export async function compareSnapshots(siteId, fromSnapshot, toSnapshot) {
  const changes = [];

  // 状态码变化
  if (fromSnapshot.status_code !== toSnapshot.status_code) {
    changes.push({
      site_id: siteId,
      from_snapshot_id: fromSnapshot.id,
      to_snapshot_id: toSnapshot.id,
      change_type: 'status_code',
      field_name: 'HTTP状态码',
      old_value: String(fromSnapshot.status_code),
      new_value: String(toSnapshot.status_code),
      summary: `🔔 HTTP状态码: ${fromSnapshot.status_code} → ${toSnapshot.status_code}`,
    });
  }

  // 标题变化
  if (fromSnapshot.title !== toSnapshot.title) {
    changes.push({
      site_id: siteId,
      from_snapshot_id: fromSnapshot.id,
      to_snapshot_id: toSnapshot.id,
      change_type: 'title',
      field_name: '页面标题',
      old_value: fromSnapshot.title || '(空)',
      new_value: toSnapshot.title || '(空)',
      summary: `🔔 标题已更改: "${(fromSnapshot.title || '').substring(0, 50)}" → "${(toSnapshot.title || '').substring(0, 50)}"`,
    });
  }

  // 描述变化
  if (fromSnapshot.meta_description !== toSnapshot.meta_description) {
    changes.push({
      site_id: siteId,
      from_snapshot_id: fromSnapshot.id,
      to_snapshot_id: toSnapshot.id,
      change_type: 'meta_description',
      field_name: 'Meta描述',
      old_value: (fromSnapshot.meta_description || '').substring(0, 200),
      new_value: (toSnapshot.meta_description || '').substring(0, 200),
      summary: `🔔 Meta描述已更改`,
    });
  }

  // H1数量变化
  if (fromSnapshot.h1_count !== toSnapshot.h1_count) {
    changes.push({
      site_id: siteId,
      from_snapshot_id: fromSnapshot.id,
      to_snapshot_id: toSnapshot.id,
      change_type: 'h1_count',
      field_name: 'H1数量',
      old_value: String(fromSnapshot.h1_count),
      new_value: String(toSnapshot.h1_count),
      summary: `🔔 H1标签数量: ${fromSnapshot.h1_count} → ${toSnapshot.h1_count}`,
    });
  }

  // 内容hash变化（整体内容变化）
  if (fromSnapshot.content_hash && toSnapshot.content_hash &&
      fromSnapshot.content_hash !== toSnapshot.content_hash) {
    changes.push({
      site_id: siteId,
      from_snapshot_id: fromSnapshot.id,
      to_snapshot_id: toSnapshot.id,
      change_type: 'content',
      field_name: '页面内容',
      old_value: '',
      new_value: '',
      summary: `📝 页面内容发生了变化（字数: ${fromSnapshot.word_count} → ${toSnapshot.word_count}）`,
    });
  }

  return changes;
}

// ==================== 执行检查 ====================

/**
 * 爬取一个URL并提取监控所需的关键数据
 */
async function fetchPageSnapshot(url) {
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);
    const fetchTime = Date.now() - startTime;
    const html = await response.text();

    // 简单解析关键信息
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
                     || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const metaDescription = descMatch ? descMatch[1].trim() : '';

    // 提取正文内容（用于hash比对）
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';
    const contentHash = computeContentHash(bodyContent);

    // 统计H1
    const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi);
    const h1Count = h1Matches ? h1Matches.length : 0;

    // 粗略字数
    const textContent = bodyContent.replace(/<[^>]*>/g, '').replace(/\\s+/g, ' ').trim();
    const wordCount = textContent.split(/\\s+/).filter(w => w.length > 0).length;

    return {
      url,
      title,
      metaDescription,
      contentHash,
      h1Count,
      wordCount,
      statusCode: response.status,
      fetchTime,
      snapshotData: {
        title,
        metaDescription,
        h1Count,
        wordCount,
        contentHash,
        statusCode: response.status,
        contentLength: html.length,
        bodyLength: bodyContent.length,
      },
    };
  } catch (err) {
    console.error(`[SiteMonitor] Fetch failed for ${url}:`, err.message);
    return {
      url,
      title: '',
      metaDescription: '',
      contentHash: '',
      h1Count: 0,
      wordCount: 0,
      statusCode: 0,
      fetchTime: 0,
      snapshotData: { error: err.message },
    };
  }
}

/**
 * 对单个监控站点执行检查
 * 返回检测到的变化列表
 */
export async function checkSingleSite(siteId) {
  // 获取站点信息
  const siteResult = await query('SELECT * FROM monitored_sites WHERE id = $1', [siteId]);
  if (siteResult.rows.length === 0) {
    throw new Error(`Site not found: id=${siteId}`);
  }
  const site = siteResult.rows[0];

  console.log(`[SiteMonitor] Checking: ${site.url}`);

  // 1. 爬取页面快照
  const pageData = await fetchPageSnapshot(site.url);

  // 2. 保存快照
  const snapshotResult = await query(`
    INSERT INTO site_snapshots (site_id, content_hash, title, meta_description,
                                h1_count, word_count, status_code, fetch_time_ms,
                                snapshot_data, is_initial)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `, [
    siteId,
    pageData.contentHash,
    pageData.title.substring(0, 500),
    pageData.metaDescription.substring(0, 1000),
    pageData.h1Count,
    pageData.wordCount,
    pageData.statusCode,
    pageData.fetchTime,
    JSON.stringify(pageData.snapshotData),
    site.last_snapshot_id === null, // is_initial = true if no previous snapshot
  ]);

  const newSnapshotId = snapshotResult.rows[0].id;
  const changes = [];

  // 3. 如果有之前的快照，进行比对
  if (site.last_snapshot_id) {
    const prevSnapshot = await query('SELECT * FROM site_snapshots WHERE id = $1', [site.last_snapshot_id]);
    if (prevSnapshot.rows.length > 0) {
      const detectedChanges = await compareSnapshots(siteId, prevSnapshot.rows[0], {
        id: newSnapshotId,
        title: pageData.title,
        meta_description: pageData.metaDescription,
        content_hash: pageData.contentHash,
        h1_count: pageData.h1Count,
        word_count: pageData.wordCount,
        status_code: pageData.statusCode,
      });

      // 保存变化记录
      for (const change of detectedChanges) {
        const changeResult = await query(`
          INSERT INTO site_changes (site_id, from_snapshot_id, to_snapshot_id,
                                    change_type, field_name, old_value, new_value, summary)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, summary
        `, [
          change.site_id,
          change.from_snapshot_id,
          change.to_snapshot_id,
          change.change_type,
          change.field_name,
          change.old_value,
          change.new_value,
          change.summary,
        ]);
        changes.push(changeResult.rows[0]);
      }
    }
  }

  // 4. 更新站点状态
  const hasChanges = changes.length > 0;
  await query(`
    UPDATE monitored_sites
    SET last_checked = CURRENT_TIMESTAMP,
        last_changed_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE last_changed_at END,
        change_count = change_count + CASE WHEN $1 THEN $2 ELSE 0 END,
        last_status_code = $3,
        last_snapshot_id = $4,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
  `, [
    hasChanges,
    changes.length,
    pageData.statusCode,
    newSnapshotId,
    siteId,
  ]);

  console.log(`[SiteMonitor] Done: ${site.url} — ${changes.length} changes detected`);

  return {
    url: site.url,
    name: site.name,
    statusCode: pageData.statusCode,
    snapshotId: newSnapshotId,
    changes,
    isInitial: site.last_snapshot_id === null,
  };
}

/**
 * 检查所有活跃的监控站点
 * 返回所有站点的检查结果
 */
export async function checkAllSites() {
  await createTables();
  const sites = await getActiveSites();

  console.log(`[SiteMonitor] Checking ${sites.length} active sites`);

  const results = [];
  for (const site of sites) {
    try {
      const result = await checkSingleSite(site.id);
      results.push(result);

      // 间隔2秒，避免请求过快
      if (sites.length > 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error(`[SiteMonitor] Error checking ${site.url}:`, err.message);
      results.push({
        url: site.url,
        name: site.name,
        error: err.message,
      });
    }
  }

  console.log(`[SiteMonitor] All done — ${results.length} sites checked`);
  return results;
}

/**
 * 按站点获取变化历史
 */
export async function getSiteChanges(siteId, limit = 50, userId = 1) {
  // 先验证所有权
  const siteResult = await query(
    'SELECT id FROM monitored_sites WHERE id = $1 AND user_id = $2',
    [siteId, userId]
  );
  if (siteResult.rows.length === 0) return [];

  const result = await query(`
    SELECT id, change_type, field_name, old_value, new_value, summary, detected_at
    FROM site_changes
    WHERE site_id = $1
    ORDER BY detected_at DESC
    LIMIT $2
  `, [siteId, limit]);

  return result.rows;
}

/**
 * 获取所有站点最近的变化（用于首页概览）
 */
export async function getRecentChanges(userId = 1, limit = 20) {
  const result = await query(`
    SELECT sc.id, sc.change_type, sc.field_name, sc.summary, sc.detected_at,
           ms.url, ms.name as site_name
    FROM site_changes sc
    JOIN monitored_sites ms ON sc.site_id = ms.id
    WHERE ms.user_id = $1
    ORDER BY sc.detected_at DESC
    LIMIT $2
  `, [userId, limit]);

  return result.rows;
}

export default {
  createTables,
  addMonitoredSite,
  removeMonitoredSite,
  activateMonitoredSite,
  getUserMonitoredSites,
  getMonitoredSiteDetail,
  getActiveSites,
  getMonitorStats,
  computeContentHash,
  detectFieldChange,
  compareSnapshots,
  checkSingleSite,
  checkAllSites,
  getSiteChanges,
  getRecentChanges,
};
