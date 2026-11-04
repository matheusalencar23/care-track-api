import rateLimit from "express-rate-limit";
import { NODE_ENV } from "../config/secrets.js";
import { messages } from "../shared/messages.js";

export const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: messages.TOO_MANY_REQUESTS },
  skip: () => NODE_ENV === "development",
});

export const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: messages.TOO_MANY_REQUESTS },
  skip: () => NODE_ENV === "development",
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: messages.TOO_MANY_REQUESTS },
  skip: () => NODE_ENV === "development",
});
