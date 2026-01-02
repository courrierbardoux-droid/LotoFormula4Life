
import React from 'react';
import { cn } from "@/lib/utils";
import { Howl } from 'howler';

const toggleSound = new Howl({
    src: ['https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'], // Placeholder electric click
    volume: 0.4
});

interface ToggleSwitchProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  activeColor?: string; // CSS color string or Tailwind class logic
}

export const ToggleSwitch = ({ label, checked, onChange, className, activeColor = "bg-green-500" }: ToggleSwitchProps) => {
  
  const handleClick = () => {
      toggleSound.play();
      onChange(!checked);
  };

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div 
        className={cn(
            "w-12 h-20 bg-[#111] rounded-lg border-2 border-[#333] relative cursor-pointer shadow-[inset_0_0_10px_rgba(0,0,0,1)]",
            "flex items-center justify-center"
        )}
        onClick={handleClick}
      >
        {/* The Switch Lever */}
        <div className={cn(
            "w-8 h-10 rounded shadow-[0_2px_5px_rgba(0,0,0,0.5)] transition-all duration-200 relative",
            checked ? "bg-gradient-to-b from-gray-700 to-gray-900 translate-y-[12px]" : "bg-gradient-to-b from-gray-800 to-black translate-y-[-12px]",
             "border-t border-white/10"
        )}>
            {/* LED on the switch */}
            <div className={cn(
                "absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full transition-all duration-300",
                checked ? `${activeColor} shadow-[0_0_8px_currentColor]` : "bg-red-900/30"
            )} />
            
            {/* Grip lines */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-[1px] bg-black/50" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-[1px] bg-black/50" />
        </div>
      </div>
      {label && <span className="text-[10px] uppercase font-orbitron text-muted-foreground tracking-widest text-center max-w-[60px] leading-tight">{label}</span>}
    </div>
  );
};
