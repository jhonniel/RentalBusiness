import { toClientError } from '~/utils/errors'

export function useAppError() {
  const toast = useToast()

  function showError(error: unknown) {
    const payload = toClientError(error)

    toast.add({
      title: payload.statusCode === 404 ? 'Not found' : 'Something went wrong',
      description: payload.message,
      color: 'error',
    })

    return payload
  }

  return {
    showError,
    toClientError,
  }
}
