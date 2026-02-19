"use client"

import { useState, useRef, useCallback } from "react"
import posthog from "posthog-js"
import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Check, ChevronRight, Copy, Loader2 } from "lucide-react"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { readSSEStream } from "@/lib/sse"
import { QuestionsPanel } from "@/components/questions-panel"
import { TipsPanel } from "@/components/tips-panel"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { ClarifyingQuestion, ConversationEntry, PromptEngineerStreamEvent, PromptUseCase } from "@/lib/prompt-engineer-types"

type AppState = "empty" | "ready" | "analyzing" | "results" | "refining" | "error"

const USE_CASES: { value: PromptUseCase; label: string; description: string }[] = [
  { value: "chatbot-prompt", label: "Chatbot Prompt", description: "A message or instruction you'd send to a chatbot" },
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
  const [useCase, setUseCase] = useState<PromptUseCase>("chatbot-prompt")
  const [state, setState] = useState<AppState>("empty")
  const [streamedText, setStreamedText] = useState("")
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [conversation, setConversation] = useState<ConversationEntry[]>([])
  const [round, setRound] = useState(1)
  const [errorMessage, setErrorMessage] = useState("")
  const [feedback, setFeedback] = useState("")
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [thinkingText, setThinkingText] = useState("")
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const { copied, copy } = useCopyToClipboard()
  const abortRef = useRef<AbortController | null>(null)
  const currentRoundRef = useRef(1)

  const callApi = useCallback(async (conv: ConversationEntry[], promptOverride?: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStreamedText("")
    setThinkingText("")
    setThinkingExpanded(false)
    setQuestions([])
    setAnswers({})
    setFeedback("")
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

      let resultQuestions: ClarifyingQuestion[] = []

      for await (const event of readSSEStream<PromptEngineerStreamEvent>(res)) {
        if (event.type === "thinking") {
          setThinkingText((prev) => prev + event.content)
        } else if (event.type === "text") {
          setStreamedText((prev) => prev + event.content)
        } else if (event.type === "result") {
          resultQuestions = event.questions
          setQuestions(event.questions)
          setState("results")
          posthog.capture("prompt_improve_completed", {
            use_case: useCase,
            round: currentRoundRef.current,
            questions_count: event.questions.length,
            has_questions: event.questions.length > 0,
            prompt_length: promptToSend.length,
          })
        } else if (event.type === "error") {
          throw new Error(event.message)
        }
      }

      setState((s) => (s !== "results" ? "results" : s))
      return resultQuestions
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      const message = (e as Error).message
      setErrorMessage(message)
      setState("error")
      posthog.capture("prompt_improve_failed", {
        error_message: message,
        use_case: useCase,
        round: currentRoundRef.current,
      })
      posthog.captureException(e)
    }
  }, [prompt, useCase])

  const handleImprove = useCallback(() => {
    if (!prompt.trim()) return
    setState("analyzing")
    setConversation([])
    currentRoundRef.current = 1
    setRound(1)
    setEditedPrompt(null)
    setIsEditing(false)
    posthog.capture("prompt_improve_submitted", {
      use_case: useCase,
      prompt_length: prompt.length,
    })
    callApi([])
  }, [prompt, useCase, callApi])

  const charCount = prompt.length
  const isOverLimit = charCount > 20000
  const isLoading = state === "analyzing" || state === "refining"
  const { prompt: improvedPrompt, changelog } = splitPromptAndChangelog(streamedText)
  const displayedPrompt = editedPrompt ?? improvedPrompt
  const promptEditable = state === "results" || changelog !== null

  const handleRegenerate = useCallback(() => {
    const newEntries: ConversationEntry[] = questions
      .map((q, i) => ({
        question: q.question,
        answer: (answers[i] ?? "").trim(),
      }))
      .filter((e) => e.answer !== "")

    if (feedback.trim()) {
      newEntries.push({ question: "Additional feedback from user", answer: feedback.trim() })
    }

    const nextConv = [...conversation, ...newEntries]
    const nextRound = round + 1
    currentRoundRef.current = nextRound
    setConversation(nextConv)
    setRound(nextRound)
    setState("refining")
    setPrompt(displayedPrompt)
    setEditedPrompt(null)
    setIsEditing(false)

    posthog.capture("prompt_regenerated", {
      use_case: useCase,
      round: nextRound,
      questions_answered: newEntries.filter((e) => e.question !== "Additional feedback from user").length,
      has_feedback: feedback.trim().length > 0,
      prompt_length: displayedPrompt.length,
    })

    callApi(nextConv, displayedPrompt)
  }, [questions, answers, feedback, conversation, round, useCase, callApi, displayedPrompt])

  const handlePromptChange = (value: string) => {
    setPrompt(value)
    if (state !== "analyzing" && state !== "refining") {
      setState(value.trim() ? "ready" : "empty")
    }
  }

  const handleAnswer = (index: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [index]: value }))
  }

  const handleCopy = useCallback(() => {
    copy(displayedPrompt)
    posthog.capture("prompt_result_copied", {
      use_case: useCase,
      round,
      prompt_length: displayedPrompt.length,
    })
  }, [copy, displayedPrompt, useCase, round])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Textarea
          placeholder="Paste your prompt here to get an improved version..."
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault()
              handleImprove()
            }
          }}
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
              className={`h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-[2px] ${isLoading ? "pointer-events-none opacity-50" : ""}`}
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
        <Card className="border-destructive py-0">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {(isLoading || (state === "results" && (streamedText || thinkingText))) && (
        <div className="flex flex-col gap-4">
          {(isLoading || thinkingText) && (
            <Collapsible open={thinkingExpanded} onOpenChange={setThinkingExpanded}>
              <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {isLoading && !thinkingExpanded ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {state === "refining" ? "Regenerating prompt..." : "Analyzing prompt..."}
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
                    {isLoading ? (state === "refining" ? "Regenerating prompt..." : "Analyzing prompt...") : "Analysis"}
                  </>
                )}
              </CollapsibleTrigger>
              {thinkingText && (
                <CollapsibleContent>
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-md border p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {thinkingText}
                  </div>
                </CollapsibleContent>
              )}
            </Collapsible>
          )}

          {streamedText && (
          <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Improved Prompt</h2>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
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
            <Card className="py-0">
              <CardContent className="py-4">
                {promptEditable && isEditing ? (
                  <Textarea
                    value={displayedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    autoFocus
                    className="min-h-[120px] resize-y border-none bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                    rows={displayedPrompt.split("\n").length + 1}
                  />
                ) : (
                  <div
                    className={`prose prose-sm max-w-none text-sm leading-loose dark:prose-invert prose-p:my-4 prose-headings:mt-6 prose-headings:mb-3 prose-hr:my-5 prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5 first:[&>*]:mt-0 last:[&>*]:mb-0 ${promptEditable ? "cursor-text" : "cursor-default"}`}
                    onClick={() => promptEditable && setIsEditing(true)}
                  >
                    <ReactMarkdown remarkPlugins={[remarkBreaks]}>{displayedPrompt}</ReactMarkdown>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {changelog && (
            <Collapsible>
              <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
                What I changed
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2 py-0">
                  <CardContent className="prose prose-sm max-w-none py-4 text-sm leading-relaxed dark:prose-invert [&_li]:mb-3 last:[&_li]:mb-0 [&>p+p]:mt-4">
                    <ReactMarkdown>{changelog.replace(/^#{1,3}\s*What I changed\s*\n*/, "").trimStart()}</ReactMarkdown>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}
          </>
          )}

          {state === "results" && (
            <QuestionsPanel
              questions={questions}
              answers={answers}
              feedback={feedback}
              onAnswer={handleAnswer}
              onFeedbackChange={setFeedback}
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
