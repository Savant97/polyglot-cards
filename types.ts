
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
  LIST = 'LIST'
}
