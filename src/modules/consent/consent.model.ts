import mongoose, { Document } from "mongoose";
import { ownerScopePlugin } from "../../db/ownerScope.plugin.js";

export const CONSENT_TYPES = ["image_capture"] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_METHODS = ["written", "verbal"] as const;

export type ConsentMethod = (typeof CONSENT_METHODS)[number];

export const CONSENT_GRANTORS = ["patient", "legal_representative"] as const;

export type ConsentGrantor = (typeof CONSENT_GRANTORS)[number];

export const CONSENT_STATUSES = ["active", "revoked"] as const;

export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export interface IConsent extends Document {
  ownerId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  type: ConsentType;
  method: ConsentMethod;
  grantor: ConsentGrantor;
  representativeName: string | null;
  collectedAt: Date;
  status: ConsentStatus;
  revokedAt: Date | null;
  revocationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const consentSchema = new mongoose.Schema<IConsent>(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      immutable: true,
    },
    type: {
      type: String,
      required: true,
      enum: CONSENT_TYPES,
      immutable: true,
    },
    method: {
      type: String,
      required: true,
      enum: CONSENT_METHODS,
      immutable: true,
    },
    grantor: {
      type: String,
      required: true,
      enum: CONSENT_GRANTORS,
      immutable: true,
    },
    representativeName: {
      type: String,
      default: null,
      trim: true,
      immutable: true,
    },
    collectedAt: {
      type: Date,
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      required: true,
      enum: CONSENT_STATUSES,
      default: "active",
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revocationReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true },
);

consentSchema.plugin(ownerScopePlugin);

consentSchema.index({ ownerId: 1, patientId: 1, createdAt: -1 });
consentSchema.index(
  { ownerId: 1, patientId: 1, type: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);

consentSchema.pre("save", function () {
  if (this.isNew) {
    return;
  }

  if (this.isModified("status") && this.status !== "revoked") {
    throw new Error("A revoked consent cannot be reactivated");
  }
});

const Consent = mongoose.model("Consent", consentSchema);

export default Consent;
