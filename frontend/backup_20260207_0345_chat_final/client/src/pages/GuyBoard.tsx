
import React, { useState } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { CasinoButton } from "@/components/casino/CasinoButton";
import { LottoBall } from "@/components/casino/LottoBall";
import { RotaryKnob } from "@/components/casino/RotaryKnob";
import { ToggleSwitch } from "@/components/casino/ToggleSwitch";
import { Counter } from "@/components/casino/Counter";
import { LEDIndicator } from "@/components/casino/LEDIndicator";
import { ProchainTirageConsole } from "@/components/casino/ProchainTirageConsole";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Lock } from "lucide-react";

export default function GuyBoard() {
  // --- STATE (Locked/Simplified for User) ---
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedPreset, setSelectedPreset] = useState("Défaut");

  // Numbers Configuration (Visual only, user can't change much in Auto)
  // We keep the state to drive the UI, but controls might be disabled
  const [highFreqCount, setHighFreqCount] = useState(2);
  const [midFreqCount, setMidFreqCount] = useState(2);
  const [lowFreqCount, setLowFreqCount] = useState(1);

  // Stars Configuration
  const [highStarCount, setHighStarCount] = useState(1);
  const [midStarCount, setMidStarCount] = useState(1);

  // Options (Toggles)
  const [avoidPairExt, setAvoidPairExt] = useState(true);
  const [balanceHighLow, setBalanceHighLow] = useState(true);
  const [emailNotify, setEmailNotify] = useState(true);

  // Results
  const [generatedNumbers, setGeneratedNumbers] = useState<number[]>([]);
  const [generatedStars, setGeneratedStars] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);


  // --- MOCK GENERATION ---
  const handleGenerate = () => {
    setIsGenerating(true);
    setShowSuccessMessage(false);
    setTimeout(() => {
        // We generate fake numbers but won't show them
        setGeneratedNumbers([0, 0, 0, 0, 0]); // 0 represents masked
        setGeneratedStars([0, 0]);
        setIsGenerating(false);
        setShowSuccessMessage(true);
    }, 2000);
  };

  // --- COMPONENT HELPERS ---
  const SectionPanel = ({ title, children, className }: { title: string, children: React.ReactNode, className?: string }) => (
    <div className={cn("bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-zinc-700 rounded-lg p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] opacity-90", className)}>
        <h3 className="font-orbitron text-casino-gold text-sm tracking-widest border-b border-zinc-800 pb-2 mb-4 flex justify-between items-center">
            {title}
            <LEDIndicator active={true} color="blue" />
        </h3>
        {children}
    </div>
  );

  return (
    <CasinoLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        
        {/* TOP BAR: CONTROL CENTER */}
        <div className="bg-zinc-900 border-b-4 border-blue-600 rounded-t-xl p-4 flex flex-wrap gap-6 items-center justify-between shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,transparent_25%,#fff_25%,#fff_50%,transparent_50%,transparent_75%,#fff_75%,#fff_100%)] bg-[length:20px_20px]" />
             
             <div className="relative z-10 flex items-center gap-4">
                 <h1 className="text-2xl font-orbitron font-black text-white tracking-widest">
                     <span className="text-blue-500">FORBO</span> ANALYSEUR
                 </h1>
                 <div className="h-8 w-px bg-zinc-700" />
                 <div className="flex items-center gap-2 bg-black px-3 py-1 rounded border border-zinc-700 opacity-70">
                     <span className="text-xs text-muted-foreground uppercase">MODE</span>
                     <div className="bg-blue-900 text-blue-200 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 cursor-not-allowed">
                        <Lock size={10}/> AUTO
                     </div>
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
                        readOnly
                        className="bg-black border border-zinc-700 text-zinc-400 text-sm px-2 py-1 rounded font-rajdhani cursor-not-allowed"
                     />
                 </div>
                 <div className="flex flex-col">
                     <label className="text-[10px] text-muted-foreground uppercase">Preset</label>
                     <select 
                        value={selectedPreset}
                        onChange={(e) => setSelectedPreset(e.target.value)}
                        className="bg-black border border-zinc-700 text-white text-sm px-2 py-1 rounded font-rajdhani min-w-[150px]"
                     >
                         <option>Recommandé (Défaut)</option>
                         <option>Sécurité Max</option>
                     </select>
                 </div>
             </div>
        </div>

        {/* MAIN COCKPIT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
            
            {/* Overlay for "Auto Mode" effect - optional, but helps show it's automated */}
            {/* <div className="absolute inset-0 z-50 bg-black/10 pointer-events-none" /> */}

            {/* LEFT: NUMBERS CONFIG (READ ONLY) */}
            <div className="lg:col-span-5 space-y-4">
                <SectionPanel title="PARAMÈTRES AUTOMATIQUES">
                    <div className="space-y-6 pointer-events-none grayscale-[0.5]">
                        {/* High Freq */}
                        <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-zinc-800">
                            <ToggleSwitch checked={true} onChange={() => {}} />
                            <div className="flex-1 px-4">
                                <div className="text-sm font-bold text-white mb-1">FRÉQUENCE ÉLEVÉE</div>
                                <div className="text-xs text-casino-gold">TOP 10 • Tendance ↑</div>
                            </div>
                            <Counter label="NB. BOULES" value={highFreqCount} onChange={setHighFreqCount} max={10} />
                        </div>

                        {/* Mid Freq */}
                        <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-zinc-800">
                            <ToggleSwitch checked={true} onChange={() => {}} activeColor="bg-yellow-500" />
                            <div className="flex-1 px-4">
                                <div className="text-sm font-bold text-white mb-1">FRÉQUENCE MOYENNE</div>
                                <div className="text-xs text-yellow-500">MID 10 • Stable →</div>
                            </div>
                            <Counter label="NB. BOULES" value={midFreqCount} onChange={setMidFreqCount} max={6} />
                        </div>

                        {/* Low Freq */}
                        <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-zinc-800">
                            <ToggleSwitch checked={true} onChange={() => {}} activeColor="bg-blue-500" />
                            <div className="flex-1 px-4">
                                <div className="text-sm font-bold text-white mb-1">FRÉQUENCE BASSE</div>
                                <div className="text-xs text-blue-500">LOW 10 • Dette Max</div>
                            </div>
                            <Counter label="NB. BOULES" value={lowFreqCount} onChange={setLowFreqCount} max={1} />
                        </div>
                    </div>
                </SectionPanel>

                <SectionPanel title="PONDÉRATIONS (IA)">
                    <div className="grid grid-cols-4 gap-4 justify-items-center pointer-events-none opacity-70">
                        <RotaryKnob label="HIGH" value={3} max={5} />
                        <RotaryKnob label="MID" value={2} max={5} />
                        <RotaryKnob label="LOW" value={1} max={5} />
                        <RotaryKnob label="START" value={1} max={5} />
                    </div>
                </SectionPanel>
            </div>

            {/* CENTER: DASHBOARD / OPTIONS */}
            <div className="lg:col-span-2 flex flex-col gap-4">
                 <div className="bg-[#111] border-2 border-zinc-800 rounded-xl flex-1 p-4 flex flex-col items-center justify-center gap-6 shadow-inner relative overflow-hidden">
                     <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-black to-black pointer-events-none" />
                     
                     <div className="w-full space-y-4 relative z-10 pointer-events-none">
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
                 </div>
            </div>

            {/* RIGHT: STARS CONFIG */}
            <div className="lg:col-span-5 space-y-4">
                <SectionPanel title="PARAMÈTRES ÉTOILES">
                     <div className="space-y-6 pointer-events-none grayscale-[0.5]">
                        <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-zinc-800">
                            <ToggleSwitch checked={true} onChange={() => {}} activeColor="bg-purple-500" />
                            <div className="flex-1 px-4">
                                <div className="text-sm font-bold text-white mb-1">ÉTOILES CHAUDES</div>
                                <div className="text-xs text-purple-400">TOP 6</div>
                            </div>
                            <Counter label="NB. ÉTOILES" value={highStarCount} onChange={setHighStarCount} max={2} />
                        </div>

                        <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-zinc-800">
                            <ToggleSwitch checked={true} onChange={() => {}} activeColor="bg-pink-500" />
                            <div className="flex-1 px-4">
                                <div className="text-sm font-bold text-white mb-1">ÉTOILES MOYENNES</div>
                                <div className="text-xs text-pink-400">MID 6</div>
                            </div>
                            <Counter label="NB. ÉTOILES" value={midStarCount} onChange={setMidStarCount} max={2} />
                        </div>
                     </div>
                </SectionPanel>

                <SectionPanel title="PONDÉRATIONS ÉTOILES (IA)">
                    <div className="grid grid-cols-2 gap-8 justify-items-center pointer-events-none opacity-70">
                        <RotaryKnob label="HIGH STARS" value={2} max={5} />
                        <RotaryKnob label="MID STARS" value={1} max={5} />
                    </div>
                </SectionPanel>
            </div>

        </div>

        {/* BOTTOM: RESULT AREA */}
        <div className="bg-gradient-to-t from-black to-zinc-900 border-t-4 border-blue-600 rounded-b-xl p-6 shadow-2xl relative mt-8">
             <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                 
                 {/* Result Display */}
                 <div className="flex-1 flex flex-col items-center gap-4">
                     <h2 className="font-orbitron text-xl text-white tracking-[0.2em] animate-pulse">
                         RÉSULTAT
                     </h2>
                     <div className="flex flex-wrap justify-center gap-4 min-h-[80px] bg-black/50 p-4 rounded-full border border-zinc-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] px-8">
                         {generatedNumbers.length > 0 ? (
                             <>
                                {generatedNumbers.map((_, i) => (
                                    <div key={`n-${i}`} className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-900 to-black border border-blue-500/30 flex items-center justify-center font-bold text-white shadow-lg">
                                        ??
                                    </div>
                                ))}
                                <div className="w-px h-12 bg-zinc-700 mx-2" />
                                {generatedStars.map((_, i) => (
                                    <div key={`s-${i}`} className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-900 to-black border border-purple-500/30 flex items-center justify-center font-bold text-white shadow-lg">
                                        ??
                                    </div>
                                ))}
                             </>
                         ) : (
                             <div className="flex items-center text-zinc-600 font-lcd text-2xl tracking-widest">
                                 -- -- -- -- --  //  -- --
                             </div>
                         )}
                     </div>
                     {showSuccessMessage && (
                        <div className="text-green-500 font-rajdhani font-bold animate-bounce">
                            ✓ Analyse terminée. Les numéros ont été envoyés par email.
                        </div>
                     )}
                 </div>

                 {/* Action Panel */}
                 <div className="flex flex-col gap-4 min-w-[300px]">
                     <div className="flex justify-center gap-4 bg-black/30 p-2 rounded">
                         <div className="flex items-center gap-2">
                             <ToggleSwitch checked={emailNotify} onChange={setEmailNotify} className="scale-75" />
                             <span className="text-xs font-bold text-zinc-400">EMAIL</span>
                         </div>
                     </div>

                     <CasinoButton 
                        size="lg" 
                        variant="primary" 
                        className="w-full text-lg shadow-[0_0_20px_rgba(0,100,255,0.4)] animate-pulse hover:animate-none"
                        onClick={handleGenerate}
                     >
                         {isGenerating ? "ANALYSE EN COURS..." : "★ LANCER L'ANALYSE ★"}
                     </CasinoButton>
                 </div>
             </div>
        </div>

      </div>
    </CasinoLayout>
  );
}
