import { AuthenticatedUser } from "../../models/authenticatedUser.ts";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
