import { timingSafeEqual } from 'node:crypto'

export function cronSecretMatches(expected: string, provided: string): boolean {
  if (!expected || !provided) {
    return false
  }

  const left = Buffer.from(expected)
  const right = Buffer.from(provided)
  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}
