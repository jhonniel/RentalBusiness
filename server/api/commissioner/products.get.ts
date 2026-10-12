import { defineApiHandler } from '../../utils/api'
import { requireCommissionerClient } from '../../utils/commissioner'
import { listCommissionerEquipment } from '../../services/commissioner.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireCommissionerClient(event)
  return listCommissionerEquipment(client)
})
