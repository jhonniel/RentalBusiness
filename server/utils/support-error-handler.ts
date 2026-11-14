import { getRequestHeader, send, setResponseHeader, setResponseStatus } from 'h3'
import type { H3Error, H3Event } from 'h3'
import { FACEBOOK_MESSENGER_URL } from '../../utils/constants'
import { loggedErrorText, publicErrorMessage, SUPPORT_CONTACT_LABEL, SUPPORT_MESSAGE } from '../../utils/errors'

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
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: .75rem; margin-top: 1.5rem; }
    .actions a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 1rem; border-radius: .5rem; border: 1px solid #d6d3d1; text-decoration: none; font-weight: 500; }
    .actions a.facebook { background: #1877f2; border-color: #1877f2; color: #fff; }
  </style>
</head>
<body>
  <main>
    <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;">JRY Rentals</p>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
    <div class="actions">
      <a href="/">Back to home</a>
      <a class="facebook" href="${escapeHtml(FACEBOOK_MESSENGER_URL)}" target="_blank" rel="noopener noreferrer">${escapeHtml(SUPPORT_CONTACT_LABEL)}</a>
    </div>
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
