import mongoose, { Document } from "mongoose";

export const AUDIT_ACTIONS = [
  "auth.signin",
  "auth.signout",
  "auth.password_reset",
  "patient.create",
  "patient.list",
  "patient.read",
  "patient.update",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_RESOURCE_TYPES = ["user", "patient"] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: mongoose.Types.ObjectId | null;
  patientId: mongoose.Types.ObjectId | null;
  requestId: string | null;
  ip: string | null;
  createdAt: Date;
}

const auditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
    },
    resourceType: {
      type: String,
      required: true,
      enum: AUDIT_RESOURCE_TYPES,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    requestId: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ patientId: 1, createdAt: -1 });

const rejectChange = () => {
  throw new Error("Audit logs are append-only");
};

auditLogSchema.pre(
  [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "replaceOne",
    "findOneAndReplace",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
  ],
  rejectChange,
);

auditLogSchema.pre("save", function () {
  if (!this.isNew) {
    rejectChange();
  }
});

auditLogSchema.pre("bulkWrite", rejectChange);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
