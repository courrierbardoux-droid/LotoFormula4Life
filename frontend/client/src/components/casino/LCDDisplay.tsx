
import React from 'react';
import { cn } from "@/lib/utils";

interface LCDDisplayProps {
  label?: string;
  value: string | number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'green' | 'red' | 'orange';
  className?: string;
}

export const LCDDisplay = ({ label, value, size = 'md', color = 'green', className }: LCDDisplayProps) => {
  const colors = {
    green: "text-[#44FF44] shadow-[0_0_5px_rgba(68,255,68,0.5)]",
    red: "text-[#FF4444] shadow-[0_0_5px_rgba(255,68,68,0.5)]",
    orange: "text-[#FFA500] shadow-[0_0_5px_rgba(255,165,0,0.5)]"
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl"
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && <span className="text-xs uppercase text-muted-foreground font-orbitron tracking-wider">{label}</span>}
      <div className="bg-black border-2 border-gray-700 rounded-sm p-2 shadow-inner relative overflow-hidden">
        {/* LCD Grid Background Effect */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(transparent 50%, rgba(0,0,0,0.5) 50%)', backgroundSize: '100% 4px' }} />
        
        <div className={cn(
          "font-lcd tracking-widest text-center",
          colors[color],
          textSizes[size]
        )}>
          {value}
        </div>
      </div>
    </div>
  );
};
