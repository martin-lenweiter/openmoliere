export const runtime = "nodejs"
export const maxDuration = 30

import { NextRequest } from "next/server"
import { z } from "zod/v4"
import { checkWithClaude, type ParsedClaudeError } from "@/lib/claude"
import { checkWithLanguageTool } from "@/lib/languagetool"
import { mergeErrors } from "@/lib/merge"
import { checkRateLimit } from "@/lib/rate-limit"
import type { CheckError, Stats, StreamEvent } from "@/lib/types"

const requestSchema = z.object({
  text: z.string().min(1, "Text is required").max(10000, "Text must be under 10,000 characters"),
  language: z.string().optional(),
})

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

function computeStats(errors: CheckError[]): Stats {
  return {
    totalErrors: errors.length,
    spelling: errors.filter((e) => e.category === "spelling").length,
    grammar: errors.filter((e) => e.category === "grammar").length,
    style: errors.filter((e) => e.category === "style").length,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const { text, language } = parsed.data

    const ip = getClientIp(req)
    const { allowed } = checkRateLimit(ip)
    if (!allowed) {
      return Response.json(
        { error: "You've reached the daily limit. Try again tomorrow." },
        { status: 429 }
      )
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        function send(event: StreamEvent) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }

        try {
          const ltPromise = checkWithLanguageTool(text, language).catch(() => null)
          const claudeGen = checkWithClaude(text, language)

          let claudeErrors: ParsedClaudeError[] = []
          let claudeCorrectedText = ""
          let detectedLanguage = language ?? "en-US"

          for await (const event of claudeGen) {
            if (event.type === "text") {
              send({ type: "text", content: event.content })
            } else if (event.type === "done") {
              claudeErrors = event.errors
              claudeCorrectedText = event.fullText
              detectedLanguage = event.detectedLanguage
            }
          }

          const ltResult = await ltPromise
          let mergedErrors: CheckError[]

          if (ltResult) {
            mergedErrors = mergeErrors(claudeErrors, ltResult.errors, claudeCorrectedText)
            if (!language) {
              detectedLanguage = detectedLanguage || ltResult.detectedLanguage
            }
          } else {
            mergedErrors = claudeErrors.map((e) => ({ ...e, confidence: "uncertain" as const }))
          }

          const stats = computeStats(mergedErrors)
          send({ type: "result", errors: mergedErrors, language: detectedLanguage, stats })
        } catch (err) {
          const message = err instanceof Error ? err.message : "An unexpected error occurred"
          send({ type: "error", message })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }
}
