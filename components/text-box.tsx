import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export function TextBox({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      className={cn("resize-y pb-4 text-base leading-relaxed", className)}
      {...props}
    />
  )
}
