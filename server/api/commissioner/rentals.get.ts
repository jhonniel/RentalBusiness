import { defineApiHandler } from '../../utils/api'
import { requireCommissionerClient } from '../../utils/commissioner'
import { listOwnCommissionerRentals } from '../../services/commissioner.service'

export default defineApiHandler(async (event) => {
  const { client, profileId } = await requireCommissionerClient(event)
  return listOwnCommissionerRentals(client, profileId)
})
