import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, single } from "../../db/db.js";
import { emailVerificationTokens } from "./emailVerificationToken.model.js";

export const save = async (
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) => {
  return single(
    await getDb()
      .insert(emailVerificationTokens)
      .values({ userId, tokenHash, expiresAt })
      .returning(),
  );
};

export const findByToken = async (tokenHash: string) => {
  const [token] = await getDb()
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  return token ?? null;
};

export const findLatestByUserId = async (userId: string) => {
  const [token] = await getDb()
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId))
    .orderBy(
      desc(emailVerificationTokens.createdAt),
      desc(emailVerificationTokens.id),
    )
    .limit(1);

  return token ?? null;
};

export const markAsUsed = async (id: string, usedAt: Date) => {
  await getDb()
    .update(emailVerificationTokens)
    .set({ usedAt })
    .where(
      and(
        eq(emailVerificationTokens.id, id),
        isNull(emailVerificationTokens.usedAt),
      ),
    );
};
