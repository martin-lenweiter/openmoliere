# Spec: Prompt Engineer Feature (v2 — MVP)

## Overview

Add a Prompt Engineer tool to OpenMoliere as a second top-level feature alongside the existing proofreader. Users submit a prompt, select a use case type, and receive an immediately improved version plus a changelog explaining what was changed and why. The tool surfaces clarifying questions; users answer at their own pace and regenerate on demand. A static tips panel provides a reference cheat sheet. The app transitions from a single-page tool to a multi-route application with shared layout and tab navigation.

## Goals

- Users can paste any prompt and get a meaningfully improved version in seconds
- The tool identifies what's missing or unclear and asks targeted questions to fill gaps
- Users learn prompt engineering principles through the tips panel and changelog explanations
- The feature feels native to the existing app — same streaming UX, same minimalist design
- Shared UI is extracted so both tools benefit from a common foundation

## Non-Goals

- No prompt library/marketplace — no saving, sharing, or browsing prompts
- Not a chat interface — this is a tool, not a conversation
- No model-specific optimization — prompts should be model-agnostic
- No prompt versioning or history across sessions
- No user accounts or persistent storage

## Requirements

1. **Prompt improvement:** User pastes a prompt and receives an improved version with a changelog of what was changed and why.
2. **Clarifying questions:** If the prompt is vague or missing critical information, the model asks up to 3 clarifying questions alongside the improved prompt. If the prompt is clear enough, it skips questions entirely.
3. **Iterative refinement:** After answering questions, the user clicks "Regenerate" to get an updated prompt. The model may return further questions or skip them. Hard cap at 10 rounds.
4. **Changelog:** Every generated/regenerated prompt includes a visible changelog explaining what was changed and why. Rendered as markdown, not structured data.
5. **Use case selector:** Dropdown with three options, defaulting to "Task Prompt." Each option has a tooltip:
   - **Task Prompt** (default) — "A one-shot instruction for a specific task, e.g. summarize this article, translate this text, extract data from this document."
   - **Agent Instructions** — "Instructions for an autonomous AI agent that uses tools, makes decisions, and executes multi-step workflows."
   - **System Prompt** — "Persistent behavioral instructions that define how an AI assistant should act across an entire conversation, e.g. tone, persona, guardrails."
6. **Tips panel:** A collapsible section with prompt engineering best practices sourced from `prompt-engineering.md`, collapsed by default.
7. **Backward compatibility:** The existing proofreader continues to work at `/proofread`. `/` redirects there.

## Technical Requirements

### Route Structure

```
/                          → redirect to /proofread
/proofread                 → existing proofreader (moved from /)
/prompt-engineer           → new prompt engineer tool
```

Use Next.js App Router layout nesting:
- `/app/layout.tsx` — root layout (fonts, metadata, global styles)
- `/app/(tools)/layout.tsx` — shared tool layout (header, tab navigation, footer)
- `/app/(tools)/proofread/page.tsx` — proofreader page
- `/app/(tools)/prompt-engineer/page.tsx` — prompt engineer page
- `/app/page.tsx` — redirect to `/proofread`

### API Endpoint

#### POST `/api/prompt-engineer`

Single endpoint for both initial analysis and refinement. When `conversation` is empty, it's a first pass. When populated, it's a refinement round.

**Request:**
```typescript
{
  prompt: string                    // 1–20,000 characters
  useCase: "system-prompt" | "task-prompt" | "agent-instructions"
  conversation: ConversationEntry[] // Empty array on first call
}
```

**Response:** SSE stream with events:
```typescript
// Improved prompt + changelog stream in chunks (markdown)
{ type: "text", content: string }

// Structured questions when stream completes
{
  type: "result",
  questions: ClarifyingQuestion[]
}

// Error
{ type: "error", message: string }
```

### Data Model

```typescript
type PromptUseCase = "system-prompt" | "task-prompt" | "agent-instructions"

// Clarifying question with structured input
interface ClarifyingQuestion {
  question: string                  // The question text
  type: "text" | "choice" | "boolean"
  options?: string[]                // For "choice" type only
  placeholder?: string              // For "text" type only
}

// Conversation history entry
interface ConversationEntry {
  question: string
  answer: string
}
```

### Claude Integration

**Model:** Claude Sonnet 4.6 (`claude-sonnet-4-6`)

**System prompt responsibilities:**
- Analyze the user's prompt against the principles in `prompt-engineering.md`
- Produce an improved version that follows those principles
- Generate a markdown changelog section explaining what was changed and why
- If the prompt is vague or missing critical information, generate up to 3 clarifying questions with appropriate input types. If the prompt is clear enough, return no questions.
- Adapt behavior based on the selected use case:
  - **System prompt:** Focus on behavior specification, guardrails, persona definition, output format
  - **Task prompt:** Focus on task clarity, input/output examples, constraints, success criteria
  - **Agent instructions:** Focus on tool usage, decision-making criteria, error handling, multi-step planning
- Always generate a usable improved prompt each round (never "questions only"). Missing information should be handled via explicit assumptions noted in the changelog.

**Output format:**

The streamed text contains the improved prompt followed by the changelog in markdown. After the stream completes, questions are sent as a structured JSON event.

```
[Improved prompt text]

---

## What I changed

- **[Change description]:** [Rationale for the change]
- **[Change description]:** [Rationale for the change]
- ...
---QUESTIONS_JSON---
[JSON array of ClarifyingQuestion]
```

The client splits on `---QUESTIONS_JSON---`: everything before is streamed as text, the JSON after is parsed into structured question inputs. If there are no questions, the delimiter and JSON are omitted.

**For refinement calls:** Same format. Claude receives the full conversation history and incorporates answers into the improved prompt. Questions array may be empty if all aspects are now covered.

### Rate Limiting

- Shared pool across all features (proofreader + prompt engineer)
- 100 requests per 24-hour IP window
- Each SSE stream initiation counts as 1 request

### Input Validation (Zod)

- `prompt`: string, 1–20,000 characters (trimmed)
- `useCase`: enum of the three types
- `conversation`: array of `{ question: string, answer: string }`, max 10 entries (enforces round cap)
- Returned `questions`: max 3 per response

### Streaming

Same SSE pattern as the proofreader:
- Use `client.messages.stream()` from Anthropic SDK
- Stream the improved prompt + changelog as `"text"` events
- Send structured questions as `"result"` event after stream completes
- Support `AbortController` for client-side cancellation

## UI/UX Specifications

### Shared Layout (`(tools)/layout.tsx`)

- App header with title "OpenMoliere"
- Tab navigation bar with two tabs: "Proofreader" and "Prompt Engineer"
- Active tab indicated visually (underline or highlight)
- Tabs are `<Link>` components pointing to `/proofread` and `/prompt-engineer`

### Prompt Engineer Page

**Input Area:**
- Large textarea for prompt input (same styling as proofreader)
- Use case selector dropdown below the textarea
- "Improve" button (primary action)
- Character count indicator (current / 20,000 max)

**Results Area (visible after submission):**
- **Improved Prompt + Changelog:**
  - Streams in real-time (same visual treatment as proofreader's corrected text)
  - "Copy" button copies the improved prompt (everything before the changelog) to clipboard
  - Changelog renders inline as markdown after the improved prompt

- **Questions Panel:**
  - Rendered below the streamed result
  - Each question renders the appropriate input type:
    - `"text"` → text input with optional placeholder
    - `"choice"` → radio button group with options
    - `"boolean"` → two buttons (Yes / No)
  - "Regenerate prompt" button (disabled until at least one question is answered)
  - Round counter: "Round 2 of 10"
  - Hidden when no questions are returned

- **After 10 rounds:** Questions panel shows "Maximum refinement rounds reached. Your prompt is ready!" with no further questions.

### Tips Panel

- Collapsible section at the bottom of the prompt engineer page
- Title: "Prompt Engineering Tips"
- Content derived from `prompt-engineering.md` principles:
  1. Clear Task Definition
  2. Output Specification
  3. Examples (1-3 input/output pairs)
  4. Relevant Context Only
  5. Structured Formatting
  6. Affirmative Directives
  7. Precise Constraints
  8. One Task Per Prompt
- Static content, rendered at build time or hardcoded
- Collapsed by default

### UI States

```
"empty"     → No prompt entered. "Improve" button disabled.
"ready"     → Prompt entered. "Improve" button enabled.
"analyzing" → Stream in progress. Spinner on button. Textarea disabled.
"results"   → Improved prompt + changelog + questions shown.
"refining"  → Regeneration in progress after answering questions.
"error"     → Error message displayed.
```

### Component Extraction

Extract shared UI from the existing `Checker` component:
- **Textarea with character count** — reusable input component
- **Copy button** — reusable clipboard interaction
- **Result streaming display** — component that renders SSE text stream
- **Error display** — shared error state UI
- **Page shell** — consistent padding, max-width, responsive container

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Empty prompt submitted | Validation prevents submission (button disabled) |
| Prompt exceeds 20,000 chars | Character count in red, submit disabled |
| API returns no questions | Show improved prompt + changelog only, no questions panel |
| API returns > 3 questions | Display first 3, ignore extras |
| API returns no changelog | Show improved prompt only |
| All questions answered, regenerate returns no new questions | Show final prompt, hide questions panel, show "Your prompt is ready!" |
| User navigates away mid-stream | AbortController cancels the request |
| Rate limit exceeded | Show rate limit error with reset time |
| Claude API error | Show generic error message, allow retry |
| 10 rounds reached | Disable further refinement, show completion message |
| User clicks "Improve" again | Reset state, start fresh |
| Network disconnection during stream | Show error, allow retry |
| Very short prompt (< 10 chars) | Accept — the AI can ask questions to flesh it out |

## Dependencies

- Existing Anthropic SDK integration (already in place)
- `prompt-engineering.md` content (already in repo)
- shadcn/ui components: may need Tabs, Collapsible, RadioGroup
- No new external dependencies

## Implementation Order

1. **Route restructuring** — Move proofreader to `/proofread`, set up shared layout, add redirect
2. **Shared component extraction** — Extract reusable pieces from `Checker`
3. **API endpoint** — `/api/prompt-engineer` with Claude integration, streaming, response parsing
4. **Prompt Engineer UI** — Input area, streaming results, changelog display
5. **Q&A UI** — Question rendering, answer collection, regeneration flow
6. **Tips panel** — Static collapsible content section
7. **Rate limit update** — Bump to 100/day shared pool
8. **Testing** — Unit tests for response parser, e2e for full flow

## Success Metrics

- Feature is functional end-to-end: submit prompt → get improved version → answer questions → regenerate → copy
- Proofreader continues to work identically at new route
- All existing tests pass
- New unit tests for prompt engineer response parsing
- Streaming feels responsive (first token < 2s)
- Tab navigation works correctly, active state is visually clear
- Rate limiting works across both features with new 100/day limit