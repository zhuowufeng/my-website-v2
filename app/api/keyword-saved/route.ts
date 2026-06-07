/**
 * /api/keyword-saved — 保存的关键词管理
 * GET: 获取已保存的关键词列表
 * POST: 保存一个新关键词
 * DELETE: 删除已保存的关键词
 */

import { NextRequest, NextResponse } from 'next/server';
import * as KeywordResearchModel from '../../../models/KeywordResearch';
import { getAuthUserFromRequest } from '../../../lib/auth';

// GET — 获取已保存关键词
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    await KeywordResearchModel.createTable();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const keywords = await KeywordResearchModel.getSavedKeywords(user.userId, limit, offset);

    return NextResponse.json({ keywords });
  } catch (error) {
    console.error('[keyword-saved] Error:', (error as Error).message);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST — 保存关键词
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { keyword, notes, searchVolume, competition } = body;

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json({ error: '请提供关键词' }, { status: 400 });
    }

    await KeywordResearchModel.createTable();

    const saved = await KeywordResearchModel.saveKeyword(
      user.userId,
      keyword.trim(),
      notes || '',
      searchVolume || 0,
      competition || 'medium'
    );

    return NextResponse.json(saved);
  } catch (error) {
    console.error('[keyword-saved] Error:', (error as Error).message);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

// DELETE — 删除保存的关键词
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '');

    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    await KeywordResearchModel.createTable();

    const deleted = await KeywordResearchModel.deleteSavedKeyword(id, user.userId);
    if (!deleted) {
      return NextResponse.json({ error: '关键词不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[keyword-saved] Error:', (error as Error).message);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
