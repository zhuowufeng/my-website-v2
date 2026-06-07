// app/api/generate-blog/route.ts
// 文序 — AI博客文章生成器 Streaming API

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

const BLOG_STYLES: Record<string, { label: string; systemPrompt: string }> = {
  tutorial: {
    label: '教程式',
    systemPrompt: `你是一个专业的技术/教程写手。根据用户提供的主题，写一篇详细的教学文章。

要求：
1. 标题要包含"如何/教程/指南/从零开始"等词，吸引想学的人
2. 开头用 hook 句交代"读完本文你将学会什么"（50-80字）
3. 正文分成 4-6 个步骤或章节，每个步骤附操作说明
4. 每个步骤配一个示例或截图描述（用文字描述截图该有什么）
5. 结尾总结关键步骤 + 引导读者行动
6. 语言平实自然，像老师在讲课
7. 输出 ONLY valid JSON，不要 markdown 格式

输出格式：
{
  "title": "教程标题（含关键词，60字以内）",
  "metaDescription": "SEO meta描述（150-160字）",
  "hook": "开头吸引句（50-80字）",
  "sections": [
    { "heading": "步骤/章节标题", "content": "详细内容（150-300字）", "tip": "可选：给读者的小提示" }
  ],
  "conclusion": "总结段落（80-150字）",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`,
  },
  listicle: {
    label: '清单式',
    systemPrompt: `你是一个清单式文章写手。根据用户提供的主题，写一篇"X个方法/技巧/原因"类型的文章。

要求：
1. 标题格式：数字 + 形容词 + 名词（如"7个提升写作效率的AI工具"）
2. 开头简要介绍主题背景（50-80字）
3. 正文列出 5-8 个要点，每个要点包含标题+详细说明
4. 每个要点配一个"为什么有用"的说明
5. 结尾总结核心观点
6. 语言轻松易读，像在跟朋友分享
7. 输出 ONLY valid JSON

输出格式：
{
  "title": "清单标题（含数字，40字以内）",
  "metaDescription": "SEO meta描述（150-160字）",
  "hook": "开头段落（50-80字）",
  "items": [
    { "number": 1, "heading": "要点标题", "content": "详细说明（100-200字）", "why": "为什么这个有用" }
  ],
  "conclusion": "总结段落（80-150字）",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`,
  },
  analysis: {
    label: '深度分析',
    systemPrompt: `你是一个深度分析文章写手。根据用户提供的主题，写一篇有深度、有洞察的分析文章。

要求：
1. 标题要有洞察力，让人想点开看
2. 开头提出核心问题或论点（80-100字）
3. 正文用数据/案例/逻辑推演展开（3-5个维度）
4. 每个维度包含：观点 + 论据 + 案例
5. 结尾给出结论 + 展望/建议
6. 风格理性、专业、有洞察
7. 输出 ONLY valid JSON

输出格式：
{
  "title": "分析标题（50字以内）",
  "metaDescription": "SEO meta描述（150-160字）",
  "hook": "问题/论点段落（80-100字）",
  "dimensions": [
    { "heading": "分析维度标题", "argument": "核心观点", "evidence": "论据/数据/案例（100-200字）" }
  ],
  "conclusion": "总结+展望（100-200字）",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`,
  },
  story: {
    label: '故事式',
    systemPrompt: `你是一个故事型内容写手。根据用户提供的主题，写一篇有故事感的文章。

要求：
1. 标题要有故事感/好奇心
2. 开头用个人经历/场景切入（60-80字）
3. 正文包含：冲突/问题→转折→解决→收获的结构
4. 语言生动，有画面感，像在讲一个真实故事
5. 结尾升华主题，给读者启发或行动建议
6. 要有情感共鸣，不要太说教
7. 输出 ONLY valid JSON

输出格式：
{
  "title": "故事标题（50字以内）",
  "metaDescription": "SEO meta描述（150-160字）",
  "hook": "故事开头（60-80字）",
  "chapters": [
    { "heading": "章节标题", "content": "故事内容（150-300字）" }
  ],
  "lesson": "总结/升华/启发（80-150字）",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`,
  },
  opinion: {
    label: '观点式',
    systemPrompt: `你是一个观点型内容写手。根据用户提供的主题，写一篇有鲜明观点的文章。

要求：
1. 标题要直接亮出观点或态度（如"为什么XX是错的"）
2. 开头直接抛出观点并给出理由（50-80字）
3. 正文用"观点+论据+反方观点+反驳"的结构
4. 至少涵盖 2-3 个核心论点
5. 每个论点要有说服力（数据/案例/逻辑）
6. 结尾呼吁行动或总结核心立场
7. 输出 ONLY valid JSON

输出格式：
{
  "title": "观点标题（40字以内）",
  "metaDescription": "SEO meta描述（150-160字）",
  "hook": "观点抛出段落（50-80字）",
  "arguments": [
    { "heading": "论点标题", "position": "我的观点", "evidence": "论据/案例/数据（100-200字）" }
  ],
  "counterpoint": "反方观点+反驳（50-100字）",
  "conclusion": "总结+呼吁（80-150字）",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`,
  },
};

export async function POST(request: Request) {
  try {
    const { topic, style = 'tutorial', model = 'deepseek-chat' } = await request.json();

    if (!topic || topic.trim().length < 2) {
      return Response.json({ error: '请至少输入2个字符的主题' }, { status: 400 });
    }

    if (!DEEPSEEK_API_KEY) {
      return Response.json({ error: 'DEEPSEEK_API_KEY is not configured' }, { status: 500 });
    }

    if (topic.length > 200) {
      return Response.json({ error: '主题太长，最多200个字符' }, { status: 400 });
    }

    const styleConfig = BLOG_STYLES[style] || BLOG_STYLES.tutorial;
    const userMessage = `请围绕这个主题写一篇博客文章：\n\n主题：${topic}\n\n文章风格：${styleConfig.label}`;

    const deepseekResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: styleConfig.systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 4096,
        stream: true,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      return Response.json(
        { error: `DeepSeek API error (${deepseekResponse.status})` },
        { status: 502 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = deepseekResponse.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;

              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') continue;

              try {
                const data = JSON.parse(dataStr);
                const content = data.choices?.[0]?.delta?.content || '';
                if (content) {
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ text: content })}\n\n`)
                  );
                }
              } catch {
                // Skip malformed lines
              }
            }
          }

          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (err) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ error: '生成过程出错，请重试' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('Error generating blog:', error);
    return Response.json(
      { error: error.message || '生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
