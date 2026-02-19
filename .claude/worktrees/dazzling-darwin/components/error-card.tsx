import { Badge } from "@/components/ui/badge"
import type { CheckError } from "@/lib/types"

export function ErrorCard({ error }: { error: CheckError }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="line-through text-muted-foreground">{error.original}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium">{error.correction}</span>
        </div>
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
      <p className="text-sm text-muted-foreground">{error.rationale}</p>
    </div>
  )
}
