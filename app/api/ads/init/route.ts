// /api/ads/init — 初始化广告系统（创建表+默认广告位）
import { NextRequest, NextResponse } from 'next/server';
import { initializeAdSystem } from '@/models/AdPlacement';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 仅允许已登录用户执行
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await initializeAdSystem();

    return NextResponse.json({
      success: true,
      message: '广告系统初始化完成',
    });
  } catch (err: any) {
    console.error('[ads/init] error:', err.message);
    return NextResponse.json(
      { error: '初始化失败: ' + err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    info: 'POST to /api/ads/init to initialize the ad system tables and defaults',
  });
}
