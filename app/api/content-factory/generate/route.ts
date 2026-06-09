// /api/content-factory/generate — 内容生成管线
// POST: 从选题计划生成一篇博客文章，自动保存到blog_posts表
// POST /batch: 批量生成多个选题
// 流程：content_plan → DeepSeek API → blog_posts (draft) → 更新plan状态

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { createTable as createPlansTable, getPlanById, updatePlan, getNextPlansToGenerate } from '@/models/ContentFactory';
import { createTable as createBlogTable, createPost } from '@/models/BlogPost';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200) || 'post-' + Date.now();
}

const GENERATION_PROMPT = `你是一个专业的SEO博客写手。根据用户提供的主题和风格，写一篇高质量的SEO博客文章。

要求：
1. 标题包含主要关键词，吸引人点击（40-60字）
2. 开头 hook 段落（80-120字），吸引读者继续阅读
3. 正文 4-6 个段落，每段包含：小标题 + 详细内容（200-400字）
4. 内容要实用、有深度，不是空洞的套话
5. 自然融入关键词，不要硬塞
6. 结尾总结 + 行动呼吁（80-120字）
7. 输出 ONLY valid JSON

输出格式：
{
  "title": "博客标题（含关键词，60字以内）",
  "metaDescription": "SEO meta描述，140-160字，包含关键词，像搜索引擎摘要",
  "hook": "开头吸引段落（80-120字）",
  "sections": [
    { "heading": "段落小标题", "content": "详细内容（200-400字）" }
  ],
  "conclusion": "总结段落，包含行动呼吁（80-120字）",
  "keywords": ["主要关键词", "相关关键词1", "相关关键词2"]
}`;

async function generateContent(topic, style = 'tutorial') {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY 未配置');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: GENERATION_PROMPT,
        },
        {
          role: 'user',
          content: `主题：${topic}\n风格：${style === 'tutorial' ? '教程式' : style === 'listicle' ? '清单式' : style === 'analysis' ? '深度分析' : style === 'story' ? '故事式' : '观点式'}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response
  let clean = rawContent.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // If JSON parsing fails, use raw content
    return {
      title: topic.substring(0, 60),
      metaDescription: topic + ' - 实用指南与技巧分享',
      hook: '',
      sections: [{ heading: '', content: rawContent }],
      conclusion: '',
      keywords: [topic],
    };
  }

  return {
    title: parsed.title || topic.substring(0, 60),
    metaDescription: parsed.metaDescription || `${topic} - 实用指南与技巧分享`,
    hook: parsed.hook || '',
    sections: parsed.sections || [],
    conclusion: parsed.conclusion || '',
    keywords: parsed.keywords || [topic],
  };
}

function buildPostContent(generated) {
  let html = '';

  if (generated.hook) {
    html += `<p class="lead">${generated.hook}</p>\n\n`;
  }

  for (const section of generated.sections) {
    if (section.heading) {
      html += `## ${section.heading}\n\n`;
    }
    const paragraphs = section.content.split('\n').filter(p => p.trim());
    for (const p of paragraphs) {
      html += `<p>${p.trim()}</p>\n\n`;
    }
  }

  if (generated.conclusion) {
    html += `## 总结\n\n`;
    html += `<p>${generated.conclusion}</p>`;
  }

  return html;
}

// POST /api/content-factory/generate — 生成单篇文章
export async function POST(request) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }

    const body = await request.json();
    const { planId, topic, style = 'tutorial', category = '未分类' } = body;

    if (!planId && !topic) {
      return NextResponse.json({ error: '请提供选题ID或主题' }, { status: 400 });
    }

    // Ensure tables exist
    await createPlansTable().catch(() => {});
    await createBlogTable().catch(() => {});

    // Get plan data
    let planData = null;
    let finalTopic = topic;
    let finalStyle = style;
    let finalCategory = category;

    if (planId) {
      planData = await getPlanById(planId);
      if (!planData) {
        return NextResponse.json({ error: '选题不存在' }, { status: 404 });
      }
      finalTopic = planData.title_suggestion || planData.keyword;
      finalStyle = planData.style || 'tutorial';
      finalCategory = planData.category || '未分类';

      // Mark as generating
      await updatePlan(planId, { status: 'generating' }).catch(() => {});
    }

    // Generate content
    const generated = await generateContent(finalTopic, finalStyle);

    // Build full HTML content
    const content = buildPostContent(generated);

    // Create blog post
    const slug = slugify(generated.title);
    const post = await createPost({
      title: generated.title.substring(0, 300),
      slug,
      content,
      description: generated.metaDescription?.substring(0, 400) || '',
      keywords: generated.keywords || [],
      category: finalCategory,
      tags: generated.keywords?.slice(0, 5) || [],
      coverImage: '',
      authorId: user.userId,
      status: 'draft',
    });

    // Update plan status
    if (planId) {
      await updatePlan(planId, {
        status: 'draft',
        blogPostId: post.id,
      }).catch(() => {});
    }

    return NextResponse.json({
      post: {
        ...post,
        generatedTitle: generated.title,
        metaDescription: generated.metaDescription,
        keywords: generated.keywords,
        sections: generated.sections,
      },
      message: `文章「${generated.title}」已生成并保存为草稿`,
    }, { status: 201 });
  } catch (err) {
    console.error('[ContentFactory] Generate error:', err.message);
    return NextResponse.json({ error: '生成失败：' + err.message }, { status: 500 });
  }
}

// PATCH /api/content-factory/generate/batch — 批量生成
export async function PATCH(request) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    }

    const body = await request.json();
    const count = body.count || 3; // 默认生成3篇

    await createPlansTable().catch(() => {});
    await createBlogTable().catch(() => {});

    // Get next planned topics
    const plans = await getNextPlansToGenerate(count);

    if (!plans.length) {
      return NextResponse.json({ message: '没有待生成的选题' });
    }

    const results = [];
    const errors = [];

    for (const plan of plans) {
      try {
        // Mark as generating
        await updatePlan(plan.id, { status: 'generating' });

        const generated = await generateContent(
          plan.title_suggestion || plan.keyword,
          plan.style || 'tutorial'
        );
        const content = buildPostContent(generated);
        const slug = slugify(generated.title);

        const post = await createPost({
          title: generated.title.substring(0, 300),
          slug,
          content,
          description: generated.metaDescription?.substring(0, 400) || '',
          keywords: generated.keywords || [],
          category: plan.category,
          tags: generated.keywords?.slice(0, 5) || [],
          coverImage: '',
          authorId: user.userId,
          status: 'draft',
        });

        await updatePlan(plan.id, {
          status: 'draft',
          blogPostId: post.id,
        });

        results.push({
          planId: plan.id,
          keyword: plan.keyword,
          postId: post.id,
          title: generated.title,
          slug,
        });
      } catch (err) {
        errors.push({ planId: plan.id, keyword: plan.keyword, error: err.message });
        // Reset plan status
        await updatePlan(plan.id, { status: 'planned' }).catch(() => {});
      }
    }

    return NextResponse.json({
      generated: results.length,
      failed: errors.length,
      results,
      errors,
      message: `成功生成 ${results.length} 篇文章，${errors.length} 篇失败。`,
    });
  } catch (err) {
    console.error('[ContentFactory] Batch generate error:', err.message);
    return NextResponse.json({ error: '批量生成失败：' + err.message }, { status: 500 });
  }
}
