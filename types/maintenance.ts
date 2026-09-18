export interface PublicMaintenanceImage {
  uuid: string
  url: string
  alt: string
  sortOrder: number
}

export interface PublicMaintenanceStatus {
  enabled: boolean
  title: string
  message: string
  images: PublicMaintenanceImage[]
}
