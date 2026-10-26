import { EFFECT_IDS } from '../engine/effects';
import { ALL_CARDS, CARD_CATALOG } from './index';

export function validateCatalog(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const card of ALL_CARDS) {
    if (seen.has(card.id)) {
      problems.push(`duplicate id ${card.id}`);
    }
    seen.add(card.id);

    for (const spec of card.effects ?? []) {
      if (!EFFECT_IDS.has(spec.effect)) {
        problems.push(`${card.id}: unknown effect ${spec.effect}`);
      }
    }

    if (card.level2 && !CARD_CATALOG[card.level2]) {
      problems.push(`${card.id}: missing level 2 form ${card.level2}`);
    }
    if (card.levelCondition && !card.level2) {
      problems.push(`${card.id}: level condition without level 2 form`);
    }
    if (card.type === 'argument' && (card.attack !== undefined || card.health !== undefined)) {
      problems.push(`${card.id}: argument has stats`);
    }
    if (card.type === 'school' && (card.attack !== undefined || card.health !== undefined)) {
      problems.push(`${card.id}: school has stats`);
    }
    if (
      (card.type === 'thinker' || card.type === 'champion' || card.type === 'token')
      && (card.attack === undefined || card.health === undefined)
    ) {
      problems.push(`${card.id}: unit missing stats`);
    }
  }

  return problems;
}

export function validateDeck(deck: string[], championId: string): string[] {
  const problems: string[] = [];
  if (deck.length !== 40) {
    problems.push(`deck has ${deck.length} cards, expected 40`);
  }

  const counts = new Map<string, number>();
  for (const id of deck) {
    const card = CARD_CATALOG[id];
    if (!card) {
      problems.push(`unknown card ${id}`);
      continue;
    }
    if (card.type === 'token') {
      problems.push(`token ${id} is not deckable`);
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  for (const [id, count] of counts) {
    if (count > 3) {
      problems.push(`${id} has ${count} copies, maximum 3`);
    }
    if (CARD_CATALOG[id]?.type === 'school' && count > 1) {
      problems.push(`${id} has ${count} copies, Schools are unique`);
    }
  }

  if ((counts.get(championId) ?? 0) !== 3) {
    problems.push(`${championId} has ${counts.get(championId) ?? 0} copies, expected 3`);
  }

  return problems;
}
