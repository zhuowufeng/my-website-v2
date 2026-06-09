/**
 * /api/search/es/rebuild — ES 索引重建
 */
import { NextResponse } from 'next/server';
import { rebuildAllIndexes } from '../../../../../lib/es-indexer';

export async function POST() {
  try {
    const result = await rebuildAllIndexes();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: '索引重建失败', detail: error.message },
      { status: 500 }
    );
  }
}
