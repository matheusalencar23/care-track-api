import mongoose from "mongoose";
import { AppLogger } from "../shared/appLogger";

export const connectDb = async () => {
  await mongoose
    .connect(process.env.MONGO_DB_URL_CONNECTION ?? "")
    .then(() => {
      AppLogger.info("Successfully connected with database");
    })
    .catch((err) => {
      throw new Error(`Failed to connect to database: ${err}`);
    });
};
