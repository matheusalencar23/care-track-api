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

export const record = async (entry: AuditEntry) => {
  const context = getRequestContext();

  await auditLogRepository.save({
    userId: entry.userId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    patientId: entry.patientId ?? null,
    requestId: context?.requestId ?? null,
    ip: context?.ip ?? null,
  });
};
