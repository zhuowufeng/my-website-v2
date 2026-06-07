// 用户反馈收集 API（安全加固版）
// 模块8 安全：限流 + 输入校验 + XSS 过滤
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import logger from '@/lib/logger';

// 简单的内存存储
const feedbacks: FeedbackEntry[] = [];
const MAX_FEEDBACKS = 10000;

interface FeedbackEntry {
  id: number;
  type: string;
  message: string;
  email?: string;
  page: string;
  timestamp: string;
}

const ALLOWED_TYPES = ['喜欢', '想要功能', '遇到问题', '不好用', '其他'];

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rateCheck = checkRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.resetAt);
    }

    const body = await request.json();
    const { type, message, email, page, timestamp } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '请输入反馈内容' }, { status: 400 });
    }

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: '请选择有效的反馈类型' }, { status: 400 });
    }

    const sanitizedMessage = message
      .replace(/[<>]/g, '')  // 移除 HTML 标签
      .trim()
      .substring(0, 2000);   // 限制长度

    if (!sanitizedMessage) {
      return NextResponse.json({ error: '反馈内容不能为空' }, { status: 400 });
    }

    // 邮箱验证
    let sanitizedEmail: string | undefined;
    if (email) {
      sanitizedEmail = email.trim().substring(0, 200);
      if (sanitizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
        sanitizedEmail = undefined; // Invalid email, silently ignore
      }
    }

    const entry: FeedbackEntry = {
      id: Date.now(),
      type,
      message: sanitizedMessage,
      email: sanitizedEmail,
      page: (page || '/').substring(0, 200),
      timestamp: timestamp || new Date().toISOString(),
    };

    feedbacks.push(entry);
    if (feedbacks.length > MAX_FEEDBACKS) {
      feedbacks.splice(0, feedbacks.length - MAX_FEEDBACKS);
    }

    logger.info('feedback', `New feedback: ${type}`, {
      message: sanitizedMessage.substring(0, 50),
      hasEmail: !!sanitizedEmail,
    });

    return NextResponse.json({ success: true, id: entry.id });
  } catch (error) {
    logger.error('feedback', 'Error saving feedback', error instanceof Error ? error : String(error));
    return NextResponse.json({ error: '提交失败，请稍后重试' }, { status: 500 });
  }
}

export async function GET() {
  // 反馈统计（简单处理，后续可加鉴权）
  const counts = feedbacks.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    total: feedbacks.length,
    counts,
    recent: feedbacks.slice(-10).reverse().map(f => ({
      id: f.id,
      type: f.type,
      message: f.message.substring(0, 100),
      page: f.page,
      timestamp: f.timestamp,
    })),
  });
}
