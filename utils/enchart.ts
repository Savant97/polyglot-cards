import { EnchartGrid } from '../types';

// Direct port of sentence() from the enchart miner (scripts lineage:
// fluent/analysis/build_encharts.py). Deterministic, no LLM at runtime.

export type EnchartMode = 'aff' | 'neg' | 'q';

export interface EnchartSelection {
  who: number;
  why: number;
  vp: number;
  adjunct: number;
}

const BARE = new Set(['can', 'must', 'will', 'should']);
const BARE_NEG: Record<string, string> = {
  can: "can't", must: "mustn't", will: "won't", should: "shouldn't",
};
const STEM: Record<string, string> = {
  'wants to': 'want to', 'needs to': 'need to', 'likes to': 'like to',
  'has to': 'have to', 'loves to': 'love to', 'tries to': 'try to',
  'hopes to': 'hope to', 'prefers to': 'prefer to',
};

const lc = (w: string): string => (w === 'I' ? w : w[0].toLowerCase() + w.slice(1));

export const assemble = (
  g: EnchartGrid,
  s: EnchartSelection,
  third: boolean,
  mode: EnchartMode
): string => {
  const who = (third ? g.who_3sg : g.who)[s.who];
  const why = (third ? g.why_3sg : g.why)[s.why];
  const tail = `${g.vp[s.vp]} ${g.adjunct[s.adjunct]}`;
  const head = why.split(' ')[0];

  if (mode === 'q') {
    if (BARE.has(head)) return `${head[0].toUpperCase()}${head.slice(1)} ${lc(who)} ${tail}?`;
    return `${third ? 'Does' : 'Do'} ${lc(who)} ${STEM[why] ?? why} ${tail}?`;
  }
  if (mode === 'neg') {
    if (BARE.has(head)) return `${who} ${BARE_NEG[head]} ${tail}.`;
    return `${who} ${third ? "doesn't" : "don't"} ${STEM[why] ?? why} ${tail}.`;
  }
  return `${who} ${why} ${tail}.`;
};

// Chip glosses for the fixed vocabulary. VP glosses travel in the JSON.
export const WHO_GLOSS: Record<string, string> = {
  I: 'yo', You: 'tú', We: 'nosotros', They: 'ellos',
  He: 'él', She: 'ella', 'The man': 'el hombre', 'My friend': 'mi amigo',
};

export const WHY_GLOSS: Record<string, string> = {
  'want to': 'querer', 'need to': 'necesitar', 'like to': 'gustar',
  'have to': 'tener que', 'love to': 'encantar', 'try to': 'intentar',
  'hope to': 'esperar', 'prefer to': 'preferir',
  can: 'poder', must: 'deber', will: '(futuro)', should: 'debería',
};

export const WHEN_GLOSS: Record<string, string> = {
  today: 'hoy', now: 'ahora', 'at night': 'por la noche',
  'every day': 'cada día', 'in the morning': 'por la mañana',
  'in the evening': 'por la tarde', tomorrow: 'mañana', soon: 'pronto',
  'at noon': 'al mediodía', 'every week': 'cada semana',
  tonight: 'esta noche', later: 'después',
};

export const whyGloss = (why: string): string => WHY_GLOSS[STEM[why] ?? why] ?? '';
