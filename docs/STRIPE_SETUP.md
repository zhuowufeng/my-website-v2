# Stripe 支付接入配置指南

## 📋 前置要求

1. 一个 Stripe 账户（https://dashboard.stripe.com/register）
2. 网站已部署到生产环境（如 sinmoniker.com）

## 🚀 配置步骤

### 第一步：获取 Stripe API 密钥

1. 登录 [Stripe Dashboard](https://dashboard.stripe.com/)
2. 左侧菜单 → **开发者** → **API 密钥**
3. 复制 **密钥 (Secret key)**：`sk_live_xxxxxxxxxxxxxx`
4. 复制 **可发布密钥 (Publishable key)**：`pk_live_xxxxxxxxxxxxxx`

### 第二步：在 Stripe 创建产品

1. 左侧菜单 → **产品目录** → **添加产品**
2. 创建两个产品：

| 产品名 | 价格 | 计费周期 | 说明 |
|--------|------|---------|------|
| Sinmoniker Pro Monthly | $9.99 | 每月 | 月付套餐 |
| Sinmoniker Pro Yearly | $79.99 | 每年 | 年付套餐（省 33%） |

3. 创建后，每个产品会得到一个 `price_xxxxxxxxxxxxxx` ID
4. 复制这两个 Price ID

### 第三步：配置 Webhook

1. 左侧菜单 → **开发者** → **Webhooks** → **添加端点**
2. **端点 URL**：`https://sinmoniker.com/api/stripe/webhook`
3. **监听事件**（建议全选以下）：
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
4. 创建后，复制 **签名密钥 (Signing secret)**：`whsec_xxxxxxxxxxxxxx`

### 第四步：设置环境变量

在 Zeabur Dashboard 中设置以下环境变量：

| 变量名 | 值 | 来源 |
|--------|-----|------|
| `STRIPE_SECRET_KEY` | `sk_live_xxxxxxxxxxxxxx` | Stripe API 密钥 |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_xxxxxxxxxxxxxx` | Stripe API 密钥 |
| `STRIPE_PRICE_MONTHLY` | `price_xxxx_monthly` | Stripe 产品目录 |
| `STRIPE_PRICE_YEARLY` | `price_xxxx_yearly` | Stripe 产品目录 |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxxxxxxxxxxxxx` | Stripe Webhook 设置 |

### 第五步：验证配置

访问 `https://sinmoniker.com/api/stripe/status`

如果返回 `{"configured": true}`，说明配置完成。

### 第六步：测试支付流程

不建议在生产环境直接测试真实信用卡。建议先在 Stripe 的 **测试模式** 下测试：

1. 在 Stripe Dashboard 切换到 **测试模式**（右上角开关）
2. 获取测试版密钥 (`sk_test_xxxx`)
3. 设置测试环境变量
4. 用测试卡号 `4242 4242 4242 4242` 支付

测试通过后再切换到生产模式。

---

## 🔧 维护操作

### 查看用户订阅状态

访问 `/api/stripe/status`

### 为用户手动激活 Pro

```bash
POST /api/subscription/upgrade
{
  "user_id": 123,
  "plan": "pro",
  "days": 30
}
```

### 处理支付失败

Stripe 会自动重试失败的付款（最多 3 次）。如果 3 次都失败，订阅会自动取消。

## 🧪 开发模式

如果 Stripe 未配置，`/pricing` 页面会自动回退到直接升级模式（不经过真实支付），方便在本地开发时测试功能。

## 🗺️ 架构图

```
用户点击"升级 Pro"
       ↓
  创建 Stripe Checkout Session
       ↓
  跳转到 Stripe 支付页面
       ↓
用户输入信用卡信息并支付
       ↓
  Stripe 回调 Webhook
       ↓
  激活 Pro 订阅
       ↓
  用户看到 Pro 已激活
```
