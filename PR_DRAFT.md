# PR: Normalize follow-up logic

Summary
- Centralize follow-up and workflow helpers into `src/utils/workflow.ts`.
- Replace ad-hoc `new Date(lead.follow_up_date)` usages with `parseDateOnly` and `isFollowUpDue`.
- Update follow-up queue and main `App.tsx` to use centralized helpers.

Why
- Fix timezone/date-only drift and duplicated follow-up logic across the app.

Files changed
- `src/utils/workflow.ts` (new): helpers: `parseDateOnly`, `isFollowUpDue`, `getFollowUpLabel`, `isDoNotContact`, `isFinalStage`.
- `src/components/FollowUpQueue.tsx` (modified): use helpers and exclude final/do-not-contact leads.
- `src/App.tsx` (modified): use helpers across dashboards and active lead panel.

Tests
- Added `src/utils/workflow.test.ts` (vitest). To run locally:

```bash
npm i -D vitest
npm test
```

Notes
- I could not push from this environment (no `git` available). Please push branch `followup-normalize` locally and open the PR. Suggested commit message:

```
Normalize follow-up logic: add workflow helpers and update follow-up UI/metrics
```

Suggested reviewers: @your-team
