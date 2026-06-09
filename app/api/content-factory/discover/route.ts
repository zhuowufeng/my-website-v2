// /api/content-factory/discover — 话题发现
// 从关键词研究数据中发现内容机会，批量创建选题计划

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { createTable, discoverTopicsFromKeywords, createPlansBatch, getStats } from '@/models/ContentFactory';

const STYLE_BY_COMPETITION = {
  low: 'tutorial',
  medium: 'listicle',
  high: 'analysis',
};

const CATEGORY_KEYWORDS = {
  'AI工具': ['AI', '人工智能', '人工智慧', 'machine learning', 'GPT', '大模型', '聊天', 'chat'],
  'SEO优化': ['SEO', '搜索引擎', '排名', '关键词', '流量', '外链', 'backlink', 'search'],
  '写作技巧': ['写作', '文案', 'copywriting', '写作工具', '文章', '内容创作', 'blog'],
  '域名技术': ['域名', 'DNS', '托管', 'hosting', 'domain', 'SSL', '证书'],
  '网站开发': ['开发', '编程', 'code', '网站', 'Web', '前端', '后端', 'API', '框架'],
  '数据分析': ['数据', '分析', '统计', 'analytics', 'trend', '趋势', '监测'],
  '网络工具': ['HTTP', '检测', 'check', '速度', 'performance', '工具', '在线'],
};

function suggestCategory(keyword) {
  const kw = keyword.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => kw.includes(k))) return category;
  }
  return 'SEO优化';
}

function suggestTitle(keyword, competition) {
  const comp = competition || 'medium';
  switch (comp) {
    case 'low':
      return `${keyword}完整指南：从零开始轻松上手`;
    case 'medium':
      return `${keyword}：7个实用技巧帮你提升效率`;
    case 'high':
      return `${keyword}深度解析：原理、实践与最佳方案`;
    default:
      return `${keyword}入门攻略`;
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }

    await createTable();

    // Discover topics from saved keywords
    const keywords = await discoverTopicsFromKeywords(user.userId);

    if (!keywords.length) {
      return NextResponse.json({
        discovered: 0,
        created: 0,
        message: '没有发现新的关键词内容机会。请先在关键词挖掘工具中保存一些关键词。',
      });
    }

    // Convert keywords to content plans
    const plans = keywords.map(kw => ({
      keyword: kw.keyword,
      titleSuggestion: suggestTitle(kw.keyword, kw.competition),
      description: kw.notes || '',
      style: STYLE_BY_COMPETITION[kw.competition] || 'tutorial',
      category: suggestCategory(kw.keyword),
      priority: kw.search_volume ? Math.min(Math.round(kw.search_volume / 100), 100) : 5,
    }));

    const created = await createPlansBatch(plans);
    const stats = await getStats();

    return NextResponse.json({
      discovered: keywords.length,
      created: created.length,
      plans: created,
      stats,
      message: `发现 ${keywords.length} 个内容机会，已创建 ${created.length} 个选题计划。`,
    });
  } catch (err) {
    console.error('[ContentFactory] Discover error:', err.message);
    return NextResponse.json({ error: '发现话题失败：' + err.message }, { status: 500 });
  }
}

// GET: 返回可发现的关键词预览（不创建）
export async function GET(request) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }

    await createTable();
    const keywords = await discoverTopicsFromKeywords(user.userId);

    const previews = keywords.slice(0, 50).map(kw => ({
      keyword: kw.keyword,
      suggestedTitle: suggestTitle(kw.keyword, kw.competition),
      suggestedCategory: suggestCategory(kw.keyword),
      suggestedStyle: STYLE_BY_COMPETITION[kw.competition] || 'tutorial',
      searchVolume: kw.search_volume,
      competition: kw.competition,
    }));

    return NextResponse.json({
      total: keywords.length,
      previews,
      message: `发现 ${keywords.length} 个可选题内容机会。`,
    });
  } catch (err) {
    console.error('[ContentFactory] Discover preview error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
