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

export class MissingOwnerScopeError extends Error {
  constructor(modelName: string) {
    super(`Queries on ${modelName} must be filtered by ownerId`);
    this.name = "MissingOwnerScopeError";
  }
}

const hasOwnerId = (filter: Record<string, unknown> | undefined) => {
  return filter?.["ownerId"] != null;
};

const firstStageMatchesOwner = (pipeline: PipelineStage[]) => {
  const [firstStage] = pipeline;

  return (
    firstStage !== undefined &&
    "$match" in firstStage &&
    hasOwnerId(firstStage.$match)
  );
};

export const ownerScopePlugin = (schema: Schema) => {
  schema.pre(FILTERED_QUERIES, function () {
    if (!hasOwnerId(this.getFilter())) {
      throw new MissingOwnerScopeError(this.model.modelName);
    }
  });

  schema.pre("estimatedDocumentCount", function () {
    throw new MissingOwnerScopeError(this.model.modelName);
  });

  schema.pre("aggregate", function () {
    if (!firstStageMatchesOwner(this.pipeline())) {
      throw new MissingOwnerScopeError(this.model().modelName);
    }
  });

  schema.pre("bulkWrite", function () {
    throw new MissingOwnerScopeError(this.modelName);
  });
};
