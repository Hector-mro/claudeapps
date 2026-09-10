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

Single-page React 19 + TypeScript app scaffolded with Vite, no backend — all todo state lives in-memory in `App` component state (`useState`), so nothing persists across reloads.

- `src/App.tsx` — the entire app: input form, todo list, add/toggle/delete handlers.
- `src/types.ts` — the `Todo` shape (`id`, `text`, `done`).
- `src/main.tsx` — React root mount point.
- `src/setupTests.ts` — Vitest setup file, loads `@testing-library/jest-dom` matchers; wired in via `test.setupFiles` in `vite.config.ts`.

Testing uses Vitest + `@testing-library/react` + `@testing-library/user-event`, run in a `jsdom` environment (configured in `vite.config.ts`'s `test` block, alongside the Vite/React plugin config — this is a single-config-file setup, not a separate `vitest.config.ts`).

Linting uses oxlint (`.oxlintrc.json`), not ESLint.
