import React from "react";
import { cn } from "@/lib/utils";
import { LottoBall } from "@/components/casino/LottoBall";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { DisplayStat, CategoryType } from "@/types/console.types";

interface BallGridProps {
  stats: DisplayStat[];
  countLimit: number;
  type?: 'number' | 'star';
  selectedNumbers: number[];
  selectedStars: number[];
  numberSources?: Record<number, CategoryType>;
  starSources?: Record<number, CategoryType>;
  category?: CategoryType;
  onToggle: (num: number, type: 'number' | 'star', category?: CategoryType) => void;
  className?: string;
  resolveCategory?: (num: number, type: 'number' | 'star') => CategoryType | null;
}

export const BallGrid = ({ 
  stats, 
  countLimit, 
  type = 'number',
  selectedNumbers,
  selectedStars,
  onToggle,
  className,
  numberSources,
  starSources,
  category,
  resolveCategory
}: BallGridProps) => {
  // The user explicitly asked for the number of balls presented to be IDENTICAL to the countLimit (cursor value).
  const visibleStats = stats.slice(0, countLimit);
  
  return (
    <div className={cn("flex flex-nowrap gap-1.5 justify-center py-2", className)}>
      {visibleStats.map(stat => {
        // Invisible placeholder for spacing (negative numbers)
        if (stat.number < 0) {
          return (
            <div 
              key={`placeholder-${stat.number}`} 
              className="w-14 h-[76px] invisible pointer-events-none" 
            />
          );
        }
        
        const isSelected = type === 'number' 
          ? selectedNumbers.includes(stat.number)
          : selectedStars.includes(stat.number);
        
        // Determine style: Solid (primary) or Ghost (secondary)
        let status: 'default' | 'selected' | 'ghost' = 'default';
        
        if (isSelected) {
          let owner = null;
          
          // FORBO ALGORITHM: Use dynamic resolution if available
          if (resolveCategory) {
            owner = resolveCategory(stat.number, type);
          } else {
            // Fallback to manual source tracking
            owner = type === 'number' 
              ? numberSources?.[stat.number] 
              : starSources?.[stat.number];
          }
          
          if (owner && category && owner === category) {
            status = 'selected'; // Primary owner -> Solid Green
          } else if (owner && category && owner !== category) {
            status = 'ghost'; // Doublon -> Ghost Green (Text Green)
          } else if (!owner) {
            // Fallback for manual selection without source tracking
            status = 'selected';
          } else {
            status = 'selected';
          }
        }

        return (
          <div 
            key={`${type}-${stat.number}`}
            className="flex flex-col items-center gap-1 cursor-pointer group w-14"
            onClick={() => onToggle(stat.number, type, category)}
          >
            <span className={cn(
              "text-sm font-mono transition-colors",
              status === 'ghost' ? "text-green-400 font-bold" : "text-zinc-400 group-hover:text-white"
            )}>{stat.displayLabel ? stat.displayLabel : `${stat.frequency}`}</span>
            <LottoBall 
              number={stat.number} 
              isStar={type === 'star'}
              size="md" 
              status={status === 'ghost' ? 'default' : status}
              className={cn(
                "transition-transform group-hover:scale-110",
                status === 'ghost' && "border-2 border-green-500/50 text-green-400 shadow-[0_0_10px_rgba(74,222,128,0.3)]"
              )}
            />
            <div className={cn(
              "flex items-center gap-0.5 text-xs font-bold px-1.5 rounded-full",
              stat.trendScore >= 8 ? "text-red-400" :
              stat.trendScore >= 5 ? "text-green-400" :
              "text-blue-400"
            )}>
              <span>{stat.trendScore}</span>
              {stat.trendDirection === 'hausse' ? <ArrowUp size={10} strokeWidth={3} /> :
               stat.trendDirection === 'stable' ? <Minus size={10} strokeWidth={3} /> :
               <ArrowDown size={10} strokeWidth={3} />}
            </div>
          </div>
        );
      })}
    </div>
  );
};







