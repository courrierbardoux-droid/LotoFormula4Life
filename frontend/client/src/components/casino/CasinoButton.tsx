
import React from 'react';
import { cn } from "@/lib/utils";
import { Howl } from 'howler';

interface CasinoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'metal';
  size?: 'sm' | 'md' | 'lg';
  sound?: boolean;
}

const clickSound = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], // Generic mechanical click fallback
  volume: 0.5
});

export const CasinoButton = React.forwardRef<HTMLButtonElement, CasinoButtonProps>(
  ({ className, variant = 'primary', size = 'md', sound = true, onClick, children, ...props }, ref) => {
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (sound) {
        // In a real app we'd have local assets, using a placeholder logic for now
        // clickSound.play(); 
      }
      onClick?.(e);
    };

    const variants = {
      primary: "bg-gradient-to-b from-casino-gold to-casino-gold-dark text-black border-yellow-300 shadow-[0_0_10px_rgba(255,215,0,0.3)] hover:shadow-[0_0_20px_rgba(255,215,0,0.6)]",
      secondary: "bg-gradient-to-b from-casino-red to-[#8b0000] text-white border-red-400 shadow-[0_0_10px_rgba(220,20,60,0.3)] hover:shadow-[0_0_20px_rgba(220,20,60,0.6)]",
      danger: "bg-gradient-to-b from-red-600 to-red-900 text-white border-red-500",
      metal: "bg-gradient-to-b from-[#e0e0e0] via-[#d0d0d0] to-[#a0a0a0] text-black border-gray-300 metallic-surface"
    };

    const sizes = {
      sm: "h-8 px-4 text-xs",
      md: "h-12 px-6 text-sm",
      lg: "h-16 px-10 text-lg uppercase tracking-widest font-bold"
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          "relative rounded-md font-orbitron font-bold transition-all duration-100 active:scale-95 active:brightness-90 border-t border-l border-opacity-50",
          "shadow-lg active:shadow-inner",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-md">
          {children}
        </span>
        
        {/* Shine effect */}
        <div className="absolute inset-0 rounded-md bg-gradient-to-tr from-white/20 to-transparent opacity-50 pointer-events-none" />
      </button>
    );
  }
);

CasinoButton.displayName = "CasinoButton";
