import { forwardRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const TextBox = forwardRef<
	HTMLTextAreaElement,
	React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
	return (
		<Textarea
			ref={ref}
			className={cn("resize-y pb-4 text-base leading-relaxed", className)}
			{...props}
		/>
	);
});
TextBox.displayName = "TextBox";
