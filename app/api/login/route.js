// app/api/login/route.js — 登录 API (安全加固版)
// 模块8 安全：JWT 令牌 + 限流 + 错误信息过滤

import { findUserByIdentifier, verifyPassword, createTable } from '@/models/User.js';
import { createToken } from '@/lib/auth';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import logger from '@/lib/logger';

export async function POST(request) {
  try {
    // Rate limiting
    const rateCheck = checkAuthRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.resetAt);
    }

    await createTable();
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return Response.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    if (password.length < 6) {
      return Response.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return Response.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return Response.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // Generate JWT token
    const token = await createToken({
      userId: user.id,
      identifier: user.identifier,
      role: user.subscription_type === 'admin' ? 'admin' : 'user',
    });

    logger.info('auth', `User logged in: ${identifier}`, { userId: user.id });

    return Response.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        identifier: user.identifier,
        free_usage_today: user.free_usage_today,
        subscription_type: user.subscription_type,
      },
    });
  } catch (error) {
    logger.error('auth', 'Login error', error);
    return Response.json({ error: '服务器内部错误，请稍后重试' }, { status: 500 });
  }
}
