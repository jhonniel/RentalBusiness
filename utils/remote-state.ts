export function remoteState(input: {
  statusCode?: number | null
  pending: boolean
  hasData: boolean
}) {
  const signedOut = input.statusCode === 401
  const failed = Boolean(input.statusCode) && input.statusCode !== 503 && !signedOut

  return {
    unavailable: input.statusCode === 503,
    signedOut,
    failed,
    loading: (input.pending && !input.hasData && !input.statusCode) || (signedOut && !input.hasData),
    empty: !input.pending && !input.statusCode && !input.hasData,
  }
}
