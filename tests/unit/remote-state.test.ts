import { describe, expect, it } from 'vitest'
import { remoteState } from '../../utils/remote-state'

describe('remoteState', () => {
  it('treats 503 as unavailable rather than a generic failure', () => {
    expect(remoteState({ statusCode: 503, pending: false, hasData: false })).toMatchObject({
      unavailable: true,
      failed: false,
      loading: false,
      empty: false,
    })
  })

  it('treats other status codes as failed', () => {
    expect(remoteState({ statusCode: 500, pending: false, hasData: false })).toMatchObject({
      unavailable: false,
      signedOut: false,
      failed: true,
    })
  })

  it('keeps a signed-out response on the loading path', () => {
    expect(remoteState({ statusCode: 401, pending: false, hasData: false })).toMatchObject({
      signedOut: true,
      failed: false,
      loading: true,
      empty: false,
    })
  })

  it('shows loading only before data or an error arrives', () => {
    expect(remoteState({ pending: true, hasData: false })).toMatchObject({
      loading: true,
      empty: false,
    })
    expect(remoteState({ pending: true, hasData: true })).toMatchObject({
      loading: false,
    })
  })

  it('marks a settled empty response', () => {
    expect(remoteState({ pending: false, hasData: false })).toMatchObject({
      empty: true,
      loading: false,
      failed: false,
    })
  })
})
