/**
 * /api/search/es/health — ES 健康检查
 */
import { NextResponse } from 'next/server';
import { getESHealth } from '../../../../../lib/es-search';
import { isESAvailable, getIndexPrefix } from '../../../../../lib/es-client';
import { getESIndexStatus } from '../../../../../lib/es-indexer';

export async function GET() {
  try {
    const available = await isESAvailable();
    const health = available ? await getESHealth() : { status: 'unavailable' };
    const indexStatus = available ? await getESIndexStatus() : { available: false };

    return NextResponse.json({
      available,
      prefix: getIndexPrefix(),
      cluster: health,
      indexes: indexStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { available: false, error: error.message },
      { status: 500 }
    );
  }
}
