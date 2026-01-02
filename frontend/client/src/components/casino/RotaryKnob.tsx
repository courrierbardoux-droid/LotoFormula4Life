
import React, { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import { Howl } from 'howler';

// Sounds
const knobClick = new Howl({
    src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], // Placeholder mechanical click
    volume: 0.3
});

interface RotaryKnobProps {
  label: string;
  min?: number;
  max?: number;
  value?: number;
  onChange?: (value: number) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  labelClassName?: string;
  valueClassName?: string;
  knobColor?: string;
  indicatorColor?: string;
  displayTransformer?: (value: number) => string | number;
  disabled?: boolean;
}

export const RotaryKnob = ({  
  label, 
  min = 0, 
  max = 10, 
  value = 0, 
  onChange, 
  className,
  size = 'md',
  labelClassName,
  valueClassName,
  knobColor,
  indicatorColor,
  displayTransformer,
  disabled = false
}: RotaryKnobProps) => {
  const [rotation, setRotation] = useState(0);
  const [internalValue, setInternalValue] = useState(value);
  const knobRef = useRef<HTMLDivElement>(null);

  // Map value to rotation (-135deg to +135deg)
  useEffect(() => {
    const range = max - min;
    const percentage = (value - min) / range;
    const deg = -135 + (percentage * 270);
    setRotation(deg);
    setInternalValue(value);
  }, [value, min, max]);

  const handleInteraction = (newValue: number) => {
      if (newValue !== internalValue) {
          onChange?.(newValue);
          knobClick.play();
      }
  };
  
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!knobRef.current || disabled) return;

      const rect = knobRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const clickX = e.clientX;

      // Determine direction based on click position relative to center
      if (clickX < centerX) {
          // Decrement
          const nextVal = internalValue <= min ? min : internalValue - 1;
          handleInteraction(nextVal);
      } else {
          // Increment
          const nextVal = internalValue >= max ? max : internalValue + 1;
          handleInteraction(nextVal);
      }
  };

  const sizeClasses = {
      sm: "w-10 h-10",
      md: "w-16 h-16",
      lg: "w-24 h-24",
      xl: "w-20 h-20"
  };

  const textSizeClasses = {
      sm: "text-sm",
      md: "text-lg",
      lg: "text-xl",
      xl: "text-3xl"
  };

  return (
    <div className={cn("flex flex-col items-center gap-1", disabled && "opacity-40", className)}>
      {/* Wrapper for Knob + Value Overlay */}
      <div className="relative flex items-center justify-center">
        {/* Knob Body (Rotating) */}
        <div 
            ref={knobRef}
            className={cn(
                "rounded-full relative shadow-[0_4px_10px_rgba(0,0,0,0.8),inset_0_2px_5px_rgba(255,255,255,0.2)] transition-transform active:scale-95",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
                knobColor || "bg-gradient-to-b from-[#444] to-[#111] border-2 border-[#222]",
                sizeClasses[size]
            )}
            onClick={handleClick}
            style={{ transform: `rotate(${rotation}deg)` }}
        >
            {/* Indicator Line */}
            <div className={cn(
                "absolute top-1 left-1/2 -translate-x-1/2 w-1 h-[20%] rounded-full shadow-[0_0_5px_rgba(255,215,0,0.8)]",
                indicatorColor || "bg-casino-gold"
            )} />
            
            {/* Grip Texture */}
            <div className="absolute inset-0 rounded-full border-4 border-dashed border-[#333] opacity-30" />
        </div>

        {/* Central Value Display (Non-rotating overlay) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <span className={cn(
                "font-lcd font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]",
                textSizeClasses[size] || "text-sm",
                valueClassName || "text-white"
             )}>
                {displayTransformer ? displayTransformer(internalValue) : internalValue}
             </span>
        </div>
      </div>

      {/* Label */}
      <span className={cn("text-[10px] uppercase font-orbitron text-muted-foreground tracking-widest", labelClassName)}>{label}</span>
    </div>
  );
};
