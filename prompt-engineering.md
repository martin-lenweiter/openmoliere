**A good prompt in 2026 has these elements:**

**1. Clear task definition.** State exactly what you want done. The single highest-impact factor across all studies. Ambiguity is the #1 cause of bad output. "Summarize" is bad. "Extract the 3 key decisions, who owns each, and the deadline" is good.

**2. Output specification.** Format, length, structure, audience, tone. Tell the model what the result looks like. Use structured output modes (JSON schema, tool-calling) in production. This is the highest-leverage, lowest-effort improvement.

**3. Examples (for non-reasoning models).** 2-5 high-quality input/output pairs. Still the single most powerful technique. Schulhoff documented cases going from 0% to 90% accuracy. Quality over quantity. Skip these for reasoning models (o3, extended thinking) where they can hurt.

**4. Relevant context, nothing more.** Provide what the model needs, prune what it doesn't. Signal-to-noise ratio matters. Dumping an entire document when you need one section degrades performance.

**5. Structured formatting.** Use clear delimiters to separate instructions, context, and examples.

**6. Affirmative directives.** Say what to do, not what to avoid. "Write in short sentences" beats "Don't write long paragraphs." Negative instructions still activate the associations you're trying to suppress.

**7. Constraints and boundaries.** Precise, testable constraints. "Respond in under 100 words" is good. "Be concise but thorough" is mush because it's contradictory and unmeasurable.

**8. Model-appropriate strategy.** Standard models: more detail, more examples, explicit reasoning steps. Reasoning models: state the goal, give the constraints, let it figure out how. Don't add chain-of-thought instructions to models that reason natively.

**What doesn't matter (debunked by controlled studies):** persona/role prompting for accuracy, politeness level, emotional appeals ("this is very important to my career"), offering tips, generic "think step by step" on reasoning models.

**One meta-principle:** if a prompt isn't working, edit it and restart the conversation rather than correcting mid-thread. Each correction becomes part of the "wrong" context.