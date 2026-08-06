
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

export enum ViewMode {
  STUDY = 'STUDY',
  SETTINGS = 'SETTINGS',
  LIST = 'LIST'
}
