# TestOps Hub frontend

The Phase 2 dashboard: Vite + React + TypeScript, run directly on the host (not containerized) so
Vite's HMR runs at full speed against the already-Dockerized backend.

## Stack

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS v4** for styling
- **shadcn/ui** for accessible UI primitives (`src/components/ui`)
- **TanStack Router** for routing (root route + layout in `src/router.tsx`)
- **TanStack Query** for data-fetching, wired via `QueryClientProvider` in `src/App.tsx`
- **Vitest** + **React Testing Library** for component tests

## Getting started

The backend must be running first (see the root [README](../README.md)) — the dev server calls it
directly, and CORS is only configured for `http://localhost:5173`.

```bash
npm install
npm run dev
```

## Scripts

| Script                 | Purpose                                                        |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Start the Vite dev server                                       |
| `npm run build`        | Typecheck (`tsc -b`) and build for production                   |
| `npm test`             | Run the Vitest suite                                             |
| `npm run lint`         | Run Oxlint                                                       |
| `npm run gen:api-types`| Regenerate `src/api/schema.ts` from the backend's OpenAPI schema |

## Generating API types

With the backend running (`http://localhost:8000` by default):

```bash
npm run gen:api-types
```

This runs `openapi-typescript` against `/openapi.json` and writes `src/api/schema.ts`. There's no
generated client — hooks are hand-written against these types in later tickets.
