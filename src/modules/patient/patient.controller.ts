import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import * as patientService from "./patient.service.js";
import { ListPatientsQuerySchema } from "./patient.schema.js";
import { UnauthorizedException } from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";

const patientFields = (body: Request["body"]) => {
  const { name, birthDate, cpf, cns, phone } = body;
  return { name, birthDate, cpf, cns, phone };
};

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Creating patient...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const patient = await patientService.createPatient(
      req.user.id,
      patientFields(req.body),
    );

    return res.status(201).json(patient);
  } catch (err) {
    AppLogger.error("Error creating patient");
    return next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  AppLogger.info("Listing patients...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const result = await patientService.listPatients(
      req.user.id,
      ListPatientsQuerySchema.parse(req.query),
    );

    return res.json(result);
  } catch (err) {
    AppLogger.error("Error listing patients");
    return next(err);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  AppLogger.info("Getting patient...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const patient = await patientService.getPatient(
      req.user.id,
      req.params["id"] as string,
    );

    return res.json(patient);
  } catch (err) {
    AppLogger.error("Error getting patient");
    return next(err);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Updating patient...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const patient = await patientService.updatePatient(
      req.user.id,
      req.params["id"] as string,
      patientFields(req.body),
    );

    return res.json(patient);
  } catch (err) {
    AppLogger.error("Error updating patient");
    return next(err);
  }
};

export const archive = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Archiving patient...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const patient = await patientService.archivePatient(
      req.user.id,
      req.params["id"] as string,
    );

    return res.json(patient);
  } catch (err) {
    AppLogger.error("Error archiving patient");
    return next(err);
  }
};

export const unarchive = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Unarchiving patient...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const patient = await patientService.unarchivePatient(
      req.user.id,
      req.params["id"] as string,
    );

    return res.json(patient);
  } catch (err) {
    AppLogger.error("Error unarchiving patient");
    return next(err);
  }
};
