
import React, { useEffect, useState, useMemo } from 'react';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import {
    computeAllAppointments,
    NumberAppointmentProfile,
    StarAppointmentProfile,
    getProchainTirage,
    getAppointmentId,
    AppointmentStat,
    getFaithfulForRDV
} from '@/lib/lotoService';
import { LottoBall } from '@/components/casino/LottoBall';
import { cn } from '@/lib/utils';
import {
    Calendar,
    Clock,
    TrendingUp,
    Download,
    ChevronRight,
    ChevronLeft,
    Search,
    Star as StarIcon,
    Info,
    Trophy
} from 'lucide-react';
import { format, addMonths, subMonths, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Appointments() {
    const [profiles, setProfiles] = useState<{
        numbers: Record<number, NumberAppointmentProfile>,
        stars: Record<number, StarAppointmentProfile>
    } | null>(null);
    const [selectedNumber, setSelectedNumber] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(true);
    const [nextDraw] = useState(getProchainTirage());

    useEffect(() => {
        async function load() {
            setIsLoading(true);
            try {
                const data = await computeAllAppointments();
                setProfiles(data);
            } catch (error) {
                console.error("Failed to compute appointments", error);
                toast.error("Erreur lors de l'analyse des rendez-vous");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, []);

    const nextDrawDate = nextDraw.date;
    const nextDrawAppointmentId = getAppointmentId(nextDrawDate);

    const faithfulData = useMemo(() => {
        if (!profiles) return null;
        return getFaithfulForRDV(nextDrawAppointmentId, profiles);
    }, [profiles, nextDrawAppointmentId]);

    const selectedProfile = profiles?.numbers[selectedNumber];

    // Heatmap data
    const heatmapData = useMemo(() => {
        if (!selectedProfile) return [];
        return Object.values(selectedProfile.appointments).sort((a: any, b: any) => a.appointmentId - b.appointmentId);
    }, [selectedProfile]);

    // Timeline preparation (1 month back, 2 months forward)
    const timelineMonths = useMemo(() => {
        const start = subMonths(nextDrawDate, 1);
        const months = [];
        for (let i = 0; i < 4; i++) {
            months.push(addMonths(start, i));
        }
        return months;
    }, [nextDrawDate]);

    const getHeatmapColor = (frequency: number) => {
        if (frequency === 0) return 'bg-zinc-800/30';
        if (frequency < 5) return 'bg-blue-900/40';
        if (frequency < 10) return 'bg-blue-600/50';
        if (frequency < 15) return 'bg-indigo-500/60';
        if (frequency < 20) return 'bg-violet-500/70';
        if (frequency < 25) return 'bg-fuchsia-500/80';
        if (frequency < 30) return 'bg-rose-500/90';
        return 'bg-casino-gold shadow-[0_0_10px_rgba(255,215,0,0.5)]';
    };

    const handleDownload = () => {
        if (!profiles) return;

        const header = "Numero;RDV1_ID;RDV1_Freq;RDV2_ID;RDV2_Freq;RDV3_ID;RDV3_Freq;Score_Fidelite\n";
        let content = header;

        for (let n = 1; n <= 50; n++) {
            const p = profiles.numbers[n];
            if (!p) continue;
            const rdv = p.top3.map(r => `${r.appointmentId};${r.frequency.toFixed(2)}`).join(';');
            content += `${n};${rdv};${p.fidelityScore}\n`;
        }

        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "rendez-vous-numeros.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Rapport téléchargé !");
    };

    return (
        <CasinoLayout>
            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-12 pt-24 min-h-screen">

                {/* HEADER SECTION */}
                <div className="text-center space-y-4">
                    <div className="inline-block p-2 px-6 bg-zinc-900/80 border border-casino-gold/30 rounded-full backdrop-blur-md mb-2">
                        <span className="text-casino-gold font-orbitron text-xs tracking-[0.3em] uppercase">MÉMOIRE CYCLIQUE</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-orbitron font-black text-white tracking-widest text-shadow-glow">
                        LES RENDEZ-VOUS <br className="md:hidden" /> DES NUMÉROS
                    </h1>
                    <div className="h-1.5 w-64 bg-gradient-to-r from-transparent via-casino-gold to-transparent mx-auto rounded-full shadow-[0_0_30px_rgba(255,215,0,0.8)]" />
                    <p className="text-zinc-400 font-rajdhani text-xl max-w-2xl mx-auto italic">
                        "Chaque numéro a sa propre saison. Découvrez ceux qui sont à l'heure pour le prochain tirage."
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-16 h-16 border-4 border-t-casino-gold border-zinc-800 rounded-full animate-spin" />
                        <p className="font-orbitron text-zinc-500 animate-pulse tracking-widest">CALCUL DES CYCLES...</p>
                    </div>
                ) : (
                    <>
                        {/* TABLEAU D'HONNEUR (RDV FAITHFULS) */}
                        {faithfulData && (
                            <div className="bg-gradient-to-b from-zinc-900/90 to-black/90 border border-casino-gold/30 rounded-[40px] p-8 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
                                {/* Decorative glow */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-casino-gold to-transparent opacity-50" />

                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 bg-casino-gold/10 rounded-2xl border border-casino-gold/20">
                                            <Trophy className="text-casino-gold w-8 h-8 drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl md:text-3xl font-orbitron font-black text-white tracking-wider">TABLEAU D'HONNEUR</h2>
                                            <p className="text-casino-gold font-rajdhani text-lg uppercase tracking-widest animate-pulse">Les Stars du Rendez-vous</p>
                                        </div>
                                    </div>
                                    <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-center">
                                        <p className="text-zinc-500 font-orbitron text-[10px] tracking-widest uppercase mb-1">PROCHAIN RDV</p>
                                        <p className="text-white font-mono text-xl font-bold">
                                            {format(nextDrawDate, 'EEEE d MMMM', { locale: fr })}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    {/* TOP 10 NUMEROS */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                            <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold font-mono text-sm">10</span>
                                            <h3 className="font-orbitron text-white text-lg tracking-widest uppercase">BOULES LES PLUS FIDÈLES</h3>
                                        </div>
                                        <div className="grid grid-cols-5 sm:grid-cols-5 gap-4">
                                            {faithfulData.topNumbers.map((n, idx) => (
                                                <button
                                                    key={n.numero}
                                                    onClick={() => setSelectedNumber(n.numero)}
                                                    className="group flex flex-col items-center gap-2 transition-all hover:scale-110"
                                                >
                                                    <div className="relative">
                                                        <LottoBall number={n.numero} size="md" className={cn(
                                                            idx < 3 && "ring-2 ring-casino-gold ring-offset-2 ring-offset-zinc-950"
                                                        )} />
                                                        {idx < 3 && (
                                                            <div className="absolute -top-1 -right-1">
                                                                <Trophy size={14} className="text-casino-gold" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[14px] font-black text-white font-orbitron">{n.frequency.toFixed(0)}%</p>
                                                        <p className="text-[9px] text-zinc-500 font-mono uppercase">Score</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* TOP 8 ETOILES */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                            <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold font-mono text-sm">08</span>
                                            <h3 className="font-orbitron text-white text-lg tracking-widest uppercase">ÉTOILES LES PLUS FIDÈLES</h3>
                                        </div>
                                        <div className="grid grid-cols-4 sm:grid-cols-4 gap-4">
                                            {faithfulData.topStars.map((s, idx) => (
                                                <div
                                                    key={s.etoile}
                                                    className="group flex flex-col items-center gap-2"
                                                >
                                                    <div className="relative w-12 h-12 flex items-center justify-center bg-zinc-800 rounded-full border border-casino-gold/30 shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                                                        <StarIcon className="text-casino-gold fill-casino-gold w-6 h-6" />
                                                        <span className="absolute inset-0 flex items-center justify-center text-black font-black text-sm z-10">{s.etoile}</span>
                                                        {idx < 2 && (
                                                            <div className="absolute -top-1 -right-1">
                                                                <Trophy size={14} className="text-casino-gold" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[14px] font-black text-white font-orbitron">{s.frequency.toFixed(0)}%</p>
                                                        <p className="text-[9px] text-zinc-500 font-mono uppercase">Score</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                            {/* LEFT COLUMN: NUMBER PICKER & PROFILE */}
                            <div className="lg:col-span-4 space-y-6">

                                {/* SELECTOR GLASS PANEL */}
                                <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-casino-gold/10 rounded-lg">
                                            <Search className="text-casino-gold w-5 h-5" />
                                        </div>
                                        <h3 className="font-orbitron text-lg text-white font-bold uppercase tracking-wider">Choisir un Numéro</h3>
                                    </div>

                                    <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setSelectedNumber(n)}
                                                className={cn(
                                                    "w-full aspect-square rounded-full flex items-center justify-center font-bold font-rajdhani text-lg transition-all transform active:scale-95",
                                                    selectedNumber === n
                                                        ? "bg-casino-gold text-black shadow-[0_0_15px_rgba(255,215,0,0.6)] scale-110 z-10"
                                                        : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                                                )}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* STATS PROFILE PANEL */}
                                {selectedProfile && (
                                    <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-casino-gold/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-12 bg-casino-gold/5 blur-[80px] rounded-full group-hover:bg-casino-gold/10 transition-all duration-700" />

                                        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                                            <div className="scale-150 mb-4">
                                                <LottoBall number={selectedNumber} size="lg" />
                                            </div>

                                            <div className="space-y-1">
                                                <h4 className="text-zinc-500 font-orbitron text-xs tracking-widest uppercase">Indice de Fidélité</h4>
                                                <div className="flex items-center gap-1 justify-center">
                                                    {Array.from({ length: 10 }).map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                "w-2 h-6 rounded-full transition-all duration-500",
                                                                i < (selectedProfile.fidelityScore || 0)
                                                                    ? "bg-casino-gold shadow-[0_0_5px_rgba(255,215,0,0.5)]"
                                                                    : "bg-zinc-800"
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                                <p className="text-3xl font-orbitron font-black text-white">{selectedProfile.fidelityScore}/10</p>
                                            </div>

                                            <div className="w-full h-px bg-zinc-800 my-4" />

                                            <div className="w-full space-y-4">
                                                <h4 className="text-casino-gold font-orbitron text-xs tracking-widest uppercase flex items-center justify-center gap-2">
                                                    <TrendingUp size={14} /> LES 3 PLUS "CHAUDS"
                                                </h4>

                                                <div className="space-y-3">
                                                    {selectedProfile.top3.map((rdv, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-white/5 rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-zinc-500 font-mono text-xs">#{idx + 1}</span>
                                                                <div className="text-left">
                                                                    <p className="text-white font-bold font-rajdhani">Semaine {rdv.week}</p>
                                                                    <p className="text-zinc-500 text-xs uppercase tracking-tighter">{rdv.day === 1 ? 'Mardi' : 'Vendredi'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-casino-gold font-black font-orbitron">{rdv.frequency.toFixed(1)}%</p>
                                                                <p className="text-[10px] text-zinc-600 font-mono italic">de présence</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    onClick={handleDownload}
                                    className="w-full h-16 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-white rounded-2xl flex items-center justify-center gap-3 font-orbitron tracking-widest text-xs group"
                                >
                                    <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                                    TELECHARGER L'ÉTUDE COMPLETE
                                </Button>
                            </div>

                            {/* RIGHT COLUMN: TIMELINE & HEATMAP */}
                            <div className="lg:col-span-8 space-y-8">

                                {/* THE TIMELINE (Centerpiece) */}
                                <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                                <Clock className="text-blue-400 w-5 h-5" />
                                            </div>
                                            <h3 className="font-orbitron text-lg text-white font-bold uppercase tracking-wider italic">Analyse Temporelle Flux</h3>
                                        </div>
                                        <div className="px-4 py-2 bg-zinc-800 rounded-xl border border-zinc-700 flex items-center gap-3">
                                            <span className="text-zinc-500 font-rajdhani text-sm">PROCHAIN TIRAGE :</span>
                                            <span className="text-casino-gold font-bold font-mono">
                                                {format(nextDrawDate, 'dd/MM', { locale: fr })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="relative py-12">
                                        {/* The central line */}
                                        <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent -translate-y-1/2" />

                                        {/* Current draw marker */}
                                        <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
                                            <div className="w-1 h-32 bg-casino-gold shadow-[0_0_15px_rgba(255,215,0,0.8)]" />
                                            <div className="mt-4 p-2 bg-casino-gold text-black rounded-lg font-black font-orbitron text-[10px] uppercase shadow-lg">MAINTENANT</div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-0 relative z-10 h-40">
                                            {timelineMonths.map((m, mIdx) => {
                                                const isCurrent = isSameMonth(m, nextDrawDate);
                                                return (
                                                    <div key={mIdx} className={cn(
                                                        "flex flex-col items-center justify-between px-2 border-l border-zinc-800/30",
                                                        mIdx === 3 && "border-r"
                                                    )}>
                                                        <span className={cn(
                                                            "font-orbitron text-[10px] tracking-widest uppercase mb-4",
                                                            isCurrent ? "text-casino-gold font-black" : "text-zinc-600"
                                                        )}>
                                                            {format(m, 'MMMM', { locale: fr })}
                                                        </span>

                                                        {/* Numbers in appointment during this month */}
                                                        <div className="flex flex-wrap justify-center gap-1 overflow-hidden h-20">
                                                            {/* Sample logic: show 5 top numbers for that month code */}
                                                            {Array.from({ length: 5 }).map((_, i) => (
                                                                <div key={i} className="w-6 h-6 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-[8px] flex items-center justify-center text-zinc-500 font-bold opacity-30">
                                                                    {Math.floor(Math.random() * 50) + 1}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* THE HEATMAP FLUIDA */}
                                <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                                    <div className="flex items-center justify-between mb-8 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-rose-500/10 rounded-lg">
                                                <TrendingUp className="text-rose-400 w-5 h-5" />
                                            </div>
                                            <h3 className="font-orbitron text-lg text-white font-bold uppercase tracking-wider">Carte d'Intensité Annuelle</h3>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-zinc-800/30 border border-zinc-700" />
                                                <span className="text-[10px] text-zinc-500 font-rajdhani uppercase tracking-tighter">Froid</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-casino-gold" />
                                                <span className="text-[10px] text-casino-gold font-rajdhani uppercase tracking-tighter">Chaud</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-13 gap-2 relative z-10">
                                        {/* Headers for months or weeks can be added here if needed */}
                                        {heatmapData.map((slot: any, i: number) => (
                                            <div
                                                key={i}
                                                title={`Semaine ${slot.week} - ${slot.day === 1 ? 'Mardi' : 'Vendredi'}: ${slot.frequency.toFixed(1)}%`}
                                                className={cn(
                                                    "aspect-square rounded-md transition-all duration-300 hover:scale-125 hover:z-20 cursor-help border border-white/5",
                                                    getHeatmapColor(slot.frequency),
                                                    slot.appointmentId === nextDrawAppointmentId && "ring-2 ring-white ring-offset-2 ring-offset-zinc-950 animate-pulse"
                                                )}
                                            />
                                        ))}
                                    </div>

                                    <div className="mt-8 flex items-center justify-between text-zinc-500 font-mono text-[10px] uppercase tracking-widest relative z-10">
                                        <span>Janvier</span>
                                        <span>Mars</span>
                                        <span>Juin</span>
                                        <span>Septembre</span>
                                        <span>Décembre</span>
                                    </div>
                                </div>

                                {/* EXPLANATION PANEL */}
                                <div className="bg-blue-600/5 border border-blue-500/20 rounded-3xl p-6 flex gap-6 items-start">
                                    <div className="mt-1 p-2 bg-blue-500/10 rounded-xl">
                                        <Info className="text-blue-400 w-6 h-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-blue-400 font-orbitron text-sm font-bold uppercase tracking-wider">Comment lire ce profil ?</h4>
                                        <p className="text-zinc-400 font-rajdhani text-sm leading-relaxed">
                                            La carte d'intensité représente la fidélité de chaque numéro aux 104 créneaux de tirage annuels.
                                            Un numéro "à l'heure" (marqué d'un halo blanc sur la carte) est un numéro dont le tirage actuel
                                            correspond historiquement à un de ses pics de sortie. Le score de fidélité indique si ce numéro
                                            suit strictement ses cycles ou s'il apparaît de manière plus erratique.
                                        </p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </>
                )}
            </div>

            <style>{`
        .grid-cols-13 {
          grid-template-columns: repeat(13, minmax(0, 1fr));
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
        </CasinoLayout>
    );
}
