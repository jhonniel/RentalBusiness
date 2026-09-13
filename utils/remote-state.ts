export function remoteState(input: {
  statusCode?: number | null
  pending: boolean
  hasData: boolean
}) {
  const failed = Boolean(input.statusCode) && input.statusCode !== 503

  return {
    unavailable: input.statusCode === 503,
    failed,
    loading: input.pending && !input.hasData && !input.statusCode,
    empty: !input.pending && !input.statusCode && !input.hasData,
  }
}
