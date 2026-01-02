import React from "react";
import { cn } from "@/lib/utils";
import { LEDIndicator } from "@/components/casino/LEDIndicator";

interface SectionPanelProps {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  showLed?: boolean;
  ledActive?: boolean;
  headerAction?: React.ReactNode;
}

export const SectionPanel = ({ 
  title, 
  children, 
  className, 
  disabled = false, 
  showLed = true, 
  ledActive = true, 
  headerAction 
}: SectionPanelProps) => (
  <div className={cn(
    "bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-zinc-700 rounded-lg p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]", 
    disabled && "opacity-20 pointer-events-none",
    className
  )}>
    <div className="font-orbitron text-casino-gold text-lg tracking-widest border-b border-zinc-800 pb-1 mb-2 flex justify-center items-center relative">
      <h3 className="flex-1 text-center">{title}</h3>
      {headerAction ? (
        <div className="absolute right-0">{headerAction}</div>
      ) : (showLed && <div className="absolute right-0"><LEDIndicator active={ledActive} color="green" /></div>)}
    </div>
    {children}
  </div>
);








