// /api/ads/placements — 广告位 CRUD
import { NextRequest, NextResponse } from 'next/server';
import {
  getAllAdPlacements,
  getActiveAdPlacements,
  getAdPlacementsByPosition,
  createAdPlacement,
  updateAdPlacement,
  deleteAdPlacement,
} from '@/models/AdPlacement';
import { getAuthUserFromRequest } from '@/lib/auth';

// GET — 获取广告位列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position');
    const activeOnly = searchParams.get('active') === 'true';

    let placements;
    if (position) {
      placements = await getAdPlacementsByPosition(position);
    } else if (activeOnly) {
      placements = await getActiveAdPlacements();
    } else {
      placements = await getAllAdPlacements();
    }

    return NextResponse.json({ placements });
  } catch (err: any) {
    console.error('[ads/placements] GET error:', err.message);
    return NextResponse.json(
      { error: 'Failed to fetch placements: ' + err.message },
      { status: 500 }
    );
  }
}

// POST — 创建广告位
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name || !body.position) {
      return NextResponse.json(
        { error: 'name and position are required' },
        { status: 400 }
      );
    }

    const validPositions = ['bottom', 'sidebar', 'inline', 'header', 'footer', 'popup', 'banner'];
    if (!validPositions.includes(body.position)) {
      return NextResponse.json(
        { error: `Invalid position. Must be one of: ${validPositions.join(', ')}` },
        { status: 400 }
      );
    }

    const placement = await createAdPlacement({
      name: body.name,
      position: body.position,
      source: body.source,
      ad_type: body.ad_type || 'custom',
      ad_code: body.ad_code,
      ad_script: body.ad_script,
      is_active: body.is_active !== false,
      priority: body.priority || 0,
      max_impressions_per_session: body.max_impressions_per_session || 1,
    });

    return NextResponse.json({ placement, success: true }, { status: 201 });
  } catch (err: any) {
    console.error('[ads/placements] POST error:', err.message);
    return NextResponse.json(
      { error: 'Failed to create placement: ' + err.message },
      { status: 500 }
    );
  }
}

// PUT — 更新广告位
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const placement = await updateAdPlacement(id, updateData);
    if (!placement) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 });
    }

    return NextResponse.json({ placement, success: true });
  } catch (err: any) {
    console.error('[ads/placements] PUT error:', err.message);
    return NextResponse.json(
      { error: 'Failed to update placement: ' + err.message },
      { status: 500 }
    );
  }
}

// DELETE — 删除广告位
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    await deleteAdPlacement(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[ads/placements] DELETE error:', err.message);
    return NextResponse.json(
      { error: 'Failed to delete placement: ' + err.message },
      { status: 500 }
    );
  }
}
