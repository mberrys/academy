# Academy

Academy is a two-player card game about philosophy. Cards are ideas, arguments, and schools of thought, and the game comes from how they combine and clash.

This repository is being built as a playable vertical slice. It is not playable yet. The scaffold and the toolchain are in place.

## Stack

- TypeScript in strict mode, running in the browser
- React for the UI, built with Vite
- Vitest for tests
- No backend and no database

## Commands

```sh
npm install
npm run dev
npm run build
npm test
npm run typecheck
```

`npm run dev` starts the Vite server at http://localhost:5173. `npm run build` type-checks and builds for production. `npm test` runs the suite. `npm run typecheck` checks types without emitting.

The headless harnesses are stubs until their milestones. `npm run sim` lands in AC-02, `npm run selfplay` lands in AC-05, and `npm run docs:check` lands in AC-07.

## Layout

- `src/engine` holds the pure rules engine. It has no React or DOM imports.
- `src/ui` holds the React app.
- `scripts` holds the headless harnesses.
- `docs/PLAN.md` holds the milestone plan.
- `docs/evidence` holds screenshots and logs.
- `reviews` holds the adversarial review reports.

## Status

AC-01 of 07. The engine lands in AC-02. See `docs/PLAN.md` for the full roadmap.
