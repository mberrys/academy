import { statsOf } from '../engine/auras';
import type { CardDef, CardInstance, GameState, Keyword } from '../engine/types';

export type CardSize = 'hand' | 'board' | 'mini';

export type CardProps = {
  def: CardDef;
  card?: CardInstance;
  state?: GameState;
  size?: CardSize;
  selected?: boolean;
  highlight?: boolean;
  playable?: boolean;
  onClick?: (() => void) | undefined;
};

const TYPE_LABEL: Record<CardDef['type'], string> = {
  champion: 'Champion',
  thinker: 'Thinker',
  argument: 'Argument',
  school: 'School',
  token: 'Token',
};

const KEYWORD_LABEL: Record<Keyword, string> = {
  quickAttack: 'Quick Attack',
  challenger: 'Challenger',
  barrier: 'Barrier',
  tough: 'Tough',
  overwhelm: 'Overwhelm',
};

export function Card({
  def,
  card,
  state,
  size = 'board',
  selected = false,
  highlight = false,
  playable = false,
  onClick,
}: CardProps) {
  const isUnit = def.type === 'thinker' || def.type === 'champion' || def.type === 'token';
  const stats = card && state ? statsOf(state, card, def) : { attack: def.attack ?? 0, health: def.health ?? 0 };
  const damage = card?.damage ?? 0;
  const currentHealth = Math.max(0, stats.health - damage);

  const keywordSet = new Set<Keyword>(def.keywords ?? []);
  for (const grant of card?.keywordGrants ?? []) {
    if (grant.expiresRound === null || !state || grant.expiresRound >= state.round) {
      keywordSet.add(grant.keyword);
    }
  }
  if (card?.barrierConsumed) {
    keywordSet.delete('barrier');
  }
  const keywords = [...keywordSet];

  const className = [
    'card',
    `card-${def.type}`,
    `card-${size}`,
    card?.owner === 'p2' ? 'card-opponent' : '',
    selected ? 'is-selected' : '',
    highlight ? 'is-highlight' : '',
    playable ? 'is-playable' : '',
  ].filter(Boolean).join(' ');

  const labelParts = [def.name, TYPE_LABEL[def.type], `cost ${def.cost}`];
  if (isUnit) {
    labelParts.push(`attack ${stats.attack}`, `health ${currentHealth} of ${stats.health}`);
  }
  if (keywords.length > 0) {
    labelParts.push(keywords.map((keyword) => KEYWORD_LABEL[keyword]).join(', '));
  }
  const label = labelParts.join(', ');

  const content = (
    <>
      <span className="card-type">{TYPE_LABEL[def.type]}</span>
      {def.id.endsWith('-2') && <span className="card-level">Level II</span>}
      <span className="card-cost" aria-hidden="true">{def.cost}</span>
      <span className="card-name">{def.name}</span>
      {def.text && <span className="card-text">{def.text}</span>}
      {keywords.length > 0 && (
        <span className="card-keywords">
          {keywords.map((keyword) => (
            <span className="keyword" key={keyword}>{KEYWORD_LABEL[keyword]}</span>
          ))}
        </span>
      )}
      {isUnit && (
        <span className="card-stats">
          <span className="stat"><span className="stat-label">ATK</span><span className="stat-value">{stats.attack}</span></span>
          <span className="stat"><span className="stat-label">HP</span><span className="stat-value">{currentHealth}</span><span className="stat-max">/ {stats.health}</span></span>
          {damage > 0 && <span className="card-damage">-{damage} damage</span>}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={label}
        title={def.text ?? def.name}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={className} aria-label={label} title={def.text ?? def.name}>
      {content}
    </article>
  );
}
