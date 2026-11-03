import mongoose, { Document } from "mongoose";
import { normalizeForSearch } from "../../utils/string.utils.js";

export interface IPatient extends Document {
  nurseId: mongoose.Types.ObjectId;
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
    nurseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

patientSchema.index({ nurseId: 1, archivedAt: 1, searchName: 1 });
patientSchema.index(
  { nurseId: 1, cpf: 1 },
  { unique: true, partialFilterExpression: { cpf: { $type: "string" } } },
);
patientSchema.index(
  { nurseId: 1, cns: 1 },
  { unique: true, partialFilterExpression: { cns: { $type: "string" } } },
);

patientSchema.pre("validate", function () {
  if (this.isModified("name")) {
    this.searchName = normalizeForSearch(this.name);
  }
});

const Patient = mongoose.model("Patient", patientSchema);

export default Patient;
