
import React, { useState, useEffect, useRef } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { CasinoButton } from "@/components/casino/CasinoButton";
import { LottoBall } from "@/components/casino/LottoBall";
import { RotaryKnob } from "@/components/casino/RotaryKnob";
import { ToggleSwitch } from "@/components/casino/ToggleSwitch";
import { Counter } from "@/components/casino/Counter";
import { LEDIndicator } from "@/components/casino/LEDIndicator";
import { ProchainTirageSimple } from "@/components/casino/ProchainTirageSimple";
import { DebugPanel } from "@/components/casino/DebugPanel";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { Lock, Unlock, ChevronDown, RotateCcw, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useUser } from "@/lib/UserContext";
import { 
  getStats, 
  getProchainTirage, 
  getDernierTirage, 
  genererCombinaison, 
  StatsNumeros,
  Tirage 
} from "@/lib/lotoService";
import { 
  getPrixGrille, 
  isCombinaisonValide, 
  getMaxEtoilesAutorisees,
  COMBINAISONS_NUMEROS,
  COMBINAISONS_ETOILES,
  GRILLE_TARIFAIRE
} from "@/lib/pricing";
import { Howl } from 'howler';
import { toast } from "sonner";

// Sounds
const sounds = {
  click: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], volume: 0.3 }),
  toggle: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'], volume: 0.3 }),
  knob: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], volume: 0.2 }),
  bling: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'], volume: 0.4 }),
  jackpot: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'], volume: 0.5 }),
  error: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3'], volume: 0.3 }),
};

// --- HELPER COMPONENTS ---

const SectionPanel = ({ title, children, className, disabled = false, showLed = true, ledActive = true, headerAction }: { title: React.ReactNode, children: React.ReactNode, className?: string, disabled?: boolean, showLed?: boolean, ledActive?: boolean, headerAction?: React.ReactNode }) => (
    <div className={cn(
        "bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-zinc-700 rounded-lg p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]", 
        disabled && "opacity-20 pointer-events-none",
        className
    )}>
        <div className="font-orbitron text-casino-gold text-lg tracking-widest border-b border-zinc-800 pb-1 mb-2 flex justify-between items-center">
            <h3>{title}</h3>
            {headerAction ? headerAction : (showLed && <LEDIndicator active={ledActive} color="green" />)}
        </div>
        {children}
    </div>
);

interface DisplayStat {
  number: number;
  frequency: number;
  trendScore: number;
  trendDirection: 'hausse' | 'baisse' | 'stable';
}

const BallGrid = ({ 
    stats, 
    countLimit, 
    type = 'number',
    selectedNumbers,
    selectedStars,
    onToggle,
    className
  }: { 
    stats: DisplayStat[], 
    countLimit: number,
    type?: 'number' | 'star',
    selectedNumbers: number[],
    selectedStars: number[],
    onToggle: (num: number, type: 'number' | 'star') => void,
    className?: string
  }) => {
    // The user explicitly asked for the number of balls presented to be IDENTICAL to the countLimit (cursor value).
    const visibleStats = stats.slice(0, countLimit);
    
    return (
        <div className={cn("flex flex-nowrap gap-1.5 justify-center py-2", className)}>
            {visibleStats.map(stat => {
                const isSelected = type === 'number' 
                    ? selectedNumbers.includes(stat.number)
                    : selectedStars.includes(stat.number);
                
                return (
                    <div 
                        key={`${type}-${stat.number}`}
                        className="flex flex-col items-center gap-1 cursor-pointer group w-16"
                        onClick={() => onToggle(stat.number, type)}
                    >
                        <span className="text-sm text-zinc-400 font-mono group-hover:text-white transition-colors">{stat.frequency}%</span>
                        <LottoBall 
                            number={stat.number} 
                            isStar={type === 'star'}
                            size="md" 
                            status={isSelected ? 'selected' : 'default'}
                            className="transition-transform group-hover:scale-110"
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


// Type for storing preset configurations
type PresetConfig = {
    // Number Config
    highFreqCount: number;
    midFreqCount: number;
    lowFreqCount: number;
    highFreqActive: boolean;
    midFreqActive: boolean;
    lowFreqActive: boolean;
    
    // Star Config
    highStarCount: number;
    midStarCount: number;
    lowStarCount: number;
    highStarActive: boolean;
    midStarActive: boolean;
    lowStarActive: boolean;
    
    // Weights
    weightHigh: number;
    weightMid: number;
    weightLow: number;
    weightDormeur: number;
    weightStarHigh: number;
    weightStarMid: number;
    weightStarLow: number;
    weightStarDormeur: number;
    
    // Options
    avoidPairExt: boolean;
    balanceHighLow: boolean;
    avoidPopSeq: boolean;
    avoidFriday: boolean;

    // Mode
    mode: 'manual' | 'auto';
};


export default function Console() {
  const { user } = useUser();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPrice, setShowPrice] = useState(false); // Fix for crash

  // --- STATE ---
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  
  // Real Data State
  const [stats, setStats] = useState<StatsNumeros | null>(null);
  const [dernierTirage, setDernierTirage] = useState<Tirage | null>(null);
  const [prochainTirage, setProchainTirage] = useState<{ date: Date, jour: string } | null>(null);
  
  // Preset State
  const [selectedPreset, setSelectedPreset] = useState("1"); // 1 to 5
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const [isPriceGridOpen, setIsPriceGridOpen] = useState(false);
  const priceGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (priceGridRef.current && !priceGridRef.current.contains(event.target as Node)) {
        setIsPriceGridOpen(false);
      }
    }

    if (isPriceGridOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPriceGridOpen]);

  const [presetHasData, setPresetHasData] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{visible: boolean, x: number, y: number} | null>(null);

  // Manual Mode Selection State
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [selectedStars, setSelectedStars] = useState<number[]>([]);
  // const [showPrice, setShowPrice] = useState(false); // Unused
  // const [price, setPrice] = useState(0); // Unused

  // Configuration (Auto/Manual filters)
  const [highFreqCount, setHighFreqCount] = useState(4);
  const [midFreqCount, setMidFreqCount] = useState(3);
  const [lowFreqCount, setLowFreqCount] = useState(2);
  const [highFreqActive, setHighFreqActive] = useState(true);
  const [midFreqActive, setMidFreqActive] = useState(true);
  const [lowFreqActive, setLowFreqActive] = useState(true);

  // Stars Configuration
  const [highStarCount, setHighStarCount] = useState(1);
  const [midStarCount, setMidStarCount] = useState(1);
  const [lowStarCount, setLowStarCount] = useState(1); 
  
  const [highStarActive, setHighStarActive] = useState(true);
  const [midStarActive, setMidStarActive] = useState(true);
  const [lowStarActive, setLowStarActive] = useState(true); 
  const [dormeurStarActive, setDormeurStarActive] = useState(true); 

  // Weightings (Knobs)
  const [weightHigh, setWeightHigh] = useState(2);
  const [weightMid, setWeightMid] = useState(2);
  const [weightLow, setWeightLow] = useState(1);
  const [weightDormeur, setWeightDormeur] = useState(0); 
  
  const [weightStarHigh, setWeightStarHigh] = useState(1);
  const [weightStarMid, setWeightStarMid] = useState(1);
  const [weightStarLow, setWeightStarLow] = useState(1); 
  const [weightStarDormeur, setWeightStarDormeur] = useState(0); 

  // Options (Toggles)
  const [avoidPairExt, setAvoidPairExt] = useState(true);
  const [balanceHighLow, setBalanceHighLow] = useState(true);
  const [avoidPopSeq, setAvoidPopSeq] = useState(true);
  const [avoidFriday, setAvoidFriday] = useState(false);
  const [emailNotify, setEmailNotify] = useState(true);
  const [smsNotify, setSmsNotify] = useState(false);
  
  // Manual Mode Enforcement
  const [respectWeights, setRespectWeights] = useState(false);
  const [respectStarWeights, setRespectStarWeights] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(false);
  const [maxWeightLimit, setMaxWeightLimit] = useState(10);
  const [maxStarWeightLimit, setMaxStarWeightLimit] = useState(12);

  // Results
  const [generatedNumbers, setGeneratedNumbers] = useState<number[]>([]);
  const [generatedStars, setGeneratedStars] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Send Button State
  const [sendCount, setSendCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [sendingMessage, setSendingMessage] = useState("");
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  // Derived Access Rights
  const isAdminOrVip = user?.role === 'admin' || user?.role === 'vip';
  const isInvite = user?.role === 'invite';
  const canUseManual = !isInvite;

  // --- SOUND HELPER ---
  const playSound = (type: keyof typeof sounds) => {
    if (soundEnabled) sounds[type].play();
  };

  // --- DATA LOADING ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const loadedStats = await getStats();
        setStats(loadedStats);
        
        // Load latest draw (needs fetching history again or expose it from service)
        // Since getStats loads history internally, we can call getDernierTirage if we export history
        // Let's rely on lotoService functions
        // We'll add a helper to lotoService to get everything if needed, but for now calling separate is fine
        // Note: lotoService caches the history so it's cheap
        
        // We need the history array for getDernierTirage, which getStats doesn't return directly
        // But we can add a simple export in lotoService or just re-fetch (it's cached)
        // Actually, let's just use a direct import if possible, but cleaner to use the service functions
        // I'll assume I can just import chargerHistorique
        const { chargerHistorique } = await import("@/lib/lotoService");
        const history = await chargerHistorique();
        setDernierTirage(getDernierTirage(history));
        
        setProchainTirage(getProchainTirage());
        
      } catch (err) {
        console.error("Failed to load EuroMillions data", err);
        toast.error("Erreur de chargement des données historiques");
      }
    };
    
    loadData();
  }, []);

  // --- PREPARE STATS FOR DISPLAY ---
  const mapToDisplayStat = (item: { numero: number, frequence: number }, type: 'number' | 'star'): DisplayStat => {
    const defaultTrend = { direction: 'stable' as const, score: 5 };
    const trend = type === 'number' 
        ? (stats?.tendancesNumeros[item.numero] || defaultTrend)
        // For stars, we didn't calculate separate trends in the simplified service, assume stable/random or implement if needed
        // The instructions asked for trends on numbers primarily. We can reuse number logic or default.
        : defaultTrend; 

    return {
      number: item.numero,
      frequency: item.frequence,
      trendScore: trend.score,
      trendDirection: trend.direction
    };
  };

  const highFreqStats = stats?.categoriesNum.elevee.map(s => mapToDisplayStat(s, 'number')) || [];
  const midFreqStats = stats?.categoriesNum.moyenne.map(s => mapToDisplayStat(s, 'number')) || [];
  const lowFreqStats = (stats?.categoriesNum.basse || []).concat(stats?.categoriesNum.depart || []).map(s => mapToDisplayStat(s, 'number')) || [];

  const highStarStats = stats?.categoriesEtoiles.elevee.map(s => mapToDisplayStat(s, 'star')) || [];
  const midStarStats = stats?.categoriesEtoiles.moyenne.map(s => mapToDisplayStat(s, 'star')) || [];
  const lowStarStats = stats?.categoriesEtoiles.basse.map(s => mapToDisplayStat(s, 'star')) || [];
  
  const dormeurStarStats = Object.entries(stats?.absenceEtoiles || {})
      .map(([num, absence]) => ({
          numero: parseInt(num),
          frequence: stats?.freqEtoiles[parseInt(num)] || 0,
          absence
      }))
      .sort((a, b) => b.absence - a.absence)
      .map(s => mapToDisplayStat(s, 'star'));

  // --- MANUAL MODE HELPERS ---
  const getNumberCategory = (num: number) => {
    if (highFreqStats.some(s => s.number === num)) return 'high';
    if (midFreqStats.some(s => s.number === num)) return 'mid';
    if (lowFreqStats.some(s => s.number === num)) return 'low';
    return 'unknown';
  };

  const getSelectionCounts = () => {
    const counts = { high: 0, mid: 0, low: 0 };
    selectedNumbers.forEach(n => {
        const cat = getNumberCategory(n);
        if (cat === 'high') counts.high++;
        else if (cat === 'mid') counts.mid++;
        else if (cat === 'low') counts.low++;
    });
    return counts;
  };
  
  const selectionCounts = getSelectionCounts();

  const getStarCategory = (num: number) => {
    if (highStarStats.some(s => s.number === num)) return 'high';
    if (midStarStats.some(s => s.number === num)) return 'mid';
    if (lowStarStats.some(s => s.number === num)) return 'low';
    return 'unknown';
  };

  const getStarSelectionCounts = () => {
    const counts = { high: 0, mid: 0, low: 0 };
    selectedStars.forEach(n => {
        const cat = getStarCategory(n);
        if (cat === 'high') counts.high++;
        else if (cat === 'mid') counts.mid++;
        else if (cat === 'low') counts.low++;
    });
    return counts;
  };

  // --- COUNTER LIMIT LOGIC ---
  const handleNumberCountChange = (setter: React.Dispatch<React.SetStateAction<number>>, current: number, delta: number) => {
      const newValue = current; 
  };

  const checkNumberLimit = (newVal: number, oldVal: number, other1: number, other2: number) => {
      if (newVal > oldVal) { // Incrementing
          if (newVal + other1 + other2 > 10) {
              toast.error("MAXIMUM 10 NUMÉROS !", { duration: 5000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
              playSound('error');
              return false;
          }
      }
      return true;
  };

  const checkStarLimit = (newVal: number, oldVal: number, other1: number, other2: number) => {
      if (newVal > oldVal) { // Incrementing
          if (newVal + other1 + other2 > 12) {
              toast.error("MAXIMUM 12 ÉTOILES !", { duration: 5000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
              playSound('error');
              return false;
          }
      }
      return true;
  };

  // --- MODE LIBRE / TARIFS LOGIC ---
  const toggleFreeMode = () => {
      const newMode = !isFreeMode;
      setIsFreeMode(newMode);
      playSound('toggle');

      if (newMode) {
          // MODE LIBRE
          setMaxWeightLimit(10);
          setMaxStarWeightLimit(12); // Will be constrained by dynamic check anyway
          toast.success("Mode LIBRE activé - Pondérations débloquées");
      } else {
          // MODE TARIFS
          // We should probably force a selection or lock to current valid if valid?
          // For now, let's just indicate it's locked.
          // Ideally we would revert to the last selected tariff limits, but we don't store them separately.
          // Let's open the grid to prompt user to select a tariff if they are in an "invalid" state for tariffs?
          // Or just leave it locked at current values? 
          // If we lock at current values (e.g. 8 nums), then maxWeightLimit should be 8.
          
          const currentNumCount = weightHigh + weightMid + weightLow + weightDormeur;
          const currentStarCount = weightStarHigh + weightStarMid + weightStarLow + weightStarDormeur;
          
          // Determine closest valid limits or just lock current?
          // If I have 8 nums, I'm in a valid tariff state (8 nums + X stars).
          // So I can just set limits to current counts?
          // Or strictly to standard limits?
          // The user instruction: "L'utilisateur doit sélectionner une combinaison TARIFS"
          
          setMaxWeightLimit(currentNumCount);
          setMaxStarWeightLimit(currentStarCount); // Temporarily lock to what we have
          
          toast.info("Mode TARIFS activé - Sélectionnez une combinaison");
          setIsPriceGridOpen(true);
      }
  };

  // --- VALIDATION AND AUTO-ADJUSTMENT LOGIC ---

  const MAX_ETOILES_PAR_NUMEROS: Record<number, number> = {
      5: 12,
      6: 12,
      7: 6,
      8: 4,
      9: 3,
      10: 2
  };

  const getMaxEtoilesPourNumeros = (nbNumeros: number) => {
      return MAX_ETOILES_PAR_NUMEROS[nbNumeros] || 2;
  };

  // Effect to auto-adjust stars when numbers count changes
  useEffect(() => {
      if (mode === 'manual') return; // Only auto-adjust in Auto mode (pondérations)

      const currentNumCount = weightHigh + weightMid + weightLow + weightDormeur;
      const currentStarCount = weightStarHigh + weightStarMid + weightStarLow + weightStarDormeur;
      
      const maxEtoilesAutorise = getMaxEtoilesPourNumeros(currentNumCount);

      if (currentStarCount > maxEtoilesAutorise) {
          // Reduce stars automatically
          let remainingToReduce = currentStarCount - maxEtoilesAutorise;
          let newWeightStarDormeur = weightStarDormeur;
          let newWeightStarLow = weightStarLow;
          let newWeightStarMid = weightStarMid;
          let newWeightStarHigh = weightStarHigh;

          // Order: Dormeur -> Basse -> Moyenne -> Elevée
          if (remainingToReduce > 0 && newWeightStarDormeur > 0) {
              const reduceAmount = Math.min(newWeightStarDormeur, remainingToReduce);
              newWeightStarDormeur -= reduceAmount;
              remainingToReduce -= reduceAmount;
          }
           if (remainingToReduce > 0 && newWeightStarLow > 0) {
              const reduceAmount = Math.min(newWeightStarLow, remainingToReduce);
              newWeightStarLow -= reduceAmount;
              remainingToReduce -= reduceAmount;
          }
           if (remainingToReduce > 0 && newWeightStarMid > 0) {
              const reduceAmount = Math.min(newWeightStarMid, remainingToReduce);
              newWeightStarMid -= reduceAmount;
              remainingToReduce -= reduceAmount;
          }
           if (remainingToReduce > 0 && newWeightStarHigh > 0) {
              const reduceAmount = Math.min(newWeightStarHigh, remainingToReduce);
              newWeightStarHigh -= reduceAmount;
              remainingToReduce -= reduceAmount;
          }

          setWeightStarDormeur(newWeightStarDormeur);
          setWeightStarLow(newWeightStarLow);
          setWeightStarMid(newWeightStarMid);
          setWeightStarHigh(newWeightStarHigh);
          
          setMaxStarWeightLimit(maxEtoilesAutorise); // Update limits as well
          toast.success(`Étoiles ajustées à ${maxEtoilesAutorise} (limite pour ${currentNumCount} boules)`);
      } else {
          // Update limit if it's restrictive but we are under it
          // This allows users to increase stars if the number count permits it
          setMaxStarWeightLimit(maxEtoilesAutorise);
      }

  }, [weightHigh, weightMid, weightLow, weightDormeur]); // Trigger on any number weight change


  const checkWeightLimit = (newVal: number, oldVal: number, w1: number, w2: number, w3: number) => {
      const total = newVal + w1 + w2 + w3;
      if (total > maxWeightLimit) {
          // Allow decreasing even if over limit to let user fix it
          if (newVal < oldVal) return true;
          
          toast.error(`MAXIMUM ${maxWeightLimit} BOULES (Total Pondérations) !`, { duration: 3000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
          playSound('error');
          return false;
      }
      if (total < 5 && newVal < oldVal) {
           toast.error("MINIMUM 5 BOULES (Total Pondérations) !", { duration: 3000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
           playSound('error');
           return false;
      }
      return true;
  };

  const checkStarWeightLimit = (newVal: number, oldVal: number, w1: number, w2: number, w3: number) => {
      const total = newVal + w1 + w2 + w3;
      
      // Dynamic Check against current number of balls
      const currentNumCount = weightHigh + weightMid + weightLow + weightDormeur;
      const dynamicMax = getMaxEtoilesPourNumeros(currentNumCount);

      if (total > dynamicMax) {
           if (newVal < oldVal) return true;
           toast.error(`MAXIMUM ${dynamicMax} ÉTOILES avec ${currentNumCount} BOULES !`, { duration: 3000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
           playSound('error');
           return false;
      }

      if (total > maxStarWeightLimit) {
          // Allow decreasing even if over limit to let user fix it
          if (newVal < oldVal) return true;

          toast.error(`MAXIMUM ${maxStarWeightLimit} ÉTOILES (Total Pondérations) !`, { duration: 3000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
          playSound('error');
          return false;
      }
      if (total < 2 && newVal < oldVal) {
           toast.error("MINIMUM 2 ÉTOILES (Total Pondérations) !", { duration: 3000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
           playSound('error');
           return false;
      }
      return true;
  };

  // --- MANUAL SELECTION LOGIC ---
  const toggleSelection = (num: number, type: 'number' | 'star') => {
      if (type === 'number') {
        if (selectedNumbers.includes(num)) {
            setSelectedNumbers(prev => prev.filter(n => n !== num));
            playSound('click');
        } else {
            // Check enforcement if enabled
            if (respectWeights) {
                const cat = getNumberCategory(num);
                const counts = selectionCounts; // Use current render counts
                let limit = 0;
                let catName = "";
                
                if (cat === 'high') { limit = weightHigh; catName = "ÉLEVÉE"; }
                else if (cat === 'mid') { limit = weightMid; catName = "MOYENNE"; }
                else if (cat === 'low') { limit = weightLow; catName = "BASSE"; }
                
                if (cat !== 'unknown' && counts[cat as keyof typeof counts] >= limit) {
                    toast.warning(`Limite ${catName} atteinte (${limit}/${limit})`, {
                        style: { background: '#333', color: '#ff9900', border: '1px solid #ff9900' }
                    });
                    playSound('error');
                    return;
                }
            }

            if (selectedNumbers.length >= 10) {
                toast.error("MAXIMUM 10 NUMÉROS !", { duration: 3000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
                playSound('error');
                return;
            }
            setSelectedNumbers(prev => [...prev, num].sort((a, b) => a - b));
            playSound('bling');
        }
      } else {
        if (selectedStars.includes(num)) {
            setSelectedStars(prev => prev.filter(n => n !== num));
            playSound('click');
        } else {
            // Check enforcement if enabled
            if (respectStarWeights) {
                const cat = getStarCategory(num);
                const counts = getStarSelectionCounts();
                let limit = 0;
                let catName = "";
                
                if (cat === 'high') { limit = weightStarHigh; catName = "ÉLEVÉE"; }
                else if (cat === 'mid') { limit = weightStarMid; catName = "MOYENNE"; }
                else if (cat === 'low') { limit = weightStarLow; catName = "BASSE"; }
                
                if (cat !== 'unknown' && counts[cat as keyof typeof counts] >= limit) {
                    toast.warning(`Limite ${catName} atteinte (${limit}/${limit})`, {
                        style: { background: '#333', color: '#ff9900', border: '1px solid #ff9900' }
                    });
                    playSound('error');
                    return;
                }
            }

            if (selectedStars.length >= 12) {
                toast.error("MAXIMUM 12 ÉTOILES !", { duration: 3000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
                playSound('error');
                return;
            }
            setSelectedStars(prev => [...prev, num].sort((a, b) => a - b));
            playSound('bling');
        }
      }
      // Price updates automatically via reactive currentPrice
  };

  // Removed updatePrice() as we use derived state now

    const currentNumCount = mode === 'manual' 
        ? selectedNumbers.length 
        : weightHigh + weightMid + weightLow + weightDormeur;
        
    const currentStarCount = mode === 'manual' 
        ? selectedStars.length 
        : weightStarHigh + weightStarMid + weightStarLow + weightStarDormeur;

    const currentPrice = getPrixGrille(currentNumCount, currentStarCount);
    const isValide = isCombinaisonValide(currentNumCount, currentStarCount);

  // --- PRESET LOGIC ---

  // Check which presets have data on mount/user change
  useEffect(() => {
    if (!user) return;
    const savedPresets = localStorage.getItem(`loto_presets_${user.username}`);
    if (savedPresets) {
        try {
            const parsed = JSON.parse(savedPresets);
            const status: Record<string, boolean> = {};
            for (let i = 1; i <= 5; i++) {
                status[i.toString()] = !!parsed[i.toString()];
            }
            setPresetHasData(status);
        } catch (e) {
            console.error(e);
        }
    }
  }, [user, selectedPreset]); // Update when selection changes (maybe saved)
  
  // Load preset when selection changes
  useEffect(() => {
    if (!user) return;

    // Use user-specific key for presets
    const savedPresets = localStorage.getItem(`loto_presets_${user.username}`);
    if (savedPresets) {
        try {
            const parsed = JSON.parse(savedPresets);
            const presetData = parsed[selectedPreset] as PresetConfig;
            
            if (presetData) {
                // Apply loaded settings
                setHighFreqCount(presetData.highFreqCount);
                setMidFreqCount(presetData.midFreqCount);
                setLowFreqCount(presetData.lowFreqCount);
                setHighFreqActive(presetData.highFreqActive);
                setMidFreqActive(presetData.midFreqActive);
                setLowFreqActive(presetData.lowFreqActive);
                
                setHighStarCount(presetData.highStarCount);
                setMidStarCount(presetData.midStarCount);
                setLowStarCount(presetData.lowStarCount);
                setHighStarActive(presetData.highStarActive);
                setMidStarActive(presetData.midStarActive);
                setLowStarActive(presetData.lowStarActive);
                
                setWeightHigh(presetData.weightHigh);
                setWeightMid(presetData.weightMid);
                setWeightLow(presetData.weightLow);
                setWeightDormeur(presetData.weightDormeur || 0);
                setWeightStarHigh(presetData.weightStarHigh);
                setWeightStarMid(presetData.weightStarMid);
                setWeightStarLow(presetData.weightStarLow);
                setWeightStarDormeur(presetData.weightStarDormeur || 0);
                
                setAvoidPairExt(presetData.avoidPairExt);
                setBalanceHighLow(presetData.balanceHighLow);
                setAvoidPopSeq(presetData.avoidPopSeq);
                setAvoidFriday(presetData.avoidFriday);

                // Restore Mode
                if (presetData.mode) {
                    if (presetData.mode === 'manual' && !canUseManual) {
                        setMode('auto');
                    } else {
                        setMode(presetData.mode);
                    }
                }
                
                // playSound('click'); // Optional: feedback on load
            }
        } catch (e) {
            console.error("Error loading presets", e);
        }
    }
  }, [selectedPreset, user]);

  const handlePresetDoubleClick = () => {
      if (!user) return;

      // Gather current state
      const currentConfig: PresetConfig = {
        highFreqCount, midFreqCount, lowFreqCount,
        highFreqActive, midFreqActive, lowFreqActive,
        highStarCount, midStarCount, lowStarCount,
        highStarActive, midStarActive, lowStarActive,
        weightHigh, weightMid, weightLow, weightDormeur,
        weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
        avoidPairExt, balanceHighLow, avoidPopSeq, avoidFriday,
        mode
      };

      // Save to localStorage with user-specific key
      const savedPresets = localStorage.getItem(`loto_presets_${user.username}`);
      let presets = savedPresets ? JSON.parse(savedPresets) : {};
      presets[selectedPreset] = currentConfig;
      
      localStorage.setItem(`loto_presets_${user.username}`, JSON.stringify(presets));
      
      // Update status
      setPresetHasData(prev => ({...prev, [selectedPreset]: true}));

      playSound('bling');
      alert(`Tous les réglages actuels ont été sauvegardés dans le Préréglage ${selectedPreset} pour ${user.username} !`);
  };

  const handlePresetContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY
      });
  };

  const clearPreset = () => {
      if (!user) return;
      const savedPresets = localStorage.getItem(`loto_presets_${user.username}`);
      if (savedPresets) {
          const presets = JSON.parse(savedPresets);
          delete presets[selectedPreset];
          localStorage.setItem(`loto_presets_${user.username}`, JSON.stringify(presets));
          setPresetHasData(prev => ({...prev, [selectedPreset]: false}));
          playSound('click');
      }
      setContextMenu(null);
  };

  // --- GENERATION LOGIC ---
  const handleGenerate = () => {
    setIsGenerating(true);
    setShowSuccessMessage(false);
    playSound('toggle');

    // Simulate calculation
    setTimeout(async () => {
        let nums: number[] = [], stars: number[] = [];
        
        if (mode === 'manual') {
            // In manual mode, validate selection limits
            if (selectedNumbers.length < 5) {
                playSound('error');
                setIsGenerating(false);
                alert("Veuillez sélectionner au moins 5 numéros.");
                return;
            }
            if (selectedNumbers.length > 10) {
                 playSound('error');
                 setIsGenerating(false);
                 alert("Maximum 10 numéros autorisés.");
                 return;
            }

            if (selectedStars.length < 2) {
                playSound('error');
                setIsGenerating(false);
                alert("Veuillez sélectionner au moins 2 étoiles.");
                return;
            }
            if (selectedStars.length > 12) {
                 playSound('error');
                 setIsGenerating(false);
                 alert("Maximum 12 étoiles autorisées.");
                 return;
            }

            // Use ALL selected numbers/stars (Manual Mode)
            nums = [...selectedNumbers];
            stars = [...selectedStars];

        } else {
            // Auto generation using Real Service - Use WEIGHTS not counts
            const totalNums = weightHigh + weightMid + weightLow + weightDormeur;
            const totalStars = weightStarHigh + weightStarMid + weightStarLow + weightStarDormeur;

            // Validate Auto Configuration Limits
            if (totalNums < 5 || totalNums > 10) {
                playSound('error');
                setIsGenerating(false);
                alert(`Configuration Numéros : Le total (${totalNums}) doit être entre 5 et 10.`);
                return;
            }
            if (totalStars < 2 || totalStars > 12) {
                playSound('error');
                setIsGenerating(false);
                alert(`Configuration Étoiles : Le total (${totalStars}) doit être entre 2 et 12.`);
                return;
            }

            try {
                const result = await genererCombinaison({
                    nbElevee: weightHigh,
                    nbMoyenne: weightMid,
                    nbBasse: weightLow,
                    nbDormeur: weightDormeur,
                    nbEtoilesElevee: weightStarHigh,
                    nbEtoilesMoyenne: weightStarMid,
                    nbEtoilesBasse: weightStarLow,
                    nbEtoilesDormeur: weightStarDormeur,
                    equilibrerPairImpair: avoidPairExt,
                    equilibrerHautBas: balanceHighLow
                });
                
                nums = result.numeros;
                stars = result.etoiles;
                
            } catch (e) {
                console.error("Erreur génération", e);
                playSound('error');
                setIsGenerating(false);
                return;
            }
        }

        // Mask if not admin/vip
        if (isAdminOrVip) {
            setGeneratedNumbers(nums);
            setGeneratedStars(stars);
        } else {
            // Use 0 to indicate masked
            setGeneratedNumbers(new Array(nums.length).fill(0));
            setGeneratedStars(new Array(stars.length).fill(0));
        }
        
        playSound('jackpot');
        setIsGenerating(false);
        // We do NOT show success message here anymore, only after sending
    }, 2000);
  };

  const handleSend = () => {
      if (generatedNumbers.length === 0) {
          alert("Veuillez d'abord lancer une recherche.");
          return;
      }

      // Increment count
      const nextCount = sendCount + 1;
      setSendCount(nextCount);
      
      // Set active sending state
      setIsSending(true);
      setSendingMessage(`ENVOIE EN COURS ${nextCount}`);
      
      playSound('bling');

      // Revert after 10 seconds
      setTimeout(() => {
          // Only clear if the message hasn't been updated by a newer click?
          // The requirement is "pendant 10 seconde".
          // If I click again, new timeout starts.
          // Simplest approach: just let the latest timeout clear it.
          // But if I click 1s later, the first timeout will clear it at T+10s, but the second one should clear at T+11s.
          // For now simple is fine: display state persists.
          setIsSending(false);
          setSendingMessage("");
      }, 10000);
  };

  const resetSendCount = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSendCount(0);
      setIsSending(false);
      setSendingMessage("");
      playSound('click');
  };


  return (
    <CasinoLayout>
      <div className="p-2 w-fit mx-auto space-y-2 scale-95 origin-top" onClick={() => { setIsPresetDropdownOpen(false); setContextMenu(null); }}>
        
        {/* TITLE MOVED TO TOP */}
        {/* TITLE MOVED TO TOP */}
        <div className="text-center pb-1">
            <h2 className="text-2xl md:text-4xl font-orbitron font-bold text-white tracking-[0.2em] uppercase text-shadow-glow">
                Console de réglage
            </h2>
        </div>

        {/* Context Menu */}
        {contextMenu && (
            <div 
                className="fixed z-[100] bg-zinc-900 border border-zinc-700 rounded shadow-2xl p-2 min-w-[150px] space-y-1"
                style={{ top: contextMenu.y, left: contextMenu.x }}
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    onClick={clearPreset}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-800 rounded font-rajdhani"
                >
                    Effacer sa mémoire
                </button>
                <button 
                    onClick={() => setContextMenu(null)}
                    className="w-full text-left px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded font-rajdhani"
                >
                    Ne rien faire
                </button>
            </div>
        )}

        {/* TOP BAR: CONTROL CENTER */}
        <div className="bg-zinc-900 border-b-4 border-casino-gold rounded-t-xl p-2 shadow-2xl relative z-20">
             {/* Background Tech Pattern */}
             <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,transparent_25%,#fff_25%,#fff_50%,transparent_50%,transparent_75%,#fff_75%,#fff_100%)] bg-[length:20px_20px] rounded-t-xl" />
             
             {/* Header Grid Layout for Centering */}
             <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                 
                 {/* LEFT: TITLE */}
                 <div className="flex flex-row items-center gap-8 justify-start">
                     <div className="flex flex-col justify-center items-start">
                         <div className="flex items-center gap-2">
                             <h1 className="text-xl md:text-2xl font-orbitron font-black text-white tracking-widest uppercase truncate">
                                 {user?.username}
                             </h1>
                             <span className="text-casino-gold font-orbitron text-sm border border-casino-gold/30 px-1 rounded bg-casino-gold/10">
                                {user?.role.toUpperCase()}
                             </span>
                         </div>
                         
                         {dernierTirage && (
                            <div className="flex items-center gap-2 text-xs font-rajdhani text-zinc-400 mt-0.5 animate-in fade-in slide-in-from-left-2 duration-500">
                                <span className="uppercase tracking-wider">DERNIER ({format(new Date(dernierTirage.date), 'dd/MM')}):</span>
                                <span className="text-white font-mono font-bold tracking-widest">
                                    {dernierTirage.numeros.join(' ')}
                                </span>
                                <span className="text-yellow-500 font-mono font-bold tracking-widest flex items-center gap-1">
                                    <span>★</span>{dernierTirage.etoiles.join(' ')}
                                </span>
                            </div>
                         )}
                     </div>

                     {/* PRICE GRID DROPDOWN - MOVED HERE (LEFT SIDE) */}
                     <div className="relative" ref={priceGridRef}>
                        <div 
                            className="flex flex-col items-center group cursor-pointer"
                            onClick={() => setIsPriceGridOpen(!isPriceGridOpen)}
                            title="Voir la grille des prix"
                        >
                            <label className="text-[10px] text-zinc-500 uppercase mb-0.5 tracking-wider font-bold group-hover:text-zinc-300 transition-colors">GRILLE PRIX</label>
                            <div className="flex items-center gap-3 text-casino-gold font-orbitron font-bold text-xl leading-none shadow-gold-glow">
                                <span>TARIFS</span>
                                <ChevronDown size={18} className={cn("transition-transform", isPriceGridOpen && "rotate-180")} />
                            </div>
                        </div>

                        {isPriceGridOpen && (
                            <div className="absolute top-full left-0 mt-4 w-[420px] bg-black border border-zinc-700 rounded shadow-2xl z-[60] max-h-[80vh] overflow-y-auto custom-scrollbar">
                                <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 sticky top-0 backdrop-blur-sm">
                                    <div className="text-sm font-bold text-center text-zinc-400">COMBINAISONS MULTIPLES</div>
                                </div>
                                <div className="p-1">
                                    {Object.entries(GRILLE_TARIFAIRE).flatMap(([nums, starPrices]) => 
                                        Object.entries(starPrices).map(([stars, price]) => ({
                                            nums: parseInt(nums),
                                            stars: parseInt(stars),
                                            price: price as number
                                        }))
                                    ).sort((a, b) => a.price - b.price).map((item, idx) => (
                                        <div key={idx} 
                                            className="flex justify-between items-center px-4 py-3 hover:bg-zinc-800 rounded transition-colors border-b border-zinc-900/50 last:border-0 cursor-pointer"
                                            onClick={() => {
                                                const { nums, stars } = item;
                                                
                                                // Disable Free Mode when selecting a tariff
                                                setIsFreeMode(false);
                                                
                                                setMaxWeightLimit(nums);
                                                setMaxStarWeightLimit(stars);

                                                // --- PRE-FILL NUMBERS (BOULES) - DORMEUR DEFAULT 0 ---
                                                if (nums === 5) { setWeightHigh(2); setWeightMid(2); setWeightLow(1); setWeightDormeur(0); }
                                                else if (nums === 6) { setWeightHigh(2); setWeightMid(2); setWeightLow(2); setWeightDormeur(0); }
                                                else if (nums === 7) { setWeightHigh(3); setWeightMid(2); setWeightLow(2); setWeightDormeur(0); }
                                                else if (nums === 8) { setWeightHigh(3); setWeightMid(3); setWeightLow(2); setWeightDormeur(0); }
                                                else if (nums === 9) { setWeightHigh(3); setWeightMid(3); setWeightLow(3); setWeightDormeur(0); }
                                                else if (nums === 10) { setWeightHigh(4); setWeightMid(3); setWeightLow(3); setWeightDormeur(0); }

                                                // --- PRE-FILL STARS (ÉTOILES) - DORMEUR DEFAULT 0 ---
                                                if (stars === 2) { setWeightStarHigh(1); setWeightStarMid(1); setWeightStarLow(0); setWeightStarDormeur(0); }
                                                else if (stars === 3) { setWeightStarHigh(1); setWeightStarMid(1); setWeightStarLow(1); setWeightStarDormeur(0); }
                                                else if (stars === 4) { setWeightStarHigh(2); setWeightStarMid(1); setWeightStarLow(1); setWeightStarDormeur(0); }
                                                else if (stars >= 5) {
                                                    // Distribute remaining evenly or prioritized to High/Mid
                                                    // For > 4, we need logic.
                                                    // 5: 2, 2, 1, 0
                                                    // 6: 2, 2, 2, 0
                                                    // 7: 3, 2, 2, 0
                                                    // ... similar to numbers logic
                                                    if (stars === 5) { setWeightStarHigh(2); setWeightStarMid(2); setWeightStarLow(1); setWeightStarDormeur(0); }
                                                    else if (stars === 6) { setWeightStarHigh(2); setWeightStarMid(2); setWeightStarLow(2); setWeightStarDormeur(0); }
                                                    else if (stars === 7) { setWeightStarHigh(3); setWeightStarMid(2); setWeightStarLow(2); setWeightStarDormeur(0); }
                                                    else if (stars === 8) { setWeightStarHigh(3); setWeightStarMid(3); setWeightStarLow(2); setWeightStarDormeur(0); }
                                                    else if (stars === 9) { setWeightStarHigh(3); setWeightStarMid(3); setWeightStarLow(3); setWeightStarDormeur(0); }
                                                    else if (stars === 10) { setWeightStarHigh(4); setWeightStarMid(3); setWeightStarLow(3); setWeightStarDormeur(0); }
                                                    else if (stars === 11) { setWeightStarHigh(4); setWeightStarMid(4); setWeightStarLow(3); setWeightStarDormeur(0); }
                                                    else if (stars === 12) { setWeightStarHigh(4); setWeightStarMid(4); setWeightStarLow(4); setWeightStarDormeur(0); }
                                                }

                                                setIsPriceGridOpen(false);
                                                playSound('click');
                                                toast.success(`Limites et pondérations ajustées : ${nums} Boules + ${stars} Étoiles`);
                                            }}
                                        >
                                            <div className="flex items-center gap-3 text-lg font-rajdhani text-zinc-300">
                                                <span className="font-bold text-white">{item.nums}</span> numéros
                                                <span className="text-zinc-600">+</span>
                                                <span className="font-bold text-yellow-500">{item.stars}</span> ★
                                            </div>
                                            <div className="text-casino-gold font-bold font-mono text-xl">
                                                {item.price.toFixed(2)} €
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                     </div>
                 </div>
                 
                 {/* CENTER: MODE ONLY */}
                 <div className="flex items-center justify-center gap-6">
                     <div className="flex items-center gap-2 bg-black px-3 py-1.5 rounded border border-zinc-700">
                         <span className={cn(
                             "px-2 py-0.5 rounded text-xs font-bold transition-colors",
                             mode === 'manual' ? "bg-amber-900/50 text-amber-500 border border-amber-500/50" : "text-zinc-600"
                         )}>MANUEL</span>
                         
                         <ToggleSwitch 
                             checked={mode === 'auto'} 
                             onChange={(v) => { 
                                 if (v === false && !canUseManual) {
                                     toast.error("Mode MANUEL réservé aux membres VIP et ADMIN");
                                     playSound('error');
                                     return;
                                 }
                                 setMode(v ? 'auto' : 'manual'); 
                                 playSound('toggle'); 
                             }} 
                             className="scale-75 -rotate-90 mx-2"
                         />
                         
                         <span className={cn(
                             "px-2 py-0.5 rounded text-xs font-bold transition-colors",
                             mode === 'auto' ? "bg-cyan-900/50 text-cyan-400 border border-cyan-400/50" : "text-zinc-600"
                         )}>AUTO</span>
                     </div>
                 </div>

                 {/* RIGHT: SOUND, CONTROL, DATE & PRESET */}
                 <div className="flex items-center gap-3 justify-end">
                     {/* SOUND TOGGLE */}
                     <button 
                        onClick={() => setSoundEnabled(!soundEnabled)} 
                        className={cn(
                            "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors text-lg flex-shrink-0 mr-2",
                            soundEnabled ? "bg-green-900/50 border-green-500 text-green-500" : "bg-red-900/50 border-red-500 text-red-500"
                        )}
                        title={soundEnabled ? "Son activé" : "Son désactivé"}
                     >
                        {soundEnabled ? "♪" : "×"}
                     </button>

                     {/* ADMIN CONTROL BUTTON */}
                     {user?.role === 'admin' && (
                         <button 
                             onClick={() => setIsDebugOpen(true)}
                             className="min-w-[100px] px-4 py-2 mr-4 bg-[linear-gradient(180deg,#2a2a2a_0%,#1a1a1a_100%)] border-2 border-[#d4af37] rounded-lg text-[#d4af37] font-orbitron text-[12px] font-bold uppercase tracking-widest hover:bg-[linear-gradient(180deg,#3a3a3a_0%,#2a2a2a_100%)] hover:border-[#ffd700] hover:shadow-[0_0_10px_rgba(212,175,55,0.5)] transition-all duration-300"
                         >
                             CONTRÔLE
                         </button>
                     )}

                     <div className="flex flex-col items-end mr-2">
                         <label className="text-[10px] text-zinc-500 uppercase mb-0.5 tracking-wider font-bold">PROCHAIN TIRAGE</label>
                         <div className="text-casino-gold font-orbitron font-bold text-lg leading-none text-right shadow-gold-glow">
                            {prochainTirage ? format(prochainTirage.date, 'd MMMM yyyy', { locale: frLocale }).toUpperCase() : '-- --'}
                         </div>
                         <div className="text-[10px] text-zinc-400 font-rajdhani uppercase tracking-widest text-right">
                            {prochainTirage?.jour || '--'}
                         </div>
                     </div>
                     
                     {/* CUSTOM PRESET SELECTOR */}
                     <div className="flex flex-col">
                         <label className="text-xs text-muted-foreground uppercase mb-0.5">Préréglage (1-5)</label>
                         <div className="relative flex items-center bg-black border border-zinc-700 rounded h-[38px] w-[180px]">
                            {/* Preset Name Display (Clickable for saving/context) */}
                            <div 
                                className={cn(
                                    "flex-1 px-3 text-sm font-rajdhani cursor-pointer select-none truncate h-full flex items-center",
                                    presetHasData[selectedPreset] ? "text-casino-gold font-bold" : "text-white"
                                )}
                                onDoubleClick={handlePresetDoubleClick}
                                onContextMenu={handlePresetContextMenu}
                                title="Double-clic: Sauver | Clic droit: Menu"
                            >
                                Preset {selectedPreset}
                            </div>
                            
                            {/* Arrow Trigger */}
                            <button 
                                className="h-full px-2 border-l border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                                onClick={(e) => { e.stopPropagation(); setIsPresetDropdownOpen(!isPresetDropdownOpen); }}
                            >
                                <ChevronDown size={18} />
                            </button>

                            {/* Dropdown Menu */}
                            {isPresetDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-black border border-zinc-700 rounded shadow-xl z-50">
                                    {[1, 2, 3, 4, 5].map(num => (
                                        <div 
                                            key={num}
                                            className={cn(
                                                "px-4 py-3 text-lg font-rajdhani cursor-pointer hover:bg-zinc-800 transition-colors flex justify-between items-center",
                                                selectedPreset === num.toString() && "bg-zinc-800 text-casino-gold"
                                            )}
                                            onClick={() => { setSelectedPreset(num.toString()); setIsPresetDropdownOpen(false); playSound('click'); }}
                                        >
                                            <span className={presetHasData[num.toString()] ? "text-casino-gold font-bold" : "text-white"}>
                                                Preset {num}
                                            </span>
                                            {presetHasData[num.toString()] && <span className="text-xs text-zinc-500 ml-2">SAVED</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Tooltip hint */}
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-800 text-sm px-3 py-1 rounded opacity-0 hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-40">
                                Double-clic sur le nom pour sauver
                            </div>
                         </div>
                     </div>
                 </div>
             </div>
        </div>

        {/* MAIN COCKPIT GRID */}
        <div className="flex flex-col lg:flex-row gap-2 relative justify-center items-stretch">
            

            {/* LEFT: NUMBERS CONFIG */}
            <div className="w-[880px] flex-shrink-0 flex flex-col gap-2">
                <SectionPanel title="CONFIGURATION BOULES (1-50)" disabled={mode === 'auto' || (!canUseManual && mode === 'manual')} className="flex-1 flex flex-col min-h-[400px]" ledActive={highFreqActive || midFreqActive || lowFreqActive}>
                    <div className="space-y-2 flex-1 flex flex-col justify-between">
                        {/* High Freq */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 min-h-[100px] flex flex-col justify-center transition-all duration-300">
                            <div className="flex items-center justify-between mb-1">
                                <ToggleSwitch checked={highFreqActive} onChange={v => { setHighFreqActive(v); playSound('toggle'); }} className="scale-75 origin-left" />
                                <div className="flex-1 px-2">
                                    <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE ÉLEVÉE</div>
                                    <div className="text-sm text-casino-gold">TOP 10 • Tendance ↑</div>
                                    {mode === 'manual' && (
                                       <div className={cn("text-xs font-bold mt-1 transition-colors", 
                                          selectionCounts.high > weightHigh ? "text-red-500 animate-pulse" : 
                                          selectionCounts.high === weightHigh ? "text-green-500" : "text-zinc-500"
                                       )}>
                                          
                                       </div>
                                    )}
                                </div>
                            </div>
                            {mode === 'manual' && highFreqActive && (
                                <BallGrid 
                                    stats={highFreqStats} 
                                    countLimit={10} 
                                    selectedNumbers={selectedNumbers}
                                    selectedStars={selectedStars}
                                    onToggle={toggleSelection}
                                />
                            )}
                        </div>

                        {/* Mid Freq */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 min-h-[100px] flex flex-col justify-center transition-all duration-300">
                            <div className="flex items-center justify-between mb-1">
                                <ToggleSwitch checked={midFreqActive} onChange={v => { setMidFreqActive(v); playSound('toggle'); }} activeColor="bg-yellow-500" className="scale-75 origin-left" />
                                <div className="flex-1 px-2">
                                    <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE MOYENNE</div>
                                    <div className="text-sm text-yellow-500">MOYENNE 10 • Stable →</div>
                                    {mode === 'manual' && (
                                       <div className={cn("text-xs font-bold mt-1 transition-colors", 
                                          selectionCounts.mid > weightMid ? "text-red-500 animate-pulse" : 
                                          selectionCounts.mid === weightMid ? "text-green-500" : "text-zinc-500"
                                       )}>
                                          
                                       </div>
                                    )}
                                </div>
                            </div>
                            {mode === 'manual' && midFreqActive && (
                                <BallGrid 
                                    stats={midFreqStats} 
                                    countLimit={10} 
                                    selectedNumbers={selectedNumbers}
                                    selectedStars={selectedStars}
                                    onToggle={toggleSelection}
                                />
                            )}
                        </div>

                        {/* Low Freq */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 min-h-[100px] flex flex-col justify-center transition-all duration-300">
                             <div className="flex items-center justify-between mb-1">
                                <ToggleSwitch checked={lowFreqActive} onChange={v => { setLowFreqActive(v); playSound('toggle'); }} activeColor="bg-blue-500" className="scale-75 origin-left" />
                                <div className="flex-1 px-2">
                                    <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE BASSE</div>
                                    <div className="text-sm text-blue-500">BASSE 10 • Dette Max</div>
                                    {mode === 'manual' && (
                                       <div className={cn("text-xs font-bold mt-1 transition-colors", 
                                          selectionCounts.low > weightLow ? "text-red-500 animate-pulse" : 
                                          selectionCounts.low === weightLow ? "text-green-500" : "text-zinc-500"
                                       )}>
                                          
                                       </div>
                                    )}
                                </div>


                            </div>
                             {mode === 'manual' && lowFreqActive && (
                                <BallGrid 
                                    stats={lowFreqStats} 
                                    countLimit={10} 
                                    selectedNumbers={selectedNumbers}
                                    selectedStars={selectedStars}
                                    onToggle={toggleSelection}
                                />
                            )}
                        </div>
                    </div>
                </SectionPanel>

                <SectionPanel 
                    title="PONDÉRATIONS BOULES" 
                >
                    <div className="grid grid-cols-4 gap-5 justify-items-center items-center py-2">
                        <RotaryKnob label="ÉLEVÉE" value={weightHigh} onChange={(v) => { if(checkWeightLimit(v, weightHigh, weightMid, weightLow, weightDormeur)) setWeightHigh(v); }} max={maxWeightLimit} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="MOYENNE" value={weightMid} onChange={(v) => { if(checkWeightLimit(v, weightMid, weightHigh, weightLow, weightDormeur)) setWeightMid(v); }} max={maxWeightLimit} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="BASSE" value={weightLow} onChange={(v) => { if(checkWeightLimit(v, weightLow, weightHigh, weightMid, weightDormeur)) setWeightLow(v); }} max={maxWeightLimit} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="DORMEUR" value={weightDormeur} onChange={(v) => { if(checkWeightLimit(v, weightDormeur, weightHigh, weightMid, weightLow)) setWeightDormeur(v); }} max={maxWeightLimit} labelClassName="text-xs font-bold" size="xl" />
                    </div>
                </SectionPanel>
            </div>

            {/* CENTER: DASHBOARD / OPTIONS */}
            <div className="w-full lg:w-[280px] flex flex-col gap-2 flex-shrink-0 justify-between">
                 {/* OPTIONS PANEL */}
                 <div className="bg-[#111] border-2 border-zinc-800 rounded-xl flex-1 min-h-[400px] p-2 flex flex-col items-center justify-center gap-4 shadow-inner relative overflow-hidden">
                     <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-black to-black pointer-events-none" />
                     
                     <div className="w-full space-y-4 relative z-10">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                             <div className="text-center font-orbitron text-lg text-zinc-500 flex-1">EQUILIBRER</div>
                             <LEDIndicator active={avoidPairExt || balanceHighLow} color="green" />
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-lg font-rajdhani text-zinc-300 truncate mr-2">NO PAIR/IMPAIR</span>
                            <ToggleSwitch checked={avoidPairExt} onChange={v => { setAvoidPairExt(v); playSound('toggle'); }} className="scale-75 origin-right flex-shrink-0" />
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-lg font-rajdhani text-zinc-300 truncate mr-2">ÉQUILIBRE H/B</span>
                            <ToggleSwitch checked={balanceHighLow} onChange={v => { setBalanceHighLow(v); playSound('toggle'); }} className="scale-75 origin-right flex-shrink-0" />
                        </div>
                     </div>

                     <div className="w-full h-px bg-zinc-800" />

                     <div className="w-full space-y-4 relative z-10">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                            <div className="text-center font-orbitron text-lg text-zinc-500 flex-1">OPTIMISER GAINS</div>
                            <LEDIndicator active={avoidPopSeq || avoidFriday} color="green" />
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-lg font-rajdhani text-zinc-300 mr-2 leading-none">PAS DE SÉQUENCE<br/>POPULAIRE</span>
                            <ToggleSwitch checked={avoidPopSeq} onChange={v => { setAvoidPopSeq(v); playSound('toggle'); }} className="scale-75 origin-right flex-shrink-0" activeColor="bg-red-500" />
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-lg font-rajdhani text-zinc-300 truncate mr-2">PAS DE VENDREDI</span>
                            <ToggleSwitch checked={avoidFriday} onChange={v => { setAvoidFriday(v); playSound('toggle'); }} className="scale-75 origin-right flex-shrink-0" activeColor="bg-red-500" />
                        </div>
                     </div>
                 </div>

                 {/* PRICE RACK (NEW) */}
                 <SectionPanel title="PRIX DE LA GRILLE" className="h-[172px] flex flex-col justify-center items-center flex-shrink-0" showLed={false}>
                    <div className="flex flex-col items-center justify-center w-full gap-0.5">
                        <div className="text-zinc-400 font-rajdhani text-sm">
                            {currentNumCount} Numéros + {currentStarCount} Étoiles
                        </div>
                        <div className="text-3xl font-bold text-casino-gold font-lcd text-shadow-glow flex items-center gap-2">
                            {currentPrice.toFixed(2)} €
                            {/* LOCK ICON - MODE LIBRE */}
                            <div 
                                onClick={(e) => { e.stopPropagation(); toggleFreeMode(); }}
                                className="cursor-pointer transition-transform hover:scale-110 ml-1"
                            >
                                {isFreeMode ? (
                                    <Unlock size={24} className="text-[#44ff44] drop-shadow-[0_0_5px_rgba(68,255,68,0.5)]" />
                                ) : (
                                    <Lock size={24} className="text-[#FF4444]" />
                                )}
                            </div>
                        </div>
                    </div>
                 </SectionPanel>
            </div>

            {/* RIGHT: STARS CONFIG */}
            <div className="w-[780px] flex-shrink-0 flex flex-col gap-2">
                <SectionPanel title={<>CONFIGURATION ÉTOILES (1-12) <span className="text-yellow-400 ml-3 text-xl align-middle">★</span></>} disabled={mode === 'auto' || (!canUseManual && mode === 'manual')} className="flex flex-col" ledActive={highStarActive || midStarActive || lowStarActive || dormeurStarActive}>
                     <div className="space-y-0.5 flex flex-col justify-start">
                        {/* High Star */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 min-h-[80px] flex items-center transition-all duration-300">
                            <ToggleSwitch checked={highStarActive} onChange={v => { setHighStarActive(v); playSound('toggle'); }} activeColor="bg-purple-500" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE ÉLEVÉE</div>
                                <div className="text-sm text-purple-400">TOP 12</div>
                            </div>
                             {mode === 'manual' && highStarActive && (
                                <div className="flex-1 flex justify-start -ml-8">
                                    <BallGrid 
                                        stats={highStarStats} 
                                        countLimit={12} 
                                        type="star" 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        onToggle={toggleSelection}
                                        className="py-0 justify-start gap-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Mid Star */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 min-h-[80px] flex items-center transition-all duration-300">
                            <ToggleSwitch checked={midStarActive} onChange={v => { setMidStarActive(v); playSound('toggle'); }} activeColor="bg-pink-500" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE MOYENNE</div>
                                <div className="text-sm text-pink-400">MOYENNE 12</div>
                            </div>
                             {mode === 'manual' && midStarActive && (
                                <div className="flex-1 flex justify-start -ml-8">
                                    <BallGrid 
                                        stats={midStarStats} 
                                        countLimit={12} 
                                        type="star"
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        onToggle={toggleSelection}
                                        className="py-0 justify-start gap-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Low Star */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 min-h-[80px] flex items-center transition-all duration-300">
                            <ToggleSwitch checked={lowStarActive} onChange={v => { setLowStarActive(v); playSound('toggle'); }} activeColor="bg-blue-400" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE BASSE</div>
                                <div className="text-sm text-blue-400">BASSE 12</div>
                            </div>
                             {mode === 'manual' && lowStarActive && (
                                <div className="flex-1 flex justify-start -ml-8">
                                    <BallGrid 
                                        stats={lowStarStats} 
                                        countLimit={12} 
                                        type="star"
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        onToggle={toggleSelection}
                                        className="py-0 justify-start gap-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Dormeur Star */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 min-h-[80px] flex items-center transition-all duration-300">
                            <ToggleSwitch checked={dormeurStarActive} onChange={v => { setDormeurStarActive(v); playSound('toggle'); }} activeColor="bg-zinc-400" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">DORMEUR</div>
                                <div className="text-sm text-zinc-400">TOP 12 • Absence</div>
                            </div>
                             {mode === 'manual' && dormeurStarActive && (
                                <div className="flex-1 flex justify-start -ml-8">
                                    <BallGrid 
                                        stats={dormeurStarStats} 
                                        countLimit={4} 
                                        type="star"
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        onToggle={toggleSelection}
                                        className="py-0 justify-start gap-2"
                                    />
                                </div>
                            )}
                        </div>
                     </div>
                </SectionPanel>

                <SectionPanel 
                    title="PONDÉRATIONS ÉTOILES"
                >
                    <div className="grid grid-cols-4 gap-5 justify-items-center items-center py-2">
                        <RotaryKnob label="ÉLEVÉES" value={weightStarHigh} onChange={(v) => { if(checkStarWeightLimit(v, weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur)) setWeightStarHigh(v); }} max={4} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="MOYENNE" value={weightStarMid} onChange={(v) => { if(checkStarWeightLimit(v, weightStarMid, weightStarHigh, weightStarLow, weightStarDormeur)) setWeightStarMid(v); }} max={4} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="BASSE" value={weightStarLow} onChange={(v) => { if(checkStarWeightLimit(v, weightStarLow, weightStarHigh, weightStarMid, weightStarDormeur)) setWeightStarLow(v); }} max={4} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="DORMEUR" value={weightStarDormeur} onChange={(v) => { if(checkStarWeightLimit(v, weightStarDormeur, weightStarHigh, weightStarMid, weightStarLow)) setWeightStarDormeur(v); }} max={4} labelClassName="text-xs font-bold" size="xl" />
                    </div>
                </SectionPanel>
            </div>

        </div>

        {/* BOTTOM: RESULT AREA */}
        <div className="bg-gradient-to-t from-black to-zinc-900 border-t-4 border-casino-red rounded-b-xl p-2 shadow-2xl relative mt-2">
             {/* Header Row: Title - Button - Actions */}
             <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-20 mb-2">
                 
                 {/* Title (Left) */}
                 <div className="flex-1 text-left min-w-[200px]">
                     {/* Title Removed */}
                 </div>

                 {/* Validate Button (Center) */}
                 <div className="flex-none mx-auto flex flex-col items-center">
                    <ProchainTirageSimple />
                    <CasinoButton 
                        size="lg" 
                        variant={currentPrice === 0 ? "danger" : "primary"}
                        className={cn(
                            "text-lg px-8 py-6 flex items-center justify-center min-w-[250px]",
                            currentPrice === 0 
                                ? "animate-pulse shadow-[0_0_20px_rgba(255,0,0,0.8)]" 
                                : "shadow-[0_0_20px_rgba(255,215,0,0.4)] animate-pulse hover:animate-none"
                        )}
                        onClick={handleGenerate}
                        disabled={isGenerating}
                     >
                         {isGenerating ? "CALCUL..." : "★ VALIDER LA RECHERCHE ★"}
                     </CasinoButton>
                 </div>

                 {/* Actions (Right) */}
                 <div className="flex-1 flex justify-end min-w-[200px]">
                     <div className="flex flex-col gap-2 bg-black/30 p-3 rounded min-w-[200px]">
                        <div className="flex justify-center gap-4 mb-2">
                            <div className="flex items-center gap-2">
                                <ToggleSwitch checked={emailNotify} onChange={v => { setEmailNotify(v); playSound('toggle'); }} className="scale-75" />
                                <span className="text-xl font-bold text-zinc-400">EMAIL</span>
                            </div>
                            <div className="w-px bg-zinc-700" />
                            <div className="flex items-center gap-2">
                                <ToggleSwitch checked={smsNotify} onChange={v => { setSmsNotify(v); playSound('toggle'); }} className="scale-75" />
                                <span className="text-xl font-bold text-zinc-400">SMS</span>
                            </div>
                        </div>
                        <div className="relative">
                            <CasinoButton 
                                variant="secondary"
                                size="sm"
                                className={cn(
                                    "w-full py-2 text-sm font-bold transition-all flex items-center justify-center",
                                    isSending ? "bg-green-900 border-green-500 text-green-400 animate-pulse" : ""
                                )}
                                onClick={handleSend}
                            >
                                {isSending ? sendingMessage : "ENVOYER"}
                            </CasinoButton>
                            
                            {/* Reset Button (X) */}
                            {sendCount > 0 && (
                                <button 
                                    onClick={resetSendCount}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-white transition-colors z-20"
                                    title="Remettre le compteur à zéro"
                                >
                                    <RotateCcw size={14} />
                                </button>
                            )}
                        </div>
                     </div>
                 </div>
             </div>

             {/* Results Row (Full Width Below) */}
             <div className="w-full bg-black/50 p-2 rounded-2xl border border-zinc-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] min-h-[60px] flex items-center justify-center relative z-10">
                 {generatedNumbers.length > 0 ? (
                     <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-2xl md:text-3xl font-black font-mono tracking-wider">
                        {/* NUMBERS IN WHITE */}
                        <div className="flex flex-wrap justify-center gap-4 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                            {generatedNumbers.map((n, i) => (
                                <span key={`n-${i}`}>{n === 0 ? '??' : n}</span>
                            ))}
                        </div>
                        
                        {/* SEPARATOR */}
                        <div className="text-zinc-600 hidden md:block">|</div>
                        
                        {/* STARS IN YELLOW */}
                        <div className="flex flex-wrap justify-center gap-4 text-yellow-400 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                            {generatedStars.map((n, i) => (
                                 <span key={`s-${i}`}>{n === 0 ? '??' : n}</span>
                            ))}
                        </div>
                     </div>
                 ) : (
                     <div className="flex items-center text-zinc-600 font-lcd text-lg tracking-widest opacity-50">
                         -- -- -- -- --  |  -- --
                     </div>
                 )}
                 
                 {showSuccessMessage && !isAdminOrVip && (
                    <div className="absolute bottom-1 right-2 text-green-500 font-rajdhani font-bold text-xs animate-bounce">
                        ✓ Envoyé avec succès
                    </div>
                 )}
             </div>
        </div>

        <DebugPanel 
            isOpen={isDebugOpen} 
            onClose={() => setIsDebugOpen(false)}
            onToggle={() => setIsDebugOpen(!isDebugOpen)}
            stats={stats}
            mode={mode}
            config={{
                highFreqCount, midFreqCount, lowFreqCount,
                highStarCount, midStarCount, lowStarCount,
                weightHigh, weightMid, weightLow, weightDormeur,
                weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
                avoidPairExt, balanceHighLow
            }}
            selectedNumbers={selectedNumbers}
            selectedStars={selectedStars}
            generatedNumbers={generatedNumbers}
            generatedStars={generatedStars}
            lastDrawDate={dernierTirage ? format(new Date(dernierTirage.date), 'yyyy-MM-dd') : '...'}
            totalDraws={stats ? 1899 : 0} 
        />

      </div>
    </CasinoLayout>
  );
}
