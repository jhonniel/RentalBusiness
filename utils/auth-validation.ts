import { z } from 'zod'

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.')
  .max(254)

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be 72 characters or fewer.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
}).strict()

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm your password.'),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Open the Terms & Conditions and choose I agree to create an account.' }),
  }),
  privacyAcknowledged: z.literal(true, {
    errorMap: () => ({ message: 'Open the Privacy Policy and choose I acknowledge to create an account.' }),
  }),
  marketingOptIn: z.boolean().optional().default(false),
}).strict().refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})

export const registerAccountSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  email: emailSchema,
  password: passwordSchema,
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Open the Terms & Conditions and choose I agree to create an account.' }),
  }),
  privacyAcknowledged: z.literal(true, {
    errorMap: () => ({ message: 'Open the Privacy Policy and choose I acknowledge to create an account.' }),
  }),
  marketingOptIn: z.boolean().optional().default(false),
}).strict()

export const forgotPasswordSchema = z.object({
  email: emailSchema,
}).strict()

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).strict().refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  marketingOptIn: z.boolean().optional(),
  privacyAcknowledged: z.boolean().optional(),
  termsAccepted: z.boolean().optional(),
}).strict()

export const acceptPoliciesSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Open the Terms & Conditions and choose I agree to continue.' }),
  }),
  privacyAcknowledged: z.literal(true, {
    errorMap: () => ({ message: 'Open the Privacy Policy and choose I acknowledge to continue.' }),
  }),
  marketingOptIn: z.boolean().optional().default(false),
}).strict()

export type RegisterAccountInput = z.infer<typeof registerAccountSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type AcceptPoliciesInput = z.infer<typeof acceptPoliciesSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}

  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !result[key]) {
      result[key] = issue.message
    }
  }

  return result
}
