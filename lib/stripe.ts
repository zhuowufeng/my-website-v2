/**
 * lib/stripe.ts — Stripe 配置与辅助函数
 *
 * Stripe 产品/价格 ID（需在 Stripe Dashboard 创建后填入 .env）
 *
 * 如何创建：
 * 1. 登录 https://dashboard.stripe.com
 * 2. 产品目录 → 添加产品
 * 3. 创建两个产品：
 *    - "Sinmoniker Pro Monthly" → $9.99/月
 *    - "Sinmoniker Pro Yearly"  → $79.99/年
 * 4. 将生成的 price_xxx ID 填入下方
 */

import Stripe from 'stripe';

function getStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // 开发环境允许空值，调用时会检查
    console.warn('[stripe] STRIPE_SECRET_KEY not set');
    return '';
  }
  return key;
}

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = getStripeKey();
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

/**
 * 获取 Stripe 价格 ID
 * 从 .env 读取，或回退到硬编码 ID（方便开发测试）
 */
export function getPriceId(plan: 'monthly' | 'yearly'): string {
  if (plan === 'yearly') {
    return process.env.STRIPE_PRICE_YEARLY || '';
  }
  return process.env.STRIPE_PRICE_MONTHLY || '';
}

/**
 * 检查 Stripe 是否已配置（密钥和价格 ID 都就绪）
 */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    (process.env.STRIPE_PRICE_MONTHLY || process.env.STRIPE_PRICE_YEARLY)
  );
}

/**
 * 获取配置状态（用于调试/诊断）
 */
export function getStripeConfigStatus(): Record<string, boolean> {
  return {
    secret_key: !!process.env.STRIPE_SECRET_KEY,
    webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
    price_monthly: !!process.env.STRIPE_PRICE_MONTHLY,
    price_yearly: !!process.env.STRIPE_PRICE_YEARLY,
  };
}
