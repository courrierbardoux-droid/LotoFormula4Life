
import React, { useState } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { CasinoButton } from "@/components/casino/CasinoButton";
import { LottoBall } from "@/components/casino/LottoBall";
import { RotaryKnob } from "@/components/casino/RotaryKnob";
import { ToggleSwitch } from "@/components/casino/ToggleSwitch";
import { Counter } from "@/components/casino/Counter";
import { LCDDisplay } from "@/components/casino/LCDDisplay";
import { LEDIndicator } from "@/components/casino/LEDIndicator";
import { ProchainTirageConsole } from "@/components/casino/ProchainTirageConsole";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Settings, Sliders, Play, Lock, Unlock } from "lucide-react";

export default function AdminBoard() {
  // --- STATE ---
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedPreset, setSelectedPreset] = useState("Défaut");

  // Numbers Configuration
  const [highFreqCount, setHighFreqCount] = useState(2);
  const [midFreqCount, setMidFreqCount] = useState(2);
  const [lowFreqCount, setLowFreqCount] = useState(1);
  const [highFreqActive, setHighFreqActive] = useState(true);
  const [midFreqActive, setMidFreqActive] = useState(true);
  const [lowFreqActive, setLowFreqActive] = useState(true);

  // Stars Configuration
  const [highStarCount, setHighStarCount] = useState(1);
  const [midStarCount, setMidStarCount] = useState(1);
  const [highStarActive, setHighStarActive] = useState(true);
  const [midStarActive, setMidStarActive] = useState(true);

  // Weightings (Knobs)
  const [weightHigh, setWeightHigh] = useState(2);
  const [weightMid, setWeightMid] = useState(2);
  const [weightLow, setWeightLow] = useState(1);
  const [weightStart, setWeightStart] = useState(0);
  const [weightStarHigh, setWeightStarHigh] = useState(1);
  const [weightStarMid, setWeightStarMid] = useState(1);

  // Options (Toggles)
  const [avoidPairExt, setAvoidPairExt] = useState(true);
  const [balanceHighLow, setBalanceHighLow] = useState(true);
  const [avoidPopSeq, setAvoidPopSeq] = useState(true);
  const [avoidFriday, setAvoidFriday] = useState(false);
  const [emailNotify, setEmailNotify] = useState(true);
  const [smsNotify, setSmsNotify] = useState(false);

  // Results
  const [generatedNumbers, setGeneratedNumbers] = useState<number[]>([]);
  const [generatedStars, setGeneratedStars] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);


  // --- MOCK GENERATION ---
  const handleGenerate = () => {
    setIsGenerating(true);
    // Audio effect would go here
    setTimeout(() => {
        setGeneratedNumbers([7, 14, 23, 38, 42]);
        setGeneratedStars([3, 9]);
        setIsGenerating(false);
    }, 1500);
  };

  // --- COMPONENT HELPERS ---
  const SectionPanel = ({ title, children, className }: { title: string, children: React.ReactNode, className?: string }) => (
    <div className={cn("bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-zinc-700 rounded-lg p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]", className)}>
        <h3 className="font-orbitron text-casino-gold text-sm tracking-widest border-b border-zinc-800 pb-2 mb-4 flex justify-between items-center">
            {title}
            <LEDIndicator active={true} color="green" />
        </h3>
        {children}
    </div>
  );

  return (
    <CasinoLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        
        {/* TOP BAR: CONTROL CENTER */}
        <div className="bg-zinc-900 border-b-4 border-casino-gold rounded-t-xl p-4 flex flex-wrap gap-6 items-center justify-between shadow-2xl relative overflow-hidden">
             {/* Background Tech Pattern */}
             <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,transparent_25%,#fff_25%,#fff_50%,transparent_50%,transparent_75%,#fff_75%,#fff_100%)] bg-[length:20px_20px]" />
             
             <div className="relative z-10 flex items-center gap-4">
                 <h1 className="text-2xl font-orbitron font-black text-white tracking-widest">
                     <span className="text-casino-gold">ADMIN</span>BOARD
                 </h1>
                 <div className="h-8 w-px bg-zinc-700" />
                 <div className="flex items-center gap-2 bg-black px-3 py-1 rounded border border-zinc-700">
                     <span className="text-xs text-muted-foreground uppercase">MODE</span>
                     <button 
                        onClick={() => setMode(m => m === 'auto' ? 'manual' : 'auto')}
                        className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded transition-colors flex items-center gap-1",
                            mode === 'auto' ? "bg-blue-900 text-blue-200" : "bg-orange-900 text-orange-200"
                        )}
                     >
                        {mode === 'auto' ? <Lock size={10}/> : <Unlock size={10}/>}
                        {mode.toUpperCase()}
                     </button>
                 </div>
             </div>

             <div className="relative z-10">
                <ProchainTirageConsole />
             </div>

             <div className="relative z-10 flex items-center gap-6">
                 <div className="flex flex-col">
                     <label className="text-[10px] text-muted-foreground uppercase">Date Tirage</label>
                     <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-black border border-zinc-700 text-white text-sm px-2 py-1 rounded font-rajdhani"
                     />
                 </div>
                 <div className="flex flex-col">
                     <label className="text-[10px] text-muted-foreground uppercase">Preset</label>
                     <select 
                        value={selectedPreset}
                        onChange={(e) => setSelectedPreset(e.target.value)}
                        className="bg-black border border-zinc-700 text-white text-sm px-2 py-1 rounded font-rajdhani min-w-[150px]"
                     >
                         <option>Défaut</option>
                         <option>Agressif</option>
                         <option>Conservateur</option>
                         <option>Test V2</option>
                     </select>
                 </div>
             </div>
        </div>

        {/* MAIN COCKPIT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT: NUMBERS CONFIG */}
            <div className="lg:col-span-5 space-y-4">
                <SectionPanel title="CONFIGURATION BOULES (1-50)">
                    <div className="space-y-6">
                        {/* High Freq */}
                        <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-zinc-800">
                            <ToggleSwitch checked={highFreqActive} onChange={setHighFreqActive} />
                            <div className="flex-1 px-4">
                                <div className="text-sm font-bold text-white mb-1">FRÉQUENCE ÉLEVÉE</div>
                                <div className="text-xs text-casino-gold">TOP 10 • Tendance ↑</div>
                            </div>
                            <Counter label="NB. BOULES" value={highFreqCount} onChange={setHighFreqCount} max={10} />
                        </div>

                        {/* Mid Freq */}
                        <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-zinc-800">
                            <ToggleSwitch checked={midFreqActive} onChange={setMidFreqActive} activeColor="bg-yellow-500" />
                            <div className="flex-1 px-4">
                                <div className="text-sm font-bold text-white mb-1">FRÉQUENCE MOYENNE</div>
                                <div className="text-xs text-yellow-500">MID 10 • Stable →</div>
                            </div>
                            <Counter label="NB. BOULES" value={midFreqCount} onChange={setMidFreqCount} max={6} />
                        </div>

                        {/* Low Freq */}
                        <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-zinc-800">
                            <ToggleSwitch checked={lowFreqActive} onChange={setLowFreqActive} activeColor="bg-blue-500" />
                            <div className="flex-1 px-4">
                                <div className="text-sm font-bold text-white mb-1">FRÉQUENCE BASSE</div>
                                <div className="text-xs text-blue-500">LOW 10 • Dette Max</div>
                            </div>
                            <Counter label="NB. BOULES" value={lowFreqCount} onChange={setLowFreqCount} max={1} />
                        </div>
                    </div>
                </SectionPanel>

                <SectionPanel title="PONDÉRATIONS BOULES">
                    <div className="grid grid-cols-4 gap-4 justify-items-center">
                        <RotaryKnob label="HIGH" value={weightHigh} onChange={setWeightHigh} max={5} />
                        <RotaryKnob label="MID" value={weightMid} onChange={setWeightMid} max={5} />
                        <RotaryKnob label="LOW" value={weightLow} onChange={setWeightLow} max={5} />
                        <RotaryKnob label="START" value={weightStart} onChange={setWeightStart} max={5} />
                    </div>
                </SectionPanel>
            </div>

            {/* CENTER: DASHBOARD / OPTIONS */}
            <div className="lg:col-span-2 flex flex-col gap-4">
                 <div className="bg-[#111] border-2 border-zinc-800 rounded-xl flex-1 p-4 flex flex-col items-center justify-center gap-6 shadow-inner relative overflow-hidden">
                     <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-black to-black pointer-events-none" />
                     
                     <div className="w-full space-y-4 relative z-10">
                        <div className="text-center font-orbitron text-xs text-zinc-500 border-b border-zinc-800 pb-2">OPTI. ÉQUILIBRE</div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-xs font-rajdhani text-zinc-300">NO PAIR/IMPAIR EXT.</span>
                            <ToggleSwitch checked={avoidPairExt} onChange={setAvoidPairExt} className="scale-75 origin-right" />
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-xs font-rajdhani text-zinc-300">ÉQUILIBRE HAUT/BAS</span>
                            <ToggleSwitch checked={balanceHighLow} onChange={setBalanceHighLow} className="scale-75 origin-right" />
                        </div>
                     </div>

                     <div className="w-full h-px bg-zinc-800" />

                     <div className="w-full space-y-4 relative z-10">
                        <div className="text-center font-orbitron text-xs text-zinc-500 border-b border-zinc-800 pb-2">OPTI. GAINS</div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-xs font-rajdhani text-zinc-300">NO SÉQ. POPULAIRE</span>
                            <ToggleSwitch checked={avoidPopSeq} onChange={setAvoidPopSeq} className="scale-75 origin-right" activeColor="bg-red-500" />
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-xs font-rajdhani text-zinc-300">NO VENDREDI</span>
                            <ToggleSwitch checked={avoidFriday} onChange={setAvoidFriday} className="scale-75 origin-right" activeColor="bg-red-500" />
                        </div>
                     </div>
                 </div>
            </div>

            {/* RIGHT: STARS CONFIG */}
            <div className="lg:col-span-5 space-y-4">
                <SectionPanel title="CONFIGURATION ÉTOILES (1-12)">
                     <div className="space-y-6">
                        {/* High Star */}
                        <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-zinc-800">
                            <ToggleSwitch checked={highStarActive} onChange={setHighStarActive} activeColor="bg-purple-500" />
                            <div className="flex-1 px-4">
                                <div className="text-sm font-bold text-white mb-1">ÉTOILES CHAUDES</div>
                                <div className="text-xs text-purple-400">TOP 6</div>
                            </div>
                            <Counter label="NB. ÉTOILES" value={highStarCount} onChange={setHighStarCount} max={2} />
                        </div>

                        {/* Mid Star */}
                        <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-zinc-800">
                            <ToggleSwitch checked={midStarActive} onChange={setMidStarActive} activeColor="bg-pink-500" />
                            <div className="flex-1 px-4">
                                <div className="text-sm font-bold text-white mb-1">ÉTOILES MOYENNES</div>
                                <div className="text-xs text-pink-400">MID 6</div>
                            </div>
                            <Counter label="NB. ÉTOILES" value={midStarCount} onChange={setMidStarCount} max={2} />
                        </div>
                     </div>
                </SectionPanel>

                <SectionPanel title="PONDÉRATIONS ÉTOILES">
                    <div className="grid grid-cols-2 gap-8 justify-items-center">
                        <RotaryKnob label="HIGH STARS" value={weightStarHigh} onChange={setWeightStarHigh} max={5} />
                        <RotaryKnob label="MID STARS" value={weightStarMid} onChange={setWeightStarMid} max={5} />
                    </div>
                </SectionPanel>
            </div>

        </div>

        {/* BOTTOM: RESULT AREA */}
        <div className="bg-gradient-to-t from-black to-zinc-900 border-t-4 border-casino-red rounded-b-xl p-6 shadow-2xl relative mt-8">
             <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                 
                 {/* Result Display */}
                 <div className="flex-1 flex flex-col items-center gap-4">
                     <h2 className="font-orbitron text-xl text-white tracking-[0.2em] animate-pulse">
                         RÉSULTAT DE L'ANALYSE
                     </h2>
                     <div className="flex flex-wrap justify-center gap-4 min-h-[80px] bg-black/50 p-4 rounded-full border border-zinc-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] px-8">
                         {generatedNumbers.length > 0 ? (
                             <>
                                {generatedNumbers.map(n => <LottoBall key={n} number={n} size="lg" status="selected" />)}
                                <div className="w-px h-12 bg-zinc-700 mx-2" />
                                {generatedStars.map(n => <LottoBall key={n} number={n} size="lg" isStar />)}
                             </>
                         ) : (
                             <div className="flex items-center text-zinc-600 font-lcd text-2xl tracking-widest">
                                 -- -- -- -- --  //  -- --
                             </div>
                         )}
                     </div>
                 </div>

                 {/* Action Panel */}
                 <div className="flex flex-col gap-4 min-w-[300px]">
                     <div className="flex justify-center gap-4 bg-black/30 p-2 rounded">
                         <div className="flex items-center gap-2">
                             <ToggleSwitch checked={emailNotify} onChange={setEmailNotify} className="scale-75" />
                             <span className="text-xs font-bold text-zinc-400">EMAIL</span>
                         </div>
                         <div className="w-px bg-zinc-700" />
                         <div className="flex items-center gap-2">
                             <ToggleSwitch checked={smsNotify} onChange={setSmsNotify} className="scale-75" />
                             <span className="text-xs font-bold text-zinc-400">SMS</span>
                         </div>
                     </div>

                     <CasinoButton 
                        size="lg" 
                        variant="secondary" 
                        className="w-full text-lg shadow-[0_0_20px_rgba(220,20,60,0.4)] animate-pulse hover:animate-none"
                        onClick={handleGenerate}
                     >
                         {isGenerating ? "CALCUL EN COURS..." : "★ VALIDER LA COMBINAISON ★"}
                     </CasinoButton>
                 </div>
             </div>
        </div>

      </div>
    </CasinoLayout>
  );
}
