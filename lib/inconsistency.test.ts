import { describe, expect, it } from "vitest";
import { parseInconsistencyResponse } from "./inconsistency";

describe("parseInconsistencyResponse", () => {
	it("parses a valid response with inconsistencies", () => {
		const response = [
			"Found two inconsistencies.",
			"---INCONSISTENCIES_JSON---",
			JSON.stringify([
				{
					category: "logic",
					severity: "high",
					spans: [
						{ text: "The meeting is on Monday", offset: 0, length: 24 },
						{
							text: "We discussed it on Tuesday before the meeting",
							offset: 50,
							length: 46,
						},
					],
					explanation:
						"The meeting cannot be on Monday if it was discussed on Tuesday before it.",
					suggestion:
						"Clarify whether the meeting is on Monday or after Tuesday.",
					fix: {
						find: "We discussed it on Tuesday before the meeting",
						replace: "We discussed it on Sunday before the meeting",
					},
				},
			]),
		].join("\n");

		const result = parseInconsistencyResponse(response);
		expect(result).toHaveLength(1);
		expect(result[0].category).toBe("logic");
		expect(result[0].severity).toBe("high");
		expect(result[0].spans).toHaveLength(2);
		expect(result[0].spans[0].text).toBe("The meeting is on Monday");
		expect(result[0].explanation).toContain("Monday");
		expect(result[0].fix).toEqual({
			find: "We discussed it on Tuesday before the meeting",
			replace: "We discussed it on Sunday before the meeting",
		});
	});

	it("returns empty array when no delimiter present", () => {
		const response = "Just some text without any delimiter.";
		expect(parseInconsistencyResponse(response)).toEqual([]);
	});

	it("returns empty array for malformed JSON after delimiter", () => {
		const response = "Summary.\n---INCONSISTENCIES_JSON---\n{not valid json";
		expect(parseInconsistencyResponse(response)).toEqual([]);
	});

	it("defaults unknown category to logic", () => {
		const response = [
			"Summary.",
			"---INCONSISTENCIES_JSON---",
			JSON.stringify([
				{
					category: "unknown_category",
					severity: "high",
					spans: [
						{ text: "A", offset: 0, length: 1 },
						{ text: "B", offset: 5, length: 1 },
					],
					explanation: "Conflict",
					suggestion: "Fix it",
					fix: null,
				},
			]),
		].join("\n");

		const result = parseInconsistencyResponse(response);
		expect(result[0].category).toBe("logic");
	});

	it("filters out entries with fewer than 2 spans", () => {
		const response = [
			"Summary.",
			"---INCONSISTENCIES_JSON---",
			JSON.stringify([
				{
					category: "naming",
					severity: "low",
					spans: [{ text: "Only one span", offset: 0, length: 13 }],
					explanation: "Single span",
					suggestion: "N/A",
					fix: null,
				},
				{
					category: "naming",
					severity: "low",
					spans: [
						{ text: "John", offset: 0, length: 4 },
						{ text: "Jon", offset: 20, length: 3 },
					],
					explanation: "Inconsistent name spelling",
					suggestion: "Pick one spelling",
					fix: { find: "Jon", replace: "John" },
				},
			]),
		].join("\n");

		const result = parseInconsistencyResponse(response);
		expect(result).toHaveLength(1);
		expect(result[0].spans).toHaveLength(2);
	});

	it("handles empty JSON array", () => {
		const response =
			"No inconsistencies found.\n---INCONSISTENCIES_JSON---\n[]";
		expect(parseInconsistencyResponse(response)).toEqual([]);
	});

	it("strips markdown code fences from JSON", () => {
		const response = [
			"Summary.",
			"---INCONSISTENCIES_JSON---",
			"```json",
			JSON.stringify([
				{
					category: "naming",
					severity: "low",
					spans: [
						{ text: "John", offset: 0, length: 4 },
						{ text: "Jon", offset: 20, length: 3 },
					],
					explanation: "Inconsistent name",
					suggestion: "Pick one",
					fix: { find: "Jon", replace: "John" },
				},
			]),
			"```",
		].join("\n");

		const result = parseInconsistencyResponse(response);
		expect(result).toHaveLength(1);
		expect(result[0].category).toBe("naming");
	});

	it("defaults missing fields gracefully", () => {
		const response = [
			"Summary.",
			"---INCONSISTENCIES_JSON---",
			JSON.stringify([
				{
					spans: [
						{ text: "A", offset: 0, length: 1 },
						{ text: "B", offset: 5, length: 1 },
					],
				},
			]),
		].join("\n");

		const result = parseInconsistencyResponse(response);
		expect(result[0]).toEqual({
			category: "logic",
			severity: "high",
			spans: [
				{ text: "A", offset: 0, length: 1 },
				{ text: "B", offset: 5, length: 1 },
			],
			explanation: "",
			suggestion: "",
			fix: null,
		});
	});

	it("handles non-array JSON after delimiter", () => {
		const response =
			'Summary.\n---INCONSISTENCIES_JSON---\n{"not": "an array"}';
		expect(parseInconsistencyResponse(response)).toEqual([]);
	});

	it("parses all valid categories", () => {
		const categories = [
			"logic",
			"naming",
			"tense",
			"formatting",
			"capitalization",
		] as const;
		for (const category of categories) {
			const response = [
				"Summary.",
				"---INCONSISTENCIES_JSON---",
				JSON.stringify([
					{
						category,
						severity: "low",
						spans: [
							{ text: "A", offset: 0, length: 1 },
							{ text: "B", offset: 5, length: 1 },
						],
						explanation: "Test",
						suggestion: "Fix",
						fix: null,
					},
				]),
			].join("\n");

			const result = parseInconsistencyResponse(response);
			expect(result[0].category).toBe(category);
		}
	});

	it("parses fix with find and replace", () => {
		const response = [
			"Summary.",
			"---INCONSISTENCIES_JSON---",
			JSON.stringify([
				{
					category: "naming",
					severity: "low",
					spans: [
						{ text: "John", offset: 0, length: 4 },
						{ text: "Jon", offset: 20, length: 3 },
					],
					explanation: "Inconsistent name",
					suggestion: "Pick one",
					fix: { find: "Jon", replace: "John" },
				},
			]),
		].join("\n");

		const result = parseInconsistencyResponse(response);
		expect(result[0].fix).toEqual({ find: "Jon", replace: "John" });
	});

	it("returns null fix when fix is missing or malformed", () => {
		const cases = [
			{ fix: null },
			{ fix: undefined },
			{ fix: "not an object" },
			{ fix: { find: "text" } },
			{ fix: { replace: "text" } },
			{ fix: { find: "", replace: "text" } },
			{ fix: { find: "  ", replace: "text" } },
		];

		for (const testCase of cases) {
			const response = [
				"Summary.",
				"---INCONSISTENCIES_JSON---",
				JSON.stringify([
					{
						category: "logic",
						severity: "high",
						spans: [
							{ text: "A", offset: 0, length: 1 },
							{ text: "B", offset: 5, length: 1 },
						],
						explanation: "Conflict",
						suggestion: "Fix it",
						...testCase,
					},
				]),
			].join("\n");

			const result = parseInconsistencyResponse(response);
			expect(result[0].fix).toBeNull();
		}
	});
});
