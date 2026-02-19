"use client"

import { ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

const TIPS = [
  {
    title: "Clear Task Definition",
    body: "State exactly what you want done. \"Summarize\" is vague. \"Extract the 3 key decisions, who owns each, and the deadline\" is specific.",
  },
  {
    title: "Output Specification",
    body: "Define format, length, structure, audience, and tone. Use structured output modes (JSON schema, tool-calling) in production.",
  },
  {
    title: "Examples (1-3 pairs)",
    body: "Concrete input/output pairs for format-sensitive tasks. Use examples to show format and style, not to teach reasoning.",
  },
  {
    title: "Relevant Context Only",
    body: "Context matters enormously — it's often the difference between a generic and a great response. Give as much context as needed, but no more. Signal-to-noise ratio matters — dumping an entire document degrades performance.",
  },
  {
    title: "Structured Formatting",
    body: "Use clear delimiters to separate instructions from context. XML tags, markdown headers, and numbered sections all work well.",
  },
  {
    title: "Affirmative Directives",
    body: "Describe what you want in positive terms (\"Write in short sentences\"). Use negatives only for guardrails (\"Do not include PII\").",
  },
  {
    title: "Precise Constraints",
    body: "\"Respond in under 100 words\" is testable. \"Be concise but thorough\" is contradictory and unmeasurable.",
  },
  {
    title: "One Task Per Prompt",
    body: "If a prompt requires multiple complex things, break it into separate steps. Chained simple prompts outperform monolithic complex ones.",
  },
]

export function TipsPanel() {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-2 text-lg font-medium transition-colors [&[data-state=open]>svg]:rotate-180">
        Prompt Engineering Tips
        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 flex flex-col gap-3">
          {TIPS.map((tip, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{i + 1}. {tip.title}.</span>{" "}
              <span className="text-muted-foreground">{tip.body}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
