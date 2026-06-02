// app/api/register/route.js
import { createTable, createUser, findUserByEmail } from '@/models/User.js';

export async function POST(request) {
  try {
    await createTable();
    const { email, password } = await request.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return Response.json({ error: 'Email already registered' }, { status: 409 });
    }
    const newUser = await createUser(email, password);
    return Response.json({ message: 'Registration successful', user: { id: newUser.id, email: newUser.email } }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}