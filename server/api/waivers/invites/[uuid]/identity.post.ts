import { z } from 'zod'
import { parseWithSchema } from '../../../../../utils/validation'
import { submitWaiverInviteIdentity } from '../../../../services/identity.service'
import { defineApiHandler } from '../../../../utils/api'
import { AppError, ERROR_CODES } from '../../../../utils/errors'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { getSupabaseAdminClient } from '../../../../utils/supabase'

const inviteUuidSchema = z.string().uuid('This sign link is invalid.')

function partText(part?: { data?: Buffer }) {
  return part?.data ? Buffer.from(part.data).toString('utf8').trim() : ''
}

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`waiver-invite-identity:${ip}`, 12, 60_000)
  const uuid = parseWithSchema(inviteUuidSchema, getRouterParam(event, 'uuid') || '')
  const form = await readMultipartFormData(event)
  const token = partText(form?.find(part => part.name === 'token')) || String(getQuery(event).token || '')
  const governmentId = form?.find(part => part.name === 'governmentId' && part.data)
  const selfie = form?.find(part => part.name === 'selfie' && part.data)

  if (token.length < 20) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (!governmentId || !selfie) {
    throw new AppError('Upload a government ID and a selfie holding that same ID.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  return submitWaiverInviteIdentity(event, getSupabaseAdminClient(), uuid, token, {
    governmentId,
    selfie,
  })
})
