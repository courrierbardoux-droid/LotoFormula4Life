
import React from 'react';
import { cn } from "@/lib/utils";

interface LCDDisplayProps {
  label?: string;
  value: string | number;
  size?: 'btn' | 'sm' | 'md' | 'lg';
  color?: 'green' | 'red' | 'orange';
  variant?: 'inline' | 'stacked';
  className?: string;
}

export const LCDDisplay = ({ label, value, size = 'md', color = 'green', variant = 'stacked', className }: LCDDisplayProps) => {
  const colors = {
    green: "text-[#44FF44] shadow-[0_0_5px_rgba(68,255,68,0.5)]",
    red: "text-[#FF4444] shadow-[0_0_5px_rgba(255,68,68,0.5)]",
    orange: "text-[#FFA500] shadow-[0_0_5px_rgba(255,165,0,0.5)]"
  };

  const colorsCompact = {
    green: "text-[#44FF44]",
    red: "text-[#FF4444]",
    orange: "text-[#FFA500]",
  };

  const textSizes = {
    btn: "text-sm leading-none",
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl"
  };

  const frameSizes = {
    btn: "h-[23px] w-full px-2 py-0.5 border border-gray-700 rounded-md shadow-inner relative overflow-hidden flex items-center",
    sm: "border-2 border-gray-700 rounded-sm p-2 shadow-inner relative overflow-hidden",
    md: "border-2 border-gray-700 rounded-sm p-2 shadow-inner relative overflow-hidden",
    lg: "border-2 border-gray-700 rounded-sm p-2 shadow-inner relative overflow-hidden",
  };

  const isCompact = size === "btn" || variant === "inline";

  return (
    <div
      className={cn(
        variant === "inline" ? "inline-flex items-center" : "flex flex-col gap-1",
        className
      )}
    >
      {label && variant !== "inline" && (
        <span className="text-xs uppercase text-muted-foreground font-orbitron tracking-wider">{label}</span>
      )}
      <div className={cn("bg-black", frameSizes[size])}>
        {/* LCD Grid Background Effect */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(transparent 50%, rgba(0,0,0,0.5) 50%)', backgroundSize: '100% 4px' }} />
        
        <div className={cn(
          "font-lcd tracking-widest text-center w-full",
          isCompact ? colorsCompact[color] : colors[color],
          textSizes[size]
        )}>
          {value}
        </div>
      </div>
    </div>
  );
};
