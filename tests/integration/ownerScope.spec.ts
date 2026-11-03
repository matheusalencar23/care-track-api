import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";

import Patient from "../../src/modules/patient/patient.model.js";
import { MissingOwnerScopeError } from "../../src/db/ownerScope.plugin.js";

const ownerId = new mongoose.Types.ObjectId();

describe("owner scope", () => {
  let patientId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const patient = await Patient.create({
      ownerId,
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
        Patient.aggregate([{ $sort: { name: 1 } }, { $match: { ownerId } }]),
    ],
    [
      "bulkWrite",
      () =>
        Patient.bulkWrite([
          { deleteOne: { filter: { _id: patientId, ownerId } } },
        ]),
    ],
    [
      "ownerId with $exists",
      () => Patient.find({ ownerId: { $exists: true } }),
    ],
    ["ownerId with $ne", () => Patient.find({ ownerId: { $ne: ownerId } })],
    ["ownerId with $in", () => Patient.find({ ownerId: { $in: [ownerId] } })],
    [
      "aggregate with $exists on ownerId",
      () => Patient.aggregate([{ $match: { ownerId: { $exists: true } } }]),
    ],
    [
      "undefined ownerId",
      () =>
        Patient.find({
          ownerId: undefined as unknown as mongoose.Types.ObjectId,
        }),
    ],
  ])("should reject %s without ownerId", async (_name, query) => {
    await expect(query()).rejects.toBeInstanceOf(MissingOwnerScopeError);
  });

  it("should allow queries filtered by ownerId", async () => {
    await expect(
      Patient.findOne({ _id: patientId, ownerId }),
    ).resolves.not.toBeNull();
    await expect(Patient.countDocuments({ ownerId })).resolves.toBe(1);
    await expect(
      Patient.countDocuments({ ownerId: ownerId.toString() }),
    ).resolves.toBe(1);
    await expect(
      Patient.countDocuments({ ownerId: { $eq: ownerId } }),
    ).resolves.toBe(1);
    await expect(
      Patient.aggregate([{ $match: { ownerId } }, { $count: "total" }]),
    ).resolves.toEqual([{ total: 1 }]);
  });

  it("should leave the data untouched when a query is rejected", async () => {
    await expect(Patient.deleteMany({})).rejects.toThrow();

    await expect(Patient.countDocuments({ ownerId })).resolves.toBe(1);
  });

  it("should not let the owner of a patient change", async () => {
    const patient = await Patient.findOne({ _id: patientId, ownerId }).orFail();

    patient.ownerId = new mongoose.Types.ObjectId();
    await patient.save();

    const stored = await Patient.findOne({ _id: patientId, ownerId });
    expect(stored).not.toBeNull();
  });
});
