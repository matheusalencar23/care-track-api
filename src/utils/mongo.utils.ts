import mongoose from "mongoose";

const DUPLICATE_KEY_ERROR_CODE = 11000;

export const isDuplicateKeyError = (err: unknown) => {
  return (
    err instanceof mongoose.mongo.MongoServerError &&
    err.code === DUPLICATE_KEY_ERROR_CODE
  );
};
