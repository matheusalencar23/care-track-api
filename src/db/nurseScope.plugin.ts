import type { MongooseQueryMiddleware, PipelineStage, Schema } from "mongoose";

const FILTERED_QUERIES: MongooseQueryMiddleware[] = [
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "distinct",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
];

export class MissingNurseScopeError extends Error {
  constructor(modelName: string) {
    super(`Queries on ${modelName} must be filtered by nurseId`);
    this.name = "MissingNurseScopeError";
  }
}

const hasNurseId = (filter: Record<string, unknown> | undefined) => {
  return filter?.["nurseId"] != null;
};

const firstStageMatchesNurse = (pipeline: PipelineStage[]) => {
  const [firstStage] = pipeline;

  return (
    firstStage !== undefined &&
    "$match" in firstStage &&
    hasNurseId(firstStage.$match)
  );
};

export const nurseScopePlugin = (schema: Schema) => {
  schema.pre(FILTERED_QUERIES, function () {
    if (!hasNurseId(this.getFilter())) {
      throw new MissingNurseScopeError(this.model.modelName);
    }
  });

  schema.pre("estimatedDocumentCount", function () {
    throw new MissingNurseScopeError(this.model.modelName);
  });

  schema.pre("aggregate", function () {
    if (!firstStageMatchesNurse(this.pipeline())) {
      throw new MissingNurseScopeError(this.model().modelName);
    }
  });

  schema.pre("bulkWrite", function () {
    throw new MissingNurseScopeError(this.modelName);
  });
};
