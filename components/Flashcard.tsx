
import React from 'react';
import { FlashcardData } from '../types';

interface FlashcardProps {
  card: FlashcardData;
  activeColumns: string[];
  fontSizeScale: number;
  isZen?: boolean;
}

const Flashcard: React.FC<FlashcardProps> = ({ card, activeColumns, fontSizeScale, isZen }) => {
  const renderColumn = (col: string) => {
    const value = card[col];
    if (!value) return null;
    const lowerCol = col.toLowerCase();
    
    // Using deep brownish grey (ink) for text
    if (lowerCol.includes('phrase')) {
      return <p key={col} className="font-lexend text-[#433422] font-medium leading-[1.4]" style={{ fontSize: `${14 * fontSizeScale}px` }}>{value}</p>;
    }
    if (col === 'IPA') {
      return <p key={col} className="font-roboto text-[#93a1a1] font-normal tracking-[0.05em] leading-[1.2]" style={{ fontSize: `${11 * fontSizeScale}px` }}>{value}</p>;
    }
    if (lowerCol.includes('translation')) {
      return <p key={col} className="font-roboto text-[#268bd2] font-medium leading-[1.4]" style={{ fontSize: `${14 * fontSizeScale}px` }}>{value}</p>;
    }
    return (
      <div key={col} className="text-center">
        {!isZen && <span className="text-[10px] uppercase font-bold tracking-widest text-[#93a1a1] block mb-1">{col}</span>}
        <p className={`font-medium ${isZen ? 'text-[#839496]' : 'text-[#586e75]'}`} style={{ fontSize: `${12 * fontSizeScale}px` }}>{value}</p>
      </div>
    );
  };

  const orderedColumns = [...activeColumns].sort((a, b) => {
    const score = (s: string) => {
      const ls = s.toLowerCase();
      if (ls.includes('phrase')) return 1;
      if (s === 'IPA') return 2;
      if (ls.includes('translation')) return 3;
      return 4;
    };
    return score(a) - score(b);
  });

  return (
    <div className={`flex items-center justify-center transition-all duration-700 ${isZen ? 'w-full h-full bg-[#fdf6e3]' : 'bg-[#fffcf0] rounded-[40px] shadow-[0_20px_60px_rgba(101,115,126,0.12)] border border-[#decba4]/30 p-8 sm:p-12 short:p-5 min-h-[220px] sm:min-h-[320px] short:min-h-0'}`}>
      <div className={`flex flex-col items-center text-center w-full px-6 ${isZen ? 'space-y-12' : 'space-y-6 short:space-y-2'}`}>
        {orderedColumns.length > 0 ? (
          orderedColumns.map(col => (
            <div key={col} className="animate-in fade-in slide-in-from-bottom-2 duration-1000 w-full">
              {renderColumn(col)}
            </div>
          ))
        ) : (
          <p className="text-[#93a1a1] italic text-sm">Configure columns in settings</p>
        )}
      </div>
    </div>
  );
};

export default Flashcard;
