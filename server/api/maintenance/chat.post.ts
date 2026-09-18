import { maintenanceChatInputSchema } from '../../../utils/maintenance-chat-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { answerMaintenanceChat } from '../../services/maintenance-chat.service'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`maintenance-chat:${ip}`, 20, 60_000)
  const input = parseWithSchema(maintenanceChatInputSchema, await readBody(event))
  return answerMaintenanceChat(event, input)
})
