import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { getAdminSocialLinks } from '../../services/social-link.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  return getAdminSocialLinks(client)
})
