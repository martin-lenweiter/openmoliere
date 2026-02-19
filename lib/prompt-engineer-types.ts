export type PromptUseCase = "system-prompt" | "task-prompt" | "agent-instructions"

export interface ClarifyingQuestion {
  question: string
  type: "text" | "choice" | "boolean"
  options?: string[]
  placeholder?: string
}

export interface ConversationEntry {
  question: string
  answer: string
}

export type PromptEngineerStreamEvent =
  | { type: "text"; content: string }
  | { type: "result"; questions: ClarifyingQuestion[] }
  | { type: "error"; message: string }
