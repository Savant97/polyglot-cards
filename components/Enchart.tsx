import React, { useMemo, useState } from 'react';
import { EnchartGrid } from '../types';
import { assemble, whyGloss, EnchartMode, EnchartSelection, WHO_GLOSS, WHEN_GLOSS } from '../utils/enchart';

interface EnchartProps {
  grids: EnchartGrid[];
  ttsRate: number;
  ttsPitch: number;
  onClose: () => void;
}

const GRID_KEY = 'poly_enchart_grid';

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' ? window.speechSynthesis : undefined;

const speak = (text: string, rate: number, pitch: number) => {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  u.pitch = pitch;
  synth.speak(u);
};

const Enchart: React.FC<EnchartProps> = ({ grids, ttsRate, ttsPitch, onClose }) => {
  const [gridIdx, setGridIdx] = useState(() => {
    const saved = parseInt(localStorage.getItem(GRID_KEY) || '0', 10);
    return saved >= 0 && saved < grids.length ? saved : 0;
  });
  const [sel, setSel] = useState<EnchartSelection>({ who: 0, why: 0, vp: 0, adjunct: 0 });
  const [third, setThird] = useState(false);
  const [mode, setMode] = useState<EnchartMode>('aff');

  const grid = grids[gridIdx];
  const sentence = useMemo(
    () => (grid ? assemble(grid, sel, third, mode) : ''),
    [grid, sel, third, mode]
  );

  const pickGrid = (idx: number) => {
    setGridIdx(idx);
    setSel({ who: 0, why: 0, vp: 0, adjunct: 0 });
    localStorage.setItem(GRID_KEY, idx.toString());
  };

  const pick = (col: keyof EnchartSelection, i: number) => {
    const next = { ...sel, [col]: i };
    setSel(next);
    if (grid) speak(assemble(grid, next, third, mode), ttsRate, ttsPitch);
  };

  const surprise = () => {
    if (!grid) return;
    const next: EnchartSelection = {
      who: Math.floor(Math.random() * grid.who.length),
      why: Math.floor(Math.random() * grid.why.length),
      vp: Math.floor(Math.random() * grid.vp.length),
      adjunct: Math.floor(Math.random() * grid.adjunct.length),
    };
    const nextThird = Math.random() < 0.5;
    const nextMode: EnchartMode = (['aff', 'neg', 'q'] as EnchartMode[])[Math.floor(Math.random() * 3)];
    setSel(next);
    setThird(nextThird);
    setMode(nextMode);
    // Say it yourself first; the speaker button checks you afterwards.
    synth?.cancel();
  };

  if (!grid) {
    return (
      <div className="text-center space-y-4">
        <p className="text-xs font-bold text-[#93a1a1] uppercase tracking-widest">No grids loaded</p>
        <button onClick={onClose} className="px-8 py-3 bg-[#073642] text-[#fdf6e3] rounded-2xl font-bold text-xs uppercase">Back</button>
      </div>
    );
  }

  const who = third ? grid.who_3sg : grid.who;
  const why = third ? grid.why_3sg : grid.why;

  const rows: { label: string; col: keyof EnchartSelection; items: string[]; gloss: (w: string, i: number) => string }[] = [
    { label: 'Who', col: 'who', items: who, gloss: w => WHO_GLOSS[w] ?? '' },
    { label: 'Why', col: 'why', items: why, gloss: w => whyGloss(w) },
    { label: 'Action', col: 'vp', items: grid.vp, gloss: (_, i) => grid.vp_gloss?.[i] ?? '' },
    { label: 'When', col: 'adjunct', items: grid.adjunct, gloss: w => WHEN_GLOSS[w] ?? '' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 short:gap-2.5 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <select
          value={gridIdx}
          onChange={e => pickGrid(parseInt(e.target.value, 10))}
          className="flex-1 bg-[#fffcf0] border border-[#decba4]/30 rounded-2xl px-4 py-3 short:py-2 text-[11px] font-bold text-[#586e75] outline-none shadow-sm"
        >
          {grids.map((g, i) => <option key={g.id} value={i}>{g.id} · {g.topic}</option>)}
        </select>
        <button onClick={onClose} className="p-3 short:p-2 bg-[#eee8d5] rounded-2xl border border-[#decba4]/20 text-[#93a1a1] hover:text-[#586e75] transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* The built sentence: tap to hear it */}
      <button
        onClick={() => speak(sentence, ttsRate, ttsPitch)}
        className="w-full bg-[#fffcf0] rounded-[32px] shadow-[0_20px_60px_rgba(101,115,126,0.12)] border border-[#decba4]/30 px-6 py-8 short:py-4 text-center active:scale-[0.99] transition-transform"
      >
        <span className="block text-2xl sm:text-3xl short:text-xl font-black text-[#073642] leading-snug">{sentence}</span>
        <span className="mt-2 flex items-center justify-center gap-1.5 text-[9px] font-bold text-[#93a1a1] uppercase tracking-widest">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 5.343a1 1 0 011.414 0A7.975 7.975 0 0118.4 11a7.975 7.975 0 01-2.329 5.657 1 1 0 01-1.414-1.414A5.978 5.978 0 0016.4 11a5.978 5.978 0 00-1.743-4.243 1 1 0 010-1.414z" /></svg>
          Tap to hear
        </span>
      </button>

      {/* Transform toggles: the 3sg contrast is drilled, never skipped */}
      <div className="flex gap-2">
        {([['aff', 'Affirm'], ['neg', 'Negative'], ['q', 'Question']] as [EnchartMode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 short:py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${mode === m ? 'bg-[#268bd2] text-white shadow-lg shadow-[#268bd2]/20' : 'bg-[#eee8d5] text-[#93a1a1] border border-[#decba4]/20'}`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setThird(!third)}
          className={`flex-1 py-2.5 short:py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${third ? 'bg-[#859900] text-white shadow-lg shadow-[#859900]/20' : 'bg-[#eee8d5] text-[#93a1a1] border border-[#decba4]/20'}`}
        >
          3rd -s
        </button>
      </div>

      {/* One chip per column builds the sentence */}
      <div className="space-y-3 short:space-y-2">
        {rows.map(({ label, col, items, gloss }) => (
          <div key={col}>
            <div className="text-[9px] font-black text-[#93a1a1] uppercase tracking-widest mb-1.5 ml-1">{label}</div>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item, i) => (
                <button
                  key={`${item}-${i}`}
                  onClick={() => pick(col, i)}
                  className={`px-3 py-2.5 short:py-1.5 rounded-2xl text-left transition-all border ${sel[col] === i ? 'bg-[#268bd2]/10 border-[#268bd2]/40 shadow-sm' : 'bg-[#fffcf0] border-[#decba4]/20 hover:bg-[#eee8d5]'}`}
                >
                  <span className={`block text-[12px] font-bold leading-tight ${sel[col] === i ? 'text-[#073642]' : 'text-[#586e75]'}`}>{item}</span>
                  {gloss(item, i) && <span className="block text-[9px] text-[#93a1a1] leading-tight mt-0.5">{gloss(item, i)}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={surprise}
        className="w-full py-4 short:py-2.5 bg-[#cb4b16] text-white rounded-[28px] font-bold text-xs uppercase tracking-[0.2em] shadow-xl shadow-[#cb4b16]/20 active:scale-95 transition-all"
      >
        Surprise me — say it out loud
      </button>
    </div>
  );
};

export default Enchart;
