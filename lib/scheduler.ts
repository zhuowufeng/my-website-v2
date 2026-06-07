/**
 * lib/scheduler.ts — ⏰ 模块13：定时任务核心
 *
 * 功能：
 * - node-cron 定时执行
 * - 管理待诊断URL列表
 * - 记录定时任务执行历史
 * - 支持外部cron服务调用
 */

import { query } from './db';
import SEOAudit from '../models/SEOAudit';

// ============ 数据库管理 ============

/**
 * 创建定时任务相关的数据库表
 */
export async function createSchedulerTables() {
  // 定时诊断配置表
  await query(`
    CREATE TABLE IF NOT EXISTS scheduled_diagnoses (
      id SERIAL PRIMARY KEY,
      url VARCHAR(2048) NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 1,
      cron_expression VARCHAR(100) DEFAULT '0 8 * * *',
      is_active BOOLEAN DEFAULT true,
      last_run TIMESTAMP,
      next_run TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(url, user_id)
    );
  `);

  // 诊断执行历史表
  await query(`
    CREATE TABLE IF NOT EXISTS diagnosis_history (
      id SERIAL PRIMARY KEY,
      url VARCHAR(2048) NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 1,
      score INTEGER,
      grade VARCHAR(2),
      status VARCHAR(20) DEFAULT 'success',
      error_message TEXT,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 索引
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_diag_hist_url ON diagnosis_history(url);');
    await query('CREATE INDEX IF NOT EXISTS idx_diag_hist_time ON diagnosis_history(executed_at DESC);');
    await query('CREATE INDEX IF NOT EXISTS idx_sched_active ON scheduled_diagnoses(is_active);');
  } catch {
    // ignore
  }
}

// ============ 任务管理 ============

export interface ScheduledDiagnosis {
  id: number;
  url: string;
  user_id: number;
  cron_expression: string;
  is_active: boolean;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

export interface DiagnosisHistory {
  id: number;
  url: string;
  user_id: number;
  score: number;
  grade: string;
  status: string;
  error_message: string | null;
  executed_at: string;
}

/**
 * 获取所有活跃的定时诊断任务
 */
export async function getActiveTasks(): Promise<ScheduledDiagnosis[]> {
  const { rows } = await query(
    'SELECT * FROM scheduled_diagnoses WHERE is_active = true ORDER BY created_at DESC'
  );
  return rows;
}

/**
 * 添加一个定时诊断任务
 */
export async function addTask(url: string, userId: number, cronExpr: string = '0 8 * * *') {
  await createSchedulerTables();
  const { rows } = await query(
    `INSERT INTO scheduled_diagnoses (url, user_id, cron_expression)
     VALUES ($1, $2, $3)
     ON CONFLICT (url, user_id) DO UPDATE SET
       is_active = true,
       cron_expression = EXCLUDED.cron_expression
     RETURNING id`,
    [url, userId, cronExpr]
  );
  return rows[0];
}

/**
 * 删除/停用一个定时诊断任务
 */
export async function removeTask(id: number) {
  await query('UPDATE scheduled_diagnoses SET is_active = false WHERE id = $1', [id]);
}

/**
 * 获取用户的所有定时诊断任务
 */
export async function getUserTasks(userId: number): Promise<ScheduledDiagnosis[]> {
  await createSchedulerTables();
  const { rows } = await query(
    'SELECT * FROM scheduled_diagnoses WHERE user_id = $1 ORDER BY is_active DESC, created_at DESC',
    [userId]
  );
  return rows;
}

// ============ 执行引擎 ============

/**
 * 对单个URL执行SEO诊断并记录结果
 */
export async function runSingleDiagnosis(url: string, userId: number = 1): Promise<{
  status: string;
  score?: number;
  grade?: string;
  error?: string;
}> {
  try {
    // 分析URL
    const result = await SEOAudit.analyze(url);

    // 保存分析结果
    await SEOAudit.save(userId, result);

    // 记录执行历史
    try {
      await query(
        `INSERT INTO diagnosis_history (url, user_id, score, grade, status)
         VALUES ($1, $2, $3, $4, 'success')`,
        [url, userId, result.score, result.grade]
      );
    } catch {
      // 历史记录失败不影响主流程
    }

    // 更新任务的 last_run
    await query(
      'UPDATE scheduled_diagnoses SET last_run = NOW() WHERE url = $1 AND user_id = $2',
      [url, userId]
    );

    return { status: 'success', score: result.score, grade: result.grade };
  } catch (error: any) {
    console.error(`[scheduler] 诊断失败 ${url}:`, error.message);

    // 记录失败历史
    try {
      await query(
        `INSERT INTO diagnosis_history (url, user_id, status, error_message)
         VALUES ($1, $2, 'failed', $3)`,
        [url, userId, error.message.substring(0, 500)]
      );
    } catch {
      // ignore
    }

    return { status: 'failed', error: error.message };
  }
}

/**
 * 运行所有活跃的定时诊断任务
 * 返回执行结果汇总
 */
export async function runAllTasks(): Promise<{
  total: number;
  success: number;
  failed: number;
  results: Array<{ url: string; status: string; score?: number; grade?: string }>;
}> {
  await createSchedulerTables();
  const tasks = await getActiveTasks();

  console.log(`[scheduler] 开始执行 ${tasks.length} 个定时任务`);

  const results = [];
  let success = 0;
  let failed = 0;

  for (const task of tasks) {
    console.log(`[scheduler] 诊断: ${task.url}`);
    const result = await runSingleDiagnosis(task.url, task.user_id);

    results.push({ url: task.url, ...result });

    if (result.status === 'success') {
      success++;
    } else {
      failed++;
    }

    // 避免请求过快 — 每个请求间隔1秒
    if (tasks.length > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`[scheduler] 完成: ${success}成功, ${failed}失败`);

  return {
    total: tasks.length,
    success,
    failed,
    results,
  };
}

// ============ 统计查询 ============

/**
 * 获取诊断历史统计
 */
export async function getHistoryStats(userId?: number) {
  let sql = `
    SELECT
      COUNT(*)::int as total_runs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::int as successful_runs,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::int as failed_runs,
      ROUND(AVG(score))::int as avg_score,
      MAX(executed_at) as last_run
    FROM diagnosis_history
  `;
  const params: any[] = [];
  if (userId) {
    sql += ' WHERE user_id = $1';
    params.push(userId);
  }

  const { rows } = await query(sql, params);
  return rows[0];
}

/**
 * 获取最近的诊断历史
 */
export async function getRecentHistory(limit: number = 20, userId?: number): Promise<DiagnosisHistory[]> {
  let sql = 'SELECT * FROM diagnosis_history';
  const params: any[] = [];

  if (userId) {
    sql += ' WHERE user_id = $1';
    params.push(userId);
  }

  sql += ' ORDER BY executed_at DESC LIMIT $' + (params.length + 1);
  params.push(limit);

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * 获取评分趋势：每个URL最近X次的评分变化
 */
export async function getScoreTrends(limit: number = 7): Promise<Array<{
  url: string;
  scores: Array<{ score: number; executed_at: string }>;
  direction: 'up' | 'down' | 'stable';
  change: number;
}>> {
  // 获取每个URL最近的诊断记录
  const { rows } = await query(`
    SELECT DISTINCT ON (dh.url) 
      dh.url,
      dh.score,
      dh.executed_at,
      prev.prev_score,
      prev.prev_executed_at
    FROM diagnosis_history dh
    JOIN (
      SELECT url, score as prev_score, executed_at as prev_executed_at
      FROM (
        SELECT url, score, executed_at,
               ROW_NUMBER() OVER (PARTITION BY url ORDER BY executed_at DESC OFFSET 1) as rn
        FROM diagnosis_history
        WHERE status = 'success'
      ) sub
      WHERE rn = 1
    ) prev ON dh.url = prev.url
    WHERE dh.status = 'success'
    ORDER BY dh.url, dh.executed_at DESC
    LIMIT $1
  `, [limit]);

  if (!rows || rows.length === 0) {
    // 退一步：没有两次记录，只返回最后一次
    const single = await query(`
      SELECT DISTINCT ON (url) url, score, executed_at
      FROM diagnosis_history
      WHERE status = 'success'
      ORDER BY url, executed_at DESC
      LIMIT $1
    `, [limit]);

    return (single.rows || []).map((r: any) => ({
      url: r.url,
      scores: [{ score: r.score, executed_at: r.executed_at }],
      direction: 'stable' as const,
      change: 0,
    }));
  }

  return rows.map((r: any) => {
    const change = r.score - r.prev_score;
    let direction: 'up' | 'down' | 'stable';
    if (change > 5) direction = 'up';
    else if (change < -5) direction = 'down';
    else direction = 'stable';

    return {
      url: r.url,
      scores: [
        { score: r.prev_score, executed_at: r.prev_executed_at },
        { score: r.score, executed_at: r.executed_at },
      ],
      direction,
      change,
    };
  });
}
