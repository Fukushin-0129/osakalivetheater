export function practiceWeekStart(now = new Date()): string {
  // Move the clock to Japan time, then use UTC calendar operations.
  const date = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

export function practiceVideoUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}
