// /api/blog/categories — Blog categories API

import { NextRequest, NextResponse } from 'next/server';
import { getCategories, getAllCategories } from '@/models/BlogPost.js';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    
    if (user && user.role === 'admin') {
      const categories = await getAllCategories();
      return NextResponse.json({ categories });
    } else {
      const categories = await getCategories();
      return NextResponse.json({ categories });
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[API] blog categories GET error:', error.message);
    return NextResponse.json({ error: '获取分类失败' }, { status: 500 });
  }
}
