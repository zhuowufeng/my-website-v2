// app/api/register/route.js — 注册 API (安全加固版)
// 模块8 安全：限流 + 输入校验 + 错误信息过滤

import { createTable, createUser, findUserByIdentifier } from '@/models/User.js';
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

    // Input validation
    if (!identifier || !password) {
      return Response.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    if (typeof identifier !== 'string' || typeof password !== 'string') {
      return Response.json({ error: '输入格式错误' }, { status: 400 });
    }

    const trimmedIdentifier = identifier.trim().toLowerCase();
    if (trimmedIdentifier.length < 2 || trimmedIdentifier.length > 50) {
      return Response.json({ error: '用户名长度应为2-50个字符' }, { status: 400 });
    }

    // 用户名只允许字母、数字、下划线、邮箱格式
    if (!/^[a-zA-Z0-9_@.+-]+$/.test(trimmedIdentifier)) {
      return Response.json({ error: '用户名只能包含字母、数字、下划线' }, { status: 400 });
    }

    if (password.length < 6 || password.length > 100) {
      return Response.json({ error: '密码长度应为6-100个字符' }, { status: 400 });
    }

    const existing = await findUserByIdentifier(trimmedIdentifier);
    if (existing) {
      return Response.json({ error: '该用户名已被注册' }, { status: 409 });
    }

    const newUser = await createUser(trimmedIdentifier, password);

    // Auto-login: generate token
    const token = await createToken({
      userId: newUser.id,
      identifier: trimmedIdentifier,
      role: 'user',
    });

    logger.info('auth', `New user registered: ${trimmedIdentifier}`, { userId: newUser.id });

    return Response.json({
      message: '注册成功',
      token,
      user: {
        id: newUser.id,
        identifier: newUser.identifier,
        free_usage_today: 0,
        subscription_type: 'free',
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('auth', 'Registration error', error);
    return Response.json({ error: '服务器内部错误，请稍后重试' }, { status: 500 });
  }
}
