import { Router } from "express";

import * as patientController from "./patient.controller.js";
import {
  ArchivePatientSchema,
  CreatePatientSchema,
  GetPatientSchema,
  ListPatientsSchema,
  UpdatePatientSchema,
} from "./patient.schema.js";
import { schemaValidationMiddleware } from "../../middlewares/schemaValidation.middleware.js";
import { authenticationMiddleware } from "../auth/auth.middleware.js";

const routes = Router();

routes.use(authenticationMiddleware);

routes.post(
  "/",
  schemaValidationMiddleware(CreatePatientSchema),
  patientController.create,
);

routes.get(
  "/",
  schemaValidationMiddleware(ListPatientsSchema),
  patientController.list,
);

routes.get(
  "/:id",
  schemaValidationMiddleware(GetPatientSchema),
  patientController.get,
);

routes.put(
  "/:id",
  schemaValidationMiddleware(UpdatePatientSchema),
  patientController.update,
);

routes.post(
  "/:id/archive",
  schemaValidationMiddleware(ArchivePatientSchema),
  patientController.archive,
);

routes.post(
  "/:id/unarchive",
  schemaValidationMiddleware(ArchivePatientSchema),
  patientController.unarchive,
);

export default routes;
