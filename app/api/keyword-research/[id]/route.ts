/**
 * /api/keyword-research/[id] — 单个关键词研究记录操作
 * GET: 获取详情 / DELETE: 删除记录 / PATCH: 收藏切换
 */

import { NextRequest, NextResponse } from 'next/server';
import * as KeywordResearchModel from '../../../../models/KeywordResearch';
import { getAuthUserFromRequest } from '../../../../lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    await KeywordResearchModel.createTable();
    const record = await KeywordResearchModel.getKeywordHistoryById(id, user.userId);
    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('[keyword-research] Error:', (error as Error).message);
    return NextResponse.json({ error: '获取记录失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    await KeywordResearchModel.createTable();
    const deleted = await KeywordResearchModel.deleteKeywordHistory(id, user.userId);
    if (!deleted) {
      return NextResponse.json({ error: '记录不存在或无权限' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[keyword-research] Error:', (error as Error).message);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const body = await request.json();
    
    if (body.action === 'toggle-favorite') {
      await KeywordResearchModel.createTable();
      const result = await KeywordResearchModel.toggleFavorite(id, user.userId);
      if (!result) {
        return NextResponse.json({ error: '记录不存在' }, { status: 404 });
      }
      return NextResponse.json({ is_favorite: result.is_favorite });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('[keyword-research] Error:', (error as Error).message);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
