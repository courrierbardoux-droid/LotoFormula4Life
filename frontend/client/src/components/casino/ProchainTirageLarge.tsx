import React, { useState, useEffect } from "react";

export const ProchainTirageLarge = () => {
  const [prochainTirageDate, setProchainTirageDate] = useState<Date | null>(null);
  const [compteARebours, setCompteARebours] = useState("");

  const getProchainTirage = () => {
    const now = new Date();
    const jourSemaine = now.getDay(); // 0=dim, 1=lun, 2=mar, 3=mer, 4=jeu, 5=ven, 6=sam
    const heure = now.getHours();
    const minutes = now.getMinutes();
    
    let prochainTirage = new Date(now);
    
    if (jourSemaine === 1) { // LUNDI → MARDI
      prochainTirage.setDate(now.getDate() + 1);
    } else if (jourSemaine === 2) { // MARDI
      if (heure < 20 || (heure === 20 && minutes < 15)) {
        prochainTirage.setDate(now.getDate());
      } else {
        prochainTirage.setDate(now.getDate() + 3); // Vendredi
      }
    } else if (jourSemaine === 3) { // MERCREDI → VENDREDI
      prochainTirage.setDate(now.getDate() + 2);
    } else if (jourSemaine === 4) { // JEUDI → VENDREDI
      prochainTirage.setDate(now.getDate() + 1);
    } else if (jourSemaine === 5) { // VENDREDI
      if (heure < 20 || (heure === 20 && minutes < 15)) {
        prochainTirage.setDate(now.getDate());
      } else {
        prochainTirage.setDate(now.getDate() + 4); // Mardi
      }
    } else if (jourSemaine === 6) { // SAMEDI → MARDI
      prochainTirage.setDate(now.getDate() + 3);
    } else if (jourSemaine === 0) { // DIMANCHE → MARDI
      prochainTirage.setDate(now.getDate() + 2);
    }
    
    prochainTirage.setHours(20, 15, 0, 0);
    return prochainTirage;
  };

  const getCompteARebours = (dateCloture: Date) => {
    const now = new Date();
    const diff = dateCloture.getTime() - now.getTime();
    
    if (diff <= 0) return "CLÔTURÉ";
    
    const totalSecondes = Math.floor(diff / 1000);
    const jours = Math.floor(totalSecondes / 86400);
    const heures = Math.floor((totalSecondes % 86400) / 3600);
    const minutes = Math.floor((totalSecondes % 3600) / 60);
    const secondes = totalSecondes % 60;
    
    if (jours > 0) {
      return `${jours}j ${String(heures).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min ${String(secondes).padStart(2, '0')}s`;
    } else {
      return `${String(heures).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min ${String(secondes).padStart(2, '0')}s`;
    }
  };

  const getMoisFull = (date: Date) => ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'][date.getMonth()];
  const getJourSemaineFull = (date: Date) => ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'][date.getDay()];

  useEffect(() => {
    const updateTimer = () => {
      const nextDraw = getProchainTirage();
      setProchainTirageDate(nextDraw);
      setCompteARebours(getCompteARebours(nextDraw));
    };
    
    const timer = setInterval(updateTimer, 1000);
    updateTimer(); // Initial call
    
    return () => clearInterval(timer);
  }, []);

  if (!prochainTirageDate) return null;

  return (
    <div className="flex flex-col items-start gap-2 p-3 border-2 border-zinc-700 bg-black/90 w-full max-w-3xl mx-auto shadow-2xl relative overflow-hidden">
        {/* Decor elements */}
        <div className="absolute top-0 left-0 w-2 h-full bg-casino-gold/50" />
        <div className="absolute top-0 right-0 w-2 h-full bg-casino-gold/50" />
        
        <div className="flex flex-col w-full gap-2 text-center">
             {/* DATE ROW */}
            <div className="flex items-center justify-center gap-3 border-b border-zinc-800 pb-3 w-full">
                <span className="font-orbitron text-casino-gold text-xl md:text-2xl tracking-widest">
                    PROCHAIN TIRAGE : {getJourSemaineFull(prochainTirageDate)} {prochainTirageDate.getDate()} {getMoisFull(prochainTirageDate)} {prochainTirageDate.getFullYear()}
                </span>
            </div>

            {/* COUNTDOWN ROW */}
            <div className="flex items-center justify-center gap-3 border-b border-zinc-800 pb-3 w-full">
                <div className="flex items-center gap-2">
                    <span className="font-orbitron text-white text-lg tracking-wider">TEMPS RESTANT :</span>
                    <span className="text-2xl md:text-3xl font-mono font-bold text-red-500 tabular-nums tracking-widest animate-pulse">
                        {compteARebours}
                    </span>
                </div>
            </div>

            {/* CLOSING TIME ROW */}
            <div className="flex items-center justify-center gap-3 w-full">
                <span className="font-rajdhani text-zinc-300 text-lg uppercase tracking-widest">
                    Clôture des jeux en ligne : 20h15
                </span>
            </div>
        </div>
    </div>
  );
};
