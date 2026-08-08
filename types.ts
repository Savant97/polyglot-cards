
export interface FlashcardData {
  [key: string]: string;
}

export interface AppState {
  cards: FlashcardData[];
  currentIndex: number;
  activeColumns: string[];
  isAutoAdvancing: boolean;
  autoAdvanceInterval: number;
  shuffle: boolean;
  fontSizeScale: number;
  isTtsEnabled: boolean;
  ttsLanguage: string;
}

export type SrsGrade = 'again' | 'good' | 'easy';

export interface SrsCardState {
  reps: number;
  ef: number;
  iv: number;
  due: number;
}

export type SrsStore = Record<string, SrsCardState>;

export enum ViewMode {
  STUDY = 'STUDY',
  SETTINGS = 'SETTINGS',
  LIST = 'LIST',
  ENCHART = 'ENCHART'
}

// One Velocity-style substitution grid mined from the deck (public/encharts.json).
export interface EnchartGrid {
  id: string;
  topic: string;
  source_rows: string;
  who: string[];
  why: string[];
  vp: string[];
  adjunct: string[];
  where_optional: string[];
  who_3sg: string[];
  why_3sg: string[];
  combinations: number;
  vp_gloss?: string[];
}
