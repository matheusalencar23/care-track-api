import mongoose, { Document } from "mongoose";
import { normalizeForSearch } from "../../utils/string.utils.js";
import { ownerScopePlugin } from "../../db/ownerScope.plugin.js";

export interface IPatient extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  searchName: string;
  birthDate: Date;
  cpf: string | null;
  cns: string | null;
  phone: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new mongoose.Schema<IPatient>(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    searchName: {
      type: String,
      required: true,
    },
    birthDate: {
      type: Date,
      required: true,
    },
    cpf: {
      type: String,
      default: null,
    },
    cns: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

patientSchema.plugin(ownerScopePlugin);

patientSchema.index({ ownerId: 1, archivedAt: 1, searchName: 1 });
patientSchema.index(
  { ownerId: 1, cpf: 1 },
  { unique: true, partialFilterExpression: { cpf: { $type: "string" } } },
);
patientSchema.index(
  { ownerId: 1, cns: 1 },
  { unique: true, partialFilterExpression: { cns: { $type: "string" } } },
);

patientSchema.pre("validate", function () {
  if (this.isModified("name")) {
    this.searchName = normalizeForSearch(this.name);
  }
});

const Patient = mongoose.model("Patient", patientSchema);

export default Patient;
