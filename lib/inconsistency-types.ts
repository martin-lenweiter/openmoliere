export interface TextSpan {
	text: string;
	offset: number;
	length: number;
}

export interface InconsistencyFix {
	find: string;
	replace: string;
}

export interface Inconsistency {
	category: "logic" | "naming" | "tense" | "formatting" | "capitalization";
	severity: "high" | "low";
	spans: TextSpan[];
	explanation: string;
	suggestion: string;
	fix: InconsistencyFix | null;
}

export interface InconsistencyStats {
	total: number;
	logic: number;
	naming: number;
	tense: number;
	formatting: number;
	capitalization: number;
}

export type InconsistencyStreamEvent =
	| { type: "text"; content: string }
	| {
			type: "result";
			inconsistencies: Inconsistency[];
			stats: InconsistencyStats;
	  }
	| { type: "error"; message: string };
