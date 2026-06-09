// /api/content-factory/stats — 内容工厂统计
// GET: 综合统计：整体概览、分类分布、每日趋势、性能数据

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { createTable, getStats, getCategoryBreakdown } from '@/models/ContentFactory';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }

    await createTable().catch(() => {});

    // Pipeline stats: how many at each stage
    const pipelineStats = await getStats();

    // Category breakdown
    const categoryStats = await getCategoryBreakdown();

    // Blog performance: top posts by views
    const topPosts = await query(`
      SELECT id, title, slug, view_count, status, published_at, category
      FROM blog_posts
      WHERE status = 'published'
      ORDER BY view_count DESC
      LIMIT 10;
    `).then(r => r.rows).catch(() => []);

    // Total published posts
    const totalPublished = await query(`
      SELECT COUNT(*) as count FROM blog_posts WHERE status = 'published';
    `).then(r => r.rows[0]?.count || 0).catch(() => 0);

    // Total views
    const totalViews = await query(`
      SELECT COALESCE(SUM(view_count), 0) as total FROM blog_posts;
    `).then(r => r.rows[0]?.total || 0).catch(() => 0);

    // Recent posts (last 30 days)
    const recentPosts = await query(`
      SELECT COUNT(*) as count
      FROM blog_posts
      WHERE published_at >= NOW() - INTERVAL '30 days'
        AND status = 'published';
    `).then(r => r.rows[0]?.count || 0).catch(() => 0);

    // Content pipeline funnel
    const funnel = await query(`
      SELECT
        (SELECT COUNT(*) FROM content_plans) as planned_total,
        (SELECT COUNT(*) FROM content_plans WHERE status = 'planned') as to_generate,
        (SELECT COUNT(*) FROM content_plans WHERE status = 'draft' OR status = 'scheduled') as waiting_publish,
        (SELECT COUNT(*) FROM content_plans WHERE status = 'published') as published_from_plans;
    `).then(r => r.rows[0]).catch(() => ({}));

    return NextResponse.json({
      pipeline: pipelineStats,
      categories: categoryStats,
      performance: {
        totalPublished,
        totalViews,
        recentPosts30d: recentPosts,
        topPosts,
      },
      funnel,
    });
  } catch (err) {
    console.error('[ContentFactory] Stats error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
