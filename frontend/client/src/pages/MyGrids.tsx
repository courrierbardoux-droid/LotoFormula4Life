
import React, { useEffect, useState } from 'react';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import { LottoBall } from '@/components/casino/LottoBall';
import { loadGridsWithResults, deleteGridFromDB, ackWinningGrid, getRankLabel, PlayedGridWithResult } from '@/lib/lotoService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

export default function MyGrids() {
  const [history, setHistory] = useState<PlayedGridWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrids, setSelectedGrids] = useState<(string | number)[]>([]);
  const [highlightedGrids, setHighlightedGrids] = useState<Set<string | number>>(new Set());
  const [pulseStoppedIds, setPulseStoppedIds] = useState<Set<string | number>>(new Set());

  const normalizeDate = (raw?: string | null) => String(raw || '').trim().split('T')[0].split(' ')[0];

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const userGrids = await loadGridsWithResults();
        setHistory(userGrids);

        const urlParams = new URLSearchParams(window.location.search);
        const winsParam = urlParams.get('wins');
        const highlightParam = urlParams.get('highlight');

        if (winsParam === '1') {
          const winningIds = new Set(userGrids.filter(g => g.status === 'Gagné').map(g => g.id));
          setHighlightedGrids(winningIds);
          urlParams.delete('wins');
          window.history.replaceState({}, '', window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : ''));
          setTimeout(() => setHighlightedGrids(new Set()), 10000);
        } else if (highlightParam) {
          const count = parseInt(highlightParam) || 1;
          const idsToHighlight = new Set(userGrids.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, count).map(g => g.id));
          setHighlightedGrids(idsToHighlight);
          urlParams.delete('highlight');
          window.history.replaceState({}, '', window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : ''));
          setTimeout(() => setHighlightedGrids(new Set()), 10000);
        }
      } catch (error) {
        console.error('[MyGrids] Erreur:', error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const toggleSelection = (id: string | number) => {
    setSelectedGrids(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedGrids.length === history.length && history.length > 0) {
      setSelectedGrids([]);
    } else {
      setSelectedGrids(history.map(g => g.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedGrids.length === 0) return;
    for (const gridId of selectedGrids) {
      await deleteGridFromDB(gridId);
    }
    const updatedGrids = await loadGridsWithResults();
    setHistory(updatedGrids);
    setSelectedGrids([]);
  };

  const handleBadgeClick = async (grid: PlayedGridWithResult) => {
    if (grid.status !== 'Gagné' || !grid.winningGridId) return;
    setPulseStoppedIds(prev => new Set(prev).add(grid.id));
    await ackWinningGrid(grid.winningGridId);
  };

  if (loading) {
    return (
      <CasinoLayout>
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-casino-gold mb-4"></div>
            <p className="text-xl font-orbitron text-white tracking-widest">CHARGEMENT...</p>
          </div>
        </div>
      </CasinoLayout>
    );
  }

  return (
    <CasinoLayout>
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <div className="text-center my-12 py-6 relative">
          <h1 className="text-4xl md:text-5xl font-orbitron font-black text-white tracking-widest text-shadow-glow mb-2">
            MES GRILLES JOUÉES
          </h1>
          <div className="h-1 w-48 bg-casino-gold mx-auto rounded-full shadow-[0_0_15px_rgba(255,215,0,0.8)]" />
          {selectedGrids.length > 0 && (
            <div className="absolute top-1/2 -translate-y-1/2 right-4 md:right-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <button
                onClick={handleDeleteSelected}
                className="bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-500 rounded-full p-4 shadow-[0_0_15px_rgba(220,20,60,0.5)] transition-all hover:scale-110 flex items-center gap-3 group"
                title="Supprimer la sélection"
              >
                <Trash2 size={24} className="group-hover:animate-bounce" />
                <span className="font-bold font-rajdhani hidden md:inline">SUPPRIMER ({selectedGrids.length})</span>
              </button>
            </div>
          )}
        </div>

        <div className="transform md:scale-125 origin-top transition-transform duration-500 mb-32">
          <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black text-zinc-400 text-sm md:text-base uppercase font-orbitron tracking-wider border-b border-zinc-700">
                    <th className="p-1.5 w-10 text-center">
                      <Checkbox
                        checked={history.length > 0 && selectedGrids.length === history.length}
                        onCheckedChange={toggleSelectAll}
                        className="border-zinc-500 data-[state=checked]:bg-casino-gold data-[state=checked]:text-black"
                      />
                    </th>
                    <th className="p-1.5">
                      <div className="flex flex-col items-start"><span>Date</span><span>Jeu</span></div>
                    </th>
                    <th className="py-1.5 pl-1.5 pr-0">
                      <div className="flex flex-col items-start"><span>Tirage</span><span>Visé</span></div>
                    </th>
                    <th className="py-1.5 px-0 text-center">Combinaison</th>
                    <th className="py-1.5 px-1.5 text-center">Rang</th>
                    <th className="py-1.5 px-1.5 text-center">Résultat</th>
                    <th className="py-1.5 px-1.5 text-center">Montant</th>
                  </tr>
                </thead>
                <tbody className="font-rajdhani text-base md:text-lg">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-zinc-500 font-orbitron text-lg">
                        AUCUNE GRILLE JOUÉE POUR LE MOMENT
                      </td>
                    </tr>
                  ) : (
                    history.map((grid) => {
                      const isSelected = selectedGrids.includes(grid.id);
                      const isHighlighted = highlightedGrids.has(grid.id);
                      const isPulseStopped = pulseStoppedIds.has(grid.id);
                      const drawNums = grid.drawNumbers ?? [];
                      const drawStars = grid.drawStars ?? [];

                      return (
                        <tr
                          key={grid.id}
                          className={cn(
                            "border-b border-zinc-800 transition-all duration-500 group cursor-pointer",
                            isSelected ? 'bg-red-900/20' : 'hover:bg-white/5',
                            isHighlighted && "bg-green-900/30 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                          )}
                          onClick={() => toggleSelection(grid.id)}
                        >
                          <td className="p-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(grid.id)}
                              className="border-zinc-500 data-[state=checked]:bg-casino-gold data-[state=checked]:text-black"
                            />
                          </td>
                          <td className="p-1.5 text-zinc-300 whitespace-nowrap text-sm">
                            {format(new Date(grid.date), 'dd/MM HH:mm')}
                          </td>
                          <td className="py-1.5 pl-1.5 pr-0 text-white font-bold text-base whitespace-nowrap">
                            {grid.drawDate ? format(new Date(grid.drawDate), 'dd MMMM yyyy', { locale: fr }) : '-'}
                          </td>
                          <td className="py-1.5 px-0">
                            <div className="flex justify-center gap-0.5 md:gap-1 scale-75 origin-center">
                              {grid.numeros.map(n => (
                                <LottoBall
                                  key={n}
                                  number={n}
                                  size="sm"
                                  isWinning={grid.status === 'Gagné' && drawNums.includes(n)}
                                  pulse={grid.status === 'Gagné' && drawNums.includes(n) && !isPulseStopped}
                                />
                              ))}
                              <div className="w-2 flex items-center justify-center text-zinc-600 text-xs">|</div>
                              {grid.etoiles.map(n => (
                                <LottoBall
                                  key={n}
                                  number={n}
                                  size="sm"
                                  isStar
                                  isWinning={grid.status === 'Gagné' && drawStars.includes(n)}
                                  pulse={grid.status === 'Gagné' && drawStars.includes(n) && !isPulseStopped}
                                />
                              ))}
                            </div>
                          </td>
                          <td className="py-1.5 px-1.5 text-center text-zinc-400 text-sm">
                            {grid.status === 'Gagné' && grid.matchNum != null && grid.matchStar != null
                              ? getRankLabel(grid.matchNum, grid.matchStar)
                              : '-'}
                          </td>
                          <td className="py-1.5 px-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                            {grid.status === 'Gagné' ? (
                              <Badge
                                onClick={() => handleBadgeClick(grid)}
                                className={cn(
                                  "cursor-pointer transition-all",
                                  isPulseStopped ? "bg-green-900/50 text-green-400/80 border-green-700/50" : "bg-green-700 text-green-100 border-green-500"
                                )}
                              >
                                Gagné
                              </Badge>
                            ) : (
                              <span className="text-zinc-500">-</span>
                            )}
                          </td>
                          <td className="py-1.5 px-1.5 text-center text-zinc-300 text-sm">
                            {grid.status === 'Gagné'
                              ? grid.gainCents != null
                                ? (grid.gainCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
                                : '?'
                              : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </CasinoLayout>
  );
}
