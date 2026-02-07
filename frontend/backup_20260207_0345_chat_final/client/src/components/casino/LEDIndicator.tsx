
import React from 'react';
import { cn } from "@/lib/utils";

interface LEDIndicatorProps {
  active?: boolean;
  color?: 'red' | 'green' | 'yellow' | 'blue' | 'purple';
  label?: string;
  className?: string;
}

export const LEDIndicator = ({ active = false, color = 'green', label, className }: LEDIndicatorProps) => {
  const colors = {
    red: active ? "bg-red-500 shadow-[0_0_10px_#ff0000]" : "bg-red-900/30",
    green: active ? "bg-green-500 shadow-[0_0_10px_#00ff00]" : "bg-green-900/30",
    yellow: active ? "bg-yellow-400 shadow-[0_0_10px_#ffd700]" : "bg-yellow-900/30",
    blue: active ? "bg-blue-500 shadow-[0_0_10px_#0000ff]" : "bg-blue-900/30",
    purple: active ? "bg-purple-500 shadow-[0_0_10px_#a855f7]" : "bg-purple-900/30",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "w-3 h-3 rounded-full border border-black/50 transition-all duration-300",
        colors[color]
      )} />
      {label && <span className={cn("text-xs font-orbitron uppercase tracking-wider", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>}
    </div>
  );
};
