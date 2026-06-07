// /api/blog/posts — Blog posts CRUD API
// GET: 获取文章列表（admin: 全部, public: 仅已发布）
// POST: 创建新文章（需admin）
import { NextRequest, NextResponse } from 'next/server';
import { getAllPosts, createPost, getPublishedPosts, getPublishedPostCount, createTable } from '@/models/BlogPost.js';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user = await getAuthUserFromRequest(request);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    if (user && user.role === 'admin') {
      const { posts, total } = await getAllPosts({ limit, offset });
      return NextResponse.json({ posts, total, page, limit, totalPages: Math.ceil(total / limit) });
    } else {
      const [posts, total] = await Promise.all([
        getPublishedPosts({ limit, offset }),
        getPublishedPostCount(),
      ]);
      return NextResponse.json({ posts, total, page, limit, totalPages: Math.ceil(total / limit) });
    }
  } catch (err: any) {
    console.error('[API] blog posts GET error:', err.message);
    return NextResponse.json({ error: '获取文章列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    await createTable();
    const body = await request.json();
    const { title, content, excerpt, category, tags, slug, cover_image, status } = body;
    if (!title || !content) {
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 });
    }
    const post = await createPost({
      title, content,
      description: excerpt || '',
      keywords: '',
      category, tags, slug,
      coverImage: cover_image || '',
      authorId: user.userId,
      status: status || 'draft',
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (err: any) {
    console.error('[API] blog posts POST error:', err.message);
    return NextResponse.json({ error: '创建文章失败' }, { status: 500 });
  }
}
