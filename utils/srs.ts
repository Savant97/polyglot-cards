
import { FlashcardData, SrsCardState, SrsGrade, SrsStore } from '../types';

const MIN_EF = 1.3;
const DEFAULT_EF = 2.5;
const DAY_MS = 86400000;

// Day granularity, anchored to local midnight: scheduling in absolute
// timestamps would make a card studied at 23:00 come back at 23:00.
export const todayIndex = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.round(d.getTime() / DAY_MS);
};

// A card is identified by its text, never by its position: reimporting the CSV
// or turning shuffle on must not throw away the review history.
export const cardKey = (card: FlashcardData): string =>
  card['Phrase'] || Object.values(card)[0] || '';

// SM-2, reduced to three grades. "again" resets the streak and drops the ease;
// the interval ladder for a card answered correctly is 1d, 6d, then iv * ease.
export const schedule = (
  prev: SrsCardState | undefined,
  grade: SrsGrade,
  day: number
): SrsCardState => {
  const reps = prev?.reps ?? 0;
  const ef = prev?.ef ?? DEFAULT_EF;
  const iv = prev?.iv ?? 0;

  if (grade === 'again') {
    return { reps: 0, ef: Math.max(MIN_EF, ef - 0.2), iv: 0, due: day };
  }

  let nextEf = ef;
  let nextIv: number;
  if (grade === 'easy') {
    nextEf = ef + 0.15;
    nextIv = reps === 0 ? 4 : Math.round(iv * ef * 1.3);
  } else {
    nextIv = reps === 0 ? 1 : reps === 1 ? 6 : Math.round(iv * ef);
  }
  nextIv = Math.max(1, nextIv);

  return { reps: reps + 1, ef: nextEf, iv: nextIv, due: day + nextIv };
};

export interface QueueCounts {
  due: number;
  fresh: number;
}

export const countQueue = (
  cards: FlashcardData[],
  store: SrsStore,
  day: number
): QueueCounts => {
  let due = 0;
  let fresh = 0;
  for (const card of cards) {
    const state = store[cardKey(card)];
    if (!state) fresh++;
    else if (state.due <= day) due++;
  }
  return { due, fresh };
};

// Cards already in review come first (oldest due first), then as many unseen
// cards as the daily budget still allows.
export const buildQueue = (
  cards: FlashcardData[],
  store: SrsStore,
  day: number,
  newPerDay: number,
  newDoneToday: number
): FlashcardData[] => {
  const due: FlashcardData[] = [];
  const fresh: FlashcardData[] = [];

  for (const card of cards) {
    const state = store[cardKey(card)];
    if (!state) fresh.push(card);
    else if (state.due <= day) due.push(card);
  }

  due.sort((a, b) => (store[cardKey(a)]?.due ?? 0) - (store[cardKey(b)]?.due ?? 0));

  const room = Math.max(0, newPerDay - newDoneToday);
  return [...due, ...fresh.slice(0, room)];
};

// Label for the grade buttons, so the cost of each answer is visible.
export const intervalLabel = (
  prev: SrsCardState | undefined,
  grade: SrsGrade,
  day: number
): string => {
  const next = schedule(prev, grade, day);
  if (next.iv === 0) return 'today';
  if (next.iv < 30) return `${next.iv}d`;
  if (next.iv < 365) return `${Math.round(next.iv / 30)}mo`;
  return `${(next.iv / 365).toFixed(1)}y`;
};
