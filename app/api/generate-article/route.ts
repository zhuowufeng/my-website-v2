// app/api/generate-article/route.ts
// AI文章助手 — Streaming API Route (安全加固版)
// 模块8 安全：限流 + API Key 安全 + 输入校验

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

import { checkGenerateRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import logger from '@/lib/logger';

const ARTICLE_TYPES: Record<string, { label: string; systemPrompt: string }> = {
  blog: {
    label: '博客文章',
    systemPrompt: `You are a professional blog content writer. Write engaging, well-structured blog articles in Chinese that readers will love.

Requirements:
1. Start with a catchy title (under 60 chars)
2. Write a brief summary (100-150 chars)
3. Divide the body into 3-5 sections with H2 subheadings
4. Each section should be 80-200 characters
5. End with a conclusion or call-to-action
6. Write naturally, like a human blogger, not like AI
7. Use examples and relatable language
8. Output ONLY valid JSON, no markdown formatting

Response format:
{
  "title": "Main title",
  "alternateTitles": ["Title option 1", "Title option 2"],
  "summary": "Brief summary...",
  "sections": [
    { "heading": "Section title", "content": "Section content..." }
  ],
  "conclusion": "Wrap-up paragraph..."
}`,
  },
  social: {
    label: '社交媒体/小红书',
    systemPrompt: `You are a social media content creator specializing in Xiaohongshu-style posts. Write engaging, trendy, and visually appealing posts in Chinese.

Requirements:
1. Write an eye-catching title with emojis
2. Opening hook line (grab attention)
3. 3-5 bullet points or short paragraphs (each under 100 chars)
4. Use emojis naturally throughout
5. End with hashtags (3-5 relevant tags)
6. Tone: friendly, excited, personal
7. Output ONLY valid JSON

Response format:
{
  "title": "Title with emoji",
  "hook": "Opening attention-grabber",
  "points": ["Point 1...", "Point 2..."],
  "conclusion": "Final thoughts...",
  "hashtags": ["#tag1", "#tag2"]
}`,
  },
  seo: {
    label: 'SEO优化文章',
    systemPrompt: `You are an SEO content specialist. Write search-engine-optimized articles in Chinese that rank well on Google/Baidu while still being readable.

Requirements:
1. Title must include primary keyword (under 60 chars)
2. Meta description (150-160 chars) naturally includes keywords
3. H2 subheadings should include secondary keywords
4. Each section 100-200 characters
5. Natural keyword density (don't over-optimize)
6. Include internal linking suggestions
7. Output ONLY valid JSON

Response format:
{
  "title": "SEO-optimized title",
  "metaDescription": "Meta description for search engines",
  "keywords": ["primary keyword", "secondary keyword"],
  "sections": [
    { "heading": "H2 with keyword", "content": "Section content..." }
  ],
  "conclusion": "Summary with CTA"
}`,
  },
  product: {
    label: '产品介绍',
    systemPrompt: `You are a product copywriter. Write compelling product descriptions in Chinese that convert readers into customers.

Requirements:
1. Catchy product name/title
2. USP (Unique Selling Proposition) - what makes it special
3. Features breakdown (3-5 points)
4. Benefits (how it solves user problems)
5. Social proof / use cases
6. Call-to-action
7. Output ONLY valid JSON

Response format:
{
  "title": "Product title",
  "tagline": "One-line USP",
  "features": [
    { "name": "Feature name", "description": "What it does" }
  ],
  "benefits": ["Benefit 1...", "Benefit 2..."],
  "useCases": ["Use case 1...", "Use case 2..."],
  "cta": "Call-to-action text"
}`,
  },
};

export async function POST(request: Request) {
  const startTime = Date.now();
  const requestId = generateSimpleRequestId();

  try {
    // ============ Rate Limiting ============
    const rateCheck = checkGenerateRateLimit(request);
    if (!rateCheck.allowed) {
      logger.warn('generate', `Rate limit hit [${requestId}]`, {
        remaining: rateCheck.remaining,
      });
      return rateLimitResponse(rateCheck.resetAt);
    }

    // ============ Validate API Key ============
    if (!DEEPSEEK_API_KEY) {
      logger.error('generate', 'DEEPSEEK_API_KEY not configured');
      return Response.json({ error: 'AI服务未配置，请联系管理员' }, { status: 500 });
    }

    // ============ Parse & Validate Input ============
    const body = await request.json();
    const { topic, articleType = 'blog', model = 'deepseek-chat' } = body;

    if (!topic || typeof topic !== 'string') {
      return Response.json({ error: '请输入文章主题' }, { status: 400 });
    }

    const trimmedTopic = topic.trim();
    if (trimmedTopic.length < 2) {
      return Response.json({ error: '请至少输入2个字符的主题' }, { status: 400 });
    }

    if (trimmedTopic.length > 500) {
      return Response.json({ error: '主题太长，最多500个字符' }, { status: 400 });
    }

    if (!ARTICLE_TYPES[articleType]) {
      return Response.json({ error: '无效的文章类型' }, { status: 400 });
    }

    const typeConfig = ARTICLE_TYPES[articleType];
    const userMessage = `请围绕这个主题写一篇文章:\n\n主题：${trimmedTopic}\n\n文章类型：${typeConfig.label}`;

    // ============ Call DeepSeek API ============
    const deepseekResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: typeConfig.systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      logger.error('generate', `DeepSeek API error [${requestId}]`, undefined, {
        status: deepseekResponse.status,
        error: errorText.substring(0, 200),
      });
      return Response.json(
        { error: 'AI服务暂时不可用，请稍后重试' },
        { status: 502 }
      );
    }

    // ============ Stream Response ============
    const stream = new ReadableStream({
      async start(controller) {
        let tokenCount = 0;
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
                  tokenCount += content.length;
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

          const duration = Date.now() - startTime;
          logger.info('generate', `Generated article [${requestId}]`, {
            topic: trimmedTopic.substring(0, 50),
            type: articleType,
            chars: tokenCount,
            duration: `${duration}ms`,
          });
        } catch (err) {
          logger.error('generate', `Stream error [${requestId}]`, err instanceof Error ? err : String(err));
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
        'X-Request-ID': requestId,
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('generate', `Unhandled error [${requestId}]`, error, { duration });
    return Response.json(
      { error: '生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}

function generateSimpleRequestId(): string {
  return `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
