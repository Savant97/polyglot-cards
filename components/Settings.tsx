
import React, { useRef, useMemo } from 'react';

interface SettingsProps {
  headers: string[];
  activeColumns: string[];
  onToggleColumn: (col: string) => void;
  autoAdvanceInterval: number;
  setAutoAdvanceInterval: (val: number) => void;
  fontSizeScale: number;
  setFontSizeScale: (val: number) => void;
  isTtsEnabled: boolean;
  setIsTtsEnabled: (val: boolean) => void;
  ttsLanguage: string;
  setTtsLanguage: (val: string) => void;
  ttsRate: number;
  setTtsRate: (val: number) => void;
  ttsPitch: number;
  setTtsPitch: (val: number) => void;
  availableVoices: SpeechSynthesisVoice[];
  voicePreferences: Record<string, string>;
  onSetVoicePreference: (lang: string, voiceName: string) => void;
  shuffle: boolean;
  setShuffle: (val: boolean) => void;
  srsMode: boolean;
  setSrsMode: (val: boolean) => void;
  newPerDay: number;
  setNewPerDay: (val: number) => void;
  frontColumn: string;
  setFrontColumn: (val: string) => void;
  srsDue: number;
  srsFresh: number;
  srsLearned: number;
  onResetSrs: () => void;
  onCsvImport: (csvText: string) => void;
  onReset: () => void;
  totalCards: number;
  currentIndex: number;
  onJumpToIndex: (index: number) => void;
  onClose: () => void;
}

const LANGUAGES = [
  { label: 'Auto (Smart Detect)', value: 'auto' },
  { label: 'Force English (US)', value: 'en-US' },
  { label: 'Force Japanese', value: 'ja-JP' },
  { label: 'Force Spanish', value: 'es-ES' },
];

const Settings: React.FC<SettingsProps> = ({
  headers, activeColumns, onToggleColumn,
  autoAdvanceInterval, setAutoAdvanceInterval,
  fontSizeScale, setFontSizeScale,
  isTtsEnabled, setIsTtsEnabled,
  ttsLanguage, setTtsLanguage,
  ttsRate, setTtsRate, ttsPitch, setTtsPitch,
  availableVoices, voicePreferences, onSetVoicePreference,
  shuffle, setShuffle, onCsvImport, onReset,
  srsMode, setSrsMode, newPerDay, setNewPerDay, frontColumn, setFrontColumn,
  srsDue, srsFresh, srsLearned, onResetSrs,
  totalCards, currentIndex, onJumpToIndex, onClose
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const voicesByLang = useMemo(() => {
    const map: Record<string, SpeechSynthesisVoice[]> = {};
    availableVoices.forEach(v => {
      const primary = v.lang.split('-')[0].toLowerCase();
      if (!map[primary]) map[primary] = [];
      map[primary].push(v);
    });
    return map;
  }, [availableVoices]);

  const currentPrimaryLang = ttsLanguage === 'auto' ? null : ttsLanguage.split('-')[0];

  const previewVoice = (voiceName: string, lang: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const text = lang === 'ja-JP' ? 'こんにちは。' : 'Hello there.';
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = availableVoices.find(v => v.name === voiceName);
    if (voice) utterance.voice = voice;
    utterance.rate = ttsRate;
    utterance.pitch = ttsPitch;
    synth.speak(utterance);
  };

  return (
    <div className="bg-[#fdf6e3] text-[#586e75] rounded-[40px] shadow-[0_30px_70px_rgba(101,115,126,0.15)] p-8 short:p-5 max-w-lg w-full mx-auto animate-in fade-in zoom-in-95 duration-500 border border-[#decba4]/30 max-h-[calc(100dvh-12rem)] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-2xl font-black text-[#073642] tracking-tight">Settings</h2>
          <p className="text-[#93a1a1] text-[10px] font-bold uppercase mt-1">{totalCards} cards loaded</p>
        </div>
        <button onClick={onClose} className="p-3 bg-[#eee8d5] hover:bg-[#decba4]/30 rounded-2xl transition-all text-[#93a1a1]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="space-y-10">
        <div className="p-5 bg-[#eee8d5] rounded-3xl border border-[#decba4]/20 flex items-center justify-between">
          <label className="text-[10px] font-black text-[#586e75] uppercase tracking-widest">Jump to Card</label>
          <input type="number" value={currentIndex + 1} onChange={e => onJumpToIndex(parseInt(e.target.value) - 1)} className="w-20 bg-[#fdf6e3] border border-[#decba4]/30 rounded-xl px-3 py-2 text-center text-xs font-black text-[#268bd2] focus:outline-none focus:ring-1 focus:ring-[#268bd2]" />
        </div>

        {/* Spaced repetition */}
        <div className="p-6 bg-[#eee8d5]/40 rounded-[32px] border border-[#decba4]/20 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-[#586e75]">Spaced Repetition</span>
              <p className="text-[9px] text-[#93a1a1] font-bold uppercase tracking-widest mt-1">Recall-first, scheduled reviews</p>
            </div>
            <button onClick={() => setSrsMode(!srsMode)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${srsMode ? 'bg-[#859900]' : 'bg-[#93a1a1]'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${srsMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {srsMode && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Due', value: srsDue, color: 'text-[#cb4b16]' },
                  { label: 'Learned', value: srsLearned, color: 'text-[#859900]' },
                  { label: 'Unseen', value: srsFresh, color: 'text-[#93a1a1]' },
                ].map(stat => (
                  <div key={stat.label} className="p-3 bg-[#fdf6e3] rounded-2xl border border-[#decba4]/30">
                    <div className={`text-sm font-black ${stat.color}`}>{stat.value}</div>
                    <div className="text-[8px] font-black text-[#93a1a1] uppercase tracking-widest mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-[#93a1a1] uppercase tracking-widest ml-1">Prompt Column</label>
                <select value={frontColumn} onChange={e => setFrontColumn(e.target.value)} className="w-full bg-[#fdf6e3] border border-[#decba4]/30 rounded-xl px-4 py-2.5 text-[10px] font-bold text-[#586e75] outline-none">
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <p className="text-[9px] text-[#93a1a1] ml-1">Shown first; everything else waits for the reveal.</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <label className="text-[9px] font-black text-[#93a1a1] uppercase">New Cards / Day</label>
                  <span className="text-[#268bd2] font-bold text-xs">{newPerDay}</span>
                </div>
                <input type="range" min="0" max="100" step="5" value={newPerDay} onChange={e => setNewPerDay(parseInt(e.target.value, 10))} className="w-full h-1.5 bg-[#eee8d5] rounded-full accent-[#268bd2]" />
              </div>

              <button onClick={onResetSrs} className="w-full py-3 border border-[#decba4]/40 rounded-2xl text-[10px] font-bold text-[#cb4b16]/60 uppercase hover:bg-orange-50 transition-colors">
                Reset Review History
              </button>
            </div>
          )}
        </div>

        {/* Visibility */}
        <div className="space-y-4">
          <h3 className="font-bold text-[#93a1a1] text-[9px] uppercase tracking-widest">Visible Columns</h3>
          <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
            {headers.map(header => (
              <button key={header} onClick={() => onToggleColumn(header)} className={`flex items-center p-3 border rounded-2xl transition-all ${activeColumns.includes(header) ? 'border-[#268bd2]/30 bg-[#268bd2]/10' : 'border-[#decba4]/20 opacity-60 hover:opacity-100 hover:bg-[#eee8d5]'}`}>
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${activeColumns.includes(header) ? 'bg-[#268bd2] border-[#268bd2]' : 'bg-[#fdf6e3] border-[#93a1a1]'}`}>
                  {activeColumns.includes(header) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="ml-3 font-bold text-[11px] text-[#586e75] tracking-tight">{header}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Audio Synthesis */}
        <div className="p-6 bg-[#eee8d5]/40 rounded-[32px] border border-[#decba4]/20 space-y-6">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-[#586e75]">Voice Synthesis</span>
            <button onClick={() => setIsTtsEnabled(!isTtsEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isTtsEnabled ? 'bg-[#859900]' : 'bg-[#93a1a1]'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isTtsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {isTtsEnabled && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <select value={ttsLanguage} onChange={(e) => setTtsLanguage(e.target.value)} className="w-full bg-[#fdf6e3] border border-[#decba4]/30 rounded-xl px-4 py-2.5 text-xs font-bold text-[#586e75] outline-none">
                {LANGUAGES.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
              </select>

              {ttsLanguage === 'auto' ? (
                <>
                  <VoicePicker label="English Voice" voices={voicesByLang['en'] || []} current={voicePreferences['en-US']} onSelect={v => onSetVoicePreference('en-US', v)} onPreview={v => previewVoice(v, 'en-US')} />
                  <VoicePicker label="Japanese Voice" voices={voicesByLang['ja'] || []} current={voicePreferences['ja-JP']} onSelect={v => onSetVoicePreference('ja-JP', v)} onPreview={v => previewVoice(v, 'ja-JP')} />
                </>
              ) : (
                <VoicePicker label="System Voice" voices={voicesByLang[currentPrimaryLang || 'en'] || []} current={voicePreferences[ttsLanguage]} onSelect={v => onSetVoicePreference(ttsLanguage, v)} onPreview={v => previewVoice(v, ttsLanguage)} />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-[#93a1a1] uppercase">Speed ({ttsRate}x)</label>
                  <input type="range" min="0.1" max="2" step="0.1" value={ttsRate} onChange={e => setTtsRate(parseFloat(e.target.value))} className="w-full h-1 bg-[#decba4]/40 appearance-none accent-[#268bd2] rounded-full" />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-[#93a1a1] uppercase">Pitch ({ttsPitch})</label>
                  <input type="range" min="0.1" max="2" step="0.1" value={ttsPitch} onChange={e => setTtsPitch(parseFloat(e.target.value))} className="w-full h-1 bg-[#decba4]/40 appearance-none accent-[#268bd2] rounded-full" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-3">
             <div className="flex justify-between items-end"><label className="text-[9px] font-black text-[#93a1a1] uppercase">Cycle Duration</label><span className="text-[#268bd2] font-bold text-xs">{autoAdvanceInterval}s</span></div>
             <input type="range" min="1" max="15" step="0.5" value={autoAdvanceInterval} onChange={e => setAutoAdvanceInterval(parseFloat(e.target.value))} className="w-full h-1.5 bg-[#eee8d5] rounded-full accent-[#268bd2]" />
          </div>
          <div className="space-y-3">
             <div className="flex justify-between items-end"><label className="text-[9px] font-black text-[#93a1a1] uppercase">Text Zoom</label><span className="text-[#268bd2] font-bold text-xs">{fontSizeScale.toFixed(1)}x</span></div>
             <input type="range" min="1" max="4" step="0.1" value={fontSizeScale} onChange={e => setFontSizeScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-[#eee8d5] rounded-full accent-[#268bd2]" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 border border-[#decba4]/40 rounded-2xl text-[10px] font-bold text-[#93a1a1] uppercase hover:bg-[#eee8d5] transition-colors">Import CSV</button>
          <button onClick={onReset} className="flex-1 py-4 border border-[#decba4]/40 rounded-2xl text-[10px] font-bold text-[#cb4b16]/60 uppercase hover:bg-orange-50 transition-colors">Reset</button>
          <input type="file" ref={fileInputRef} onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => onCsvImport(ev.target?.result as string); r.readAsText(f); } }} accept=".csv" className="hidden" />
        </div>

        <button onClick={onClose} className="w-full py-5 bg-[#073642] text-[#fdf6e3] rounded-3xl font-bold text-xs uppercase shadow-xl shadow-slate-900/10 hover:bg-[#002b36] transition-colors">Finish</button>
      </div>
    </div>
  );
};

const VoicePicker = ({ label, voices, current, onSelect, onPreview }: { label: string, voices: SpeechSynthesisVoice[], current?: string, onSelect: (name: string) => void, onPreview: (name: string) => void }) => {
  const activeVoiceName = current || (voices.find(v => v.default)?.name) || voices[0]?.name;
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-[#93a1a1] uppercase tracking-widest ml-1">{label}</label>
      <div className="flex gap-2">
        <select value={current || ""} onChange={e => onSelect(e.target.value)} className="flex-1 bg-[#fdf6e3] border border-[#decba4]/30 rounded-xl px-4 py-2.5 text-[10px] font-bold text-[#586e75] outline-none">
          <option value="">Default ({voices.find(v => v.default)?.localService ? 'Local' : 'Network'})</option>
          {voices.map(v => <option key={v.name} value={v.name}>{v.localService ? '🏠 ' : '🌐 '}{v.name}</option>)}
        </select>
        <button onClick={() => onPreview(activeVoiceName)} className="p-2 bg-[#eee8d5] text-[#268bd2] rounded-xl hover:bg-[#decba4]/30 transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
        </button>
      </div>
    </div>
  );
};

export default Settings;
