import { eq } from "drizzle-orm";
import { getDb, single } from "../../db/db.js";
import { users } from "./user.model.js";
import { BadRequestException } from "../../shared/exceptions/index.js";
import { isDuplicateKeyError } from "../../utils/db.utils.js";
import { hashPassword } from "../../utils/crypt.utils.js";
import type { SignupData } from "./user.schema.js";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const findByEmail = async (email: string) => {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  return user ?? null;
};

export const findById = async (id: string) => {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
};

export const save = async (data: Omit<SignupData, "acceptedTermsVersion">) => {
  try {
    return single(
      await getDb()
        .insert(users)
        .values({
          name: data.name.trim(),
          email: normalizeEmail(data.email),
          passwordHash: await hashPassword(data.password),
          coren: data.coren.trim(),
          corenState: data.corenState,
        })
        .returning(),
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new BadRequestException("INVALID_REGISTRATION_CREDENTIALS");
    }

    throw err;
  }
};

export const markEmailVerified = async (id: string, verifiedAt: Date) => {
  await getDb()
    .update(users)
    .set({ emailVerifiedAt: verifiedAt })
    .where(eq(users.id, id));
};

export const updatePassword = async (
  id: string,
  password: string,
  changes: { passwordChangedAt: Date; emailVerifiedAt: Date },
) => {
  await getDb()
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      passwordChangedAt: changes.passwordChangedAt,
      emailVerifiedAt: changes.emailVerifiedAt,
    })
    .where(eq(users.id, id));
};
