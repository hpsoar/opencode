# AGENTS.md (repo-wide)

Agentic coding rules + commands for this monorepo.

## Quick start (repo root)

```bash
bun install
bun dev
bun typecheck          # (= bun turbo typecheck)
bun turbo test         # CI-style suite
```

## Monorepo rules (critical)

- **Do NOT run tests from repo root**
  - root `package.json`: `test` exits 1 intentionally
  - root `bunfig.toml`: `[test].root = "./do-not-run-tests-from-root"`
- Prefer explicit cwd when running package scripts:

```bash
bun run --cwd packages/opencode test
bun run --cwd packages/opencode typecheck
```

## Common commands

### `packages/opencode` (core)

```bash
bun run --cwd packages/opencode dev
bun run --cwd packages/opencode typecheck   # tsgo --noEmit
bun run --cwd packages/opencode test        # bun test
bun run --cwd packages/opencode test test/tool/tool.test.ts
bun run --cwd packages/opencode test -t "<pattern>" test/tool/tool.test.ts
bun run --cwd packages/opencode lint        # bun test --coverage
bun run --cwd packages/opencode format      # prettier write src/**/*.ts
bun run --cwd packages/opencode build
./packages/opencode/script/build.ts --single
```

### `packages/app` (web UI)

```bash
bun run --cwd packages/app dev
```

## Architecture (high-level)

### Monorepo layers

- `packages/opencode`: core business logic + server + CLI/TUI entrypoints (Bun + TS)
  - TUI: `packages/opencode/src/cli/cmd/tui/` (SolidJS + OpenTUI)
- `packages/app` (`@opencode-ai/app`): the **interactive web client app** (SolidJS + Vite) built on `@opencode-ai/ui` + `@opencode-ai/sdk`
  - Easy to confuse with `packages/web` — `app` is the product UI, not the docs/marketing site.
- `packages/web` (`@opencode-ai/web`): the **website/docs** (Astro + Starlight + Solid)
- `packages/desktop`: desktop app (Tauri) wrapping `packages/app`
- `packages/sdk/js`: TypeScript SDK used by UI clients
- `packages/plugin`: source for `@opencode-ai/plugin`
- `packages/util`: shared utilities
- `packages/console/*`: console-related packages

### `packages/opencode` internal map

- `src/server/`: server endpoints + service wiring
- `src/tool/`: tool implementations (agent-facing surface)
- `src/session/`: session/message/state machinery
- `src/util/`: shared helpers
- `script/`: build/generate/publish scripts

### Core conventions (in `packages/opencode`)

- Tools implement `Tool.Info` with `execute()`
- Pass `sessionID`; use `App.provide()` for DI
- Validate external inputs with Zod
- Logging: `Log.create({ service: "name" })`
- Persistence via `Storage`

### Must-do step

If you change server endpoints in `packages/opencode/src/server/server.ts`, regenerate the SDK:

```bash
./packages/opencode/script/generate.ts
```

## Code style

Source of truth: `STYLE_GUIDE.md`.

- Keep logic in one function unless clearly reusable
- Avoid `else` (use early returns / IIFE)
- Avoid `let` (prefer `const` + expressions)
- Avoid `any`
- Avoid unnecessary destructuring; prefer `obj.prop`
- Avoid `try/catch` where possible
- Prefer Bun APIs when appropriate (e.g. `Bun.file()`)
- Prefer single-word identifiers when still descriptive

Formatting: Prettier config is in root `package.json` (`semi: false`, `printWidth: 120`).

## UI-specific constraints

From `packages/app/AGENTS.md`:

- For UI debugging, use Playwright MCP; app is already running at http://localhost:3000
- **NEVER** try to restart the app or server process
- Prefer `createStore` over many `createSignal` calls

## CI / PR conventions

From `CONTRIBUTING.md` + workflows:

- CI runs `bun turbo typecheck` + `bun turbo test`
- PRs are **issue-first**: reference an issue (`Fixes #123` / `Closes #123`)
- PR titles follow conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:` (optional scope)

## Cursor / Copilot rules

None found in this checkout.
Searched: `.cursorrules`, `.cursor/rules/**`, `.github/copilot-instructions.md`
