function stripErrorFields(value: unknown) {
  if (!value || typeof value !== 'object') {
    return
  }

  const record = value as Record<string, unknown>
  delete record.stack
  delete record.cause

  if (record.data && typeof record.data === 'object') {
    stripErrorFields(record.data)
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (_event, response) => {
    stripErrorFields(response.body)
  })
})
