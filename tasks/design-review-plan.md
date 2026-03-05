# Design Review Plan

Reviewed: 2026-03-05
Scope: All 3 tool pages (/proofread, /prompt-engineer, /inconsistency) + shared layout

## Accepted Violations

None — all findings accepted for fixing or deferred with rationale.

## Deferred Items

- **Cmd+K command palette** (Navigation gap) — defer to separate feature pass
- **SVG logo and brand kit** (Brand gap) — defer to design pass

## Fixes

### 1. Skeleton loading states for async results [DONE]
- Added skeleton placeholders in `checker.tsx`, `inconsistency-checker.tsx`, and `prompt-engineer.tsx`
- Skeletons show before streaming begins, replaced by real content once data arrives

### 2. Persistent resumable state across tab navigation [DONE]
- Created `hooks/use-persisted-state.ts` using sessionStorage
- Applied to text inputs and language/use-case selects in all 3 tools
- Initial state correctly derives "ready" vs "empty" from persisted value

### 3. Hide scrollbars [DONE]
- Added `scrollbar-width: none` and `::-webkit-scrollbar { display: none }` in `globals.css`

### 4. Increase all hit targets to 44px minimum [DONE]
- Button default and sm sizes: h-9/h-8 → h-11 (44px)
- Icon button: size-9 → size-11
- Select elements: h-9 → h-11
- Tab links: added `min-h-[44px]` with flex centering

### 5. Rewrite descriptions to max 7 words per sentence [DONE]
- Proofreader: "Check spelling, grammar, and style."
- Prompt Engineer: "Improve any prompt with explanations."
- Inconsistency: "Find contradictions in your text."

### 6. Add save state reassurance [DONE]
- Added "Saved" indicator near character count in all 3 tools
- Only visible when text is non-empty
