import { getDb, single } from "../../db/db.js";
import { termsAcceptances } from "./termsAcceptance.model.js";

export const save = async (userId: string, termsVersion: string) =>
  single(
    await getDb()
      .insert(termsAcceptances)
      .values({ userId, termsVersion })
      .returning(),
  );
