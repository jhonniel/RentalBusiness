export interface PublicMaintenanceImage {
  uuid: string
  url: string
  alt: string
  sortOrder: number
}

export interface PublicMaintenanceProduct {
  slug: string
  name: string
  categorySlug: string
  imageUrl: string | null
}

export interface PublicMaintenanceStatus {
  enabled: boolean
  title: string
  message: string
  images: PublicMaintenanceImage[]
  products: PublicMaintenanceProduct[]
}

export interface MaintenanceChatAction {
  kind: 'book' | 'view'
  label: string
  to: string
}

export interface MaintenanceChatMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: MaintenanceChatAction[]
}

export interface MaintenanceChatResponse {
  reply: string
  actions?: MaintenanceChatAction[]
  suggestions?: string[]
}
