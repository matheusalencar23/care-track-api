import EmailVerificationToken from "./emailVerificationToken.model.js";

export const save = async (
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) => {
  const emailVerificationToken = new EmailVerificationToken({
    userId,
    tokenHash,
    expiresAt,
  });

  await emailVerificationToken.save();

  return emailVerificationToken;
};

export const findByToken = async (token: string) => {
  return await EmailVerificationToken.findOne({ tokenHash: token });
};

export const deleteByUserId = async (id: string) => {
  return await EmailVerificationToken.deleteOne({ userId: id });
};
