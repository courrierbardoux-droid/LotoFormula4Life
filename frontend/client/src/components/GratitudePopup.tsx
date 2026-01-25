import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { GRATITUDE_LEGAL_MESSAGE, GRATITUDE_DEV_MESSAGE } from '@/lib/gratitudeMessages';

type GratitudeMode = 'welcome' | 'invite-send';

interface GratitudePopupProps {
  isOpen: boolean;
  onOpenConsole?: () => void;
  onDontShowAgain?: (checked: boolean) => void;
  dontShowAgainChecked?: boolean;
  // Nouvelles props pour mode invité
  mode?: GratitudeMode;
  onValidate?: () => void;
  checkboxRequired?: boolean;
  accepted?: boolean;
  onAcceptedChange?: (checked: boolean) => void;
}

export const GratitudePopup: React.FC<GratitudePopupProps> = ({
  isOpen,
  onOpenConsole,
  onDontShowAgain,
  dontShowAgainChecked = false,
  mode = 'welcome',
  onValidate,
  checkboxRequired = false,
  accepted = false,
  onAcceptedChange,
}) => {
  const [checked, setChecked] = useState(dontShowAgainChecked);
  const [acceptedState, setAcceptedState] = useState(accepted);

  useEffect(() => {
    setChecked(dontShowAgainChecked);
  }, [dontShowAgainChecked]);

  useEffect(() => {
    setAcceptedState(accepted);
  }, [accepted]);

  const handleCheckChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    if (mode === 'welcome') {
      setChecked(isChecked);
      onDontShowAgain?.(isChecked);
    } else {
      setAcceptedState(isChecked);
      onAcceptedChange?.(isChecked);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay grisé */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Popup */}
      <div className="relative bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border-2 border-casino-gold rounded-xl p-9 max-w-3xl mx-4 shadow-2xl shadow-casino-gold/20" style={{ transform: 'scale(1.5)', transformOrigin: 'center' }}>
        {/* Décoration coin */}
        <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-casino-gold rounded-tl-xl" />
        <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-casino-gold rounded-tr-xl" />
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-casino-gold rounded-bl-xl" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-casino-gold rounded-br-xl" />

        {/* Titre */}
        <h2 className="text-center font-orbitron text-3xl text-casino-gold mb-6 tracking-widest">
          {mode === 'welcome' ? '✨ BIENVENUE ✨' : '✨ GRATITUDE ✨'}
        </h2>

        {/* Message informatif */}
        <div className="bg-black/50 border border-zinc-700 rounded-lg p-6 mb-6">
          <p className="text-zinc-300 text-base leading-relaxed mb-4">
            <span className="text-casino-gold font-semibold">LotoFormula4Life</span> {GRATITUDE_LEGAL_MESSAGE}
          </p>
          
          {/* Message de gratitude */}
          <div className="border-t border-zinc-700 pt-4 mt-4">
            <p className="text-green-400 text-base leading-relaxed">
              💚 <strong>Un petit mot du développeur :</strong><br />
              {GRATITUDE_DEV_MESSAGE}
              <em className="text-zinc-400"> Aucun engagement, aucune obligation.</em>
            </p>
          </div>
        </div>

        {/* Case à cocher */}
        {mode === 'welcome' ? (
          <label className="flex items-center gap-4 cursor-pointer mb-9 p-3 rounded hover:bg-zinc-800/50 transition-colors">
            <input
              type="checkbox"
              checked={checked}
              onChange={handleCheckChange}
              className="w-7 h-7 accent-red-500 cursor-pointer"
            />
            <span className="text-zinc-400 text-base">
              Ne plus afficher ce message
              <span className="text-zinc-500 text-sm block">(Affichage tous les 10 accès si coché)</span>
            </span>
          </label>
        ) : (
          <label className="flex items-center gap-4 cursor-pointer mb-9 p-3 rounded hover:bg-zinc-800/50 transition-colors">
            <input
              type="checkbox"
              checked={acceptedState}
              onChange={handleCheckChange}
              className="w-7 h-7 accent-casino-gold cursor-pointer"
            />
            <span className="text-zinc-300 text-base">
              J'ai lu et j'accepte
            </span>
          </label>
        )}

        {/* Bouton */}
        {mode === 'welcome' ? (
          <button
            onClick={onOpenConsole}
            className={cn(
              "w-full py-4 px-9 rounded-lg font-orbitron font-bold text-xl tracking-wider",
              "bg-gradient-to-r from-green-600 to-green-500 text-white",
              "border-2 border-green-400 shadow-lg shadow-green-500/30",
              "hover:from-green-500 hover:to-green-400 hover:shadow-green-500/50",
              "active:scale-95 transition-all duration-200",
              "animate-pulse hover:animate-none"
            )}
          >
            🎰 Ouvrir la console
          </button>
        ) : (
          <button
            onClick={() => {
              console.log('[GratitudePopup] Bouton VALIDER cliqué', { onValidate, checkboxRequired, acceptedState });
              onValidate?.();
            }}
            disabled={checkboxRequired && !acceptedState}
            className={cn(
              "w-full py-4 px-9 rounded-lg font-orbitron font-bold text-xl tracking-wider transition-all duration-200",
              checkboxRequired && acceptedState
                ? "bg-gradient-to-r from-green-600 to-green-500 text-white border-2 border-green-400 shadow-lg shadow-green-500/30 hover:from-green-500 hover:to-green-400 hover:shadow-green-500/50 active:scale-95 animate-pulse hover:animate-none"
                : checkboxRequired && !acceptedState
                ? "bg-zinc-700 text-zinc-500 cursor-not-allowed opacity-50 border-2 border-zinc-600"
                : "bg-gradient-to-r from-green-600 to-green-500 text-white border-2 border-green-400 shadow-lg shadow-green-500/30 hover:from-green-500 hover:to-green-400 hover:shadow-green-500/50 active:scale-95 animate-pulse hover:animate-none"
            )}
          >
            VALIDER
          </button>
        )}
      </div>
    </div>
  );
};

export default GratitudePopup;

