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
  phone: string | null
  rentalCount: number
  createdAt: string
}

export interface AdminCustomerListResponse {
  items: AdminCustomer[]
  page: number
  pageSize: number
  total: number
}
