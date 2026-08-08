import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MissionScript } from '../types';

interface MissionProps {
  missions: MissionScript[];
  onClose: () => void;
}

// Answers persist per mission so a half-done interview survives a reload.
const answersKey = (id: string) => `poly_mission_answers_${id}`;

// Minimal Web Speech API surface: lib.dom has no SpeechRecognition types.
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

// Prefixed on Safari, absent on Firefox — typing is the fallback.
const Recognition: (new () => Recognizer) | undefined =
  typeof window !== 'undefined'
    ? ((window as unknown as Record<string, (new () => Recognizer) | undefined>)['SpeechRecognition'] ??
       (window as unknown as Record<string, (new () => Recognizer) | undefined>)['webkitSpeechRecognition'])
    : undefined;

const Mission: React.FC<MissionProps> = ({ missions, onClose }) => {
  const [missionIdx, setMissionIdx] = useState(() => {
    const saved = parseInt(localStorage.getItem('poly_mission_idx') || '0', 10);
    return saved >= 0 && saved < missions.length ? saved : 0;
  });
  const mission = missions[missionIdx] ?? null;
  const flat = useMemo(
    () => (mission ? mission.scenes.flatMap(s => s.questions.map(q => ({ scene: s.title, question: q }))) : []),
    [mission]
  );

  const loadAnswers = (m: MissionScript | null, n: number): string[] => {
    if (!m) return [];
    try {
      const raw = localStorage.getItem(answersKey(m.id));
      const saved = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.from({ length: n }, (_, i) => saved[i] ?? '');
    } catch {
      return Array.from({ length: n }, () => '');
    }
  };

  const [answers, setAnswers] = useState<string[]>(() => loadAnswers(mission, flat.length));
  const [pos, setPos] = useState(() => {
    const first = answers.findIndex(a => !a.trim());
    return first === -1 ? 0 : first;
  });

  const pickMission = (idx: number) => {
    const m = missions[idx];
    const n = m.scenes.reduce((acc, s) => acc + s.questions.length, 0);
    const loaded = loadAnswers(m, n);
    setMissionIdx(idx);
    setAnswers(loaded);
    const first = loaded.findIndex(a => !a.trim());
    setPos(first === -1 ? 0 : first);
    setReview(false);
    localStorage.setItem('poly_mission_idx', idx.toString());
  };
  const [review, setReview] = useState(false);
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const recRef = useRef<Recognizer | null>(null);

  useEffect(() => {
    if (mission) localStorage.setItem(answersKey(mission.id), JSON.stringify(answers));
  }, [answers, mission]);

  useEffect(() => () => recRef.current?.stop(), []);

  if (!mission) {
    return (
      <div className="text-center space-y-4">
        <p className="text-xs font-bold text-[#93a1a1] uppercase tracking-widest">No missions loaded</p>
        <button onClick={onClose} className="px-8 py-3 bg-[#073642] text-[#fdf6e3] rounded-2xl font-bold text-xs uppercase">Back</button>
      </div>
    );
  }

  const setAnswer = (i: number, text: string) =>
    setAnswers(prev => prev.map((a, j) => (j === i ? text : a)));

  const toggleMic = () => {
    if (!Recognition) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Recognition();
    recRef.current = rec;
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: RecognitionResultEvent) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(' ').trim();
      // Append to whatever is typed already; the textarea stays the source of truth.
      setAnswer(pos, (answers[pos] ? answers[pos] + ' ' : '') + text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };

  const exportPayload = () =>
    JSON.stringify(
      {
        mission: mission.id,
        title: mission.title,
        answers: flat.map((f, i) => ({ scene: f.scene, question: f.question, answer: answers[i].trim() })),
      },
      null,
      1
    );

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportPayload());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be denied; the textarea below is selectable by hand.
    }
  };

  const answered = answers.filter(a => a.trim()).length;

  if (review) {
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 short:gap-2.5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#073642]">{mission.title}</h2>
            <p className="text-[9px] font-bold text-[#93a1a1] uppercase tracking-widest mt-0.5">Revisa y corrige — luego exporta</p>
          </div>
          <button onClick={onClose} className="p-3 bg-[#eee8d5] rounded-2xl border border-[#decba4]/20 text-[#93a1a1]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-3 max-h-[55dvh] overflow-y-auto custom-scrollbar pr-1">
          {flat.map((f, i) => (
            <div key={i} className="bg-[#fffcf0] rounded-2xl border border-[#decba4]/30 p-4">
              <p className="text-[9px] font-black text-[#93a1a1] uppercase tracking-widest">{f.scene}</p>
              <p className="text-[11px] font-bold text-[#586e75] mt-1">{f.question}</p>
              <textarea
                value={answers[i]}
                onChange={e => setAnswer(i, e.target.value)}
                rows={2}
                className="mt-2 w-full bg-[#fdf6e3] border border-[#decba4]/30 rounded-xl px-3 py-2 text-[12px] text-[#073642] outline-none focus:ring-1 focus:ring-[#268bd2] resize-none"
                placeholder="(sin respuesta)"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setReview(false)} className="flex-1 py-4 short:py-2.5 border border-[#decba4]/40 rounded-2xl text-[10px] font-bold text-[#93a1a1] uppercase hover:bg-[#eee8d5]">Volver</button>
          <button onClick={copyExport} className="flex-[2] py-4 short:py-2.5 bg-[#268bd2] text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg active:scale-95">
            {copied ? '✓ Copiado' : 'Copy JSON'}
          </button>
        </div>
      </div>
    );
  }

  const current = flat[pos];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 short:gap-2.5 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <select
            value={missionIdx}
            onChange={e => pickMission(parseInt(e.target.value, 10))}
            className="w-full bg-[#fffcf0] border border-[#decba4]/30 rounded-2xl px-3 py-2.5 text-[12px] font-black text-[#073642] outline-none shadow-sm"
          >
            {missions.map((m, i) => <option key={m.id} value={i}>{m.id} · {m.title}</option>)}
          </select>
          <p className="text-[9px] font-bold text-[#93a1a1] uppercase tracking-widest mt-1 ml-1">
            {current.scene} · {pos + 1} / {flat.length} · responde en castellano
          </p>
        </div>
        <button onClick={onClose} className="p-3 bg-[#eee8d5] rounded-2xl border border-[#decba4]/20 text-[#93a1a1] shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="bg-[#fffcf0] rounded-[32px] shadow-[0_20px_60px_rgba(101,115,126,0.12)] border border-[#decba4]/30 px-6 py-8 short:py-4">
        <p className="text-xl sm:text-2xl short:text-lg font-black text-[#073642] leading-snug text-center">{current.question}</p>
      </div>

      <div className="relative">
        <textarea
          value={answers[pos]}
          onChange={e => setAnswer(pos, e.target.value)}
          rows={4}
          className="w-full bg-[#fffcf0] border border-[#decba4]/30 rounded-[24px] px-4 py-3 pr-16 text-[15px] text-[#073642] outline-none focus:ring-1 focus:ring-[#268bd2] resize-none shadow-sm"
          placeholder={Recognition ? 'Habla con el micro o escribe aquí…' : 'Escribe tu respuesta aquí…'}
        />
        {Recognition && (
          <button
            onClick={toggleMic}
            className={`absolute right-3 top-3 p-3 rounded-2xl transition-all ${listening ? 'bg-[#cb4b16] text-white animate-pulse' : 'bg-[#eee8d5] text-[#93a1a1] hover:text-[#586e75]'}`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setPos(p => Math.max(0, p - 1))}
          disabled={pos === 0}
          className="flex-1 py-4 short:py-2.5 border border-[#decba4]/40 rounded-2xl text-[10px] font-bold text-[#93a1a1] uppercase disabled:opacity-40 hover:bg-[#eee8d5]"
        >
          Anterior
        </button>
        {pos < flat.length - 1 ? (
          <button
            onClick={() => { recRef.current?.stop(); setPos(p => p + 1); }}
            className="flex-[2] py-4 short:py-2.5 bg-[#268bd2] text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg active:scale-95"
          >
            Siguiente
          </button>
        ) : (
          <button
            onClick={() => { recRef.current?.stop(); setReview(true); }}
            className="flex-[2] py-4 short:py-2.5 bg-[#859900] text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg active:scale-95"
          >
            Revisar ({answered}/{flat.length})
          </button>
        )}
      </div>
    </div>
  );
};

export default Mission;
