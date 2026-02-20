"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { TextBox } from "@/components/text-box"
import { Loader2 } from "lucide-react"
import type { ClarifyingQuestion } from "@/lib/prompt-engineer-types"

interface QuestionsPanelProps {
  questions: ClarifyingQuestion[]
  answers: Record<number, string>
  feedback: string
  onAnswer: (index: number, value: string) => void
  onFeedbackChange: (value: string) => void
  onRegenerate: () => void
  round: number
  isRefining: boolean
}

export function QuestionsPanel({
  questions,
  answers,
  feedback,
  onAnswer,
  onFeedbackChange,
  onRegenerate,
  round,
  isRefining,
}: QuestionsPanelProps) {
  if (round >= 10) {
    return (
      <div className="rounded-md border border-border p-4">
        <p className="text-sm text-muted-foreground">
          Maximum refinement rounds reached. Your prompt is ready!
        </p>
      </div>
    )
  }

  const hasAnswer = Object.values(answers).some((v) => v.trim() !== "") || feedback.trim() !== ""

  return (
    <div className="flex flex-col gap-4">
      {questions.length > 0 && (
      <>
      <h3 className="text-base font-medium">Clarifying Questions</h3>
      <div className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Label className="text-sm">{q.question}</Label>
            {q.type === "text" && (
              <Input
                placeholder={q.placeholder ?? ""}
                value={answers[i] ?? ""}
                onChange={(e) => onAnswer(i, e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault()
                    onRegenerate()
                  }
                }}
              />
            )}
            {q.type === "choice" && q.options && (
              <RadioGroup
                value={answers[i] ?? ""}
                onValueChange={(v) => onAnswer(i, v)}
              >
                {q.options.map((option) => (
                  <div key={option} className="flex items-center gap-2">
                    <RadioGroupItem value={option} id={`q${i}-${option}`} />
                    <Label htmlFor={`q${i}-${option}`} className="font-normal">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
            {q.type === "boolean" && (
              <div className="flex gap-2">
                <Button
                  variant={answers[i] === "Yes" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onAnswer(i, "Yes")}
                >
                  Yes
                </Button>
                <Button
                  variant={answers[i] === "No" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onAnswer(i, "No")}
                >
                  No
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      </>
      )}
      <div className="flex flex-col gap-2">
        <Label className="text-sm">Additional feedback</Label>
        <TextBox
          placeholder="Anything else you'd like to change about the prompt..."
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault()
              onRegenerate()
            }
          }}
          rows={2}
          className="text-sm"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Round {round} of 10
        </span>
        <Button onClick={onRegenerate} disabled={!hasAnswer || isRefining}>
          {isRefining ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            "Regenerate prompt"
          )}
        </Button>
      </div>
    </div>
  )
}
