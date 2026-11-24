import { renderSVG } from 'uqr'

/** SVG QR for a URL or other text payload (admin print / share). */
export function qrSvg(value: string, options?: { pixelSize?: number }) {
  return renderSVG(value, {
    ecc: 'M',
    border: 2,
    pixelSize: options?.pixelSize ?? 6,
    whiteColor: '#ffffff',
    blackColor: '#12201a',
  })
}
