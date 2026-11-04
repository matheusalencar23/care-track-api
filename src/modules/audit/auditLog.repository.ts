import { getDb } from "../../db/db.js";
import {
  auditLogs,
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
  await getDb().insert(auditLogs).values(entry);
};

export const saveMany = async (entries: NewAuditLog[]) => {
  await getDb().insert(auditLogs).values(entries);
};
