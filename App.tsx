
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FlashcardData, ViewMode } from './types';
import { parseCSV } from './utils/csvParser';
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
    if (!synth) return;
    const updateVoices = () => setAvailableVoices(synth.getVoices());
    synth.onvoiceschanged = updateVoices;
    updateVoices();
  }, []);

  const currentCard = cards[currentIndex] || null;
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

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
    if (synth && isTtsEnabled && currentCard && viewMode === ViewMode.STUDY) {
      synth.cancel();
      const textToSpeak = currentCard['Phrase'] || currentCard[activeColumns[0]];
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
  }, [currentIndex, isTtsEnabled, currentCard, viewMode, activeColumns, ttsLanguage, voicePreferences, ttsRate, ttsPitch]);

  useEffect(() => {
    if (shuffle) {
      setCards(prev => [...prev].sort(() => Math.random() - 0.5));
      setCurrentIndex(0);
    } else { setCards(parsed.data); }
  }, [shuffle, parsed.data]);

  useEffect(() => {
    if (!isAutoAdvancing) return;
    const timer = setInterval(handleNext, autoAdvanceInterval * 1000);
    return () => clearInterval(timer);
  }, [isAutoAdvancing, handleNext, autoAdvanceInterval]);

  return (
    <div className={`min-h-screen bg-[#fdf6e3] text-[#433422] font-lexend transition-all duration-700 ${isInZen ? 'overflow-hidden fixed inset-0 z-[100]' : 'overflow-x-hidden'}`} onMouseMove={resetZenTimer} onClick={resetZenTimer}>
      {!isInZen && (
        <header className="fixed top-0 left-0 right-0 z-40 px-6 py-6 flex justify-between items-center pointer-events-none">
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
          className={`fixed top-6 right-6 z-50 p-3 bg-[#eee8d5]/60 backdrop-blur-md rounded-full shadow-lg border border-[#decba4]/20 text-[#93a1a1] hover:text-[#cb4b16] transition-all duration-500 ${showZenControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}

      <main className={`relative flex flex-col items-center justify-center min-h-screen ${isInZen ? 'p-0 h-screen w-screen bg-[#fdf6e3]' : 'p-6'}`}>
        {viewMode === ViewMode.STUDY && (
          <div className={`w-full flex flex-col items-center ${isInZen ? 'h-full w-full' : 'max-w-5xl gap-10'}`}>
            {!isInZen && (
              <div className="w-full max-w-md space-y-2 flex flex-col items-center">
                <div className="flex justify-between w-full px-1 text-[10px] font-bold text-[#93a1a1] uppercase tracking-widest">
                  <span>{currentIndex + 1} / {cards.length}</span>
                </div>
                <div className="w-full h-1.5 bg-[#eee8d5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#859900] transition-all duration-1000 ease-in-out" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div 
              className={`w-full flex items-center justify-center transition-all ${isInZen ? 'flex-1 h-full' : 'gap-4 sm:gap-12'}`}
              onClick={() => { synth?.resume(); handleNext(); }}
            >
              {!isInZen && (
                <button 
                  onClick={(e) => { e.stopPropagation(); synth?.resume(); handlePrev(); }} 
                  className="hidden md:flex p-6 rounded-[28px] bg-[#eee8d5] border border-[#decba4]/20 text-[#93a1a1] hover:text-[#586e75] shadow-sm transition-all active:scale-90"
                >
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              
              <div className={`transition-all duration-500 ${isInZen ? 'w-full h-full' : 'w-full max-w-2xl'}`}>
                <Flashcard card={currentCard} activeColumns={activeColumns} fontSizeScale={fontSizeScale} isZen={isInZen} />
              </div>

              {!isInZen && (
                <button 
                  onClick={(e) => { e.stopPropagation(); synth?.resume(); handleNext(); }} 
                  className="hidden md:flex p-6 rounded-[28px] bg-[#eee8d5] border border-[#decba4]/20 text-[#93a1a1] hover:text-[#586e75] shadow-sm transition-all active:scale-90"
                >
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
              )}
            </div>

            {!isInZen && (
              <div className="flex flex-col items-center gap-6">
                <button 
                  onClick={(e) => { e.stopPropagation(); synth?.resume(); setIsAutoAdvancing(!isAutoAdvancing); }} 
                  className={`flex items-center gap-4 px-12 py-5 rounded-[28px] font-bold text-sm uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${isAutoAdvancing ? 'bg-[#073642] text-[#fdf6e3]' : 'bg-[#268bd2] text-white shadow-[#268bd2]/20 hover:bg-[#2aa198]'}`}
                >
                  {isAutoAdvancing ? 'PAUSE' : 'START AUTO'}
                </button>
                <div className="text-[10px] font-bold text-[#93a1a1] uppercase tracking-widest">{isAutoAdvancing ? `Cycling at ${autoAdvanceInterval}s` : 'Manual Mode'}</div>
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
            shuffle={shuffle} setShuffle={setShuffle} onCsvImport={(csv) => { setCsvSource(csv); setCards(parseCSV(csv).data); setCurrentIndex(0); setViewMode(ViewMode.STUDY); }}
            onReset={() => { localStorage.clear(); location.reload(); }}
            totalCards={cards.length} currentIndex={currentIndex} onJumpToIndex={handleJumpToIndex}
            onClose={() => setViewMode(ViewMode.STUDY)}
          />
        )}
      </main>

      {!isInZen && (
        <footer className="md:hidden fixed bottom-safe left-0 right-0 px-6 flex justify-between gap-4 pointer-events-none">
            <button onClick={() => { synth?.resume(); handlePrev(); }} className="flex-1 py-5 bg-[#eee8d5] border border-[#decba4]/20 rounded-2xl shadow-lg flex justify-center text-[#93a1a1] pointer-events-auto active:bg-[#decba4]/40">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => { synth?.resume(); handleNext(); }} className="flex-1 py-5 bg-[#eee8d5] border border-[#decba4]/20 rounded-2xl shadow-lg flex justify-center text-[#93a1a1] pointer-events-auto active:bg-[#decba4]/40">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </button>
        </footer>
      )}
    </div>
  );
};

export default App;
