import React from "react";
import { cn } from "@/lib/utils";

type DormeurStepperProps = {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
  hideLabel?: boolean;
  className?: string;
};

export function DormeurStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  compact = false,
  hideLabel = false,
  className,
}: DormeurStepperProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  // Compact: symmetric stack (+/LCD/−) to align LCD center with knob center.
  const btnCls = compact
    ? "w-11 h-5 text-sm leading-none font-bold"
    : "w-10 h-7";
  const lcdCls = compact
    ? "w-11 h-5 text-sm font-bold"
    : "w-10 h-7 text-base";
  const gapCls = compact ? "gap-[2px]" : "gap-1";

  return (
    <div className={cn("flex flex-col items-center", gapCls, className)}>
      {!hideLabel && (
        <div className="text-white font-rajdhani font-bold text-sm uppercase tracking-wider leading-none">
          {label}
        </div>
      )}

      <button
        type="button"
        onClick={inc}
        data-debug-id={compact ? `dormeur-${label}-plus` : undefined}
        className={cn(
          "rounded-md bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 active:bg-zinc-950 transition-colors",
          btnCls
        )}
        aria-label={`${label} +1`}
      >
        +
      </button>

      <div
        data-debug-id={compact ? `dormeur-${label}-lcd` : undefined}
        className={cn(
          "rounded-md bg-black border border-blue-500/40 text-blue-400 font-lcd flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.15)]",
          lcdCls
        )}
      >
        {value}
      </div>

      <button
        type="button"
        onClick={dec}
        data-debug-id={compact ? `dormeur-${label}-minus` : undefined}
        className={cn(
          "rounded-md bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 active:bg-zinc-950 transition-colors",
          btnCls
        )}
        aria-label={`${label} -1`}
      >
        -
      </button>
    </div>
  );
}

