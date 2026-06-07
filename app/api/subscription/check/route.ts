/**
 * /api/subscription/check — 订阅状态查询
 * GET: 查询用户的订阅状态和剩余免费次数
 */

import { createTable, findUserById } from '@/models/User';

export async function GET(request: Request) {
  try {
    await createTable();

    const cookies = request.headers.get('cookie') || '';
    const match = cookies.match(/user_id=([^;]+)/);
    if (!match) {
      return Response.json({ subscribed: false, usage: 0, limit: 5, plan: 'free' });
    }

    const userId = parseInt(match[1]);
    if (isNaN(userId)) {
      return Response.json({ subscribed: false, usage: 0, limit: 5, plan: 'free' });
    }

    const user = await findUserById(userId);
    if (!user) {
      return Response.json({ subscribed: false, usage: 0, limit: 5, plan: 'free' });
    }

    const now = new Date();
    const isSubscribed =
      user.subscription_type === 'pro' &&
      user.subscription_expires_at &&
      new Date(user.subscription_expires_at) > now;

    // Free user limits per feature
    const limits: Record<string, number> = {
      name_generation: 5,
      seo_analysis: 5,
      batch_analysis: 2,
      scheduler: 3,
      article_gen: 3,
      dashboard: 10,
    };

    return Response.json({
      subscribed: !!isSubscribed,
      plan: isSubscribed ? 'pro' : 'free',
      usage: user.free_usage_today || 0,
      limit: isSubscribed ? 999 : limits.name_generation,
      expires_at: user.subscription_expires_at,
      user_id: userId,
    });
  } catch (err: any) {
    console.error('[subscription/check] error:', err);
    return Response.json(
      { subscribed: false, usage: 0, limit: 5, plan: 'free', error: err.message },
      { status: 500 }
    );
  }
}
