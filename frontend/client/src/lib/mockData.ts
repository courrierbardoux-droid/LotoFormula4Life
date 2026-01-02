
import { addDays, format, subDays } from "date-fns";

// Mock Data for LotoFormula4Life

export type Draw = {
  id: number;
  date: string;
  numbers: number[]; // 5 numbers
  stars: number[];   // 2 stars
};

export type NumberStat = {
  number: number;
  frequency: number; // 0-100
  trend: 'up' | 'stable' | 'down';
  trendScore: number; // 0-10
  lastSeen: string;
  cycleState: 'hot' | 'cold' | 'neutral';
};

// Generate some mock history
export const generateHistory = (count: number): Draw[] => {
  const history: Draw[] = [];
  let currentDate = new Date();
  
  for (let i = 0; i < count; i++) {
    currentDate = subDays(currentDate, i % 2 === 0 ? 3 : 4); // Tue/Fri approx
    const numbers = Array.from({ length: 5 }, () => Math.floor(Math.random() * 50) + 1).sort((a, b) => a - b);
    const stars = Array.from({ length: 2 }, () => Math.floor(Math.random() * 12) + 1).sort((a, b) => a - b);
    
    history.push({
      id: count - i,
      date: format(currentDate, 'yyyy-MM-dd'),
      numbers,
      stars
    });
  }
  return history;
};

export const MOCK_HISTORY = generateHistory(50);

export const LAST_DRAW = MOCK_HISTORY[0];

// Generate stats for all 50 numbers
export const NUMBER_STATS: NumberStat[] = Array.from({ length: 50 }, (_, i) => {
  const num = i + 1;
  const trendRandom = Math.random();
  const trend = trendRandom > 0.6 ? 'up' : trendRandom > 0.3 ? 'stable' : 'down';
  
  return {
    number: num,
    frequency: Math.floor(Math.random() * 100),
    trend,
    trendScore: Math.floor(Math.random() * 10) + 1,
    lastSeen: format(subDays(new Date(), Math.floor(Math.random() * 50)), 'yyyy-MM-dd'),
    cycleState: Math.random() > 0.6 ? 'hot' : Math.random() > 0.3 ? 'neutral' : 'cold'
  };
});
