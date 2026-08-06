
import { FlashcardData } from '../types';

export const parseCSV = (text: string): { data: FlashcardData[]; headers: string[] } => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { data: [], headers: [] };

  const headers = parseLine(lines[0]);
  const data = lines.slice(1).map(line => {
    const values = parseLine(line);
    const entry: FlashcardData = {};
    headers.forEach((header, index) => {
      entry[header] = values[index] || '';
    });
    return entry;
  });

  return { data, headers };
};

// Simple parser for a single line that handles quotes
const parseLine = (line: string): string[] => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};
