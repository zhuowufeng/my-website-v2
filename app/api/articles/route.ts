// app/api/articles/route.ts — 文章历史 API (CRUD, 安全加固版)
// 模块8 安全：JWT 鉴权 + 限流 + 用户隔离

import {
  saveArticle,
  getArticleById,
  getUserArticles,
  getUserArticleCount,
  deleteArticle,
} from '../../../models/Article.js';
import { getAuthUserFromRequest } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import logger from '@/lib/logger';
import type { TokenPayload } from '@/lib/auth';

// GET /api/articles — List user's articles
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    // Single article lookup — requires auth or allow public for specific cases
    if (id) {
      const article = await getArticleById(parseInt(id));
      if (!article) {
        return Response.json({ error: '文章不存在' }, { status: 404 });
      }
      return Response.json({ article });
    }

    // Rate limit for listing
    const rateCheck = checkRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.resetAt);
    }

    // Authentication: try to get user from token, fallback to userId param
    const user = await getAuthUserFromRequest(request);
    const userId = user?.userId || parseInt(url.searchParams.get('userId') || '');
    
    if (!userId) {
      return Response.json({ error: '请先登录' }, { status: 401 });
    }

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    const type = url.searchParams.get('type') || undefined;
    const search = url.searchParams.get('search') || undefined;

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
  } catch (error: any) {
    logger.error('articles', 'GET error', error);
    return Response.json({ error: '查询失败' }, { status: 500 });
  }
}

// POST /api/articles — Save a new article
export async function POST(request: Request) {
  try {
    // Rate limit
    const rateCheck = checkRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.resetAt);
    }

    const body = await request.json();
    const { userId: bodyUserId, topic, articleType, title, content } = body;

    // Input validation
    if (!topic || !topic.trim()) {
      return Response.json({ error: '文章主题不能为空' }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return Response.json({ error: '文章内容不能为空' }, { status: 400 });
    }
    if (topic.length > 500) {
      return Response.json({ error: '主题不能超过500个字符' }, { status: 400 });
    }
    if (content.length > 100000) {
      return Response.json({ error: '文章内容不能超过100000个字符' }, { status: 400 });
    }

    // Sanitize input: prevent XSS in stored data
    const sanitizedTopic = topic.trim().replace(/[<>]/g, '');
    const sanitizedTitle = title ? title.trim().replace(/[<>]/g, '') : null;
    // Content is AI-generated, but still strip dangerous tags
    const sanitizedContent = sanitizeContent(content);

    // Determine userId: try JWT first, fallback to body param
    const user = await getAuthUserFromRequest(request);
    const userId = user?.userId || bodyUserId || null;

    if (!userId) {
      return Response.json({ error: '请先登录' }, { status: 401 });
    }

    const article = await saveArticle({
      userId,
      topic: sanitizedTopic,
      articleType: articleType || 'blog',
      title: sanitizedTitle,
      content: sanitizedContent,
    });

    logger.info('articles', `Article saved: id=${article.id} user=${userId}`);
    return Response.json({ article }, { status: 201 });
  } catch (error: any) {
    logger.error('articles', 'POST error', error);
    return Response.json({ error: '保存失败' }, { status: 500 });
  }
}

// DELETE /api/articles — Delete an article
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '');

    if (!id) {
      return Response.json({ error: '需要文章 id' }, { status: 400 });
    }

    // Auth: prefer JWT, fallback query param
    const user = await getAuthUserFromRequest(request);
    const userId = user?.userId || parseInt(url.searchParams.get('userId') || '');

    if (!userId) {
      return Response.json({ error: '请先登录' }, { status: 401 });
    }

    // Verify ownership: deleteArticle checks user_id match
    const deleted = await deleteArticle(id, userId);
    if (!deleted) {
      return Response.json({ error: '文章不存在或无权删除' }, { status: 404 });
    }

    logger.info('articles', `Article deleted: id=${id} user=${userId}`);
    return Response.json({ success: true, id: deleted.id });
  } catch (error: any) {
    logger.error('articles', 'DELETE error', error);
    return Response.json({ error: '删除失败' }, { status: 500 });
  }
}

/**
 * 清理内容中的危险 HTML
 */
function sanitizeContent(text: string): string {
  // Remove script tags and event handlers
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:');
}
