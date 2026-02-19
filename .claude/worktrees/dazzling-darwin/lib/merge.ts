import type { CheckError } from "./types"
import type { ParsedClaudeError } from "./claude"

const POSITION_TOLERANCE = 5

function overlaps(a: { offset: number; length: number }, b: { offset: number; length: number }): boolean {
  const aStart = a.offset
  const aEnd = a.offset + a.length
  const bStart = b.offset
  const bEnd = b.offset + b.length

  return (
    (Math.abs(aStart - bStart) <= POSITION_TOLERANCE && Math.abs(aEnd - bEnd) <= POSITION_TOLERANCE) ||
    (aStart < bEnd && bStart < aEnd)
  )
}

function textsMatch(a: string, b: string): boolean {
  return a.toLowerCase().trim() === b.toLowerCase().trim()
}

export function mergeErrors(
  claudeErrors: ParsedClaudeError[],
  ltErrors: CheckError[],
  correctedText?: string
): CheckError[] {
  const matched = new Set<number>()
  const result: CheckError[] = []

  for (const ce of claudeErrors) {
    let confidence: "high" | "uncertain" = "uncertain"

    for (let i = 0; i < ltErrors.length; i++) {
      if (matched.has(i)) continue
      if (overlaps(ce.position, ltErrors[i].position) || textsMatch(ce.original, ltErrors[i].original)) {
        confidence = "high"
        matched.add(i)
        break
      }
    }

    result.push({
      original: ce.original,
      correction: ce.correction,
      category: ce.category,
      rationale: ce.rationale,
      confidence,
      position: ce.position,
    })
  }

  for (let i = 0; i < ltErrors.length; i++) {
    if (matched.has(i)) continue
    const lt = ltErrors[i]
    if (correctedText && correctedText.includes(lt.original)) {
      continue
    }
    result.push({ ...lt, confidence: "uncertain" })
  }

  result.sort((a, b) => a.position.offset - b.position.offset)
  return result
}
