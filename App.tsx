
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FlashcardData, SrsGrade, SrsStore, ViewMode } from './types';
import { parseCSV } from './utils/csvParser';
import { buildQueue, cardKey, countQueue, intervalLabel, schedule, todayIndex } from './utils/srs';
import { DEFAULT_CSV_DATA } from './constants';
import Flashcard from './components/Flashcard';
import Settings from './components/Settings';

// Not every engine exposes speech (some WebViews, headless browsers). Touching it
// unguarded took the whole app down with a blank screen.
const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' ? window.speechSynthesis : undefined;

const STORAGE_KEYS = {
  CSV_SOURCE: 'poly_csv_source',
  ACTIVE_COLUMNS: 'poly_active_columns',
  AUTO_INTERVAL: 'poly_auto_interval',
  FONT_SCALE: 'poly_font_scale',
  SHUFFLE: 'poly_shuffle',
  TTS_ENABLED: 'poly_tts_enabled',
  TTS_LANG: 'poly_tts_lang',
  VOICE_PREFS: 'poly_voice_prefs',
  CURRENT_INDEX: 'poly_current_index',
  TTS_RATE: 'poly_tts_rate',
  TTS_PITCH: 'poly_tts_pitch',
  SRS_MODE: 'poly_srs_mode',
  SRS_STORE: 'poly_srs_store',
  SRS_NEW_PER_DAY: 'poly_srs_new_per_day',
  SRS_FRONT: 'poly_srs_front',
  SRS_DAILY: 'poly_srs_daily',
};

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const App: React.FC = () => {
  const [csvSource, setCsvSource] = useState(() => localStorage.getItem(STORAGE_KEYS.CSV_SOURCE) || DEFAULT_CSV_DATA);
  const parsed = useMemo(() => parseCSV(csvSource), [csvSource]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.STUDY);
  const [cards, setCards] = useState<FlashcardData[]>(parsed.data);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [showZenControls, setShowZenControls] = useState(true);
  const zenTimerRef = useRef<number | null>(null);
  
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_INDEX);
    return saved ? parseInt(saved, 10) : 0;
  });
  
  const [activeColumns, setActiveColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_COLUMNS);
    return saved ? JSON.parse(saved) : ['Phrase', 'IPA', 'ES Translation'];
  });

  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const [autoAdvanceInterval, setAutoAdvanceInterval] = useState(() => parseFloat(localStorage.getItem(STORAGE_KEYS.AUTO_INTERVAL) || '5.0'));
  const [fontSizeScale, setFontSizeScale] = useState(() => parseFloat(localStorage.getItem(STORAGE_KEYS.FONT_SCALE) || '2.2'));
  const [shuffle, setShuffle] = useState(() => localStorage.getItem(STORAGE_KEYS.SHUFFLE) === 'true');
  const [isTtsEnabled, setIsTtsEnabled] = useState(() => localStorage.getItem(STORAGE_KEYS.TTS_ENABLED) === 'true');
  const [ttsLanguage, setTtsLanguage] = useState(() => localStorage.getItem(STORAGE_KEYS.TTS_LANG) || 'auto');
  const [ttsRate, setTtsRate] = useState(() => parseFloat(localStorage.getItem(STORAGE_KEYS.TTS_RATE) || '0.9'));
  const [ttsPitch, setTtsPitch] = useState(() => parseFloat(localStorage.getItem(STORAGE_KEYS.TTS_PITCH) || '1.0'));

  const [voicePreferences, setVoicePreferences] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VOICE_PREFS);
    return saved ? JSON.parse(saved) : {};
  });

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // --- Spaced repetition ---
  const [srsMode, setSrsMode] = useState(() => localStorage.getItem(STORAGE_KEYS.SRS_MODE) === 'true');
  const [srsStore, setSrsStore] = useState<SrsStore>(() => readJson<SrsStore>(STORAGE_KEYS.SRS_STORE, {}));
  const [newPerDay, setNewPerDay] = useState(() => parseInt(localStorage.getItem(STORAGE_KEYS.SRS_NEW_PER_DAY) || '20', 10));
  const [frontColumn, setFrontColumn] = useState(() => localStorage.getItem(STORAGE_KEYS.SRS_FRONT) || 'ES Translation');
  const [dailyNew, setDailyNew] = useState(() => {
    const saved = readJson<{ day: number; count: number } | null>(STORAGE_KEYS.SRS_DAILY, null);
    return saved && saved.day === todayIndex() ? saved.count : 0;
  });
  const [queue, setQueue] = useState<FlashcardData[]>([]);
  const [queuePos, setQueuePos] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);

  const isInZen = isFullscreen || isZenMode;

  const resetZenTimer = useCallback(() => {
    if (!isInZen) return;
    setShowZenControls(true);
    if (zenTimerRef.current) window.clearTimeout(zenTimerRef.current);
    zenTimerRef.current = window.setTimeout(() => setShowZenControls(false), 2500);
  }, [isInZen]);

  useEffect(() => {
    if (isInZen) resetZenTimer();
    return () => { if (zenTimerRef.current) window.clearTimeout(zenTimerRef.current); };
  }, [isInZen, resetZenTimer]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => setIsZenMode(true));
      } else {
        document.exitFullscreen();
      }
    } else {
      setIsZenMode(!isZenMode);
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CSV_SOURCE, csvSource);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_COLUMNS, JSON.stringify(activeColumns));
    localStorage.setItem(STORAGE_KEYS.AUTO_INTERVAL, autoAdvanceInterval.toString());
    localStorage.setItem(STORAGE_KEYS.FONT_SCALE, fontSizeScale.toString());
    localStorage.setItem(STORAGE_KEYS.SHUFFLE, shuffle.toString());
    localStorage.setItem(STORAGE_KEYS.TTS_ENABLED, isTtsEnabled.toString());
    localStorage.setItem(STORAGE_KEYS.TTS_LANG, ttsLanguage);
    localStorage.setItem(STORAGE_KEYS.VOICE_PREFS, JSON.stringify(voicePreferences));
    localStorage.setItem(STORAGE_KEYS.CURRENT_INDEX, currentIndex.toString());
    localStorage.setItem(STORAGE_KEYS.TTS_RATE, ttsRate.toString());
    localStorage.setItem(STORAGE_KEYS.TTS_PITCH, ttsPitch.toString());
  }, [csvSource, activeColumns, autoAdvanceInterval, fontSizeScale, shuffle, isTtsEnabled, ttsLanguage, voicePreferences, currentIndex, ttsRate, ttsPitch]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SRS_MODE, srsMode.toString());
    localStorage.setItem(STORAGE_KEYS.SRS_STORE, JSON.stringify(srsStore));
    localStorage.setItem(STORAGE_KEYS.SRS_NEW_PER_DAY, newPerDay.toString());
    localStorage.setItem(STORAGE_KEYS.SRS_FRONT, frontColumn);
    localStorage.setItem(STORAGE_KEYS.SRS_DAILY, JSON.stringify({ day: todayIndex(), count: dailyNew }));
  }, [srsMode, srsStore, newPerDay, frontColumn, dailyNew]);

  useEffect(() => {
    if (!synth) return;
    const updateVoices = () => setAvailableVoices(synth.getVoices());
    synth.onvoiceschanged = updateVoices;
    updateVoices();
  }, []);

  const currentCard = cards[currentIndex] || null;

  const srsCard = queue[queuePos] || null;
  const displayCard = srsMode ? srsCard : currentCard;
  // Before the reveal only the prompt column is on screen; that is the whole
  // point of the mode, so it must not fall back to the full column set.
  const displayColumns = srsMode && !isRevealed ? [frontColumn] : activeColumns;
  const srsCounts = useMemo(() => countQueue(parsed.data, srsStore, todayIndex()), [parsed.data, srsStore]);
  const isSessionDone = srsMode && queuePos >= queue.length;

  const progress = srsMode
    ? (queue.length > 0 ? (queuePos / queue.length) * 100 : 0)
    : (cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0);

  const startSrsSession = useCallback(() => {
    setQueue(buildQueue(parsed.data, srsStore, todayIndex(), newPerDay, dailyNew));
    setQueuePos(0);
    setIsRevealed(false);
  }, [parsed.data, srsStore, newPerDay, dailyNew]);

  // Deliberately not rebuilt on every grade: the queue is a session snapshot,
  // otherwise answering a card would reshuffle the cards still ahead of it.
  useEffect(() => {
    if (srsMode) startSrsSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srsMode, parsed.data, newPerDay]);

  const handleGrade = useCallback((grade: SrsGrade) => {
    const card = queue[queuePos];
    if (!card) return;
    const day = todayIndex();
    const key = cardKey(card);
    const wasNew = !srsStore[key];

    setSrsStore(prev => ({ ...prev, [key]: schedule(prev[key], grade, day) }));
    if (wasNew) setDailyNew(n => n + 1);
    // A forgotten card returns at the end of the same session, not tomorrow.
    if (grade === 'again') setQueue(prev => [...prev, card]);
    setQueuePos(p => p + 1);
    setIsRevealed(false);
  }, [queue, queuePos, srsStore]);

  const handleNext = useCallback(() => {
    if (cards.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % cards.length);
    if (isInZen) resetZenTimer();
  }, [cards.length, isInZen, resetZenTimer]);

  const handlePrev = useCallback(() => {
    if (cards.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    if (isInZen) resetZenTimer();
  }, [cards.length, isInZen, resetZenTimer]);

  const handleJumpToIndex = (index: number) => {
    if (index >= 0 && index < cards.length) setCurrentIndex(index);
  };

  useEffect(() => {
    // In SRS the phrase IS the answer, so speaking it on arrival would give it away.
    if (srsMode && !isRevealed) return;
    if (synth && isTtsEnabled && displayCard && viewMode === ViewMode.STUDY) {
      synth.cancel();
      const textToSpeak = displayCard['Phrase'] || displayCard[activeColumns[0]];
      if (textToSpeak) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        let targetLang = ttsLanguage;
        if (ttsLanguage === 'auto') {
          const hasJapanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(textToSpeak);
          targetLang = hasJapanese ? 'ja-JP' : 'en-US';
        }
        const voices = synth.getVoices();
        const preferredVoiceName = voicePreferences[targetLang];
        let voice = voices.find(v => v.name === preferredVoiceName) || 
                    voices.find(v => v.lang.startsWith(targetLang.split('-')[0])) || 
                    voices.find(v => v.lang.includes(targetLang));
        if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
        else { utterance.lang = targetLang; }
        utterance.rate = ttsRate;
        utterance.pitch = ttsPitch;
        synth.speak(utterance);
      }
    }
  }, [currentIndex, isTtsEnabled, displayCard, viewMode, activeColumns, ttsLanguage, voicePreferences, ttsRate, ttsPitch, srsMode, isRevealed, queuePos]);

  useEffect(() => {
    if (shuffle) {
      setCards(prev => [...prev].sort(() => Math.random() - 0.5));
      setCurrentIndex(0);
    } else { setCards(parsed.data); }
  }, [shuffle, parsed.data]);

  useEffect(() => {
    if (!isAutoAdvancing || srsMode) return;
    const timer = setInterval(handleNext, autoAdvanceInterval * 1000);
    return () => clearInterval(timer);
  }, [isAutoAdvancing, handleNext, autoAdvanceInterval, srsMode]);

  return (
    <div className={`min-h-[100dvh] flex flex-col bg-[#fdf6e3] text-[#433422] font-lexend transition-all duration-700 ${isInZen ? 'overflow-hidden fixed inset-0 z-[100]' : 'overflow-x-hidden'}`} onMouseMove={resetZenTimer} onClick={resetZenTimer}>
      {!isInZen && (
        <header className="shrink-0 px-6 pt-safe pb-4 short:pb-1 flex justify-between items-center pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="w-8 h-8 bg-[#859900] rounded-xl flex items-center justify-center shadow-lg shadow-[#859900]/10">
               <div className="w-3 h-3 bg-white rounded-full opacity-80" />
            </div>
            <span className="font-bold text-xs tracking-widest text-[#93a1a1]">POLYCARDS</span>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button onClick={toggleFullscreen} className="p-3 rounded-2xl bg-[#eee8d5] shadow-sm border border-[#decba4]/20 hover:bg-[#decba4]/40 transition-all group">
              <svg className="w-5 h-5 text-[#93a1a1] group-hover:text-[#586e75] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
              </svg>
            </button>
            <button onClick={() => setViewMode(ViewMode.SETTINGS)} className="p-3 rounded-2xl bg-[#eee8d5] shadow-sm border border-[#decba4]/20 hover:bg-[#decba4]/40 transition-all group">
              <svg className="w-5 h-5 text-[#93a1a1] group-hover:text-[#586e75] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </header>
      )}

      {isInZen && (
        <button 
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} 
          className={`fixed top-safe right-6 z-50 p-3 bg-[#eee8d5]/60 backdrop-blur-md rounded-full shadow-lg border border-[#decba4]/20 text-[#93a1a1] hover:text-[#cb4b16] transition-all duration-500 ${showZenControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}

      <main className={`relative flex flex-1 flex-col items-center justify-center ${isInZen ? 'p-0 h-full w-full bg-[#fdf6e3]' : 'px-6 pb-safe'}`}>
        {viewMode === ViewMode.STUDY && (
          <div className={`w-full flex flex-col items-center ${isInZen ? 'h-full w-full' : 'max-w-5xl gap-6 sm:gap-10 short:gap-3'}`}>
            {!isInZen && (
              <div className="w-full max-w-md space-y-2 flex flex-col items-center">
                <div className="flex justify-between w-full px-1 text-[10px] font-bold text-[#93a1a1] uppercase tracking-widest">
                  <span>{srsMode ? `${Math.min(queuePos + 1, queue.length)} / ${queue.length}` : `${currentIndex + 1} / ${cards.length}`}</span>
                  {srsMode && <span>{srsCounts.due} due · {srsCounts.fresh} new</span>}
                </div>
                <div className="w-full h-1.5 bg-[#eee8d5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#859900] transition-all duration-1000 ease-in-out" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div 
              className={`w-full flex items-center justify-center transition-all ${isInZen ? 'flex-1 h-full' : 'gap-4 sm:gap-12'}`}
              onClick={() => {
                synth?.resume();
                if (srsMode) { if (!isRevealed) setIsRevealed(true); return; }
                handleNext();
              }}
            >
              {!isInZen && !srsMode && (
                <button 
                  onClick={(e) => { e.stopPropagation(); synth?.resume(); handlePrev(); }} 
                  className="hidden md:flex p-6 rounded-[28px] bg-[#eee8d5] border border-[#decba4]/20 text-[#93a1a1] hover:text-[#586e75] shadow-sm transition-all active:scale-90"
                >
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              
              <div className={`transition-all duration-500 ${isInZen ? 'w-full h-full' : 'w-full max-w-2xl'}`}>
                {isSessionDone ? (
                  <div className="bg-[#fffcf0] rounded-[40px] shadow-[0_20px_60px_rgba(101,115,126,0.12)] border border-[#decba4]/30 p-10 text-center space-y-4">
                    <p className="text-lg font-black text-[#073642]">Session complete</p>
                    <p className="text-xs text-[#93a1a1] font-bold uppercase tracking-widest">
                      {srsCounts.due} due · {srsCounts.fresh} unseen left
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); startSrsSession(); }}
                      className="px-8 py-3 bg-[#268bd2] text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95"
                    >
                      Study more
                    </button>
                  </div>
                ) : (
                  <Flashcard card={displayCard} activeColumns={displayColumns} fontSizeScale={fontSizeScale} isZen={isInZen} />
                )}
              </div>

              {!isInZen && !srsMode && (
                <button 
                  onClick={(e) => { e.stopPropagation(); synth?.resume(); handleNext(); }} 
                  className="hidden md:flex p-6 rounded-[28px] bg-[#eee8d5] border border-[#decba4]/20 text-[#93a1a1] hover:text-[#586e75] shadow-sm transition-all active:scale-90"
                >
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
              )}
            </div>

            {srsMode && !isSessionDone && (
              <div className="w-full max-w-md flex flex-col items-center gap-3">
                {!isRevealed ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); synth?.resume(); setIsRevealed(true); }}
                    className="w-full py-4 short:py-2.5 rounded-[28px] bg-[#268bd2] text-white font-bold text-sm uppercase tracking-[0.2em] shadow-xl shadow-[#268bd2]/20 active:scale-95 transition-all"
                  >
                    Show answer
                  </button>
                ) : (
                  <div className="w-full grid grid-cols-3 gap-2">
                    {([
                      { grade: 'again' as SrsGrade, label: 'Again', tone: 'bg-[#cb4b16] text-white' },
                      { grade: 'good' as SrsGrade, label: 'Good', tone: 'bg-[#859900] text-white' },
                      { grade: 'easy' as SrsGrade, label: 'Easy', tone: 'bg-[#2aa198] text-white' },
                    ]).map(({ grade, label, tone }) => (
                      <button
                        key={grade}
                        onClick={(e) => { e.stopPropagation(); handleGrade(grade); }}
                        className={`py-4 short:py-2.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest shadow-lg active:scale-95 transition-all ${tone}`}
                      >
                        {label}
                        <span className="block text-[9px] font-medium opacity-80 normal-case tracking-normal">
                          {srsCard ? intervalLabel(srsStore[cardKey(srsCard)], grade, todayIndex()) : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isInZen && !srsMode && (
              <div className="w-full flex flex-col items-center gap-4 sm:gap-6 short:gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); synth?.resume(); setIsAutoAdvancing(!isAutoAdvancing); }}
                  className={`flex items-center gap-4 px-10 py-4 sm:px-12 sm:py-5 short:py-2.5 rounded-[28px] font-bold text-sm uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${isAutoAdvancing ? 'bg-[#073642] text-[#fdf6e3]' : 'bg-[#268bd2] text-white shadow-[#268bd2]/20 hover:bg-[#2aa198]'}`}
                >
                  {isAutoAdvancing ? 'PAUSE' : 'START AUTO'}
                </button>
                <div className="text-[10px] font-bold text-[#93a1a1] uppercase tracking-widest">{isAutoAdvancing ? `Cycling at ${autoAdvanceInterval}s` : 'Manual Mode'}</div>

                {/* In-flow on phones: a fixed bar overlapped the label and the button on short screens */}
                <div className="md:hidden w-full flex justify-between gap-4">
                  <button onClick={(e) => { e.stopPropagation(); synth?.resume(); handlePrev(); }} className="flex-1 py-4 bg-[#eee8d5] border border-[#decba4]/20 rounded-2xl shadow-lg flex justify-center text-[#93a1a1] active:bg-[#decba4]/40">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); synth?.resume(); handleNext(); }} className="flex-1 py-4 bg-[#eee8d5] border border-[#decba4]/20 rounded-2xl shadow-lg flex justify-center text-[#93a1a1] active:bg-[#decba4]/40">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === ViewMode.SETTINGS && (
          <Settings 
            headers={parsed.headers} activeColumns={activeColumns} onToggleColumn={col => setActiveColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
            autoAdvanceInterval={autoAdvanceInterval} setAutoAdvanceInterval={setAutoAdvanceInterval}
            fontSizeScale={fontSizeScale} setFontSizeScale={setFontSizeScale}
            isTtsEnabled={isTtsEnabled} setIsTtsEnabled={setIsTtsEnabled}
            ttsLanguage={ttsLanguage} setTtsLanguage={setTtsLanguage}
            ttsRate={ttsRate} setTtsRate={setTtsRate} ttsPitch={ttsPitch} setTtsPitch={setTtsPitch}
            availableVoices={availableVoices} voicePreferences={voicePreferences} onSetVoicePreference={(lang, v) => setVoicePreferences(prev => ({ ...prev, [lang]: v }))}
            srsMode={srsMode} setSrsMode={setSrsMode}
            newPerDay={newPerDay} setNewPerDay={setNewPerDay}
            frontColumn={frontColumn} setFrontColumn={setFrontColumn}
            srsDue={srsCounts.due} srsFresh={srsCounts.fresh} srsLearned={Object.keys(srsStore).length}
            onResetSrs={() => { setSrsStore({}); setDailyNew(0); setQueue([]); setQueuePos(0); setIsRevealed(false); }}
            shuffle={shuffle} setShuffle={setShuffle} onCsvImport={(csv) => { setCsvSource(csv); setCards(parseCSV(csv).data); setCurrentIndex(0); setViewMode(ViewMode.STUDY); }}
            onReset={() => { localStorage.clear(); location.reload(); }}
            totalCards={cards.length} currentIndex={currentIndex} onJumpToIndex={handleJumpToIndex}
            onClose={() => setViewMode(ViewMode.STUDY)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
