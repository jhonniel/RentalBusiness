import { renderSVG } from 'uqr'

const LOGO_HREF = '/logo.png?v=12'

function viewBoxSize(svg: string) {
  const match = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/)
  if (!match) {
    return null
  }
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  }
}

/** Center logo overlay (white pad + brand mark). Needs high ECC so the QR still scans. */
function withCenterLogo(svg: string, logoHref: string) {
  const box = viewBoxSize(svg)
  if (!box || !svg.endsWith('</svg>')) {
    return svg
  }

  const size = Math.min(box.width, box.height)
  const logoSize = Math.round(size * 0.22)
  const pad = Math.round(logoSize * 0.18)
  const outer = logoSize + pad * 2
  const x = (box.width - outer) / 2
  const y = (box.height - outer) / 2
  const rx = Math.round(outer * 0.16)

  const overlay = [
    `<rect x="${x}" y="${y}" width="${outer}" height="${outer}" rx="${rx}" ry="${rx}" fill="#ffffff"/>`,
    `<image href="${logoHref}" xlink:href="${logoHref}" x="${x + pad}" y="${y + pad}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`,
  ].join('')

  return `${svg.slice(0, -'</svg>'.length)}${overlay}</svg>`
}

/** SVG QR for a URL or other text payload (admin print / share). */
export function qrSvg(value: string, options?: {
  pixelSize?: number
  /** Embed the system logo in the center (uses high error correction). */
  withLogo?: boolean
  logoHref?: string
}) {
  const withLogo = Boolean(options?.withLogo)
  const svg = renderSVG(value, {
    ecc: withLogo ? 'H' : 'M',
    border: 2,
    pixelSize: options?.pixelSize ?? 6,
    whiteColor: '#ffffff',
    blackColor: '#12201a',
  })

  if (!withLogo) {
    return svg
  }

  return withCenterLogo(svg, options?.logoHref || LOGO_HREF)
}
