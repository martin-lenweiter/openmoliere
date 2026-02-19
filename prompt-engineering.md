1. **Clear task definition.** State exactly what you want done. The single highest-impact factor across all studies. Ambiguity is the #1 cause of bad output. "Summarize" is bad. "Extract the 3 key decisions, who owns each, and the deadline" is good.

2. **Output specification.** Format, length, structure, audience, tone. Tell the model what the result looks like. Use structured output modes (JSON schema, tool-calling) in production. This is the highest-leverage, lowest-effort improvement.

3. **Examples.** 1-3 concrete input/output pairs for format-sensitive tasks (data extraction, classification, style matching). Use examples to show format and style, not to teach reasoning steps. Still the single most powerful technique in the literature for steering output shape.

4. **Relevant context, nothing more.** Provide what the model needs, prune what it doesn't. Signal-to-noise ratio matters. Dumping an entire document when you need one section degrades performance.

5. **Structured formatting.** Use clear delimiters to separate instructions and context.

6. **Affirmative directives for desired behavior, negative constraints for guardrails.** Describe what you want in positive terms ("Write in short sentences") rather than negatives ("Don't write long paragraphs"). But boundaries and safety rails are fine as negatives ("Do not include PII", "Never output markdown").

7. **Constraints and boundaries.** Precise, testable constraints. "Respond in under 100 words" is good. "Be concise but thorough" is mush because it's contradictory and unmeasurable.

8. **One task per prompt.** If a prompt requires the model to do multiple complex things (research, then analyze, then format, then critique), break it into separate steps. Chained simple prompts consistently outperform monolithic complex ones.

**What doesn't matter** (debunked by controlled studies): persona/role prompting for accuracy, politeness level, emotional appeals ("this is very important to my career"), offering tips, generic "think step by step" as a universal booster.

**Meta-principle:** if a prompt isn't working, edit it and restart the conversation rather than correcting mid-thread. Each correction becomes part of the "wrong" context.