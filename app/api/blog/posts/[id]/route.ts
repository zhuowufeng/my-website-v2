// /api/blog/posts/[id] — Single blog post API
// GET: 获取单篇文章
// PUT: 更新文章（需admin）
// DELETE: 删除文章（需admin）

import { NextRequest, NextResponse } from 'next/server';
import { getPostById, getPostBySlug, updatePost, deletePost, incrementViewCount } from '@/models/BlogPost.js';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const isSlug = searchParams.get('by') === 'slug';

    let post;
    if (isSlug) {
      post = await getPostBySlug(id);
      if (post) {
        // Increment view count
        incrementViewCount(id).catch(() => {});
      }
    } else {
      const numericId = parseInt(id);
      if (isNaN(numericId)) {
        return NextResponse.json({ error: '无效的ID' }, { status: 400 });
      }
      post = await getPostById(numericId);
      
      // If admin and post doesn't exist publicly, check admin access
      if (!post) {
        const user = await getAuthUserFromRequest(request);
        if (!user || user.role !== 'admin') {
          return NextResponse.json({ error: '文章不存在' }, { status: 404 });
        }
        // Allow admin to get post by id even if not published
        const { getAdminPostBySlug } = await import('@/models/BlogPost.js');
        // Actually just use getPostById which already works for all
      }
    }

    if (!post) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (err: any) {
    console.error('[API] blog post GET error:', err.message);
    return NextResponse.json({ error: '获取文章失败' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }

    const { id } = await params;
    const numericId = parseInt(id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const body = await request.json();
    const existing = await getPostById(numericId);
    if (!existing) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }

    const post = await updatePost(numericId, {
      title: body.title,
      slug: body.slug,
      content: body.content,
      description: body.description,
      keywords: body.keywords,
      category: body.category,
      tags: body.tags,
      coverImage: body.coverImage,
      status: body.status,
    });

    return NextResponse.json({ post, message: '文章更新成功' });
  } catch (err: any) {
    console.error('[API] blog post PUT error:', err.message);
    return NextResponse.json({ error: '更新文章失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }

    const { id } = await params;
    const numericId = parseInt(id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const result = await deletePost(numericId);
    if (!result) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }

    return NextResponse.json({ message: '文章已删除' });
  } catch (err: any) {
    console.error('[API] blog post DELETE error:', err.message);
    return NextResponse.json({ error: '删除文章失败' }, { status: 500 });
  }
}
