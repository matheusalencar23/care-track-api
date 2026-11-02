import AuditLog, {
  type AuditAction,
  type AuditResourceType,
} from "./auditLog.model.js";

export interface NewAuditLog {
  userId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  patientId: string | null;
  requestId: string | null;
  ip: string | null;
}

export const save = async (entry: NewAuditLog) => {
  const auditLog = new AuditLog(entry);

  await auditLog.save();

  return auditLog;
};
