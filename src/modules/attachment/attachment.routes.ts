import { Router } from "express";

import * as attachmentController from "./attachment.controller.js";
import {
  DownloadAttachmentSchema,
  CreateAttachmentSchema,
  PatientParamsSchema,
} from "./attachment.schema.js";
import { uploadMiddleware } from "./attachment.upload.js";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";

const routes = Router({ mergeParams: true });

routes.post(
  "/",
  schemaValidationMiddleware(PatientParamsSchema),
  attachmentController.assertCanUpload,
  uploadMiddleware,
  schemaValidationMiddleware(CreateAttachmentSchema),
  attachmentController.create,
);

routes.get(
  "/:attachmentId/download",
  schemaValidationMiddleware(DownloadAttachmentSchema),
  attachmentController.download,
);

export default routes;
