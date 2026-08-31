import mongoose, { Document } from "mongoose";

export interface IEmailVerificationToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

const emailVerificationTokenSchema =
  new mongoose.Schema<IEmailVerificationToken>(
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      tokenHash: {
        type: String,
        required: true,
        unique: true,
      },
      expiresAt: {
        type: Date,
        required: true,
      },
      usedAt: {
        type: Date,
        default: null,
      },
    },
    { timestamps: true },
  );

emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const EmailVerificationToken = mongoose.model(
  "EmailVerificationToken",
  emailVerificationTokenSchema,
);

export default EmailVerificationToken;
