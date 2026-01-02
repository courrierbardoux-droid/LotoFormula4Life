import React, { useState, useEffect } from "react";

export const ProchainTirageSimple = () => {
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
    
    let result = "";
    if (jours > 0) {
      result = `${jours}j ${String(heures).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min ${String(secondes).padStart(2, '0')}s`;
    } else {
      result = `${String(heures).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min ${String(secondes).padStart(2, '0')}s`;
    }
    
    // Add extra spacing for "aéré" look
    return result.replace(/(\d+)([a-z]+)/g, "$1$2 ").trim();
  };

  useEffect(() => {
    const updateTimer = () => {
      const nextDraw = getProchainTirage();
      setCompteARebours(getCompteARebours(nextDraw));
    };
    
    const timer = setInterval(updateTimer, 1000);
    updateTimer(); // Initial call
    
    return () => clearInterval(timer);
  }, []);

  if (!compteARebours) return null;

  return (
    <span className="font-mono text-red-500 font-bold text-xl tracking-widest tabular-nums animate-pulse">
        {compteARebours}
    </span>
  );
};
