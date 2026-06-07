/**
 * /api/generate-name — 生成中文名
 * 
 * 变现阶段：
 * - 免费用户：每天 5 次
 * - Pro 用户：无限
 */

import { generateChineseNames } from '@/lib/deepseek';
import { sanitizeInput, sanitizeOutput } from '@/lib/sanitize';
import { createTable as createNameHistoryTable, addRecord } from '@/models/NameHistory';
import { createTable as createUsersTable, getUsageCount, incrementFreeUsage, findUserById } from '@/models/User';

const FREE_DAILY_LIMIT = 5;

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

    // Check subscription status
    const user = await findUserById(userId);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const isSubscribed =
      user.subscription_type === 'pro' &&
      user.subscription_expires_at &&
      new Date(user.subscription_expires_at) > now;

    if (!isSubscribed) {
      // Free user: enforce daily limit
      const usageCount = await getUsageCount(userId);
      if (usageCount >= FREE_DAILY_LIMIT) {
        return Response.json({
          error: `Daily limit reached (${FREE_DAILY_LIMIT} generations). Upgrade to Pro for unlimited access!`,
          limit_reached: true,
          limit: FREE_DAILY_LIMIT,
          usage: usageCount,
        }, { status: 429 });
      }
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
      subscribed: isSubscribed,
      remaining: isSubscribed ? -1 : FREE_DAILY_LIMIT - (user.free_usage_today || 0),
    };

    // Only count usage for free users
    if (!isSubscribed) {
      await incrementFreeUsage(userId);
    }

    return Response.json(safeResult);
  } catch (error: any) {
    console.error('Error generating name:', error);
    return Response.json(
      { error: error.message || 'Failed to generate name. Please try again.' },
      { status: 500 }
    );
  }
}
