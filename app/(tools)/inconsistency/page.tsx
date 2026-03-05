import { InconsistencyChecker } from "@/components/inconsistency-checker";

export default function InconsistencyPage() {
	return (
		<>
			<p className="mb-6 text-sm text-foreground">
				Find contradictions in your text.
			</p>
			<InconsistencyChecker />
		</>
	);
}
