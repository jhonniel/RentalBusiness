import { createHmac, timingSafeEqual } from 'node:crypto'

export function signPaymentPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export function verifyPaymentSignature(secret: string, body: string, header: string | undefined): boolean {
  if (!header) {
    return false
  }

  const provided = header.startsWith('sha256=') ? header.slice(7) : header
  const expected = signPaymentPayload(secret, body)

  try {
    const left = Buffer.from(expected, 'hex')
    const right = Buffer.from(provided, 'hex')
    return left.length === right.length && timingSafeEqual(left, right)
  }
  catch {
    return false
  }
}
