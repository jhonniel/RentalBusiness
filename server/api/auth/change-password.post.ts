import { changePasswordSchema } from '../../../utils/auth-validation'
import { parseWithSchema } from '../../../utils/validation'
import { changeOwnPassword } from '../../services/auth-account.service'
import { defineApiHandler } from '../../utils/api'
import { requireAdmin, requireUser } from '../../utils/auth'
import { assertRateLimit } from '../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  const profile = await requireAdmin(event)
  assertRateLimit(`password:${user.sub}`, 8, 15 * 60_000)
  const input = parseWithSchema(changePasswordSchema, await readBody(event))
  return changeOwnPassword(event, user, profile, input)
})
