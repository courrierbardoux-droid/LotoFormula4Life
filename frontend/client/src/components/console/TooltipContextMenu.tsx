import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

export interface TooltipData {
    title: string;
    description: string;
    reasoning?: string; // e.g. "Pourquoi (règle statistique)"
    example?: string;   // e.g. "Exemple concret"
    color?: string;     // default: '#a855f7' (purple)
}

interface TooltipContextMenuProps {
    x: number;
    y: number;
    data: TooltipData;
    onClose: () => void;
}

export function TooltipContextMenu({ x, y, data, onClose }: TooltipContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);

    // Auto-close on outside click or Escape
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        // Use a slight delay to avoid immediate closure if the context menu trigger event bubbles up
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('contextmenu', handleClickOutside); // also close if right-clicking elsewhere
            document.addEventListener('keydown', handleEscape);
        }, 10);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('contextmenu', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Adjust X/Y to prevent window overflow
    const padding = 10;
    let finalX = x;
    let finalY = y;

    // This requires the component to render once to get its dimensions, 
    // but we can estimate or use CSS max-width
    const color = data.color || '#a855f7';

    return (
        <div
            ref={ref}
            className="fixed z-[9999] animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
            style={{
                left: finalX,
                top: finalY,
                // Push slightly down and right from the cursor
                transform: 'translate(4px, 4px)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing it immediately
        >
            <div
                className="relative bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl p-4 w-[320px] max-w-[90vw] overflow-hidden flex flex-col gap-3"
                style={{ boxShadow: `0 10px 40px -10px ${color}40, 0 0 0 1px rgba(255,255,255,0.05)` }}
            >
                {/* Accents visuels */}
                <div className="absolute top-0 left-0 right-0 h-1 opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                <div className="absolute -top-10 -right-10 w-20 h-20 rounded-full blur-2xl opacity-20 pointer-events-none" style={{ background: color }} />

                {/* Titre */}
                <div className="flex items-center gap-2">
                    <Info size={16} style={{ color }} />
                    <h4 className="font-orbitron font-bold text-base text-white tracking-widest uppercase m-0 leading-none">
                        {data.title}
                    </h4>
                </div>

                {/* Description Principale */}
                <div className="text-zinc-300 text-sm font-rajdhani leading-relaxed">
                    {data.description}
                </div>

                {/* Raison / Statistique */}
                {data.reasoning && (
                    <div className="bg-black/40 border border-white/5 rounded p-2.5 mt-1">
                        <div className="text-[10px] uppercase font-bold tracking-widest mb-1 opacity-70" style={{ color }}>
                            Pourquoi ?
                        </div>
                        <div className="text-zinc-400 text-xs font-mono leading-snug">
                            {data.reasoning}
                        </div>
                    </div>
                )}

                {/* Exemple */}
                {data.example && (
                    <div className="mt-1">
                        <span className="text-zinc-500 text-xs italic">Ex : {data.example}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
