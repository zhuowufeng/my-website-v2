/**
 * /pricing — 定价页面
 * 支持 Pro 月付/年付，展示功能对比
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface SubscriptionStatus {
  subscribed: boolean;
  plan: string;
  expires_at?: string;
  usage: number;
  limit: number;
  user_id?: number;
}

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '永久免费',
    description: '体验基本功能',
    cta: '当前使用',
    ctaColor: 'bg-gray-600',
    features: [
      { ok: true, text: '每日 5 次姓名生成' },
      { ok: true, text: '基础 SEO 诊断' },
      { ok: true, text: '查看历史记录' },
      { ok: false, text: '批量 SEO 分析' },
      { ok: false, text: '定时诊断 & 趋势监控' },
      { ok: false, text: '数据分析仪表盘' },
      { ok: false, text: '优先客服支持' },
    ],
  },
  {
    name: 'Pro Monthly',
    price: '$9.99',
    period: '/月',
    popular: true,
    description: '适合个人站长与内容创作者',
    cta: '升级 Pro',
    ctaColor: 'bg-amber-600 hover:bg-amber-500',
    features: [
      { ok: true, text: '无限姓名生成' },
      { ok: true, text: '无限 SEO 诊断' },
      { ok: true, text: '批量 SEO 分析（最多100页）' },
      { ok: true, text: '定时诊断 & 趋势监控（最多10个URL）' },
      { ok: true, text: 'SEO Analytics 仪表盘' },
      { ok: true, text: 'CSV 导出报告' },
      { ok: false, text: '优先客服支持' },
    ],
  },
  {
    name: 'Pro Yearly',
    price: '$79.99',
    period: '/年',
    description: '省 33% · 适合长期使用',
    cta: '升级年付',
    ctaColor: 'bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400',
    badge: '🔥 最划算',
    features: [
      { ok: true, text: '全部 Pro Monthly 功能' },
      { ok: true, text: '无限 SEO 诊断' },
      { ok: true, text: '批量 SEO 分析（最多500页）' },
      { ok: true, text: '定时诊断 & 趋势监控（最多50个URL）' },
      { ok: true, text: '完整数据分析仪表盘' },
      { ok: true, text: 'CSV/PDF 导出报告' },
      { ok: true, text: '优先客服支持' },
    ],
  },
];

export default function PricingPage() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);
  const [stripeReady, setStripeReady] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  useEffect(() => {
    // Get user_id from cookie
    const cookies = document.cookie.split('; ');
    const userIdCookie = cookies.find(c => c.startsWith('user_id='));
    if (userIdCookie) {
      setUserId(parseInt(userIdCookie.split('=')[1]));
    }

    fetch('/api/subscription/check')
      .then(r => r.json())
      .then(data => {
        setSubscription(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // 检查 URL 参数（Stripe checkout 回调）
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      showMessage('🎉 支付成功！欢迎加入 Pro！', 'success');
      // 刷新订阅状态
      fetch('/api/subscription/check')
        .then(r => r.json())
        .then(data => setSubscription(data));
    } else if (params.get('checkout') === 'cancel') {
      showMessage('支付已取消，随时可以重新升级', 'info');
    } else if (params.get('checkout') === 'error') {
      showMessage('支付遇到问题，请稍后再试', 'error');
    } else if (params.get('stripe_pending') === 'true') {
      setStripeReady(false);
      showMessage('Stripe 支付正在配置中，请稍后再试', 'info');
    }
  }, []);

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleUpgrade = useCallback(async (plan: string) => {
    if (!userId) {
      showMessage('请先登录后再升级', 'info');
      return;
    }

    setUpgrading(true);

    try {
      // 先尝试 Stripe Checkout（真实支付）
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, plan }),
      });

      const data = await res.json();

      if (data.url) {
        // Stripe 已配置 — 跳转到 Stripe Checkout 页面
        window.location.href = data.url;
      } else if (data.fallbackUrl) {
        // Stripe 未配置 — 回退到直接升级（开发/测试模式）
        console.warn('[pricing] Stripe not configured, using direct upgrade fallback');
        const days = plan === 'yearly' ? 365 : 30;
        const fallbackRes = await fetch('/api/subscription/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, plan: 'pro', days }),
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.success) {
          showMessage('🎉 升级成功！(开发模式)', 'success');
          setSubscription(prev => prev ? { ...prev, subscribed: true, plan: 'pro' } : prev);
        } else {
          showMessage(fallbackData.error || '升级失败', 'error');
        }
      } else {
        showMessage(data.error || '升级失败', 'error');
      }
    } catch (err: any) {
      showMessage('网络错误: ' + err.message, 'error');
    } finally {
      setUpgrading(false);
    }
  }, [userId]);

  const handleManageSubscription = useCallback(async () => {
    if (!userId) return;
    setManagingPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showMessage(data.error || '无法打开管理页面', 'error');
      }
    } catch (err: any) {
      showMessage('网络错误: ' + err.message, 'error');
    } finally {
      setManagingPortal(false);
    }
  }, [userId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
      {/* Nav */}
      <nav className="text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/10">
        <Link href="/" className="text-lg font-bold flex items-center gap-2">
          <span className="text-amber-400">Sinmoniker</span>
        </Link>
        <div className="flex items-center gap-4">
          {userId ? (
            <span className="text-sm text-gray-400">
              {subscription?.subscribed ? '⭐ Pro 会员' : '免费用户'}
            </span>
          ) : (
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition">
              登录
            </Link>
          )}
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition">
            ← 返回首页
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            选择适合你的方案
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Free 用户每天有使用次数限制。升级 Pro 解锁全部功能，无限使用。
          </p>
          {subscription?.subscribed && (
            <div className="mt-4 inline-block bg-green-900/50 border border-green-500/30 rounded-full px-6 py-2">
              <span className="text-green-300 font-medium">🌟 你当前是 Pro 会员</span>
              {subscription.expires_at && (
                <span className="text-green-400 text-sm ml-2">
                  有效期至 {new Date(subscription.expires_at).toLocaleDateString('zh-CN')}
                </span>
              )}
            </div>
          )}
          {userId && !subscription?.subscribed && (
            <div className="mt-4 text-sm text-amber-400">
              今日免费剩余: {subscription ? (subscription.limit - subscription.usage) : '...'} 次
            </div>
          )}
        </div>

        {!userId && (
          <div className="mb-8 text-center">
            <div className="bg-blue-900/30 border border-blue-500/20 rounded-lg inline-block px-6 py-3">
              <p className="text-blue-200 text-sm">
                💡 请先 <Link href="/login" className="text-blue-300 underline hover:text-blue-200">登录/注册</Link> 后再升级
              </p>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`mb-6 max-w-md mx-auto px-4 py-3 rounded-lg text-sm text-center ${
            messageType === 'error' ? 'bg-red-900/50 text-red-200 border border-red-500/30' :
            messageType === 'success' ? 'bg-green-900/50 text-green-200 border border-green-500/30' :
            'bg-blue-900/50 text-blue-200 border border-blue-500/30'
          }`}>
            {message}
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`
                relative bg-white/5 backdrop-blur rounded-2xl p-6 border transition-all duration-300
                ${plan.popular ? 'border-amber-500/50 ring-1 ring-amber-500/20 scale-105 md:scale-105' : 'border-white/10 hover:border-white/20'}
              `}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                  {plan.badge}
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.period && <span className="text-gray-400 text-sm ml-1">{plan.period}</span>}
                </div>
                <p className="text-gray-500 text-sm mt-2">{plan.description}</p>
              </div>

              {/* CTA */}
              {(subscription?.subscribed && plan.name !== 'Free') ? (
                <button
                  onClick={handleManageSubscription}
                  disabled={managingPortal}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium mb-6 transition disabled:opacity-50"
                >
                  {managingPortal ? '打开中...' : '🔧 管理订阅'}
                </button>
              ) : plan.name === 'Free' ? (
                <div className="w-full py-3 bg-gray-700/50 text-gray-400 rounded-xl text-sm font-medium mb-6 text-center">
                  当前方案
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.name.toLowerCase().includes('yearly') ? 'yearly' : 'monthly')}
                  disabled={upgrading || !userId}
                  className={`w-full py-3 ${plan.ctaColor} text-white rounded-xl text-sm font-medium mb-6 transition disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {upgrading ? '处理中...' : plan.cta}
                </button>
              )}

              {/* Features */}
              <div className="space-y-3">
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <span className={feat.ok ? 'text-green-400 mt-0.5' : 'text-gray-600 mt-0.5'}>
                      {feat.ok ? '✓' : '✗'}
                    </span>
                    <span className={feat.ok ? 'text-gray-300' : 'text-gray-600'}>{feat.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-white text-center mb-6">常见问题</h2>
          <div className="space-y-4">
            {[
              { q: '升级后能用哪些功能？', a: 'Pro 用户可以使用所有工具：姓名生成、SEO诊断、批量分析、定时诊断、数据看板等，无次数限制。' },
              { q: '可以随时取消吗？', a: '月付/年付均可随时取消。取消后续期不会自动续费，但已付费期间功能不受影响。' },
              { q: '免费版能用多久？', a: '免费版永远可用，只是每天有次数限制（每日重置）。' },
              { q: '支持哪些支付方式？', a: '支持信用卡（Visa/MasterCard/Amex）借记卡等。年付享受 33% 折扣。支付由 Stripe 安全处理。' },
            ].map((faq, idx) => (
              <details key={idx} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden group">
                <summary className="px-5 py-3.5 text-white font-medium cursor-pointer hover:bg-white/[0.02] transition flex items-center justify-between">
                  <span>{faq.q}</span>
                  <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-5 pb-4 text-gray-400 text-sm">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-600 text-xs mt-12 pb-4 border-t border-white/5 pt-6">
          <p>Sinmoniker · 让每个工具都能赚钱</p>
        </div>
      </div>
    </div>
  );
}
