export interface CheckRequest {
  text: string
  language?: string
}

export interface CheckError {
  original: string
  correction: string
  category: "spelling" | "grammar" | "style"
  rationale: string
  confidence: "high" | "uncertain"
  position: {
    offset: number
    length: number
  }
}

export interface Stats {
  totalErrors: number
  spelling: number
  grammar: number
  style: number
}

export type StreamEvent =
  | { type: "text"; content: string }
  | { type: "result"; errors: CheckError[]; language: string; stats: Stats }
  | { type: "error"; message: string }
