import { Checker } from "@/components/checker";

export default function ProofreadPage() {
	return (
		<>
			<p className="mb-6 text-sm text-foreground">
				Check spelling, grammar, and style.
			</p>
			<Checker />
		</>
	);
}
