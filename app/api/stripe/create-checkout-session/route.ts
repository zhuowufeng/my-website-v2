/**
 * POST /api/stripe/create-checkout-session
 *
 * 创建 Stripe Checkout 会话，用户完成支付后跳转到成功/取消页
 *
 * Body: { plan: 'monthly' | 'yearly', user_id: number }
 *
 * 成功返回: { sessionId, url } — 前端应跳转到 url
 */
import { getStripe, getPriceId, isStripeConfigured } from '@/lib/stripe';
import { findUserById } from '@/models/User';

export async function POST(request: Request) {
  try {
    // 1. 检查 Stripe 配置
    if (!isStripeConfigured()) {
      return Response.json(
        {
          error: '支付系统尚未配置。请联系管理员设置 Stripe。',
          fallbackUrl: '/pricing?stripe_pending=true',
        },
        { status: 503 }
      );
    }

    // 2. 解析请求
    const body = await request.json();
    const { plan, user_id, success_url, cancel_url } = body;

    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return Response.json({ error: 'plan must be "monthly" or "yearly"' }, { status: 400 });
    }

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 });
    }

    // 3. 验证用户存在
    const user = await findUserById(user_id);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // 4. 获取价格 ID
    const priceId = getPriceId(plan);
    if (!priceId) {
      return Response.json(
        {
          error: `Stripe 价格未配置 (${plan})。请先在 Stripe Dashboard 创建产品。`,
          fallbackUrl: '/pricing?stripe_pending=true',
        },
        { status: 503 }
      );
    }

    // 5. 获取基础 URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sinmoniker.com';

    // 6. 创建 Checkout Session
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: String(user_id), // 用于 webhook 中识别用户
      metadata: {
        user_id: String(user_id),
        plan: `pro_${plan}`,
      },
      subscription_data: {
        metadata: {
          user_id: String(user_id),
          plan: `pro_${plan}`,
        },
      },
      success_url: success_url || `${baseUrl}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${baseUrl}/pricing?checkout=cancel`,
    });

    console.log(`[stripe] Checkout session created: ${session.id} for user ${user_id}, plan=${plan}`);

    return Response.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (err: any) {
    console.error('[stripe/create-checkout-session] error:', err);
    return Response.json(
      { error: err.message || '创建支付会话失败', fallbackUrl: '/pricing?checkout=error' },
      { status: 500 }
    );
  }
}
