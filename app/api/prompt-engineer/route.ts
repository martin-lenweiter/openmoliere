export const runtime = "nodejs"
export const maxDuration = 45

import { NextRequest } from "next/server"
import { z } from "zod/v4"
import { improvePrompt } from "@/lib/prompt-engineer"
import { checkRateLimit } from "@/lib/rate-limit"
import type { PromptEngineerStreamEvent } from "@/lib/prompt-engineer-types"

const conversationEntrySchema = z.object({
  question: z.string(),
  answer: z.string(),
})

const requestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(20000, "Prompt must be under 20,000 characters"),
  useCase: z.enum(["system-prompt", "chatbot-prompt", "agent-instructions"]),
  conversation: z.array(conversationEntrySchema).max(10).default([]),
})

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
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

    const { prompt, useCase, conversation } = parsed.data

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
        function send(event: PromptEngineerStreamEvent) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }

        try {
          const gen = improvePrompt(prompt, useCase, conversation)

          for await (const event of gen) {
            if (event.type === "thinking") {
              send({ type: "thinking", content: event.content })
            } else if (event.type === "text") {
              send({ type: "text", content: event.content })
            } else if (event.type === "done") {
              send({ type: "result", questions: event.questions })
            }
          }
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
