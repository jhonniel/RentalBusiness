const STOP_WORDS = new Set([
  'a', 'an', 'the', 'i', 'me', 'my', 'we', 'you', 'your', 'our', 'us', 'is', 'are', 'am', 'do', 'does', 'did',
  'can', 'could', 'will', 'would', 'should', 'to', 'of', 'in', 'on', 'for', 'with', 'and', 'or', 'it', 'its',
  'what', 'how', 'when', 'where', 'which', 'who', 'why', 'if', 'there', 'this', 'that', 'be', 'have', 'has',
  'about', 'any', 'all', 'from', 'by', 'at', 'as', 'not', 'no', 'yes', 'so', 'than', 'then', 'they', 'them',
  'po', 'pls', 'please', 'ba', 'ang', 'ng', 'sa', 'ko', 'ka', 'mo',
])

function stem(word: string) {
  const root = word.length > 4 ? word.replace(/(ing|ed|es|s)$/, '') : word.replace(/s$/, '')
  return root.length > 3 ? root.replace(/e$/, '') : root
}

export function chatKeywords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem)
    .filter(word => word.length > 1)
}
