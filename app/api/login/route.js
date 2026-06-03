// app/api/login/route.js
import { findUserByIdentifier, verifyPassword } from '@/models/User.js';
import { createTable } from '@/models/User.js';

export async function POST(request) {
  try {
    await createTable();
    const { identifier, password } = await request.json();
    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 401 });
    }
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return Response.json({ error: 'Incorrect password' }, { status: 401 });
    }
    return Response.json({ message: 'Login successful', user: { id: user.id, identifier: user.identifier, free_usage_today: user.free_usage_today } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Internal server error', debug: error.message }, { status: 500 });
  }
}