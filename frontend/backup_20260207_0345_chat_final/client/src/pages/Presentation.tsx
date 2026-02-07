import React, { useState, useEffect } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { RotaryKnob } from "@/components/casino/RotaryKnob";
import { ToggleSwitch } from "@/components/casino/ToggleSwitch";
import { LottoBall } from "@/components/casino/LottoBall";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Presentation() {
  // Demo State for Animation
  const [strategy, setStrategy] = useState(0);
  const [knobs, setKnobs] = useState({ high: 2, mid: 2, low: 1, dormeur: 0 });

  // Animation Loop
  useEffect(() => {
    const interval = setInterval(() => {
        setStrategy(prev => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (strategy === 0) { // Equilibre
        setKnobs({ high: 2, mid: 2, low: 1, dormeur: 0 });
    } else if (strategy === 1) { // Dormeurs
        setKnobs({ high: 0, mid: 1, low: 2, dormeur: 2 });
    } else { // Chauds
        setKnobs({ high: 4, mid: 1, low: 0, dormeur: 0 });
    }
  }, [strategy]);

  return (
    <CasinoLayout>
      <div className="min-h-screen text-white p-4 md:p-8 max-w-5xl mx-auto font-rajdhani space-y-16 pb-24">
        
        {/* HEADER */}
        <div className="text-center space-y-4 pt-4">
            <h1 className="text-4xl md:text-6xl font-orbitron font-black text-casino-gold uppercase tracking-widest text-shadow-glow">
                PRÉSENTATION DU SYSTÈME
            </h1>
            <p className="text-xl text-zinc-400 italic">"Maîtrisez la Loi de Compensation et optimisez vos chances."</p>
        </div>

        {/* SECTION 1: INTRO */}
        <section className="space-y-6 border border-zinc-800 bg-zinc-900/50 p-6 rounded-xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-casino-gold" />
             <h2 className="text-2xl font-orbitron text-white">LA LOI DE COMPENSATION</h2>
             <div className="prose prose-invert max-w-none text-lg leading-relaxed text-zinc-300">
                <p>
                    Il n'y a pas de hasard dans l'univers. Seulement des probabilités qui tendent vers l'équilibre.
                    La <strong>Loi de Compensation</strong> stipule que tout déséquilibre statistique crée une tension qui doit se résoudre :
                </p>
                <ul className="list-disc pl-6 space-y-2 marker:text-casino-gold">
                    <li>Un numéro absent depuis longtemps accumule une <span className="text-blue-400 font-bold">"DETTE"</span></li>
                    <li>Un numéro sorti fréquemment a <span className="text-red-400 font-bold">"ÉPUISÉ"</span> son quota temporairement</li>
                </ul>
                <p>
                    LotoFormula4Life analyse ces tensions et identifie les numéros statistiquement "dus" pour le prochain tirage.
                </p>
             </div>
        </section>

        {/* SECTION 2: RACKS */}
        <section className="space-y-6">
             <h2 className="text-2xl font-orbitron text-white border-b border-zinc-800 pb-2">LES RACKS DE CONFIGURATION</h2>
             
             <div className="relative bg-black border border-zinc-700 p-4 rounded-lg max-w-2xl mx-auto">
                 {/* Fake Rack UI */}
                 <div className="bg-black/30 p-2 rounded border border-zinc-800 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-4">
                        <ToggleSwitch checked={true} onChange={() => {}} className="scale-75 origin-left" />
                        <div className="flex-1 px-2">
                            <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE ÉLEVÉE</div>
                            <div className="text-sm text-casino-gold">TOP 10 • Tendance ↑</div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 font-mono text-casino-gold font-bold">
                            6
                        </div>
                    </div>
                    
                    <div className="flex gap-2 justify-center">
                         <div className="flex flex-col items-center gap-1 group">
                            <span className="text-xs text-zinc-400">75%</span>
                            <LottoBall number={23} size="md" status="selected" />
                            <div className="flex items-center gap-0.5 text-[10px] font-bold text-red-400">
                                <span>9</span> <ArrowUp size={8} />
                            </div>
                        </div>
                         <div className="flex flex-col items-center gap-1 group">
                            <span className="text-xs text-zinc-400">70%</span>
                            <LottoBall number={42} size="md" status="selected" />
                            <div className="flex items-center gap-0.5 text-[10px] font-bold text-red-400">
                                <span>8</span> <ArrowUp size={8} />
                            </div>
                        </div>
                         <div className="flex flex-col items-center gap-1 group">
                            <span className="text-xs text-zinc-400">68%</span>
                            <LottoBall number={44} size="md" status="default" />
                            <div className="flex items-center gap-0.5 text-[10px] font-bold text-green-400">
                                <span>8</span> <ArrowUp size={8} />
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 group opacity-50">
                            <span className="text-xs text-zinc-400">...</span>
                             <div className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-600 text-xs">...</div>
                        </div>
                    </div>
                 </div>

                 {/* Annotations */}
                 <div className="absolute top-4 right-4 translate-x-full pl-4 text-xs text-casino-gold w-48 hidden md:block">
                    ← Combien de boules choisir dans cette catégorie
                 </div>
                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-full pt-4 text-xs text-center text-zinc-400 w-full">
                    Score de tendance (0-10) • Pourcentage de fréquence
                 </div>
             </div>
        </section>

        {/* SECTION 3: KNOBS */}
        <section className="space-y-6">
             <h2 className="text-2xl font-orbitron text-white border-b border-zinc-800 pb-2">PONDÉRATIONS — COMMENT ÇA MARCHE ?</h2>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                 <div className="prose prose-invert text-zinc-300">
                    <p>Les boutons rotatifs définissent <strong>COMBIEN</strong> de numéros seront sélectionnés dans chaque catégorie en mode AUTO.</p>
                    <p>Exemple :</p>
                    <ul className="list-disc pl-4 space-y-1 text-sm">
                        <li><strong>2</strong> numéros parmi les PLUS FRÉQUENTS</li>
                        <li><strong>2</strong> numéros parmi les FRÉQUENCES MOYENNES</li>
                        <li><strong>1</strong> numéro parmi les MOINS FRÉQUENTS</li>
                    </ul>
                    <p className="mt-4 font-bold text-white">TOTAL : 2 + 2 + 1 = 5 numéros (grille simple)</p>
                 </div>

                 <div className="bg-[#111] p-6 rounded-xl border border-zinc-800 flex justify-center gap-4">
                        <RotaryKnob label="ÉLEVÉE" value={2} onChange={()=>{}} max={5} labelClassName="text-xs font-bold" size="md" />
                        <RotaryKnob label="MOYENNE" value={2} onChange={()=>{}} max={5} labelClassName="text-xs font-bold" size="md" />
                        <RotaryKnob label="BASSE" value={1} onChange={()=>{}} max={5} labelClassName="text-xs font-bold" size="md" />
                        <RotaryKnob label="DORMEUR" value={0} onChange={()=>{}} max={5} labelClassName="text-xs font-bold" size="md" />
                 </div>
             </div>
        </section>
        
        {/* SECTION 4: OPTIONS */}
        <section className="space-y-6">
            <h2 className="text-2xl font-orbitron text-white border-b border-zinc-800 pb-2">OPTIONS D'ÉQUILIBRAGE</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-900/50 p-4 rounded border border-zinc-700">
                    <div className="flex items-center gap-3 mb-2">
                        <ToggleSwitch checked={true} onChange={()=>{}} className="scale-75" />
                        <h3 className="font-bold text-white">NO PAIR/IMPAIR EXTRÊME</h3>
                    </div>
                    <p className="text-sm text-zinc-400 ml-12">
                        Évite d'avoir tous les numéros pairs ou tous impairs. Garantit un mix équilibré (ex: 3 pairs + 2 impairs).
                    </p>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded border border-zinc-700">
                    <div className="flex items-center gap-3 mb-2">
                         <ToggleSwitch checked={true} onChange={()=>{}} className="scale-75" />
                         <h3 className="font-bold text-white">ÉQUILIBRE HAUT/BAS</h3>
                    </div>
                    <p className="text-sm text-zinc-400 ml-12">
                        Évite d'avoir tous les numéros &lt; 25 ou tous &gt; 25. Garantit une répartition spatiale sur la grille.
                    </p>
                </div>
            </div>
        </section>

        {/* SECTION 5: STRATEGIES */}
        <section className="space-y-8 bg-gradient-to-br from-zinc-900 to-black p-8 rounded-2xl border border-zinc-700 shadow-2xl">
            <h2 className="text-3xl font-orbitron text-center text-white mb-8">STRATÉGIES DE JEU</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                
                {/* Text Description */}
                <div className="h-[200px] flex flex-col justify-center">
                    <motion.div
                        key={strategy}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-4"
                    >
                        <h3 className="text-2xl font-bold text-casino-gold">
                            {strategy === 0 && "STRATÉGIE 3 : L'ÉQUILIBRE (Recommandé)"}
                            {strategy === 1 && "STRATÉGIE 1 : LES DORMEURS (Dette Max)"}
                            {strategy === 2 && "STRATÉGIE 2 : LES CHAUDS (Momentum)"}
                        </h3>
                        <p className="text-lg text-zinc-300">
                            {strategy === 0 && "La stratégie par défaut, équilibrée entre toutes les approches. Ne mettez pas tous vos œufs dans le même panier."}
                            {strategy === 1 && "Mise sur les numéros absents depuis longtemps. Les numéros avec la plus grande 'dette' ont statistiquement plus de chances de sortir."}
                            {strategy === 2 && "Suit les numéros en phase haute. Un numéro 'chaud' continue souvent sa série avant de redescendre."}
                        </p>
                        <div className="flex gap-4 text-sm font-bold">
                            {strategy === 0 && <span className="text-green-400">Risque : Modéré</span>}
                            {strategy === 1 && <span className="text-red-400">Risque : Élevé (Gros potentiel)</span>}
                            {strategy === 2 && <span className="text-blue-400">Risque : Faible</span>}
                        </div>
                    </motion.div>
                </div>

                {/* Animated Knobs */}
                <div className="bg-black p-6 rounded-xl border border-zinc-800 flex justify-center gap-4 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                    <RotaryKnob label="ÉLEVÉE" value={knobs.high} onChange={()=>{}} max={5} labelClassName="text-xs font-bold" size="md" />
                    <RotaryKnob label="MOYENNE" value={knobs.mid} onChange={()=>{}} max={5} labelClassName="text-xs font-bold" size="md" />
                    <RotaryKnob label="BASSE" value={knobs.low} onChange={()=>{}} max={5} labelClassName="text-xs font-bold" size="md" />
                    <RotaryKnob label="DORMEUR" value={knobs.dormeur} onChange={()=>{}} max={5} labelClassName="text-xs font-bold" size="md" />
                </div>

            </div>
            
            {/* Progress Bar for Slideshow */}
            <div className="flex justify-center gap-2 mt-4">
                {[0, 1, 2].map(i => (
                    <div 
                        key={i} 
                        className={cn(
                            "h-1 rounded-full transition-all duration-300",
                            i === strategy ? "w-8 bg-casino-gold" : "w-2 bg-zinc-800"
                        )} 
                    />
                ))}
            </div>

        </section>

      </div>
    </CasinoLayout>
  );
}
