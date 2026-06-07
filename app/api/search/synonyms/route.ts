/**
 * /api/search/synonyms — 同义词管理API（中级功能）
 * 模块14：搜索能力
 *
 * GET  /api/search/synonyms → 获取所有同义词
 * POST /api/search/synonyms → 创建/更新同义词
 * DELETE /api/search/synonyms?id=N → 删除同义词
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export async function GET() {
  try {
    const result = await query(
      'SELECT id, word, synonyms, enabled, created_at, updated_at FROM search_synonyms ORDER BY word',
      []
    );
    return NextResponse.json({
      synonyms: result.rows.map((r: any) => ({
        ...r,
        synonyms: typeof r.synonyms === 'string' ? JSON.parse(r.synonyms) : r.synonyms,
      })),
    });
  } catch (error: any) {
    console.error('[Synonyms API] GET Error:', error.message);
    return NextResponse.json({ synonyms: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { word, synonyms, enabled } = body;

    if (!word || !synonyms || !Array.isArray(synonyms) || synonyms.length === 0) {
      return NextResponse.json(
        { error: '请提供 word 和 synonyms 数组' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO search_synonyms (word, synonyms, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (word)
       DO UPDATE SET
         synonyms = EXCLUDED.synonyms,
         enabled = EXCLUDED.enabled,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, word, synonyms, enabled, created_at, updated_at`,
      [word.toLowerCase(), JSON.stringify(synonyms), enabled !== false]
    );

    return NextResponse.json({
      synonym: {
        ...result.rows[0],
        synonyms: JSON.parse(result.rows[0].synonyms),
      },
    });
  } catch (error: any) {
    console.error('[Synonyms API] POST Error:', error.message);
    return NextResponse.json(
      { error: '保存同义词失败', detail: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const word = searchParams.get('word');

    if (id) {
      await query('DELETE FROM search_synonyms WHERE id = $1', [parseInt(id)]);
    } else if (word) {
      await query('DELETE FROM search_synonyms WHERE word = $1', [word.toLowerCase()]);
    } else {
      return NextResponse.json(
        { error: '请提供 id 或 word 参数' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Synonyms API] DELETE Error:', error.message);
    return NextResponse.json(
      { error: '删除同义词失败' },
      { status: 500 }
    );
  }
}
