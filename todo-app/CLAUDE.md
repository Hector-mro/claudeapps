# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server with HMR
- `npm run build` — type-check (`tsc -b`) then production-build via Vite
- `npm run lint` — run oxlint
- `npm run test` — run the Vitest suite once (CI mode)
- `npm run test:watch` — run Vitest in watch mode
- Run a single test file: `npx vitest run src/App.test.tsx`
- Run tests matching a name: `npx vitest run -t "adds a todo"`

## Architecture

Single-page React 19 + TypeScript app scaffolded with Vite, no backend — todos persist to `localStorage` (key `todo-app:v1`), no accounts, single device only. Gamification (level/XP/streak) is never stored directly; it's derived fresh from the todos array on every render, so toggling a task back to not-done (or deleting a completed one) automatically retracts the XP/streak it granted.

- `src/types.ts` — `Todo` (`id`, `text`, `createdAt`, `dueAt?`, `difficulty`, `done`, `completedAt?`), `Difficulty`, `GamificationSnapshot`, `Urgency`.
- `src/storage.ts` — `loadTodos`/`saveTodos`, `localStorage` read/write guarded by try/catch (storage-disabled browsers fall back to in-memory for the session).
- `src/dateUtils.ts` — pure date helpers: `formatRelativeTimeAgo`, `formatDueLabel`, `getUrgency`, `toLocalDateKey`, `calendarDayDiff`, `addDays`. All accept an explicit `nowMs` for deterministic tests.
- `src/gamification.ts` — `XP_BY_DIFFICULTY`, `levelForXp` (quadratic level curve, `cumulativeXpForLevel(L) = 50*L*(L-1)`), `computeStreak` (consecutive local-calendar-days with a completion, anchored on today-or-yesterday), `deriveGamification`.
- `src/todoSort.ts` — `groupAndSortTodos` buckets active todos into overdue/dueSoon/upcoming/noDate and separates done todos, each bucket sorted appropriately.
- `src/hooks/useTodos.ts` — localStorage-backed CRUD (`addTodo`, `toggleTodo`, `deleteTodo`); `toggleTodo` sets/clears `completedAt`.
- `src/hooks/useGamification.ts` — `useMemo` wrapper over `deriveGamification`.
- `src/components/ProgressHeader.tsx`, `AddTaskForm.tsx`, `TaskList.tsx`, `TaskItem.tsx` — presentation; `AddTaskForm` uses progressive disclosure (due date + difficulty are hidden behind an "Add details" toggle).
- `src/App.tsx` — composition root only: wires the hooks to the components.
- `src/main.tsx` — React root mount point.
- `src/setupTests.ts` — Vitest setup file, loads `@testing-library/jest-dom` matchers and clears `localStorage` after each test; wired in via `test.setupFiles` in `vite.config.ts`.

`vite.config.ts` sets `base: './'` so the production build works when served from any nested path (e.g. GitHub Pages project subfolders).

The UI is in French (matching the rest of the `claudeapps` collection). `public/manifest.webmanifest`, `public/favicon.svg` (doubles as the PWA icon), and `public/sw.js` (a network-first, runtime-caching service worker — no static asset list, since Vite's build output filenames are hashed) are copied verbatim into the build by Vite's `public/` convention and registered from `src/main.tsx`, so the app installs to a phone's home screen and keeps working offline after a first visit, matching the other apps in the repo.

Testing uses Vitest + `@testing-library/react` + `@testing-library/user-event`, run in a `jsdom` environment (configured in `vite.config.ts`'s `test` block, alongside the Vite/React plugin config — this is a single-config-file setup, not a separate `vitest.config.ts`).

Linting uses oxlint (`.oxlintrc.json`), not ESLint.
