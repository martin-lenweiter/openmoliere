import type { CheckError } from "./types"

interface LTMatch {
  offset: number
  length: number
  message: string
  replacements: { value: string }[]
  rule: {
    id: string
    category: { id: string; name: string }
  }
  context: {
    text: string
    offset: number
    length: number
  }
}

interface LTResponse {
  matches: LTMatch[]
  language: {
    code: string
    detectedLanguage?: { code: string }
  }
}

function mapCategory(categoryId: string): "spelling" | "grammar" | "style" {
  const lower = categoryId.toLowerCase()
  if (lower.includes("typo") || lower.includes("spell")) return "spelling"
  if (lower.includes("style") || lower.includes("redundancy") || lower.includes("plain_english")) return "style"
  return "grammar"
}

export async function checkWithLanguageTool(
  text: string,
  language?: string
): Promise<{ errors: CheckError[]; detectedLanguage: string }> {
  const params = new URLSearchParams({
    text,
    language: language ?? "auto",
    enabledOnly: "false",
  })

  const response = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    throw new Error(`LanguageTool API error: ${response.status}`)
  }

  const data = (await response.json()) as LTResponse

  const detectedLanguage = data.language.detectedLanguage?.code ?? data.language.code ?? "en-US"

  const errors: CheckError[] = data.matches
    .filter((m) => m.replacements.length > 0)
    .map((m) => {
      const original = text.substring(m.offset, m.offset + m.length)
      return {
        original,
        correction: m.replacements[0].value,
        category: mapCategory(m.rule.category.id),
        rationale: m.message,
        confidence: "uncertain" as const,
        position: { offset: m.offset, length: m.length },
      }
    })

  return { errors, detectedLanguage }
}
