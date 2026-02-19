<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into OpenMolière. Here's what was done:

- **`instrumentation-client.ts`** (new) — Initialises `posthog-js` on the client using Next.js 15.3+ `instrumentation-client` pattern, with exception capture enabled and a reverse-proxy ingest path (`/ingest`).
- **`lib/posthog-server.ts`** (new) — Singleton `posthog-node` client for server-side event capture from API routes.
- **`next.config.ts`** — Added `/ingest` rewrites to proxy PostHog ingestion through the Next.js server, preventing ad-blocker interference.
- **`components/checker.tsx`** — Added 4 client-side events covering the full proofreader user journey plus `captureException` on errors.
- **`components/prompt-engineer.tsx`** — Added 5 client-side events covering the full prompt engineer journey (first improvement through multi-round refinement) plus `captureException` on errors.
- **`app/api/check/route.ts`** — Added 2 server-side events: rate limit hit and successful completion with error stats.
- **`app/api/prompt-engineer/route.ts`** — Added 2 server-side events: rate limit hit and successful completion with question count.

| Event | Description | File |
|---|---|---|
| `proofread_check_submitted` | User clicks Check; captures language and text length | `components/checker.tsx` |
| `proofread_check_completed` | Check succeeds; captures detected language, error counts by category | `components/checker.tsx` |
| `proofread_result_copied` | User copies corrected text to clipboard | `components/checker.tsx` |
| `proofread_check_failed` | Client-side error during proofreading; captures error message | `components/checker.tsx` |
| `prompt_improve_submitted` | User clicks Improve; captures use case and prompt length | `components/prompt-engineer.tsx` |
| `prompt_improve_completed` | Improvement succeeds; captures use case, round, questions count | `components/prompt-engineer.tsx` |
| `prompt_regenerated` | User submits answers and regenerates; captures round, questions answered, free-form feedback | `components/prompt-engineer.tsx` |
| `prompt_result_copied` | User copies improved prompt to clipboard | `components/prompt-engineer.tsx` |
| `prompt_improve_failed` | Client-side error during prompt improvement; captures error message and round | `components/prompt-engineer.tsx` |
| `api_check_rate_limited` | Server: proofreading blocked by rate limiter | `app/api/check/route.ts` |
| `api_check_completed` | Server: proofreading completed; captures language, error stats, text length | `app/api/check/route.ts` |
| `api_prompt_engineer_rate_limited` | Server: prompt engineer blocked by rate limiter | `app/api/prompt-engineer/route.ts` |
| `api_prompt_engineer_completed` | Server: prompt improvement completed; captures use case, round, questions count | `app/api/prompt-engineer/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics](https://eu.posthog.com/project/129200/dashboard/532992)
- **Insight**: [Proofreader: Submit → Complete → Copy funnel](https://eu.posthog.com/project/129200/insights/lzBolF8i)
- **Insight**: [Daily active users per tool](https://eu.posthog.com/project/129200/insights/oHi7dHu1)
- **Insight**: [Prompt engineer: Improve → Complete → Regenerate funnel](https://eu.posthog.com/project/129200/insights/g7GiWO00)
- **Insight**: [Rate limit hits per tool](https://eu.posthog.com/project/129200/insights/mbU7EYi5)
- **Insight**: [Client-side errors per tool](https://eu.posthog.com/project/129200/insights/aBKFX3Y8)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
