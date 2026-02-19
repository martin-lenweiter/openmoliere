import { client } from "@/lib/anthropic"
import type { PromptUseCase, ClarifyingQuestion, ConversationEntry } from "@/lib/prompt-engineer-types"

const USE_CASE_SECTIONS: Record<PromptUseCase, string> = {
  "system-prompt": `The user is writing a **system prompt** — persistent behavioral instructions for an AI assistant across an entire conversation.
Focus areas: behavior specification, guardrails, persona definition, output format, tone and style constraints, edge case handling.`,
  "task-prompt": `The user is writing a **task prompt** — a one-shot instruction for a specific task.
Focus areas: task clarity, input/output examples, constraints, success criteria, expected format.`,
  "agent-instructions": `The user is writing **agent instructions** — instructions for an autonomous AI agent that uses tools and executes multi-step workflows.
Focus areas: tool usage guidelines, decision-making criteria, error handling, multi-step planning, when to escalate vs. proceed autonomously.`,
}

function buildSystemPrompt(useCase: PromptUseCase): string {
  return `You are an expert prompt engineer. Your job is to take a user's prompt and produce a significantly improved version based on proven prompt engineering principles.

## Principles to apply

1. **Clear task definition.** State exactly what you want done. Ambiguity is the #1 cause of bad output.
2. **Output specification.** Format, length, structure, audience, tone. Tell the model what the result looks like.
3. **Examples.** 1-3 concrete input/output pairs for format-sensitive tasks. Use examples to show format and style, not to teach reasoning steps.
4. **Relevant context, nothing more.** Provide what the model needs, prune what it doesn't. Signal-to-noise ratio matters.
5. **Structured formatting.** Use clear delimiters to separate instructions and context.
6. **Affirmative directives for desired behavior, negative constraints for guardrails.** Describe what you want in positive terms. Use negatives only for boundaries and safety rails.
7. **Precise constraints.** Testable constraints like "Respond in under 100 words" — not vague mush like "Be concise but thorough."
8. **One task per prompt.** If a prompt requires multiple complex things, break it into separate steps.

## Use case context

${USE_CASE_SECTIONS[useCase]}

## Instructions

- Analyze the user's prompt against the principles above
- Produce an improved version that follows these principles
- Generate a markdown changelog section explaining what you changed and why
- If the prompt is vague or missing critical information, generate up to 3 clarifying questions. If clear enough, skip questions entirely.
- Always produce a usable improved prompt each round. Handle missing information with explicit assumptions noted in the changelog.
- Do NOT add generic boilerplate. Every addition must serve a specific purpose for this prompt.

## Output format

Output the improved prompt text, then a changelog, then optionally a questions JSON block. Use this exact format:

[The improved prompt text — output it directly, no wrapping in code blocks]

---

## What I changed

- **[Change description]:** [Rationale for the change]
- **[Change description]:** [Rationale for the change]
---QUESTIONS_JSON---
[JSON array of ClarifyingQuestion objects, each with: question (string), type ("text" | "choice" | "boolean"), options (string[] for choice type only), placeholder (string for text type only)]

If there are no questions, omit the ---QUESTIONS_JSON--- delimiter and everything after it.`
}

function buildMessages(
  prompt: string,
  useCase: PromptUseCase,
  conversation: ConversationEntry[]
): Array<{ role: "user" | "assistant"; content: string }> {
  if (conversation.length === 0) {
    return [{ role: "user", content: `Improve this ${useCase.replace(/-/g, " ")}:\n\n${prompt}` }]
  }

  const qaBlock = conversation
    .map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`)
    .join("\n\n")

  return [
    {
      role: "user",
      content: `Improve this ${useCase.replace(/-/g, " ")}:\n\n${prompt}\n\nThe user has provided the following clarifications:\n\n${qaBlock}\n\nIncorporate these answers into the improved prompt. Continue asking questions if there are still gaps, or omit questions if the prompt is now complete.`,
    },
  ]
}

export async function* improvePrompt(
  prompt: string,
  useCase: PromptUseCase,
  conversation: ConversationEntry[]
): AsyncGenerator<
  | { type: "text"; content: string }
  | { type: "done"; fullText: string; questions: ClarifyingQuestion[] }
> {
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: buildSystemPrompt(useCase),
    messages: buildMessages(prompt, useCase, conversation),
  })

  let fullResponse = ""
  let flushed = 0
  let hitDelimiter = false

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullResponse += event.delta.text
      if (hitDelimiter) continue

      const delimIdx = fullResponse.indexOf("---QUESTIONS_JSON---")
      if (delimIdx !== -1) {
        if (delimIdx > flushed) {
          yield { type: "text", content: fullResponse.substring(flushed, delimIdx).trimEnd() }
        }
        flushed = fullResponse.length
        hitDelimiter = true
        continue
      }

      // Hold back last 25 chars to catch partial delimiter
      const safeEnd = Math.max(flushed, fullResponse.length - 25)
      if (safeEnd > flushed) {
        yield { type: "text", content: fullResponse.substring(flushed, safeEnd) }
        flushed = safeEnd
      }
    }
  }

  // Flush any remaining text before delimiter
  if (!hitDelimiter && flushed < fullResponse.length) {
    yield { type: "text", content: fullResponse.substring(flushed) }
  }

  const { fullText, questions } = parsePromptEngineerResponse(fullResponse)
  yield { type: "done", fullText, questions }
}

export function parsePromptEngineerResponse(response: string): {
  fullText: string
  questions: ClarifyingQuestion[]
} {
  const delimIdx = response.indexOf("---QUESTIONS_JSON---")

  if (delimIdx === -1) {
    return { fullText: response.trimEnd(), questions: [] }
  }

  const fullText = response.substring(0, delimIdx).trimEnd()
  const jsonPart = response.substring(delimIdx + "---QUESTIONS_JSON---".length).trim()

  let questions: ClarifyingQuestion[] = []

  try {
    const parsed = JSON.parse(jsonPart)
    if (Array.isArray(parsed)) {
      questions = parsed
        .slice(0, 3)
        .filter((q): q is Record<string, unknown> => q && typeof q === "object" && typeof q.question === "string")
        .map((q) => ({
          question: q.question as string,
          type: (["text", "choice", "boolean"].includes(q.type as string) ? q.type : "text") as ClarifyingQuestion["type"],
          ...(Array.isArray(q.options) ? { options: q.options as string[] } : {}),
          ...(typeof q.placeholder === "string" ? { placeholder: q.placeholder } : {}),
        }))
    }
  } catch {
    // JSON parse failed — return no questions
  }

  return { fullText, questions }
}
