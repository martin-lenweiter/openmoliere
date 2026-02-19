# Spec: Prompt Engineer LLM Quality Improvements

## Overview

The prompt engineer feature works well but suffers from inconsistent behavior: clarifying questions sometimes miss the biggest information gaps in the user's prompt, and improved prompts are occasionally overengineered (inflated scope, unnecessary structure, invented constraints, unneeded examples). This spec addresses both issues through better system prompt design, extended thinking for internal reasoning, and a new "analysis" UI element.

## Goals

- **Consistent question quality**: Clarifying questions should reliably target the largest information gaps in the prompt, not surface-level details
- **Right-sized improvements**: The improved prompt should match the complexity of the input — simple prompts stay simple, complex prompts get comprehensive treatment
- **Visible reasoning**: Show users the model's gap analysis in a collapsible "thinking" block so they understand the improvement strategy
- **Eliminate overengineering anti-patterns**: Stop the model from inflating scope, over-structuring, adding unnecessary examples, and inventing constraints

## Non-Goals

- Proofreader feature changes (out of scope)
- Changing the model (stay on Claude Sonnet 4.6)
- Adjusting temperature (fix via prompting, not parameters)
- Adding few-shot examples to the system prompt
- Changing the question type system (text/choice/boolean works well)
- Adding new use case categories (current three are sufficient)
- A/B testing infrastructure

## User Stories

1. **As a user submitting a vague prompt**, I want the first clarifying question to ask about the most impactful unknown (core purpose, domain, key constraint) rather than surface details (tone, format).

2. **As a user submitting a simple chatbot prompt**, I want the improved version to remain simple — not bloated with XML delimiters, example blocks, and edge case handling I didn't ask for.

3. **As a user reviewing an improvement**, I want to see a collapsible "analysis" block showing what gaps the model identified, so I understand why it made the changes it did.

4. **As a user in a refinement round**, I want the model to incorporate my answers without re-introducing overengineering that I didn't ask for.

## Technical Requirements

### 1. Enable Extended Thinking

Enable Claude's extended thinking feature on the prompt engineer API call. This gives the model a structured reasoning step before generating output.

**Implementation:**
- Add `thinking: { type: "enabled", budget_tokens: 4096 }` to the `client.messages.stream()` call in `improvePrompt()`
- Extended thinking requires `max_tokens` to be at least `budget_tokens + 1`, so keep `max_tokens: 8192`
- The thinking content comes as `thinking` blocks in the stream, before `text` blocks

**Streaming changes:**
- Detect `thinking` block events in the stream
- Yield thinking content as a new event type: `{ type: "thinking", content: string }`
- Continue yielding `text` events for the actual output as before
- The thinking block streams before text output, creating a natural "analyzing → generating" flow

### 2. Revise the System Prompt

Replace the current system prompt with one that:

#### a) Makes principles conditional
Instead of "Principles to apply" (implying apply all), reframe as "Principles to consider." Add explicit guidance:

> Apply a principle only when it genuinely improves this specific prompt. A simple prompt that needs only task clarity should not get examples, structured delimiters, or constraint lists bolted on. Match improvement intensity to the prompt's actual complexity and gaps.

#### b) Add explicit anti-patterns
Expand the anti-pattern list based on observed bad behavior:

- Do NOT inflate scope — don't add handling for edge cases, scenarios, or inputs the user didn't mention
- Do NOT over-structure — don't add XML delimiters, numbered sections, or markdown headers to a prompt that works fine as plain text
- Do NOT add examples unless the task genuinely benefits from demonstration (e.g., specific output format that's hard to describe)
- Do NOT invent constraints the user didn't state or imply
- Do NOT restructure a prompt that's already well-organized — improve the weak parts, leave the strong parts alone
- Preserve the author's voice and intent. You're improving, not rewriting.

#### c) Improve question generation guidance
Replace the current "generate 2-3 clarifying questions" with more nuanced guidance:

> Generate 2-3 clarifying questions that target the largest information gaps in this prompt. Ask about things that would most change the output if answered — core purpose, domain specifics, key constraints, intended audience. Do not ask about surface details (tone, format, style) when the fundamental purpose or context is unclear. Rank questions by information value: the first question should address the single biggest unknown.

#### d) Keep the thinking/analysis instruction
Add instruction for the model's extended thinking:

> Before improving the prompt, think through: What are the biggest gaps or weaknesses in this prompt? Which principles genuinely apply here? What would be the highest-value questions to ask? Use this analysis to guide both your improvements and your questions.

### 3. New Stream Event: Thinking

Add a `thinking` event type to the streaming protocol.

**Type addition** (`prompt-engineer-types.ts`):
```typescript
export type PromptEngineerStreamEvent =
  | { type: "thinking"; content: string }
  | { type: "text"; content: string }
  | { type: "result"; questions: ClarifyingQuestion[] }
  | { type: "error"; message: string }
```

**Generator changes** (`prompt-engineer.ts`):
- Yield `{ type: "thinking", content: string }` for thinking block deltas
- Include thinking summary in the `done` event: `{ type: "done"; thinking: string; fullText: string; questions: ClarifyingQuestion[] }`

**API route changes** (`api/prompt-engineer/route.ts`):
- Forward `thinking` events through SSE like text events

### 4. UI: Collapsible Thinking Block

Add a collapsible "Analysis" block above the improved prompt output, styled like Claude's thinking UI.

**Behavior:**
- While thinking is streaming: show expanded with animated indicator (e.g., pulsing dot or shimmer)
- After thinking completes and text starts streaming: auto-collapse
- User can toggle open/closed at any time
- Render thinking content as plain text (it's internal reasoning, not formatted output)

**Design:**
- Collapsed: single line like `▶ Analysis` or `▶ Thinking...` with a subtle border
- Expanded: shows the thinking text in a muted/secondary style (smaller font, lighter color) to visually distinguish from the actual output
- No changes to the changelog section — it stays as-is below the improved prompt

### 5. SSE Client Changes

Update the SSE reader in the prompt engineer component to handle the new `thinking` event type:
- Accumulate thinking content in state
- Stream it into the collapsible block in real-time
- When the first `text` event arrives, auto-collapse the thinking block

## Data Model

No database changes. The thinking content is ephemeral — displayed during the session but not persisted or sent back in refinement rounds.

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Extended thinking takes too long | The existing streaming UI handles this naturally — user sees "Analyzing..." with content appearing. No timeout needed beyond the existing API timeout. |
| Thinking produces empty content | Hide the analysis block entirely if no thinking content is received |
| Model ignores anti-pattern instructions | This is the core problem we're solving. If the new prompt still overengineers, the fix is to iterate on the system prompt wording — not to add code guardrails. |
| Thinking content is very long | Cap display at a reasonable height with scroll, or truncate with "show more" |
| Streaming interruption mid-thinking | Same as current: AbortController stops fetch, UI resets |
| Refinement rounds | Thinking should happen on every round, not just round 1. Each round gets its own analysis. |

## Open Questions

1. **Thinking budget**: 4096 tokens is a starting point. May need tuning — too low and the model can't reason properly, too high and it wastes time on simple prompts. Monitor and adjust.
2. **Thinking in refinement context**: Should previous thinking be included in the conversation history for refinement rounds? Initial recommendation: no, keep it ephemeral.
3. **Cost impact**: Extended thinking adds token usage. Monitor cost per request after deployment.

## Dependencies

- Claude API extended thinking support (already available on Sonnet 4.6)
- No new packages or external dependencies needed

## Success Metrics

- Qualitative evaluation over several days of use:
  - Questions consistently target the biggest information gaps
  - Improved prompts match the complexity of the input (simple stays simple)
  - All four anti-patterns (scope inflation, over-structuring, unnecessary examples, invented constraints) are rare or absent
  - The analysis block provides useful insight into the model's reasoning
