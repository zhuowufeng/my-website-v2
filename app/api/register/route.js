// app/api/register/route.js
import { createTable, createUser, findUserByEmail } from '@/models/User.js';

export async function POST(request) {
  try {
    await createTable();
    const { email, password } = await request.json();
    if (!email || !password) {
      return Response.json({ error: '邮箱和密码不能为空' }, { status: 400 });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return Response.json({ error: '邮箱已被注册' }, { status: 409 });
    }
    const newUser = await createUser(email, password);
    return Response.json({ message: '注册成功', user: { id: newUser.id, email: newUser.email } }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}