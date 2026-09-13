import { notificationListQuerySchema } from '../../utils/admin-validation'
import { parseWithSchema } from '../../utils/validation'
import { defineApiHandler } from '../utils/api'
import { assertRateLimit } from '../utils/rate-limit'
import { listOwnNotifications } from '../services/notification.service'
import { requireUserClient } from '../utils/user'

export default defineApiHandler(async (event) => {
  const { client, profile } = await requireUserClient(event)
  assertRateLimit(`notifications:${profile.uuid}`, 60, 60_000)
  const query = parseWithSchema(notificationListQuerySchema, getQuery(event))
  return listOwnNotifications(client, query)
})
