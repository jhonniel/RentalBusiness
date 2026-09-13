import { parseWithSchema } from '../../../../utils/validation'
import { z } from 'zod'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { readOwnNotification } from '../../../services/notification.service'
import { requireUserClient } from '../../../utils/user'

export default defineApiHandler(async (event) => {
  const { client, profile } = await requireUserClient(event)
  assertRateLimit(`notifications:${profile.uuid}`, 60, 60_000)
  const uuid = parseWithSchema(z.string().uuid(), getRouterParam(event, 'id') || '')
  return readOwnNotification(client, uuid)
})
