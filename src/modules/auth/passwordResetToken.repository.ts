import PasswordResetToken from "./passwordResetToken.model.js";

export const save = async (
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) => {
  const passwordResetToken = new PasswordResetToken({
    userId,
    tokenHash,
    expiresAt,
  });

  await passwordResetToken.save();

  return passwordResetToken;
};

export const findByToken = async (token: string) => {
  return await PasswordResetToken.findOne({ tokenHash: token });
};

export const findLatestByUserId = async (userId: string) => {
  return await PasswordResetToken.findOne({ userId }).sort({
    createdAt: -1,
  });
};

export const markAllAsUsedByUserId = async (userId: string, usedAt: Date) => {
  return await PasswordResetToken.updateMany(
    { userId, usedAt: null },
    { usedAt },
  );
};
