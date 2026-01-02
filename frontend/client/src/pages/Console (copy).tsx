
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
import { Lock, Unlock, ChevronDown, RotateCcw, ArrowUp, ArrowDown, Minus, RefreshCcw, Settings, Sliders, Calendar, Trash2 } from "lucide-react";
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
  PeriodUnit
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
  const [tendencyLevel, setTendencyLevel] = useState(0); // 0 to 10
  const [isWeightsEnabled, setIsWeightsEnabled] = useState(true);

  // --- NEW: WEIGHT PRESET STATE ---
  const [selectedWeightPreset, setSelectedWeightPreset] = useState("0"); // "0" to "10"
  const [weightPresetsData, setWeightPresetsData] = useState<Record<string, {
      weightHigh: number; weightMid: number; weightLow: number; weightDormeur: number;
      weightStarHigh: number; weightStarMid: number; weightStarLow: number; weightStarDormeur: number;
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
            
            // Restore Config
            if (state.selectedPreset) setSelectedPreset(state.selectedPreset);
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
          toast.info("Pondérations DÉSACTIVÉES (Mode 0)");
      } else {
          setIsWeightsEnabled(true);
          
          if (weightPresetsData[presetId]) {
              // Load saved data
              const data = weightPresetsData[presetId];
              setWeightHigh(data.weightHigh);
              setWeightMid(data.weightMid);
              setWeightLow(data.weightLow);
              setWeightDormeur(data.weightDormeur);
              
              setWeightStarHigh(data.weightStarHigh);
              setWeightStarMid(data.weightStarMid);
              setWeightStarLow(data.weightStarLow);
              setWeightStarDormeur(data.weightStarDormeur);
              
              toast.success(`Pondérations ${presetId} chargées`);
          } else {
              // Default to 0 if empty
              setWeightHigh(0); setWeightMid(0); setWeightLow(0); setWeightDormeur(0);
              setWeightStarHigh(0); setWeightStarMid(0); setWeightStarLow(0); setWeightStarDormeur(0);
              toast.info(`Pondérations ${presetId} sélectionnées (Vides - Réglées à 0)`);
          }
      }
  };

  const handleWeightPresetDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedWeightPreset === "0") {
          toast.error("Impossible de sauvegarder sur le preset 0 (Désactivé)");
          return;
      }

      // Save current knob positions
      setWeightPresetsData(prev => ({
          ...prev,
          [selectedWeightPreset]: {
              weightHigh, weightMid, weightLow, weightDormeur,
              weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur
          }
      }));
      
      playSound('click'); // Changed 'save' to 'click' to fix type error
      toast.success(`Pondérations sauvegardées dans la Pondération ${selectedWeightPreset}`);
  };

  // --- DERIVED ACCESS RIGHTS ---
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
        // Load RAW history first
        const history = await chargerHistorique();
        setFullHistory(history);
        
        // Initial Stats Computation (ALL)
        const computedStats = computeStatsFromTirages(history);
        setStats(computedStats);
        
        setDernierTirage(getDernierTirage(history));
        setProchainTirage(getProchainTirage());
        
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
  const mapToDisplayStat = (item: { numero: number, frequence: number }, type: 'number' | 'star', index: number): DisplayStat => {
    const defaultTrend = { direction: 'stable' as const, score: 5 };
    const trend = type === 'number' 
        ? (stats?.tendancesNumeros[item.numero] || defaultTrend)
        : (stats?.tendancesEtoiles ? stats.tendancesEtoiles[item.numero] : defaultTrend);

    return {
      number: item.numero,
      frequency: item.frequence,
      trendScore: trend ? trend.score : 5,
      trendDirection: trend ? trend.direction : 'stable',
      rank: index + 1
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

      // FORBO RULES:
      // 1. Sort by Rank (Ascending) -> Best rank wins (e.g. 3rd is better than 50th)
      // 2. Tie-Break: Dormeur wins
      
      candidates.sort((a, b) => {
          if (a.rank !== b.rank) return a.rank - b.rank;
          
          // Tie-break
          if (a.cat === 'dormeur') return -1; // a wins
          if (b.cat === 'dormeur') return 1;  // b wins
          return 0;
      });

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
      if (total > maxWeightLimit) {
          // Allow decreasing even if over limit to let user fix it
          if (newVal < oldVal) return true;
          
          toast.error(`MAXIMUM ${maxWeightLimit} BOULES (Total Pondérations) !`, { duration: 3000, style: { background: 'red', color: 'white', fontWeight: 'bold' } });
          playSound('error');
          return false;
      }
      if (total < 5 && newVal < oldVal) {
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
           return false;
      }
      return true;
  };

  // --- MANUAL SELECTION LOGIC ---
  const toggleSelection = (num: number, type: 'number' | 'star', category?: 'high' | 'mid' | 'low' | 'dormeur') => {
      // Mark as user modified
      userModifiedRef.current = true;

      if (mode === 'auto') return;

      if (type === 'number') {
        if (selectedNumbers.includes(num)) {
            // REMOVE
            setSelectedNumbers(prev => prev.filter(n => n !== num));
            // No need to manually update sources or weights, the useEffect will handle it
            playSound('click');
        } else {
             // ADD NUMBER
             const cat = getNumberCategory(num);
             
            setSelectedNumbers(prev => [...prev, num].sort((a, b) => a - b));
            playSound('click');
        }
      } else {
         // STAR LOGIC
         if (selectedStars.includes(num)) {
            // REMOVE
            setSelectedStars(prev => prev.filter(n => n !== num));
            playSound('click');
        } else {
             // ADD STAR
             const cat = getStarCategory(num);

            setSelectedStars(prev => [...prev, num].sort((a, b) => a - b));
            playSound('click');
        }
      }
      // Price updates automatically via reactive currentPrice
  };

  // Removed updatePrice() as we use derived state now

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

    // Prevent overwriting restored state on initial load
    if (isRestoringRef.current) {
        console.log("Skipping preset load to preserve restored state");
        isRestoringRef.current = false;
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
                
                // playSound('click'); // Optional: feedback on load
            }
        } catch (e) {
            console.error("Error loading presets", e);
        }
    }
  }, [selectedPreset, user]);

  // --- SYNC KNOBS WITH SELECTION (Safety Check) ---
  // REMOVED AUTO-SYNC AS REQUESTED BY USER
  /*
  useEffect(() => {
    const timer = setTimeout(() => {
        // Sync Manual Mode - ONLY IN FREE MODE
        // In Tariff Mode (!isFreeMode), the knobs define the TARGET/QUOTA, so they must NOT adapt to the current selection count.
        if (mode === 'manual' && isFreeMode) {
            let h=0, m=0, l=0, d=0;
            let sh=0, sm=0, sl=0, sd=0;
            
            // Re-calc Numbers
            if (selectedNumbers.length > 0) {
                selectedNumbers.forEach(n => {
                    const src = numberSources[n];
                    if (src === 'high') h++;
                    else if (src === 'mid') m++;
                    else if (src === 'low') l++;
                    else d++;
                });
                
                if (h !== weightHigh || m !== weightMid || l !== weightLow || d !== weightDormeur) {
                    console.log("Auto-Syncing Number Knobs:", {h,m,l,d});
                    setWeightHigh(h); setWeightMid(m); setWeightLow(l); setWeightDormeur(d);
                }
            }
            
            // Re-calc Stars
            if (selectedStars.length > 0) {
                selectedStars.forEach(n => {
                    const src = starSources[n];
                    if (src === 'high') sh++;
                    else if (src === 'mid') sm++;
                    else if (src === 'low') sl++;
                    else sd++;
                });

                if (sh !== weightStarHigh || sm !== weightStarMid || sl !== weightStarLow || sd !== weightStarDormeur) {
                    console.log("Auto-Syncing Star Knobs:", {sh,sm,sl,sd});
                    setWeightStarHigh(sh); setWeightStarMid(sm); setWeightStarLow(sl); setWeightStarDormeur(sd);
                }
            }
        }
    }, 800);
    return () => clearTimeout(timer);
  }, [mode, selectedNumbers.length, selectedStars.length, isFreeMode]);
  */


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
            // ... (Manual checks remain same)
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
            calculatedNums = [...selectedNumbers];
            calculatedStars = [...selectedStars];
            calculationSuccess = true;

        } else {
            // Auto generation using Real Service - Use WEIGHTS not counts
            const totalNums = weightHigh + weightMid + weightLow + weightDormeur;
            const totalStars = weightStarHigh + weightStarMid + weightStarLow + weightStarDormeur;

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

            if (!isWeightsEnabled) {
                // --- WEIGHTS DISABLED: RANDOM FROM VISIBLE POOL ---
                // Ignores strict category constraints, just respects the TOTAL COUNT.
                // Uses the visible numbers (Top 10/12 of each section) as the candidate pool.

                const combinedNumPool = [...poolHigh, ...poolMid, ...poolLow, ...poolDormeur];
                const combinedStarPool = [...poolStarHigh, ...poolStarMid, ...poolStarLow, ...poolStarDormeur];
                
                // Helper to pick unique randoms
                const pickRandom = (pool: number[], count: number) => {
                    // Unique candidates only
                    const uniquePool = Array.from(new Set(pool));
                    
                    // Shuffle
                    const shuffled = uniquePool.sort(() => Math.random() - 0.5);
                    
                    return shuffled.slice(0, count).sort((a, b) => a - b);
                };

                calculatedNums = pickRandom(combinedNumPool, totalNums);
                calculatedStars = pickRandom(combinedStarPool, totalStars);
                
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
                    // NUMBERS
                    allSelectedNums.push(...selectUnique(poolHigh, weightHigh, allSelectedNums, 'high', false));
                    allSelectedNums.push(...selectUnique(poolMid, weightMid, allSelectedNums, 'mid', false));
                    allSelectedNums.push(...selectUnique(poolLow, weightLow, allSelectedNums, 'low', false));
                    allSelectedNums.push(...selectUnique(poolDormeur, weightDormeur, allSelectedNums, 'dormeur', false));

                    // STARS
                    allSelectedStars.push(...selectUnique(poolStarHigh, weightStarHigh, allSelectedStars, 'high', true));
                    allSelectedStars.push(...selectUnique(poolStarMid, weightStarMid, allSelectedStars, 'mid', true));
                    allSelectedStars.push(...selectUnique(poolStarLow, weightStarLow, allSelectedStars, 'low', true));
                    allSelectedStars.push(...selectUnique(poolStarDormeur, weightStarDormeur, allSelectedStars, 'dormeur', true));
                    
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
             // Auto draws are blurred by default
             const newDraw = { nums: calculatedNums, stars: calculatedStars, date: new Date(), revealed: false };
             setAutoDraws(prev => [newDraw, ...prev]);
        } else {
             // Manual Mode: Also stack results for visual consistency, but revealed immediately?
             // User said "empile aussi les uns par dessus les autres les tirage du mode manuel"
             const newDraw = { nums: calculatedNums, stars: calculatedStars, date: new Date(), revealed: true };
             setAutoDraws(prev => [newDraw, ...prev]);
        }

        setGeneratedNumbers(calculatedNums);
        setGeneratedStars(calculatedStars);
        
        // Save history - ONLY IN MANUAL MODE NOW
        try {
            if (mode === 'manual') {
                saveGridToHistory(calculatedNums, calculatedStars);
            }
        } catch (err) {
            console.error("History Save Error:", err);
        }
        
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
      // User requested: "recycler remet tout à zéro... mais efface aussi les tirrages... il ne faut pas [en mode auto]"
      if (mode === 'manual') {
          setAutoDraws([]); 
      }

      setNumberSources({});
      setStarSources({});
      
      // 2. Reset Weights (Potards)
      setWeightHigh(0);
      setWeightMid(0);
      setWeightLow(0);
      setWeightDormeur(0);
      
      // Stars too? Logic implies "remettre tous les potards sur zéro". Assuming stars too for consistency.
      setWeightStarHigh(0);
      setWeightStarMid(0);
      setWeightStarLow(0);
      setWeightStarDormeur(0);

      // 3. Unlock / Free Mode removed
      
      // 4. Update Limits
      setMaxWeightLimit(10);
      // setMaxStarWeightLimit(12); // Optional, usually auto-calculated, but good to reset
      
      playSound('click');
      toast.success("Réinitialisation complète effectuée");
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
      <div className="p-2 w-full max-w-[1800px] mx-auto px-4 space-y-2 scale-95 origin-top" onClick={() => { setIsPresetDropdownOpen(false); setContextMenu(null); setIsPriceGridOpen(false); }}>
        
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

        {/* TOP BAR: CONTROL CENTER */}
        <div className="bg-zinc-900 border-b-4 border-casino-gold rounded-t-xl p-2 shadow-2xl relative z-50">
             {/* Background Tech Pattern */}
             <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,transparent_25%,#fff_25%,#fff_50%,transparent_50%,transparent_75%,#fff_75%,#fff_100%)] bg-[length:20px_20px] rounded-t-xl" />
             
             {/* Header Grid Layout for Centering */}
             <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                 
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
                            <div className="flex items-center gap-2 text-lg font-rajdhani text-zinc-400 mt-0.5 animate-in fade-in slide-in-from-left-2 duration-500">
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
                                {selectedWeightPreset === "0" ? "Pondération 0" : `Pondération ${selectedWeightPreset}`}
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
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                        <div 
                                            key={num}
                                            className={cn(
                                                "px-4 py-2 text-xl font-rajdhani cursor-pointer hover:bg-teal-900/20 transition-colors flex justify-between items-center",
                                                selectedWeightPreset === num.toString() && "bg-teal-900/40 text-teal-400"
                                            )}
                                            onClick={() => handleWeightPresetSelect(num.toString())}
                                        >
                                            <span className={weightPresetsData[num.toString()] ? "text-teal-400 font-bold" : "text-zinc-400"}>
                                                Pondération {num}
                                            </span>
                                            {weightPresetsData[num.toString()] && <span className="text-[10px] text-teal-600 ml-2 font-mono border border-teal-900 px-1 rounded">SAVED</span>}
                                        </div>
                                    ))}
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

                     {/* ADMIN CONTROL BUTTON - MOVED HERE */}
                     {user?.role === 'admin' && (
                         <button 
                             onClick={() => setIsDebugOpen(true)}
                             className="min-w-[100px] px-4 py-2 bg-[linear-gradient(180deg,#2a2a2a_0%,#1a1a1a_100%)] border-2 border-[#d4af37] rounded-lg text-[#d4af37] font-orbitron text-[12px] font-bold uppercase tracking-widest hover:bg-[linear-gradient(180deg,#3a3a3a_0%,#2a2a2a_100%)] hover:border-[#ffd700] hover:shadow-[0_0_10px_rgba(212,175,55,0.5)] transition-all duration-300 flex items-center justify-center"
                         >
                             <span className="mt-[2px]">CONTRÔLE</span>
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
                     
                     {/* CUSTOM PRESET SELECTOR */}
                     <div className="flex flex-col">
                         <div className="relative flex items-center bg-black border border-zinc-700 rounded h-[38px] w-[180px]">
                            {/* Preset Name Display (Clickable for saving/context) */}
                            <div 
                                className={cn(
                                    "flex-1 px-3 text-2xl font-rajdhani cursor-pointer select-none truncate h-full flex items-center",
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
                                                "px-4 py-3 text-2xl font-rajdhani cursor-pointer hover:bg-zinc-800 transition-colors flex justify-between items-center",
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
            

            {/* LEFT: NUMBERS CONFIG - RESSERRÉ ET CORRIGÉ */}
            <div className={cn("flex-none w-[910px] flex flex-col gap-2", mode === 'auto' && "justify-end")}>
                {mode === 'manual' && (
                    <SectionPanel title="CONFIGURATION BOULES (1-50)" disabled={!canUseManual} className="flex-1 flex flex-col min-h-[400px]" ledActive={highFreqActive || midFreqActive || lowFreqActive}>
                        <div className="flex-1 flex flex-col justify-start">
                        {/* High Freq - Layout horizontal comme Étoiles */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            <ToggleSwitch checked={highFreqActive} onChange={v => { setHighFreqActive(v); playSound('toggle'); }} className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE ÉLEVÉE</div>
                                <div className="text-sm text-casino-gold">TOP 10 • Tendance ↑</div>
                            </div>
                            {mode === 'manual' && highFreqActive && (
                                <div className="flex-1 flex justify-start ml-2">
                                    <BallGrid 
                                        stats={highFreqStats} 
                                        countLimit={10} 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category="high"
                                        onToggle={toggleSelection}
                                        className="py-0 justify-start gap-[4px]"
                                        resolveCategory={resolveCategory}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Mid Freq - Layout horizontal comme Étoiles */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            <ToggleSwitch checked={midFreqActive} onChange={v => { setMidFreqActive(v); playSound('toggle'); }} activeColor="bg-yellow-500" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE MOYENNE</div>
                                <div className="text-sm text-yellow-500">MOYENNE 10 • Stable →</div>
                            </div>
                            {mode === 'manual' && midFreqActive && (
                                <div className="flex-1 flex justify-start ml-2">
                                    <BallGrid 
                                        stats={midFreqStats} 
                                        countLimit={10} 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category="mid"
                                        onToggle={toggleSelection}
                                        className="py-0 justify-start gap-[4px]"
                                        resolveCategory={resolveCategory}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Low Freq - Layout horizontal comme Étoiles */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            <ToggleSwitch checked={lowFreqActive} onChange={v => { setLowFreqActive(v); playSound('toggle'); }} activeColor="bg-blue-500" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE BASSE</div>
                                <div className="text-sm text-blue-500">BASSE 10 • Dette Max</div>
                            </div>
                            {mode === 'manual' && lowFreqActive && (
                                <div className="flex-1 flex justify-start ml-2">
                                    <BallGrid 
                                        stats={lowFreqStats} 
                                        countLimit={10} 
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

                        {/* Dormeur Boules - NOUVELLE SECTION */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            <ToggleSwitch checked={true} onChange={v => { playSound('toggle'); }} activeColor="bg-zinc-400" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">DORMEUR</div>
                                <div className="text-sm text-zinc-400">TOP 10 • Absence</div>
                            </div>
                            {mode === 'manual' && (
                                <div className="flex-1 flex justify-start ml-2">
                                    <BallGrid 
                                        stats={dormeurStats} 
                                        countLimit={10} 
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
                    </div>
                </SectionPanel>
                )}

                <SectionPanel 
                    title="PONDÉRATIONS BOULES" 
                    disabled={!isWeightsEnabled}
                >
                    <div className="flex justify-between items-center py-2 px-8">
                        <RotaryKnob label="ÉLEVÉE" value={weightHigh} onChange={(v) => { userModifiedRef.current = true; if(checkWeightLimit(v, weightHigh, weightMid, weightLow, weightDormeur)) setWeightHigh(v); }} max={10} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="MOYENNE" value={weightMid} onChange={(v) => { userModifiedRef.current = true; if(checkWeightLimit(v, weightMid, weightHigh, weightLow, weightDormeur)) setWeightMid(v); }} max={10} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="BASSE" value={weightLow} onChange={(v) => { userModifiedRef.current = true; if(checkWeightLimit(v, weightLow, weightHigh, weightMid, weightDormeur)) setWeightLow(v); }} max={10} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="DORMEUR" value={weightDormeur} onChange={(v) => { userModifiedRef.current = true; if(checkWeightLimit(v, weightDormeur, weightHigh, weightMid, weightLow)) setWeightDormeur(v); }} max={10} labelClassName="text-xs font-bold" size="xl" />
                    </div>
                </SectionPanel>
            </div>

            {/* CENTER: DASHBOARD / OPTIONS */}
            <div className="w-full lg:w-[280px] flex flex-col gap-2 flex-shrink-0 justify-between">
                 {/* OPTIONS PANEL */}
                 <div className="bg-[#111] border-2 border-zinc-800 rounded-xl flex-1 min-h-[400px] p-2 flex flex-col items-center justify-center gap-2 shadow-inner relative overflow-hidden">
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
                     <div className="w-full space-y-2 relative z-10 flex flex-col items-center flex-1 justify-center -mt-[10px] pb-3">
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
                                        max={9} 
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
                                        value={tendencyLevel} 
                                        onChange={(v) => { setTendencyLevel(v); playSound('knob'); }} 
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

                 {/* PRICE RACK (NEW) */}
                 <SectionPanel title="PRIX DE LA GRILLE" className="h-[172px] flex flex-col justify-center items-center flex-shrink-0" showLed={false}>
                    <div className="flex flex-col items-center justify-center w-full gap-0.5">
                        <div className="text-white font-rajdhani font-black text-xl tracking-wide">
                            {displayNumCount} Numéros + {displayStarCount} Étoiles
                        </div>
                        <div className="text-3xl font-bold text-casino-gold font-lcd text-shadow-glow flex items-center gap-2">
                            {currentPrice.toFixed(2)} €
                            
                            {/* RESET BUTTON */}
                            <div 
                                onClick={handleReset}
                                className="cursor-pointer transition-transform hover:scale-110 ml-2"
                                title="Réinitialiser tout"
                            >
                                <RefreshCcw size={24} className="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                            </div>
                        </div>
                    </div>
                 </SectionPanel>
            </div>

            {/* RIGHT: STARS CONFIG - ÉLARGI */}
            <div className={cn("flex-1 min-w-[450px] flex flex-col gap-2", mode === 'auto' && "justify-end")}>
                {mode === 'manual' && (
                <SectionPanel title={<>CONFIGURATION ÉTOILES (1-12) <span className="text-yellow-400 ml-3 text-xl align-middle">★</span></>} disabled={!canUseManual} className="flex flex-col p-[10px] flex-1" ledActive={highStarActive || midStarActive || lowStarActive || dormeurStarActive}>
                     <div className="flex flex-col justify-start">
                        {/* High Star */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            <ToggleSwitch checked={highStarActive} onChange={v => { setHighStarActive(v); playSound('toggle'); }} activeColor="bg-purple-500" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE ÉLEVÉE</div>
                                <div className="text-sm text-purple-400">TOP 12</div>
                            </div>
                             {mode === 'manual' && highStarActive && (
                                <div className="flex-1 flex justify-start ml-2">
                                    <BallGrid 
                                        stats={highStarStats} 
                                        countLimit={12} 
                                        type="star" 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category="high"
                                        onToggle={toggleSelection}
                                        className="py-0 justify-start gap-[4px]"
                                        resolveCategory={resolveCategory}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Mid Star */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            <ToggleSwitch checked={midStarActive} onChange={v => { setMidStarActive(v); playSound('toggle'); }} activeColor="bg-pink-500" className="scale-75 origin-left flex-shrink-0 mr-4" />
                            <div className="flex-shrink-0 w-48">
                                <div className="text-lg font-bold text-white mb-0.5">FRÉQUENCE MOYENNE</div>
                                <div className="text-sm text-pink-400">MOYENNE 12</div>
                            </div>
                             {mode === 'manual' && midStarActive && (
                                <div className="flex-1 flex justify-start ml-2">
                                    <BallGrid 
                                        stats={midStarStats} 
                                        countLimit={12} 
                                        type="star"
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category="mid"
                                        onToggle={toggleSelection}
                                        className="py-0 justify-start gap-[4px]"
                                        resolveCategory={resolveCategory}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Low Star */}
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

                        {/* Dormeur Star */}
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
                     </div>
                </SectionPanel>
                )}

                <SectionPanel 
                    title="PONDÉRATIONS ÉTOILES"
                    disabled={!isWeightsEnabled}
                >
                    <div className="flex justify-between items-center py-2 px-8">
                        <RotaryKnob label="ÉLEVÉES" value={weightStarHigh} onChange={(v) => { userModifiedRef.current = true; if(checkStarWeightLimit(v, weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur)) setWeightStarHigh(v); }} max={4} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="MOYENNE" value={weightStarMid} onChange={(v) => { userModifiedRef.current = true; if(checkStarWeightLimit(v, weightStarMid, weightStarHigh, weightStarLow, weightStarDormeur)) setWeightStarMid(v); }} max={4} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="BASSE" value={weightStarLow} onChange={(v) => { userModifiedRef.current = true; if(checkStarWeightLimit(v, weightStarLow, weightStarHigh, weightStarMid, weightStarDormeur)) setWeightStarLow(v); }} max={4} labelClassName="text-xs font-bold" size="xl" />
                        <RotaryKnob label="DORMEUR" value={weightStarDormeur} onChange={(v) => { userModifiedRef.current = true; if(checkStarWeightLimit(v, weightStarDormeur, weightStarHigh, weightStarMid, weightStarLow)) setWeightStarDormeur(v); }} max={4} labelClassName="text-xs font-bold" size="xl" />
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
                    
                    {mode === 'manual' ? (
                        <div className="relative flex items-center justify-center">
                            <div className={cn(
                                "flex items-center rounded-xl overflow-hidden min-w-[450px] justify-center",
                                currentPrice === 0 
                                    ? "animate-pulse shadow-[0_0_20px_rgba(255,0,0,0.8)]" 
                                    : "shadow-[0_0_20px_rgba(255,215,0,0.4)] animate-pulse hover:animate-none"
                            )}>
                                 <CasinoButton 
                                    size="lg" 
                                    variant={currentPrice === 0 ? "danger" : "primary"}
                                    className="text-lg px-8 py-6 rounded-none border-r border-black/20 flex-1 min-w-[225px] flex items-center justify-center"
                                    onClick={() => handleGenerate('auto')} 
                                    disabled={isGenerating}
                                 >
                                     {isGenerating ? "..." : "RECHERCHER"}
                                 </CasinoButton>
                                 <CasinoButton 
                                    size="lg" 
                                    variant={currentPrice === 0 ? "danger" : "primary"}
                                    className="text-lg px-8 py-6 rounded-none flex-1 min-w-[225px] bg-gradient-to-b from-green-600 to-green-900 border-green-500 text-white hover:from-green-500 hover:to-green-800 shadow-none hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => handleGenerate('manual')}
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
                    ) : (
                        <div className="relative flex items-center justify-center">
                            <CasinoButton 
                                size="lg" 
                                variant={currentPrice === 0 ? "danger" : "primary"}
                                className={cn(
                                    "text-lg px-8 py-6 flex items-center justify-center min-w-[250px]",
                                    currentPrice === 0 
                                        ? "animate-pulse shadow-[0_0_20px_rgba(255,0,0,0.8)]" 
                                        : "shadow-[0_0_20px_rgba(255,215,0,0.4)] animate-pulse hover:animate-none"
                                )}
                                onClick={() => handleGenerate()}
                                disabled={isGenerating}
                            >
                                {isGenerating ? "CALCUL..." : "RECHERCHER"}
                            </CasinoButton>

                            {/* TRASH / CLEAR HISTORY BUTTON (AUTO MODE ONLY - MOVED HERE) */}
                            {mode === 'auto' && (
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
                            )}
                        </div>
                    )}
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
             {mode === 'manual' && autoDraws.length === 0 ? (
                 <div 
                    className="w-full bg-black/50 p-2 rounded-2xl border border-zinc-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] min-h-[60px] flex items-center justify-center relative z-10"
                    onClick={handleReveal}
                 >
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
                             // Use 'revealed' property, fallback to true if undefined (legacy)
                             // Manual mode: always revealed (never blur)
                             const isRevealed = mode === 'manual' ? true : (draw.revealed !== undefined ? draw.revealed : true);
                             const shouldBlur = !isRevealed;
                             
                             return (
                             <div 
                                key={`draw-${idx}`}
                                className="w-full bg-black/50 p-2 rounded-2xl border border-zinc-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] min-h-[60px] flex items-center justify-center relative z-10 animate-in slide-in-from-top-4 duration-500 fade-in cursor-pointer"
                                onClick={() => { 
                                    if (shouldBlur) {
                                        const newDraws = [...autoDraws];
                                        newDraws[idx].revealed = true;
                                        setAutoDraws(newDraws);
                                    }
                                }}
                             >
                                 <div className="absolute left-4 text-xs text-zinc-600 font-mono">
                                     #{autoDraws.length - idx} {draw.revealed === true && mode === 'manual' && idx === 0 ? '(MANUEL)' : ''}
                                 </div>
                                {mode === 'manual' && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const newDraws = [...autoDraws];
                                            newDraws.splice(idx, 1);
                                            setAutoDraws(newDraws);
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
                                     shouldBlur ? "blur-sm" : ""
                                 )}>
                                    {/* NUMBERS IN WHITE */}
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {draw.nums.map((n, i) => (
                                            <div key={`n-${i}`} className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg border-2 bg-white border-zinc-200 text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                                                {n}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* SEPARATOR */}
                                    <div className="text-zinc-600 hidden md:flex items-center mx-2 text-4xl">|</div>
                                    
                                    {/* STARS IN YELLOW */}
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {draw.stars.map((n, i) => (
                                            <div key={`s-${i}`} className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg border-2 bg-yellow-400 border-yellow-200 text-yellow-900 shadow-[0_0_15px_rgba(255,215,0,0.5)]">
                                                 {n}
                                            </div>
                                        ))}
                                    </div>
                                 </div>
                                 
                                 {shouldBlur && (
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
            lastDrawDate={dernierTirage ? format(new Date(dernierTirage.date), 'yyyy-MM-dd') : '...'}
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
    </CasinoLayout>
  );
}
