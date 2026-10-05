import { z } from 'zod'
import { isRentalCode } from './rental'
import { isSignatureDataUrl } from './waiver'

export const acceptWaiverSchema = z.object({
  rentalUuid: z.string().uuid().optional(),
  rentalCode: z.string().trim().max(40).optional(),
  waiverVersionUuid: z.string().uuid('Choose the current waiver version.'),
  signerName: z.string().trim().min(1, 'Type your full name.').max(160),
  signatureData: z.string().min(1, 'Sign the waiver.'),
}).strict().refine(data => Boolean(data.rentalUuid || data.rentalCode), {
  message: 'Choose a rental.',
  path: ['rentalUuid'],
}).refine(data => !data.rentalCode || isRentalCode(data.rentalCode), {
  message: 'Choose a valid rental.',
  path: ['rentalCode'],
}).refine(data => isSignatureDataUrl(data.signatureData), {
  message: 'Draw your signature on the pad.',
  path: ['signatureData'],
})

export const sendWaiverInviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254).optional().or(z.literal('')),
}).strict()

export const acceptWaiverInviteSchema = z.object({
  token: z.string().trim().min(20, 'This sign link is invalid.').max(200),
  waiverVersionUuid: z.string().uuid('Choose the current waiver version.'),
  signerName: z.string().trim().min(1, 'Type your full name.').max(160),
  signatureData: z.string().min(1, 'Sign the waiver.'),
}).strict().refine(data => isSignatureDataUrl(data.signatureData), {
  message: 'Draw your signature on the pad.',
  path: ['signatureData'],
})

export const publishWaiverSchema = z.object({
  version: z.string().trim().min(1, 'Version is required.').max(40),
  title: z.string().trim().min(1, 'Title is required.').max(160),
  body: z.string().trim().min(20, 'Write the waiver terms.').max(40_000),
}).strict()

export const acceptAdminWaiverSchema = z.object({
  waiverVersionUuid: z.string().uuid('Choose the current waiver version.'),
  signerName: z.string().trim().min(1, 'Type your full name.').max(160),
  signatureData: z.string().min(1, 'Sign the waiver.'),
}).strict().refine(data => isSignatureDataUrl(data.signatureData), {
  message: 'Draw your signature on the pad.',
  path: ['signatureData'],
})

export type AcceptWaiverInput = z.infer<typeof acceptWaiverSchema>
export type AcceptWaiverInviteInput = z.infer<typeof acceptWaiverInviteSchema>
export type SendWaiverInviteInput = z.infer<typeof sendWaiverInviteSchema>
export type PublishWaiverInput = z.infer<typeof publishWaiverSchema>
export type AcceptAdminWaiverInput = z.infer<typeof acceptAdminWaiverSchema>
