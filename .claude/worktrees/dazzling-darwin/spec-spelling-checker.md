# Spec: Dual-Engine Spelling & Grammar Checker

## Overview

A web-based writing checker that combines Claude (LLM) as the primary engine with LanguageTool as a rule-based safety net. Users paste text, click "Check," and receive a corrected version with a list of changes and brief rationale. The dual-engine approach maximizes confidence in suggestions — minimizing both false positives and false negatives. The app is stateless, minimal, and fast.

## Goals

- **Correctness above all**: Very few false positives (flagging correct text) and very few false negatives (missing real errors)
- **Speed**: End-to-end check completes in under 5 seconds for typical text
- **Simplicity**: Paste text → click check → copy corrected text. No accounts, no configuration, no friction
- **Taste**: Minimal, clean UI that's pleasant to use — not utilitarian, not bloated

## Non-Goals

- Real-time / as-you-type checking
- User accounts, history, or saved documents
- Browser extension or desktop app
- Tone rewriting or content generation
- Custom dictionaries or user preferences (MVP)
- Public branding or marketing site

## User Stories

1. **Check text for errors**: As a user, I paste text into the input area, click "Check," and see a corrected version I can copy, plus a list of what changed and why.
2. **Copy corrected text**: As a user, I click a "Copy" button on the corrected text to paste it wherever I need it.
3. **Review individual changes**: As a user, I see each change listed with a one-sentence explanation so I understand what was fixed.
4. **Assess confidence**: As a user, I can see which suggestions both engines agreed on (high confidence) vs. which only one engine flagged (uncertain).
5. **Override language detection**: As a user, I see the auto-detected language and can change it if the detection was wrong.
6. **Handle clean text**: As a user, when my text has no errors, I see a simple success message confirming it's clean.

## Technical Requirements

### Architecture

```
User Input
    │
    ├──→ Claude API (streaming) ──→ Corrected text + structured error list
    │
    └──→ LanguageTool API ──→ Rule-based error list
    │
    └──→ Merge Engine ──→ Final output
```

- **Parallel execution**: Both engines fire simultaneously when user clicks "Check"
- **LLM is primary**: Claude produces the corrected text and error explanations
- **LanguageTool is safety net**: Its findings are merged into the error list; disagreements are flagged as "uncertain"
- **Streaming**: Claude's corrected text streams to the client as it generates. Error list appears once both engines complete.

### Engine Details

**Claude (Primary)**
- Model: Latest Claude (server-side API key)
- Input: User's text + detected language
- Output: Corrected text (preserving original formatting) + structured JSON error list
- Each error: original text, correction, category (spelling/grammar/style), one-sentence rationale
- Streaming enabled for corrected text output

**LanguageTool (Safety Net)**
- Tier: Free public API (https://api.languagetool.org/v2/check)
- Limits: 20 requests/min, ~10,000 characters per request
- Input: User's text + detected language code
- Output: List of matches with offset, length, suggested replacement, rule category

### Merge Logic

1. Collect errors from both engines
2. Match errors by text position/overlap
3. If both engines flag the same issue → **high confidence**
4. If only Claude flags it → included in results (Claude is primary)
5. If only LanguageTool flags it but Claude didn't correct it → **flagged as uncertain** in the error list
6. Final corrected text comes from Claude's output (not LanguageTool's)

### Rate Limiting

- **IP-based**: ~50 checks per day per IP address
- **Text limit**: ~2,000 words (~10,000 characters) per check
- **No accounts**: Rate limits enforced server-side via IP tracking
- Implementation: In-memory store or simple key-value (no database needed for MVP)

### Language Support

- Multi-language support
- Auto-detection with user override
- Language detection: Use Claude to detect language (part of the same prompt), pass to LanguageTool as `language` parameter
- Show detected language to user with dropdown to override

## Data Model

No persistent data model — the app is stateless. All data lives in the request/response cycle.

### Request Shape
```typescript
interface CheckRequest {
  text: string           // User's input text (max ~10,000 chars)
  language?: string      // Optional language override (e.g., "en-US", "de-DE")
}
```

### Response Shape
```typescript
interface CheckResponse {
  correctedText: string  // Full corrected text preserving formatting
  language: string       // Detected or specified language
  errors: Error[]        // List of corrections made
  stats: {
    totalErrors: number
    spelling: number
    grammar: number
    style: number
  }
}

interface Error {
  original: string       // Original text fragment
  correction: string     // What it was changed to
  category: 'spelling' | 'grammar' | 'style'
  rationale: string      // One-sentence explanation
  confidence: 'high' | 'uncertain'  // Both engines agree vs. only one flagged it
  position: {
    offset: number       // Character offset in original text
    length: number       // Length of original fragment
  }
}
```

## API Design

### `POST /api/check`

Server-side API route that orchestrates both engines.

**Request**: `CheckRequest` (JSON body)

**Response**: Streaming response
- First: Stream corrected text chunks as they arrive from Claude
- Then: Send complete error list as final JSON payload

**Streaming protocol**: Use Server-Sent Events or newline-delimited JSON:
```
{"type": "text", "content": "Here is the correc..."}
{"type": "text", "content": "ted text streaming in..."}
{"type": "result", "errors": [...], "language": "en-US", "stats": {...}}
```

**Error responses**:
- `429` — Rate limit exceeded
- `400` — Text too long or empty
- `500` — Engine failure (with user-friendly message)

## UI/UX Specifications

### Layout

Single column, stacked layout. Centered content with max-width (~720px).

```
┌─────────────────────────────────────┐
│  [Logo/Title]                       │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │     Text Input Area         │    │
│  │     (textarea, ~10 rows)    │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│  [Auto-detected: English ▾]         │
│                    [Check Button]   │
│                                     │
│  ── Results (after checking) ────   │
│                                     │
│  Corrected Text          [Copy 📋] │
│  ┌─────────────────────────────┐    │
│  │  Corrected text appears     │    │
│  │  here, streaming in...      │    │
│  └─────────────────────────────┘    │
│                                     │
│  Changes (3 spelling, 1 grammar)    │
│  ┌─────────────────────────────┐    │
│  │ "their" → "there"          │    │
│  │  Wrong homophone for this   │    │
│  │  context. [HIGH]            │    │
│  ├─────────────────────────────┤    │
│  │ "could of" → "could have"  │    │
│  │  Common spoken-form error.  │    │
│  │  [HIGH]                     │    │
│  ├─────────────────────────────┤    │
│  │ "very unique" → "unique"   │    │
│  │  "Unique" is absolute, no   │    │
│  │  degree modifier needed.    │    │
│  │  [UNCERTAIN]                │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### States

1. **Empty**: Text area with placeholder text, check button disabled
2. **Ready**: Text entered, check button enabled
3. **Checking**: Button shows loading state, corrected text streams in below
4. **Results**: Corrected text (with copy button) + error list displayed
5. **No errors**: Simple success message: "No issues found. Your text looks great."
6. **Error**: User-friendly error message (rate limited, text too long, service unavailable)

### Design Direction

- Minimal and clean — lots of whitespace, monochrome with one accent color
- shadcn/ui components for consistency
- No animations beyond subtle loading states
- Typography-focused — the text is the product
- Desktop-first, responsive enough to work on mobile

### Key Interactions

- **Check button**: Primary action, prominent but not flashy
- **Copy button**: One-click copy of corrected text to clipboard, with brief "Copied!" feedback
- **Confidence badges**: Subtle visual distinction between HIGH and UNCERTAIN corrections
- **Language selector**: Small, unobtrusive — auto-detect handles 95% of cases

## Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| Empty text submitted | Disable check button, validate client-side |
| Text exceeds ~2,000 words | Show character/word count, disable button with message |
| LanguageTool API is down | Proceed with Claude-only results, note reduced confidence |
| Claude API is down | Show error, suggest trying again later |
| Both engines down | Clear error message, no partial results |
| Rate limit hit | "You've reached the daily limit. Try again tomorrow." |
| Language detection wrong | User overrides via dropdown, re-check with correct language |
| Text is already perfect | "No issues found. Your text looks great." |
| Mixed-language text | Detect primary language, note that mixed content may have reduced accuracy |
| Very short text (< 10 chars) | Allow check but expect fewer meaningful results |
| Claude suggests over-corrections | Prompt engineering: instruct Claude to be conservative, fix clear errors only, preserve the author's voice |

## Open Questions

1. **Prompt engineering**: Exact Claude prompt needs iteration to balance thoroughness vs. over-correction. This is the most critical technical risk.
2. **LanguageTool language codes**: Need to map between Claude's language detection output and LanguageTool's expected language codes (e.g., "en-US" vs "en-GB").
3. **Streaming protocol**: SSE vs. newline-delimited JSON — need to decide based on Next.js App Router compatibility.
4. **Structured output from Claude**: Use tool_use / JSON mode to get structured error list alongside corrected text, or parse from a single text response?
5. **Position tracking**: Maintaining accurate character offsets between original and corrected text is non-trivial — may simplify to just showing original → correction without click-to-navigate.

## Dependencies

- **Claude API** (Anthropic SDK) — primary checking engine
- **LanguageTool free API** — safety net engine, external dependency with rate limits
- **Next.js 14/15** — framework
- **Tailwind CSS + shadcn/ui** — styling
- **TypeScript** — type safety

## Success Metrics

1. **Correctness**: < 5% false positive rate on test corpus (flags correct text as wrong)
2. **Recall**: < 10% false negative rate on test corpus (misses real errors)
3. **Speed**: p95 response time under 5 seconds for ~500 word text
4. **Usability**: User can paste text, get results, and copy corrected text in under 10 seconds of interaction time
5. **Uptime**: Both engines available > 99% of the time (graceful degradation to Claude-only if LanguageTool is down)
