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

export function mergeErrors(
  claudeErrors: ParsedClaudeError[],
  ltErrors: CheckError[]
): CheckError[] {
  const matched = new Set<number>()
  const result: CheckError[] = []

  for (const ce of claudeErrors) {
    let confidence: "high" | "uncertain" = "uncertain"

    for (let i = 0; i < ltErrors.length; i++) {
      if (matched.has(i)) continue
      if (overlaps(ce.position, ltErrors[i].position)) {
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
    result.push({ ...ltErrors[i], confidence: "uncertain" })
  }

  result.sort((a, b) => a.position.offset - b.position.offset)
  return result
}
