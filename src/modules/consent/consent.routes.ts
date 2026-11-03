import { Router } from "express";

import * as consentController from "./consent.controller.js";
import {
  GrantConsentSchema,
  ListConsentsSchema,
  RevokeConsentSchema,
} from "./consent.schema.js";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";

const routes = Router({ mergeParams: true });

routes.post(
  "/",
  schemaValidationMiddleware(GrantConsentSchema),
  consentController.grant,
);

routes.get(
  "/",
  schemaValidationMiddleware(ListConsentsSchema),
  consentController.list,
);

routes.post(
  "/:consentId/revoke",
  schemaValidationMiddleware(RevokeConsentSchema),
  consentController.revoke,
);

export default routes;
