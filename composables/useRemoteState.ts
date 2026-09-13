import { remoteState } from '~/utils/remote-state'

export function useRemoteState(
  error: { value?: { statusCode?: number } | null },
  pending: { value: boolean },
  hasData: { value: boolean },
) {
  return computed(() => remoteState({
    statusCode: error.value?.statusCode ?? null,
    pending: pending.value,
    hasData: hasData.value,
  }))
}
