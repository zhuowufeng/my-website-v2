// app/api/register/route.js
import { createTable, createUser, findUserByIdentifier } from '@/models/User.js';
import { getAvailableDbEnvVars } from '@/lib/db.js';

export async function POST(request) {
  try {
    await createTable();
    const { identifier, password } = await request.json();
    if (!identifier || !password) {
      return Response.json({ error: 'Identifier and password are required' }, { status: 400 });
    }
    const existing = await findUserByIdentifier(identifier);
    if (existing) {
      return Response.json({ error: 'Account already registered' }, { status: 409 });
    }
    const newUser = await createUser(identifier, password);
    return Response.json({ message: 'Registration successful', user: { id: newUser.id, identifier: newUser.identifier } }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ 
      error: 'Internal server error', 
      debug: error.message,
      envVars: getAvailableDbEnvVars(),
    }, { status: 500 });
  }
}