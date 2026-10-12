import { getRequestHeader, send, setResponseHeader, setResponseStatus } from 'h3'
import type { H3Error, H3Event } from 'h3'
import { loggedErrorText, publicErrorMessage, SUPPORT_MESSAGE } from '../../utils/errors'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function supportPage(statusCode: number, message: string) {
  const title = statusCode === 404 ? 'Page not found' : 'Contact the admin'
  const body = statusCode === 404
    ? 'The page you are looking for does not exist or has been moved.'
    : message
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · JRY Rentals</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fafaf9; color: #1c1917; font-family: ui-sans-serif, system-ui, sans-serif; }
    main { width: min(28rem, calc(100% - 2rem)); text-align: center; }
    p { color: #57534e; line-height: 1.6; }
    a { color: #1c1917; }
  </style>
</head>
<body>
  <main>
    <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;">JRY Rentals</p>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
    <p><a href="/">Back to home</a></p>
  </main>
</body>
</html>`
}

export async function supportErrorHandler(error: H3Error, event: H3Event) {
  const statusCode = error.statusCode || 500
  const safeMessage = statusCode >= 500
    ? SUPPORT_MESSAGE
    : publicErrorMessage(error.statusMessage || error.message || '', statusCode)

  console.error(JSON.stringify({
    level: 'error',
    message: 'Request failed',
    path: event.path,
    statusCode,
    error: loggedErrorText(error),
  }))

  const wantsHtml = getRequestHeader(event, 'accept')?.includes('text/html')
  setResponseStatus(event, statusCode, statusCode >= 500 ? 'Server Error' : safeMessage)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'x-content-type-options', 'nosniff')

  const body = wantsHtml
    ? supportPage(statusCode, safeMessage)
    : JSON.stringify({ statusCode, message: safeMessage })
  setResponseHeader(event, 'content-type', wantsHtml ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8')
  await send(event, body)
  ;(event as H3Event & { _handled?: boolean })._handled = true
}
