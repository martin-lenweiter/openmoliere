# PM Review Plan

Generated: 2026-03-05
Product: OpenMoliere — Inconsistency Checker tab
Spec sources: None (no spec exists for this feature)

## Product Purpose

Detect internal contradictions and inconsistencies in user-provided text, and help the user resolve them so they leave with clean, consistent text they can copy.

## Spec Alignment Score

No spec to align against. Retroactive spec recommended.

## Implementation Fixes

### Major

#### 1. Highlight spans + suggest fix + apply per-fix

Merges the two original findings (actionable results + span highlighting) into one feature.

- **Current state**: Inconsistencies are displayed as read-only cards with quoted text. The offset/length span data is never used. The `suggestion` field is intentionally neutral ("Clarify whether X or Y") — it doesn't pick a side. Users read the diagnosis and are left to fix things manually.
- **Gap**: The tool is diagnostic-only. The goal is for users to *leave with inconsistency-free text and copy it out*.
- **Approach**:
  1. **Enhance the prompt**: Claude returns a concrete `fix` field per inconsistency — the actual resolved text, not just a neutral suggestion. Claude picks the contextually correct side.
  2. **Highlight spans**: When viewing results, highlight the conflicting spans in the source text. Use the overlay pattern (highlighted `<div>` behind transparent textarea) since native `<textarea>` doesn't support inline highlighting.
  3. **Apply per-fix**: Each inconsistency card gets an "Apply" button. Clicking it immediately replaces the relevant text in the textarea with the suggested fix. The card is marked as resolved.
  4. **Re-scan**: After applying fixes, a "Re-scan" button lets the user verify the text is now consistent. This replaces the original "Scan" button in the results state.
  5. **Copy**: Add a "Copy" button to the textarea so the user can copy their cleaned text.
  6. **Manual editing**: User can always edit the textarea directly instead of using the suggested fix.
- **Data model change**: Add `fix` field to `Inconsistency` type — the concrete replacement text Claude recommends.
- **Files likely involved**: `lib/inconsistency-types.ts`, `lib/inconsistency.ts` (prompt + parsing), `components/inconsistency-checker.tsx`, `components/inconsistency-card.tsx`, `app/api/inconsistency/route.ts`

### Minor

#### 3. Rename tab to match naming pattern

- **Current state**: Tab says "Inconsistencies" (plural noun). Other tabs use agent-noun pattern: "Proofreader", "Prompt Engineer".
- **Suggested approach**: Rename to "Inconsistency Checker" in `app/(tools)/layout.tsx`.
- **Files likely involved**: `app/(tools)/layout.tsx`

## Spec Updates (code -> spec)

Write a retroactive spec (`spec-inconsistency-checker.md`) documenting:

| Section | Content |
|---------|---------|
| Purpose | Detect and resolve internal inconsistencies in text |
| Goals | Actionable output (leave with clean text), span highlighting, streaming analysis |
| Categories | logic, naming, tense, formatting, capitalization |
| Interaction model | Paste -> scan -> review -> apply fixes (per-item) -> re-scan -> copy |
| Edge cases | Text too short, no inconsistencies found, ambiguous resolutions |
| Limits | 10,000 char max, rate limiting per IP |

## Simplification Opportunities

| Area | Current Complexity | Simpler Alternative | Files |
|------|-------------------|---------------------|-------|
| InconsistencyStats | Computed server-side, sent in SSE, only used for display counts | Derive client-side from inconsistencies array | `route.ts`, `inconsistency-types.ts`, `inconsistency-checker.tsx` |

## Coherence Issues

| Issue | Components Involved | Suggested Fix |
|-------|-------------------|---------------|
| Different interaction models across tabs | Proofreader produces output to copy; inconsistency checker is diagnostic-only | Align to same outcome: user leaves with improved text they can copy |

## Intentional Gaps

None identified.

## Deferred

None.
