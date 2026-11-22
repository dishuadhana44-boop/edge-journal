# Project memory

## Product intent & audience

- EdgeFinder: a trading application with a React frontend, backend, and MT5 (MetaTrader 5) broker bridge.
- Likely aimed at traders seeking market "edges"; broker/trade execution is a core capability but must not be auto-started during dev/preview.

## Brand personality & voice

- Not yet inferred; user communicates in direct, diagnostic, constraint-heavy requests.

## Visual design & UX direction

- Framework: Vite + React.
- No aesthetic/UX details inferred yet.

## Decisions, constraints & rationale

- Dev orchestration: `npm run dev` starts backend + frontend + MT5 bridge together; `npm run dev:frontend` starts only Vite.
- Vite config currently uses `port: 5174`, `strictPort: true`, `open: true`.
- Backend requires environment configuration and may crash on startup, which can terminate the entire `npm run dev` process (including frontend).
- `open: true` is non-functional in Bolt (no browser to launch).
- Bolt preview requires Vite `host: true` (0.0.0.0) to be reachable.
- Proposed (pending approval) config-only fixes: set `host: true`, remove `open: true`, use `npm run dev:frontend` to isolate frontend from backend crash risk.
- Hard constraints from user: no feature redesign, no file deletion/overwrite, no dependency install/update, no broker connections or trades, config changes require approval first.

## Open questions & assumptions

- User approval pending for Vite config changes (`host`, `open`) and switching to `dev:frontend` script.
- Whether the backend is needed for the frontend to render meaningfully in preview (runtime errors possible if frontend expects backend APIs).
- Actual preview visibility after config changes not yet verified.