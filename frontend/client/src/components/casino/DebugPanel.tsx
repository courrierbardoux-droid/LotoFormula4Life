import React from 'react';
import { X, Database, Settings, List, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  stats: any; // Using any for simplicity with the complex StatsNumeros type, or import it
  mode: 'manual' | 'auto';
  config: {
    highFreqCount: number;
    midFreqCount: number;
    lowFreqCount: number;
    highStarCount: number;
    midStarCount: number;
    lowStarCount: number;
    weightHigh: number;
    weightMid: number;
    weightLow: number;
    weightDormeur: number;
    weightStarHigh: number;
    weightStarMid: number;
    weightStarLow: number;
    weightStarDormeur: number;
    avoidPairExt: boolean;
    balanceHighLow: boolean;
  };
  numberSources?: Record<number, 'high' | 'dormeur'>;
  starSources?: Record<number, 'high' | 'dormeur'>;
  dormeurProof?: {
    at: number;
    effectiveMode: 'manual' | 'auto';
    nums?: { level: number; k: number; before: number[]; toReplace: number[]; injected: number[]; after: number[] };
    stars?: { level: number; ks: number; before: number[]; toReplace: number[]; injected: number[]; after: number[] };
  } | null;
  selectedNumbers: number[];
  selectedStars: number[];
  generatedNumbers: number[];
  generatedStars: number[];
  lastDrawDate: string;
  totalDraws: number;
}

export function DebugPanel({
  isOpen,
  onClose,
  onToggle,
  stats,
  mode,
  config,
  numberSources,
  starSources,
  dormeurProof,
  selectedNumbers,
  selectedStars,
  generatedNumbers,
  generatedStars,
  lastDrawDate,
  totalDraws
}: DebugPanelProps) {
  
  // Helper to find stats for a number
  const getNumStats = (num: number) => {
    if (!stats) return null;
    // Search in all categories to find the number
    const catHigh = stats.categoriesNum.elevee.find((n: any) => n.numero === num);
    const catMid = stats.categoriesNum.moyenne.find((n: any) => n.numero === num);
    const catLow = stats.categoriesNum.basse.find((n: any) => n.numero === num);
    
    let category = 'INCONNUE';
    let freq = 0;
    
    if (catHigh) { category = 'ÉLEVÉE'; freq = catHigh.frequence; }
    else if (catMid) { category = 'MOYENNE'; freq = catMid.frequence; }
    else if (catLow) { category = 'BASSE'; freq = catLow.frequence; }
    
    const trend = stats.tendancesNumeros[num] || { score: 5, direction: 'stable' };
    
    return { category, freq, trend };
  };

  const getStarStats = (num: number) => {
    if (!stats) return null;
    const catHigh = stats.categoriesEtoiles.elevee.find((n: any) => n.numero === num);
    const catMid = stats.categoriesEtoiles.moyenne.find((n: any) => n.numero === num);
    const catLow = stats.categoriesEtoiles.basse.find((n: any) => n.numero === num);
    
    let category = 'INCONNUE';
    let freq = 0;
    
    if (catHigh) { category = 'CHAUDES'; freq = catHigh.frequence; }
    else if (catMid) { category = 'MOYENNES'; freq = catMid.frequence; }
    else if (catLow) { category = 'BASSES'; freq = catLow.frequence; }
    
    return { category, freq };
  };

  // Prefer showing latest generated draw when available (even if mode is 'manual')
  const numsToShow = generatedNumbers.length > 0 ? generatedNumbers : (mode === 'manual' ? selectedNumbers : generatedNumbers);
  const starsToShow = generatedStars.length > 0 ? generatedStars : (mode === 'manual' ? selectedStars : generatedStars);

  const srcLabel = (src?: 'high' | 'dormeur') => (src === 'dormeur' ? 'DORMEUR' : src === 'high' ? 'HIGH' : '—');

  return (
    <>
        {/* VIGNETTE TAB - REMOVED AS REQUESTED */}

        {/* SLIDING PANEL - Conditional Rendering */}
        {isOpen && (
            <>
                {/* Overlay to close when clicking outside */}
                <div 
                    className="fixed inset-0 z-[1000] bg-black/50"
                    onClick={onClose}
                />
                
                <div 
                    className={cn(
                        "fixed top-0 right-0 w-[600px] h-screen bg-[#0a0a0a] border-l-2 border-[#FFD700] overflow-y-auto font-mono text-base z-[1001] shadow-2xl"
                    )}
                >
                    <div className="p-6 space-y-8 text-zinc-300 pb-20">
        
        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-[#FFD700] pb-4 mb-6">
          <h3 className="text-[#FFD700] font-bold text-xl flex items-center gap-2">
             <Settings size={24} /> MODE DEBUG — DÉTAIL
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={32} />
          </button>
        </div>

        {/* DATABASE INFO */}
        <div className="space-y-4">
            <h4 className="text-white font-bold text-lg flex items-center gap-2">
                <Database size={20} /> BASE DE DONNÉES
            </h4>
            <div className="pl-6 border-l-2 border-zinc-800 space-y-2 text-lg">
                <div className="flex justify-between"><span>Tirages chargés :</span> <span className="text-white">{totalDraws}</span></div>
                <div className="flex justify-between"><span>Premier tirage :</span> <span className="text-white">2004-02-13</span></div>
                <div className="flex justify-between"><span>Dernier tirage :</span> <span className="text-white">{lastDrawDate}</span></div>
            </div>
        </div>

        {/* PARAMETERS */}
        <div className="space-y-4">
            <h4 className="text-white font-bold text-lg flex items-center gap-2">
                <Settings size={20} /> PARAMÈTRES UTILISÉS
            </h4>
            <div className="pl-6 border-l-2 border-zinc-800 space-y-2 text-lg">
                <div className="flex justify-between"><span>Mode :</span> <span className="text-[#FFD700] font-bold">{mode.toUpperCase()}</span></div>
                
                <div className="mt-4 text-zinc-400 font-bold">Pondération Numéros :</div>
                <div className="pl-4 space-y-1">
                    <div className="flex justify-between"><span>- Élevée :</span> <span className="text-white">{config.weightHigh}</span></div>
                    <div className="flex justify-between"><span>- Moyenne :</span> <span className="text-white">{config.weightMid}</span></div>
                    <div className="flex justify-between"><span>- Basse :</span> <span className="text-white">{config.weightLow}</span></div>
                    <div className="flex justify-between"><span>- Dormeur :</span> <span className="text-white">{config.weightDormeur}</span></div>
                </div>

                <div className="mt-4 text-zinc-400 font-bold">Pondération Étoiles :</div>
                <div className="pl-4 space-y-1">
                    <div className="flex justify-between"><span>- Élevée :</span> <span className="text-white">{config.weightStarHigh}</span></div>
                    <div className="flex justify-between"><span>- Moyenne :</span> <span className="text-white">{config.weightStarMid}</span></div>
                    <div className="flex justify-between"><span>- Basse :</span> <span className="text-white">{config.weightStarLow}</span></div>
                    <div className="flex justify-between"><span>- Dormeur :</span> <span className="text-white">{config.weightStarDormeur}</span></div>
                </div>

                <div className="mt-4 text-zinc-400 font-bold">Options :</div>
                <div className="pl-4 space-y-1">
                    <div className="flex justify-between"><span>- Pair/Impair :</span> <span className={config.avoidPairExt ? "text-green-400" : "text-zinc-600"}>{config.avoidPairExt ? "OUI" : "NON"}</span></div>
                    <div className="flex justify-between"><span>- Haut/Bas :</span> <span className={config.balanceHighLow ? "text-green-400" : "text-zinc-600"}>{config.balanceHighLow ? "OUI" : "NON"}</span></div>
                </div>
            </div>
        </div>

        {/* DORMEURS PROOF (runtime) */}
        <div className="space-y-4">
            <h4 className="text-white font-bold text-lg flex items-center gap-2">
                <List size={20} /> PREUVE DORMEURS (DERNIÈRE GÉNÉRATION)
            </h4>
            <div className="pl-6 border-l-2 border-zinc-800 space-y-2 text-lg">
                {!dormeurProof ? (
                    <div className="text-zinc-600 italic">Aucune preuve dormeurs (pas de remplacement exécuté)…</div>
                ) : (
                    <>
                        <div className="flex justify-between">
                            <span>Mode effectif :</span>
                            <span className="text-white">{dormeurProof.effectiveMode.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Horodatage :</span>
                            <span className="text-white">{format(new Date(dormeurProof.at), 'HH:mm:ss')}</span>
                        </div>
                        <div className="mt-3 text-zinc-400 font-bold">Boules :</div>
                        {dormeurProof.nums ? (
                            <div className="pl-4 space-y-1">
                                <div className="flex justify-between"><span>- Niveau :</span> <span className="text-white">{dormeurProof.nums.level}</span></div>
                                <div className="flex justify-between"><span>- k :</span> <span className="text-white">{dormeurProof.nums.k}</span></div>
                                <div><span className="text-zinc-400">- Avant :</span> <span className="text-white">{dormeurProof.nums.before.join(', ')}</span></div>
                                <div><span className="text-zinc-400">- Sacrifiés :</span> <span className="text-red-400">{dormeurProof.nums.toReplace.join(', ') || '—'}</span></div>
                                <div><span className="text-zinc-400">- Injectés :</span> <span className="text-blue-400">{dormeurProof.nums.injected.join(', ') || '—'}</span></div>
                                <div><span className="text-zinc-400">- Après :</span> <span className="text-white">{dormeurProof.nums.after.join(', ')}</span></div>
                            </div>
                        ) : (
                            <div className="pl-4 text-zinc-600 italic">Pas de remplacement boules.</div>
                        )}
                        <div className="mt-3 text-zinc-400 font-bold">Étoiles :</div>
                        {dormeurProof.stars ? (
                            <div className="pl-4 space-y-1">
                                <div className="flex justify-between"><span>- Niveau :</span> <span className="text-white">{dormeurProof.stars.level}</span></div>
                                <div className="flex justify-between"><span>- ks :</span> <span className="text-white">{dormeurProof.stars.ks}</span></div>
                                <div><span className="text-zinc-400">- Avant :</span> <span className="text-white">{dormeurProof.stars.before.join(', ')}</span></div>
                                <div><span className="text-zinc-400">- Sacrifiées :</span> <span className="text-red-400">{dormeurProof.stars.toReplace.join(', ') || '—'}</span></div>
                                <div><span className="text-zinc-400">- Injectées :</span> <span className="text-blue-400">{dormeurProof.stars.injected.join(', ') || '—'}</span></div>
                                <div><span className="text-zinc-400">- Après :</span> <span className="text-white">{dormeurProof.stars.after.join(', ')}</span></div>
                            </div>
                        ) : (
                            <div className="pl-4 text-zinc-600 italic">Pas de remplacement étoiles.</div>
                        )}
                    </>
                )}
            </div>
        </div>

        {/* NUMBERS DETAILS */}
        <div className="space-y-4">
            <h4 className="text-white font-bold text-lg flex items-center gap-2">
                <List size={20} /> NUMÉROS SÉLECTIONNÉS
            </h4>
            <div className="space-y-6">
                {numsToShow.length === 0 ? (
                    <div className="text-zinc-600 italic pl-6 text-lg">Aucun numéro généré...</div>
                ) : (
                    numsToShow.map((num, idx) => {
                        const s = getNumStats(num);
                        if (!s) return null;
                        return (
                            <div key={num} className="bg-[#1a1a1a] border border-zinc-800 rounded-lg p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-3xl font-bold text-[#FFD700] font-mono">[{num}]</span>
                                    <span className="text-base text-zinc-400">— Catégorie {s.category}</span>
                                </div>
                                <ul className="space-y-2 pl-4 text-sm text-zinc-400">
                                    <li>• Source : <span className={numberSources?.[num] === 'dormeur' ? "text-blue-400" : "text-white"}>{srcLabel(numberSources?.[num])}</span></li>
                                    <li>• Fréquence : <span className="text-white">{s.freq}/{totalDraws} ({((s.freq/totalDraws)*100).toFixed(1)}%)</span></li>
                                    <li>• Tendance : <span className={s.trend.score >= 7 ? "text-green-400" : s.trend.score <= 3 ? "text-blue-400" : "text-zinc-300"}>
                                        {s.trend.direction.toUpperCase()} ({s.trend.score}/10)
                                    </span></li>
                                    {mode === 'auto' && (
                                        <li>• Raison : Pondération active</li>
                                    )}
                                </ul>
                            </div>
                        );
                    })
                )}
            </div>
        </div>

        {/* STARS DETAILS */}
        <div className="space-y-4">
            <h4 className="text-white font-bold text-lg flex items-center gap-2">
                <Star size={20} /> ÉTOILES SÉLECTIONNÉES
            </h4>
            <div className="space-y-6">
                 {starsToShow.length === 0 ? (
                    <div className="text-zinc-600 italic pl-6 text-lg">Aucune étoile générée...</div>
                ) : (
                    starsToShow.map((num, idx) => {
                        const s = getStarStats(num);
                        if (!s) return null;
                        return (
                            <div key={`star-${num}`} className="bg-[#1a1a1a] border border-zinc-800 rounded-lg p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-3xl font-bold text-yellow-500 font-mono">[★{num}]</span>
                                    <span className="text-base text-zinc-400">— Catégorie {s.category}</span>
                                </div>
                                <ul className="space-y-2 pl-4 text-sm text-zinc-400">
                                    <li>• Source : <span className={starSources?.[num] === 'dormeur' ? "text-blue-400" : "text-white"}>{srcLabel(starSources?.[num])}</span></li>
                                    <li>• Fréquence : <span className="text-white">{s.freq}/{totalDraws} ({((s.freq/totalDraws)*100).toFixed(1)}%)</span></li>
                                    {mode === 'auto' && (
                                        <li>• Raison : Pondération active</li>
                                    )}
                                </ul>
                            </div>
                        );
                    })
                )}
            </div>
        </div>

      </div>
        </div>
        </>
        )}
    </>
  );
}
