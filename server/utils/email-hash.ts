import { createHash } from 'node:crypto'

export function emailPayloadHash(template: string, entityKey: string): string {
  return createHash('sha256').update(`${template}:${entityKey}`).digest('hex')
}
