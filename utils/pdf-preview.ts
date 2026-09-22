export function createPdfObjectUrl(data: Blob) {
  const pdf = data.type === 'application/pdf'
    ? data
    : new Blob([data], { type: 'application/pdf' })
  return URL.createObjectURL(pdf)
}
