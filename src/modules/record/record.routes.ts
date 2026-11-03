import { Router } from "express";

import * as recordController from "./record.controller.js";
import { CreateRecordSchema } from "./record.schema.js";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";

const routes = Router({ mergeParams: true });

routes.post(
  "/",
  schemaValidationMiddleware(CreateRecordSchema),
  recordController.create,
);

export default routes;
