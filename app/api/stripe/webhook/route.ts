/**
 * POST /api/stripe/webhook
 *
 * Stripe Webhook 处理器
 *
 * 处理事件：
 * - checkout.session.completed — 用户完成结账（订阅创建成功）
 * - customer.subscription.updated — 订阅更新（续期/降级等）
 * - customer.subscription.deleted — 订阅取消/过期
 *
 * 需在 Stripe Dashboard 配置 Webhook 端点指向此 URL：
 * https://sinmoniker.com/api/stripe/webhook
 */
import { getStripe } from '@/lib/stripe';
import { query } from '@/lib/db';

// Stripe 需要原始请求体（buffer）计算签名
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured');
    return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 读取原始请求体（Stripe 需要原始字节来验证签名）
    const buf = await request.arrayBuffer();
    const body = Buffer.from(buf).toString('utf8');
    const sig = request.headers.get('stripe-signature') || '';

    const stripe = getStripe();
    let event: any;

    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error('[stripe/webhook] Signature verification failed:', err.message);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[stripe/webhook] Received event: ${event.type} (id=${event.id})`);

    // 处理不同事件
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        // 续期成功 — 自动延长有效期
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      default:
        console.log(`[stripe/webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[stripe/webhook] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 处理结账完成事件 — 激活/延长 Pro 订阅
 */
async function handleCheckoutCompleted(session: any) {
  const userId = parseInt(session.metadata?.user_id || session.client_reference_id || '0');
  if (!userId) {
    console.error('[stripe/webhook] No user_id in checkout session metadata');
    return;
  }

  const plan = session.metadata?.plan || 'pro_monthly';
  const days = plan.includes('yearly') ? 365 : 30;
  const stripeSubscriptionId = session.subscription;

  // 激活用户订阅
  await activateSubscription(userId, days, 'pro', stripeSubscriptionId);
  console.log(`[stripe/webhook] User ${userId} activated (${plan}, ${days} days)`);
}

/**
 * 处理订阅更新（如续期、升级降级）
 */
async function handleSubscriptionUpdated(subscription: any) {
  const metadata = subscription.metadata || {};
  const userId = parseInt(metadata.user_id || '0');
  if (!userId) return;

  const status = subscription.status; // active, past_due, canceled, etc.
  if (status === 'active') {
    const periodEnd = (subscription as any).current_period_end;
    const currentPeriodEnd = new Date(periodEnd * 1000);
    await query(
      `UPDATE users SET subscription_type = 'pro', subscription_expires_at = $2 WHERE id = $1`,
      [userId, currentPeriodEnd.toISOString()]
    );
    console.log(`[stripe/webhook] Subscription updated for user ${userId}, expires ${currentPeriodEnd.toISOString()}`);
  }
}

/**
 * 处理订阅删除/取消
 */
async function handleSubscriptionDeleted(subscription: any) {
  const metadata = subscription.metadata || {};
  const userId = parseInt(metadata.user_id || '0');
  if (!userId) {
    // 尝试从 subscription items 中获取信息
    console.log(`[stripe/webhook] Subscription deleted: ${subscription.id}`);
    return;
  }

  // 不立即降级，让用户使用到有效期结束
  console.log(`[stripe/webhook] Subscription cancelled for user ${userId}, will expire at period end`);
}

/**
 * 处理发票支付成功（续期）
 */
async function handleInvoicePaymentSucceeded(invoice: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const stripe = getStripe();
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const metadata = subscription.metadata || {};
    const userId = parseInt(metadata.user_id || '0');
    if (!userId) return;

    const periodEnd = (subscription as any).current_period_end;
    const currentPeriodEnd = new Date(periodEnd * 1000);
    await query(
      `UPDATE users SET subscription_type = 'pro', subscription_expires_at = $2 WHERE id = $1`,
      [userId, currentPeriodEnd.toISOString()]
    );
    console.log(`[stripe/webhook] Renewal for user ${userId}: expires ${currentPeriodEnd.toISOString()}`);
  } catch (err) {
    console.error(`[stripe/webhook] Failed to handle invoice payment for subscription ${subscriptionId}:`, err);
  }
}

/**
 * 核心函数：激活用户 Pro 订阅，延长有效期
 */
async function activateSubscription(
  userId: number,
  days: number,
  plan: string,
  stripeSubscriptionId?: string | null
) {
  const now = new Date();
  const user = await query('SELECT subscription_expires_at FROM users WHERE id = $1', [userId]);
  const currentExpiry = user.rows[0]?.subscription_expires_at
    ? new Date(user.rows[0].subscription_expires_at)
    : now;

  // 如果已有订阅则延长，否则从当前时间开始
  const baseDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  await query(
    `UPDATE users
     SET subscription_type = $2,
         subscription_expires_at = $3
     WHERE id = $1`,
    [userId, plan, newExpiry.toISOString()]
  );

  // 如果传入了 Stripe 订阅 ID，保存它（方便后续查询）
  if (stripeSubscriptionId) {
    // 尝试在 users 表存 stripe_subscription_id（如果列不存在就忽略）
    try {
      await query(
        `UPDATE users SET stripe_subscription_id = $2 WHERE id = $1`,
        [userId, stripeSubscriptionId]
      );
    } catch (_) {
      // 列不存在，跳过
    }
  }
}
