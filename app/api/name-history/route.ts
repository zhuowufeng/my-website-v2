// app/api/name-history/route.ts
import { createTable, getHistory } from '@/models/NameHistory';
import { createTable as createUsersTable } from '@/models/User';

export async function GET(request: Request) {
  try {
    // Ensure tables exist
    await createUsersTable();
    await createTable();

    // Get userId from query params
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    const history = await getHistory(parseInt(userId, 10), limit);

    return Response.json({ history });
  } catch (error: any) {
    console.error('Error fetching history:', error);
    return Response.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
