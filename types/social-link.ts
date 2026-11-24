export interface PublicSocialLink {
  uuid: string
  label: string
  url: string
  sortOrder: number
  isActive: boolean
  buttonColor: string | null
  icon: string | null
  updatedAt: string | null
}

export interface PublicSocialAdVoucher {
  uuid: string
  code: string
  name: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  label: string
}

export interface PublicSocialAd {
  uuid: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  linkUrl: string | null
  voucher: PublicSocialAdVoucher | null
  sortOrder: number
  isActive: boolean
  updatedAt: string | null
}

export interface AdminSocialLinkListResponse {
  items: PublicSocialLink[]
  ads: PublicSocialAd[]
  adsReady: boolean
  ready: boolean
  pageUrl: string
  code: string
  buttonColor: string
}

export interface PublicSocialPage {
  title: string
  subtitle: string
  pageUrl: string
  buttonColor: string
  links: PublicSocialLink[]
  ads: PublicSocialAd[]
}
