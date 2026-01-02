
import React from 'react';
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Howl } from 'howler';

const clickSound = new Howl({
    src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], 
    volume: 0.2
});

interface CounterProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  className?: string;
}

export const Counter = ({ label, value, min = 0, max = 99, onChange, className }: CounterProps) => {
  
  const update = (delta: number) => {
      const next = Math.max(min, Math.min(max, value + delta));
      if (next !== value) {
          onChange(next);
          clickSound.play();
      }
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span className="text-[10px] uppercase font-orbitron text-muted-foreground mb-1">{label}</span>
      <div className="flex items-center bg-black border border-zinc-800 rounded p-1 gap-2 shadow-inner">
        <button 
            onClick={() => update(-1)}
            className="p-1 hover:text-casino-gold text-zinc-500 transition-colors active:scale-90"
        >
            <ChevronLeft size={16} />
        </button>
        
        <div className="bg-[#1a1a1a] px-2 py-0.5 min-w-[30px] text-center rounded border border-zinc-900">
            <span className="font-lcd text-xl text-casino-gold text-shadow-glow">{value}</span>
        </div>

        <button 
            onClick={() => update(1)}
            className="p-1 hover:text-casino-gold text-zinc-500 transition-colors active:scale-90"
        >
            <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
