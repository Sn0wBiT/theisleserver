import { z } from "zod";

export const questPeriodSchema = z.enum(["daily", "weekly", "monthly"]);
export type QuestPeriod = z.infer<typeof questPeriodSchema>;

export const questSchema = z.object({
  id: z.string(),
  name: z.string(),
  period: questPeriodSchema,
  type: z.string(),
  target: z.number().nonnegative(),
  progress: z.number().nonnegative(),
  rewardTokens: z.number().nonnegative(),
  completed: z.boolean(),
  claimed: z.boolean(),
  accepted: z.boolean().optional(),
  canAccept: z.boolean().optional(),
  window: z.string().optional(),
});

export const questResponseSchema = z.object({
  tokenBalance: z.number(),
  quests: z.array(questSchema),
});

export type Quest = z.infer<typeof questSchema>;
export type QuestResponse = z.infer<typeof questResponseSchema>;

export const claimQuestResultSchema = z.object({
  ok: z.literal(true),
  rewardTokens: z.number(),
  tokenBalance: z.number(),
});
export type ClaimQuestResult = z.infer<typeof claimQuestResultSchema>;

export const acceptQuestResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  requiredGrowth: z.number().optional(),
  currentGrowth: z.number().nullable().optional(),
});
export type AcceptQuestResult = z.infer<typeof acceptQuestResultSchema>;
