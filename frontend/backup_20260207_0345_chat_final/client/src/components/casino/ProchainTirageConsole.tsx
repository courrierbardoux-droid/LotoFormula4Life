import React, { useState, useEffect } from 'react';

export function ProchainTirageConsole() {
  const [compteARebours, setCompteARebours] = useState('');
  const [prochainTirage, setProchainTirage] = useState<Date | null>(null);
  
  // Logic from requirements
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
    
    // Clôture à 20h15
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

  const getJourSemaine = (date: Date) => ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'][date.getDay()];
  const getMois = (date: Date) => ['JAN.', 'FÉV.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'][date.getMonth()];

  useEffect(() => {
    const updateTimer = () => {
      const tirage = getProchainTirage();
      setProchainTirage(tirage);
      setCompteARebours(getCompteARebours(tirage));
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);
  
  if (!prochainTirage) return null;
  
  const jourSemaine = getJourSemaine(prochainTirage);
  const jour = prochainTirage.getDate();
  const mois = getMois(prochainTirage);
  const annee = prochainTirage.getFullYear();
  
  return (
    <div className="flex items-center justify-center gap-4 bg-[#1a1a1a] border border-[#FFD700] rounded-[5px] px-4 py-2 font-mono text-sm text-[#FFD700] whitespace-nowrap overflow-hidden shadow-lg">
      <span className="uppercase tracking-wide">PROCHAIN TIRAGE : {jourSemaine} {jour} {mois} {annee}</span>
      <span className="text-zinc-600">•</span>
      <span className="text-[#FF4444] font-bold tabular-nums tracking-wider">⏳ {compteARebours}</span>
      <span className="text-zinc-600">•</span>
      <span className="text-[#AAAAAA] text-xs uppercase tracking-wider">Clôture : 20h15</span>
    </div>
  );
}
