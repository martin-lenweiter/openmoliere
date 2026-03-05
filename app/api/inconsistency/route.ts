export const runtime = "nodejs";
export const maxDuration = 60;

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { scanForInconsistencies } from "@/lib/inconsistency";
import type {
	Inconsistency,
	InconsistencyStats,
	InconsistencyStreamEvent,
} from "@/lib/inconsistency-types";
import { getPostHogClient } from "@/lib/posthog-server";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
	text: z
		.string()
		.trim()
		.min(1, "Text is required")
		.max(10000, "Text must be under 10,000 characters"),
});

function getClientIp(req: NextRequest): string {
	return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function computeStats(inconsistencies: Inconsistency[]): InconsistencyStats {
	return {
		total: inconsistencies.length,
		logic: inconsistencies.filter((i) => i.category === "logic").length,
		naming: inconsistencies.filter((i) => i.category === "naming").length,
		tense: inconsistencies.filter((i) => i.category === "tense").length,
		formatting: inconsistencies.filter((i) => i.category === "formatting")
			.length,
		capitalization: inconsistencies.filter(
			(i) => i.category === "capitalization",
		).length,
	};
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = requestSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json(
				{ error: parsed.error.issues[0]?.message ?? "Invalid input" },
				{ status: 400 },
			);
		}

		const { text } = parsed.data;

		const ip = getClientIp(req);
		const { allowed } = checkRateLimit(ip);
		if (!allowed) {
			const posthog = getPostHogClient();
			posthog.capture({
				distinctId: ip,
				event: "api_inconsistency_rate_limited",
				properties: { text_length: text.length },
			});
			return Response.json(
				{ error: "You've reached the daily limit. Try again tomorrow." },
				{ status: 429 },
			);
		}

		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				function send(event: InconsistencyStreamEvent) {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
					);
				}

				try {
					const gen = scanForInconsistencies(text);

					let inconsistencies: Inconsistency[] = [];

					for await (const event of gen) {
						if (event.type === "thinking") {
							send({ type: "thinking", content: event.content });
						} else if (event.type === "text") {
							send({ type: "text", content: event.content });
						} else if (event.type === "done") {
							inconsistencies = event.inconsistencies;
						}
					}

					const stats = computeStats(inconsistencies);
					send({ type: "result", inconsistencies, stats });

					const posthog = getPostHogClient();
					posthog.capture({
						distinctId: ip,
						event: "api_inconsistency_completed",
						properties: {
							total_inconsistencies: stats.total,
							logic: stats.logic,
							naming: stats.naming,
							tense: stats.tense,
							formatting: stats.formatting,
							capitalization: stats.capitalization,
							text_length: text.length,
						},
					});
				} catch (err) {
					const message =
						err instanceof Error ? err.message : "An unexpected error occurred";
					send({ type: "error", message });
				} finally {
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	} catch {
		return Response.json({ error: "Invalid request body" }, { status: 400 });
	}
}
