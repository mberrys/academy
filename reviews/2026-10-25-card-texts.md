# Card text review, 2026-10-25

Scope. Appendix E of `docs/PLAN.md`. The set as reviewed held 36 deckable cards and 2 tokens. A follow-up closed the three deferred findings and brought the pool to 40 deckable cards.

Method. Four reviewers ran on the same model, `deepseek-v4.1-flash`, from four entry points because model diversity was unavailable. Reviewer A started at the rules and edge cases. Reviewer B started at the numbers and deck construction. Reviewer C started at the engine and the effect registry. Reviewer D started at a cold read of the text. They returned 40 raw findings. Consensus in this report means independently reached from different entry points, not cross-model agreement. The table records every finding that survived verification.

## Severity ladder

- P0. A correctness or contract breach. The card cannot be resolved as written, or the rule it needs does not exist.
- P1. A real defect or a balance outlier. The card resolves, but the outcome is wrong or the cost is off.
- P2. A structural gap that can wait for a later version.
- P3. A nit.

## P0, fixed here

| Id | Finding | Reviewers | Fix |
| --- | --- | --- | --- |
| P0-1 | The card texts assume rules that were never written. Unit membership, champion uniqueness, play versus summon, follower, after, target legality, hand overflow, cost arithmetic, static bonuses, and the strongest and weakest tiebreaks. | A1, A2, A3, A4, A6, A9, C2, C4, C5, C9, D1, D5, D6 | Added Appendix F with 14 normative rules. Corrected Proletariat and Reformation to "played," Signifier to the Thinker then Argument condition, and the affected removals to choose or name their target. |
| P0-2 | Time Bomb was a costed Token with no play instruction, no zone, and two different clocks. "Your next round" and the champion description "a round later" disagreed. | A5, A6, B1, C1, D2 | Retyped as a token Argument at 2 energy. It now reads "When you play me, at the start of your next turn, deal 4 damage to the strongest enemy unit. If the enemy controls no units, deal 2 damage to the enemy nexus." |
| P0-3 | The level 2 rows were modifiers rather than complete text, and the transform had no timing, damage, or retrigger rule. | A3, D1 | All three level 2 rows are self-contained. Appendix F rule 12 sets immediate transform, damage carry-over, the death check, no on-play retrigger, and the replay rule. |
| P0-4 | Luther's token engine was geometrically impossible. Two adjacent slots cannot hold three Congregants, and "beside me" fizzles when the opponent occupies them. "Follower" was undefined. | A10, B2, C3, C10, D4, D6 | Dropped "beside me." Added leftmost placement and partial summons. Defined play, summon, and follower. Level 2 now summons three anywhere. |
| P0-5 | Class Struggle passed a value from a destroyed unit to a damage handler with no channel, no tiebreak, and no target choice. | A8, C7 | One text. Destroy your weakest non-champion unit. If you do, deal damage equal to its attack to an enemy unit you choose. Unplayable with no legal target. |

## P1, fixed here

| Id | Finding | Reviewers | Fix |
| --- | --- | --- | --- |
| P1-1 | Time Bomb was 4 damage for 1 energy, created free every turn, and the default win. | B1 | Cost 2. Face damage 2. Level 2 makes bombs cost 1 and deal 2 more. |
| P1-2 | Stoicism healed 2 every turn with no cap and no answer. | A7, B4 | Heal 1 at the start of your turn. Appendix F rule 14 caps nexus health at 20. |
| P1-3 | Capital refunded half its printed cost, making it a 3/4 for 2 energy. | B8 | Gain 1 energy this round. |
| P1-4 | Empiricism drew on every Argument with no per-round cap and could deck its own pilot. | B6 | The first time each round. |
| P1-5 | Mirror Stage copied buffed stats and could copy a champion. | B5, C8, D7 | Copies a non-champion unit at printed stats and keywords with 1 health. |
| P1-6 | Lacan level 2 made every copy free and doubled the best removal spell. | B3, D1 | Copies cost 1. |
| P1-7 | Repression's cost penalty had no duration and could stack. | D9 | Until the end of the round. Appendix F rule 10 stops same-kind stacking. |
| P1-8 | Keyword grants sat inside a "this round" clause, so the keyword's duration was open. | D8 | Barrier is defined in Appendix F rule 13. Rhetoric grants Overwhelm this round. |
| P1-9 | Name of the Father killed low-attack units, which inverts the idea of the symbolic law. | D10 | Destroy a unit with 3 or more attack. |
| P1-10 | Every deck ran three School cards that could never be played, because a player may control one copy of a School. | A7, B9 | One copy of each School. Decklists refilled to 40 with playable cards. |

## P2, fixed in the follow-up

| Id | Finding | Reviewers | Fix |
| --- | --- | --- | --- |
| P2-1 | The curve tops at 4 energy, so 5 to 10 energy buys no new card and card draw becomes the only late resource. | B10 | Added Manifesto at 6, Primal Scene at 6, and Here I Stand at 5, one per faction, with 3 copies in each deck. |
| P2-2 | Schools have no health and no card can remove one. | A7 | Added Repeal at 3, a neutral Argument that destroys an enemy School. Each deck runs 2. Schools stay out of combat, which is the smaller fix. |
| P2-3 | The second player has no compensation. | None | The first player draws 4 and the second draws 5. Appendix F rule 16. |

## P3, noted

Naming and wording nits that the new rules text resolves. No separate action. The card table now uses one term per concept, and Appendix F defines each term it uses.

## Dismissed

- **Give Schools health and removal** (A7). Rejected the health half. Repeal adds the removal half without giving Schools a combat profile, which would add a new target layer to a set whose first job is to prove the champion engines.
- **Make Time Bomb hit only units** (B1, implicit). Rejected. The 2 damage face clause is Marx's control win condition. At 2 energy it is priced as a real play rather than a free clock.

## Agreement map

Time Bomb and Luther's token geometry were flagged by all four reviewers. Champion stacking, level 2 text, and the play, summon, follower vocabulary were each flagged by two or more. The balance findings were mostly Reviewer B alone, except Mirror Stage, which B and D both flagged. Reviewer C produced the engine gaps that made P0-1 concrete. The pattern says the rules layer was the real defect, and the individual card texts were symptoms of it.

## Verification

- `python C:/Users/micha/AppData/Local/hermes/skills/poteto-mode/scripts/check-plan.py docs/PLAN.md` prints 0 findings.
- The deck legality check reports three decks, 40 cards each, 14 distinct cards, 3 champion copies, no card above 3 copies, and no unknown names.
- The card table has 41 rows at the review commit. 36 are deckable, 3 are level 2 forms, and 2 are tokens.
- The review fixed 15 findings and deferred 3 at the first commit.

## Follow-up verification

- The plan checker prints 0 findings.
- The deck check reports three decks at 40 cards, 14 to 15 distinct cards, 3 champion copies, no card above 3 copies, and no unknown names.
- The card table has 45 rows. 40 are deckable, 3 are level 2 forms, and 2 are tokens.
- All 18 findings are fixed and none are deferred. The two rejected items above remain scope decisions, not factual disputes.
