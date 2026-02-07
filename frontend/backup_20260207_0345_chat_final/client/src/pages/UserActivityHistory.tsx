import React, { useEffect, useState } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { Link, useLocation } from "wouter";
import { useUser } from "@/lib/UserContext";
import { LottoBall } from "@/components/casino/LottoBall";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type GridWithResult = {
  id: number;
  odlId?: string | null;
  numbers: number[];
  stars: number[];
  playedAt: string;
  targetDate: string | null;
  name?: string | null;
  createdAt: string;
  userId: number;
  username: string;
  status: "En attente" | "Perdu" | "Gagné";
  gainCents: number | null;
  matchNum?: number;
  matchStar?: number;
  winningGridId?: number;
  drawNumbers?: number[];
  drawStars?: number[];
  adminSeenAt?: string | null;
};

function getRankLabel(matchNum: number, matchStar: number): string {
  if (matchNum === 5 && matchStar === 2) return "Jackpot";
  if (matchNum === 5 && matchStar === 1) return "Rang 2";
  if (matchNum === 5 && matchStar === 0) return "Rang 3";
  if (matchNum === 4 && matchStar === 2) return "Rang 4";
  if (matchNum === 4 && matchStar === 1) return "Rang 5";
  if (matchNum === 3 && matchStar === 2) return "Rang 6";
  if (matchNum === 4 && matchStar === 0) return "Rang 7";
  if (matchNum === 2 && matchStar === 2) return "Rang 8";
  if (matchNum === 3 && matchStar === 1) return "Rang 9";
  if (matchNum === 3 && matchStar === 0) return "Rang 10";
  if (matchNum === 1 && matchStar === 2) return "Rang 11";
  if (matchNum === 2 && matchStar === 1) return "Rang 12";
  if (matchNum === 2 && matchStar === 0) return "Rang 13";
  return "";
}

async function ackAdminWin(winningGridId: number): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/wins/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids: [winningGridId] }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default function UserActivityHistory() {
  const [grids, setGrids] = useState<GridWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulseStoppedIds, setPulseStoppedIds] = useState<Set<number>>(new Set());
  const [highlightedGrids, setHighlightedGrids] = useState<Set<number>>(new Set());
  const { user } = useUser();
  const [, setLocation] = useLocation();

  const loadGrids = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/grids/with-results", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur chargement");
      const data = (await res.json()) as GridWithResult[];
      setGrids(Array.isArray(data) ? data : []);

      // Vérifier paramètre URL ?wins=1 pour mettre en évidence les grilles gagnantes
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("wins") === "1") {
        const winningIds = new Set(data.filter((g) => g.status === "Gagné" && !g.adminSeenAt).map((g) => g.id));
        setHighlightedGrids(winningIds);
        urlParams.delete("wins");
        window.history.replaceState({}, "", window.location.pathname + (urlParams.toString() ? "?" + urlParams.toString() : ""));
        setTimeout(() => setHighlightedGrids(new Set()), 10000);
      }
    } catch {
      setGrids([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGrids();
  }, []);

  const handleBadgeClick = async (grid: GridWithResult) => {
    if (grid.status !== "Gagné" || !grid.winningGridId) return;
    setPulseStoppedIds((prev) => new Set(prev).add(grid.id));
    await ackAdminWin(grid.winningGridId);
  };

  if (loading) {
    return (
      <CasinoLayout>
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 min-h-screen flex items-center justify-center">
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
        <div className="text-center my-10">
          <h1 className="text-3xl md:text-4xl font-orbitron font-black text-white tracking-widest mb-2">
            HISTORIQUE DES UTILISATEURS
          </h1>
          <div className="text-zinc-400 font-rajdhani text-lg">Grilles jouées par les utilisateurs (hors admin)</div>
          <div className="h-1 w-48 bg-casino-gold mx-auto rounded-full shadow-[0_0_15px_rgba(255,215,0,0.8)] mt-4" />
        </div>

        <div className="flex justify-end mb-4">
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-zinc-800 text-zinc-200 text-sm font-bold hover:bg-zinc-700 transition-colors"
            onClick={() => loadGrids()}
          >
            RAFRAÎCHIR
          </button>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black text-zinc-400 text-sm md:text-base uppercase font-orbitron tracking-wider border-b border-zinc-700">
                  <th className="p-2">Utilisateur</th>
                  <th className="p-2">Date Jeu</th>
                  <th className="p-2">Tirage Visé</th>
                  <th className="p-2 text-center">Combinaison</th>
                  <th className="p-2 text-center">Rang</th>
                  <th className="p-2 text-center">Résultat</th>
                  <th className="p-2 text-center">Montant</th>
                </tr>
              </thead>
              <tbody className="font-rajdhani text-base md:text-lg">
                {grids.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-zinc-500 font-orbitron text-lg">
                      AUCUNE GRILLE JOUÉE PAR LES UTILISATEURS
                    </td>
                  </tr>
                ) : (
                  grids.map((grid) => {
                    const isHighlighted = highlightedGrids.has(grid.id);
                    const isPulseStopped = pulseStoppedIds.has(grid.id) || !!grid.adminSeenAt;
                    const drawNums = grid.drawNumbers ?? [];
                    const drawStars = grid.drawStars ?? [];

                    return (
                      <tr
                        key={grid.id}
                        className={cn(
                          "border-b border-zinc-800 transition-all duration-500",
                          "hover:bg-white/5",
                          isHighlighted && "bg-green-900/30 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                        )}
                      >
                        <td className="p-2">
                          <Link href={`/user/${grid.userId}`}>
                            <a className="text-casino-gold hover:underline font-bold">{grid.username}</a>
                          </Link>
                        </td>
                        <td className="p-2 text-zinc-300 whitespace-nowrap text-sm">
                          {format(new Date(grid.playedAt), "dd/MM HH:mm")}
                        </td>
                        <td className="p-2 text-white font-bold text-sm whitespace-nowrap">
                          {grid.targetDate ? format(new Date(grid.targetDate), "dd MMMM yyyy", { locale: fr }) : "-"}
                        </td>
                        <td className="p-2">
                          <div className="flex justify-center gap-0.5 md:gap-1 scale-75 origin-center">
                            {grid.numbers.map((n) => (
                              <LottoBall
                                key={n}
                                number={n}
                                size="sm"
                                isWinning={grid.status === "Gagné" && drawNums.includes(n)}
                                pulse={grid.status === "Gagné" && drawNums.includes(n) && !isPulseStopped}
                              />
                            ))}
                            <div className="w-2 flex items-center justify-center text-zinc-600 text-xs">|</div>
                            {grid.stars.map((n) => (
                              <LottoBall
                                key={n}
                                number={n}
                                size="sm"
                                isStar
                                isWinning={grid.status === "Gagné" && drawStars.includes(n)}
                                pulse={grid.status === "Gagné" && drawStars.includes(n) && !isPulseStopped}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="p-2 text-center text-zinc-400 text-sm">
                          {grid.status === "Gagné" && grid.matchNum != null && grid.matchStar != null
                            ? getRankLabel(grid.matchNum, grid.matchStar)
                            : "-"}
                        </td>
                        <td className="p-2 text-center">
                          {grid.status === "Gagné" ? (
                            <Badge
                              onClick={() => handleBadgeClick(grid)}
                              className={cn(
                                "cursor-pointer transition-all",
                                isPulseStopped
                                  ? "bg-green-900/50 text-green-400/80 border-green-700/50"
                                  : "bg-green-700 text-green-100 border-green-500 animate-pulse"
                              )}
                            >
                              Gagné
                            </Badge>
                          ) : (
                            <span className="text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="p-2 text-center text-zinc-300 text-sm">
                          {grid.status === "Gagné"
                            ? grid.gainCents != null
                              ? (grid.gainCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                              : "?"
                            : "-"}
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
    </CasinoLayout>
  );
}
