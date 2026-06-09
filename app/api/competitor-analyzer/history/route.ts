/**
 * GET /api/competitor-analyzer/history?userId=xxx&limit=10
 * 分析历史查询 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisHistory, getAnalysisById } from '@/models/CompetitorAnalysis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const id = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (id) {
      // Get specific analysis
      const analysis = await getAnalysisById(id);
      if (!analysis) {
        return NextResponse.json({ error: '分析记录不存在' }, { status: 404 });
      }
      return NextResponse.json(analysis);
    }

    if (!userId) {
      return NextResponse.json({ error: '请提供 userId 参数' }, { status: 400 });
    }

    const history = await getAnalysisHistory(userId, Math.min(limit, 50));
    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('[CompetitorAnalyzer] history error:', error);
    return NextResponse.json(
      { error: error.message || '查询失败' },
      { status: 500 }
    );
  }
}
