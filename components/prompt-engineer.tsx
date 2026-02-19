"use client"

import { useState, useRef, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Check, Copy, Loader2 } from "lucide-react"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { readSSEStream } from "@/lib/sse"
import { QuestionsPanel } from "@/components/questions-panel"
import { TipsPanel } from "@/components/tips-panel"
import type { ClarifyingQuestion, ConversationEntry, PromptEngineerStreamEvent, PromptUseCase } from "@/lib/prompt-engineer-types"

type AppState = "empty" | "ready" | "analyzing" | "results" | "refining" | "error"

const USE_CASES: { value: PromptUseCase; label: string; description: string }[] = [
  { value: "task-prompt", label: "Task Prompt", description: "One-shot instruction for a specific task" },
  { value: "agent-instructions", label: "Agent Instructions", description: "Instructions for an autonomous AI agent (e.g. CLAUDE.md, task briefs)" },
  { value: "system-prompt", label: "System Prompt", description: "Persistent behavior across a conversation" },
]

function splitPromptAndChangelog(text: string): { prompt: string; changelog: string | null } {
  const match = text.match(/\n+-{3,}\n+## What I changed\b/)
  if (!match || match.index === undefined) {
    return { prompt: text, changelog: null }
  }
  const changelogStart = text.indexOf("## What I changed", match.index)
  return {
    prompt: text.substring(0, match.index).trimEnd(),
    changelog: text.substring(changelogStart).trimEnd(),
  }
}

export function PromptEngineer() {
  const [prompt, setPrompt] = useState("")
  const [useCase, setUseCase] = useState<PromptUseCase>("task-prompt")
  const [state, setState] = useState<AppState>("empty")
  const [streamedText, setStreamedText] = useState("")
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [conversation, setConversation] = useState<ConversationEntry[]>([])
  const [round, setRound] = useState(1)
  const [errorMessage, setErrorMessage] = useState("")
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null)
  const { copied, copy } = useCopyToClipboard()
  const abortRef = useRef<AbortController | null>(null)

  const callApi = useCallback(async (conv: ConversationEntry[], promptOverride?: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStreamedText("")
    setQuestions([])
    setAnswers({})
    setErrorMessage("")

    const promptToSend = promptOverride ?? prompt

    try {
      const res = await fetch("/api/prompt-engineer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToSend, useCase, conversation: conv }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }

      for await (const event of readSSEStream<PromptEngineerStreamEvent>(res)) {
        if (event.type === "text") {
          setStreamedText((prev) => prev + event.content)
        } else if (event.type === "result") {
          setQuestions(event.questions)
          setState("results")
        } else if (event.type === "error") {
          throw new Error(event.message)
        }
      }

      setState((s) => (s !== "results" ? "results" : s))
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      setErrorMessage((e as Error).message)
      setState("error")
    }
  }, [prompt, useCase])

  const handleImprove = useCallback(() => {
    if (!prompt.trim()) return
    setState("analyzing")
    setConversation([])
    setRound(1)
    setEditedPrompt(null)
    callApi([])
  }, [prompt, callApi])

  const charCount = prompt.length
  const isOverLimit = charCount > 20000
  const isLoading = state === "analyzing" || state === "refining"
  const { prompt: improvedPrompt, changelog } = splitPromptAndChangelog(streamedText)
  const displayedPrompt = editedPrompt ?? improvedPrompt

  const handleRegenerate = useCallback(() => {
    const newEntries: ConversationEntry[] = questions
      .map((q, i) => ({
        question: q.question,
        answer: (answers[i] ?? "").trim(),
      }))
      .filter((e) => e.answer !== "")

    const nextConv = [...conversation, ...newEntries]
    setConversation(nextConv)
    setRound((r) => r + 1)
    setState("refining")
    setPrompt(displayedPrompt)
    setEditedPrompt(null)
    callApi(nextConv, displayedPrompt)
  }, [questions, answers, conversation, callApi, displayedPrompt])

  const handlePromptChange = (value: string) => {
    setPrompt(value)
    if (state !== "analyzing" && state !== "refining") {
      setState(value.trim() ? "ready" : "empty")
    }
  }

  const handleAnswer = (index: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [index]: value }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Textarea
          placeholder="Paste your prompt here to get an improved version..."
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          rows={8}
          className="resize-y text-base leading-relaxed"
          disabled={isLoading}
        />
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <select
              value={useCase}
              onChange={(e) => setUseCase(e.target.value as PromptUseCase)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-[2px]"
              disabled={isLoading}
            >
              {USE_CASES.map((uc) => (
                <option key={uc.value} value={uc.value}>
                  {uc.label}
                </option>
              ))}
            </select>
            <span className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {charCount.toLocaleString()} / 20,000
            </span>
          </div>
          <Button
            onClick={handleImprove}
            disabled={state === "empty" || isLoading || isOverLimit}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {state === "refining" ? "Regenerating..." : "Improving..."}
              </>
            ) : (
              "Improve"
            )}
          </Button>
        </div>
          <p className="text-xs text-muted-foreground">{USE_CASES.find((uc) => uc.value === useCase)?.description}</p>
        </div>
      </div>

      {state === "error" && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {(isLoading || state === "results") && streamedText && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Improved Prompt</h2>
              <Button variant="ghost" size="sm" onClick={() => copy(displayedPrompt)}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <Card>
              <CardContent className="pt-4">
                {state === "results" ? (
                  <Textarea
                    value={displayedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    className="min-h-[120px] resize-y border-none bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                    rows={displayedPrompt.split("\n").length + 1}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{improvedPrompt}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {changelog && (
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-medium">What I changed</h2>
              <Card>
                <CardContent className="prose prose-sm max-w-none pt-4 dark:prose-invert [&_li]:mb-3 last:[&_li]:mb-0">
                  <ReactMarkdown>{changelog.replace(/^## What I changed\n*/, "")}</ReactMarkdown>
                </CardContent>
              </Card>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {state === "refining" ? "Regenerating prompt..." : "Analyzing prompt..."}
            </div>
          )}

          {state === "results" && (
            <QuestionsPanel
              questions={questions}
              answers={answers}
              onAnswer={handleAnswer}
              onRegenerate={handleRegenerate}
              round={round}
              isRefining={false}
            />
          )}
        </div>
      )}

      <TipsPanel />
    </div>
  )
}
