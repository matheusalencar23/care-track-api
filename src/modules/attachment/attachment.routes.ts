import { Router } from "express";

import * as attachmentController from "./attachment.controller.js";
import {
  AttachmentParamsSchema,
  DownloadAttachmentSchema,
  CreateAttachmentSchema,
  GetThumbnailsSchema,
  ListAttachmentsSchema,
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
  "/",
  schemaValidationMiddleware(ListAttachmentsSchema),
  attachmentController.list,
);

routes.post(
  "/thumbnails",
  schemaValidationMiddleware(GetThumbnailsSchema),
  attachmentController.thumbnails,
);

routes.post(
  "/:attachmentId/thumbnail",
  schemaValidationMiddleware(AttachmentParamsSchema),
  attachmentController.generateThumbnail,
);

routes.get(
  "/:attachmentId/download",
  schemaValidationMiddleware(DownloadAttachmentSchema),
  attachmentController.download,
);

export default routes;
