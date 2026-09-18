import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { APP_NAME } from '../../utils/constants'
import { formatBusinessDate, formatBusinessDateTime } from '../../utils/datetime'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 54
const FONT_SIZE = 10
const TITLE_SIZE = 16
const LINE_HEIGHT = 13

export interface WaiverPdfInput {
  title: string
  version: string
  body: string
  filename: string
  rentalCode?: string | null
  startsOn?: string | null
  endsOn?: string | null
  signerName?: string | null
  signerEmail?: string | null
  signerPhone?: string | null
  acceptedAt?: string | null
  privacyPolicyVersion?: string | null
  termsVersion?: string | null
  signatureDataUrl?: string | null
}

export function sanitizeWaiverPdfText(value: string) {
  return value
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\u2018', '\'')
    .replaceAll('\u2019', '\'')
    .replaceAll('\u201C', '"')
    .replaceAll('\u201D', '"')
    .replaceAll('\u2013', '-')
    .replaceAll('\u2014', '-')
    .replaceAll('\u2026', '...')
    .replace(/[^\t\n\u0020-\u007E]/g, '')
}

export function waiverPdfFilename(parts: string[]) {
  const slug = parts
    .map(part => part.trim().replace(/[^\w.-]+/g, '-'))
    .filter(Boolean)
    .join('-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return `${slug || 'jry-waiver'}.pdf`
}

export function wrapWaiverPdfLines(
  text: string,
  widthOf: (value: string) => number,
  maxWidth: number,
) {
  const lines: string[] = []

  for (const paragraph of sanitizeWaiverPdfText(text).split('\n')) {
    if (!paragraph) {
      lines.push('')
      continue
    }

    const words = paragraph.split(' ')
    let current = ''

    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (widthOf(next) <= maxWidth) {
        current = next
        continue
      }

      if (current) {
        lines.push(current)
      }

      if (widthOf(word) <= maxWidth) {
        current = word
        continue
      }

      let chunk = ''
      for (const character of word) {
        const candidate = chunk + character
        if (widthOf(candidate) <= maxWidth) {
          chunk = candidate
          continue
        }
        if (chunk) {
          lines.push(chunk)
        }
        chunk = character
      }
      current = chunk
    }

    if (current) {
      lines.push(current)
    }
  }

  return lines
}

function pngBytesFromDataUrl(value?: string | null) {
  if (!value?.startsWith('data:image/png;base64,')) {
    return null
  }

  try {
    return Uint8Array.from(Buffer.from(value.slice('data:image/png;base64,'.length), 'base64'))
  }
  catch {
    return null
  }
}

export async function buildWaiverPdf(input: WaiverPdfInput): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const contentWidth = PAGE_WIDTH - MARGIN * 2
  const widthOf = (value: string, size = FONT_SIZE) => font.widthOfTextAtSize(value, size)

  const meta: string[] = [
    `Version ${input.version}`,
    input.rentalCode ? `Rental ${input.rentalCode}` : '',
    input.startsOn && input.endsOn
      ? `Dates ${formatBusinessDate(input.startsOn)} - ${formatBusinessDate(input.endsOn)}`
      : '',
    input.signerName ? `Signed by ${input.signerName}` : '',
    input.signerEmail ? `Email ${input.signerEmail}` : '',
    input.signerPhone ? `Mobile ${input.signerPhone}` : '',
    input.acceptedAt ? `Accepted ${formatBusinessDateTime(input.acceptedAt)}` : '',
    input.privacyPolicyVersion ? `Privacy Policy ${input.privacyPolicyVersion}` : '',
    input.termsVersion ? `Terms ${input.termsVersion}` : '',
  ].filter(Boolean)

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  function ensureSpace(height: number) {
    if (y - height < MARGIN) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
  }

  function drawLine(value: string, size = FONT_SIZE, useBold = false) {
    ensureSpace(LINE_HEIGHT)
    page.drawText(sanitizeWaiverPdfText(value), {
      x: MARGIN,
      y: y - size,
      size,
      font: useBold ? bold : font,
      color: rgb(0.07, 0.13, 0.1),
    })
    y -= LINE_HEIGHT
  }

  drawLine(APP_NAME, 11, true)
  y -= 6
  const titleLines = wrapWaiverPdfLines(input.title, value => bold.widthOfTextAtSize(value, TITLE_SIZE), contentWidth)
  for (const line of titleLines) {
    ensureSpace(20)
    page.drawText(line, {
      x: MARGIN,
      y: y - TITLE_SIZE,
      size: TITLE_SIZE,
      font: bold,
      color: rgb(0.07, 0.13, 0.1),
    })
    y -= 20
  }
  y -= 6

  for (const line of meta) {
    drawLine(line, 9)
  }

  y -= 10
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.72),
  })
  y -= 16

  for (const line of wrapWaiverPdfLines(input.body, value => widthOf(value), contentWidth)) {
    if (!line) {
      y -= LINE_HEIGHT / 2
      continue
    }
    drawLine(line)
  }

  const signatureBytes = pngBytesFromDataUrl(input.signatureDataUrl)
  if (signatureBytes) {
    try {
      const image = await document.embedPng(signatureBytes)
      const width = Math.min(220, image.width)
      const height = width * (image.height / image.width)
      y -= 18
      drawLine('Signature', 9, true)
      ensureSpace(height + 8)
      page.drawImage(image, {
        x: MARGIN,
        y: y - height,
        width,
        height,
      })
      y -= height + 8
    }
    catch {
      drawLine('Signature is on file.')
    }
  }

  document.setTitle(`${input.title} ${input.version}`)
  document.setAuthor(APP_NAME)
  document.setSubject(input.filename)

  return document.save()
}
