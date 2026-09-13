import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { AppError, ERROR_CODES } from '../../../../utils/errors'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { uploadPaymentMethodQr } from '../../../../services/payment-method.service'

export default defineApiHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) {
    throw new AppError('Payment method not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-payment-methods:${profile.uuid}`, 40, 60_000)

  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file')

  if (!file?.data) {
    throw new AppError('Choose a QR image to upload.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  return uploadPaymentMethodQr(event, client, uuid, file)
})
