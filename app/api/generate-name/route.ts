// app/api/generate-name/route.ts
import { generateChineseNames } from '@/lib/deepseek';
import { sanitizeInput, sanitizeOutput } from '@/lib/sanitize';
import { createTable as createNameHistoryTable, addRecord } from '@/models/NameHistory';
import { createTable as createUsersTable, getUsageCount, incrementFreeUsage } from '@/models/User';

export async function POST(request: Request) {
  try {
    // Ensure tables exist
    await createUsersTable();
    await createNameHistoryTable();

    // Parse request body
    const body = await request.json();
    const { englishName, gender = 'any', userId } = body;

    // Validate userId
    if (!userId) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Sanitize and validate input
    const sanitizedName = sanitizeInput(englishName || '');
    if (!sanitizedName) {
      return Response.json({ error: 'Please enter a valid English name' }, { status: 400 });
    }

    // Check usage limit
    const usageCount = await getUsageCount(userId);
    if (usageCount >= 50) {
      return Response.json({ error: 'Daily limit reached (50 generations). Come back tomorrow!' }, { status: 429 });
    }

    // Generate names
    const result = await generateChineseNames(sanitizedName, gender);

    // Sanitize the output
    const safeResult = {
      names: result.names.map((name) => ({
        chineseName: sanitizeOutput(name.chineseName),
        nickname: sanitizeOutput(name.nickname),
        meaningCn: sanitizeOutput(name.meaningCn),
        meaningEn: sanitizeOutput(name.meaningEn),
        pinyin: sanitizeOutput(name.pinyin),
      })),
    };

    // Save to history
    await addRecord(userId, sanitizedName, gender, safeResult.names);

    // Increment usage count
    await incrementFreeUsage(userId);

    return Response.json(safeResult);
  } catch (error: any) {
    console.error('Error generating name:', error);
    return Response.json(
      { error: error.message || 'Failed to generate name. Please try again.' },
      { status: 500 }
    );
  }
}
