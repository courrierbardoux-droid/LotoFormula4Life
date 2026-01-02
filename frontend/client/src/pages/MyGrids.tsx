
import React, { useEffect, useState } from 'react';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import { LottoBall } from '@/components/casino/LottoBall';
import { getGridHistory, PlayedGrid, checkGridResult, chargerHistorique, getDernierTirage, Tirage, deleteGridHistory } from '@/lib/lotoService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";

export default function MyGrids() {
  const [history, setHistory] = useState<PlayedGrid[]>([]);
  const [lastDraw, setLastDraw] = useState<Tirage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGrids, setSelectedGrids] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      // 1. Load Real Draw History (for results checking)
      const tirages = await chargerHistorique();
      const latest = getDernierTirage(tirages);
      setLastDraw(latest);

      // 2. Load User Played Grids (from LocalStorage)
      const userGrids = getGridHistory();
      setHistory(userGrids);
      
      setLoading(false);
    };
    
    loadData();
    
    // Refresh interval to catch new plays if user navigates back and forth (though React mounts usually handle this)
    const interval = setInterval(() => {
        const userGrids = getGridHistory();
        // Simple check if length changed to avoid unnecessary re-renders loop if reference changes
        setHistory(prev => {
            if (prev.length !== userGrids.length) return userGrids;
            if (prev.length > 0 && userGrids.length > 0 && prev[0].id !== userGrids[0].id) return userGrids;
            return prev;
        });
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const toggleSelection = (id: string) => {
    setSelectedGrids(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedGrids.length === history.length && history.length > 0) {
      setSelectedGrids([]);
    } else {
      setSelectedGrids(history.map(g => g.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedGrids.length === 0) return;
    const newHistory = deleteGridHistory(selectedGrids);
    setHistory(newHistory);
    setSelectedGrids([]);
  };

  return (
    <CasinoLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* TITRE CENTRÉ ET ESPACÉ */}
        <div className="text-center my-12 py-6 relative">
            <h1 className="text-4xl md:text-5xl font-orbitron font-black text-white tracking-widest text-shadow-glow mb-2">
                MES GRILLES JOUÉES
            </h1>
            <div className="h-1 w-48 bg-casino-gold mx-auto rounded-full shadow-[0_0_15px_rgba(255,215,0,0.8)]" />
            
            {/* TRASH BUTTON - Absolute positioned to the right */}
            {selectedGrids.length > 0 && (
                <div className="absolute top-1/2 -translate-y-1/2 right-4 md:right-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <button 
                        onClick={handleDeleteSelected}
                        className="bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-500 rounded-full p-4 shadow-[0_0_15px_rgba(220,20,60,0.5)] transition-all hover:scale-110 flex items-center gap-3 group"
                        title="Supprimer la sélection"
                    >
                        <Trash2 size={24} className="group-hover:animate-bounce" />
                        <span className="font-bold font-rajdhani hidden md:inline">
                            SUPPRIMER ({selectedGrids.length})
                        </span>
                    </button>
                </div>
            )}
        </div>

        {/* TABLEAU AGRANDI (Zoom 1.5x via scale ou tailles police) */}
        {/* Utilisation de scale-110 (1.5x est peut-être trop grand pour mobile, mais on respecte la demande d'agrandissement significatif) 
            Le user a demandé "agrandi de 1.5x le tableau". On va utiliser un conteneur avec zoom/scale.
        */}
        <div className="transform md:scale-125 origin-top transition-transform duration-500 mb-32">
            <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-black text-zinc-400 text-sm md:text-base uppercase font-orbitron tracking-wider border-b border-zinc-700">
                    <th className="p-3 w-12 text-center">
                        <Checkbox 
                            checked={history.length > 0 && selectedGrids.length === history.length}
                            onCheckedChange={toggleSelectAll}
                            className="border-zinc-500 data-[state=checked]:bg-casino-gold data-[state=checked]:text-black"
                        />
                    </th>
                    <th className="p-3">Date Jeu</th>
                    <th className="p-3">Tirage Visé</th>
                    <th className="p-3 text-center">Combinaison</th>
                    <th className="p-3 text-center">Résultat</th>
                    <th className="p-3 text-right">Gain</th>
                    </tr>
                </thead>
                <tbody className="font-rajdhani text-base md:text-lg">
                    {history.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-12 text-center text-zinc-500 font-orbitron text-xl">
                                AUCUNE GRILLE JOUÉE POUR LE MOMENT
                            </td>
                        </tr>
                    ) : (
                        history.map((grid) => {
                            const result = checkGridResult(grid, lastDraw);
                            const isWin = result.gain > 0;
                            const isJackpot = result.status.includes('JACKPOT');
                            const isSelected = selectedGrids.includes(grid.id);
                            
                            return (
                                <tr 
                                    key={grid.id} 
                                    className={`border-b border-zinc-800 transition-colors group cursor-pointer ${isSelected ? 'bg-red-900/20' : 'hover:bg-white/5'}`}
                                    onClick={() => toggleSelection(grid.id)}
                                >
                                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox 
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSelection(grid.id)}
                                            className="border-zinc-500 data-[state=checked]:bg-casino-gold data-[state=checked]:text-black"
                                        />
                                    </td>
                                    <td className="p-3 text-zinc-300 whitespace-nowrap">
                                        {format(new Date(grid.date), 'dd/MM HH:mm')}
                                    </td>
                                    <td className="p-3 text-white font-bold text-lg whitespace-nowrap">
                                        {grid.drawDate ? format(new Date(grid.drawDate), 'dd MMMM yyyy', { locale: fr }) : '-'}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex justify-center gap-1 md:gap-2 scale-90 origin-center">
                                            {grid.numeros.map(n => (
                                                <LottoBall 
                                                    key={n} 
                                                    number={n} 
                                                    size="sm" 
                                                    className={lastDraw?.numeros.includes(n) ? "ring-2 ring-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" : ""}
                                                />
                                            ))}
                                            <div className="w-4 flex items-center justify-center text-zinc-600">|</div>
                                            {grid.etoiles.map(n => (
                                                <LottoBall 
                                                    key={n} 
                                                    number={n} 
                                                    size="sm" 
                                                    isStar 
                                                    className={lastDraw?.etoiles.includes(n) ? "ring-2 ring-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" : ""}
                                                />
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center whitespace-nowrap">
                                        <div className={`
                                            inline-block px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider
                                            ${isJackpot ? "bg-purple-900 text-purple-200 border border-purple-500 animate-pulse" : 
                                              isWin ? "bg-green-900/50 text-green-400 border border-green-500/50" : 
                                              result.status === 'En attente' ? "bg-blue-900/30 text-blue-300 border border-blue-500/30" :
                                              "text-zinc-500"}
                                        `}>
                                            {result.status}
                                        </div>
                                    </td>
                                    <td className={`p-3 text-right font-black text-xl md:text-2xl whitespace-nowrap ${isWin ? "text-casino-gold text-shadow-glow" : "text-zinc-600"}`}>
                                        {result.gain > 0 ? `${result.gain.toLocaleString()} €` : '-'}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
                </table>
            </div>
            </div>
            
            {/* Légende */}
            <div className="mt-6 flex justify-center gap-8 text-sm text-zinc-500 font-rajdhani">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                    <span>Numéro Sorti</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-casino-gold shadow-[0_0_5px_rgba(255,215,0,0.8)]" />
                    <span>Gain Validé</span>
                </div>
            </div>
        </div>
      </div>
    </CasinoLayout>
  );
}
