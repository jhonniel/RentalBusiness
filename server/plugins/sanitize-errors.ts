import { publicErrorMessage } from '../../utils/errors'

function statusCodeOf(record: Record<string, unknown>) {
  return typeof record.statusCode === 'number' ? record.statusCode : 500
}

function stripErrorFields(value: unknown) {
  if (!value || typeof value !== 'object') {
    return
  }

  const record = value as Record<string, unknown>
  delete record.stack
  delete record.cause

  const statusCode = statusCodeOf(record)
  if (typeof record.message === 'string') {
    record.message = publicErrorMessage(record.message, statusCode)
  }
  if (typeof record.statusMessage === 'string') {
    record.statusMessage = publicErrorMessage(record.statusMessage, statusCode)
  }

  if (record.data && typeof record.data === 'object') {
    stripErrorFields(record.data)
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (_event, response) => {
    stripErrorFields(response.body)
  })
})
