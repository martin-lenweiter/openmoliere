import { PromptEngineer } from "@/components/prompt-engineer"

export default function PromptEngineerPage() {
  return (
    <>
      <p className="mb-6 text-sm text-foreground">
        Paste a prompt and get an improved version with explanations. The system may ask clarifying questions to refine it further.
      </p>
      <PromptEngineer />
    </>
  )
}
