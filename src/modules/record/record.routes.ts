import { Router } from "express";

import * as recordController from "./record.controller.js";
import {
  CreateRecordSchema,
  ListRecordVersionsSchema,
  UpdateRecordSchema,
  VoidRecordSchema,
} from "./record.schema.js";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";

const routes = Router({ mergeParams: true });

routes.post(
  "/",
  schemaValidationMiddleware(CreateRecordSchema),
  recordController.create,
);

routes.put(
  "/:recordId",
  schemaValidationMiddleware(UpdateRecordSchema),
  recordController.update,
);

routes.get(
  "/:recordId/versions",
  schemaValidationMiddleware(ListRecordVersionsSchema),
  recordController.listVersions,
);

routes.post(
  "/:recordId/void",
  schemaValidationMiddleware(VoidRecordSchema),
  recordController.voidRecord,
);

export default routes;
