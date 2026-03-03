import React, { useState, useEffect } from "react";

export const ProchainTirageSimple = () => {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isClosed, setIsClosed] = useState(false);

  const getProchainTirage = () => {
    const now = new Date();
    const jourSemaine = now.getDay();
    const heure = now.getHours();
    const minutes = now.getMinutes();

    let prochainTirage = new Date(now);

    if (jourSemaine === 1) { prochainTirage.setDate(now.getDate() + 1); }
    else if (jourSemaine === 2) {
      if (heure < 20 || (heure === 20 && minutes < 15)) { prochainTirage.setDate(now.getDate()); }
      else { prochainTirage.setDate(now.getDate() + 3); }
    } else if (jourSemaine === 3) { prochainTirage.setDate(now.getDate() + 2); }
    else if (jourSemaine === 4) { prochainTirage.setDate(now.getDate() + 1); }
    else if (jourSemaine === 5) {
      if (heure < 20 || (heure === 20 && minutes < 15)) { prochainTirage.setDate(now.getDate()); }
      else { prochainTirage.setDate(now.getDate() + 4); }
    } else if (jourSemaine === 6) { prochainTirage.setDate(now.getDate() + 3); }
    else if (jourSemaine === 0) { prochainTirage.setDate(now.getDate() + 2); }

    prochainTirage.setHours(20, 15, 0, 0);
    return prochainTirage;
  };

  useEffect(() => {
    const updateCountdown = () => {
      const target = getProchainTirage();
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setIsClosed(true);
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setIsClosed(false);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({ days, hours, minutes, seconds });
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatNumber = (n: number) => String(n).padStart(2, '0');

  if (isClosed) {
    return (
      <div className="bg-red-900/50 border border-red-500 rounded px-4 py-2">
        <span className="font-orbitron text-2xl font-bold text-red-500 tracking-widest animate-pulse">
          CLÔTURÉ
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {[
        { value: countdown.days, label: 'J' },
        { value: countdown.hours, label: 'H' },
        { value: countdown.minutes, label: 'M' },
        { value: countdown.seconds, label: 'S' },
      ].map((item, i) => (
        <div key={i} className="flex items-center bg-black/80 border border-casino-gold/50 rounded shadow-[0_0_15px_rgba(250,204,21,0.3)] px-3 py-1.5">
          <span className="font-mono text-[3.5rem] font-bold text-red-500 tabular-nums leading-none">
            {formatNumber(item.value)}
          </span>
          <span className="text-zinc-400 font-orbitron text-[1.5rem] ml-1.5 self-end leading-none mb-1">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

