export interface PublicWaiverVersion {
  uuid: string
  version: string
  title: string
  body: string
  isCurrent: boolean
  publishedAt: string | null
}

export interface PublicWaiverAcceptance {
  uuid: string
  signerName: string
  acceptedAt: string
  privacyPolicyVersion: string | null
  termsVersion: string | null
  version: Pick<PublicWaiverVersion, 'uuid' | 'version' | 'title' | 'body'>
}
