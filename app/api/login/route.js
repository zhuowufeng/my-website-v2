// app/api/login/route.js
import { findUserByEmail, verifyPassword } from '@/models/User.js';
import { createTable } from '@/models/User.js';

export async function POST(request) {
  try {
    await createTable();
    const { email, password } = await request.json();
    const user = await findUserByEmail(email);
    if (!user) {
      return Response.json({ error: '用户不存在' }, { status: 401 });
    }
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return Response.json({ error: '密码错误' }, { status: 401 });
    }
    return Response.json({ message: '登录成功', user: { id: user.id, email: user.email, free_usage_today: user.free_usage_today } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}