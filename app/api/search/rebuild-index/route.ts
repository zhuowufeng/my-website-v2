/**
 * /api/search/rebuild-index — 搜索索引管理API（中级功能）
 * 模块14：搜索能力
 *
 * POST /api/search/rebuild-index → 重建搜索索引
 * GET  /api/search/rebuild-index?status=true → 查看索引状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSearchIndexStatus, rebuildSearchIndex } from '../../../../models/SearchQuery';

export async function GET() {
  try {
    const status = await getSearchIndexStatus();
    return NextResponse.json({ indexes: status });
  } catch (error: any) {
    console.error('[Rebuild Index API] GET Error:', error.message);
    return NextResponse.json({ indexes: [] });
  }
}

export async function POST() {
  try {
    const results = await rebuildSearchIndex();
    const failed = results.filter(r => r.status === 'failed');
    const success = results.filter(r => r.status === 'created');

    return NextResponse.json({
      success: failed.length === 0,
      results,
      summary: `✅ ${success.length} indexes rebuilt, ❌ ${failed.length} failed`,
    });
  } catch (error: any) {
    console.error('[Rebuild Index API] POST Error:', error.message);
    return NextResponse.json(
      { error: '重建索引失败', detail: error.message },
      { status: 500 }
    );
  }
}
