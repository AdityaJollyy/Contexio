import { User } from '../models/user.model.js';
import { env } from '../config/env.js';

const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Claims one unit of today's AI quota. The `aiUsageCount: { $lt: limit }` is in
 * the filter, not a preceding read: that is what stops two concurrent requests
 * at 9/10 from both succeeding.
 */
export const consumeAiQuota = async (
  userId: string
): Promise<{ allowed: boolean; used: number; limit: number }> => {
  const date = today();
  const limit = env.AI_CHAT_DAILY_LIMIT;

  await User.updateOne(
    { _id: userId, aiUsageDate: { $ne: date } },
    { $set: { aiUsageDate: date, aiUsageCount: 0 } }
  );

  const user = await User.findOneAndUpdate(
    { _id: userId, aiUsageDate: date, aiUsageCount: { $lt: limit } },
    { $inc: { aiUsageCount: 1 } },
    { new: true }
  );

  if (!user) return { allowed: false, used: limit, limit };
  return { allowed: true, used: user.aiUsageCount, limit };
};

/** A failed or empty search is not charged. */
export const refundAiQuota = async (userId: string): Promise<void> => {
  await User.updateOne(
    { _id: userId, aiUsageDate: today(), aiUsageCount: { $gt: 0 } },
    { $inc: { aiUsageCount: -1 } }
  );
};

export const getAiQuota = async (userId: string): Promise<{ used: number; limit: number }> => {
  const limit = env.AI_CHAT_DAILY_LIMIT;
  const user = await User.findById(userId).select('aiUsageDate aiUsageCount').lean();

  // A stale stored day means today's count is zero; it resets on first use.
  if (!user || user.aiUsageDate !== today()) return { used: 0, limit };
  return { used: user.aiUsageCount, limit };
};
