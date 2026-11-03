import * as auditLogRepository from "./auditLog.repository.js";
import type { AuditAction, AuditResourceType } from "./auditLog.model.js";
import { getRequestContext } from "../../shared/requestContext.js";

interface AuditEntry {
  userId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  patientId?: string;
}

const toNewAuditLog = (entry: AuditEntry) => {
  const context = getRequestContext();

  return {
    userId: entry.userId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    patientId: entry.patientId ?? null,
    requestId: context?.requestId ?? null,
    ip: context?.ip ?? null,
  };
};

export const record = async (entry: AuditEntry) => {
  await auditLogRepository.save(toNewAuditLog(entry));
};

export const recordMany = async (entries: AuditEntry[]) => {
  if (entries.length === 0) {
    return;
  }

  await auditLogRepository.saveMany(entries.map(toNewAuditLog));
};
