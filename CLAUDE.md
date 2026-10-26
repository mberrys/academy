# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Academy is a digital card game about philosophy. Cards represent ideas, arguments, and schools of thought, and gameplay comes from how they combine with and clash against each other.

The scaffold is in place. AC-01 of 07 is complete.

## Stack

- TypeScript in strict mode, running in the browser
- React for the UI, built with Vite
- Vitest for tests

## Commands

- `npm install`
- `npm run dev`: start the dev server at http://localhost:5173
- `npm run build`: type-check and build for production
- `npm test`: run all tests
- `npm run typecheck`: check types without emitting
- `npx vitest run path/to/file.test.ts`: run a single test file
- `npx vitest run -t "test name"`: run tests whose name matches
- `npm run sim`: headless game harness, a stub until AC-02
- `npm run selfplay`: AI harness, a stub until AC-05
- `npm run docs:check`: documentation check, a stub until AC-07

## Layout

- `src/engine`: the pure rules engine. No React or DOM imports.
- `src/ui`: the React app.
- `src/cards`: card data and decklists, added in AC-04.
- `src/ai`: the bot, added in AC-05.
- `scripts`: the headless harnesses.
- `docs/PLAN.md`: the milestone plan.
- `docs/evidence`: screenshots and logs.
- `reviews`: adversarial review reports.

## Architecture intent

- **Keep the game engine separate from the UI.** Rules, turn flow, and card resolution live in pure TypeScript modules with no React or DOM imports. The UI renders game state and sends player actions to the engine. This keeps the rules unit-testable and leaves room for an AI opponent or multiplayer later.
- **Cards are data.** Card definitions (name, school of thought, cost, text, effect) live in data files, not in component code. A card's effect is a reference into an effect registry in the engine.
- **State is immutable.** The engine works as `(state, action) -> newState`, so turns can be replayed, undone, and tested deterministically. Inject any randomness (shuffling) through a seeded RNG that is part of the state.

## Remote

GitHub: https://github.com/mberrys/academy (default branch `main`)
