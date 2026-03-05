"use client";

import { Check, ChevronRight, Copy, Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { useCallback, useRef, useState } from "react";
import { InconsistencyCard } from "@/components/inconsistency-card";
import { TextBox } from "@/components/text-box";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePersistedState } from "@/hooks/use-persisted-state";
import type {
	Inconsistency,
	InconsistencyStats,
	InconsistencyStreamEvent,
} from "@/lib/inconsistency-types";
import { readSSEStream } from "@/lib/sse";

type AppState = "empty" | "ready" | "scanning" | "results" | "error";

export function InconsistencyChecker() {
	const [text, setText] = usePersistedState("inconsistency-text", "");
	const [state, setState] = useState<AppState>(() =>
		text ? "ready" : "empty",
	);
	const [summary, setSummary] = useState("");
	const [inconsistencies, setInconsistencies] = useState<Inconsistency[]>([]);
	const [stats, setStats] = useState<InconsistencyStats | null>(null);
	const [errorMessage, setErrorMessage] = useState("");
	const [resolvedSet, setResolvedSet] = useState<Set<number>>(new Set());
	const [copied, setCopied] = useState(false);
	const [thinkingText, setThinkingText] = useState("");
	const [thinkingExpanded, setThinkingExpanded] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleScan = useCallback(async () => {
		if (!text.trim()) return;

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setState("scanning");
		setSummary("");
		setInconsistencies([]);
		setStats(null);
		setErrorMessage("");
		setResolvedSet(new Set());
		setThinkingText("");
		setThinkingExpanded(false);

		posthog.capture("inconsistency_scan_submitted", {
			text_length: text.length,
		});

		try {
			const res = await fetch("/api/inconsistency", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text }),
				signal: controller.signal,
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(data?.error ?? `Request failed (${res.status})`);
			}

			for await (const event of readSSEStream<InconsistencyStreamEvent>(res)) {
				if (event.type === "thinking") {
					setThinkingText((prev) => prev + event.content);
				} else if (event.type === "text") {
					setSummary((prev) => prev + event.content);
				} else if (event.type === "result") {
					setInconsistencies(event.inconsistencies);
					setStats(event.stats);
					setState("results");
					posthog.capture("inconsistency_scan_completed", {
						total: event.stats.total,
						logic: event.stats.logic,
						naming: event.stats.naming,
						tense: event.stats.tense,
						formatting: event.stats.formatting,
						capitalization: event.stats.capitalization,
						text_length: text.length,
					});
				} else if (event.type === "error") {
					throw new Error(event.message);
				}
			}

			setState((s) => (s === "scanning" ? "results" : s));
		} catch (e) {
			if ((e as Error).name === "AbortError") return;
			const message = (e as Error).message;
			setErrorMessage(message);
			setState("error");
			posthog.capture("inconsistency_scan_failed", {
				error_message: message,
				text_length: text.length,
			});
			posthog.captureException(e);
		}
	}, [text]);

	const handleTextChange = (value: string) => {
		setText(value);
		if (state !== "scanning") {
			setState(value.trim() ? "ready" : "empty");
		}
	};

	const handleLocate = (index: number) => {
		const item = inconsistencies[index];
		if (!item?.spans[0] || !textareaRef.current) return;
		const span = item.spans[0];

		// Find the span text in the current textarea content
		const pos = text.indexOf(span.text, Math.max(0, span.offset - 50));
		if (pos === -1) return;

		textareaRef.current.focus();
		textareaRef.current.setSelectionRange(pos, pos + span.text.length);
	};

	const handleApply = (index: number) => {
		const item = inconsistencies[index];
		if (!item?.fix) return;

		const pos = text.indexOf(item.fix.find);
		if (pos === -1) return;

		const newText =
			text.slice(0, pos) +
			item.fix.replace +
			text.slice(pos + item.fix.find.length);
		setText(newText);
		setResolvedSet((prev) => new Set(prev).add(index));

		posthog.capture("inconsistency_fix_applied", {
			category: item.category,
			severity: item.severity,
		});
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Fallback for contexts where clipboard API is unavailable
		}
	};

	const charCount = text.length;
	const isOverLimit = charCount > 10000;
	const hasUnresolved = inconsistencies.some((_, i) => !resolvedSet.has(i));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<TextBox
					ref={textareaRef}
					placeholder="Paste your text here to scan for internal inconsistencies..."
					value={text}
					onChange={(e) => handleTextChange(e.target.value)}
					onKeyDown={(e) => {
						if (
							e.key === "Enter" &&
							e.metaKey &&
							text.trim() &&
							state !== "scanning" &&
							!isOverLimit
						) {
							e.preventDefault();
							handleScan();
						}
					}}
					rows={8}
				/>
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<span
							className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}
						>
							{charCount.toLocaleString()} / 10,000
						</span>
						{charCount > 0 && (
							<span className="text-xs text-muted-foreground">Saved</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						{state === "results" && (
							<Button variant="outline" size="sm" onClick={handleCopy}>
								{copied ? (
									<>
										<Check className="h-4 w-4" />
										Copied
									</>
								) : (
									<>
										<Copy className="h-4 w-4" />
										Copy
									</>
								)}
							</Button>
						)}
						<Button
							onClick={handleScan}
							disabled={
								state === "empty" || state === "scanning" || isOverLimit
							}
						>
							{state === "scanning" ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Scanning...
								</>
							) : state === "results" ? (
								"Re-scan"
							) : (
								"Scan"
							)}
						</Button>
					</div>
				</div>
			</div>

			{state === "error" && (
				<Card className="border-destructive py-0">
					<CardContent className="py-4">
						<p className="text-sm text-destructive">{errorMessage}</p>
					</CardContent>
				</Card>
			)}

			{(state === "scanning" || thinkingText) && (
				<Collapsible open={thinkingExpanded} onOpenChange={setThinkingExpanded}>
					<CollapsibleTrigger className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
						{state === "scanning" && !thinkingExpanded ? (
							<>
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Analyzing...
							</>
						) : (
							<>
								<ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
								{state === "scanning" ? "Analyzing..." : "Analysis"}
							</>
						)}
					</CollapsibleTrigger>
					{thinkingText && (
						<CollapsibleContent>
							<div className="mt-2 max-h-64 overflow-y-auto rounded-md border p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
								{thinkingText}
							</div>
						</CollapsibleContent>
					)}
				</Collapsible>
			)}

			{state === "scanning" && !summary && !thinkingText && (
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<div className="h-5 w-24 animate-pulse rounded bg-muted" />
						<Card className="py-0">
							<CardContent className="py-4">
								<div className="space-y-2">
									<div className="h-4 w-full animate-pulse rounded bg-muted" />
									<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
								</div>
							</CardContent>
						</Card>
					</div>
					<div className="flex flex-col gap-2">
						<div className="h-5 w-32 animate-pulse rounded bg-muted" />
						<Card className="py-0">
							<CardContent className="space-y-4 py-4">
								<div className="space-y-2">
									<div className="h-4 w-48 animate-pulse rounded bg-muted" />
									<div className="h-3 w-64 animate-pulse rounded bg-muted" />
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			)}

			{(state === "scanning" || state === "results") && summary && (
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<h2 className="text-sm font-medium">Analysis</h2>
						<Card className="py-0">
							<CardContent className="py-4">
								<p className="whitespace-pre-wrap text-sm leading-relaxed">
									{summary}
								</p>
							</CardContent>
						</Card>
					</div>

					{state === "scanning" && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							Scanning for inconsistencies...
						</div>
					)}

					{state === "results" && stats && (
						<div className="flex flex-col gap-2">
							{inconsistencies.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No inconsistencies found. Your text looks consistent.
								</p>
							) : (
								<>
									<h2 className="text-sm font-medium">
										Inconsistencies
										<span className="ml-2 font-normal text-muted-foreground">
											{[
												stats.logic && `${stats.logic} logic`,
												stats.naming && `${stats.naming} naming`,
												stats.tense && `${stats.tense} tense`,
												stats.formatting && `${stats.formatting} formatting`,
												stats.capitalization &&
													`${stats.capitalization} capitalization`,
											]
												.filter(Boolean)
												.join(", ")}
										</span>
									</h2>
									<Card>
										<CardContent className="pt-4">
											{inconsistencies.map((item, i) => (
												<InconsistencyCard
													key={item.spans.map((s) => s.offset).join("-")}
													inconsistency={item}
													resolved={resolvedSet.has(i)}
													onLocate={() => handleLocate(i)}
													onApply={() => handleApply(i)}
												/>
											))}
										</CardContent>
									</Card>
									{!hasUnresolved && (
										<p className="text-sm text-muted-foreground">
											All fixes applied. Re-scan to verify, or copy your text.
										</p>
									)}
								</>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
