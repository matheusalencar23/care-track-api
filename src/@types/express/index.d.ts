import type { BrazilianState } from "../../shared/brazilianStates.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        coren: string;
        corenState: BrazilianState;
      };
    }
  }
}

export {};
