import { client } from "@/lib/anthropic"

const SYSTEM_PROMPT = `You are a meticulous proofreader and copy editor. Your job is to fix spelling, grammar, and style errors in the provided text.

Rules:
- Fix only clear errors: spelling mistakes, grammatical errors, and obvious style issues
- Preserve the author's voice, tone, and intent completely
- Preserve all original formatting (paragraphs, line breaks, whitespace)
- Do NOT rewrite or rephrase sentences unless there is a clear error
- Do NOT add or remove content
- Be conservative: when in doubt, leave the original text unchanged
- Style fixes should only address objective issues (e.g., "very unique" → "unique"), not subjective preferences

Output format:
1. First, output the fully corrected text (preserving original formatting)
2. Then output exactly this delimiter on its own line: ---ERRORS_JSON---
3. Then output a JSON array of errors. Each error object must have:
   - "original": the original text fragment
   - "correction": what it was changed to
   - "category": one of "spelling", "grammar", or "style"
   - "rationale": one-sentence explanation
   - "position": {"offset": <character offset in original text>, "length": <length of original fragment>}

If the text has no errors, output the original text unchanged, then the delimiter, then an empty JSON array: []

Important: The detected language should be identified and output as a comment before the delimiter:
---LANGUAGE: <language-code>---
---ERRORS_JSON---`

export async function* checkWithClaude(
  text: string,
  language?: string
): AsyncGenerator<{ type: "text"; content: string } | { type: "done"; fullText: string; errors: ParsedClaudeError[]; detectedLanguage: string }> {
  const userMessage = language
    ? `Language: ${language}\n\nText to check:\n${text}`
    : `Detect the language and check the following text:\n\n${text}`

  const stream = client.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  })

  let fullResponse = ""
  let flushed = 0
  let hitDelimiter = false

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullResponse += event.delta.text
      if (hitDelimiter) continue

      // Once we see a full delimiter, flush remaining safe text and stop streaming
      const langIdx = fullResponse.indexOf("---LANGUAGE:")
      const errIdx = fullResponse.indexOf("---ERRORS_JSON---")
      if (langIdx !== -1 || errIdx !== -1) {
        const delimIdx = langIdx !== -1
          ? (errIdx !== -1 ? Math.min(langIdx, errIdx) : langIdx)
          : errIdx
        if (delimIdx > flushed) {
          yield { type: "text", content: fullResponse.substring(flushed, delimIdx).trimEnd() }
        }
        flushed = fullResponse.length
        hitDelimiter = true
        continue
      }

      // Hold back last 20 chars to catch partial delimiters
      const safeEnd = Math.max(flushed, fullResponse.length - 20)
      if (safeEnd > flushed) {
        yield { type: "text", content: fullResponse.substring(flushed, safeEnd) }
        flushed = safeEnd
      }
    }
  }

  const { correctedText, errors, language: detectedLanguage } = parseClaudeResponse(fullResponse)
  yield { type: "done", fullText: correctedText, errors, detectedLanguage }
}

export interface ParsedClaudeError {
  original: string
  correction: string
  category: "spelling" | "grammar" | "style"
  rationale: string
  position: { offset: number; length: number }
}

export function parseClaudeResponse(response: string): {
  correctedText: string
  errors: ParsedClaudeError[]
  language: string
} {
  let language = "en-US"
  let correctedText = response
  let errors: ParsedClaudeError[] = []

  const langMatch = response.match(/---LANGUAGE:\s*([a-zA-Z]+(?:-[a-zA-Z]+)?)\s*---/)
  if (langMatch) {
    language = langMatch[1]
  }

  const delimiterIndex = response.indexOf("---ERRORS_JSON---")
  if (delimiterIndex !== -1) {
    let textPart = response.substring(0, delimiterIndex)
    const langLineMatch = textPart.match(/\n?---LANGUAGE:\s*[a-zA-Z]+(?:-[a-zA-Z]+)?\s*---\s*$/)
    if (langLineMatch) {
      textPart = textPart.substring(0, textPart.length - langLineMatch[0].length)
    }
    correctedText = textPart.trimEnd()

    const jsonPart = response.substring(delimiterIndex + "---ERRORS_JSON---".length).trim()
    try {
      const parsed = JSON.parse(jsonPart)
      if (Array.isArray(parsed)) {
        errors = parsed.map((e) => ({
          original: e.original ?? "",
          correction: e.correction ?? "",
          category: (["spelling", "grammar", "style"].includes(e.category) ? e.category : "grammar") as "spelling" | "grammar" | "style",
          rationale: e.rationale ?? "",
          position: {
            offset: typeof e.position?.offset === "number" ? e.position.offset : 0,
            length: typeof e.position?.length === "number" ? e.position.length : 0,
          },
        }))
      }
    } catch {
      // JSON parse failed — return empty errors
    }
  }

  return { correctedText, errors, language }
}
