export function stringify(e: unknown): string {
  if (typeof e === 'object') {
    return JSON.stringify(e)
  }
  if (typeof e === 'string') {
    return e
  }
  return String(e)
}

export function isStringToStringMapping(a: unknown): a is Record<string, string> {
  if (typeof a !== 'object' || a === null) {
    return false
  }
  for (const [k, v] of Object.entries(a)) {
    if (typeof k !== 'string' || typeof v !== 'string') {
      return false
    }
  }
  return true
}
