// /api/content-factory/queue — 内容队列CRUD
// GET: 获取内容队列（支持状态/分类过滤）
// POST: 手动创建选题计划
// PUT: 更新选题计划（状态、排期等）
// DELETE: 删除选题计划

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import {
  createTable, getPlans, getPlanById, createPlan,
  updatePlan, deletePlan, getStats, getCategoryBreakdown
} from '@/models/ContentFactory';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const includeStats = searchParams.get('stats') === 'true';
    const includeCategories = searchParams.get('categories') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    await createTable();
    const [plans, stats, categories] = await Promise.all([
      getPlans({ status, limit, offset, category }),
      includeStats ? getStats() : Promise.resolve(null),
      includeCategories ? getCategoryBreakdown() : Promise.resolve(null),
    ]);

    return NextResponse.json({ plans, stats, categories });
  } catch (err) {
    console.error('[ContentFactory] Queue GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }

    await createTable();
    const body = await request.json();

    if (!body.keyword || body.keyword.trim().length < 2) {
      return NextResponse.json({ error: '关键词不能为空' }, { status: 400 });
    }

    const plan = await createPlan({
      keyword: body.keyword,
      titleSuggestion: body.titleSuggestion,
      description: body.description,
      style: body.style || 'tutorial',
      category: body.category || '未分类',
      priority: body.priority || 0,
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    console.error('[ContentFactory] Queue POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates }: { id?: any; [key: string]: any } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少选题ID' }, { status: 400 });
    }

    const existing = await getPlanById(id);
    if (!existing) {
      return NextResponse.json({ error: '选题不存在' }, { status: 404 });
    }

    // Build update payload
    const updateFields: Record<string, any> = {};
    if (updates.status) updateFields.status = updates.status;
    if (updates.keyword) updateFields.keyword = updates.keyword;
    if (updates.titleSuggestion !== undefined) updateFields.titleSuggestion = updates.titleSuggestion;
    if (updates.description !== undefined) updateFields.description = updates.description;
    if (updates.style) updateFields.style = updates.style;
    if (updates.category) updateFields.category = updates.category;
    if (updates.priority !== undefined) updateFields.priority = updates.priority;
    if (updates.scheduledFor !== undefined) updateFields.scheduledFor = updates.scheduledFor;
    if (updates.blogPostId !== undefined) updateFields.blogPostId = updates.blogPostId;

    // When scheduling, also auto-transition status
    if (updates.scheduledFor && !updates.status) {
      updateFields.status = 'scheduled';
    }

    const plan = await updatePlan(id, updateFields);
    return NextResponse.json({ plan, message: '更新成功' });
  } catch (err) {
    console.error('[ContentFactory] Queue PUT error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');

    if (!id) {
      return NextResponse.json({ error: '缺少选题ID' }, { status: 400 });
    }

    const deleted = await deletePlan(id);
    if (!deleted) {
      return NextResponse.json({ error: '选题不存在' }, { status: 404 });
    }

    return NextResponse.json({ message: '选题已删除' });
  } catch (err) {
    console.error('[ContentFactory] Queue DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
