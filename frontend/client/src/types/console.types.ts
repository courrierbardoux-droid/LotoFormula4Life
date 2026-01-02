// Types pour la Console LotoFormula4Life

export interface DisplayStat {
  number: number;
  frequency: number;
  trendScore: number;
  trendDirection: 'hausse' | 'baisse' | 'stable';
  displayLabel?: string;
  rank?: number;
}

export type CategoryType = 'high' | 'mid' | 'low' | 'dormeur';

export type PresetConfig = {
  // Number Config
  highFreqCount: number;
  midFreqCount: number;
  lowFreqCount: number;
  highFreqActive: boolean;
  midFreqActive: boolean;
  lowFreqActive: boolean;
  
  // Star Config
  highStarCount: number;
  midStarCount: number;
  lowStarCount: number;
  highStarActive: boolean;
  midStarActive: boolean;
  lowStarActive: boolean;
  
  // Weights
  weightHigh: number;
  weightMid: number;
  weightLow: number;
  weightDormeur: number;
  weightStarHigh: number;
  weightStarMid: number;
  weightStarLow: number;
  weightStarDormeur: number;
  
  // Options
  avoidPairExt: boolean;
  balanceHighLow: boolean;
  avoidPopSeq: boolean;
  avoidFriday: boolean;

  // Mode
  mode: 'manual' | 'auto';
};

export type WeightPresetData = {
  weightHigh: number;
  weightMid: number;
  weightLow: number;
  weightDormeur: number;
  weightStarHigh: number;
  weightStarMid: number;
  weightStarLow: number;
  weightStarDormeur: number;
};

export type AutoDraw = {
  nums: number[];
  stars: number[];
  date: Date;
  revealed?: boolean;
};

export type TariffConfig = {
  nums: number;
  stars: number;
  price: number;
};
















