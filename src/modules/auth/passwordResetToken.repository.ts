import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, single } from "../../db/db.js";
import { passwordResetTokens } from "./passwordResetToken.model.js";

export const save = async (
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) => {
  return single(
    await getDb()
      .insert(passwordResetTokens)
      .values({ userId, tokenHash, expiresAt })
      .returning(),
  );
};

export const findByToken = async (tokenHash: string) => {
  const [token] = await getDb()
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  return token ?? null;
};

export const findLatestByUserId = async (userId: string) => {
  const [token] = await getDb()
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, userId))
    .orderBy(desc(passwordResetTokens.createdAt), desc(passwordResetTokens.id))
    .limit(1);

  return token ?? null;
};

export const markAllAsUsedByUserId = async (userId: string, usedAt: Date) => {
  await getDb()
    .update(passwordResetTokens)
    .set({ usedAt })
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt),
      ),
    );
};
