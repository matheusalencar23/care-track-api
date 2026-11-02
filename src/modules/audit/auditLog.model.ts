import mongoose, { Document } from "mongoose";

export const AUDIT_ACTIONS = [
  "auth.signin",
  "auth.signout",
  "auth.password_reset",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_RESOURCE_TYPES = ["user"] as const;

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
    // Quem fez a ação
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
    // O que foi acessado ou alterado
    resourceType: {
      type: String,
      required: true,
      enum: AUDIT_RESOURCE_TYPES,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    // Paciente a que o recurso pertence, para o relatório de acessos por
    // paciente (Fase 4) sem precisar resolver cada recurso
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

// A coleção é só de inclusão: o Mongoose recusa qualquer alteração ou
// exclusão feita pela aplicação. Em produção, o usuário do banco usado pela
// API também deve ter só `insert` e `find` nesta coleção.
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
