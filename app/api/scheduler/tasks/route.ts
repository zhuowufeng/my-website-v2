/**
 * /api/scheduler/tasks — 定时诊断任务管理API
 * 模块13：任务CRUD
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserTasks, addTask, removeTask } from '@/lib/scheduler';
import { query } from '@/lib/db';

// 获取用户信息（简化版，实际项目应使用session/jwt）
function getUserId(request: NextRequest): number {
  const { searchParams } = new URL(request.url);
  return parseInt(searchParams.get('userId') || '1');
}

/**
 * GET — 获取用户的所有定时诊断任务
 */
export async function GET(request: NextRequest) {
  const userId = getUserId(request);

  try {
    const tasks = await getUserTasks(userId);
    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — 添加新的定时诊断任务
 * Body: { url: string, cron_expression?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, cron_expression } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '请提供有效的URL' }, { status: 400 });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json({ error: 'URL格式不正确' }, { status: 400 });
    }

    const userId = getUserId(request);
    const task = await addTask(normalizedUrl, userId, cron_expression);

    return NextResponse.json({
      status: 'created',
      task,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT — 更新定时诊断任务
 * Body: { id: number, cron_expression?: string, is_active?: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, cron_expression, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: '请提供任务ID' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (cron_expression) {
      updates.push(`cron_expression = $${idx++}`);
      params.push(cron_expression);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    params.push(id);
    await query(`UPDATE scheduled_diagnoses SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    return NextResponse.json({ status: 'updated' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE — 删除一个定时诊断任务
 * Query: ?id=xxx
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get('id') || '0');

  if (!id) {
    return NextResponse.json({ error: '请提供任务ID' }, { status: 400 });
  }

  try {
    await removeTask(id);
    return NextResponse.json({ status: 'deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
