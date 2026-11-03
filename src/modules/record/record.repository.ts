import { getDb, single } from "../../db/db.js";
import { records, recordVersions } from "./record.model.js";
import type { BrazilianState } from "../../shared/brazilianStates.js";

export interface RecordAuthor {
  id: string;
  name: string;
  coren: string;
  corenState: BrazilianState;
}

export const save = async (
  ownerId: string,
  patientId: string,
  author: RecordAuthor,
  content: string,
) => {
  const record = single(
    await getDb()
      .insert(records)
      .values({ ownerId, patientId, authorId: author.id })
      .returning(),
  );

  const version = single(
    await getDb()
      .insert(recordVersions)
      .values({
        ownerId,
        recordId: record.id,
        content,
        authorId: author.id,
        authorName: author.name,
        authorCoren: author.coren,
        authorCorenState: author.corenState,
      })
      .returning(),
  );

  return { record, version };
};
