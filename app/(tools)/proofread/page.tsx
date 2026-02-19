import { Checker } from "@/components/checker"

export default function ProofreadPage() {
  return (
    <>
      <p className="mb-6 text-sm text-foreground">
        AI-powered and rule-based spelling, grammar, and style checker
      </p>
      <Checker />
    </>
  )
}
