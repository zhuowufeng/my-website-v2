/**
 * POST /api/stripe/portal
 *
 * 创建 Stripe Customer Portal 会话
 * 用户可通过 Portal 管理订阅、查看发票、更新支付方式、取消续费等
 *
 * Body: { user_id: number }
 * 成功返回: { url: string }
 */
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { query } from '@/lib/db';
import { findUserById } from '@/models/User';

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      return Response.json(
        { error: 'Stripe 未配置' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 });
    }

    const user = await findUserById(user_id);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // 查找用户的 Stripe Customer ID
    // 需要先从 Stripe 查找已有的 customer
    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sinmoniker.com';

    // 通过用户的 email 或 metadata 查找 Stripe Customer
    const customers = await stripe.customers.search({
      query: `metadata['user_id']:'${user_id}'`,
      limit: 1,
    });

    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      // 未找到 customer — 可能还在测试模式
      return Response.json(
        { error: 'Stripe 客户记录未找到。请先完成一次支付。' },
        { status: 404 }
      );
    }

    // 创建 Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/pricing`,
    });

    return Response.json({ url: session.url });
  } catch (err: any) {
    console.error('[stripe/portal] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
