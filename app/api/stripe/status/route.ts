/**
 * GET /api/stripe/status
 *
 * 检查 Stripe 配置状态（诊断用）
 */
import { getStripeConfigStatus } from '@/lib/stripe';

export async function GET() {
  const status = getStripeConfigStatus();

  // 检查 Stripe API 连接（如果有密钥）
  let apiStatus = 'untested';
  if (status.secret_key) {
    try {
      const stripe = (await import('@/lib/stripe')).getStripe();
      await stripe.balance.retrieve();
      apiStatus = 'ok';
    } catch (err: any) {
      apiStatus = `error: ${err.message}`;
    }
  }

  const allConfigured = status.secret_key && status.price_monthly && status.price_yearly;

  return Response.json({
    configured: allConfigured,
    status,
    apiStatus,
    message: allConfigured
      ? 'Stripe 已完整配置，可以接收支付'
      : 'Stripe 尚未完整配置。需要设置 STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY',
  });
}
