import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { NODE_ENV } from "../config/secrets.js";
import { MessageCode, messages } from "../shared/messages.js";

const tooManyRequests = {
  code: "TOO_MANY_REQUESTS" satisfies MessageCode,
  message: messages.TOO_MANY_REQUESTS,
};

export const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooManyRequests,
  skip: () => NODE_ENV === "development",
});

export const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooManyRequests,
  skip: () => NODE_ENV === "development",
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooManyRequests,
  skip: () => NODE_ENV === "development",
});

export const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? ""),
  message: tooManyRequests,
  skip: () => NODE_ENV === "development",
});
