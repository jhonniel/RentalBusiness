export const EMAIL_TEMPLATES = {
  RECEIPT_ISSUED: 'receipt.issued',
  RENTAL_REMINDER_PICKUP: 'rental.reminder.pickup',
  RENTAL_REMINDER_RETURN: 'rental.reminder.return',
  AUTH_SIGNUP_CONFIRM: 'auth.signup.confirm',
  RENTAL_SUBMITTED: 'rental.submitted',
} as const

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES]

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}
