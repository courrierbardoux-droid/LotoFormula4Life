
import React, { useState, useEffect, useRef, useMemo } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { CasinoButton } from "@/components/casino/CasinoButton";
import { LottoBall } from "@/components/casino/LottoBall";
import { RotaryKnob } from "@/components/casino/RotaryKnob";
import { ToggleSwitch } from "@/components/casino/ToggleSwitch";
import { Counter } from "@/components/casino/Counter";
import { LEDIndicator } from "@/components/casino/LEDIndicator";
import { ProchainTirageSimple } from "@/components/casino/ProchainTirageSimple";
import { DebugPanel } from "@/components/casino/DebugPanel";
import { GratitudePopup } from "@/components/GratitudePopup";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { Lock, Unlock, ChevronDown, RotateCcw, ArrowUp, ArrowDown, Minus, RefreshCcw, Settings, Sliders, Calendar, Trash2, Wrench } from "lucide-react";
import { useUser } from "@/lib/UserContext";
import { 
  getStats, 
  getProchainTirage, 
  getDernierTirage, 
  genererCombinaison, 
  saveGridToHistory,
  StatsNumeros,
  Tirage,
  chargerHistorique,
  filterTirages,
  computeStatsFromTirages,
  FrequencyConfig,
  PeriodUnit,
  verifierMiseAJourNecessaire
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
  displayLabel?: string;
  rank?: number;
}

const BallGrid = ({ 
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
  }: { 
    stats: DisplayStat[], 
    countLimit: number,
    type?: 'number' | 'star',
    selectedNumbers: number[],
    selectedStars: number[],
    numberSources?: Record<number, 'high' | 'mid' | 'low' | 'dormeur'>,
    starSources?: Record<number, 'high' | 'mid' | 'low' | 'dormeur'>,
    category?: 'high' | 'mid' | 'low' | 'dormeur',
    onToggle: (num: number, type: 'number' | 'star', category?: 'high' | 'mid' | 'low' | 'dormeur') => void,
    className?: string,
    resolveCategory?: (num: number, type: 'number' | 'star') => 'high' | 'mid' | 'low' | 'dormeur' | null
  }) => {
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
                    
                    // PRIORITY 1: Use explicit source tracking (from Forbo generation or manual click)
                    const explicitSource = type === 'number' 
                            ? numberSources?.[stat.number] 
                            : starSources?.[stat.number];
                    
                    if (explicitSource) {
                        owner = explicitSource;
                    } else if (resolveCategory) {
                        // PRIORITY 2: Fallback to dynamic resolution if no explicit source
                        owner = resolveCategory(stat.number, type);
                    }
                    
                    if (owner && category && owner === category) {
                        status = 'selected'; // Primary owner -> Solid Green
                    } else if (owner && category && owner !== category) {
                        status = 'ghost'; // Doublon -> Ghost Green (Text Green)
                    } else if (!owner) {
                         // Fallback for selection without any source tracking
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


// Type for storing preset configurations - COMPLET avec tous les paramètres
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
    
    // Options d'équilibrage
    avoidPairExt: boolean;
    balanceHighLow: boolean;
    avoidPopSeq: boolean;
    avoidFriday: boolean;

    // Mode console
    mode: 'manual' | 'auto';
    
    // NOUVEAUX PARAMÈTRES
    hazardLevel: number;        // Niveau de CHAOS (0-10)
    tendencyLevel: number;      // Niveau de TENDANCE (0-10)
    emailNotify: boolean;       // Email activé
    smsNotify: boolean;         // SMS activé
    numCount: number;           // Nombre de numéros (tarif)
    starCount: number;          // Nombre d'étoiles (tarif)
    isSimplifiedMode: boolean;  // Mode simplifié ou classique
    
    // Priorités de tri (mode simplifié)
    sortPriority1: 'frequency' | 'trend' | 'dormeur';
    sortPriority2: 'frequency' | 'trend' | 'dormeur';
    sortPriority3: 'frequency' | 'trend' | 'dormeur';
};

// Interface for pool items (used in viviers/pools)
interface PoolItem {
    number: number;
    frequency: number;
    frequencyPercent: number; // 0-100%, where 50% is average
    trend: number;
    absence: number;
    trendDirection: 'hausse' | 'baisse' | 'stable';
}

export default function Console() {
  const { user } = useUser();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPrice, setShowPrice] = useState(false); // Fix for crash

  // --- RESPONSIVE ZOOM (proportional scaling) ---
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Reference width: the console is designed for 1700px
  // Scale proportionally to fill the screen width, then apply 10% reduction
  const referenceWidth = 1700;
  const baseZoom = windowWidth / referenceWidth;
  const zoomScale = baseZoom * 0.90; // 10% reduction = margins on left/right

  // Column layout: offset controls how much the center column is shifted
  // Positive = shift right (left grows, right shrinks)
  // Negative = shift left (left shrinks, right grows)
  const centerOffset = 300; // px - CHANGE THIS VALUE TO MOVE CENTER COLUMN
  const centerWidth = 280;
  const widthReduction = 200; // px - reduces overall width of header/columns/footer
  const columnGap = 8; // px - gap between columns (same as gap between Config and Pondération)
  const availableWidth = referenceWidth - 16 - centerWidth - widthReduction - (2 * columnGap); // minus padding, center, reduction, and gaps
  const leftColumnWidth = (availableWidth / 2) + (centerOffset / 2);
  const rightColumnWidth = (availableWidth / 2) - (centerOffset / 2);
  const totalColumnsWidth = leftColumnWidth + centerWidth + rightColumnWidth + (2 * columnGap); // for header sync (includes gaps)

  // --- STATE ---
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  
  // Real Data State
  const [stats, setStats] = useState<StatsNumeros | null>(null);
  const [dernierTirage, setDernierTirage] = useState<Tirage | null>(null);
  const [prochainTirage, setProchainTirage] = useState<{ date: Date, jour: string } | null>(null);
  const [updateNeeded, setUpdateNeeded] = useState(false);
  
  // Preset State
  const [selectedPreset, setSelectedPreset] = useState("0"); // 0 to 5 (0 = default/reset)
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
  const [numberSources, setNumberSources] = useState<Record<number, 'high' | 'mid' | 'low' | 'dormeur'>>({});
  const [starSources, setStarSources] = useState<Record<number, 'high' | 'mid' | 'low' | 'dormeur'>>({});
  
  // NEW: Store selected tariff config directly for price display
  const [selectedTariff, setSelectedTariff] = useState<{nums: number, stars: number, price: number} | null>(null);

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
  
  // Simplified mode toggle for Pondération Boules
  const [isSimplifiedMode, setIsSimplifiedMode] = useState(true);
  
  // Simplified mode: sort order for balls (cycles: 'numeric' -> 'frequency' -> 'trend' -> 'dormeur')
  const [simplifiedSortOrder, setSimplifiedSortOrder] = useState<'numeric' | 'frequency' | 'trend' | 'dormeur'>('numeric'); 
  
  // Simplified mode: priority system for tie-breaking (each must be unique)
  const [sortPriority1, setSortPriority1] = useState<'frequency' | 'trend' | 'dormeur'>('frequency');
  const [sortPriority2, setSortPriority2] = useState<'frequency' | 'trend' | 'dormeur'>('trend');
  const [sortPriority3, setSortPriority3] = useState<'frequency' | 'trend' | 'dormeur'>('dormeur');
  
  const [weightStarHigh, setWeightStarHigh] = useState(1);
  const [weightStarMid, setWeightStarMid] = useState(1);
  const [weightStarLow, setWeightStarLow] = useState(0); 
  const [weightStarDormeur, setWeightStarDormeur] = useState(0); 

  // Options (Toggles)
  const [avoidPairExt, setAvoidPairExt] = useState(true);
  const [balanceHighLow, setBalanceHighLow] = useState(true);
  const [avoidPopSeq, setAvoidPopSeq] = useState(true);
  const [avoidFriday, setAvoidFriday] = useState(false);
  const [emailNotify, setEmailNotify] = useState(true);
  const [smsNotify, setSmsNotify] = useState(false);
  const [hazardLevel, setHazardLevel] = useState(0); // 0 to 9
  const [tendencyLevel, setTendencyLevel] = useState(10); // 0 to 10, défaut 10 = max tendance (bouton à gauche)
  const [isWeightsEnabled, setIsWeightsEnabled] = useState(true);

  // --- NEW: WEIGHT PRESET STATE ---
  const [selectedWeightPreset, setSelectedWeightPreset] = useState("0"); // "0" to "10"
  const [weightPresetsData, setWeightPresetsData] = useState<Record<string, {
      weightHigh: number; weightMid: number; weightLow: number; weightDormeur: number;
      weightStarHigh: number; weightStarMid: number; weightStarLow: number; weightStarDormeur: number;
      isSimplified?: boolean; // NEW: Track if preset was saved in simplified mode
  }>>({});
  const [isWeightDropdownOpen, setIsWeightDropdownOpen] = useState(false);

  // Manual Mode Enforcement
  const [respectWeights, setRespectWeights] = useState(false);
  const [respectStarWeights, setRespectStarWeights] = useState(false);
  const [maxWeightLimit, setMaxWeightLimit] = useState(10);
  const [maxStarWeightLimit, setMaxStarWeightLimit] = useState(12);

  // Results
  const [generatedNumbers, setGeneratedNumbers] = useState<number[]>([]);
  const [generatedStars, setGeneratedStars] = useState<number[]>([]);
  const [autoDraws, setAutoDraws] = useState<{nums: number[], stars: number[], date: Date, revealed?: boolean}[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  // Track revealed state for the top draw in the stack. 
  // If true, the top draw is fully visible. If false, it's blurred.
  // We only need to track the TOP one because older ones are assumed revealed or don't matter as much.
  // Or we can track a set of revealed IDs? Let's keep it simple: "Last generated is blurred until click".
  const [isLatestRevealed, setIsLatestRevealed] = useState(true);

  // Send Button State
  const [sendCount, setSendCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [sendingMessage, setSendingMessage] = useState("");
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // CGU Modal State (pour les invités)
  const [showCguModal, setShowCguModal] = useState(false);
  const [cguAccepted, setCguAccepted] = useState(false);

  // Popup Gratitude State (VIP/Abonné uniquement)
  const [showGratitudePopup, setShowGratitudePopup] = useState(false);
  const [dontShowPopupAgain, setDontShowPopupAgain] = useState(false);
  const [popupChecked, setPopupChecked] = useState(false); // Pour éviter double appel API

  // --- SETTINGS STATE ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [freqConfig, setFreqConfig] = useState<FrequencyConfig>({ type: 'all' });
  const [fullHistory, setFullHistory] = useState<Tirage[]>([]);

  // PURE MODE STATE REMOVED
  
  // Track if user has modified manually since last Tariff/Standard set
  const userModifiedRef = useRef(false);

  // Track if we just restored from storage to prevent preset overwrite
  const isRestoringRef = useRef(false);

  // --- PERSISTENCE ---
  useEffect(() => {
    // LOAD STATE
    try {
        const saved = localStorage.getItem('console_state');
        if (saved) {
            const state = JSON.parse(saved);
            isRestoringRef.current = true; // MARK AS RESTORING

            if (state.mode) setMode(state.mode);
            if (state.autoDraws) setAutoDraws(state.autoDraws.map((d: any) => ({...d, date: new Date(d.date)})));
            if (state.generatedNumbers) setGeneratedNumbers(state.generatedNumbers);
            if (state.generatedStars) setGeneratedStars(state.generatedStars);
            
            // Restore Config (default to "0" if not found)
            if (state.selectedPreset) setSelectedPreset(state.selectedPreset);
            else setSelectedPreset("0");
            // Load Weight Presets
            if (state.selectedWeightPreset) setSelectedWeightPreset(state.selectedWeightPreset);
            if (state.weightPresetsData) setWeightPresetsData(state.weightPresetsData);

            if (state.highFreqCount !== undefined) setHighFreqCount(state.highFreqCount);
            if (state.midFreqCount !== undefined) setMidFreqCount(state.midFreqCount);
            if (state.lowFreqCount !== undefined) setLowFreqCount(state.lowFreqCount);
            
            if (state.highFreqActive !== undefined) setHighFreqActive(state.highFreqActive);
            if (state.midFreqActive !== undefined) setMidFreqActive(state.midFreqActive);
            if (state.lowFreqActive !== undefined) setLowFreqActive(state.lowFreqActive);

            if (state.highStarCount !== undefined) setHighStarCount(state.highStarCount);
            if (state.midStarCount !== undefined) setMidStarCount(state.midStarCount);
            if (state.lowStarCount !== undefined) setLowStarCount(state.lowStarCount);

            if (state.highStarActive !== undefined) setHighStarActive(state.highStarActive);
            if (state.midStarActive !== undefined) setMidStarActive(state.midStarActive);
            if (state.lowStarActive !== undefined) setLowStarActive(state.lowStarActive);
            if (state.dormeurStarActive !== undefined) setDormeurStarActive(state.dormeurStarActive);

            if (state.weightHigh !== undefined) setWeightHigh(state.weightHigh);
            if (state.weightMid !== undefined) setWeightMid(state.weightMid);
            if (state.weightLow !== undefined) setWeightLow(state.weightLow);
            if (state.weightDormeur !== undefined) setWeightDormeur(state.weightDormeur);

            if (state.weightStarHigh !== undefined) setWeightStarHigh(state.weightStarHigh);
            if (state.weightStarMid !== undefined) setWeightStarMid(state.weightStarMid);
            if (state.weightStarLow !== undefined) setWeightStarLow(state.weightStarLow);
            if (state.weightStarDormeur !== undefined) setWeightStarDormeur(state.weightStarDormeur);

            if (state.avoidPairExt !== undefined) setAvoidPairExt(state.avoidPairExt);
            if (state.balanceHighLow !== undefined) setBalanceHighLow(state.balanceHighLow);
            if (state.avoidPopSeq !== undefined) setAvoidPopSeq(state.avoidPopSeq);
            if (state.hazardLevel !== undefined) setHazardLevel(state.hazardLevel);
            if (state.tendencyLevel !== undefined) setTendencyLevel(state.tendencyLevel);
            
            // Manual selection & SOURCES
            if (state.selectedNumbers) setSelectedNumbers(state.selectedNumbers);
            if (state.selectedStars) setSelectedStars(state.selectedStars);
            if (state.numberSources) setNumberSources(state.numberSources);
            if (state.starSources) setStarSources(state.starSources);
        }
    } catch (e) {
        console.error("Failed to load console state", e);
    }
  }, []);

  useEffect(() => {
    // SAVE STATE
    const stateToSave = {
        mode,
        autoDraws,
        generatedNumbers,
        generatedStars,
        selectedPreset,
        selectedWeightPreset,
        weightPresetsData,
        highFreqCount, midFreqCount, lowFreqCount,
        highFreqActive, midFreqActive, lowFreqActive,
        highStarCount, midStarCount, lowStarCount,
        highStarActive, midStarActive, lowStarActive, dormeurStarActive,
        weightHigh, weightMid, weightLow, weightDormeur,
        weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
        avoidPairExt, balanceHighLow, avoidPopSeq,
        hazardLevel, tendencyLevel,
        selectedNumbers, selectedStars,
        numberSources, starSources
    };
    localStorage.setItem('console_state', JSON.stringify(stateToSave));
  }, [
    mode, autoDraws, generatedNumbers, generatedStars, selectedPreset,
    selectedWeightPreset, weightPresetsData,
    highFreqCount, midFreqCount, lowFreqCount,
    highFreqActive, midFreqActive, lowFreqActive,
    highStarCount, midStarCount, lowStarCount,
    highStarActive, midStarActive, lowStarActive, dormeurStarActive,
    weightHigh, weightMid, weightLow, weightDormeur,
    weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
    avoidPairExt, balanceHighLow, avoidPopSeq,
    hazardLevel, tendencyLevel,
    selectedNumbers, selectedStars,
    numberSources, starSources
  ]);

  // --- WEIGHT PRESET LOGIC ---
  const handleWeightPresetSelect = (presetId: string) => {
      setSelectedWeightPreset(presetId);
      setIsWeightDropdownOpen(false);
      playSound('click');

      if (presetId === "0") {
          setIsWeightsEnabled(false);
          // Reset all knobs to 0
          setWeightHigh(0); setWeightMid(0); setWeightLow(0); setWeightDormeur(0);
          setWeightStarHigh(0); setWeightStarMid(0); setWeightStarLow(0); setWeightStarDormeur(0);
          toast.info("Pondérations DÉSACTIVÉES (Mode 0)");
      } else {
          setIsWeightsEnabled(true);
          
          if (weightPresetsData[presetId]) {
              // Load saved data (BALL weights only - star weights are neutralized)
              const data = weightPresetsData[presetId];
              setWeightHigh(data.weightHigh);
              setWeightMid(data.weightMid);
              setWeightLow(data.weightLow);
              setWeightDormeur(data.weightDormeur);
              
              // NEUTRALIZED: Star weights are no longer loaded from presets
              // They are derived from ball weights proportions
              // setWeightStarHigh(data.weightStarHigh);
              // setWeightStarMid(data.weightStarMid);
              // setWeightStarLow(data.weightStarLow);
              // setWeightStarDormeur(data.weightStarDormeur);
              
              // Apply simplified mode from preset
              if (data.isSimplified !== undefined) {
                  setIsSimplifiedMode(data.isSimplified);
              }
              
              const presetName = data.isSimplified ? `Simplifié ${presetId}` : `Pondération ${presetId}`;
              toast.success(`${presetName} chargé`);
          }
          // If preset is empty, do nothing to the knobs - just select the preset number
      }
  };

  const handleWeightPresetDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedWeightPreset === "0") {
          toast.error("Impossible de sauvegarder sur le preset 0 (Désactivé)");
          return;
      }

      // Save current knob positions + simplified mode flag
      setWeightPresetsData(prev => ({
          ...prev,
          [selectedWeightPreset]: {
              weightHigh, weightMid, weightLow, weightDormeur,
              weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
              isSimplified: isSimplifiedMode
          }
      }));
      
      playSound('click');
      const presetName = isSimplifiedMode ? `Simplifié ${selectedWeightPreset}` : `Pondération ${selectedWeightPreset}`;
      toast.success(`Sauvegardé dans ${presetName}`);
  };

  // Save a specific weight preset from the dropdown
  const handleSaveWeightPreset = (presetId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      
      // Save current knob positions + simplified mode flag
      setWeightPresetsData(prev => ({
          ...prev,
          [presetId]: {
              weightHigh, weightMid, weightLow, weightDormeur,
              weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
              isSimplified: isSimplifiedMode
          }
      }));
      
      playSound('click');
      const presetName = isSimplifiedMode ? `Simplifié ${presetId}` : `Pondération ${presetId}`;
      toast.success(`Sauvegardé dans ${presetName}`);
  };

  // Delete a specific weight preset
  const handleDeleteWeightPreset = (presetId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      
      const wasSimplified = weightPresetsData[presetId]?.isSimplified;
      
      setWeightPresetsData(prev => {
          const next = { ...prev };
          delete next[presetId];
          return next;
      });
      
      playSound('click');
      const presetName = wasSimplified ? `Simplifié ${presetId}` : `Pondération ${presetId}`;
      toast.success(`${presetName} effacé`);
  };

  // --- DERIVED ACCESS RIGHTS ---
  const isAdminOrVip = user?.role === 'admin' || user?.role === 'vip';
  const isInvite = user?.role === 'invite';
  const isAbonne = user?.role === 'abonne';
  const isInviteOrAbonne = isInvite || isAbonne; // Ces utilisateurs ne voient jamais leurs numéros directement
  const canUseManual = !isInvite && !isAbonne; // Mode manuel réservé aux VIP/Admin

  // --- FORCE AUTO MODE FOR INVITE/ABONNE ---
  useEffect(() => {
    if (isInviteOrAbonne && mode === 'manual') {
      setMode('auto');
    }
  }, [isInviteOrAbonne, mode]);

  // --- POPUP GRATITUDE CHECK (VIP/Abonné uniquement) ---
  useEffect(() => {
    // Ne pas vérifier pour Admin et Invite
    if (user?.role === 'admin' || user?.role === 'invite' || popupChecked) return;
    
    // VIP et Abonné uniquement
    if (user?.role === 'vip' || user?.role === 'abonne') {
      const checkPopup = async () => {
        try {
          // Incrémenter le compteur d'accès
          await fetch('/api/popup/increment-access', {
            method: 'POST',
            credentials: 'include',
          });

          // Vérifier si on doit afficher le popup
          const response = await fetch('/api/popup/check', {
            method: 'POST',
            credentials: 'include',
          });
          const data = await response.json();
          
          if (data.showPopup) {
            setShowGratitudePopup(true);
            setDontShowPopupAgain(data.popupStatus === 'reduced');
          }
          
          setPopupChecked(true);
        } catch (err) {
          console.error('Erreur vérification popup:', err);
        }
      };
      
      checkPopup();
    }
  }, [user?.role, popupChecked]);

  // Handler pour fermer le popup et mettre à jour le statut
  const handleClosePopup = () => {
    setShowGratitudePopup(false);
  };

  const handleDontShowAgain = async (checked: boolean) => {
    setDontShowPopupAgain(checked);
    
    if (checked) {
      try {
        await fetch('/api/popup/reduce', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (err) {
        console.error('Erreur mise à jour popup status:', err);
      }
    }
  };

  // --- SOUND HELPER ---
  const playSound = (type: keyof typeof sounds) => {
    if (soundEnabled) sounds[type].play();
  };

  // --- DATA LOADING ---
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load RAW history first
        const history = await chargerHistorique();
        setFullHistory(history);
        
        // Initial Stats Computation (ALL)
        const computedStats = computeStatsFromTirages(history);
        setStats(computedStats);
        
        const dernierTirageData = getDernierTirage(history);
        setDernierTirage(dernierTirageData);
        setProchainTirage(getProchainTirage());
        
        // Vérifier si une mise à jour est nécessaire
        const verif = verifierMiseAJourNecessaire(dernierTirageData);
        setUpdateNeeded(verif.necessaire);
        
      } catch (err) {
        console.error("Failed to load EuroMillions data", err);
        toast.error("Erreur de chargement des données historiques");
      }
    };
    
    loadData();
  }, []);

  // --- RECALCULATE STATS ON CONFIG CHANGE ---
  useEffect(() => {
      if (fullHistory.length > 0) {
          const filtered = filterTirages(fullHistory, freqConfig);
          const newStats = computeStatsFromTirages(filtered);
          setStats(newStats);
          
          // Toast info
          let periodName = "Historique Complet";
          if (freqConfig.type === 'last_year') periodName = "Dernière Année";
          else if (freqConfig.type === 'last_20') periodName = "20 Derniers Tirages";
          else if (freqConfig.type === 'custom') periodName = `Période Personnalisée`;
          
          toast.success(`Statistiques mises à jour : ${periodName} (${filtered.length} tirages)`);
      }
  }, [freqConfig, fullHistory]);

  // --- PREPARE STATS FOR DISPLAY ---
  // Calculate min/max frequencies for percentage display
  const freqBounds = useMemo(() => {
      if (!stats) return { numMin: 0, numMax: 1, starMin: 0, starMax: 1 };
      const numFreqs = Object.values(stats.freqNumeros);
      const starFreqs = Object.values(stats.freqEtoiles);
      return {
          numMin: Math.min(...numFreqs),
          numMax: Math.max(...numFreqs),
          starMin: Math.min(...starFreqs),
          starMax: Math.max(...starFreqs)
      };
  }, [stats]);
  
  const mapToDisplayStat = (item: { numero: number, frequence: number }, type: 'number' | 'star', index: number): DisplayStat => {
    const defaultTrend = { direction: 'stable' as const, score: 5 };
    const trend = type === 'number' 
        ? (stats?.tendancesNumeros[item.numero] || defaultTrend)
        : (stats?.tendancesEtoiles ? stats.tendancesEtoiles[item.numero] : defaultTrend);
    
    // Calculate percentage
    const min = type === 'number' ? freqBounds.numMin : freqBounds.starMin;
    const max = type === 'number' ? freqBounds.numMax : freqBounds.starMax;
    const range = max - min || 1;
    const percent = Math.round(((item.frequence - min) / range) * 100);

    return {
      number: item.numero,
      frequency: item.frequence,
      trendScore: trend ? trend.score : 5,
      trendDirection: trend ? trend.direction : 'stable',
      rank: index + 1,
      displayLabel: `${percent}%`
    };
  };

  const highFreqStats = stats?.categoriesNum.elevee.map((s, i) => mapToDisplayStat(s, 'number', i)) || [];
  const midFreqStats = stats?.categoriesNum.moyenne.map((s, i) => mapToDisplayStat(s, 'number', i)) || [];
  const lowFreqStats = (stats?.categoriesNum.basse || []).concat(stats?.categoriesNum.depart || []).map((s, i) => mapToDisplayStat(s, 'number', i)) || [];

  const highStarStats = stats?.categoriesEtoiles.elevee.map((s, i) => mapToDisplayStat(s, 'star', i)) || [];
  const midStarStats = stats?.categoriesEtoiles.moyenne.map((s, i) => mapToDisplayStat(s, 'star', i)) || [];
  const lowStarStats = stats?.categoriesEtoiles.basse.map((s, i) => mapToDisplayStat(s, 'star', i)) || [];
  
  const dormeurStats = Object.entries(stats?.absenceNumeros || {})
      .map(([num, absence]) => ({
          numero: parseInt(num),
          frequence: stats?.freqNumeros[parseInt(num)] || 0,
          absence
      }))
      .sort((a, b) => b.absence - a.absence)
      .map((s, i) => ({
          ...mapToDisplayStat(s, 'number', i),
          displayLabel: `${s.absence}`
      }));

  const dormeurStarStats = Object.entries(stats?.absenceEtoiles || {})
      .map(([num, absence]) => ({
          numero: parseInt(num),
          frequence: stats?.freqEtoiles[parseInt(num)] || 0,
          absence
      }))
      .sort((a, b) => b.absence - a.absence)
      .map((s, i) => ({
          ...mapToDisplayStat(s, 'star', i),
          displayLabel: `${s.absence}`
      }));

  // --- VIVIERS (POOLS) - Pre-calculated and cached, only recalculated when stats change ---
  // These pools are sorted once when stats update, not on every render
  
  // Pre-calculated pools for BALLS (50 numbers)
  const ballPools = useMemo(() => {
      if (!stats) return null;
      
      // Create base array with all stats
      const frequencies = Object.values(stats.freqNumeros);
      const minFreq = Math.min(...frequencies);
      const maxFreq = Math.max(...frequencies);
      const freqRange = maxFreq - minFreq || 1; // Avoid division by zero
      
      const allBalls: PoolItem[] = Array.from({ length: 50 }, (_, i) => {
          const num = i + 1;
          const defaultTrend = { direction: 'stable' as const, score: 5 };
          const trend = stats.tendancesNumeros[num] || defaultTrend;
          const freq = stats.freqNumeros[num] || 0;
          // Calculate percentage: 0% = min, 100% = max
          const frequencyPercent = Math.round(((freq - minFreq) / freqRange) * 100);
          return {
              number: num,
              frequency: freq,
              frequencyPercent,
              trend: trend.score,
              absence: stats.absenceNumeros[num] || 0,
              trendDirection: trend.direction
          };
      });
      
      return {
          byNumeric: [...allBalls].sort((a, b) => a.number - b.number),
          byFrequency: [...allBalls].sort((a, b) => b.frequency - a.frequency),
          byTrend: [...allBalls].sort((a, b) => b.trend - a.trend),
          byDormeur: [...allBalls].sort((a, b) => b.absence - a.absence)
      };
  }, [stats]);
  
  // Pre-calculated pools for STARS (12 numbers)
  const starPools = useMemo(() => {
      if (!stats) return null;
      
      // Calculate min/max for stars
      const starFrequencies = Object.values(stats.freqEtoiles);
      const minStarFreq = Math.min(...starFrequencies);
      const maxStarFreq = Math.max(...starFrequencies);
      const starFreqRange = maxStarFreq - minStarFreq || 1;
      
      const allStars: PoolItem[] = Array.from({ length: 12 }, (_, i) => {
          const num = i + 1;
          const defaultTrend = { direction: 'stable' as const, score: 5 };
          const trend = stats.tendancesEtoiles ? stats.tendancesEtoiles[num] : defaultTrend;
          const freq = stats.freqEtoiles[num] || 0;
          const frequencyPercent = Math.round(((freq - minStarFreq) / starFreqRange) * 100);
          return {
              number: num,
              frequency: freq,
              frequencyPercent,
              trend: trend ? trend.score : 5,
              absence: stats.absenceEtoiles[num] || 0,
              trendDirection: trend ? trend.direction : 'stable'
          };
      });
      
      return {
          byNumeric: [...allStars].sort((a, b) => a.number - b.number),
          byFrequency: [...allStars].sort((a, b) => b.frequency - a.frequency),
          byTrend: [...allStars].sort((a, b) => b.trend - a.trend),
          byDormeur: [...allStars].sort((a, b) => b.absence - a.absence)
      };
  }, [stats]);
  
  // Helper to get rank in a pool (for tie-breaking)
  const getRankInPool = (pool: PoolItem[] | undefined, num: number): number => {
      if (!pool) return 999;
      const index = pool.findIndex(item => item.number === num);
      return index >= 0 ? index : 999;
  };
  
  // --- SIMPLIFIED MODE: Get sorted stats with priority-based tie-breaking ---
  const getSimplifiedBallStats = (sortMode: 'numeric' | 'frequency' | 'trend' | 'dormeur'): DisplayStat[] => {
      if (!ballPools) return [];
      
      // Get the primary sorted pool based on mode
      let basePool: PoolItem[];
      if (sortMode === 'numeric') {
          basePool = ballPools.byNumeric;
      } else if (sortMode === 'frequency') {
          basePool = ballPools.byFrequency;
      } else if (sortMode === 'trend') {
          basePool = ballPools.byTrend;
      } else {
          basePool = ballPools.byDormeur;
      }
      
      // Apply priority-based sorting for tie-breaking
      const sorted = [...basePool].sort((a, b) => {
          // Primary sort based on mode
          let diff = 0;
          if (sortMode === 'numeric') {
              diff = a.number - b.number;
          } else if (sortMode === 'frequency') {
              diff = b.frequency - a.frequency;
          } else if (sortMode === 'trend') {
              diff = b.trend - a.trend;
          } else {
              diff = b.absence - a.absence;
          }
          
          if (diff !== 0) return diff;
          
          // Tie-breaking with priorities
          const priorities = [sortPriority1, sortPriority2, sortPriority3];
          for (const priority of priorities) {
              let tieDiff = 0;
              if (priority === 'frequency') {
                  tieDiff = b.frequency - a.frequency;
              } else if (priority === 'trend') {
                  tieDiff = b.trend - a.trend;
              } else {
                  tieDiff = b.absence - a.absence;
              }
              if (tieDiff !== 0) return tieDiff;
          }
          
          return a.number - b.number; // Final fallback: numeric order
      });
      
      // Convert to DisplayStat format - use percentage for frequency display
      return sorted.map(item => ({
          number: item.number,
          frequency: item.frequency,
          trendScore: item.trend,
          trendDirection: item.trendDirection,
          displayLabel: sortMode === 'dormeur' ? `${item.absence}` : `${item.frequencyPercent}%`
      }));
  };
  
  const getSimplifiedStarStats = (sortMode: 'numeric' | 'frequency' | 'trend' | 'dormeur'): DisplayStat[] => {
      if (!starPools) return [];
      
      let basePool: PoolItem[];
      if (sortMode === 'numeric') {
          basePool = starPools.byNumeric;
      } else if (sortMode === 'frequency') {
          basePool = starPools.byFrequency;
      } else if (sortMode === 'trend') {
          basePool = starPools.byTrend;
      } else {
          basePool = starPools.byDormeur;
      }
      
      const sorted = [...basePool].sort((a, b) => {
          let diff = 0;
          if (sortMode === 'numeric') {
              diff = a.number - b.number;
          } else if (sortMode === 'frequency') {
              diff = b.frequency - a.frequency;
          } else if (sortMode === 'trend') {
              diff = b.trend - a.trend;
          } else {
              diff = b.absence - a.absence;
          }
          
          if (diff !== 0) return diff;
          
          const priorities = [sortPriority1, sortPriority2, sortPriority3];
          for (const priority of priorities) {
              let tieDiff = 0;
              if (priority === 'frequency') {
                  tieDiff = b.frequency - a.frequency;
              } else if (priority === 'trend') {
                  tieDiff = b.trend - a.trend;
              } else {
                  tieDiff = b.absence - a.absence;
              }
              if (tieDiff !== 0) return tieDiff;
          }
          
          return a.number - b.number;
      });
      
      // Use percentage for frequency display
      return sorted.map(item => ({
          number: item.number,
          frequency: item.frequency,
          trendScore: item.trend,
          trendDirection: item.trendDirection,
          displayLabel: sortMode === 'dormeur' ? `${item.absence}` : `${item.frequencyPercent}%`
      }));
  };

  // --- FORBO ALGORITHM: DYNAMIC CATEGORY RESOLUTION ---
  const resolveCategory = (num: number, type: 'number' | 'star'): 'high' | 'mid' | 'low' | 'dormeur' | null => {
      const candidates: { cat: 'high' | 'mid' | 'low' | 'dormeur', rank: number }[] = [];

      if (type === 'number') {
          // Check High
          const h = highFreqStats.find(s => s.number === num);
          if (h && h.rank) candidates.push({ cat: 'high', rank: h.rank });
          
          // Check Mid
          const m = midFreqStats.find(s => s.number === num);
          if (m && m.rank) candidates.push({ cat: 'mid', rank: m.rank });
          
          // Check Low
          const l = lowFreqStats.find(s => s.number === num);
          if (l && l.rank) candidates.push({ cat: 'low', rank: l.rank });
          
          // Check Dormeur
          const d = dormeurStats.find(s => s.number === num);
          if (d && d.rank) candidates.push({ cat: 'dormeur', rank: d.rank });
      } else {
          // Check High Star
          const h = highStarStats.find(s => s.number === num);
          if (h && h.rank) candidates.push({ cat: 'high', rank: h.rank });
          
          // Check Mid Star
          const m = midStarStats.find(s => s.number === num);
          if (m && m.rank) candidates.push({ cat: 'mid', rank: m.rank });
          
          // Check Low Star
          const l = lowStarStats.find(s => s.number === num);
          if (l && l.rank) candidates.push({ cat: 'low', rank: l.rank });
          
          // Check Dormeur Star
          const d = dormeurStarStats.find(s => s.number === num);
          if (d && d.rank) candidates.push({ cat: 'dormeur', rank: d.rank });
      }

      if (candidates.length === 0) return null;

      // SIMPLIFIED: Just return the first category found (no precedence rules)
      // This is only used as a FALLBACK when no explicit source is recorded
      // Sort by rank only - no special tie-break for Dormeur
      candidates.sort((a, b) => a.rank - b.rank);

      return candidates[0].cat;
  };

  // --- MANUAL MODE HELPERS ---

  const NUMBER_POOL_LIMIT = 10;
  const STAR_POOL_LIMIT = 12;

  const getNumberCategory = (num: number) => {
    // STRICT VISIBILITY RULE: Only count if visible in the Pool (Top 10)
    // Priority: Dormeur > High > Mid > Low
    
    // 1. Check Dormeur (Top 10)
    const topDormeurs = dormeurStats.slice(0, NUMBER_POOL_LIMIT).map(s => s.number);
    if (topDormeurs.includes(num)) return 'dormeur';

    // 2. Check High (Top 10)
    const topHigh = highFreqStats.slice(0, NUMBER_POOL_LIMIT).map(s => s.number);
    if (topHigh.includes(num)) return 'high';

    // 3. Check Mid (Top 10)
    const topMid = midFreqStats.slice(0, NUMBER_POOL_LIMIT).map(s => s.number);
    if (topMid.includes(num)) return 'mid';

    // 4. Check Low (Top 10)
    const topLow = lowFreqStats.slice(0, NUMBER_POOL_LIMIT).map(s => s.number);
    if (topLow.includes(num)) return 'low';

    // 5. Hors Catégorie (Not visible in any pool)
    return null; 
  };

  const getStarCategory = (num: number) => {
    // STRICT VISIBILITY RULE: Only count if visible in the Pool (Top 12)
    // Priority: Dormeur > High > Mid > Low

    // 1. Check Dormeur (Top 12)
    const topStarDormeurs = dormeurStarStats.slice(0, STAR_POOL_LIMIT).map(s => s.number);
    if (topStarDormeurs.includes(num)) return 'dormeur';

    // 2. Check High (Top 12)
    const topHigh = highStarStats.slice(0, STAR_POOL_LIMIT).map(s => s.number);
    if (topHigh.includes(num)) return 'high';

    // 3. Check Mid (Top 12)
    const topMid = midStarStats.slice(0, STAR_POOL_LIMIT).map(s => s.number);
    if (topMid.includes(num)) return 'mid';

    // 4. Check Low (Top 12)
    const topLow = lowStarStats.slice(0, STAR_POOL_LIMIT).map(s => s.number);
    if (topLow.includes(num)) return 'low';

    return null;
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
      // Check max limit based on tariff
      const maxLimit = selectedTariff ? selectedTariff.nums : maxWeightLimit;
      
      if (total > maxLimit) {
          // Allow decreasing even if over limit to let user fix it
          if (newVal < oldVal) return true;
          
          toast.error(`MAXIMUM ${maxLimit} BOULES (Total Pondérations) !`, { duration: 3000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
          playSound('error');
          return false;
      }
      // Allow decreasing freely - Forbo can complete if needed
      return true;
  };

  const checkStarWeightLimit = (newVal: number, oldVal: number, w1: number, w2: number, w3: number) => {
      const total = newVal + w1 + w2 + w3;
      
      // Check max limit based on tariff
      const maxLimit = selectedTariff ? selectedTariff.stars : maxStarWeightLimit;

      if (total > maxLimit) {
          // Allow decreasing even if over limit to let user fix it
          if (newVal < oldVal) return true;

          toast.error(`MAXIMUM ${maxLimit} ÉTOILES !`, { duration: 3000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
          playSound('error');
          return false;
      }
      // Allow decreasing freely - Forbo can complete if needed
      return true;
  };

  // --- MANUAL SELECTION LOGIC ---
  const toggleSelection = (num: number, type: 'number' | 'star', category?: 'high' | 'mid' | 'low' | 'dormeur') => {
      // Mark as user modified
      userModifiedRef.current = true;

      if (mode === 'auto') return;

      // Check if tariff is selected - required for manual selection
      if (!selectedTariff) {
          playSound('error');
          return;
      }

      if (type === 'number') {
        if (selectedNumbers.includes(num)) {
            // REMOVE - always allowed
            setSelectedNumbers(prev => prev.filter(n => n !== num));
            // Also remove from sources
            setNumberSources(prev => {
                const next = { ...prev };
                delete next[num];
                return next;
            });
            playSound('click');
        } else {
             // ADD NUMBER - check if we reached the tariff limit
             if (selectedNumbers.length >= selectedTariff.nums) {
                 // Already at max - play error sound and block
                 playSound('error');
                 return;
             }
             
            setSelectedNumbers(prev => [...prev, num].sort((a, b) => a - b));
            // Record the source category where user clicked
            if (category) {
                setNumberSources(prev => ({ ...prev, [num]: category }));
            }
            playSound('click');
        }
      } else {
         // STAR LOGIC
         if (selectedStars.includes(num)) {
            // REMOVE - always allowed
            setSelectedStars(prev => prev.filter(n => n !== num));
            // Also remove from sources
            setStarSources(prev => {
                const next = { ...prev };
                delete next[num];
                return next;
            });
            playSound('click');
        } else {
             // ADD STAR - check if we reached the tariff limit
             if (selectedStars.length >= selectedTariff.stars) {
                 // Already at max - play error sound and block
                 playSound('error');
                 return;
             }

            setSelectedStars(prev => [...prev, num].sort((a, b) => a - b));
            // Record the source category where user clicked
            if (category) {
                setStarSources(prev => ({ ...prev, [num]: category }));
            }
            playSound('click');
        }
      }
      // Price updates automatically via reactive currentPrice
  };

    const currentNumCount = weightHigh + weightMid + weightLow + weightDormeur;
    const currentStarCount = weightStarHigh + weightStarMid + weightStarLow + weightStarDormeur;

    // USE SELECTED TARIFF FOR PRICE DISPLAY
    const currentPrice = selectedTariff 
        ? selectedTariff.price 
        : 0;
    
    // For visual info only
    const displayNumCount = selectedTariff ? selectedTariff.nums : currentNumCount;
    const displayStarCount = selectedTariff ? selectedTariff.stars : currentStarCount;
    
    const isValide = isCombinaisonValide(displayNumCount, displayStarCount);

  // --- PRESET LOGIC ---

  // Reset all settings to default values (preset 0)
  const resetToDefault = () => {
    // Reset counters
    setHighFreqCount(0);
    setMidFreqCount(0);
    setLowFreqCount(0);
    setHighStarCount(0);
    setMidStarCount(0);
    setLowStarCount(0);
    
    // Reset toggles
    setHighFreqActive(false);
    setMidFreqActive(false);
    setLowFreqActive(false);
    setHighStarActive(false);
    setMidStarActive(false);
    setLowStarActive(false);
    setDormeurStarActive(false);
    
    // Reset weights
    setWeightHigh(0);
    setWeightMid(0);
    setWeightLow(0);
    setWeightDormeur(0);
    setWeightStarHigh(0);
    setWeightStarMid(0);
    setWeightStarLow(0);
    setWeightStarDormeur(0);
    
    // Reset options
    setAvoidPairExt(false);
    setBalanceHighLow(false);
    setAvoidPopSeq(false);
    setAvoidFriday(false);
    setEmailNotify(false);
    setSmsNotify(false);
    
    // Reset hazard and tendency
    setHazardLevel(0);
    setTendencyLevel(0);
    
    // Reset mode to auto
    setMode('auto');
    
    // Reset price/tariff
    setSelectedTariff(null);
    
    // Reset simplified mode
    setIsSimplifiedMode(false);
    
    // Reset priorities
    setSortPriority1('frequency');
    setSortPriority2('trend');
    setSortPriority3('dormeur');
    
    // Clear selections
    setSelectedNumbers([]);
    setSelectedStars([]);
    setNumberSources({});
    setStarSources({});
    
    // Clear generated results
    setGeneratedNumbers([]);
    setGeneratedStars([]);
    setAutoDraws([]);
  };

  // Check which presets have data on mount/user change
  useEffect(() => {
    if (!user) return;
    const savedPresets = localStorage.getItem(`loto_presets_${user.username}`);
    if (savedPresets) {
        try {
            const parsed = JSON.parse(savedPresets);
            const status: Record<string, boolean> = {};
            for (let i = 0; i <= 5; i++) {
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

    // Prevent overwriting restored state on initial load
    if (isRestoringRef.current) {
        console.log("Skipping preset load to preserve restored state");
        isRestoringRef.current = false;
        return;
    }

    // If preset is "0", reset to default
    if (selectedPreset === "0") {
        resetToDefault();
        return;
    }

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
                
                // Restore nouveaux paramètres (avec valeurs par défaut pour rétrocompatibilité)
                if (presetData.hazardLevel !== undefined) setHazardLevel(presetData.hazardLevel);
                if (presetData.tendencyLevel !== undefined) setTendencyLevel(presetData.tendencyLevel);
                if (presetData.emailNotify !== undefined) setEmailNotify(presetData.emailNotify);
                if (presetData.smsNotify !== undefined) setSmsNotify(presetData.smsNotify);
                
                // Restaurer le tarif sélectionné
                if (presetData.numCount !== undefined && presetData.starCount !== undefined) {
                    const nums = presetData.numCount;
                    const stars = presetData.starCount;
                    const price = GRILLE_TARIFAIRE[nums]?.[stars] || 2.5;
                    setSelectedTariff({ nums, stars, price });
                }
                
                if (presetData.isSimplifiedMode !== undefined) setIsSimplifiedMode(presetData.isSimplifiedMode);
                
                // Restaurer les priorités de tri
                if (presetData.sortPriority1) setSortPriority1(presetData.sortPriority1);
                if (presetData.sortPriority2) setSortPriority2(presetData.sortPriority2);
                if (presetData.sortPriority3) setSortPriority3(presetData.sortPriority3);
                
                // playSound('click'); // Optional: feedback on load
            }
        } catch (e) {
            console.error("Error loading presets", e);
        }
    }
  }, [selectedPreset, user]);

  const handlePresetDoubleClick = () => {
      if (!user) return;

      // Prevent saving on preset "0"
      if (selectedPreset === "0") {
          toast.error("Impossible de sauvegarder sur le réglage 0 (Réinitialisation)");
          return;
      }

      // Gather current state - TOUS les paramètres
      const currentConfig: PresetConfig = {
        highFreqCount, midFreqCount, lowFreqCount,
        highFreqActive, midFreqActive, lowFreqActive,
        highStarCount, midStarCount, lowStarCount,
        highStarActive, midStarActive, lowStarActive,
        weightHigh, weightMid, weightLow, weightDormeur,
        weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
        avoidPairExt, balanceHighLow, avoidPopSeq, avoidFriday,
        mode,
        // Nouveaux paramètres
        hazardLevel,
        tendencyLevel,
        emailNotify,
        smsNotify,
        numCount: selectedTariff?.nums || 5,
        starCount: selectedTariff?.stars || 2,
        isSimplifiedMode,
        // Priorités de tri
        sortPriority1,
        sortPriority2,
        sortPriority3
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

  // Save a specific preset from the dropdown
  const handleSavePreset = (presetId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user) return;

      // Prevent saving on preset "0"
      if (presetId === "0") {
          toast.error("Impossible de sauvegarder sur le réglage 0 (Réinitialisation)");
          return;
      }

      // Gather current state - TOUS les paramètres
      const currentConfig: PresetConfig = {
        highFreqCount, midFreqCount, lowFreqCount,
        highFreqActive, midFreqActive, lowFreqActive,
        highStarCount, midStarCount, lowStarCount,
        highStarActive, midStarActive, lowStarActive,
        weightHigh, weightMid, weightLow, weightDormeur,
        weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
        avoidPairExt, balanceHighLow, avoidPopSeq, avoidFriday,
        mode,
        // Nouveaux paramètres
        hazardLevel,
        tendencyLevel,
        emailNotify,
        smsNotify,
        numCount: selectedTariff?.nums || 5,
        starCount: selectedTariff?.stars || 2,
        isSimplifiedMode,
        // Priorités de tri
        sortPriority1,
        sortPriority2,
        sortPriority3
      };

      // Save to localStorage with user-specific key
      const savedPresets = localStorage.getItem(`loto_presets_${user.username}`);
      let presets = savedPresets ? JSON.parse(savedPresets) : {};
      presets[presetId] = currentConfig;
      
      localStorage.setItem(`loto_presets_${user.username}`, JSON.stringify(presets));
      
      // Update status
      setPresetHasData(prev => ({...prev, [presetId]: true}));

      playSound('click');
      toast.success(`Réglages sauvegardés dans Réglage ${presetId}`);
  };

  // Delete a specific preset
  const handleDeletePreset = (presetId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user) return;
      
      const savedPresets = localStorage.getItem(`loto_presets_${user.username}`);
      if (savedPresets) {
          const presets = JSON.parse(savedPresets);
          delete presets[presetId];
          localStorage.setItem(`loto_presets_${user.username}`, JSON.stringify(presets));
          setPresetHasData(prev => ({...prev, [presetId]: false}));
          playSound('click');
          toast.success(`Réglage ${presetId} effacé`);
      }
  };

  // Load a specific preset
  const handleLoadPreset = (presetId: string) => {
      if (!user) return;
      
      setSelectedPreset(presetId);
      setIsPresetDropdownOpen(false);
      playSound('click');
      
      // If preset is "0", reset to default
      if (presetId === "0") {
          resetToDefault();
          toast.success("Réglage 0 : Console réinitialisée");
          return;
      }
      
      // Load saved data if exists
      const savedPresets = localStorage.getItem(`loto_presets_${user.username}`);
      if (savedPresets) {
          const presets = JSON.parse(savedPresets);
          if (presets[presetId]) {
              const config = presets[presetId] as PresetConfig;
              
              // Restore all settings
              setHighFreqCount(config.highFreqCount);
              setMidFreqCount(config.midFreqCount);
              setLowFreqCount(config.lowFreqCount);
              setHighFreqActive(config.highFreqActive);
              setMidFreqActive(config.midFreqActive);
              setLowFreqActive(config.lowFreqActive);
              
              setHighStarCount(config.highStarCount);
              setMidStarCount(config.midStarCount);
              setLowStarCount(config.lowStarCount);
              setHighStarActive(config.highStarActive);
              setMidStarActive(config.midStarActive);
              setLowStarActive(config.lowStarActive);
              
              setWeightHigh(config.weightHigh);
              setWeightMid(config.weightMid);
              setWeightLow(config.weightLow);
              setWeightDormeur(config.weightDormeur);
              
              setWeightStarHigh(config.weightStarHigh);
              setWeightStarMid(config.weightStarMid);
              setWeightStarLow(config.weightStarLow);
              setWeightStarDormeur(config.weightStarDormeur);
              
              setAvoidPairExt(config.avoidPairExt);
              setBalanceHighLow(config.balanceHighLow);
              setAvoidPopSeq(config.avoidPopSeq);
              
              if (config.mode) setMode(config.mode);
              
              // Restore nouveaux paramètres (avec vérification pour rétrocompatibilité)
              if (config.hazardLevel !== undefined) setHazardLevel(config.hazardLevel);
              if (config.tendencyLevel !== undefined) setTendencyLevel(config.tendencyLevel);
              if (config.emailNotify !== undefined) setEmailNotify(config.emailNotify);
              if (config.smsNotify !== undefined) setSmsNotify(config.smsNotify);
              
              // Restaurer le tarif sélectionné
              if (config.numCount !== undefined && config.starCount !== undefined) {
                  const nums = config.numCount;
                  const stars = config.starCount;
                  const price = GRILLE_TARIFAIRE[nums]?.[stars] || 2.5;
                  setSelectedTariff({ nums, stars, price });
              }
              
              if (config.isSimplifiedMode !== undefined) setIsSimplifiedMode(config.isSimplifiedMode);
              
              // Restaurer les priorités de tri
              if (config.sortPriority1) setSortPriority1(config.sortPriority1);
              if (config.sortPriority2) setSortPriority2(config.sortPriority2);
              if (config.sortPriority3) setSortPriority3(config.sortPriority3);
              
              toast.success(`Réglage ${presetId} chargé`);
          }
      }
  };

  // --- GENERATION LOGIC ---
    // 1. Define Pools based on VISIBLE stats (Top 10/12)
    const poolHigh = highFreqStats.slice(0, 10).map(s => s.number);
    const poolMid = midFreqStats.slice(0, 10).map(s => s.number);
    const poolLow = lowFreqStats.slice(0, 10).map(s => s.number);
    const poolDormeur = dormeurStats.slice(0, 10).map(s => s.number);

    // STRICT STAR PARTITIONING (4-4-4)
    const poolStarHigh = highStarStats.slice(0, 4).map(s => s.number);
    const poolStarMid = midStarStats.slice(0, 4).map(s => s.number);
    const poolStarLow = lowStarStats.slice(0, 4).map(s => s.number);
    const poolStarDormeur = dormeurStarStats.slice(0, 4).map(s => s.number);

    // Helper to update selection when Knob changes in MANUAL mode
    const updateCategorySelection = (
        targetCount: number, 
        category: 'high' | 'mid' | 'low' | 'dormeur', 
        isStar: boolean
    ) => {
        // Only active in Manual Mode
        if (mode !== 'manual') return;

        const currentList = isStar ? selectedStars : selectedNumbers;
        const setList = isStar ? setSelectedStars : setSelectedNumbers;
        const sourceMap = isStar ? starSources : numberSources;
        const setSourceMap = isStar ? setStarSources : setNumberSources;
        
        const pool = isStar 
            ? (category === 'high' ? poolStarHigh : category === 'mid' ? poolStarMid : category === 'low' ? poolStarLow : poolStarDormeur)
            : (category === 'high' ? poolHigh : category === 'mid' ? poolMid : category === 'low' ? poolLow : poolDormeur);

        // Identify currently selected items belonging to this category
        const currentInCategory = currentList.filter(n => pool.includes(n));
        const otherItems = currentList.filter(n => !pool.includes(n));
        
        const currentCount = currentInCategory.length;

        if (targetCount > currentCount) {
            // ADD items
            const needed = targetCount - currentCount;
            const available = pool.filter(n => !currentList.includes(n));
            
            // Pick random 'needed' items from available
            const toAdd = available.sort(() => 0.5 - Math.random()).slice(0, needed);
            
            const newList = [...currentList, ...toAdd];
            setList(newList);
            
            // Update sources
            const newSources = { ...sourceMap };
            toAdd.forEach(n => newSources[n] = category);
            setSourceMap(newSources);

        } else if (targetCount < currentCount) {
            // REMOVE items
            const toKeepCount = targetCount;
            // Prefer keeping items with lower index in pool (higher frequency) or random?
            // Let's remove random ones for now
            const toKeep = currentInCategory.sort(() => 0.5 - Math.random()).slice(0, toKeepCount);
            
            const newList = [...otherItems, ...toKeep];
            setList(newList);
            
            // Update sources
            const newSources = { ...sourceMap };
            const removed = currentInCategory.filter(n => !toKeep.includes(n));
            removed.forEach(n => delete newSources[n]);
            setSourceMap(newSources);
        }
    };

  const handleGenerate = (modeOverride?: 'manual' | 'auto') => {
    const effectiveMode = typeof modeOverride === 'string' ? modeOverride : mode;

    setIsGenerating(true);
    setShowSuccessMessage(false);
    playSound('toggle');

    // --- SYNCHRONOUS CALCULATION START ---
    // Calculate results IMMEDIATELY to ensure we access the current state correctly
    // and avoid any closure staleness issues with setTimeout.
    
    let calculatedNums: number[] = [];
    let calculatedStars: number[] = [];
    let calcNumSources: Record<number, 'high' | 'mid' | 'low' | 'dormeur'> = {};
    let calcStarSources: Record<number, 'high' | 'mid' | 'low' | 'dormeur'> = {};
    let calculationSuccess = false;

    try {
        if (effectiveMode === 'manual') {
            // Manual mode validation - selection must match tariff exactly
            if (!selectedTariff) {
                playSound('error');
                setIsGenerating(false);
                 return;
            }

            if (selectedNumbers.length !== selectedTariff.nums || 
                selectedStars.length !== selectedTariff.stars) {
                playSound('error');
                setIsGenerating(false);
                 return;
            }

            // Use ALL selected numbers/stars (Manual Mode)
            calculatedNums = [...selectedNumbers];
            calculatedStars = [...selectedStars];
            calculationSuccess = true;

        } else {
            // Auto generation using Real Service
            // PRIORITY: TARIFF is mandatory - nothing works without it
            if (!selectedTariff) {
                playSound('error');
                setIsGenerating(false);
                alert("Veuillez d'abord sélectionner un tarif dans 'Prix de la Grille'.");
                return;
            }

            // Calculate effective ball weights (simplified mode ignores Mid/Low)
            const effectiveWeightHigh = weightHigh;
            const effectiveWeightMid = isSimplifiedMode ? 0 : weightMid;
            const effectiveWeightLow = isSimplifiedMode ? 0 : weightLow;
            const effectiveWeightDormeur = weightDormeur;
            
            // Calculate total from effective weights
            const weightTotalNums = effectiveWeightHigh + effectiveWeightMid + effectiveWeightLow + effectiveWeightDormeur;
            // NEUTRALIZED: Star weights now derived from ball weights proportions
            // const weightTotalStars = weightStarHigh + weightStarMid + weightStarLow + weightStarDormeur;

            // Use TARIFF as the target, weights define distribution
            // If weights = 0, use tariff values directly (pure stats mode)
            const targetNums = selectedTariff.nums;
            const targetStars = selectedTariff.stars;

            // TARIFF defines the total - weights define distribution, not the total count
            // If weights < tariff, Forbo completes with best stats
            const totalNums = targetNums;
            const totalStars = targetStars;
            
            // Calculate proportional star weights from ball weights
            // This makes ball ponderation control BOTH balls AND stars
            let effectiveStarHigh = 0, effectiveStarMid = 0, effectiveStarLow = 0, effectiveStarDormeur = 0;
            if (weightTotalNums > 0) {
                const proportionHigh = effectiveWeightHigh / weightTotalNums;
                const proportionMid = effectiveWeightMid / weightTotalNums;
                const proportionLow = effectiveWeightLow / weightTotalNums;
                const proportionDormeur = effectiveWeightDormeur / weightTotalNums;
                
                // Apply proportions to target stars (round, ensuring we don't exceed targetStars)
                effectiveStarHigh = Math.round(proportionHigh * targetStars);
                effectiveStarMid = Math.round(proportionMid * targetStars);
                effectiveStarLow = Math.round(proportionLow * targetStars);
                effectiveStarDormeur = Math.round(proportionDormeur * targetStars);
                
                // Adjust if rounding caused overflow
                let effectiveTotal = effectiveStarHigh + effectiveStarMid + effectiveStarLow + effectiveStarDormeur;
                while (effectiveTotal > targetStars) {
                    // Reduce from smallest non-zero, prioritizing dormeur > low > mid > high
                    if (effectiveStarDormeur > 0) effectiveStarDormeur--;
                    else if (effectiveStarLow > 0) effectiveStarLow--;
                    else if (effectiveStarMid > 0) effectiveStarMid--;
                    else if (effectiveStarHigh > 0) effectiveStarHigh--;
                    effectiveTotal--;
                }
            }
            const effectiveStarTotal = effectiveStarHigh + effectiveStarMid + effectiveStarLow + effectiveStarDormeur;
            
            // Calculate how many to pick from each category based on weights
            // And how many Forbo needs to complete
            const numFromWeights = Math.min(weightTotalNums, targetNums);
            const numToComplete = targetNums - numFromWeights;
            const starFromWeights = Math.min(effectiveStarTotal, targetStars);
            const starToComplete = targetStars - starFromWeights;

            // 1. Define Pools based on VISIBLE stats (Top 10/12)
            // Ensure we handle potential empty stats gracefully by defaulting to empty array
            const safeHighStats = highFreqStats || [];
            const safeMidStats = midFreqStats || [];
            const safeLowStats = lowFreqStats || [];
            const safeDormeurStats = dormeurStats || [];

            const safeHighStarStats = highStarStats || [];
            const safeMidStarStats = midStarStats || [];
            const safeLowStarStats = lowStarStats || [];
            const safeDormeurStarStats = dormeurStarStats || [];

            const poolHigh = safeHighStats.slice(0, 10).map(s => s.number);
            const poolMid = safeMidStats.slice(0, 10).map(s => s.number);
            const poolLow = safeLowStats.slice(0, 10).map(s => s.number);
            const poolDormeur = safeDormeurStats.slice(0, 10).map(s => s.number);

            const poolStarHigh = safeHighStarStats.slice(0, 4).map(s => s.number);
            const poolStarMid = safeMidStarStats.slice(0, 4).map(s => s.number);
            const poolStarLow = safeLowStarStats.slice(0, 4).map(s => s.number);
            const poolStarDormeur = safeDormeurStarStats.slice(0, 4).map(s => s.number);

            // Safety check: If pools are empty (stats not loaded), we can't generate statistically
            if (poolHigh.length === 0 && poolMid.length === 0) {
                console.error("CRITICAL: Stats appear empty during generation");
                // We will NOT use random fallback as requested, but we must alert the user or retry logic
                // For now, let's proceed, maybe lower pools have data?
            }

            // HAZARD SORT LOGIC
            const hazardMultipliers = [0, 5, 10, 20, 35, 50, 75, 100, 150, 250];
            const currentMultiplier = hazardMultipliers[hazardLevel] || 0;

            // Leak Probability REMOVED
            // const leakProbability = hazardLevel * 0.1;

            // Combined pools for stat-based selection
                const combinedNumPool = [...poolHigh, ...poolMid, ...poolLow, ...poolDormeur];
                const combinedStarPool = [...poolStarHigh, ...poolStarMid, ...poolStarLow, ...poolStarDormeur];
                
            // Get all stats for scoring
            const allNumStats = [...(highFreqStats || []), ...(midFreqStats || []), ...(lowFreqStats || []), ...(dormeurStats || [])];
            const allStarStats = [...(highStarStats || []), ...(midStarStats || []), ...(lowStarStats || []), ...(dormeurStarStats || [])];

            // Helper to pick based on CHAOS and TENDANCES
            const pickWithStats = (pool: number[], stats: typeof allNumStats, count: number, exclude: number[] = []) => {
                const uniquePool = Array.from(new Set(pool)).filter(n => !exclude.includes(n));
                
                // Map pool numbers to their stats
                const poolWithStats = uniquePool.map(num => {
                    const stat = stats.find(s => s.number === num);
                    return {
                        num,
                        frequency: stat?.frequency || 0,
                        trendScore: stat?.trendScore || 0
                    };
                });
                    
                // Sort based on CHAOS and TENDANCES
                // Chaos réduit de moitié : max 0.5 à Chaos 10 (équilibre stats/hasard)
                const chaosRatio = hazardLevel / 20;
                const tendanceWeight = tendencyLevel / 10;

                const sorted = poolWithStats
                    .map(item => {
                        const statScore = item.frequency * (1 - tendanceWeight) + item.trendScore * 10 * tendanceWeight;
                        const randomFactor = Math.random() * 100 * chaosRatio;
                        return { ...item, finalScore: statScore + randomFactor };
                    })
                    .sort((a, b) => b.finalScore - a.finalScore);

                return sorted.slice(0, count).map(s => s.num);
            };

            // Check if weights are all zero (pure stats mode)
            // Now only checks ball weights since star weights are derived from balls
            const weightsAreZero = weightTotalNums === 0;

            // Helper: Determine source category for a number based on which pool it came from
            const getSourceCategory = (num: number, isStar: boolean): 'high' | 'mid' | 'low' | 'dormeur' => {
                if (isStar) {
                    if (poolStarHigh.includes(num)) return 'high';
                    if (poolStarMid.includes(num)) return 'mid';
                    if (poolStarLow.includes(num)) return 'low';
                    if (poolStarDormeur.includes(num)) return 'dormeur';
                } else {
                    if (poolHigh.includes(num)) return 'high';
                    if (poolMid.includes(num)) return 'mid';
                    if (poolLow.includes(num)) return 'low';
                    if (poolDormeur.includes(num)) return 'dormeur';
                }
                return 'low'; // fallback
            };

            if (!isWeightsEnabled || weightsAreZero) {
                // --- PURE STATISTICS MODE ---
                // Use TARIFF + CHAOS/TENDANCES, no category constraints
                calculatedNums = pickWithStats(combinedNumPool, allNumStats, totalNums).sort((a, b) => a - b);
                calculatedStars = pickWithStats(combinedStarPool, allStarStats, totalStars).sort((a, b) => a - b);
                
                // Populate sources based on which pool each number belongs to
                calculatedNums.forEach(num => {
                    calcNumSources[num] = getSourceCategory(num, false);
                });
                calculatedStars.forEach(num => {
                    calcStarSources[num] = getSourceCategory(num, true);
                });
                
                calculationSuccess = true;

            } else if (numToComplete > 0 || starToComplete > 0) {
                // --- PARTIAL WEIGHTS MODE ---
                // Use weights for defined categories, then complete with best stats
                let numsFromCategories: number[] = [];
                let starsFromCategories: number[] = [];

                // Pick from each category based on EFFECTIVE weights AND record sources
                if (effectiveWeightHigh > 0) {
                    const picked = pickWithStats(poolHigh, allNumStats, effectiveWeightHigh, numsFromCategories);
                    picked.forEach(num => calcNumSources[num] = 'high');
                    numsFromCategories.push(...picked);
                }
                if (effectiveWeightMid > 0) {
                    const picked = pickWithStats(poolMid, allNumStats, effectiveWeightMid, numsFromCategories);
                    picked.forEach(num => calcNumSources[num] = 'mid');
                    numsFromCategories.push(...picked);
                }
                if (effectiveWeightLow > 0) {
                    const picked = pickWithStats(poolLow, allNumStats, effectiveWeightLow, numsFromCategories);
                    picked.forEach(num => calcNumSources[num] = 'low');
                    numsFromCategories.push(...picked);
                }
                if (effectiveWeightDormeur > 0) {
                    const picked = pickWithStats(poolDormeur, allNumStats, effectiveWeightDormeur, numsFromCategories);
                    picked.forEach(num => calcNumSources[num] = 'dormeur');
                    numsFromCategories.push(...picked);
                }

                // STARS: Use EFFECTIVE weights derived from ball ponderation proportions
                if (effectiveStarHigh > 0) {
                    const picked = pickWithStats(poolStarHigh, allStarStats, effectiveStarHigh, starsFromCategories);
                    picked.forEach(num => calcStarSources[num] = 'high');
                    starsFromCategories.push(...picked);
                }
                if (effectiveStarMid > 0) {
                    const picked = pickWithStats(poolStarMid, allStarStats, effectiveStarMid, starsFromCategories);
                    picked.forEach(num => calcStarSources[num] = 'mid');
                    starsFromCategories.push(...picked);
                }
                if (effectiveStarLow > 0) {
                    const picked = pickWithStats(poolStarLow, allStarStats, effectiveStarLow, starsFromCategories);
                    picked.forEach(num => calcStarSources[num] = 'low');
                    starsFromCategories.push(...picked);
                }
                if (effectiveStarDormeur > 0) {
                    const picked = pickWithStats(poolStarDormeur, allStarStats, effectiveStarDormeur, starsFromCategories);
                    picked.forEach(num => calcStarSources[num] = 'dormeur');
                    starsFromCategories.push(...picked);
                }

                // Complete with best stats from all pools (excluding already selected)
                // For completion, use getSourceCategory to determine the source
                if (numToComplete > 0) {
                    const completion = pickWithStats(combinedNumPool, allNumStats, numToComplete, numsFromCategories);
                    completion.forEach(num => calcNumSources[num] = getSourceCategory(num, false));
                    numsFromCategories.push(...completion);
                }
                if (starToComplete > 0) {
                    const completion = pickWithStats(combinedStarPool, allStarStats, starToComplete, starsFromCategories);
                    completion.forEach(num => calcStarSources[num] = getSourceCategory(num, true));
                    starsFromCategories.push(...completion);
                }

                calculatedNums = numsFromCategories.sort((a, b) => a - b);
                calculatedStars = starsFromCategories.sort((a, b) => a - b);
                calculationSuccess = true;

            } else {
                // --- STANDARD LOGIC (EXISTING) WITH STRUCTURAL CHAOS ---
                let attempts = 0;
                let success = false;
                
                let allSelectedNums: number[] = [];
                let allSelectedStars: number[] = [];

                // Combined pools for chaos leak fallback - RESTRICTED TO VISIBLE POOLS (Top 10 / Top 4)
                // User requirement: Even in chaos, only pick from the "visible" numbers (Top 10 of each section).
                const combinedNumPool = [...poolHigh, ...poolMid, ...poolLow, ...poolDormeur];
                const combinedStarPool = [...poolStarHigh, ...poolStarMid, ...poolStarLow, ...poolStarDormeur];

                while(attempts < 50 && !success) {
                    attempts++;
                    
                    // Reset per attempt
                    calcNumSources = {};
                    calcStarSources = {};
                    allSelectedNums = [];
                    allSelectedStars = [];

                    const selectUnique = (pool: number[], count: number, exclude: number[], category: 'high' | 'mid' | 'low' | 'dormeur', isStar: boolean) => {
                        let selection: number[] = [];
                        
                        // Pools definition
                        const availableStrict = pool.filter(n => !exclude.includes(n));
                        const availableGlobal = (isStar ? combinedStarPool : combinedNumPool).filter(n => !exclude.includes(n));

                        for(let i=0; i<count; i++) {
                            // Decide source for this single pick: STRICT ONLY (Leak Removed)
                            // const isLeaking = Math.random() < leakProbability;
                            
                            // Define Candidate Pool
                            // ALWAYS STRICT
                            let candidatePool = availableStrict;
                            
                            // Filter out duplicates within current batch selection
                            candidatePool = candidatePool.filter(n => !selection.includes(n));
                            
                            // FALLBACKS:
                            // If strict pool is empty:
                            // - If Chaos > 0: FAIL (Strict obedience, no security).
                            // - If Chaos == 0: FALLBACK allowed (Ensure grid completion for "safe" mode).
                            if (candidatePool.length === 0) {
                                if (hazardLevel === 0) {
                                     // console.log("Chaos 0: Using fallback for empty strict pool");
                                     candidatePool = availableGlobal.filter(n => !selection.includes(n));
                                }
                            }
                            
                            if (candidatePool.length === 0) break; // Should not happen if total counts are valid

                            // Sort candidates with random noise (Fuzziness)
                            const sorted = candidatePool
                                .map((num, index) => ({
                                    num,
                                    sortScore: Math.random() // Pure random within the decided pool
                                }))
                                .sort((a, b) => b.sortScore - a.sortScore);
                            
                            const picked = sorted[0].num;
                            selection.push(picked);
                        }
                        
                        selection.forEach(num => {
                            if (isStar) calcStarSources[num] = category;
                            else calcNumSources[num] = category;
                        });
                        
                        return selection;
                    };
                    // NUMBERS - Use EFFECTIVE weights (simplified mode ignores Mid/Low)
                    allSelectedNums.push(...selectUnique(poolHigh, effectiveWeightHigh, allSelectedNums, 'high', false));
                    allSelectedNums.push(...selectUnique(poolMid, effectiveWeightMid, allSelectedNums, 'mid', false));
                    allSelectedNums.push(...selectUnique(poolLow, effectiveWeightLow, allSelectedNums, 'low', false));
                    allSelectedNums.push(...selectUnique(poolDormeur, effectiveWeightDormeur, allSelectedNums, 'dormeur', false));

                    // STARS - Use EFFECTIVE weights derived from ball ponderation proportions
                    allSelectedStars.push(...selectUnique(poolStarHigh, effectiveStarHigh, allSelectedStars, 'high', true));
                    allSelectedStars.push(...selectUnique(poolStarMid, effectiveStarMid, allSelectedStars, 'mid', true));
                    allSelectedStars.push(...selectUnique(poolStarLow, effectiveStarLow, allSelectedStars, 'low', true));
                    allSelectedStars.push(...selectUnique(poolStarDormeur, effectiveStarDormeur, allSelectedStars, 'dormeur', true));
                    
                    // --- CONSTRAINT CHECKS ---
                    if (avoidPairExt && allSelectedNums.length > 0) {
                        const allEven = allSelectedNums.every(n => n % 2 === 0);
                        const allOdd = allSelectedNums.every(n => n % 2 !== 0);
                        if (allEven || allOdd) continue;
                    }

                    if (balanceHighLow && allSelectedNums.length > 0) {
                        const allHigh = allSelectedNums.every(n => n > 25);
                        const allLow = allSelectedNums.every(n => n <= 25);
                        if (allHigh || allLow) continue;
                    }

                    if (avoidPopSeq && allSelectedNums.length > 0) {
                        const sortedCheck = [...allSelectedNums].sort((a, b) => a - b);
                        let hasSequence = false;
                        for (let i = 0; i < sortedCheck.length - 2; i++) {
                             if (sortedCheck[i+1] === sortedCheck[i] + 1 && sortedCheck[i+2] === sortedCheck[i] + 2) {
                                 hasSequence = true;
                                 break;
                             }
                        }
                        if (hasSequence) continue;
                    }
                    
                    success = true;
                }

                if (!success) {
                    console.warn("Could not satisfy all constraints strictly");
                    toast.warning("Certaines contraintes (Pair/Impair, H/B, Séquences) n'ont pas pu être satisfaites strictement.");
                }

                // --- RECALCULATE SOURCES & UPDATE KNOBS (CHAOS FEEDBACK) ---
                // DISABLED AS REQUESTED - KNOBS MUST REMAIN FIXED
                
                /*
                // Since Chaos might have picked numbers from outside the requested category,
                // we must re-evaluate the TRUE category of every selected number to update the knobs.
                
                const getTrueCategory = (n: number, isStar: boolean) => {
                     let category: 'high' | 'mid' | 'low' | 'dormeur' = 'low'; // Default base
                     
                     if (isStar) {
                         // Check Dormeur First (Top 4)
                         if (safeDormeurStarStats.slice(0, 4).some(x => x.number === n)) category = 'dormeur';
                         // Overwrite with Frequency (Mid/High take priority)
                         if (safeMidStarStats.some(x => x.number === n)) category = 'mid';
                         if (safeHighStarStats.some(x => x.number === n)) category = 'high';
                     } else {
                         // Check Dormeur First (Top 12)
                         if (safeDormeurStats.slice(0, 12).some(x => x.number === n)) category = 'dormeur';
                         // Overwrite with Frequency (Mid/High take priority)
                         if (safeMidStats.some(x => x.number === n)) category = 'mid';
                         if (safeHighStats.some(x => x.number === n)) category = 'high';
                     }
                     return category;
                };

                let h=0, m=0, l=0, d=0;
                allSelectedNums.forEach(n => {
                    const cat = getTrueCategory(n, false);
                    calcNumSources[n] = cat;
                    if(cat === 'high') h++; else if(cat === 'mid') m++; else if(cat === 'low') l++; else if(cat === 'dormeur') d++;
                });
                setWeightHigh(h); setWeightMid(m); setWeightLow(l); setWeightDormeur(d);

                let sh=0, sm=0, sl=0, sd=0;
                allSelectedStars.forEach(n => {
                    const cat = getTrueCategory(n, true);
                    calcStarSources[n] = cat;
                    if(cat === 'high') sh++; else if(cat === 'mid') sm++; else if(cat === 'low') sl++; else if(cat === 'dormeur') sd++;
                });
                setWeightStarHigh(sh); setWeightStarMid(sm); setWeightStarLow(sl); setWeightStarDormeur(sd);
                */

                calculatedNums = allSelectedNums.sort((a, b) => a - b);                calculatedStars = allSelectedStars.sort((a, b) => a - b);
            }
            
            calculationSuccess = true;
        }

    } catch (e) {
        console.error("Calculation Error:", e);
        setIsGenerating(false);
        playSound('error');
        return;
    }

    // --- SYNCHRONOUS CALCULATION END ---

    // Simulate Calculation Delay then Display
    setTimeout(() => {
        if (!calculationSuccess) {
            setIsGenerating(false);
            return;
        }

        if (effectiveMode !== 'manual') {
             setSelectedNumbers(calculatedNums);
             setSelectedStars(calculatedStars);
             setNumberSources(calcNumSources);
             setStarSources(calcStarSources);
             
             // STACK MODE for Auto: Add to history of current session
             // VIP/Admin: visible immédiatement, Invite/Abonné: toujours masqué
             const newDraw = { nums: calculatedNums, stars: calculatedStars, date: new Date(), revealed: isAdminOrVip };
             setAutoDraws(prev => [newDraw, ...prev]);
        } else {
             // Manual Mode: Also stack results for visual consistency, but revealed immediately?
             // User said "empile aussi les uns par dessus les autres les tirage du mode manuel"
             const newDraw = { nums: calculatedNums, stars: calculatedStars, date: new Date(), revealed: true };
             setAutoDraws(prev => [newDraw, ...prev]);
        }

        setGeneratedNumbers(calculatedNums);
        setGeneratedStars(calculatedStars);
        
        // NOTE: La sauvegarde des grilles est maintenant gérée par handleSend
        // pour permettre l'envoi groupé de plusieurs grilles à la fois
        
        playSound('jackpot');
        setIsGenerating(false);

    }, 2000);
  };

  const handleReset = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      // 1. Reset Selections
      setSelectedNumbers([]);
      setSelectedStars([]);
      
      // FIX: Only clear stack in Manual Mode. In Auto Mode, user wants to keep history on reset.
      if (mode === 'manual') {
          setAutoDraws([]); 
      }

      setNumberSources({});
      setStarSources({});
      setGeneratedNumbers([]);
      setGeneratedStars([]);
      
      // 2. Reset Weights (Potards) - Numéros
      setWeightHigh(0);
      setWeightMid(0);
      setWeightLow(0);
      setWeightDormeur(0);
      
      // Weights - Étoiles
      setWeightStarHigh(0);
      setWeightStarMid(0);
      setWeightStarLow(0);
      setWeightStarDormeur(0);

      // 3. Reset Tarif (prix de la grille)
      setSelectedTariff(null);
      
      // 4. Reset Chaos et Tendance
      // Chaos à 0 = minimum de chaos (100% statistiques)
      // Tendance à 10 = max influence tendance (bouton à gauche, affiche 10)
      setHazardLevel(0);
      setTendencyLevel(10);
      
      // 5. Reset Email/SMS
      setEmailNotify(false);
      setSmsNotify(false);
      
      // 6. Reset compteurs d'envoi
      setSendCount(0);
      setIsSending(false);
      setSendingMessage("");
      
      // 7. Reset toggles des catégories (Équilibrer)
      setAvoidPairExt(false);
      setBalanceHighLow(false);
      setAvoidPopSeq(false);
      
      // 8. Reset Toggle switches des pondérations
      setHighActive(true);
      setMidActive(true);
      setLowActive(true);
      setDormeurActive(true);
      setHighStarActive(true);
      setMidStarActive(true);
      setLowStarActive(true);
      setDormeurStarActive(true);
      
      // 9. Reset preset sélectionné
      setSelectedPreset(null);
      
      // NOTE: On NE réinitialise PAS les priorités de tri (sortPriority1, sortPriority2, sortPriority3)
      // ni le mode simplifié/classique (isSimplifiedMode) selon la demande de l'utilisateur
      
      // 10. Update Limits
      setMaxWeightLimit(10);
      
      playSound('click');
      toast.success("Réinitialisation complète effectuée (priorités de tri conservées)");
  };

  const handleSend = () => {
      // Vérifier s'il y a des grilles à envoyer
      if (autoDraws.length === 0 && generatedNumbers.length === 0) {
          alert("Veuillez d'abord lancer une recherche.");
          playSound('error');
          return;
      }

      // Pour les invités et abonnés : envoyer par email
      if (isInviteOrAbonne) {
          executeEmailSend();
          return;
      }

      // Pour les admins et VIP : envoi direct en local
      executeSend();
  };

  // Fonction d'envoi par email pour Invite/Abonné
  const executeEmailSend = async () => {
      setIsSending(true);
      
      try {
          // Préparer les grilles à envoyer
          const drawsToSend = autoDraws.length > 0 
              ? autoDraws.map(d => ({ nums: d.nums, stars: d.stars }))
              : [{ nums: generatedNumbers, stars: generatedStars }];
          
          // Appeler l'API pour envoyer l'email
          const response = await fetch('/api/draws/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ draws: drawsToSend }),
          });
          
          const data = await response.json();
          
          if (data.success) {
              playSound('bling');
              setSendingMessage(`📧 EMAIL ENVOYÉ !`);
              toast.success(`Un email vous a été envoyé avec ${drawsToSend.length} grille(s). Vérifiez votre boîte mail !`, {
                  duration: 8000,
              });
              
              // Vider les autoDraws après l'envoi
              setAutoDraws([]);
              setGeneratedNumbers([]);
              setGeneratedStars([]);
              setSendCount(prev => prev + drawsToSend.length);
          } else {
              throw new Error(data.error || 'Erreur envoi');
          }
      } catch (error) {
          console.error('Erreur envoi email:', error);
          playSound('error');
          toast.error("Erreur lors de l'envoi de l'email. Réessayez.");
      } finally {
          setTimeout(() => {
              setIsSending(false);
              setSendingMessage("");
          }, 5000);
      }
  };

  // Fonction d'exécution de l'envoi LOCAL (pour VIP/Admin)
  const executeSend = () => {
      // Set active sending state
      setIsSending(true);
      
      let grillesToSend = 0;
      
      // Sauvegarder TOUTES les grilles de autoDraws
      if (autoDraws.length > 0) {
          autoDraws.forEach((draw) => {
              if (draw.nums.length > 0 && draw.stars.length > 0) {
                  saveGridToHistory(draw.nums, draw.stars);
                  grillesToSend++;
              }
          });
      } else if (generatedNumbers.length > 0 && generatedStars.length > 0) {
          // Fallback: sauvegarder la grille actuelle si pas d'autoDraws
          saveGridToHistory(generatedNumbers, generatedStars);
          grillesToSend = 1;
      }
      
      // Increment count par le nombre de grilles envoyées
      const nextCount = sendCount + grillesToSend;
      setSendCount(nextCount);
      setSendingMessage(`${grillesToSend} GRILLE(S) ENVOYÉE(S)`);
      
      playSound('bling');
      
      // Vider les autoDraws après l'envoi
      setAutoDraws([]);
      setGeneratedNumbers([]);
      setGeneratedStars([]);
      
      toast.success(`${grillesToSend} grille(s) envoyée(s) à "Mes Grilles Jouées" !`);

      // Revert after 5 seconds
      setTimeout(() => {
          setIsSending(false);
          setSendingMessage("");
      }, 5000);
  };

  // Validation CGU et envoi pour les invités (plus utilisé, gardé pour compatibilité)
  const handleCguValidate = () => {
      if (!cguAccepted) {
          playSound('error');
          return;
      }
      setShowCguModal(false);
      executeSend();
  };

  const resetSendCount = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSendCount(0);
      setIsSending(false);
      setSendingMessage("");
      playSound('click');
  };


  const [isRevealed, setIsRevealed] = useState(false);

  const handleReveal = () => {
    if (isInvite && !isRevealed) {
        setIsRevealed(true);
        playSound('bling');
    }
  };

  useEffect(() => {
    // Reset reveal when generating new numbers
    if (isGenerating) {
        setIsRevealed(false);
    }
  }, [isGenerating]);

  return (
    <CasinoLayout>
      {/* Popup Gratitude (VIP/Abonné uniquement) */}
      <GratitudePopup
        isOpen={showGratitudePopup}
        onOpenConsole={handleClosePopup}
        onDontShowAgain={handleDontShowAgain}
        dontShowAgainChecked={dontShowPopupAgain}
      />

      {/* Wrapper for perfect centering */}
      <div className="w-full flex justify-center">
        <div 
          className="p-2 space-y-2" 
          style={{ 
            width: `${referenceWidth}px`,
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top center'
          }}
          onClick={() => { setIsPresetDropdownOpen(false); setIsWeightDropdownOpen(false); setContextMenu(null); setIsPriceGridOpen(false); }}
        >
        
        {/* TITLE MOVED TO TOP */}
        <div className="text-center mt-[20px] mb-[35px]">
            <h2 className="text-4xl md:text-6xl font-orbitron font-bold tracking-[0.2em] uppercase text-shadow-glow rainbow-text-animated">
                CONSOLE EUROMILLION TEST
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

        {/* MODALE CGU - Pour les invités avant l'envoi */}
        {showCguModal && (
            <div 
                className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setShowCguModal(false)}
            >
                <div 
                    className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border-2 border-casino-gold rounded-2xl p-6 max-w-md w-full shadow-[0_0_50px_rgba(255,215,0,0.3)]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Titre */}
                    <h2 className="font-orbitron text-2xl text-casino-gold text-center mb-4 tracking-wider">
                        CONDITIONS D'UTILISATION
                    </h2>
                    
                    {/* Message */}
                    <p className="text-zinc-300 text-center mb-6 font-rajdhani text-lg">
                        Pour envoyer vos grilles, vous devez accepter les Conditions Générales d'Utilisation.
                    </p>
                    
                    {/* Case à cocher CGU */}
                    <div className="bg-black/40 rounded-xl p-4 mb-6 border border-zinc-700">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input 
                                type="checkbox"
                                checked={cguAccepted}
                                onChange={(e) => setCguAccepted(e.target.checked)}
                                className="w-6 h-6 mt-1 accent-casino-gold cursor-pointer"
                            />
                            <span className="text-zinc-300 font-rajdhani text-base group-hover:text-white transition-colors">
                                J'ai lu et j'accepte les{' '}
                                <a 
                                    href="/cgu" 
                                    target="_blank"
                                    className="text-casino-gold underline hover:text-yellow-400"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Conditions Générales d'Utilisation
                                </a>
                            </span>
                        </label>
                    </div>
                    
                    {/* Boutons */}
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => setShowCguModal(false)}
                            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-600 rounded-lg font-rajdhani font-bold transition-all"
                        >
                            ANNULER
                        </button>
                        <button
                            onClick={handleCguValidate}
                            disabled={!cguAccepted}
                            className={cn(
                                "px-6 py-3 rounded-lg font-rajdhani font-bold transition-all",
                                cguAccepted 
                                    ? "bg-casino-gold hover:bg-yellow-500 text-black shadow-[0_0_20px_rgba(255,215,0,0.5)] hover:scale-105"
                                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed opacity-50"
                            )}
                        >
                            VALIDER ET ENVOYER
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* TOP BAR: CONTROL CENTER */}
        <div className="bg-zinc-900 border-b-4 border-casino-gold rounded-t-xl p-2 shadow-2xl relative z-50 mx-auto" style={{ width: `${totalColumnsWidth}px` }}>
             {/* Background Tech Pattern */}
             <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,transparent_25%,#fff_25%,#fff_50%,transparent_50%,transparent_75%,#fff_75%,#fff_100%)] bg-[length:20px_20px] rounded-t-xl" />
             
             {/* Header Grid Layout for Centering */}
             <div className="relative z-10 grid grid-cols-3 gap-4 items-center">
                 
                 {/* LEFT: TITLE */}
                 <div className="flex flex-row items-center gap-8 justify-start">
                     <div className="flex flex-col justify-center items-start">
                         <div className="flex items-center gap-2">
                             <h1 className="text-xl md:text-2xl font-orbitron font-black text-white tracking-widest truncate">
                                 {user?.username}
                             </h1>
                             <span className="text-casino-gold font-orbitron text-sm border border-casino-gold/30 px-1 rounded bg-casino-gold/10">
                                {user?.role.toUpperCase()}
                             </span>
                         </div>
                         
                         {dernierTirage && (
                            <div 
                              className={cn(
                                "flex items-center gap-2 text-lg font-rajdhani mt-0.5 animate-in fade-in slide-in-from-left-2 duration-500",
                                updateNeeded ? "text-red-400 animate-pulse cursor-pointer hover:text-red-300 transition-colors" : "text-zinc-400"
                              )}
                              onClick={updateNeeded ? () => window.location.href = '/history' : undefined}
                              title={updateNeeded ? "Cliquez pour mettre à jour l'historique" : undefined}
                            >
                                <span className="uppercase tracking-wider">DERNIER ({dernierTirage.date && !isNaN(new Date(dernierTirage.date).getTime()) ? format(new Date(dernierTirage.date), 'dd/MM') : dernierTirage.date || '??/??'}):</span>
                                <span className={cn(
                                  "font-mono font-bold tracking-widest",
                                  updateNeeded ? "text-red-300" : "text-white"
                                )}>
                                    {dernierTirage.numeros.join(' ')}
                                </span>
                                <span className={cn(
                                  "font-mono font-bold tracking-widest flex items-center gap-1",
                                  updateNeeded ? "text-red-400" : "text-yellow-500"
                                )}>
                                    <span>★</span>{dernierTirage.etoiles.join(' ')}
                                </span>
                            </div>
                         )}
                     </div>

                     {/* PRICE GRID DROPDOWN - MOVED HERE (LEFT SIDE) */}
                     <div className="relative" ref={priceGridRef}>
                        <div 
                            className="flex flex-col items-center group cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setIsPriceGridOpen(!isPriceGridOpen); }}
                            title="Voir la grille des prix"
                        >
                            <div className="flex items-center gap-3 text-casino-gold font-orbitron font-bold text-xl leading-none shadow-gold-glow">
                                <span>TARIFS</span>
                                <ChevronDown size={18} className={cn("transition-transform", isPriceGridOpen && "rotate-180")} />
                            </div>
                        </div>

                        {isPriceGridOpen && (
                            <div 
                                className="absolute top-full left-0 mt-4 w-[420px] bg-zinc-950 border border-zinc-600 rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.9)] z-[9999] max-h-[80vh] overflow-y-auto custom-scrollbar pointer-events-auto ring-1 ring-white/10"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <div className="p-3 border-b border-zinc-800 bg-zinc-900/95 sticky top-0 backdrop-blur-md z-10">
                                    <div className="text-sm font-bold text-center text-zinc-300 font-rajdhani tracking-widest">COMBINAISONS MULTIPLES</div>
                                </div>
                                <div className="p-1 bg-black/90">
                                    {Object.entries(GRILLE_TARIFAIRE).flatMap(([nums, starPrices]) => 
                                        Object.entries(starPrices).map(([stars, price]) => ({
                                            nums: parseInt(nums),
                                            stars: parseInt(stars),
                                            price: price as number
                                        }))
                                    ).sort((a, b) => a.price - b.price).map((item, idx) => (
                                        <div key={idx} 
                                            className="flex justify-between items-center px-4 py-3 hover:bg-zinc-800/80 active:bg-zinc-700 rounded transition-all border-b border-zinc-800/50 last:border-0 cursor-pointer group"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const { nums, stars } = item;
                                                
                                                setMaxWeightLimit(nums);
                                                setMaxStarWeightLimit(stars);

                                                // UPDATE SELECTED TARIFF STATE
                                                setSelectedTariff({ nums, stars, price: item.price });

                                                // RESET ALL WEIGHT KNOBS TO 0 when tariff changes
                                                setWeightHigh(0); setWeightMid(0); setWeightLow(0); setWeightDormeur(0);
                                                setWeightStarHigh(0); setWeightStarMid(0); setWeightStarLow(0); setWeightStarDormeur(0);

                                                setIsPriceGridOpen(false);
                                                playSound('click');
                                                toast.success(`Limite définie : ${nums} Boules + ${stars} Étoiles`);
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
                 
                 {/* CENTER: MODE ONLY + SOUND */}
                 <div className="flex items-center justify-center gap-[20px] h-full pt-[24px]">
                     
                     {/* WEIGHT PRESET DROPDOWN (TEAL) */}
                     <div className="flex flex-col items-center">
                         <div className="relative flex items-center bg-black border border-teal-700 rounded h-[38px] w-[220px] shadow-[0_0_10px_rgba(20,184,166,0.2)]">
                           {/* Preset Name Display */}
                           <div 
                                className={cn(
                                    "flex-1 px-3 text-2xl font-rajdhani cursor-pointer select-none truncate h-full flex items-center transition-colors",
                                    selectedWeightPreset === "0" ? "text-zinc-500 italic" : "text-teal-400 font-bold"
                                )}
                                onDoubleClick={handleWeightPresetDoubleClick}
                                title={selectedWeightPreset === "0" ? "Pondérations Désactivées" : "Double-clic pour sauver la configuration actuelle"}
                            >
                                {selectedWeightPreset === "0" 
                                    ? "Pondération 0" 
                                    : (weightPresetsData[selectedWeightPreset]?.isSimplified ?? isSimplifiedMode)
                                        ? `Simplifié ${selectedWeightPreset}`
                                        : `Pondération ${selectedWeightPreset}`
                                }
                            </div>
                            
                            {/* Arrow Trigger */}
                            <button 
                                className="h-full px-2 border-l border-teal-900 hover:bg-teal-900/30 text-teal-600 hover:text-teal-400 transition-colors flex items-center justify-center"
                                onClick={(e) => { e.stopPropagation(); setIsWeightDropdownOpen(!isWeightDropdownOpen); }}
                            >
                                <ChevronDown size={18} />
                            </button>

                            {/* Dropdown Menu */}
                            {isWeightDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-black border border-teal-700 rounded shadow-[0_0_20px_rgba(20,184,166,0.3)] z-[100] max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {/* Option 0 - Disabled */}
                                    <div 
                                        className={cn(
                                            "px-4 py-2 text-xl font-rajdhani cursor-pointer hover:bg-zinc-900 transition-colors flex justify-between items-center border-b border-zinc-800",
                                            selectedWeightPreset === "0" && "bg-zinc-900 text-zinc-400 italic"
                                        )}
                                        onClick={() => handleWeightPresetSelect("0")}
                                    >
                                        <span className="text-zinc-500">Pondération 0</span>
                                    </div>
                                    
                                    {/* Options 1-10 */}
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
                                        const presetId = num.toString();
                                        const isSaved = !!weightPresetsData[presetId];
                                        const presetData = weightPresetsData[presetId];
                                        
                                        // Check compatibility with current tariff
                                        let isCompatible = true;
                                        if (isSaved && selectedTariff && presetData) {
                                            const totalNums = presetData.weightHigh + presetData.weightMid + presetData.weightLow + presetData.weightDormeur;
                                            const totalStars = presetData.weightStarHigh + presetData.weightStarMid + presetData.weightStarLow + presetData.weightStarDormeur;
                                            // Compatible if total ≤ tariff (Forbo can complete if less)
                                            isCompatible = totalNums <= selectedTariff.nums && totalStars <= selectedTariff.stars;
                                        }
                                        
                                        const isDisabled = isSaved && !isCompatible;
                                        
                                        return (
                                        <div 
                                            key={num}
                                            className={cn(
                                                    "px-4 py-2 text-xl font-rajdhani transition-colors flex justify-between items-center",
                                                    isDisabled 
                                                        ? "opacity-40 cursor-not-allowed" 
                                                        : "cursor-pointer hover:bg-teal-900/20",
                                                    selectedWeightPreset === presetId && !isDisabled && "bg-teal-900/40 text-teal-400"
                                            )}
                                                onClick={() => !isDisabled && handleWeightPresetSelect(presetId)}
                                                title={isDisabled ? "Incompatible avec le tarif actuel" : ""}
                                        >
                                                <span className={cn(
                                                    isSaved 
                                                        ? (isDisabled ? "text-zinc-600" : "text-teal-400 font-bold") 
                                                        : "text-zinc-400"
                                                )}>
                                                {isSaved && presetData?.isSimplified ? `Simplifié ${num}` : `Pondération ${num}`}
                                            </span>
                                                
                                                <div className="flex items-center gap-2">
                                                    {isSaved ? (
                                                        <>
                                                            {/* Delete button - Red square (always visible to allow deletion) */}
                                                            <button
                                                                onClick={(e) => handleDeleteWeightPreset(presetId, e)}
                                                                className="w-5 h-5 bg-red-600 hover:bg-red-500 rounded flex items-center justify-center transition-colors"
                                                                title="Effacer cette pondération"
                                                            >
                                                                <span className="text-white text-xs font-bold">✕</span>
                                                            </button>
                                                            {/* Saved indicator - Blue or dimmed if incompatible */}
                                                            <span className={cn(
                                                                "text-sm font-bold",
                                                                isDisabled ? "text-zinc-600" : "text-teal-400"
                                                            )}>
                                                                Enregistré
                                                            </span>
                                                        </>
                                                    ) : (
                                                        /* Save button - White */
                                                        <button
                                                            onClick={(e) => handleSaveWeightPreset(presetId, e)}
                                                            className="text-sm text-zinc-400 hover:text-white transition-colors"
                                                        >
                                                            Enregistrer
                                                        </button>
                                                    )}
                                        </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                         </div>
                     </div>

                     <div className="flex items-center gap-2 bg-black px-3 py-1.5 rounded border-0 border-zinc-700 ring-[0.5px] ring-zinc-800/50">
                         <span className={cn(
                             "px-2 py-0.5 rounded text-sm font-bold transition-colors",
                             mode === 'auto' ? "bg-cyan-900/50 text-cyan-400 border border-cyan-400/50" : "text-zinc-600"
                         )}>AUTO</span>
                         
                         <ToggleSwitch 
                             checked={mode === 'manual'} 
                             onChange={(v) => { 
                                 if (v === true && !canUseManual) {
                                     // Prevent manual if not allowed
                                     toast.error("Mode Manuel réservé aux membres VIP");
                                     return;
                                 }
                                 
                                 if (false) {
                                    // Handle Pure mode
                                 }
                                 
                                 setMode(v ? 'manual' : 'auto'); 
                                 playSound('toggle'); 
                             }} 
                             className="scale-75 -rotate-90 mx-2"
                         />
                         
                         <span className={cn(
                             "px-2 py-0.5 rounded text-lg font-bold transition-colors",
                             mode === 'manual' ? "bg-amber-900/50 text-amber-500 border border-amber-500/50" : "text-zinc-600"
                         )}>MANUEL</span>
                     </div>

                     {/* SOUND TOGGLE MOVED HERE */}
                     <button 
                        onClick={() => setSoundEnabled(!soundEnabled)} 
                        className={cn(
                            "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors text-lg flex-shrink-0",
                            soundEnabled ? "bg-green-900/50 border-green-500 text-green-500" : "bg-red-900/50 border-red-500 text-red-500"
                        )}
                        title={soundEnabled ? "Son activé" : "Son désactivé"}
                     >
                        {soundEnabled ? "♪" : "×"}
                     </button>

                     {/* ADMIN CONTROL BUTTON - Round with wrench icon */}
                     {user?.role === 'admin' && (
                         <button 
                             onClick={() => setIsDebugOpen(true)}
                             className="w-11 h-11 rounded-full border-2 border-[#d4af37] bg-[linear-gradient(180deg,#2a2a2a_0%,#1a1a1a_100%)] text-[#d4af37] hover:bg-[linear-gradient(180deg,#3a3a3a_0%,#2a2a2a_100%)] hover:border-[#ffd700] hover:shadow-[0_0_10px_rgba(212,175,55,0.5)] transition-all duration-300 flex items-center justify-center flex-shrink-0"
                             title="Panneau de contrôle"
                         >
                             <Wrench size={20} />
                         </button>
                     )}
                     
                 </div>

                 {/* RIGHT: CONTROL, DATE & PRESET */}
                 <div className="flex items-center gap-3 justify-end">
                     
                     {/* TRASH MOVED TO BOTTOM */}

                     <div className="flex flex-col items-end">
                     
                     <div className="flex flex-col items-end mr-2">
                         <label className="text-[10px] text-zinc-500 uppercase mb-0.5 tracking-wider font-bold">PROCHAIN TIRAGE</label>
                         <div className="text-casino-gold font-orbitron font-bold text-lg leading-none text-right shadow-gold-glow flex items-center gap-2">
                             <span className="uppercase">
                                {prochainTirage ? `${prochainTirage.jour} ${format(prochainTirage.date, 'd MMMM yyyy', { locale: frLocale })}`.toUpperCase() : '-- --'}
                             </span>
                         </div>
                     </div>
                     </div>
                     
                     {/* CUSTOM RÉGLAGE SELECTOR - White style - Same height as Pondération */}
                     <div className="flex flex-col items-center pt-[24px]">
                         <div className="relative flex items-center bg-black border border-white/70 rounded h-[38px] w-[190px] shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                            {/* Réglage Name Display */}
                            <div 
                                className={cn(
                                    "flex-1 px-3 text-2xl font-rajdhani cursor-pointer select-none truncate h-full flex items-center transition-colors",
                                    presetHasData[selectedPreset] ? "text-white font-bold" : "text-zinc-400"
                                )}
                                onClick={(e) => { e.stopPropagation(); setIsPresetDropdownOpen(!isPresetDropdownOpen); }}
                                title="Cliquer pour ouvrir le menu"
                            >
                                Réglage {selectedPreset}
                            </div>
                            
                            {/* Arrow Trigger */}
                            <button 
                                className="h-full px-2 border-l border-white/30 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                                onClick={(e) => { e.stopPropagation(); setIsPresetDropdownOpen(!isPresetDropdownOpen); }}
                            >
                                <ChevronDown size={18} />
                            </button>

                            {/* Dropdown Menu */}
                            {isPresetDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-black border border-white/50 rounded shadow-[0_0_20px_rgba(255,255,255,0.2)] z-[100] max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {[0, 1, 2, 3, 4, 5].map(num => {
                                        const presetId = num.toString();
                                        const isSaved = !!presetHasData[presetId];
                                        const isPreset0 = presetId === "0";
                                        
                                        return (
                                        <div 
                                            key={num}
                                            className={cn(
                                                    "px-4 py-2 text-xl font-rajdhani cursor-pointer hover:bg-white/10 transition-colors flex justify-between items-center",
                                                    selectedPreset === presetId && "bg-white/20 text-white",
                                                    isPreset0 && "text-zinc-500 italic"
                                            )}
                                                onClick={() => handleLoadPreset(presetId)}
                                        >
                                                <span className={isPreset0 ? "text-zinc-500 italic" : (isSaved ? "text-white font-bold" : "text-zinc-400")}>
                                                    Réglage {num} {isPreset0 && "(Réinitialisation)"}
                                            </span>
                                                
                                                <div className="flex items-center gap-2">
                                                    {isPreset0 ? (
                                                        <span className="text-xs text-zinc-500 italic">Non sauvegardable</span>
                                                    ) : isSaved ? (
                                                        <>
                                                            {/* Delete button - Red square */}
                                                            <button
                                                                onClick={(e) => handleDeletePreset(presetId, e)}
                                                                className="w-5 h-5 bg-red-600 hover:bg-red-500 rounded flex items-center justify-center transition-colors"
                                                                title="Effacer ce réglage"
                                                            >
                                                                <span className="text-white text-xs font-bold">✕</span>
                                                            </button>
                                                            {/* Saved indicator - White */}
                                                            <span className="text-sm text-white font-bold">
                                                                Enregistré
                                                            </span>
                                                        </>
                                                    ) : (
                                                        /* Save button */
                                                        <button
                                                            onClick={(e) => handleSavePreset(presetId, e)}
                                                            className="text-sm text-zinc-400 hover:text-white transition-colors"
                                                        >
                                                            Enregistrer
                                                        </button>
                                                    )}
                                        </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                         </div>
                     </div>
                 </div>
             </div>
        </div>

        {/* MAIN COCKPIT GRID */}
        <div className="flex flex-row relative items-stretch mx-auto" style={{ width: `${totalColumnsWidth}px`, gap: `${columnGap}px` }}>

            {/* LEFT: NUMBERS CONFIG - RESSERRÉ ET CORRIGÉ */}
            <div className={cn("flex-none flex flex-col gap-2", mode === 'auto' && "justify-end")} style={{ width: `${leftColumnWidth}px` }}>
                {mode === 'manual' && (
                    <SectionPanel 
                        title={
                            isSimplifiedMode ? (
                                <span className="flex items-center justify-center w-full gap-3">
                                    <span className="flex-1 text-center">Boules de 1 à 50</span>
                                    <button
                                        className={cn(
                                            "px-3 py-1 text-sm font-bold rounded transition-colors",
                                            simplifiedSortOrder === 'numeric' 
                                                ? "bg-white text-black hover:bg-zinc-200" 
                                                : simplifiedSortOrder === 'frequency' 
                                                    ? "bg-green-600 text-white hover:bg-green-500" 
                                                    : simplifiedSortOrder === 'trend'
                                                        ? "bg-red-600 text-white hover:bg-red-500"
                                                        : "bg-blue-600 text-white hover:bg-blue-500"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSimplifiedSortOrder(prev => 
                                                prev === 'numeric' ? 'frequency' : 
                                                prev === 'frequency' ? 'trend' :
                                                prev === 'trend' ? 'dormeur' : 'numeric'
                                            );
                                            playSound('click');
                                        }}
                                    >
                                        {simplifiedSortOrder === 'numeric' ? 'Numéros' : 
                                         simplifiedSortOrder === 'frequency' ? 'Fréquences' : 
                                         simplifiedSortOrder === 'trend' ? 'Tendance' : 'Dormeurs'}
                                    </button>
                                </span>
                            ) : "CONFIGURATION BOULES (1-50)"
                        }
                        disabled={!canUseManual} 
                        className="flex flex-col p-[10px]" 
                        ledActive={highFreqActive || midFreqActive || lowFreqActive}
                    >
                        <div className="flex-1 flex flex-col justify-start">
                        {/* Row 1: High Freq (classic) or Balls 1-13 (simplified) */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            {!isSimplifiedMode && (
                                <>
                                    <ToggleSwitch checked={highFreqActive} onChange={v => { setHighFreqActive(v); playSound('toggle'); }} className="scale-75 origin-left flex-shrink-0 mr-4" />
                                    <div className="flex-shrink-0 w-48">
                                        <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE ÉLEVÉE</div>
                                        <div className="text-sm text-casino-gold">TOP 10 • Tendance ↑</div>
                                    </div>
                                </>
                            )}
                            {mode === 'manual' && (isSimplifiedMode || highFreqActive) && (
                                <div className={cn("flex-1 flex justify-start", !isSimplifiedMode && "ml-2")}>
                                    <BallGrid 
                                        stats={isSimplifiedMode ? getSimplifiedBallStats(simplifiedSortOrder).slice(0, 13) : highFreqStats} 
                                        countLimit={isSimplifiedMode ? 13 : 10} 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category={isSimplifiedMode ? undefined : "high"}
                                        onToggle={toggleSelection}
                                        className={isSimplifiedMode ? "py-0 justify-between w-full" : "py-0 justify-start gap-[4px]"}
                                        resolveCategory={isSimplifiedMode ? undefined : resolveCategory}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Row 2: Mid Freq (classic) or Balls 14-26 (simplified) */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            {!isSimplifiedMode && (
                                <>
                                    <ToggleSwitch checked={midFreqActive} onChange={v => { setMidFreqActive(v); playSound('toggle'); }} activeColor="bg-yellow-500" className="scale-75 origin-left flex-shrink-0 mr-4" />
                                    <div className="flex-shrink-0 w-48">
                                        <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE MOYENNE</div>
                                        <div className="text-sm text-yellow-500">MOYENNE 10 • Stable →</div>
                                    </div>
                                </>
                            )}
                            {mode === 'manual' && (isSimplifiedMode || midFreqActive) && (
                                <div className={cn("flex-1 flex justify-start", !isSimplifiedMode && "ml-2")}>
                                    <BallGrid 
                                        stats={isSimplifiedMode ? getSimplifiedBallStats(simplifiedSortOrder).slice(13, 26) : midFreqStats} 
                                        countLimit={isSimplifiedMode ? 13 : 10} 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category={isSimplifiedMode ? undefined : "mid"}
                                        onToggle={toggleSelection}
                                        className={isSimplifiedMode ? "py-0 justify-between w-full" : "py-0 justify-start gap-[4px]"}
                                        resolveCategory={isSimplifiedMode ? undefined : resolveCategory}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Row 3: Low Freq (classic) or Balls 27-39 (simplified) */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            {!isSimplifiedMode && (
                                <>
                                    <ToggleSwitch checked={lowFreqActive} onChange={v => { setLowFreqActive(v); playSound('toggle'); }} activeColor="bg-blue-500" className="scale-75 origin-left flex-shrink-0 mr-4" />
                                    <div className="flex-shrink-0 w-48">
                                        <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE BASSE</div>
                                        <div className="text-sm text-blue-500">BASSE 10 • Dette Max</div>
                                    </div>
                                </>
                            )}
                            {mode === 'manual' && (isSimplifiedMode || lowFreqActive) && (
                                <div className={cn("flex-1 flex justify-start", !isSimplifiedMode && "ml-2")}>
                                    <BallGrid 
                                        stats={isSimplifiedMode ? getSimplifiedBallStats(simplifiedSortOrder).slice(26, 39) : lowFreqStats} 
                                        countLimit={isSimplifiedMode ? 13 : 10} 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category={isSimplifiedMode ? undefined : "low"}
                                        onToggle={toggleSelection}
                                        className={isSimplifiedMode ? "py-0 justify-between w-full" : "py-0 justify-start gap-[4px]"}
                                        resolveCategory={isSimplifiedMode ? undefined : resolveCategory}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Row 4: Dormeur (classic) or Balls 40-50 (simplified) */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            {!isSimplifiedMode && (
                                <>
                                    <ToggleSwitch checked={true} onChange={v => { playSound('toggle'); }} activeColor="bg-zinc-400" className="scale-75 origin-left flex-shrink-0 mr-4" />
                                    <div className="flex-shrink-0 w-48">
                                        <div className="text-lg font-bold text-white mb-0.5">DORMEUR</div>
                                        <div className="text-sm text-zinc-400">TOP 10 • Absence</div>
                                    </div>
                                </>
                            )}
                            {mode === 'manual' && (
                                <div className={cn("flex-1 flex justify-start", !isSimplifiedMode && "ml-2")}>
                                    <BallGrid 
                                        stats={isSimplifiedMode 
                                            ? [
                                                ...getSimplifiedBallStats(simplifiedSortOrder).slice(39, 50),
                                                // Add 2 invisible placeholders to maintain spacing like 13 balls
                                                { number: -1, frequency: 0, trendScore: 0, trendDirection: 'stable' as const },
                                                { number: -2, frequency: 0, trendScore: 0, trendDirection: 'stable' as const }
                                              ]
                                            : dormeurStats
                                        } 
                                        countLimit={isSimplifiedMode ? 13 : 10} 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category={isSimplifiedMode ? undefined : "dormeur"}
                                        onToggle={toggleSelection}
                                        className={isSimplifiedMode ? "py-0 justify-between w-full" : "py-0 justify-start gap-[4px]"}
                                        resolveCategory={isSimplifiedMode ? undefined : resolveCategory}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </SectionPanel>
                )}

                <SectionPanel 
                    title={
                        <span className="flex items-center gap-4">
                            <span>{isSimplifiedMode ? "Pondérations Boules et Étoiles" : "Pondération Boules"} / <span className={isSimplifiedMode ? "font-bold text-teal-400" : "text-zinc-500 font-normal"}>Simplifié</span></span>
                            <div 
                                className="w-10 h-5 bg-zinc-800 rounded-full cursor-pointer relative border border-zinc-600 flex-shrink-0"
                                onClick={() => { setIsSimplifiedMode(!isSimplifiedMode); playSound('toggle'); }}
                            >
                                <div className={cn(
                                    "absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 shadow",
                                    isSimplifiedMode 
                                        ? "left-5 bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.6)]" 
                                        : "left-0.5 bg-zinc-500"
                                )} />
                            </div>
                        </span>
                    }
                    disabled={!isWeightsEnabled}
                    className="h-[200px]"
                >
                    {isSimplifiedMode ? (
                        /* Mode simplifié : Priorités + Boutons rotatifs avec espacement égal */
                        <div className="flex items-center justify-evenly py-2">
                            {/* Cadre Priorités de tri */}
                            <div className="w-64 bg-black/30 rounded-lg border border-zinc-700 p-4">
                                <div className="text-sm font-bold text-zinc-400 mb-3 text-center">PRIORITÉS DE TRI</div>
                                <div className="flex flex-col gap-2">
                                    {/* Ligne Fréquence - VERT */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-base font-semibold text-zinc-300">Fréquence</span>
                                        <div className="flex gap-2">
                                            {[1, 2, 3].map(priority => (
                                                <button
                                                    key={`freq-${priority}`}
                                                    onClick={() => {
                                                        playSound('click');
                                                        const oldPriority = sortPriority1 === 'frequency' ? 1 : sortPriority2 === 'frequency' ? 2 : 3;
                                                        if (priority === 1) {
                                                            const current = sortPriority1;
                                                            setSortPriority1('frequency');
                                                            if (oldPriority === 2) setSortPriority2(current);
                                                            else if (oldPriority === 3) setSortPriority3(current);
                                                        } else if (priority === 2) {
                                                            const current = sortPriority2;
                                                            setSortPriority2('frequency');
                                                            if (oldPriority === 1) setSortPriority1(current);
                                                            else if (oldPriority === 3) setSortPriority3(current);
                                                        } else {
                                                            const current = sortPriority3;
                                                            setSortPriority3('frequency');
                                                            if (oldPriority === 1) setSortPriority1(current);
                                                            else if (oldPriority === 2) setSortPriority2(current);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "w-7 h-7 rounded-full text-sm font-bold transition-all",
                                                        (priority === 1 && sortPriority1 === 'frequency') ||
                                                        (priority === 2 && sortPriority2 === 'frequency') ||
                                                        (priority === 3 && sortPriority3 === 'frequency')
                                                            ? "bg-green-500 text-white shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                                                            : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                                                    )}
                                                >
                                                    {priority}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Ligne Tendance - ROUGE */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-base font-semibold text-zinc-300">Tendance</span>
                                        <div className="flex gap-2">
                                            {[1, 2, 3].map(priority => (
                                                <button
                                                    key={`trend-${priority}`}
                                                    onClick={() => {
                                                        playSound('click');
                                                        const oldPriority = sortPriority1 === 'trend' ? 1 : sortPriority2 === 'trend' ? 2 : 3;
                                                        if (priority === 1) {
                                                            const current = sortPriority1;
                                                            setSortPriority1('trend');
                                                            if (oldPriority === 2) setSortPriority2(current);
                                                            else if (oldPriority === 3) setSortPriority3(current);
                                                        } else if (priority === 2) {
                                                            const current = sortPriority2;
                                                            setSortPriority2('trend');
                                                            if (oldPriority === 1) setSortPriority1(current);
                                                            else if (oldPriority === 3) setSortPriority3(current);
                                                        } else {
                                                            const current = sortPriority3;
                                                            setSortPriority3('trend');
                                                            if (oldPriority === 1) setSortPriority1(current);
                                                            else if (oldPriority === 2) setSortPriority2(current);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "w-7 h-7 rounded-full text-sm font-bold transition-all",
                                                        (priority === 1 && sortPriority1 === 'trend') ||
                                                        (priority === 2 && sortPriority2 === 'trend') ||
                                                        (priority === 3 && sortPriority3 === 'trend')
                                                            ? "bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                                                            : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                                                    )}
                                                >
                                                    {priority}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Ligne Dormeur - BLEU */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-base font-semibold text-zinc-300">Dormeur</span>
                                        <div className="flex gap-2">
                                            {[1, 2, 3].map(priority => (
                                                <button
                                                    key={`dormeur-${priority}`}
                                                    onClick={() => {
                                                        playSound('click');
                                                        const oldPriority = sortPriority1 === 'dormeur' ? 1 : sortPriority2 === 'dormeur' ? 2 : 3;
                                                        if (priority === 1) {
                                                            const current = sortPriority1;
                                                            setSortPriority1('dormeur');
                                                            if (oldPriority === 2) setSortPriority2(current);
                                                            else if (oldPriority === 3) setSortPriority3(current);
                                                        } else if (priority === 2) {
                                                            const current = sortPriority2;
                                                            setSortPriority2('dormeur');
                                                            if (oldPriority === 1) setSortPriority1(current);
                                                            else if (oldPriority === 3) setSortPriority3(current);
                                                        } else {
                                                            const current = sortPriority3;
                                                            setSortPriority3('dormeur');
                                                            if (oldPriority === 1) setSortPriority1(current);
                                                            else if (oldPriority === 2) setSortPriority2(current);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "w-7 h-7 rounded-full text-sm font-bold transition-all",
                                                        (priority === 1 && sortPriority1 === 'dormeur') ||
                                                        (priority === 2 && sortPriority2 === 'dormeur') ||
                                                        (priority === 3 && sortPriority3 === 'dormeur')
                                                            ? "bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                                                            : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                                                    )}
                                                >
                                                    {priority}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Bouton rotatif ÉLEVÉE - bloqué à 0 si CHAOS = 0 */}
                            <RotaryKnob label="ÉLEVÉE" value={hazardLevel === 0 ? 0 : weightHigh} onChange={(v) => { userModifiedRef.current = true; if(checkWeightLimit(v, weightHigh, weightMid, weightLow, weightDormeur)) setWeightHigh(v); }} max={10} labelClassName="text-xs font-bold" size="xl" disabled={hazardLevel === 0} />
                            
                            {/* Bouton rotatif DORMEUR - bloqué à 0 si CHAOS = 0 */}
                            <RotaryKnob label="DORMEUR" value={hazardLevel === 0 ? 0 : weightDormeur} onChange={(v) => { userModifiedRef.current = true; if(checkWeightLimit(v, weightDormeur, weightHigh, weightMid, weightLow)) setWeightDormeur(v); }} max={10} labelClassName="text-xs font-bold" size="xl" disabled={hazardLevel === 0} />
                        </div>
                    ) : (
                        /* Mode classique : 4 boutons rotatifs - 15px above center */
                        <div className="flex justify-between items-center py-2 px-8 h-full -mt-[15px]">
                            <RotaryKnob label="ÉLEVÉE" value={hazardLevel === 0 ? 0 : weightHigh} onChange={(v) => { userModifiedRef.current = true; if(checkWeightLimit(v, weightHigh, weightMid, weightLow, weightDormeur)) setWeightHigh(v); }} max={10} labelClassName="text-xs font-bold" size="xl" disabled={hazardLevel === 0} />
                            <RotaryKnob label="MOYENNE" value={weightMid} onChange={(v) => { userModifiedRef.current = true; if(checkWeightLimit(v, weightMid, weightHigh, weightLow, weightDormeur)) setWeightMid(v); }} max={10} labelClassName="text-xs font-bold" size="xl" />
                            <RotaryKnob label="BASSE" value={weightLow} onChange={(v) => { userModifiedRef.current = true; if(checkWeightLimit(v, weightLow, weightHigh, weightMid, weightDormeur)) setWeightLow(v); }} max={10} labelClassName="text-xs font-bold" size="xl" />
                            <RotaryKnob label="DORMEUR" value={hazardLevel === 0 ? 0 : weightDormeur} onChange={(v) => { userModifiedRef.current = true; if(checkWeightLimit(v, weightDormeur, weightHigh, weightMid, weightLow)) setWeightDormeur(v); }} max={10} labelClassName="text-xs font-bold" size="xl" disabled={hazardLevel === 0} />
                        </div>
                    )}
                </SectionPanel>
            </div>

            {/* CENTER: DASHBOARD / OPTIONS */}
            <div className="w-[280px] flex flex-col gap-2 flex-shrink-0">
                 {/* OPTIONS PANEL - hauteur fixe pour stabilité */}
                 <div className="bg-[#111] border-2 border-zinc-800 rounded-xl p-2 flex flex-col items-center justify-start gap-2 shadow-inner relative overflow-hidden h-[465px] flex-shrink-0">
                     <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-black to-black pointer-events-none" />
                     
                     <div className="w-full space-y-1 relative z-10 pt-1">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1 mb-1">
                             <div className="text-center font-orbitron text-lg text-zinc-500 flex-1">EQUILIBRER</div>
                             <LEDIndicator active={avoidPairExt || balanceHighLow || avoidPopSeq} color="green" />
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-lg font-rajdhani text-zinc-300 truncate mr-2">NO PAIR/IMPAIR</span>
                            <ToggleSwitch checked={avoidPairExt} onChange={v => { setAvoidPairExt(v); playSound('toggle'); }} className="scale-75 origin-right flex-shrink-0" />
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-lg font-rajdhani text-zinc-300 truncate mr-2">ÉQUILIBRE H/B</span>
                            <ToggleSwitch checked={balanceHighLow} onChange={v => { setBalanceHighLow(v); playSound('toggle'); }} className="scale-75 origin-right flex-shrink-0" />
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <span className="text-lg font-rajdhani text-zinc-300 leading-none mr-2">PAS DE SÉQUENCE<br/>POPULAIRE</span>
                            <ToggleSwitch checked={avoidPopSeq} onChange={v => { setAvoidPopSeq(v); playSound('toggle'); }} className="scale-75 origin-right flex-shrink-0" activeColor="bg-red-500" />
                        </div>
                     </div>

                     <div className="w-full h-px bg-zinc-800 my-1" />

                     {/* HAZARD CONTROL */}
                     <div className="w-full space-y-2 relative z-10 flex flex-col items-center h-[178px] flex-shrink-0 justify-center -mt-[10px] pb-3">
                        <div className="flex flex-col w-full mb-1 items-center justify-center relative h-[60px]">
                            {/* Top Line */}
                            <div className="w-full h-px bg-zinc-800 absolute top-2" />
                            
                            {/* Title + LED Container */}
                            <div className="flex items-center justify-center w-full z-10 px-4 bg-[#111]">
                                <div className="text-center font-rajdhani font-bold tracking-widest text-[28px] text-amber-500 text-shadow-glow mx-auto">
                                    STATISTIQUE
                                </div>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <LEDIndicator active={hazardLevel > 0} color="purple" />
                                </div>
                            </div>

                            {/* Bottom Line */}
                            <div className="w-full h-px bg-zinc-800 absolute bottom-2" />
                        </div>
                        
                        <div className="flex items-start justify-center gap-2 mt-4 w-full px-2">
                            {/* CHAOS Knob (Moved to Left) */}
                            <div className="flex flex-col items-center gap-4 w-[110px]">
                                <div className="h-6 flex items-center justify-center w-full text-center relative">
                                     <span className="text-white font-rajdhani font-bold text-lg uppercase tracking-wider">
                                        CHAOS
                                    </span>
                                </div>
                                
                                <div className="h-[60px] flex items-center justify-center">
                                    <RotaryKnob 
                                        label="" 
                                        value={hazardLevel} 
                                        onChange={(v) => { setHazardLevel(v); playSound('knob'); }} 
                                        max={10} 
                                        size="xl"
                                        knobColor="border-amber-700 shadow-[0_0_15px_rgba(180,83,9,0.3)] bg-zinc-900"
                                        indicatorColor="bg-amber-600"
                                        labelClassName="hidden"
                                        valueClassName="text-amber-500"
                                    />
                                </div>
                            </div>

                            {/* TENDENCES Knob (New on Right) */}
                            <div className="flex flex-col items-center gap-4 w-[110px]">
                                <div className="h-6 flex items-center justify-center w-full text-center relative">
                                     <span className="text-white font-rajdhani font-bold text-lg uppercase tracking-wider">
                                        TENDENCES
                                    </span>
                                </div>
                                
                                <div className="h-[60px] flex items-center justify-center">
                                    <RotaryKnob 
                                        label="" 
                                        value={10 - tendencyLevel} 
                                        onChange={(v) => { setTendencyLevel(10 - v); playSound('knob'); }} 
                                        max={10} 
                                        size="xl"
                                        knobColor="border-red-700 shadow-[0_0_15px_rgba(220,38,38,0.3)] bg-zinc-900"
                                        indicatorColor="bg-red-600"
                                        labelClassName="hidden"
                                        valueClassName="text-red-500"
                                        displayTransformer={(v) => 10 - v}
                                    />
                                </div>
                            </div>
                        </div>
                     </div>
                 </div>

                 {/* PRICE RACK (NEW) - Fixed height to prevent footer movement */}
                 <SectionPanel title="PRIX DE LA GRILLE" className="h-[180px] flex flex-col justify-center items-center" showLed={false}>
                    <div className="flex flex-col items-center justify-center w-full gap-0.5">
                        <div className="text-white font-rajdhani font-black text-xl tracking-wide">
                            {displayNumCount} Numéros + {displayStarCount} Étoiles
                        </div>
                        <div className={cn(
                            "font-bold font-lcd flex items-center gap-2",
                            currentPrice === 0 
                                ? "text-5xl text-white animate-pulse drop-shadow-[0_0_20px_rgba(255,255,255,1)] shadow-white" 
                                : "text-3xl text-casino-gold text-shadow-glow"
                        )}>
                            <span className={currentPrice === 0 ? "animate-[pulse_0.8s_ease-in-out_infinite] drop-shadow-[0_0_30px_rgba(255,255,255,0.9)]" : ""}>
                                {currentPrice.toFixed(2)} €
                            </span>
                            
                            {/* RESET BUTTON */}
                            <div 
                                onClick={handleReset}
                                className="cursor-pointer transition-transform hover:scale-110 ml-2"
                                title="Réinitialiser tous les réglages (sauf priorités de tri)"
                            >
                                <RefreshCcw size={24} className="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] hover:text-red-400 transition-colors" />
                            </div>
                        </div>
                    </div>
                 </SectionPanel>
            </div>

            {/* RIGHT: STARS CONFIG - ÉLARGI */}
            <div className="flex-none flex flex-col gap-2 justify-end" style={{ width: `${rightColumnWidth}px` }}>
                {mode === 'manual' && (
                <SectionPanel 
                    title={
                        isSimplifiedMode ? (
                            <span className="flex items-center justify-center w-full">
                                <span className="text-center">Étoiles de 1 à 12 <span className="text-yellow-400 ml-2 text-xl align-middle">★</span></span>
                            </span>
                        ) : (
                            <>CONFIGURATION ÉTOILES (1-12) <span className="text-yellow-400 ml-3 text-xl align-middle">★</span></>
                        )
                    }
                    disabled={!canUseManual} 
                    className="flex flex-col p-[10px]" 
                    ledActive={highStarActive || midStarActive || lowStarActive || dormeurStarActive}
                >
                     <div className="flex flex-col justify-start">
                        {/* Row 1: High Star (classic) or Stars 1-6 (simplified) */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            {!isSimplifiedMode && (
                                <>
                                    <ToggleSwitch checked={highStarActive} onChange={v => { setHighStarActive(v); playSound('toggle'); }} activeColor="bg-purple-500" className="scale-75 origin-left flex-shrink-0 mr-4" />
                                    <div className="flex-shrink-0 w-48">
                                        <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE ÉLEVÉE</div>
                                        <div className="text-sm text-purple-400">TOP 12</div>
                                    </div>
                                </>
                            )}
                            {mode === 'manual' && (isSimplifiedMode || highStarActive) && (
                                <div className={cn("flex-1 flex justify-start", !isSimplifiedMode && "ml-2")}>
                                    <BallGrid 
                                        stats={isSimplifiedMode ? getSimplifiedStarStats(simplifiedSortOrder).slice(0, 6) : highStarStats} 
                                        countLimit={isSimplifiedMode ? 6 : 12} 
                                        type="star" 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category={isSimplifiedMode ? undefined : "high"}
                                        onToggle={toggleSelection}
                                        className={isSimplifiedMode ? "py-0 justify-evenly w-full" : "py-0 justify-start gap-[4px]"}
                                        resolveCategory={isSimplifiedMode ? undefined : resolveCategory}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Row 2: Mid Star (classic) or Stars 7-12 (simplified) */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            {!isSimplifiedMode && (
                                <>
                                    <ToggleSwitch checked={midStarActive} onChange={v => { setMidStarActive(v); playSound('toggle'); }} activeColor="bg-pink-500" className="scale-75 origin-left flex-shrink-0 mr-4" />
                                    <div className="flex-shrink-0 w-48">
                                        <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE MOYENNE</div>
                                        <div className="text-sm text-pink-400">MOYENNE 12</div>
                                    </div>
                                </>
                            )}
                            {mode === 'manual' && (isSimplifiedMode || midStarActive) && (
                                <div className={cn("flex-1 flex justify-start", !isSimplifiedMode && "ml-2")}>
                                    <BallGrid 
                                        stats={isSimplifiedMode ? getSimplifiedStarStats(simplifiedSortOrder).slice(6, 12) : midStarStats} 
                                        countLimit={isSimplifiedMode ? 6 : 12} 
                                        type="star"
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category={isSimplifiedMode ? undefined : "mid"}
                                        onToggle={toggleSelection}
                                        className={isSimplifiedMode ? "py-0 justify-evenly w-full" : "py-0 justify-start gap-[4px]"}
                                        resolveCategory={isSimplifiedMode ? undefined : resolveCategory}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Row 3: Low Star (classic only - hidden in simplified) */}
                        {!isSimplifiedMode && (
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            <ToggleSwitch checked={lowStarActive} onChange={v => { setLowStarActive(v); playSound('toggle'); }} activeColor="bg-blue-400" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE BASSE</div>
                                <div className="text-sm text-blue-400">BASSE 12</div>
                            </div>
                            {mode === 'manual' && lowStarActive && (
                                <div className="flex-1 flex justify-start ml-2">
                                    <BallGrid 
                                        stats={lowStarStats} 
                                        countLimit={12} 
                                        type="star"
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category="low"
                                        onToggle={toggleSelection}
                                        className="py-0 justify-start gap-[4px]"
                                        resolveCategory={resolveCategory}
                                    />
                                </div>
                            )}
                        </div>
                        )}

                        {/* Row 4: Dormeur Star (classic only - hidden in simplified) */}
                        {!isSimplifiedMode && (
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            <ToggleSwitch checked={dormeurStarActive} onChange={v => { setDormeurStarActive(v); playSound('toggle'); }} activeColor="bg-zinc-400" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">DORMEUR</div>
                                <div className="text-sm text-zinc-400">TOP 12 • Absence</div>
                            </div>
                            {mode === 'manual' && dormeurStarActive && (
                                <div className="flex-1 flex justify-start ml-2">
                                    <BallGrid 
                                        stats={dormeurStarStats} 
                                        countLimit={4} 
                                        type="star"
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category="dormeur"
                                        onToggle={toggleSelection}
                                        className="py-0 justify-start gap-[4px]"
                                        resolveCategory={resolveCategory}
                                    />
                                </div>
                            )}
                        </div>
                        )}
                     </div>
                </SectionPanel>
                )}

                <SectionPanel 
                    title={isSimplifiedMode && mode === 'manual' ? "ACTIONS" : <ProchainTirageSimple />}
                    disabled={false}
                    showLed={false}
                    headerAction={(isSimplifiedMode && mode === 'manual') ? (
                        /* Envois counter in header for simplified mode */
                        <div className="flex items-center gap-1 mr-5">
                            <span className="text-zinc-400 text-lg font-semibold">Envois:</span>
                            <span className="text-casino-gold font-bold text-xl font-mono">{sendCount}</span>
                            {sendCount > 0 && (
                                <button 
                                    onClick={resetSendCount}
                                    className="p-0.5 text-zinc-500 hover:text-white transition-colors"
                                    title="Remettre à zéro"
                                >
                                    <RotateCcw size={12} />
                                </button>
                            )}
                        </div>
                    ) : !(isSimplifiedMode && mode === 'manual') ? (
                        <div className="flex items-center mr-5">
                            {/* Trash - 60px gap to Envois, 1.2x size */}
                            <div className="mr-[60px]">
                                {!showClearConfirm ? (
                                    <button 
                                        onClick={() => setShowClearConfirm(true)}
                                        className="w-6 h-6 flex items-center justify-center bg-red-900/30 border border-red-500/50 rounded text-red-500 hover:bg-red-900/50 hover:text-red-400 transition-all"
                                        title="Effacer l'historique"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-1 bg-black border border-red-500 rounded p-0.5 animate-in fade-in duration-200">
                                        <button 
                                            onClick={() => {
                                                setAutoDraws([]);
                                                setGeneratedNumbers([]);
                                                setGeneratedStars([]);
                                                setShowClearConfirm(false);
                                                playSound('click');
                                                toast.success("Historique effacé");
                                            }}
                                            className="px-1 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[8px] font-bold rounded"
                                        >
                                            OK
                                        </button>
                                        <button 
                                            onClick={() => setShowClearConfirm(false)}
                                            className="px-1 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[8px] font-bold rounded"
                                        >
                                            NON
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* Envois counter - enlarged */}
                            <div className="flex items-center gap-1">
                                <span className="text-zinc-400 text-lg font-semibold">Envois:</span>
                                <span className="text-casino-gold font-bold text-xl font-mono">{sendCount}</span>
                                {sendCount > 0 && (
                                    <button 
                                        onClick={resetSendCount}
                                        className="p-0.5 text-zinc-500 hover:text-white transition-colors"
                                        title="Remettre à zéro"
                                    >
                                        <RotateCcw size={10} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : undefined}
                    className={isSimplifiedMode && mode === 'manual' ? "h-[395px]" : "h-[200px]"}
                >
                    {isSimplifiedMode && mode === 'manual' ? (
                        /* Simplified mode: Actions panel with Search/Validate/Email/SMS */
                        <div className="flex flex-col h-full p-3">
                            {/* Row 1: Bouton ENVOYER - centered at top, 20px from title */}
                            <div className="flex flex-col items-center mt-5">
                                <CasinoButton 
                                    variant={autoDraws.length === 0 ? "danger" : "primary"}
                                    size="lg"
                                    className={cn(
                                        "px-8 py-3 text-lg font-bold min-w-[180px]",
                                        autoDraws.length === 0 
                                            ? "opacity-50 cursor-not-allowed" 
                                            : "animate-pulse bg-green-900 border-green-500 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                                    )}
                                    onClick={handleSend}
                                    disabled={autoDraws.length === 0}
                                >
                                    {isSending ? "..." : (
                                        <span className={autoDraws.length === 0 ? "text-red-500" : "text-green-400"}>
                                            ENVOYER
                                        </span>
                                    )}
                                </CasinoButton>
                                
                                {/* Trash button - below Email/SMS/Send, 50px gap */}
                                {!showClearConfirm ? (
                                    <button 
                                        onClick={() => setShowClearConfirm(true)}
                                        className="w-10 h-10 flex items-center justify-center bg-red-900/30 border border-red-500/50 rounded-lg text-red-500 hover:bg-red-900/50 hover:text-red-400 hover:border-red-400 transition-all mt-[50px]"
                                        title="Effacer l'historique"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 bg-black border border-red-500 rounded-lg p-2 animate-in fade-in duration-200 mt-[50px]">
                                        <button 
                                            onClick={() => {
                                                setAutoDraws([]);
                                                setGeneratedNumbers([]);
                                                setGeneratedStars([]);
                                                setShowClearConfirm(false);
                                                playSound('click');
                                                toast.success("Historique effacé");
                                            }}
                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded"
                                        >
                                            OK
                                        </button>
                                        <button 
                                            onClick={() => setShowClearConfirm(false)}
                                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-bold rounded"
                                        >
                                            NON
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {/* Center group: ProchainTirageSimple + Buttons - moved up 40px toward trash */}
                            <div className="flex-1 flex flex-col items-center justify-center gap-2 -mt-10">
                                {/* ProchainTirageSimple as title for the buttons */}
                                <ProchainTirageSimple />
                                
                                {/* Search/Validate buttons */}
                                <div className="flex items-center justify-center">
                                <div className={cn(
                                    "flex items-center rounded-xl overflow-hidden",
                                    currentPrice === 0 
                                        ? "animate-pulse shadow-[0_0_18px_rgba(255,0,0,0.7)]" 
                                        : "shadow-[0_0_18px_rgba(255,215,0,0.4)]"
                                )}>
                                    <CasinoButton 
                                        size="lg" 
                                        variant={!selectedTariff ? "danger" : "primary"}
                                        className="text-base px-6 py-4 rounded-none border-r border-black/20 w-[170px] flex items-center justify-center"
                                        onClick={() => {
                                            if (!selectedTariff) {
                                                playSound('error');
                                                return;
                                            }
                                            handleGenerate('auto');
                                        }} 
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? "..." : (
                                            (weightHigh > 0 || weightMid > 0 || weightLow > 0 || weightDormeur > 0)
                                                ? <span className="text-red-500 font-bold text-center leading-tight text-sm">RECHERCHE<br/>PONDÉRÉE</span>
                                                : "RECHERCHER"
                                        )}
                                    </CasinoButton>
                                    <CasinoButton 
                                        size="lg" 
                                        variant={(!selectedTariff || selectedNumbers.length !== selectedTariff?.nums || selectedStars.length !== selectedTariff?.stars) ? "danger" : "primary"}
                                        className={cn(
                                            "text-base px-6 py-4 rounded-none w-[170px] flex items-center justify-center",
                                            (!selectedTariff || selectedNumbers.length !== selectedTariff?.nums || selectedStars.length !== selectedTariff?.stars)
                                                ? "bg-gradient-to-b from-red-600 to-red-900 border-red-500 cursor-not-allowed"
                                                : "bg-gradient-to-b from-green-600 to-green-900 border-green-500 text-white hover:from-green-500 hover:to-green-800"
                                        )}
                                        onClick={() => {
                                            if (!selectedTariff || selectedNumbers.length !== selectedTariff?.nums || selectedStars.length !== selectedTariff?.stars) {
                                                playSound('error');
                                                return;
                                            }
                                            handleGenerate('manual');
                                        }}
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? "..." : "VALIDER"}
                                    </CasinoButton>
                                </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Classic mode: Actions panel - Search/Validate left (stacked), Email/SMS/Send right - 20px above center */
                        <div className="flex items-center justify-center h-full px-3 py-2 gap-4 -mt-[20px]">
                            {/* Left: Search/Validate buttons - stacked vertically, fixed height container */}
                            <div className="flex flex-col gap-[10px] justify-center">
                                <CasinoButton 
                                    size="md" 
                                    variant={!selectedTariff ? "danger" : "primary"}
                                    className={cn(
                                        "text-sm px-4 py-[7px] w-[131px] flex items-center justify-center rounded-lg",
                                        currentPrice === 0 
                                            ? "animate-pulse shadow-[0_0_12px_rgba(255,0,0,0.5)]" 
                                            : "shadow-[0_0_12px_rgba(255,215,0,0.2)]"
                                    )}
                                    onClick={() => {
                                        if (!selectedTariff) {
                                            playSound('error');
                                            return;
                                        }
                                        handleGenerate(mode === 'manual' ? 'auto' : undefined);
                                    }} 
                                    disabled={isGenerating}
                                >
                                    {isGenerating ? "..." : (
                                        (weightHigh > 0 || weightMid > 0 || weightLow > 0 || weightDormeur > 0)
                                            ? <span className="text-red-500 font-bold text-center leading-tight text-[10px]">RECHERCHE<br/>PONDÉRÉE</span>
                                            : "RECHERCHER"
                                    )}
                                </CasinoButton>
                                {mode === 'manual' && (
                                    <CasinoButton 
                                        size="md" 
                                        variant={(!selectedTariff || selectedNumbers.length !== selectedTariff?.nums || selectedStars.length !== selectedTariff?.stars) ? "danger" : "primary"}
                                        className={cn(
                                            "text-sm px-4 py-[7px] w-[131px] flex items-center justify-center rounded-lg",
                                            (!selectedTariff || selectedNumbers.length !== selectedTariff?.nums || selectedStars.length !== selectedTariff?.stars)
                                                ? "bg-gradient-to-b from-red-600 to-red-900 border-red-500 cursor-not-allowed"
                                                : "bg-gradient-to-b from-green-600 to-green-900 border-green-500 text-white hover:from-green-500 hover:to-green-800"
                                        )}
                                        onClick={() => {
                                            if (!selectedTariff || selectedNumbers.length !== selectedTariff?.nums || selectedStars.length !== selectedTariff?.stars) {
                                                playSound('error');
                                                return;
                                            }
                                            handleGenerate('manual');
                                        }}
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? "..." : "VALIDER"}
                                    </CasinoButton>
                                )}
                            </div>
                            
                            {/* Right: Bouton ENVOYER */}
                            <CasinoButton 
                                variant={autoDraws.length === 0 ? "danger" : "primary"}
                                size="md"
                                className={cn(
                                    "px-5 py-2 text-sm font-bold min-w-[120px]",
                                    autoDraws.length === 0 
                                        ? "opacity-50 cursor-not-allowed" 
                                        : "animate-pulse bg-green-900 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                                )}
                                onClick={handleSend}
                                disabled={autoDraws.length === 0}
                            >
                                {isSending ? "..." : (
                                    <span className={autoDraws.length === 0 ? "text-red-500" : "text-green-400"}>
                                        ENVOYER
                                    </span>
                                )}
                            </CasinoButton>
                        </div>
                    )}
                </SectionPanel>
            </div>

        </div>

        {/* BOTTOM: RESULT AREA */}
        <div className="bg-gradient-to-t from-black to-zinc-900 border-t-4 border-casino-red rounded-b-xl p-1 shadow-2xl relative mt-1 mx-auto" style={{ width: `${totalColumnsWidth}px` }}>
             {/* Header Row: Title - Button - Actions */}
             <div className="flex flex-row items-center justify-between gap-2 relative z-20 mb-1">
                 
                 {/* Title (Left) */}
                 <div className="flex-1 text-left min-w-[200px]">
                     {/* Title Removed */}
                 </div>

                 {/* Validate Button (Center) */}
                 <div className="flex-none mx-auto flex flex-col items-center">
                   {/* ProchainTirageSimple moved to rack title - hidden here */}
                    
                    {/* Buttons moved to rack - only show in simplified manual mode (but they're in ACTIONS panel there too, so hide all) */}
                   {false && mode === 'manual' ? (
                        <div className="relative flex items-center justify-center">
                            <div className={cn(
                                "flex items-center rounded-xl overflow-hidden min-w-[450px] justify-center",
                                currentPrice === 0 
                                    ? "animate-pulse shadow-[0_0_20px_rgba(255,0,0,0.8)]" 
                                    : "shadow-[0_0_20px_rgba(255,215,0,0.4)] animate-pulse hover:animate-none"
                            )}>
                                 <CasinoButton 
                                    size="lg" 
                                   variant={!selectedTariff ? "danger" : "primary"}
                                   className="text-lg px-8 py-6 rounded-none border-r border-black/20 w-[225px] flex items-center justify-center"
                                   onClick={() => {
                                       if (!selectedTariff) {
                                           playSound('error');
                                           return;
                                       }
                                       handleGenerate('auto');
                                   }} 
                                    disabled={isGenerating}
                                 >
                                    {isGenerating ? "..." : (
                                        (weightHigh > 0 || weightMid > 0 || weightLow > 0 || weightDormeur > 0 ||
                                         weightStarHigh > 0 || weightStarMid > 0 || weightStarLow > 0 || weightStarDormeur > 0)
                                            ? <span className="text-red-500 font-bold text-center leading-tight">RECHERCHE<br/>PONDÉRÉE</span>
                                            : "RECHERCHER"
                                    )}
                                 </CasinoButton>
                                 <CasinoButton 
                                    size="lg" 
                                   variant={(!selectedTariff || selectedNumbers.length !== selectedTariff?.nums || selectedStars.length !== selectedTariff?.stars) ? "danger" : "primary"}
                                   className={cn(
                                       "text-lg px-8 py-6 rounded-none w-[225px] flex items-center justify-center",
                                       (!selectedTariff || selectedNumbers.length !== selectedTariff?.nums || selectedStars.length !== selectedTariff?.stars)
                                           ? "bg-gradient-to-b from-red-600 to-red-900 border-red-500 cursor-not-allowed"
                                           : "bg-gradient-to-b from-green-600 to-green-900 border-green-500 text-white hover:from-green-500 hover:to-green-800 shadow-none hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
                                   )}
                                   onClick={() => {
                                       if (!selectedTariff || selectedNumbers.length !== selectedTariff?.nums || selectedStars.length !== selectedTariff?.stars) {
                                           playSound('error');
                                           return;
                                       }
                                       handleGenerate('manual');
                                   }}
                                    disabled={isGenerating}
                                 >
                                     {isGenerating ? "..." : "VALIDER"}
                                 </CasinoButton>
                            </div>

                            {/* TRASH / CLEAR HISTORY BUTTON (MANUAL MODE - SAME AS AUTO) */}
                            <div className="absolute left-full ml-[30px] top-1/2 -translate-y-1/2 z-50">
                                {!showClearConfirm ? (
                                    <button 
                                        onClick={() => setShowClearConfirm(true)}
                                        className="w-12 h-12 flex items-center justify-center bg-red-900/30 border border-red-500/50 rounded-lg text-red-500 hover:bg-red-900/50 hover:text-red-400 hover:border-red-400 transition-all"
                                        title="Effacer tout l'historique"
                                    >
                                        <Trash2 size={24} />
                                    </button>
                                ) : (
                                    <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 flex items-center gap-2 bg-black border border-red-500 rounded-lg p-2 z-50 animate-in fade-in slide-in-from-left-2 duration-200 shadow-xl whitespace-nowrap">
                                        <button 
                                            onClick={() => {
                                                setAutoDraws([]);
                                                setGeneratedNumbers([]);
                                                setGeneratedStars([]);
                                                setShowClearConfirm(false);
                                                playSound('click');
                                                toast.success("Historique effacé");
                                            }}
                                            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded flex items-center gap-1 shadow-lg transform hover:scale-105 transition-all"
                                        >
                                            CONFIRMER
                                        </button>
                                        <button 
                                            onClick={() => setShowClearConfirm(false)}
                                            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-bold rounded shadow-lg transform hover:scale-105 transition-all"
                                        >
                                            ANNULER
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null /* Buttons moved to rack in classic mode */}
                 </div>

                 {/* Actions moved to rack - keep empty space for layout balance */}
                 <div className="flex-1 min-w-[200px]" />
             </div>

             {/* Results Row (Full Width Below) */}
             {mode === 'manual' && autoDraws.length === 0 ? (
                 <div 
                    className="w-full bg-black/50 p-2 rounded-2xl border border-zinc-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] min-h-[60px] flex items-center justify-center relative z-10"
                    onClick={handleReveal}
                 >
                     {/* Small trash button to clear current selection */}
                     {generatedNumbers.length > 0 && (
                         <button 
                             onClick={(e) => {
                                 e.stopPropagation();
                                 setSelectedNumbers([]);
                                 setSelectedStars([]);
                                 setGeneratedNumbers([]);
                                 setGeneratedStars([]);
                                 setNumberSources({});
                                 setStarSources({});
                                 playSound('click');
                             }}
                             className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg bg-red-950/30 text-red-600 hover:bg-red-900/80 hover:text-white transition-all z-50 border border-red-900/50 hover:border-red-500 shadow-lg hover:shadow-red-900/20 hover:scale-110"
                             title="Effacer ce tirage"
                         >
                             <Trash2 size={20} />
                         </button>
                     )}
                     
                     {generatedNumbers.length > 0 ? (
                         <div className={cn(
                            "flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-2xl md:text-3xl font-black font-mono tracking-wider transition-all duration-700",
                            // Manual mode doesn't really use isRevealed usually, but let's keep it safe
                         )}>
                            {/* NUMBERS IN WHITE */}
                            <div className="flex flex-wrap justify-center gap-2">
                                {generatedNumbers.map((n, i) => (
                                    <div key={`n-${i}`} className={cn(
                                        "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg border-2 transition-all",
                                        n === 0 
                                            ? "bg-zinc-800 border-zinc-600 text-zinc-400" 
                                            : "bg-white border-zinc-200 text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                                    )}>
                                        {n === 0 ? '?' : n}
                                    </div>
                                ))}
                            </div>
                            
                            {/* SEPARATOR */}
                            <div className="text-zinc-600 hidden md:flex items-center mx-2 text-4xl">|</div>
                            
                            {/* STARS IN YELLOW */}
                            <div className="flex flex-wrap justify-center gap-2">
                                {generatedStars.map((n, i) => (
                                    <div key={`s-${i}`} className={cn(
                                        "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg border-2 transition-all",
                                        n === 0 
                                            ? "bg-zinc-800 border-yellow-900/50 text-yellow-700" 
                                            : "bg-yellow-400 border-yellow-200 text-yellow-900 shadow-[0_0_15px_rgba(255,215,0,0.5)]"
                                    )}>
                                         {n === 0 ? '?' : n}
                                    </div>
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
             ) : (
                 <div className="w-full flex flex-col gap-2 mt-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {autoDraws.length > 0 ? (
                        autoDraws.map((draw, idx) => {
                            // Pour Invite/Abonné : TOUJOURS masqué (jamais révélable)
                            // Pour VIP/Admin : comportement normal
                            const isRevealed = isInviteOrAbonne ? false : (mode === 'manual' ? true : (draw.revealed !== undefined ? draw.revealed : true));
                            const shouldBlur = !isRevealed;
                            const shouldHideNumbers = isInviteOrAbonne; // Masquer complètement les vrais numéros
                            
                            return (
                            <div 
                               key={`draw-${idx}`}
                               className={cn(
                                   "w-full bg-black/50 p-2 rounded-2xl border shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] min-h-[60px] flex items-center justify-center relative z-10 animate-in slide-in-from-top-4 duration-500 fade-in",
                                   isInviteOrAbonne ? "border-zinc-700 opacity-60" : "border-zinc-800 cursor-pointer"
                               )}
                               onClick={() => { 
                                   // Invite/Abonné ne peuvent pas révéler
                                   if (shouldBlur && !isInviteOrAbonne) {
                                       const newDraws = [...autoDraws];
                                       newDraws[idx].revealed = true;
                                       setAutoDraws(newDraws);
                                   }
                               }}
                            >
                                <div className="absolute left-4 text-xs text-zinc-600 font-mono">
                                    #{autoDraws.length - idx} {draw.revealed === true && mode === 'manual' && idx === 0 ? '(MANUEL)' : ''}
                                </div>
                               {mode === 'manual' && !isInviteOrAbonne && (
                                   <button 
                                       onClick={(e) => {
                                           e.stopPropagation();
                                           const newDraws = [...autoDraws];
                                           newDraws.splice(idx, 1);
                                           setAutoDraws(newDraws);
                                           
                                           // If this was the first/current draw, also clear the selections
                                           if (idx === 0) {
                                               setSelectedNumbers([]);
                                               setSelectedStars([]);
                                               setGeneratedNumbers([]);
                                               setGeneratedStars([]);
                                               setNumberSources({});
                                               setStarSources({});
                                           }
                                           
                                           playSound('click');
                                       }}
                                       className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg bg-red-950/30 text-red-600 hover:bg-red-900/80 hover:text-white transition-all z-50 border border-red-900/50 hover:border-red-500 shadow-lg hover:shadow-red-900/20 hover:scale-110"
                                       title="Supprimer ce tirage"
                                   >
                                       <Trash2 size={20} />
                                   </button>
                               )}
                                <div className={cn(
                                    "flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-2xl md:text-3xl font-black font-mono tracking-wider transition-all duration-700",
                                    shouldBlur && !shouldHideNumbers ? "blur-sm" : ""
                                )}>
                                   {/* NUMBERS - Masqués pour Invite/Abonné */}
                                   <div className="flex flex-wrap justify-center gap-2">
                                       {draw.nums.map((n, i) => (
                                           <div key={`n-${i}`} className={cn(
                                               "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg border-2",
                                               shouldHideNumbers 
                                                   ? "bg-zinc-800 border-zinc-600 text-zinc-500" 
                                                   : "bg-white border-zinc-200 text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                                           )}>
                                               {shouldHideNumbers ? '?' : n}
                                           </div>
                                       ))}
                                   </div>
                                   
                                   {/* SEPARATOR */}
                                   <div className="text-zinc-600 hidden md:flex items-center mx-2 text-4xl">|</div>
                                   
                                   {/* STARS - Masquées pour Invite/Abonné */}
                                   <div className="flex flex-wrap justify-center gap-2">
                                       {draw.stars.map((n, i) => (
                                           <div key={`s-${i}`} className={cn(
                                               "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg border-2",
                                               shouldHideNumbers
                                                   ? "bg-zinc-800 border-yellow-900/30 text-yellow-700/50"
                                                   : "bg-yellow-400 border-yellow-200 text-yellow-900 shadow-[0_0_15px_rgba(255,215,0,0.5)]"
                                           )}>
                                               {shouldHideNumbers ? '★' : n}
                                           </div>
                                       ))}
                                   </div>
                                </div>
                                
                                {/* Message pour VIP/Admin qui peuvent révéler */}
                                {shouldBlur && !isInviteOrAbonne && (
                                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                       <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 text-white font-rajdhani uppercase tracking-widest text-sm animate-pulse">
                                           Cliquez pour révéler
                                       </div>
                                   </div>
                                )}
                                
                            </div>
                        )})
                     ) : (
                         <div className="w-full bg-black/50 p-4 rounded-2xl border border-zinc-800 flex items-center justify-center text-zinc-600 font-lcd text-lg tracking-widest opacity-50">
                             {mode === 'manual' ? "VALIDEZ VOTRE SÉLECTION" : "LANCEZ UNE RECHERCHE"}
                         </div>
                     )}
                 </div>
             )}
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
            lastDrawDate={dernierTirage && dernierTirage.date && !isNaN(new Date(dernierTirage.date).getTime()) ? format(new Date(dernierTirage.date), 'yyyy-MM-dd') : '...'}
            totalDraws={stats ? 1899 : 0} 
        />

        {/* SETTINGS MODAL */}
        {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                    <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                        <div className="flex items-center gap-3">
                            <Settings className="text-casino-gold" size={24} />
                            <h2 className="text-2xl font-orbitron text-white tracking-widest">PARAMÈTRES</h2>
                        </div>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                            <div className="bg-zinc-800 rounded-full p-1 hover:bg-zinc-700">
                                <Minus size={20} className="rotate-45" /> {/* Close Icon */}
                            </div>
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-8">
                        {/* SECTION: FREQUENCY CYCLE */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-casino-gold flex items-center gap-2">
                                <Calendar size={18} />
                                CYCLE DE CALCUL DES FRÉQUENCES
                            </h3>
                            <div className="bg-black/40 p-4 rounded-xl border border-zinc-800 space-y-3">
                                <p className="text-zinc-400 text-sm mb-4">
                                    Définissez la période historique utilisée pour calculer les fréquences (Chaud/Froid) et les tendances.
                                </p>
                                
                                {/* Option 1: Full History */}
                                <label className="flex items-center gap-3 cursor-pointer group p-2 rounded hover:bg-white/5 transition-colors">
                                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", freqConfig.type === 'all' ? "border-casino-gold" : "border-zinc-600")}>
                                        {freqConfig.type === 'all' && <div className="w-2.5 h-2.5 bg-casino-gold rounded-full" />}
                                    </div>
                                    <input type="radio" className="hidden" checked={freqConfig.type === 'all'} onChange={() => setFreqConfig({ type: 'all' })} />
                                    <span className={cn("font-bold", freqConfig.type === 'all' ? "text-white" : "text-zinc-500")}>Historique Complet (2004 - Aujourd'hui)</span>
                                </label>

                                {/* Option 2: Last Year */}
                                <label className="flex items-center gap-3 cursor-pointer group p-2 rounded hover:bg-white/5 transition-colors">
                                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", freqConfig.type === 'last_year' ? "border-casino-gold" : "border-zinc-600")}>
                                        {freqConfig.type === 'last_year' && <div className="w-2.5 h-2.5 bg-casino-gold rounded-full" />}
                                    </div>
                                    <input type="radio" className="hidden" checked={freqConfig.type === 'last_year'} onChange={() => setFreqConfig({ type: 'last_year' })} />
                                    <span className={cn("font-bold", freqConfig.type === 'last_year' ? "text-white" : "text-zinc-500")}>Dernière Année (52 semaines)</span>
                                </label>

                                {/* Option 3: Last 20 Draws */}
                                <label className="flex items-center gap-3 cursor-pointer group p-2 rounded hover:bg-white/5 transition-colors">
                                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", freqConfig.type === 'last_20' ? "border-casino-gold" : "border-zinc-600")}>
                                        {freqConfig.type === 'last_20' && <div className="w-2.5 h-2.5 bg-casino-gold rounded-full" />}
                                    </div>
                                    <input type="radio" className="hidden" checked={freqConfig.type === 'last_20'} onChange={() => setFreqConfig({ type: 'last_20' })} />
                                    <span className={cn("font-bold", freqConfig.type === 'last_20' ? "text-white" : "text-zinc-500")}>20 Derniers Tirages (Tendance Court Terme)</span>
                                </label>

                                {/* Option 4: Custom */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer group p-2 rounded hover:bg-white/5 transition-colors">
                                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", freqConfig.type === 'custom' ? "border-casino-gold" : "border-zinc-600")}>
                                            {freqConfig.type === 'custom' && <div className="w-2.5 h-2.5 bg-casino-gold rounded-full" />}
                                        </div>
                                        <input type="radio" className="hidden" checked={freqConfig.type === 'custom'} onChange={() => setFreqConfig({ ...freqConfig, type: 'custom', customValue: freqConfig.customValue || 10, customUnit: freqConfig.customUnit || 'weeks' })} />
                                        <span className={cn("font-bold", freqConfig.type === 'custom' ? "text-white" : "text-zinc-500")}>Période Personnalisée</span>
                                    </label>
                                    
                                    {freqConfig.type === 'custom' && (
                                        <div className="ml-8 flex items-center gap-2 bg-black/20 p-2 rounded border border-zinc-700 animate-in fade-in slide-in-from-top-2">
                                            <span className="text-zinc-400 text-sm">Derniers</span>
                                            <input 
                                                type="number" 
                                                min="1" 
                                                max="1000"
                                                value={freqConfig.customValue || ''} 
                                                onChange={(e) => setFreqConfig({ ...freqConfig, customValue: parseInt(e.target.value) || 1 })}
                                                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 w-20 text-center text-white font-mono focus:border-casino-gold outline-none"
                                            />
                                            <select 
                                                value={freqConfig.customUnit || 'weeks'}
                                                onChange={(e) => setFreqConfig({ ...freqConfig, customUnit: e.target.value as PeriodUnit })}
                                                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white focus:border-casino-gold outline-none"
                                            >
                                                <option value="weeks">Semaines</option>
                                                <option value="months">Mois</option>
                                                <option value="years">Années</option>
                                                <option value="draws">Tirages</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
                        <CasinoButton onClick={() => setIsSettingsOpen(false)} variant="primary" size="lg" className="px-8">
                            FERMER & APPLIQUER
                        </CasinoButton>
                    </div>
                </div>
            </div>
        )}

        </div>
      </div>
    </CasinoLayout>
  );
}
