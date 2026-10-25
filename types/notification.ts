export interface PublicNotification {
  uuid: string
  type: string
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

export interface NotificationListResponse {
  items: PublicNotification[]
  page: number
  pageSize: number
  total: number
}

export interface AdminCustomer {
  uuid: string
  firstName: string
  lastName: string
  email: string | null
  walkIn?: boolean
  phone: string | null
  rentalCount: number
  createdAt: string
  linkedCommissioner?: { uuid: string, firstName: string, lastName: string } | null
}

export interface AdminCustomerListResponse {
  items: AdminCustomer[]
  commissionerLinksAvailable?: boolean
  page: number
  pageSize: number
  total: number
}

export interface AdminSystemUser {
  uuid: string
  firstName: string
  lastName: string
  email: string | null
  createdAt: string
}
