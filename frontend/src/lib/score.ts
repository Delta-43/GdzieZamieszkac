// The two numbers the browser derives from the API's ranking, each in one place (issue #82, points A and F).
// The contract has no display string for them yet; a `contract` issue would move both to the API.

/** The score as a whole number: a list of "40,9" and "41,3" says nothing to a resident. */
export function wholeScore(score: number): number {
  return Math.round(score)
}

/**
 * In how many of the other districts the measure is worse. The percentile already has the direction applied
 * (100 is the best), so the answer always reads as "better than".
 */
export function betterThan(percentile: number, districts: number): number {
  return Math.round((percentile / 100) * (districts - 1))
}

// The three choices a resident makes for a category, and the weight each one sends to the API.
export const IMPORTANCE_WEIGHTS = [0, 3, 5] as const
export const MAX_WEIGHT = 5
