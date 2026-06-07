// 用户反馈收集 API
// 产品思维：用户是最好的老师 - 每条反馈都是迭代的起点
import { NextRequest, NextResponse } from 'next/server';

// 简单的内存存储（生产环境应换数据库）
const feedbacks: FeedbackEntry[] = [];

interface FeedbackEntry {
  id: number;
  type: string;
  message: string;
  email?: string;
  page: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, message, email, page, timestamp } = body;

    if (!message || !type) {
      return NextResponse.json(
        { error: 'message and type are required' },
        { status: 400 }
      );
    }

    const entry: FeedbackEntry = {
      id: Date.now(),
      type,
      message,
      email: email || undefined,
      page: page || '/',
      timestamp: timestamp || new Date().toISOString(),
    };

    feedbacks.push(entry);

    // 打印到日志（方便开发时查看）
    console.log(`[Feedback] ${type}: ${message.substring(0, 100)}${email ? ` (${email})` : ''}`);

    return NextResponse.json({ success: true, id: entry.id });
  } catch (error) {
    console.error('[Feedback] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // 获取反馈统计数据（仅限内部使用，生产环境需加鉴权）
  const counts = feedbacks.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    total: feedbacks.length,
    counts,
    recent: feedbacks.slice(-10).reverse(),
  });
}
