// app/api/articles/route.ts — 文章历史 API (CRUD)
// Module 3 验证项目：RESTful API 设计 + 数据库操作

import {
  saveArticle,
  getArticleById,
  getUserArticles,
  getUserArticleCount,
  deleteArticle,
} from '../../../models/Article.js';
import { findUserByIdentifier } from '../../../models/User.js';

// Simple session/API key auth for now
function getUserIdFromRequest(request: Request): number | null {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Simple token lookup — in production, use JWT
    // For now, returning null means anonymous access
  }
  return null;
}

// GET /api/articles — List user's articles
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = parseInt(url.searchParams.get('userId') || '') || null;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    const type = url.searchParams.get('type') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const id = url.searchParams.get('id') || undefined;

    // Single article lookup
    if (id) {
      const article = await getArticleById(parseInt(id));
      if (!article) {
        return Response.json({ error: '文章不存在' }, { status: 404 });
      }
      return Response.json({ article });
    }

    // List articles
    if (userId) {
      const [articles, total] = await Promise.all([
        (getUserArticles as any)(userId, { limit, offset, type, search }),
        (getUserArticleCount as any)(userId, { type, search }),
      ]);
      return Response.json({
        articles,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      });
    }

    return Response.json({ error: '需要 userId 参数' }, { status: 400 });
  } catch (error: any) {
    console.error('[articles] GET error:', error);
    return Response.json({ error: error.message || '查询失败' }, { status: 500 });
  }
}

// POST /api/articles — Save a new article
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, topic, articleType, title, content } = body;

    if (!topic || !topic.trim()) {
      return Response.json({ error: '文章主题不能为空' }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return Response.json({ error: '文章内容不能为空' }, { status: 400 });
    }

    if (topic.length > 500) {
      return Response.json({ error: '主题不能超过500个字符' }, { status: 400 });
    }

    if (content.length > 50000) {
      return Response.json({ error: '文章内容不能超过50000个字符' }, { status: 400 });
    }

    const article = await saveArticle({
      userId: userId || null,
      topic: topic.trim(),
      articleType: articleType || 'blog',
      title: title || null,
      content: content.trim(),
    });

    return Response.json({ article }, { status: 201 });
  } catch (error: any) {
    console.error('[articles] POST error:', error);
    return Response.json({ error: error.message || '保存失败' }, { status: 500 });
  }
}

// DELETE /api/articles — Delete an article
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '');
    const userId = parseInt(url.searchParams.get('userId') || '');

    if (!id) {
      return Response.json({ error: '需要文章 id' }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ error: '需要用户 id' }, { status: 400 });
    }

    const deleted = await deleteArticle(id, userId);
    if (!deleted) {
      return Response.json({ error: '文章不存在或无权删除' }, { status: 404 });
    }

    return Response.json({ success: true, id: deleted.id });
  } catch (error: any) {
    console.error('[articles] DELETE error:', error);
    return Response.json({ error: error.message || '删除失败' }, { status: 500 });
  }
}
