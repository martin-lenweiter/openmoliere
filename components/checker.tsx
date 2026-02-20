"use client"

import { useState, useRef, useCallback } from "react"
import posthog from "posthog-js"
import { Button } from "@/components/ui/button"
import { TextBox } from "@/components/text-box"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorCard } from "@/components/error-card"
import { Check, Copy, Loader2 } from "lucide-react"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { readSSEStream } from "@/lib/sse"
import type { CheckError, Stats, StreamEvent } from "@/lib/types"

type AppState = "empty" | "ready" | "checking" | "results" | "error"

const LANGUAGES = [
  { value: "", label: "Auto-detect" },
  { value: "nl", label: "Dutch" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "fr", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "es", label: "Spanish" },
]

const LANGUAGE_NAMES: Record<string, string> = {
  "nl": "Dutch", "nl-NL": "Dutch",
  "en": "English", "en-US": "English (US)", "en-GB": "English (UK)",
  "fr": "French", "fr-FR": "French",
  "de": "German", "de-DE": "German", "de-AT": "German (AT)", "de-CH": "German (CH)",
  "es": "Spanish", "es-ES": "Spanish",
}

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? LANGUAGE_NAMES[code.split("-")[0]] ?? code
}

export function Checker() {
  const [text, setText] = useState("")
  const [language, setLanguage] = useState("")
  const [state, setState] = useState<AppState>("empty")
  const [correctedText, setCorrectedText] = useState("")
  const [errors, setErrors] = useState<CheckError[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [detectedLanguage, setDetectedLanguage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const { copied, copy } = useCopyToClipboard()
  const abortRef = useRef<AbortController | null>(null)

  const handleCheck = useCallback(async () => {
    if (!text.trim()) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState("checking")
    setCorrectedText("")
    setErrors([])
    setStats(null)
    setErrorMessage("")

    posthog.capture("proofread_check_submitted", {
      language: language || "auto",
      text_length: text.length,
    })

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: language || undefined }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }

      for await (const event of readSSEStream<StreamEvent>(res)) {
        if (event.type === "text") {
          setCorrectedText((prev) => prev + event.content)
        } else if (event.type === "result") {
          setCorrectedText(event.correctedText)
          setErrors(event.errors)
          setStats(event.stats)
          setDetectedLanguage(event.language)
          setState("results")
          posthog.capture("proofread_check_completed", {
            language: language || "auto",
            detected_language: event.language,
            total_errors: event.stats.totalErrors,
            spelling_errors: event.stats.spelling,
            grammar_errors: event.stats.grammar,
            style_errors: event.stats.style,
            has_errors: event.stats.totalErrors > 0,
            text_length: text.length,
          })
        } else if (event.type === "error") {
          throw new Error(event.message)
        }
      }

      setState((s) => (s === "checking" ? "results" : s))
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      const message = (e as Error).message
      setErrorMessage(message)
      setState("error")
      posthog.capture("proofread_check_failed", {
        error_message: message,
        language: language || "auto",
        text_length: text.length,
      })
      posthog.captureException(e)
    }
  }, [text, language])

  const handleCopy = useCallback(async () => {
    await copy(correctedText)
    posthog.capture("proofread_result_copied", {
      text_length: correctedText.length,
    })
  }, [correctedText, copy])

  const handleTextChange = (value: string) => {
    setText(value)
    if (state !== "checking") {
      setState(value.trim() ? "ready" : "empty")
    }
  }

  const charCount = text.length
  const isOverLimit = charCount > 10000

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <TextBox
          placeholder="Paste your text here to check for spelling, grammar, and style errors..."
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey && text.trim() && state !== "checking" && !isOverLimit) {
              e.preventDefault()
              handleCheck()
            }
          }}
          rows={8}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-[2px]"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <span className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {charCount.toLocaleString()} / 10,000
            </span>
          </div>
          <Button
            onClick={handleCheck}
            disabled={state === "empty" || state === "checking" || isOverLimit}
          >
            {state === "checking" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              "Check"
            )}
          </Button>
        </div>
      </div>

      {state === "error" && (
        <Card className="border-destructive py-0">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {(state === "checking" || state === "results") && correctedText && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">
                Corrected Text
                {detectedLanguage && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    ({getLanguageName(detectedLanguage)})
                  </span>
                )}
              </h2>
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
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{correctedText}</p>
              </CardContent>
            </Card>
          </div>

          {state === "checking" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing errors...
            </div>
          )}

          {state === "results" && stats && (
            <div className="flex flex-col gap-2">
              {errors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No issues found. Your text looks great.
                </p>
              ) : (
                <>
                  <h2 className="text-sm font-medium">
                    Changes
                    <span className="ml-2 font-normal text-muted-foreground">
                      {[
                        stats.spelling && `${stats.spelling} spelling`,
                        stats.grammar && `${stats.grammar} grammar`,
                        stats.style && `${stats.style} style`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </h2>
                  <Card>
                    <CardContent className="pt-4">
                      {errors.map((error, i) => (
                        <ErrorCard key={i} error={error} />
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
