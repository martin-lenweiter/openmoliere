import { PromptEngineer } from "@/components/prompt-engineer";

export default function PromptEngineerPage() {
	return (
		<>
			<p className="mb-6 text-sm text-foreground">
				Improve any prompt with explanations.
			</p>
			<PromptEngineer />
		</>
	);
}
