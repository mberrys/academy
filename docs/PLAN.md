# Academy scaffold plan

Academy is a two-player card game about philosophy. This plan builds a playable vertical slice against a computer opponent, plus the documentation a new contributor needs.
Three champions, 40 deckable cards, two tokens, a pure TypeScript engine, a React UI, and six documents plus a README.
The rule the build enforces is that the engine is a pure function of state and action, so every rule is testable and every game is replayable.
The work runs as seven milestones, AC-01 to AC-07.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. Check a box only when its evidence exists, a file, a test run, a screenshot, or a SHA. The body is a how-to. The appendices explain and record.

Execution runs under `playbooks/autonomous-run.md` once the operator gives the go. I own every milestone. The operator reviews the card set at AC-04 and the visual direction at AC-06 before those milestones close.

Tests alone are not sufficient verification. A milestone is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the run

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] On the go, create `main` with one bootstrap commit that holds `CLAUDE.md`, `.gitignore`, and this plan, then push it.
- [ ] Create one branch per milestone from the previous milestone's merged head. Name them `ac-01-bootstrap` through `ac-07-docs`.
- [ ] Re-read `CLAUDE.md` and this plan at the start of every milestone.

### Keep the loop

- [ ] For each milestone, write the failing test first, then the code, then run the full suite.
- [ ] Verify on the real surface for that milestone. Engine milestones use the headless harness. The UI milestone uses a real browser through the browser tool.
- [ ] Record the perf number with the command that produced it. A number without a command is a guess.
- [ ] Commit each milestone as one commit on its branch. Open one PR per branch. Squash merge after the review gate.
- [ ] Write a `State` line at the top of each milestone section when it closes. It names the head SHA and the evidence paths.

### Close the run

- [ ] Every box above is checked with its evidence.
- [ ] The card table, the rules reference, and the engine agree. The generated catalog test proves it.
- [ ] The full suite passes on the merged head with a clean tree.
- [ ] Reply to the operator with the milestone table, the evidence paths, the perf numbers, and what stays open.

## Bootstrap the repo and tooling (AC-01)

**Entry gate.** The repo holds only `CLAUDE.md` and this plan. Node 20 or newer and npm are on the host.

**Deliverables.**

- [ ] Create `package.json` with scripts `dev`, `build`, `preview`, `test`, `typecheck`, `sim`, `selfplay`, and `docs:check`.
- [ ] Create `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.
- [ ] Create `vite.config.ts`, `index.html`, `src/main.tsx`, and `src/ui/App.tsx` with a placeholder screen.
- [ ] Create `src/engine/index.ts` with the package boundary and one smoke test in `src/engine/smoke.test.ts`.
- [ ] Create `.gitignore` for `node_modules`, `dist`, and `coverage`.
- [ ] Rewrite the `CLAUDE.md` commands section to name the real scripts and the real folder map.
- [ ] Write `README.md` with install, dev, test, and a one-paragraph project description.

**Verify, unit and perf.** Tests alone are not sufficient verification. A milestone is verified only when its unit, live, and perf boxes are all checked.

- [ ] `npm install` exits 0 and writes a lockfile.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run build` exits 0 and prints the bundle size.
- [ ] `npm test` runs one smoke test, 1 passed.
- [ ] Live. `npm run dev` serves the placeholder. Load it in the browser tool and confirm the heading renders with zero console errors. Save `ac-01-placeholder.png`.
- [ ] Perf. The built JS payload is under 200 KB gzip. Record the number from the build output.

**Review gate.** None. AC-01 is not review-gated.

## Build the engine spine (AC-02)

**Entry gate.** AC-01 is merged. `npm run typecheck`, `npm run build`, and `npm test` are green on `main`.

**Deliverables.**

- [ ] Create `src/engine/types.ts` with `GameState`, `PlayerState`, `CardInstance`, `CardDef`, `Action`, `GameEvent`, `PlayerId`, and the zone types. `PlayerState` records `playedThisRound`, the ordered list of cards that player has played this round.
- [ ] Create `src/engine/rng.ts` with a mulberry32 generator whose state lives in `GameState`.
- [ ] Create `src/engine/setup.ts` with `createGame(seed, decks, champions)`.
- [ ] Create `src/engine/actions.ts` with `applyAction(state, action)` for `MULLIGAN`, `PLAY_CARD`, and `PASS`.
- [ ] Create `src/engine/legality.ts` with `getLegalActions(state)`.
- [ ] Create `src/engine/turn.ts` with the round frame, energy refill, draw, attack token flip, deck out, and the round 20 draw.
- [ ] Create `src/engine/hash.ts` with a stable state hash for replay tests.
- [ ] Create test fixtures with a small catalog of vanilla cards, separate from the real card set.

**Verify, unit and perf.** Tests alone are not sufficient verification. A milestone is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/engine/turn.test.ts` covers opening hands of 4 for the first player and 5 for the second, one mulligan only, energy 1 through 10, the 3 point spell mana cap, unspent energy loss, pass then pass ending the round, one draw per round, the attack token flip, the 10 card hand limit, deck out as a loss, and round 20 as a draw.
- [ ] `src/engine/replay.test.ts` applies one recorded action list twice from the same seed and asserts identical state hashes.
- [ ] `src/engine/legality.test.ts` asserts an illegal action returns a typed rejection and never mutates state.
- [ ] Live. `npm run sim -- --seed 1 --rounds 20` prints a round by round log and a terminal result. Paste the last five lines into the milestone `State` line.
- [ ] Perf. `scripts/perf-actions.ts` applies 10,000 random legal actions. p95 under 5 ms per action. Record the number.

**Review gate.** None. AC-02 changes no interaction.

## Build combat and keywords (AC-03)

**Entry gate.** AC-02 is merged with a green suite.

**Deliverables.**

- [ ] Create `src/engine/combat.ts` with attack declaration, target selection, adjacency interception, and damage resolution.
- [ ] Create `src/engine/keywords.ts` with Quick Attack, Challenger, Barrier, Tough, and Overwhelm.
- [ ] Create `src/engine/zones.ts` with the six slot shared row and the two slot per player back zone.
- [ ] Extend `applyAction` with `DECLARE_ATTACK` and `ASSIGN_INTERCEPTORS`.
- [ ] Extend `getLegalActions` with legal attackers, targets, and interceptors.

**Verify, unit and perf.** Tests alone are not sufficient verification. A milestone is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/engine/combat.test.ts` covers unblocked damage to the nexus, interception from an adjacent slot, refusal from a non adjacent slot, one interceptor per attacker, Quick Attack killing before retaliation, Barrier absorbing one instance, Tough reducing damage by one, Overwhelm spilling excess to the nexus, a dead target redirecting the attack to the nexus, and summoning sickness.
- [ ] `src/engine/keywords.test.ts` covers Challenger pulling a unit into an adjacent empty slot and doing nothing when no slot is free.
- [ ] Live. `npm run sim -- --seed 3 --combat` prints a log with an interception and a Quick Attack exchange. Save the log at `docs/evidence/ac-03-combat.log`.
- [ ] Perf. 1,000 scripted combats resolve at p95 under 2 ms. Record the number.

**Review gate.** None. AC-03 changes no interaction.

## Build the card system and the card set (AC-04)

**Entry gate.** AC-03 is merged. Combat tests are green.

**Deliverables.**

- [ ] Create `src/engine/effects.ts` with the effect registry and handlers for damage, heal, buff, grant a keyword, draw, summon, return to hand, destroy, gain energy, cost reduction, copy, create a card in hand, clone a unit, and delayed effect. Target scopes cover a single unit, all enemy units, all allied units, the nexus, and a School.
- [ ] Create `src/engine/auras.ts` with source-keyed static modifiers for the School effects, Existentialism, the Luther level 2 aura, and the Marx level 2 bomb modifier. Recompute them when stats or costs are read, and drop them when the source leaves play.
- [ ] Create `src/engine/cost.ts` with `costOf(state, player, instance)`. It applies the floor at 0 and serves legality, the UI, and the AI.
- [ ] Create `src/engine/placement.ts` with the leftmost empty slot rule and partial summons.
- [ ] Create `src/engine/triggers.ts` with the trigger bus, the ordering rule, the after condition, and the earlier this round condition.
- [ ] Create `src/engine/delayed.ts` with the delayed effect queue that resolves at turn start.
- [ ] Create `src/engine/champions.ts` with level progress, the two form transform, the transform timing rules, and progress persistence.
- [ ] Create `src/cards/` with one file per champion set, one neutral file, one token file, and an `index.ts` registry.
- [ ] Create `src/cards/decks.ts` with the three 40 card decklists from Appendix E.
- [ ] Create `src/cards/validate.ts` with the data integrity checks used by the test suite.

**Verify, unit and perf.** Tests alone are not sufficient verification. A milestone is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/cards/cards.test.ts` asserts unique ids, valid effect references, a cost and stats on every deckable card, and a legal deck for each champion. Legal means exactly 40 cards, at most 3 copies, 3 champion copies, and one copy of each School.
- [ ] `src/engine/effects.test.ts` covers every handler at least once, including all enemy and all allied scopes, a School target, a keyword grant, and a copy of each Argument played this round.
- [ ] `src/engine/triggers.test.ts` covers active player first ordering, the after and earlier this round conditions, one trigger per event, and no infinite loop on a copied trigger.
- [ ] `src/engine/rules.test.ts` covers the Appendix F rules. Unit membership, one champion per player, play versus summon, placement and partial summons, entering play, target legality, hand overflow, the cost floor, static bonuses, transform timing, and the strongest and weakest tiebreaks.
- [ ] `src/engine/champions.test.ts` levels each champion through its condition and asserts the complete level two text and stats. Marx resolves three Time Bombs. Lacan plays three copied cards. Luther summons six followers.
- [ ] Live. `npm run sim -- --seed 5 --champion marx` reaches a terminal state and logs the level up. Repeat for `lacan` and `luther`. Save the three logs at `docs/evidence/ac-04-<champion>.log`.
- [ ] Perf. A scripted full game resolves in under 200 ms. 1,000 seeded games run without a crash. Record both numbers.
- [ ] Review. The card table in Appendix E and the three champion kits are the design review artifact.

**Review gate.** The operator reviews the card table, the champion kits, and the decklists before merge. AC-04 is review-gated.

- [ ] Post the Appendix E table and the three level conditions in chat.
- [ ] Wait for the operator's approval or corrections.
- [ ] Apply corrections as one follow-up commit on the same branch.

## Build the AI opponent (AC-05)

**Entry gate.** AC-04 is merged. All three champion games reach a terminal state in the harness.

**Deliverables.**

- [ ] Create `src/ai/score.ts` with the position scoring function.
- [ ] Create `src/ai/choose.ts` with `chooseAction(state, playerId)`. It uses `getLegalActions`, scores each result, and breaks ties with the seeded RNG.
- [ ] Create `src/ai/selfplay.ts` as the harness behind `npm run selfplay`.
- [ ] Create `src/ai/random.ts` as the baseline opponent for the win rate test.

**Verify, unit and perf.** Tests alone are not sufficient verification. A milestone is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/ai/ai.test.ts` runs 200 self play games. Every game terminates within 20 rounds and no action is illegal.
- [ ] The heuristic bot beats the random bot in at least 55 percent and at most 95 percent of 200 seeded games.
- [ ] `chooseAction` never mutates state and returns the same action for the same state and seed.
- [ ] Live. `npm run selfplay -- --games 200 --seed 7` prints the win rate and the average game length. Save the output at `docs/evidence/ac-05-selfplay.txt`.
- [ ] Perf. Decision p95 under 10 ms. A full AI game under 2 s. Record both numbers.

**Review gate.** None. AC-05 changes no interaction.

## Build the UI and settle the visual direction (AC-06)

**Entry gate.** AC-05 is merged. A bot can play a full game through the engine.

**Deliverables.**

- [ ] Sketch three visual directions as static HTML in `docs/sketches/`. Each sketch shows the match screen with the same board state.
- [ ] Apply the chosen direction as design tokens in `src/ui/tokens.css`.
- [ ] Create `src/ui/App.tsx` with the champion select, match, and result screens.
- [ ] Create `src/ui/Board.tsx`, `Row.tsx`, `Slot.tsx`, `BackZone.tsx`, `Hand.tsx`, `Card.tsx`, `CombatOverlay.tsx`, `Log.tsx`, and `Result.tsx`.
- [ ] Create `src/ui/useGame.ts` with `useReducer` over `applyAction` and the AI turn effect.
- [ ] Add keyboard focus states, school labels next to color, and reduced motion handling.

**Verify, unit and perf.** Tests alone are not sufficient verification. A milestone is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/ui/App.test.tsx` renders a game from a fixture state and asserts the hand, the row, the health, and the energy.
- [ ] Live. Drive a full game in the browser tool from champion select to the result screen. Save ten screenshots under `docs/evidence/ac-06-<n>-<slug>.png`.
- [ ] Live. Complete one full turn using only the keyboard. Save `ac-06-keyboard.png`.
- [ ] Live. The console is clean on load, on a play, on combat, and on the result screen.
- [ ] Perf. First contentful paint under 1 s locally. An AI turn renders in under 500 ms after the action resolves. Record both numbers from the browser performance timeline.
- [ ] Review. The three sketches are the design checkpoint.

**Review gate.** The operator reviews the visual direction before the UI is built, then reviews the built match screen before merge. AC-06 is review-gated.

- [ ] Post the three sketches with a recommendation and the tradeoffs.
- [ ] Wait for the pick.
- [ ] After the build, post the match screen screenshots and a short screen recording.

## Write the documentation (AC-07)

**Entry gate.** AC-06 is merged. The playable build is on `main`.

**Deliverables.**

- [ ] Rewrite `README.md` as a how-to for install, dev, test, and a first game.
- [ ] Create `docs/design/game-design.md` as the explanation of the pillars, the champions, and the shape of a match.
- [ ] Create `docs/design/rules.md` as the reference for the turn frame, timing, combat, keywords, zones, and win conditions.
- [ ] Create `docs/design/cards.md` as the generated catalog for all 36 cards and 2 tokens.
- [ ] Create `docs/architecture.md` with the module map, the state shape, the action and event flow, the RNG, the AI, and the test layout.
- [ ] Create `docs/card-authoring.md` as the how-to for adding a card, an effect, and a test.
- [ ] Create `docs/contributing.md` with setup, scripts, conventions, and the definition of done.
- [ ] Create `scripts/gen-cards-doc.ts` behind `npm run docs:cards`.
- [ ] Create `scripts/check-docs.ts` behind `npm run docs:check`.

**Verify, unit and perf.** Tests alone are not sufficient verification. A milestone is verified only when its unit, live, and perf boxes are all checked.

- [ ] `npm run docs:check` exits 0. It regenerates the catalog and fails when the committed file differs, and it checks that every relative link resolves.
- [ ] Every command in the README runs from a clean clone.
- [ ] Follow `docs/card-authoring.md` to add one test card, run the suite, then revert. Save the transcript at `docs/evidence/ac-07-authoring.txt`.
- [ ] Live. Read the rules reference against a recorded game log and confirm every step in the log is described. List any gap and fix it.
- [ ] Perf. n/a. AC-07 changes documentation only, and its check is the docs check above.

**Review gate.** The operator reads the documentation before merge. AC-07 is review-gated.

## Appendix A. Prototype evidence

The visual direction is the one open design question that a sketch can settle. AC-06 produces three static sketches in `docs/sketches/` and the operator picks one. No other milestone carries an open question that needs a prototype.

The turn frame, the board shape, the combat model, and the champion kits were settled in the design interview on 2026-10-25. There is no prototype to keep for them, and the plan records the decisions in Appendix B.

## Appendix B. Alternatives rejected

- **Paired lanes instead of one shared row.** Rejected because the operator chose one shared row of six slots that both players contest. Paired lanes would have made targeting trivial and removed the positional decision.
- **Combat as a separate end of round phase.** Rejected because the operator confirmed that the attacker declares combat at any point in their turn. The mid turn declaration is what makes holding energy for a response meaningful.
- **Units attack nearest enemies automatically.** Rejected because it removes target choice and makes Challenger and Overwhelm meaningless.
- **A reaction window inside combat.** Deferred for v1. Arguments resolve immediately and combat resolves in one pass. The trigger bus leaves room for a later reaction window.
- **A full keyword set.** Rejected in favor of five keywords, only the ones the three champions need.
- **A deck builder.** Deferred. v1 ships three fixed decklists and a data driven deck format.
- **Online multiplayer.** Deferred. The pure engine and the action log make it possible later.
- **An effect DSL in card data.** Rejected in favor of a registry of typed handlers referenced by id. The handlers are easier to test and the card data stays readable.
- **A mutable engine with Immer.** Rejected to keep the dependency count low. Each action clones the shallow top level and writes to its own draft.
- **A server or database.** Rejected. The game is local and static.

## Appendix C. Risks

- **Card set scope.** 36 cards plus 2 tokens is the largest single milestone. It lands in AC-04. Watch for cards whose text cannot be expressed by the registry. Cut or rewrite the card rather than adding a one-off branch.
- **Trigger ordering bugs.** Chained triggers are the likeliest source of wrong outcomes. It lands in AC-04. The ordering rule is written in `docs/design/rules.md` and tested in `triggers.test.ts`. Any card that needs a new ordering rule gets cut from v1.
- **A weak AI.** The bot can be legal and still unfun. It lands in AC-05. The self play win rate against the random baseline is the gate, and a 55 to 95 percent band catches both a broken bot and a pushover.
- **Positional clarity in the UI.** Adjacency is the hardest rule to show. It lands in AC-06. The combat overlay must draw the adjacency lines and name the eligible interceptors before the defender picks.
- **Second player disadvantage.** The first player draws 4 and the second draws 5, and the first player holds the attack token. It lands in AC-01 and AC-05. The self play harness measures the first player win rate. If it exceeds 60 percent, give the second player 1 extra energy on their first turn as a follow-up.
- **Docs drift.** The card catalog is generated, and `docs:check` fails on a mismatch. The rules reference is the one hand written doc that can drift. AC-07 verifies it against a recorded log.
- **The 20 round cap hides slow decks.** A control deck may draw every game. It lands in AC-04. The self play harness reports draws. If draws exceed 20 percent of games, lower the starting health or raise the energy curve in a follow-up.

## Appendix D. Links and reading list

- `CLAUDE.md` holds the stack and the architecture intent. Read it before AC-01.
- `docs/PLAN.md` is this file. Read it at the start of every milestone.
- `reviews/2026-10-25-card-texts.md` records the adversarial review of the card set and the fixes it produced.
- `docs/design/rules.md` is written in AC-07 and is the source of truth for the turn frame.
- `docs/architecture.md` is written in AC-07 and is the map for AC-02 through AC-05.
- `docs/card-authoring.md` is written in AC-07 and is the guide for AC-04 changes after v1.
- `skills/architect` is the design pass for any new module that crosses a function boundary.
- `skills/technical-writing` governs every doc in AC-07.
- `skills/unslop` runs over this plan and every doc before delivery.

## Appendix E. Card set for review

The table proposes the v1 set. Costs are energy. Stats are attack and health. Text is the printed text. The Deck column marks the signature cards, C for champion, S for school, N for neutral, T for token.

The set has 40 deckable cards and 2 tokens. The six champion rows are three cards and their level 2 forms. A level 2 form is a complete replacement, not a deck card. A deck holds 3 copies of its champion's level 1 card.

| Id | Name | Type | Cost | Stats | Text | Deck |
| --- | --- | --- | --- | --- | --- | --- |
| marx | Karl Marx | Champion | 3 | 2/4 | When I am played and at the start of your turn, create a Time Bomb in your hand. | C |
| marx-2 | Karl Marx, level 2 | Champion | 3 | 4/5 | When I am played and at the start of your turn, create a Time Bomb in your hand. Time Bombs cost 1 and deal 2 more damage. | C |
| lacan | Jacques Lacan | Champion | 2 | 1/4 | The first time each round you play an Argument after a Thinker, create a copy of it in your hand. The copy costs 1 more. | C |
| lacan-2 | Jacques Lacan, level 2 | Champion | 2 | 3/5 | The first time each round you play an Argument after a Thinker, create a copy of it in your hand. Copies you create cost 1. When you play a copy, deal 1 damage to the enemy nexus. | C |
| luther | Martin Luther | Champion | 3 | 1/5 | When I attack, summon two 1/1 Congregants in empty slots. | C |
| luther-2 | Martin Luther, level 2 | Champion | 3 | 2/6 | When I attack, summon three Congregants in empty slots. Your Congregants have +1/+1. | C |
| historical-materialism | Historical Materialism | School | 2 | | When one of your units dies, your next Argument this round costs 1 less. This does not stack. | S |
| psychoanalysis | Psychoanalysis | School | 2 | | The second Argument you play each round costs 1 less. | S |
| reformation-theology | Reformation Theology | School | 2 | | When you summon a follower, give it +1/+0. | S |
| stoicism | Stoicism | School | 2 | | At the start of your turn, heal your nexus 1. | N |
| empiricism | Empiricism | School | 2 | | The first time each round you play an Argument after a Thinker, draw 1. | N |
| existentialism | Existentialism | School | 2 | | Your champion has +1/+1. | N |
| dialectic | Dialectic | Argument | 2 | | Deal 2 damage to a unit. If you played an Argument earlier this round, deal 2 more. | M |
| alienation | Alienation | Argument | 3 | | Return an enemy unit to its owner's hand. | M |
| proletariat | Proletariat | Thinker | 2 | 2/2 | When I am played, if you control another Thinker, give me +1/+1 permanently. | M |
| capital | Capital | Thinker | 4 | 3/4 | When I am played, gain 1 energy this round. | M |
| class-struggle | Class Struggle | Argument | 3 | | Destroy your weakest non-champion unit. If you do, deal damage equal to its current attack to an enemy unit you choose. | M |
| manifesto | Manifesto | Argument | 6 | | Deal 3 damage to all enemy units. Create a Time Bomb in your hand. | M |
| mirror-stage | Mirror Stage | Argument | 2 | | Summon a copy of an allied non-champion unit. The copy has 1 health and its printed stats and keywords. | L |
| repression | Repression | Argument | 3 | | Return an enemy unit to its owner's hand. It costs 1 more until the end of the round. | L |
| signifier | Signifier | Thinker | 2 | 1/3 | When you play an Argument after a Thinker, give me +1/+1 permanently. | L |
| objet-a | Objet Petit a | Thinker | 2 | 1/1 | When I die, draw 1. | L |
| name-of-the-father | Name of the Father | Argument | 4 | | Destroy a unit with 3 or more attack. | L |
| primal-scene | Primal Scene | Argument | 6 | | Create a copy of each other Argument you played this round in your hand. Draw 1. | L |
| ninety-five-theses | Ninety-Five Theses | Argument | 3 | | Summon two Congregants. | U |
| indulgence | Indulgence | Argument | 2 | | Gain 3 energy this round. Your nexus takes 2 damage. | U |
| reformation | Reformation | Thinker | 3 | 2/3 | When I am played, summon a Congregant. | U |
| sola-fide | Sola Fide | Argument | 2 | | Give a unit +1/+2 this round and Barrier. | U |
| congregation | Congregation | Argument | 4 | | Give your Congregants +2/+2 permanently. | U |
| here-i-stand | Here I Stand | Argument | 5 | | Give your units +2/+2 permanently and Overwhelm this round. | U |
| student | The Student | Thinker | 1 | 1/1 | When I die, draw 1. | N |
| lecturer | The Lecturer | Thinker | 2 | 2/2 | | N |
| archivist | The Archivist | Thinker | 3 | 2/3 | When I am played, draw 1. | N |
| polemicist | The Polemicist | Thinker | 3 | 3/2 | Quick Attack. | N |
| bulwark | The Bulwark | Thinker | 4 | 2/5 | Tough. | N |
| orator | The Orator | Thinker | 4 | 3/3 | When I attack, give another allied unit +1/+0 this round. | N |
| rebuttal | Rebuttal | Argument | 1 | | Deal 1 damage to a unit. | N |
| citation | Citation | Argument | 2 | | Draw 1. If you control a School, draw 1 more. | N |
| refutation | Refutation | Argument | 3 | | Deal 3 damage to a unit. | N |
| rhetoric | Rhetoric | Argument | 2 | | Give a unit +2/+0 this round and Overwhelm. | N |
| burden-of-proof | Burden of Proof | Argument | 3 | | Give a unit -2/+0 this round. | N |
| riposte | Riposte | Argument | 1 | | Give a unit Barrier. | N |
| repeal | Repeal | Argument | 3 | | Destroy an enemy School. | N |
| time-bomb | Time Bomb | Argument | 2 | | When you play me, at the start of your next turn, deal 4 damage to the strongest enemy unit. If the enemy controls no units, deal 2 damage to the enemy nexus. | T |
| congregant | Congregant | Token | | 1/1 | | T |

Time Bomb is a token Argument. It is not in a deck. Congregant is a token unit. It is not in a deck.

### Champions

- **Karl Marx.** A control champion who wins by scheduling damage. He seeds Time Bombs that resolve at the start of his next turn, and Historical Materialism turns his own losses into cheaper Arguments. Level condition, resolve 3 Time Bombs while Marx is on the table.
- **Jacques Lacan.** A combo champion who copies Arguments and rewards strict sequencing. He wants a Thinker then an Argument in that order, and Psychoanalysis makes the second Argument cheaper. Level condition, play 3 copied cards while Lacan is on the table.
- **Martin Luther.** A wide champion who turns one champion into a board. He summons Congregants on attack and Reformation Theology buffs them. Level condition, summon 6 followers while Luther is on the table.

### Decklists

Each deck is exactly 40 cards with at most 3 copies of a card and one copy of each School.

- **Marx.** 3 Karl Marx, 1 Historical Materialism, 1 Stoicism, 3 Dialectic, 3 Alienation, 3 Proletariat, 3 Capital, 3 Class Struggle, 3 Manifesto, 3 Rebuttal, 3 Refutation, 3 Burden of Proof, 3 The Archivist, 3 The Bulwark, 2 Repeal.
- **Lacan.** 3 Jacques Lacan, 1 Psychoanalysis, 1 Empiricism, 3 Mirror Stage, 3 Repression, 3 Signifier, 3 Objet Petit a, 3 Name of the Father, 3 Primal Scene, 3 Rebuttal, 3 Citation, 3 Rhetoric, 3 The Polemicist, 3 The Orator, 2 Repeal.
- **Luther.** 3 Martin Luther, 1 Reformation Theology, 1 Existentialism, 3 Ninety-Five Theses, 3 Indulgence, 3 Reformation, 3 Sola Fide, 3 Congregation, 3 Here I Stand, 3 Rebuttal, 3 Refutation, 3 The Student, 3 The Lecturer, 2 The Archivist, 1 The Orator, 2 Repeal.

## Appendix F. Rules decisions from the card review

The card texts assume these rules. They are normative for the engine and the rules reference.

1. **Units.** A unit is a Thinker, a champion, or a token in the row. Arguments and Schools are not units.
2. **One champion.** A player may control one champion. A card that would put a second champion into play does nothing. A copy of a champion is a non-champion unit with its printed stats and no level rules.
3. **Play, summon, follower.** Play a card from hand. Summon a unit into play with an effect or as a token. A summoned unit is not played. A follower is a unit you summoned, including a token. A token Argument is played and counts as an Argument.
4. **Placement.** When an effect summons a unit into an empty slot and the text does not name a slot, fill the leftmost empty slot. If there are fewer empty slots than the effect asks for, summon as many as fit.
5. **Entering play.** A unit cannot attack the round it entered play.
6. **After.** A card is played after another card when it is the next card that player plays in the same round. "Earlier this round" means any time earlier in the round, not necessarily the previous card.
7. **Targets.** An Argument that requires a target can be played only if it has a legal target. If all its targets are gone when it resolves, it does nothing.
8. **Strongest and weakest.** Strongest compares attack, then health, then slot order from left to right. Weakest is the reverse.
9. **Hand limits.** If a card would be created in a full hand, it is not created. A card returned to a full hand is discarded. A draw at 10 cards is discarded.
10. **Cost.** Cost is the greater of 0 and the base cost plus instance modifiers plus pending modifiers. A copy is priced from its base cost. A modifier that says "this round" expires at the end of the round. Modifiers of the same kind do not stack unless the card says so.
11. **Static abilities.** A static ability that refers to a card you do not control does nothing until that card enters play. A static bonus is keyed to its source and stops when the source leaves play. A delayed effect reads its values when it resolves.
12. **Transform.** When a champion's condition is met, it transforms immediately. The level 2 form is a complete replacement of the text.
    It keeps marked damage, and its maximum health becomes the printed value. If the marked damage is equal to or greater than the new maximum health, the champion dies.
    The transform does not trigger on-play or on-summon abilities. Progress persists per player. A champion replayed after death enters at level 1 and transforms at the start of your next turn if the stored progress still meets the condition.
13. **Keywords.** Barrier prevents the next damage the unit would take, then is removed. Tough reduces each incoming damage instance by 1. Overwhelm sends excess combat damage to the nexus. Quick Attack strikes first and takes no retaliation if the defender dies. Challenger, on play, pulls an enemy unit into an empty slot adjacent to the challenger.
14. **Nexus health.** Nexus health cannot exceed 20. Round 20 ends in a draw. Drawing from an empty deck loses.
15. **Schools.** A player may control one copy of a School. A School has no health and cannot be attacked. A destroyed School leaves its slot empty.
16. **Opening hands.** The first player draws 4 cards. The second player draws 5. Each player may mulligan once.
