import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";

import Patient from "../../src/modules/patient/patient.model.js";
import { MissingNurseScopeError } from "../../src/db/nurseScope.plugin.js";

const nurseId = new mongoose.Types.ObjectId();

describe("nurse scope", () => {
  let patientId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const patient = await Patient.create({
      nurseId,
      name: "José da Silva",
      birthDate: "1950-03-15",
    });
    patientId = patient._id;
  });

  it.each([
    ["find", () => Patient.find({ name: "José da Silva" })],
    ["findById", () => Patient.findById(patientId)],
    ["findOne", () => Patient.findOne({ _id: patientId })],
    ["exists", () => Patient.exists({ _id: patientId })],
    ["countDocuments", () => Patient.countDocuments()],
    ["distinct", () => Patient.distinct("name")],
    ["updateOne", () => Patient.updateOne({ _id: patientId }, { name: "X" })],
    ["updateMany", () => Patient.updateMany({}, { name: "X" })],
    [
      "findOneAndUpdate",
      () => Patient.findOneAndUpdate({ _id: patientId }, { name: "X" }),
    ],
    ["deleteOne", () => Patient.deleteOne({ _id: patientId })],
    ["deleteMany", () => Patient.deleteMany({})],
    ["findOneAndDelete", () => Patient.findOneAndDelete({ _id: patientId })],
    ["estimatedDocumentCount", () => Patient.estimatedDocumentCount()],
    ["aggregate", () => Patient.aggregate([{ $match: {} }])],
    [
      "aggregate without leading $match",
      () =>
        Patient.aggregate([{ $sort: { name: 1 } }, { $match: { nurseId } }]),
    ],
    [
      "bulkWrite",
      () =>
        Patient.bulkWrite([
          { deleteOne: { filter: { _id: patientId, nurseId } } },
        ]),
    ],
    ["undefined nurseId", () => Patient.find({ nurseId: undefined })],
  ])("should reject %s without nurseId", async (_name, query) => {
    await expect(query()).rejects.toBeInstanceOf(MissingNurseScopeError);
  });

  it("should allow queries filtered by nurseId", async () => {
    await expect(
      Patient.findOne({ _id: patientId, nurseId }),
    ).resolves.not.toBeNull();
    await expect(Patient.countDocuments({ nurseId })).resolves.toBe(1);
    await expect(
      Patient.aggregate([{ $match: { nurseId } }, { $count: "total" }]),
    ).resolves.toEqual([{ total: 1 }]);
  });

  it("should leave the data untouched when a query is rejected", async () => {
    await expect(Patient.deleteMany({})).rejects.toThrow();

    await expect(Patient.countDocuments({ nurseId })).resolves.toBe(1);
  });

  it("should not let the owner of a patient change", async () => {
    const patient = await Patient.findOne({ _id: patientId, nurseId }).orFail();

    patient.nurseId = new mongoose.Types.ObjectId();
    await patient.save();

    const stored = await Patient.findOne({ _id: patientId, nurseId });
    expect(stored).not.toBeNull();
  });
});
