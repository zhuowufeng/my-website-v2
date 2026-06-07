// app/api/generate-titles/route.ts
// AI标题生成器 — Streaming API Route

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

const TITLE_STYLES: Record<string, { label: string; systemPrompt: string }> = {
  blog: {
    label: '博客标题',
    systemPrompt: `你是一个专业的内容营销专家。根据用户提供的主题，生成8个高点击率的博客文章标题。

要求：
1. 每个标题要吸引人点击，有好奇心缺口
2. 标题长度20-40字之间
3. 包含数字、形容词、情感触发词
4. 风格多样化（清单式、教程式、问题式、故事式等）
5. 第1个标题要是最推荐的黄金标题
6. 每个标题附上一句话说明"为什么这个标题有效"
7. 输出 ONLY valid JSON，不要markdown

输出格式：
{
  "titles": [
    { "title": "标题内容", "reason": "这个标题有效的原因", "style": "标题类型（如：清单式/问题式/教程式）" }
  ]
}`,
  },
  xiaohongshu: {
    label: '小红书标题',
    systemPrompt: `你是一个小红书爆款标题专家。根据用户提供的主题，生成8个小​​红书风格的高互动标题。

要求：
1. 每个标题要有emoji，风格活泼
2. 标题长度15-30字之间
3. 使用小红书热词：必看、绝了、姐妹们、后悔没早、手把手、挖到宝
4. 制造好奇心、紧迫感或情感共鸣
5. 第1个标题要是最推荐的爆款标题
6. 每个标题附上一句话说明"为什么这个标题容易爆"
7. 输出 ONLY valid JSON

输出格式：
{
  "titles": [
    { "title": "📢 标题内容", "reason": "为什么容易爆", "style": "标题技巧（如：数字法/对比法/悬念法）" }
  ]
}`,
  },
  seo: {
    label: 'SEO标题',
    systemPrompt: `你是一个SEO内容策略专家。根据用户提供的主题，生成8个SEO优化标题。

要求：
1. 每个标题必须包含核心关键词
2. 标题长度20-60字之间（百度/Google最佳长度）
3. 标题格式：主关键词 + 修饰词 | 网站名
4. 优先长尾关键词，竞争度低
5. 同时考虑百度和Google排名因素
6. 第1个标题要是SEO效果最佳
7. 每个标题附上一句话说明"为什么这个标题SEO好"
8. 输出 ONLY valid JSON

输出格式：
{
  "titles": [
    { "title": "SEO标题内容", "reason": "SEO效果好的原因", "style": "策略（如：长尾词/前缀词/问答式）" }
  ]
}`,
  },
  marketing: {
    label: '营销标题',
    systemPrompt: `你是一个广告文案和营销专家。根据用户提供的主题，生成8个高转化率的营销标题。

要求：
1. 每个标题要有紧迫感或价值主张
2. 标题长度15-35字之间
3. 使用营销触发词：限时、免费、独家、新、立即、最后机会
4. 强调用户利益（而非功能）
5. 第1个标题要是转化率最高的
6. 每个标题附上一句话说明"为什么这个标题转化率高"
7. 输出 ONLY valid JSON

输出格式：
{
  "titles": [
    { "title": "营销标题内容", "reason": "转化率高的原因", "style": "策略（如：紧迫感/利益驱动/社交证明）" }
  ]
}`,
  },
  video: {
    label: '视频标题',
    systemPrompt: `你是一个短视频/YouTube内容策略专家。根据用户提供的主题，生成8个高点击率的视频标题。

要求：
1. 每个标题要制造好奇心和点击欲望
2. 标题长度10-30字之间
3. 使用视频平台爆款套路：惊人发现、真相揭秘、千万不要XX、保姆级教程
4. 适合YouTube/B站/抖音/视频号等平台
5. 封面感强的标题，一眼抓人
6. 第1个标题要是最佳爆款候选
7. 每个标题附上一句话说明"为什么这个标题吸引点击"
8. 输出 ONLY valid JSON

输出格式：
{
  "titles": [
    { "title": "视频标题内容", "reason": "吸引点击的原因", "style": "策略（如：好奇心/反差/教程/测评）" }
  ]
}`,
  },
  newsletter: {
    label: '邮件标题',
    systemPrompt: `你是一个邮件营销和Newsletter专家。根据用户提供的主题，生成8个高打开率的邮件主题行。

要求：
1. 每个标题要让收件人忍不住打开
2. 标题长度20-50字之间
3. 使用Newsletter常用技巧：数字清单、独家内容、问题式、利益前置
4. 亲和力强，像朋友在分享
5. 避免垃圾邮件触发词：感叹号不要太多、全大写等
6. 第1个标题要是打开率最高的
7. 每个标题附上一句话说明"为什么这个主题行打开率高"
8. 输出 ONLY valid JSON

输出格式：
{
  "titles": [
    { "title": "邮件标题内容", "reason": "打开率高的原因", "style": "策略（如：数字/问题/独家/利益）" }
  ]
}`,
  },
};

export async function POST(request: Request) {
  try {
    const { topic, style = 'blog', model = 'deepseek-chat' } = await request.json();

    if (!topic || topic.trim().length < 2) {
      return Response.json({ error: '请至少输入2个字符的主题' }, { status: 400 });
    }

    if (!DEEPSEEK_API_KEY) {
      return Response.json({ error: 'DEEPSEEK_API_KEY is not configured' }, { status: 500 });
    }

    if (topic.length > 200) {
      return Response.json({ error: '主题太长，最多200个字符' }, { status: 400 });
    }

    const styleConfig = TITLE_STYLES[style] || TITLE_STYLES.blog;
    const userMessage = `请为主题生成标题：\n\n主题：${topic}\n\n标题风格：${styleConfig.label}`;

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
        max_tokens: 2048,
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
    console.error('Error generating titles:', error);
    return Response.json(
      { error: error.message || '生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
