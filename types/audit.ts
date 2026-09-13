export interface PublicAuditActor {
  uuid: string
  name: string
}

export interface PublicAuditLog {
  uuid: string
  action: string
  entity: string
  entityId: string
  previousValue: Record<string, unknown> | null
  nextValue: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  actor: PublicAuditActor | null
}

export interface AuditLogListResponse {
  items: PublicAuditLog[]
  page: number
  pageSize: number
  total: number
}
