import { Badge } from "@/components/ui/badge"
import type { CheckError } from "@/lib/types"

export function ErrorCard({ error }: { error: CheckError }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3 text-sm">
        <span className="line-through text-muted-foreground">{error.original}</span>
        <span className="text-muted-foreground">→</span>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{error.correction}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="text-xs capitalize">
              {error.category}
            </Badge>
            <Badge
              variant={error.confidence === "high" ? "default" : "secondary"}
              className="text-xs"
            >
              {error.confidence === "high" ? "High" : "Uncertain"}
            </Badge>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{error.rationale}</p>
    </div>
  )
}
