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

- `src/types.ts` — `Todo` (`id`, `text`, `createdAt`, `dueAt?`, `difficulty`, `done`, `completedAt?`, `parentId?`), `Difficulty`, `DIFFICULTY_OPTIONS` (value/label pairs for the difficulty picker UI — lives here rather than in a component so it stays a plain export for fast refresh), `GamificationSnapshot`, `Urgency`.
- `src/storage.ts` — `loadTodos`/`saveTodos`, `localStorage` read/write guarded by try/catch (storage-disabled browsers fall back to in-memory for the session).
- `src/dateUtils.ts` — pure date helpers: `formatRelativeTimeAgo`, `formatDueLabel`, `getUrgency`, `toLocalDateKey`, `calendarDayDiff`, `addDays`. All accept an explicit `nowMs` for deterministic tests.
- `src/gamification.ts` — `XP_BY_DIFFICULTY`, `levelForXp` (quadratic level curve, `cumulativeXpForLevel(L) = 50*L*(L-1)`), `computeStreak` (consecutive local-calendar-days with a completion, anchored on today-or-yesterday), `xpByDay(todos, days, nowMs)` (XP earned per local day over a trailing window, oldest first — feeds the stats chart), `deriveGamification`. Operates over the flat todos array regardless of subtask nesting — a completed subtask grants XP same as any other done todo.
- `src/subtasks.ts` — pure helpers for the two-level subtask model: `getSubtasks(todos, parentId)` (direct children, oldest first), `hasSubtasks`, `canNest(todos, childId, parentId)` (rejects self-nesting, nesting under a subtask or beneath a completed task, and nesting a task that already has its own subtasks — this caps depth at two levels).
- `src/todoSort.ts` — `groupAndSortTodos` buckets *top-level* todos (`parentId === undefined`) into overdue/dueSoon/upcoming/noDate and separates done todos, each bucket sorted appropriately; subtasks are excluded since they render nested under their parent instead.
- `src/hooks/useTodos.ts` — localStorage-backed CRUD (`addTodo`, `toggleTodo`, `updateTodo`, `deleteTodo`, `nestTodo`). `toggleTodo` sets/clears `completedAt` and cascades: toggling a task also toggles all of its subtasks, and toggling a subtask re-derives its parent's `done` via `syncParentDone` (done once every subtask is done, un-done the moment one isn't — symmetric with the XP-retraction philosophy above). `updateTodo(id, { text, difficulty, dueAt })` replaces those three editable fields wholesale (the edit form always submits full current values, so there's no partial-update ambiguity). `deleteTodo` cascades to a parent's subtasks. `nestTodo` sets `parentId` after checking `canNest`, then re-syncs the new parent's done state.
- `src/hooks/useGamification.ts` — `useMemo` wrapper over `deriveGamification`.
- `src/components/TaskFields.tsx` — `DifficultyPicker` and `DueDatePicker`, the two form controls shared between `AddTaskForm` (add mode) and `EditTaskForm` (edit mode) so the two forms can't drift apart.
- `src/components/EditTaskForm.tsx` — in-place edit form rendered by `TaskItem` in place of the row when editing; pre-fills from the todo, submits the full `{ text, difficulty, dueAt }` via `onSave` to `useTodos#updateTodo`.
- `src/components/ProgressHeader.tsx`, `AddTaskForm.tsx`, `TaskList.tsx`, `TaskItem.tsx`, `StatsPage.tsx` — presentation; `AddTaskForm` uses progressive disclosure (due date + difficulty are hidden behind an "Add details" toggle). `TaskItem` renders a row split into `.task-toggle` (checkbox + text, sized to content — only this region toggles the task) and `.task-row-actions` (drag handle + discreet `.icon-button` edit/delete icons, pushed right via `margin-left:auto`, dimmed via `opacity` until hover/focus), so tapping empty space on the row does nothing; a top-level task with subtasks renders them recursively (one level only) inside a nested `.subtask-list`, alongside a done-count badge. `TaskList` owns the drag-to-nest gesture: a pointer-events-based drag (not HTML5 DnD, which doesn't fire on touch) on each childless top-level task's `.drag-handle`, using `setPointerCapture` + `document.elementFromPoint` to track the hovered `[data-todo-id]` li and a fixed-position `.drag-ghost` label that follows the pointer; on release it calls `onNest` if the hovered target is valid per `canNest`. `StatsPage` is a second full-screen view (level/XP/streak/done-count tiles, a CSS-bar `xpByDay` chart over the last 14 days, and a static rules explainer sourced from the live `XP_BY_DIFFICULTY`/`cumulativeXpForLevel` constants so it can't drift from the real numbers) — `App` swaps between it and the task list via local `view` state; `ProgressHeader`'s `📊` button (`onOpenStats`) opens it, `StatsPage`'s back button returns. No router: the app is small enough that a single `useState` toggle in `App.tsx` is simpler than adding a routing dependency.
- `.todo-list li button` has no blanket style rule — every direct action button in a task row (`.icon-button`, `.drag-handle`) carries its class explicitly. Don't reintroduce a bare `li button` selector: form controls (difficulty/due-date pickers) render inside the same `<li>` during edit mode, and a high-specificity `li button` rule would clobber their borders/backgrounds.
- `src/App.tsx` — composition root: wires the hooks to the components and holds the `view` ('tasks' | 'stats') toggle.
- `src/main.tsx` — React root mount point.
- `src/setupTests.ts` — Vitest setup file, loads `@testing-library/jest-dom` matchers and clears `localStorage` after each test; wired in via `test.setupFiles` in `vite.config.ts`.

`vite.config.ts` sets `base: './'` so the production build works when served from any nested path (e.g. GitHub Pages project subfolders).

The UI is in French (matching the rest of the `claudeapps` collection). `public/manifest.webmanifest`, `public/favicon.svg` (doubles as the PWA icon), and `public/sw.js` (a network-first, runtime-caching service worker — no static asset list, since Vite's build output filenames are hashed) are copied verbatim into the build by Vite's `public/` convention and registered from `src/main.tsx`, so the app installs to a phone's home screen and keeps working offline after a first visit, matching the other apps in the repo.

Testing uses Vitest + `@testing-library/react` + `@testing-library/user-event`, run in a `jsdom` environment (configured in `vite.config.ts`'s `test` block, alongside the Vite/React plugin config — this is a single-config-file setup, not a separate `vitest.config.ts`).

Linting uses oxlint (`.oxlintrc.json`), not ESLint.
