import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Inconsistency } from "@/lib/inconsistency-types";

export function InconsistencyCard({
	inconsistency,
	resolved,
	onLocate,
	onApply,
}: {
	inconsistency: Inconsistency;
	resolved: boolean;
	onLocate: () => void;
	onApply: () => void;
}) {
	return (
		<div
			className={`border-b border-border py-3 last:border-b-0 ${resolved ? "opacity-50" : ""}`}
		>
			<div className="flex items-baseline justify-between gap-2 text-sm">
				<button
					type="button"
					className="cursor-pointer text-left font-medium"
					onClick={onLocate}
					aria-label="Locate in text"
				>
					{inconsistency.spans.map((span, i) => (
						<span key={span.offset}>
							{i > 0 && (
								<span className="mx-1.5 text-muted-foreground">vs</span>
							)}
							<span className="text-foreground underline decoration-dotted underline-offset-2">
								&ldquo;{span.text}&rdquo;
							</span>
						</span>
					))}
				</button>
				<div className="flex shrink-0 items-center gap-1.5">
					<Badge variant="outline" className="text-xs capitalize">
						{inconsistency.category}
					</Badge>
					<Badge
						variant={
							inconsistency.severity === "high" ? "default" : "secondary"
						}
						className="text-xs capitalize"
					>
						{inconsistency.severity}
					</Badge>
				</div>
			</div>
			<p className="mt-1.5 text-sm text-muted-foreground">
				{inconsistency.explanation}
			</p>
			{inconsistency.fix && !resolved && (
				<div className="mt-2 flex items-center gap-2">
					<span className="text-sm">
						<span className="text-muted-foreground line-through">
							{inconsistency.fix.find}
						</span>
						<span className="mx-1.5 text-muted-foreground">&rarr;</span>
						<span className="font-medium">{inconsistency.fix.replace}</span>
					</span>
					<Button
						variant="outline"
						size="sm"
						className="ml-auto h-7 text-xs"
						onClick={onApply}
					>
						Apply
					</Button>
				</div>
			)}
			{resolved && (
				<div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
					<Check className="h-3.5 w-3.5" />
					Applied
				</div>
			)}
		</div>
	);
}
