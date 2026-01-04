import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface GratitudePopupProps {
  isOpen: boolean;
  onOpenConsole: () => void;
  onDontShowAgain: (checked: boolean) => void;
  dontShowAgainChecked?: boolean;
}

export const GratitudePopup: React.FC<GratitudePopupProps> = ({
  isOpen,
  onOpenConsole,
  onDontShowAgain,
  dontShowAgainChecked = false,
}) => {
  const [checked, setChecked] = useState(dontShowAgainChecked);

  useEffect(() => {
    setChecked(dontShowAgainChecked);
  }, [dontShowAgainChecked]);

  const handleCheckChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setChecked(isChecked);
    onDontShowAgain(isChecked);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay grisé */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Popup */}
      <div className="relative bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border-2 border-casino-gold rounded-xl p-6 max-w-lg mx-4 shadow-2xl shadow-casino-gold/20">
        {/* Décoration coin */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-casino-gold rounded-tl-xl" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-casino-gold rounded-tr-xl" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-casino-gold rounded-bl-xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-casino-gold rounded-br-xl" />

        {/* Titre */}
        <h2 className="text-center font-orbitron text-xl text-casino-gold mb-4 tracking-widest">
          ✨ BIENVENUE ✨
        </h2>

        {/* Message informatif */}
        <div className="bg-black/50 border border-zinc-700 rounded-lg p-4 mb-4">
          <p className="text-zinc-300 text-sm leading-relaxed mb-3">
            <span className="text-casino-gold font-semibold">LotoFormula4Life</span> vous rappelle que ce site ne fait pas d'art divinatoire. 
            Il vous permet de recevoir des numéros qui, selon vos réglages et notre philosophie statistique, 
            ont des probabilités raisonnables de sortir au tirage.
          </p>
          
          {/* Message de gratitude */}
          <div className="border-t border-zinc-700 pt-3 mt-3">
            <p className="text-green-400 text-sm leading-relaxed">
              💚 <strong>Un petit mot du développeur :</strong><br />
              En retour, je ne vous demande que votre gratitude et vos remerciements. 
              Si la chance vous sourit et que votre gain vous inspire générosité... à votre bon cœur ! 
              Tout geste de reconnaissance, qu'il soit symbolique ou fiduciaire, sera accueilli comme un don et une grâce. 
              <em className="text-zinc-400">Aucun engagement, aucune obligation.</em>
            </p>
          </div>
        </div>

        {/* Case à cocher */}
        <label className="flex items-center gap-3 cursor-pointer mb-6 p-2 rounded hover:bg-zinc-800/50 transition-colors">
          <input
            type="checkbox"
            checked={checked}
            onChange={handleCheckChange}
            className="w-5 h-5 accent-red-500 cursor-pointer"
          />
          <span className="text-zinc-400 text-sm">
            Ne plus afficher ce message
            <span className="text-zinc-500 text-xs block">(Affichage tous les 10 accès si coché)</span>
          </span>
        </label>

        {/* Bouton ouvrir console */}
        <button
          onClick={onOpenConsole}
          className={cn(
            "w-full py-3 px-6 rounded-lg font-orbitron font-bold text-lg tracking-wider",
            "bg-gradient-to-r from-green-600 to-green-500 text-white",
            "border-2 border-green-400 shadow-lg shadow-green-500/30",
            "hover:from-green-500 hover:to-green-400 hover:shadow-green-500/50",
            "active:scale-95 transition-all duration-200",
            "animate-pulse hover:animate-none"
          )}
        >
          🎰 Ouvrir la console
        </button>
      </div>
    </div>
  );
};

export default GratitudePopup;

