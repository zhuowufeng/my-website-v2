/**
 * /api/subscription/upgrade — 手动升级订阅（webhook也可调用）
 *
 * 用于：
 * 1. 测试/开发时直接手动升级
 * 2. Gumroad/Stripe webhook 回调
 *
 * POST body: { user_id: number, plan: 'pro' | 'monthly' | 'yearly' }
 */

import { createTable, findUserById } from '@/models/User';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    await createTable();

    const body = await request.json();
    const { user_id, plan = 'pro', days = 30 } = body;

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 });
    }

    const user = await findUserById(user_id);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate new expiry
    const now = new Date();
    const currentExpiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : now;
    // If already subscribed, extend; otherwise start from now
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    const sql = `
      UPDATE users
      SET subscription_type = $1,
          subscription_expires_at = $2
      WHERE id = $3
      RETURNING id, subscription_type, subscription_expires_at;
    `;
    const result = await query(sql, [plan, newExpiry.toISOString(), user_id]);
    const updated = result.rows[0];

    console.log(`[subscription/upgrade] User ${user_id} upgraded to ${plan}, expires ${updated.subscription_expires_at}`);

    return Response.json({
      success: true,
      user_id: updated.id,
      plan: updated.subscription_type,
      expires_at: updated.subscription_expires_at,
    });
  } catch (err: any) {
    console.error('[subscription/upgrade] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
