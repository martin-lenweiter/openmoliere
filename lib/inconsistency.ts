import { client } from "@/lib/anthropic";
import type {
	Inconsistency,
	InconsistencyFix,
} from "@/lib/inconsistency-types";

const CATEGORIES = [
	"logic",
	"naming",
	"tense",
	"formatting",
	"capitalization",
] as const;
type Category = (typeof CATEGORIES)[number];

const SYSTEM_PROMPT = `You are a meticulous editor specializing in detecting internal inconsistencies within text. You do NOT check for spelling, grammar, or style errors — only internal contradictions and conflicts.

Focus areas (in priority order):
1. **Logic**: Contradictions, conflicting claims, impossible timelines, incompatible facts, circular reasoning
2. **Naming**: Same entity referred to by different names, or different entities sharing a name
3. **Tense**: Inconsistent tense usage for the same event or timeframe
4. **Formatting**: Inconsistent formatting patterns (e.g., mixing date formats, number formats, list styles)
5. **Capitalization**: Inconsistent capitalization of the same term

Each inconsistency involves TWO OR MORE conflicting text spans. A single-point issue is not an inconsistency.

Output format:
1. First, output a brief summary of your analysis (2-4 sentences)
2. Then output exactly this delimiter on its own line: ---INCONSISTENCIES_JSON---
3. Then output a JSON array of inconsistencies. Each object must have:
   - "category": one of "logic", "naming", "tense", "formatting", "capitalization"
   - "severity": "high" for logical contradictions and factual conflicts, "low" for surface-level inconsistencies
   - "spans": array of 2+ objects, each with {"text": "<exact quoted text>", "offset": <character offset>, "length": <length>}
   - "explanation": one-sentence description of the conflict
   - "suggestion": one-sentence suggestion for resolution (without picking a side)
   - "fix": an object with {"find": "<exact text to find in the source>", "replace": "<corrected replacement text>"} — pick the contextually correct resolution. The "find" value must be an exact substring of the original text. If the inconsistency requires human judgment and no clear fix exists, set "fix" to null.

If the text has no inconsistencies, output a brief confirmation, then the delimiter, then an empty JSON array: []`;

export async function* scanForInconsistencies(
	text: string,
): AsyncGenerator<
	| { type: "thinking"; content: string }
	| { type: "text"; content: string }
	| { type: "done"; inconsistencies: Inconsistency[] }
> {
	const stream = client.messages.stream({
		model: "claude-sonnet-4-6",
		max_tokens: 8192,
		thinking: { type: "enabled", budget_tokens: 4096 },
		messages: [
			{
				role: "user",
				content: `${SYSTEM_PROMPT}\n\nAnalyze the following text for internal inconsistencies:\n\n${text}`,
			},
		],
	});

	let fullResponse = "";
	let flushed = 0;
	let hitDelimiter = false;

	for await (const event of stream) {
		if (event.type === "content_block_delta") {
			if (event.delta.type === "thinking_delta") {
				yield { type: "thinking", content: event.delta.thinking };
				continue;
			}
			if (event.delta.type !== "text_delta") continue;

			fullResponse += event.delta.text;
			if (hitDelimiter) continue;

			const delimIdx = fullResponse.indexOf("---INCONSISTENCIES_JSON---");
			if (delimIdx !== -1) {
				if (delimIdx > flushed) {
					yield {
						type: "text",
						content: fullResponse.substring(flushed, delimIdx).trimEnd(),
					};
				}
				flushed = fullResponse.length;
				hitDelimiter = true;
				continue;
			}

			// Hold back last 30 chars to catch partial delimiters
			const safeEnd = Math.max(flushed, fullResponse.length - 30);
			if (safeEnd > flushed) {
				yield {
					type: "text",
					content: fullResponse.substring(flushed, safeEnd),
				};
				flushed = safeEnd;
			}
		}
	}

	const inconsistencies = parseInconsistencyResponse(fullResponse);
	yield { type: "done", inconsistencies };
}

function parseFix(raw: unknown): InconsistencyFix | null {
	if (!raw || typeof raw !== "object") return null;
	const obj = raw as Record<string, unknown>;
	if (typeof obj.find !== "string" || typeof obj.replace !== "string")
		return null;
	if (!obj.find.trim()) return null;
	return { find: obj.find, replace: obj.replace };
}

export function parseInconsistencyResponse(response: string): Inconsistency[] {
	const delimiterIndex = response.indexOf("---INCONSISTENCIES_JSON---");
	if (delimiterIndex === -1) return [];

	const jsonPart = response
		.substring(delimiterIndex + "---INCONSISTENCIES_JSON---".length)
		.trim()
		.replace(/^```(?:json)?\s*/, "")
		.replace(/\s*```\s*$/, "");
	try {
		const parsed = JSON.parse(jsonPart);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.map(
				(item): Inconsistency => ({
					category: CATEGORIES.includes(item.category)
						? (item.category as Category)
						: "logic",
					severity: item.severity === "low" ? "low" : "high",
					spans: Array.isArray(item.spans)
						? item.spans.map((s: Record<string, unknown>) => ({
								text: typeof s.text === "string" ? s.text : "",
								offset: typeof s.offset === "number" ? s.offset : 0,
								length: typeof s.length === "number" ? s.length : 0,
							}))
						: [],
					explanation:
						typeof item.explanation === "string" ? item.explanation : "",
					suggestion:
						typeof item.suggestion === "string" ? item.suggestion : "",
					fix: parseFix(item.fix),
				}),
			)
			.filter((item) => item.spans.length >= 2);
	} catch {
		return [];
	}
}
