/**
 * /api/search/history — 搜索历史
 * 模块14：搜索能力
 *
 * GET  /api/search/history — 获取我的搜索历史
 * DELETE /api/search/history?keyword=xxx — 删除搜索历史
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSearchHistory, deleteSearchHistory } from '../../../../models/SearchQuery';
import { getAuthUserFromRequest } from '../../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ history: [] });
    }
    const history = await getSearchHistory(user.userId);
    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('[Search History API] Error:', error.message);
    return NextResponse.json({ history: [] });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || undefined;
    await deleteSearchHistory(user.userId, keyword);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Search History Delete] Error:', error.message);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
