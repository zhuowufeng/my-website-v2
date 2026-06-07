/**
 * /api/cron/daily-diagnosis — 定时SEO诊断执行端点
 * 模块13 验证：可被外部cron服务调用的定时任务
 *
 * ⏰ 配置外部cron（如 cron-job.org）：
 *   每天 8:00 调用此接口即可实现每日自动诊断
 *   URL: https://你的域名/api/cron/daily-diagnosis
 *   可选传参: ?key=你的密钥（防滥用）
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAllTasks } from '@/lib/scheduler';

// 简单的密钥校验（可选，建议在正式环境使用）
const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key') || '';

  // 如果设置了密钥则验证
  if (CRON_SECRET && key !== CRON_SECRET) {
    return NextResponse.json({ error: '未授权访问' }, { status: 401 });
  }

  console.log('[cron] 开始执行每日SEO诊断任务');

  const startTime = Date.now();

  try {
    const result = await runAllTasks();
    const elapsed = Date.now() - startTime;

    console.log(`[cron] 诊断完成: ${result.total}个任务, 耗时${elapsed}ms`);

    return NextResponse.json({
      status: 'completed',
      timestamp: new Date().toISOString(),
      elapsed: `${elapsed}ms`,
      ...result,
    });
  } catch (error: any) {
    console.error('[cron] 诊断执行失败:', error.message);

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    }, { status: 500 });
  }
}

// 同时支持 POST（有些cron服务用POST）
export async function POST(request: NextRequest) {
  return GET(request);
}
