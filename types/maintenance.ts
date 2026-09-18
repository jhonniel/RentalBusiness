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

export interface MaintenanceChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface MaintenanceChatResponse {
  reply: string
}
