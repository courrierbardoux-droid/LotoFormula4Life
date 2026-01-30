
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { CasinoButton } from "@/components/casino/CasinoButton";
import { LottoBall } from "@/components/casino/LottoBall";
import { RotaryKnob } from "@/components/casino/RotaryKnob";
import { ToggleSwitch } from "@/components/casino/ToggleSwitch";
import { Counter } from "@/components/casino/Counter";
import { LEDIndicator } from "@/components/casino/LEDIndicator";
import { ProchainTirageSimple } from "@/components/casino/ProchainTirageSimple";
import { LCDDisplay } from "@/components/casino/LCDDisplay";
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
  saveGridToDB,
  StatsNumeros,
  Tirage,
  chargerHistorique,
  filterTirages,
  computeStatsFromTirages,
  FrequencyConfig,
  PeriodUnit,
  TrendWindowConfig,
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

const LS_FREQ_CONFIG_KEY = "loto_freqConfig_v1";
const EVENT_FREQ_CONFIG_CHANGED = "loto:freqConfigChanged";
const LS_POOL_WINDOWS_KEY = "loto_poolWindows_v1";
const EVENT_POOL_WINDOWS_CHANGED = "loto:poolWindowsChanged";

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
    numberSources?: Record<number, 'high' | 'dormeur'>,
    starSources?: Record<number, 'high' | 'dormeur'>,
    category?: 'high' | 'dormeur',
    onToggle: (num: number, type: 'number' | 'star', category?: 'high' | 'dormeur') => void,
    className?: string,
    resolveCategory?: (num: number, type: 'number' | 'star') => 'high' | 'dormeur' | null
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
    // Weights
    weightHigh: number;
    // Dormeur is now percentage steppers (Boules/Étoiles)
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
    dormeurBallLevel: number;   // Dormeur Boules (0-10) => 0%..100%
    dormeurStarLevel: number;   // Dormeur Étoiles (0-10) => 0%..100%
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
    surreprZ: number; // z-score de surreprésentation (fenêtre Surrepr)
}

export default function Console() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPrice, setShowPrice] = useState(false); // Fix for crash

  // AUTO update status + wins (message à la connexion)
  const [autoUpdateStatus, setAutoUpdateStatus] = useState<null | { success: boolean; drawDate?: string | null; message?: string | null; finishedAt?: string | null }>(null);
  const [unseenWins, setUnseenWins] = useState<Array<{ id: number; targetDate: string; matchNum: number; matchStar: number; gainCents: number | null }>>([]);
  const [winsAcking, setWinsAcking] = useState(false);

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
  // Mode is always determined by user role: Admin/VIP/Abonné = 'manual', Invité = 'auto'
  // Initialize to 'auto' (will be set correctly when user loads)
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  
  // Real Data State
  const [stats, setStats] = useState<StatsNumeros | null>(null);
  const [statsTrend, setStatsTrend] = useState<StatsNumeros | null>(null);
  const [statsDormeur, setStatsDormeur] = useState<StatsNumeros | null>(null);
  const [statsSurrepr, setStatsSurrepr] = useState<StatsNumeros | null>(null);
  const [highWindowCount, setHighWindowCount] = useState(0);
  const [trendWindowCount, setTrendWindowCount] = useState(0);
  const [dormeurWindowCount, setDormeurWindowCount] = useState(0);
  const [surreprWindowCount, setSurreprWindowCount] = useState(0);
  const [dernierTirage, setDernierTirage] = useState<Tirage | null>(null);
  const [prochainTirage, setProchainTirage] = useState<{ date: Date, jour: string } | null>(null);
  const [updateNeeded, setUpdateNeeded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/history/auto-update/status', { credentials: 'include' });
        const data = await res.json().catch(() => ({} as any));
        const st = data?.status;
        if (st && typeof st === 'object') {
          setAutoUpdateStatus({
            success: !!st.success,
            drawDate: st.drawDate ?? null,
            message: st.message ?? null,
            finishedAt: st.finishedAt ?? null,
          });
        } else {
          setAutoUpdateStatus(null);
        }
      } catch {
        setAutoUpdateStatus(null);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/wins/me?unseenOnly=true&limit=50', { credentials: 'include' });
        const data = await res.json().catch(() => ({} as any));
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        setUnseenWins(
          rows
            .map((r: any) => ({
              id: Number(r.id),
              targetDate: String(r.targetDate || ''),
              matchNum: Number(r.matchNum || 0),
              matchStar: Number(r.matchStar || 0),
              gainCents: r.gainCents == null ? null : Number(r.gainCents),
            }))
            .filter((r: any) => Number.isFinite(r.id) && r.targetDate)
        );
      } catch {
        setUnseenWins([]);
      }
    })();
  }, [user?.id]);

  const ackAllWins = async () => {
    if (winsAcking) return;
    setWinsAcking(true);
    try {
      await fetch('/api/wins/me/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: unseenWins.map((w) => w.id) }),
      });
      setUnseenWins([]);
    } catch {
      // ignore
    } finally {
      setWinsAcking(false);
    }
  };
  
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
  const [numberSources, setNumberSources] = useState<Record<number, 'high' | 'dormeur'>>({});
  const [starSources, setStarSources] = useState<Record<number, 'high' | 'dormeur'>>({});
  
  // NEW: Store selected tariff config directly for price display
  const [selectedTariff, setSelectedTariff] = useState<{nums: number, stars: number, price: number} | null>(null);

  // Weightings (Knobs)
  const [weightHigh, setWeightHigh] = useState(2);
  // weightDormeur removed - dormeur is now handled via steppers (Boules/Étoiles)
  
  // Simplified mode toggle for Pondération Boules
  const [isSimplifiedMode, setIsSimplifiedMode] = useState(true);
  
  // Simplified mode: sort order for balls/stars
  const [simplifiedSortOrder, setSimplifiedSortOrder] = useState<'numeric' | 'frequency' | 'trend' | 'dormeur' | 'surrepr'>('numeric'); 
  
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
  const [tendencyLevel, setTendencyLevel] = useState(0); // 0 to 10, 0 = aucune influence (stat pure)
  const [dormeurBallLevel, setDormeurBallLevel] = useState(0); // 0..10 => 0%..100% de dormeurs (boules)
  const [dormeurStarLevel, setDormeurStarLevel] = useState(0); // 0..10 => 0%..100% de dormeurs (étoiles)
  const [isWeightsEnabled, setIsWeightsEnabled] = useState(true);

  type DormeurProof = {
      at: number;
      effectiveMode: 'manual' | 'auto';
      nums?: { level: number; k: number; before: number[]; toReplace: number[]; injected: number[]; after: number[] };
      stars?: { level: number; ks: number; before: number[]; toReplace: number[]; injected: number[]; after: number[] };
  };
  const [lastDormeurProof, setLastDormeurProof] = useState<DormeurProof | null>(null);

  // --- NEW: WEIGHT PRESET STATE ---
  const [selectedWeightPreset, setSelectedWeightPreset] = useState("0"); // "0" to "10"
  const [weightPresetsData, setWeightPresetsData] = useState<Record<string, {
      weightHigh: number;
      dormeurBallLevel: number;
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

  // Popup Gratitude State (VIP/Abonné uniquement)
  const [showGratitudePopup, setShowGratitudePopup] = useState(false);
  const [dontShowPopupAgain, setDontShowPopupAgain] = useState(false);
  const [popupChecked, setPopupChecked] = useState(false); // Pour éviter double appel API
  const [popup1Html, setPopup1Html] = useState<string>(''); // HTML du template popup1 depuis la DB
  const [popup2Html, setPopup2Html] = useState<string>(''); // HTML du template popup2 depuis la DB

  // Email Mode & Invite Send Popup (pour invités uniquement)
  const [emailModeEnabled, setEmailModeEnabled] = useState(false);
  const [showInviteSendPopup, setShowInviteSendPopup] = useState(false);
  const [inviteGratitudeAccepted, setInviteGratitudeAccepted] = useState(false);
  
  // Popup de consultation après envoi (invités uniquement)
  const [showConsultationPopup, setShowConsultationPopup] = useState(false);

  // (Gagnants) : supprimé — aucune notification/redirect "gagnant"

  // --- SETTINGS STATE ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [freqConfig, setFreqConfig] = useState<FrequencyConfig>(() => {
      try {
          const raw = localStorage.getItem(LS_FREQ_CONFIG_KEY);
          if (!raw) return { type: 'all' };
          const parsed = JSON.parse(raw) as FrequencyConfig;
          if (!parsed || typeof parsed !== 'object') return { type: 'all' };
          if (parsed.type === 'custom') {
              if (!parsed.customUnit || !parsed.customValue) return { type: 'all' };
          }
          return parsed;
      } catch {
          return { type: 'all' };
      }
  });

  // --- POOL WINDOWS (High / Surrepr / Trend / Dormeur) ---
  type PoolKey = "high" | "surrepr" | "trend" | "dormeur";
  type PoolWindowsConfig = { high: FrequencyConfig; surrepr: FrequencyConfig; trend: TrendWindowConfig; dormeur: FrequencyConfig };
  const defaultPoolWindows: PoolWindowsConfig = {
    high: { type: "custom", customUnit: "draws", customValue: 25 },
    surrepr: { type: "custom", customUnit: "draws", customValue: 25 },
    trend: { type: "custom", customUnit: "draws", customValue: 160, trendPeriodR: 65 },
    dormeur: { type: "custom", customUnit: "years", customValue: 3 },
  };
  const [poolWindows, setPoolWindows] = useState<PoolWindowsConfig>(() => {
    try {
      const raw = localStorage.getItem(LS_POOL_WINDOWS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PoolWindowsConfig & { trend?: TrendWindowConfig }>;
        const migrated: Partial<PoolWindowsConfig> = { ...parsed };
        if (!migrated.surrepr && migrated.high) migrated.surrepr = migrated.high;
        const t = migrated.trend as (FrequencyConfig & { trendPeriodR?: number }) | undefined;
        if (t && typeof t.trendPeriodR !== "number") migrated.trend = { ...t, trendPeriodR: 65 } as TrendWindowConfig;
        if (migrated?.high && migrated?.surrepr && migrated?.trend && migrated?.dormeur) return migrated as PoolWindowsConfig;
      }
    } catch {}
    return { ...defaultPoolWindows, high: freqConfig, surrepr: freqConfig };
  });

  // --- POOL SIZE SETTINGS (Top N) ---
  const LS_POOL_SIZES_KEY = "loto_poolSizes_v1";
  const EVENT_POOL_SIZES_CHANGED = "loto:poolSizesChanged";
  type PoolSizeConfig = {
    balls: { high: number; trend: number; dormeur: number };
    stars: { high: number; trend: number; dormeur: number };
  };
  const [poolSizes, setPoolSizes] = useState<PoolSizeConfig>(() => {
    const fallback: PoolSizeConfig = {
      balls: { high: 25, trend: 25, dormeur: 25 },
      stars: { high: 8, trend: 8, dormeur: 8 },
    };
    try {
      const raw = localStorage.getItem(LS_POOL_SIZES_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<PoolSizeConfig>;
      return {
        balls: {
          high: Math.min(50, Math.max(10, Number(parsed?.balls?.high ?? fallback.balls.high))),
          trend: Math.min(50, Math.max(10, Number(parsed?.balls?.trend ?? fallback.balls.trend))),
          dormeur: Math.min(50, Math.max(10, Number(parsed?.balls?.dormeur ?? fallback.balls.dormeur))),
        },
        stars: {
          high: Math.min(12, Math.max(4, Number(parsed?.stars?.high ?? fallback.stars.high))),
          trend: Math.min(12, Math.max(4, Number(parsed?.stars?.trend ?? fallback.stars.trend))),
          dormeur: Math.min(12, Math.max(4, Number(parsed?.stars?.dormeur ?? fallback.stars.dormeur))),
        },
      };
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem(LS_POOL_SIZES_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as PoolSizeConfig;
        if (!parsed?.balls || !parsed?.stars) return;
        setPoolSizes(parsed);
      } catch {}
    };
    window.addEventListener(EVENT_POOL_SIZES_CHANGED, handler as EventListener);
    return () => window.removeEventListener(EVENT_POOL_SIZES_CHANGED, handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem(LS_POOL_WINDOWS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<PoolWindowsConfig & { trend?: TrendWindowConfig }>;
        const migrated: Partial<PoolWindowsConfig> = { ...parsed };
        if (!migrated.surrepr && migrated.high) migrated.surrepr = migrated.high;
        const t = migrated.trend as (FrequencyConfig & { trendPeriodR?: number }) | undefined;
        if (t && typeof t.trendPeriodR !== "number") migrated.trend = { ...t, trendPeriodR: 65 } as TrendWindowConfig;
        if (!migrated?.high || !migrated?.surrepr || !migrated?.trend || !migrated?.dormeur) return;
        setPoolWindows(migrated as PoolWindowsConfig);
        setFreqConfig(migrated.high); // compat: "fenêtre high" visible via l'ancien réglage
      } catch {}
    };
    window.addEventListener(EVENT_POOL_WINDOWS_CHANGED, handler as EventListener);
    return () => window.removeEventListener(EVENT_POOL_WINDOWS_CHANGED, handler as EventListener);
  }, []);

  // Listen for Settings changes (same-tab)
  useEffect(() => {
      const handler = () => {
          try {
              const raw = localStorage.getItem(LS_FREQ_CONFIG_KEY);
              if (!raw) return;
              const parsed = JSON.parse(raw) as FrequencyConfig;
              if (parsed?.type === 'custom' && (!parsed.customUnit || !parsed.customValue)) return;
              setFreqConfig(parsed);
              setPoolWindows((prev) => {
                const prevHigh = prev.high;
                const prevSurrepr = prev.surrepr;
                const next = { ...prev, high: parsed };
                // Par défaut, Surrepr suit High tant que l'utilisateur ne l'a pas personnalisée
                if (isSameFreqConfig(prevSurrepr, prevHigh)) next.surrepr = parsed;
                return next;
              }); // compat: legacy => high
          } catch {}
      };
      window.addEventListener(EVENT_FREQ_CONFIG_CHANGED, handler as EventListener);
      return () => window.removeEventListener(EVENT_FREQ_CONFIG_CHANGED, handler as EventListener);
  }, []);

  // Debug (runtime evidence): generation tokens + mismatch detection
  const genSeqRef = useRef(0);
  const genTokenRef = useRef<string | null>(null);
  const genAppliedTokenRef = useRef<string | null>(null);
  const genTimeoutRef = useRef<number | null>(null);
  const autoDrawsContainerRef = useRef<HTMLDivElement | null>(null);
  const wasScrollableRef = useRef(false);

  const isSameFreqConfig = (a?: FrequencyConfig, b?: FrequencyConfig) => {
    if (!a || !b) return false;
    if (a.type !== b.type) return false;
    if (a.type !== "custom") return true;
    return a.customUnit === b.customUnit && a.customValue === b.customValue;
  };

  // Persist when changed from Console UI too
  useEffect(() => {
      try {
          localStorage.setItem(LS_FREQ_CONFIG_KEY, JSON.stringify(freqConfig));
          // Compat: si la fenêtre high est modifiée depuis la Console, on maintient aussi la config multi-fenêtres.
          const raw = localStorage.getItem(LS_POOL_WINDOWS_KEY);
          let next = { ...defaultPoolWindows, high: freqConfig, surrepr: freqConfig } as PoolWindowsConfig;
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as Partial<PoolWindowsConfig & { trend?: TrendWindowConfig }>;
              const migrated: Partial<PoolWindowsConfig> = { ...parsed };
              if (!migrated.surrepr && migrated.high) migrated.surrepr = migrated.high;
              const t = migrated.trend as (FrequencyConfig & { trendPeriodR?: number }) | undefined;
              if (t && typeof t.trendPeriodR !== "number") migrated.trend = { ...t, trendPeriodR: 65 } as TrendWindowConfig;
              if (migrated?.high && migrated?.surrepr && migrated?.trend && migrated?.dormeur) {
                const prevHigh = migrated.high;
                const prevSurrepr = migrated.surrepr;
                next = { ...(migrated as PoolWindowsConfig), high: freqConfig };
                // Par défaut, Surrepr suit High tant que l'utilisateur ne l'a pas personnalisée
                if (isSameFreqConfig(prevSurrepr, prevHigh)) next.surrepr = freqConfig;
              }
            } catch {}
          }
          localStorage.setItem(LS_POOL_WINDOWS_KEY, JSON.stringify(next));
      } catch {}
  }, [freqConfig]);
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

            // Mode is NOT loaded from localStorage - it's always based on user role
            // Set mode based on user role (ignoring any saved value)
            if (user?.role === 'admin' || user?.role === 'vip' || user?.role === 'abonne') {
                setMode('manual');
            } else {
                setMode('auto'); // invite or unknown
            }
            
            if (state.autoDraws) setAutoDraws(state.autoDraws.map((d: any) => ({...d, date: new Date(d.date)})));
            if (state.generatedNumbers) setGeneratedNumbers(state.generatedNumbers);
            if (state.generatedStars) setGeneratedStars(state.generatedStars);
            
            // Restore Config (default to "0" if not found)
            if (state.selectedPreset) setSelectedPreset(state.selectedPreset);
            else setSelectedPreset("0");
            // Load Weight Presets
            if (state.selectedWeightPreset) setSelectedWeightPreset(state.selectedWeightPreset);
            if (state.weightPresetsData) setWeightPresetsData(state.weightPresetsData);

            if (state.weightHigh !== undefined) setWeightHigh(state.weightHigh);
            // weightDormeur removed - dormeur is handled by steppers (Boules/Étoiles)

            if (state.weightStarHigh !== undefined) setWeightStarHigh(state.weightStarHigh);
            if (state.weightStarMid !== undefined) setWeightStarMid(state.weightStarMid);
            if (state.weightStarLow !== undefined) setWeightStarLow(state.weightStarLow);
            if (state.weightStarDormeur !== undefined) setWeightStarDormeur(state.weightStarDormeur);

            if (state.avoidPairExt !== undefined) setAvoidPairExt(state.avoidPairExt);
            if (state.balanceHighLow !== undefined) setBalanceHighLow(state.balanceHighLow);
            if (state.avoidPopSeq !== undefined) setAvoidPopSeq(state.avoidPopSeq);
            // IMPORTANT: Do NOT restore these 3 knobs from localStorage.
            // Default must always be 0/0/0 unless user explicitly changes them.
            
            // Manual selection & SOURCES
            if (state.selectedNumbers) setSelectedNumbers(state.selectedNumbers);
            if (state.selectedStars) setSelectedStars(state.selectedStars);
            if (state.numberSources) setNumberSources(state.numberSources);
            if (state.starSources) setStarSources(state.starSources);
            
            // Restore simplified mode (default to true if not found)
            if (state.isSimplifiedMode !== undefined) setIsSimplifiedMode(state.isSimplifiedMode);
            else setIsSimplifiedMode(true); // Default to simplified mode
        }
    } catch (e) {
        console.error("Failed to load console state", e);
    }
    
    // Always set mode based on user role (ignoring localStorage)
    if (user?.role === 'admin' || user?.role === 'vip' || user?.role === 'abonne') {
        setMode('manual');
    } else {
        setMode('auto'); // invite or unknown
    }
  }, [user]);

  useEffect(() => {
    // SAVE STATE (mode is NOT saved - it's always based on user role)
    const stateToSave = {
        // mode removed - always determined by user role
        autoDraws,
        generatedNumbers,
        generatedStars,
        selectedPreset,
        selectedWeightPreset,
        weightPresetsData,
        weightHigh,
        weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
        avoidPairExt, balanceHighLow, avoidPopSeq,
        selectedNumbers, selectedStars,
        numberSources, starSources,
        isSimplifiedMode
    };
    localStorage.setItem('console_state', JSON.stringify(stateToSave));
  }, [
    autoDraws, generatedNumbers, generatedStars, selectedPreset,
    selectedWeightPreset, weightPresetsData,
    weightHigh,
    weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
    avoidPairExt, balanceHighLow, avoidPopSeq,
    selectedNumbers, selectedStars,
    numberSources, starSources,
    isSimplifiedMode
  ]);

  // --- WEIGHT PRESET LOGIC ---
  const handleWeightPresetSelect = (presetId: string) => {
      setSelectedWeightPreset(presetId);
      setIsWeightDropdownOpen(false);
      playSound('click');

      if (presetId === "0") {
          setIsWeightsEnabled(false);
          // Reset all knobs to 0
          setWeightHigh(0);
          setWeightStarHigh(0); setWeightStarMid(0); setWeightStarLow(0); setWeightStarDormeur(0);
          toast.info("Pondérations DÉSACTIVÉES (Mode 0)");
      } else {
          setIsWeightsEnabled(true);
          
          if (weightPresetsData[presetId]) {
              // Load saved data (BALL weights only - star weights are neutralized)
              const data = weightPresetsData[presetId];
              setWeightHigh(data.weightHigh);
              setDormeurBallLevel(data.dormeurBallLevel);
              setDormeurStarLevel(data.dormeurBallLevel);
              
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
              weightHigh,
              dormeurBallLevel,
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
              weightHigh,
              dormeurBallLevel,
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
  const isInviteOrAbonne = isInvite || isAbonne; // Pour l'envoi par email uniquement
  const canUseManual = !isInvite; // Mode manuel réservé aux VIP/Admin/Abonné (invité verrouillé en auto)

  // Mode is now always set based on user role in the main useEffect - no need for this safety check

  // (Gagnants) : supprimé — aucune notification/redirect "gagnant"

  // Charger le template popup1 depuis la DB
  useEffect(() => {
    const loadPopup1Template = async () => {
      try {
        const res = await fetch('/api/popup/template/popup1', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setPopup1Html(data.template || '');
          console.log('[Console] Template popup1 chargé depuis la DB');
        } else {
          console.warn('[Console] Impossible de charger le template popup1');
        }
      } catch (err) {
        console.error('[Console] Erreur chargement template popup1:', err);
      }
    };
    loadPopup1Template();
  }, []);

  // Charger le template popup2 depuis la DB
  useEffect(() => {
    const loadPopup2Template = async () => {
      try {
        const res = await fetch('/api/popup/template/popup2', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setPopup2Html(data.template || '');
          console.log('[Console] Template popup2 chargé depuis la DB');
        } else {
          console.warn('[Console] Impossible de charger le template popup2');
        }
      } catch (err) {
        console.error('[Console] Erreur chargement template popup2:', err);
      }
    };
    loadPopup2Template();
  }, []);

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

  // Gérer les interactions du popup1 (checkbox et bouton)
  useEffect(() => {
    if (!showGratitudePopup || !popup1Html) return;

    const handleCheckboxChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.id === 'gratitude-checkbox') {
        handleDontShowAgain(target.checked);
      }
    };

    const handleButtonClick = (e: Event) => {
      const target = e.target as HTMLButtonElement;
      if (target.id === 'gratitude-validate-btn') {
        handleClosePopup();
      }
    };

    // Attacher les event listeners
    document.addEventListener('change', handleCheckboxChange);
    document.addEventListener('click', handleButtonClick);

    // Nettoyer les event listeners au démontage
    return () => {
      document.removeEventListener('change', handleCheckboxChange);
      document.removeEventListener('click', handleButtonClick);
    };
  }, [showGratitudePopup, popup1Html]);

  // Gérer les interactions du popup1 pour showInviteSendPopup (checkbox et bouton)
  useEffect(() => {
    if (!showInviteSendPopup || !popup1Html) return;

    // NOTE: On ne met PAS à jour l'état React dans handleCheckboxChange
    // car cela déclencherait un re-render qui ré-injecterait le HTML via dangerouslySetInnerHTML
    // et réinitialiserait la checkbox. On laisse le DOM gérer l'état de la checkbox.
    // handleInviteGratitudeValidate lit directement depuis le DOM.

    const handleButtonClick = (e: Event) => {
      const target = e.target as HTMLElement;
      // Chercher le bouton (peut être que le clic est sur un enfant comme le texte)
      const button = target.closest('#gratitude-validate-btn') as HTMLButtonElement;
      
      if (button || target.id === 'gratitude-validate-btn') {
        console.log('[Console] Bouton VALIDER popup1 (invité) cliqué');
        e.preventDefault();
        e.stopPropagation();
        handleInviteGratitudeValidate();
      }
    };

    document.addEventListener('click', handleButtonClick, true); // Utiliser capture phase

    return () => {
      document.removeEventListener('click', handleButtonClick, true);
    };
  }, [showInviteSendPopup, popup1Html]);

  // Gérer les interactions du popup2 (boutons OUI/NON)
  useEffect(() => {
    if (!showConsultationPopup || !popup2Html) return;

    const handleButtonClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const buttonId = target.id || target.closest('button')?.id;
      
      if (buttonId === 'consultation-no-btn' || target.closest('#consultation-no-btn')) {
        e.preventDefault();
        e.stopPropagation();
        handleConsultationNo();
      } else if (buttonId === 'consultation-yes-btn' || target.closest('#consultation-yes-btn')) {
        e.preventDefault();
        e.stopPropagation();
        handleConsultationYes();
      }
    };

    document.addEventListener('click', handleButtonClick);

    return () => {
      document.removeEventListener('click', handleButtonClick);
    };
  }, [showConsultationPopup, popup2Html]);

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

        // (debug logging removed)
        
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
          const filteredHigh = filterTirages(fullHistory, poolWindows.high);
          const filteredSurrepr = filterTirages(fullHistory, poolWindows.surrepr);
          const filteredTrend = filterTirages(fullHistory, poolWindows.trend);
          const filteredDormeur = filterTirages(fullHistory, poolWindows.dormeur);

          const newStatsHigh = computeStatsFromTirages(filteredHigh);
          const newStatsSurrepr = computeStatsFromTirages(filteredSurrepr);
          const newStatsTrend = computeStatsFromTirages(filteredTrend, {
            trendPeriodRecente: (poolWindows.trend as TrendWindowConfig).trendPeriodR ?? 65,
          });
          const newStatsDormeur = computeStatsFromTirages(filteredDormeur);

          setStats(newStatsHigh);
          setStatsSurrepr(newStatsSurrepr);
          setStatsTrend(newStatsTrend);
          setStatsDormeur(newStatsDormeur);
          setHighWindowCount(filteredHigh.length);
          setTrendWindowCount(filteredTrend.length);
          setDormeurWindowCount(filteredDormeur.length);
          setSurreprWindowCount(filteredSurrepr.length);
          
          // Toast info
          let periodName = "Historique Complet";
          if (poolWindows.high.type === 'last_year') periodName = "Dernière Année";
          else if (poolWindows.high.type === 'last_20') periodName = "20 Derniers Tirages";
          else if (poolWindows.high.type === 'custom') periodName = `Période Personnalisée`;
          
          toast.success(`Statistiques mises à jour : ${periodName} (${filteredHigh.length} tirages)`);
      }
  }, [poolWindows, fullHistory]);

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
  }, [stats, statsTrend, statsDormeur]);
  
  const mapToDisplayStat = (item: { numero: number, frequence: number }, type: 'number' | 'star', index: number): DisplayStat => {
    const defaultTrend = { direction: 'stable' as const, score: 5 };
    const trend = type === 'number' 
        ? (statsTrend?.tendancesNumeros[item.numero] || defaultTrend)
        : (statsTrend?.tendancesEtoiles ? statsTrend.tendancesEtoiles[item.numero] : defaultTrend);

    return {
      number: item.numero,
      frequency: item.frequence,
      trendScore: trend ? trend.score : 5,
      trendDirection: trend ? trend.direction : 'stable',
      rank: index + 1,
      // Affichage demandé: nombre brut de sorties dans la fenêtre (pas un % qui écrase 0/1/2 en 0/50/100)
      displayLabel: `${item.frequence}`
    };
  };

  const highFreqStats = stats?.categoriesNum.elevee.map((s, i) => mapToDisplayStat(s, 'number', i)) || [];
  const midFreqStats = stats?.categoriesNum.moyenne.map((s, i) => mapToDisplayStat(s, 'number', i)) || [];
  const lowFreqStats = (stats?.categoriesNum.basse || []).concat(stats?.categoriesNum.depart || []).map((s, i) => mapToDisplayStat(s, 'number', i)) || [];

  const highStarStats = stats?.categoriesEtoiles.elevee.map((s, i) => mapToDisplayStat(s, 'star', i)) || [];
  const midStarStats = stats?.categoriesEtoiles.moyenne.map((s, i) => mapToDisplayStat(s, 'star', i)) || [];
  const lowStarStats = stats?.categoriesEtoiles.basse.map((s, i) => mapToDisplayStat(s, 'star', i)) || [];
  
  const dormeurStats = Object.entries(statsDormeur?.absenceNumeros || {})
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

  const dormeurStarStats = Object.entries(statsDormeur?.absenceEtoiles || {})
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
      if (!stats || !statsTrend || !statsDormeur || !statsSurrepr) return null;
      
      // Create base array with all stats
      const frequencies = Object.values(stats.freqNumeros);
      const minFreq = Math.min(...frequencies);
      const maxFreq = Math.max(...frequencies);
      const freqRange = maxFreq - minFreq || 1; // Avoid division by zero
      const nSurrepr = Math.max(0, surreprWindowCount);
      const p0Ball = 5 / 50; // EuroMillions
      const denomBall = nSurrepr > 0 ? Math.sqrt(nSurrepr * p0Ball * (1 - p0Ball)) : 0;
      
      const allBalls: PoolItem[] = Array.from({ length: 50 }, (_, i) => {
          const num = i + 1;
          const defaultTrend = { direction: 'stable' as const, score: 5 };
          const trend = statsTrend.tendancesNumeros[num] || defaultTrend;
          const freq = stats.freqNumeros[num] || 0;
          // Calculate percentage: 0% = min, 100% = max
          const frequencyPercent = Math.round(((freq - minFreq) / freqRange) * 100);
          const k = statsSurrepr.freqNumeros[num] || 0;
          const expected = nSurrepr * p0Ball;
          const surreprZ = denomBall > 0 ? (k - expected) / denomBall : 0;
          return {
              number: num,
              frequency: freq,
              frequencyPercent,
              trend: trend.score,
              absence: statsDormeur.absenceNumeros[num] || 0,
              trendDirection: trend.direction,
              surreprZ
          };
      });
      
      return {
          byNumeric: [...allBalls].sort((a, b) => a.number - b.number),
          // Tie-break: à fréquence égale, la tendance départage (plus cohérent visuellement + pour les top N)
          byFrequency: [...allBalls].sort((a, b) => (b.frequency - a.frequency) || (b.trend - a.trend) || (a.number - b.number)),
          // Tie-break: à tendance égale, la fréquence départage
          byTrend: [...allBalls].sort((a, b) => (b.trend - a.trend) || (b.frequency - a.frequency) || (a.number - b.number)),
          byDormeur: [...allBalls].sort((a, b) => b.absence - a.absence),
          bySurrepr: [...allBalls].sort((a, b) => (b.surreprZ - a.surreprZ) || (a.number - b.number))
      };
  }, [stats, statsTrend, statsDormeur, statsSurrepr, surreprWindowCount]);
  
  // Pre-calculated pools for STARS (12 numbers)
  const starPools = useMemo(() => {
      if (!stats || !statsTrend || !statsDormeur || !statsSurrepr) return null;
      
      // Calculate min/max for stars
      const starFrequencies = Object.values(stats.freqEtoiles);
      const minStarFreq = Math.min(...starFrequencies);
      const maxStarFreq = Math.max(...starFrequencies);
      const starFreqRange = maxStarFreq - minStarFreq || 1;
      const nSurrepr = Math.max(0, surreprWindowCount);
      const p0Star = 2 / 12; // EuroMillions
      const denomStar = nSurrepr > 0 ? Math.sqrt(nSurrepr * p0Star * (1 - p0Star)) : 0;
      
      const allStars: PoolItem[] = Array.from({ length: 12 }, (_, i) => {
          const num = i + 1;
          const defaultTrend = { direction: 'stable' as const, score: 5 };
          const trend = statsTrend.tendancesEtoiles ? statsTrend.tendancesEtoiles[num] : defaultTrend;
          const freq = stats.freqEtoiles[num] || 0;
          const frequencyPercent = Math.round(((freq - minStarFreq) / starFreqRange) * 100);
          const k = statsSurrepr.freqEtoiles[num] || 0;
          const expected = nSurrepr * p0Star;
          const surreprZ = denomStar > 0 ? (k - expected) / denomStar : 0;
          return {
              number: num,
              frequency: freq,
              frequencyPercent,
              trend: trend ? trend.score : 5,
              absence: statsDormeur.absenceEtoiles[num] || 0,
              trendDirection: trend ? trend.direction : 'stable',
              surreprZ
          };
      });
      
      return {
          byNumeric: [...allStars].sort((a, b) => a.number - b.number),
          byFrequency: [...allStars].sort((a, b) => (b.frequency - a.frequency) || (b.trend - a.trend) || (a.number - b.number)),
          byTrend: [...allStars].sort((a, b) => (b.trend - a.trend) || (b.frequency - a.frequency) || (a.number - b.number)),
          byDormeur: [...allStars].sort((a, b) => b.absence - a.absence),
          bySurrepr: [...allStars].sort((a, b) => (b.surreprZ - a.surreprZ) || (a.number - b.number))
      };
  }, [stats, statsTrend, statsDormeur, statsSurrepr, surreprWindowCount]);

  const formatZ = (z: number) => {
    const v = Number.isFinite(z) ? z : 0;
    const sign = v >= 0 ? "+" : "";
    return `z=${sign}${v.toFixed(1)}`;
  };

  const lcdText =
    simplifiedSortOrder === "numeric"
      ? "Remplir la grille"
      : simplifiedSortOrder === "frequency"
        ? `N=${highWindowCount}`
        : simplifiedSortOrder === "trend"
          ? `N=${trendWindowCount}`
          : simplifiedSortOrder === "dormeur"
            ? `N=${dormeurWindowCount}`
            : `N=${surreprWindowCount}`;
  
  // Helper to get rank in a pool (for tie-breaking)
  const getRankInPool = (pool: PoolItem[] | undefined, num: number): number => {
      if (!pool) return 999;
      const index = pool.findIndex(item => item.number === num);
      return index >= 0 ? index : 999;
  };
  
  // --- SIMPLIFIED MODE: Get sorted stats with priority-based tie-breaking ---
  const getSimplifiedBallStats = (sortMode: 'numeric' | 'surrepr' | 'frequency' | 'trend' | 'dormeur'): DisplayStat[] => {
      if (!ballPools) return [];
      
      // Get the primary sorted pool based on mode
      let basePool: PoolItem[];
      if (sortMode === 'numeric') {
          basePool = ballPools.byNumeric;
      } else if (sortMode === 'surrepr') {
          basePool = ballPools.bySurrepr;
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
          } else if (sortMode === 'surrepr') {
              diff = b.surreprZ - a.surreprZ;
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
          // Affichage demandé: la fréquence brute au-dessus, et la tendance (déjà sous la boule).
          // En mode dormeur, on garde l'absence comme indicateur principal.
          displayLabel:
            sortMode === 'dormeur'
              ? `${item.absence}`
              : sortMode === 'surrepr'
                ? formatZ(item.surreprZ)
                : `${item.frequency}`
      }));
  };
  
  const getSimplifiedStarStats = (sortMode: 'numeric' | 'surrepr' | 'frequency' | 'trend' | 'dormeur'): DisplayStat[] => {
      if (!starPools) return [];
      
      let basePool: PoolItem[];
      if (sortMode === 'numeric') {
          basePool = starPools.byNumeric;
      } else if (sortMode === 'surrepr') {
          basePool = starPools.bySurrepr;
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
          } else if (sortMode === 'surrepr') {
              diff = b.surreprZ - a.surreprZ;
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
          // Affichage demandé: fréquence brute au-dessus, tendance sous la boule.
          displayLabel:
            sortMode === 'dormeur'
              ? `${item.absence}`
              : sortMode === 'surrepr'
                ? formatZ(item.surreprZ)
                : `${item.frequency}`
      }));
  };

  // --- FORBO ALGORITHM: DYNAMIC CATEGORY RESOLUTION ---
  // Mid/Low have been removed: only High + Dormeur remain.
  const resolveCategory = (num: number, type: 'number' | 'star'): 'high' | 'dormeur' | null => {
      const candidates: { cat: 'high' | 'dormeur', rank: number }[] = [];

      if (type === 'number') {
          // Check High
          const h = highFreqStats.find(s => s.number === num);
          if (h && h.rank) candidates.push({ cat: 'high', rank: h.rank });
          
          // Check Dormeur
          const d = dormeurStats.find(s => s.number === num);
          if (d && d.rank) candidates.push({ cat: 'dormeur', rank: d.rank });
      } else {
          // Check High Star
          const h = highStarStats.find(s => s.number === num);
          if (h && h.rank) candidates.push({ cat: 'high', rank: h.rank });
          
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
    // Priority: Dormeur > High
    
    // 1. Check Dormeur (Top 10)
    const topDormeurs = dormeurStats.slice(0, NUMBER_POOL_LIMIT).map(s => s.number);
    if (topDormeurs.includes(num)) return 'dormeur';

    // 2. Check High (Top 10)
    const topHigh = highFreqStats.slice(0, NUMBER_POOL_LIMIT).map(s => s.number);
    if (topHigh.includes(num)) return 'high';

    // 5. Hors Catégorie (Not visible in any pool)
    return null; 
  };

  const getStarCategory = (num: number) => {
    // STRICT VISIBILITY RULE: Only count if visible in the Pool (Top 12)
    // Priority: Dormeur > High

    // 1. Check Dormeur (Top 12)
    const topStarDormeurs = dormeurStarStats.slice(0, STAR_POOL_LIMIT).map(s => s.number);
    if (topStarDormeurs.includes(num)) return 'dormeur';

    // 2. Check High (Top 12)
    const topHigh = highStarStats.slice(0, STAR_POOL_LIMIT).map(s => s.number);
    if (topHigh.includes(num)) return 'high';

    return null;
  };



  const getStarSelectionCounts = () => {
    const counts = { high: 0, dormeur: 0 };
    selectedStars.forEach(n => {
        const cat = getStarCategory(n);
        if (cat === 'high') counts.high++;
        else if (cat === 'dormeur') counts.dormeur++;
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

      const currentNumCount = selectedTariff ? selectedTariff.nums : weightHigh;
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

  }, [weightHigh, selectedTariff]); // Trigger when tariff/weights change


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
  const toggleSelection = (num: number, type: 'number' | 'star', category?: 'high' | 'dormeur') => {
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

    // USE SELECTED TARIFF FOR PRICE DISPLAY
    const currentPrice = selectedTariff 
        ? selectedTariff.price 
        : 0;
    
    // For visual info only
    const displayNumCount = selectedTariff ? selectedTariff.nums : 0;
    const displayStarCount = selectedTariff ? selectedTariff.stars : 0;
    
    const isValide = isCombinaisonValide(displayNumCount, displayStarCount);

  // --- PRESET LOGIC ---

  // Reset all settings to default values (preset 0)
  const resetToDefault = () => {
    // Reset weights
    setWeightHigh(0);
    setDormeurBallLevel(0);
    setDormeurStarLevel(0);
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
    
    // Reset hazard, tendency and dormeur
    setHazardLevel(0);
    setTendencyLevel(0);
    setDormeurBallLevel(0);
    setDormeurStarLevel(0);
    
    // Mode is NOT reset - it's always based on user role
    // If user is Admin/VIP/Abonné, mode stays 'manual'
    // If user is Invité, mode stays 'auto'
    
    // Reset price/tariff
    setSelectedTariff(null);
    
    // Reset simplified mode (always true - classic mode removed)
    setIsSimplifiedMode(true);
    
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
                setWeightHigh(presetData.weightHigh);
                // dormeur handled by steppers (Boules/Étoiles)
                setWeightStarHigh(presetData.weightStarHigh);
                setWeightStarMid(presetData.weightStarMid);
                setWeightStarLow(presetData.weightStarLow);
                setWeightStarDormeur(presetData.weightStarDormeur || 0);
                
                setAvoidPairExt(presetData.avoidPairExt);
                setBalanceHighLow(presetData.balanceHighLow);
                setAvoidPopSeq(presetData.avoidPopSeq);
                setAvoidFriday(presetData.avoidFriday);

                // Mode is NOT restored from preset - it's always based on user role
                
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
        weightHigh,
        weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
        avoidPairExt, balanceHighLow, avoidPopSeq, avoidFriday,
        mode,
        // Nouveaux paramètres
        hazardLevel,
        tendencyLevel,
        dormeurBallLevel,
        dormeurStarLevel,
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
        weightHigh,
        weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
        avoidPairExt, balanceHighLow, avoidPopSeq, avoidFriday,
        mode,
        // Nouveaux paramètres
        hazardLevel,
        tendencyLevel,
        dormeurBallLevel,
        dormeurStarLevel,
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
              setWeightHigh(config.weightHigh);
              if (config.dormeurBallLevel !== undefined) setDormeurBallLevel(config.dormeurBallLevel);
              if (config.dormeurStarLevel !== undefined) setDormeurStarLevel(config.dormeurStarLevel);
              
              setWeightStarHigh(config.weightStarHigh);
              setWeightStarMid(config.weightStarMid);
              setWeightStarLow(config.weightStarLow);
              setWeightStarDormeur(config.weightStarDormeur);
              
              setAvoidPairExt(config.avoidPairExt);
              setBalanceHighLow(config.balanceHighLow);
              setAvoidPopSeq(config.avoidPopSeq);
              
              // Mode is NOT restored from config - it's always based on user role
              
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

  const handleGenerate = (modeOverride?: 'manual' | 'auto') => {
    const effectiveMode = typeof modeOverride === 'string' ? modeOverride : mode;
    let tokenLocal: string | null = null;
    let seqLocal = 0;

    setIsGenerating(true);
    setShowSuccessMessage(false);
    playSound('toggle');

    // --- SYNCHRONOUS CALCULATION START ---
    // Calculate results IMMEDIATELY to ensure we access the current state correctly
    // and avoid any closure staleness issues with setTimeout.
    
    let calculatedNums: number[] = [];
    let calculatedStars: number[] = [];
    let calcNumSources: Record<number, 'high' | 'dormeur'> = {};
    let calcStarSources: Record<number, 'high' | 'dormeur'> = {};
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
            // DORMEUR is now handled as a post-processing replacement (percentage steppers),
            // so it no longer participates in weight distribution.
            const effectiveWeightHigh = weightHigh;
            const effectiveWeightDormeur = 0;
            
            // Calculate total from effective weights
            const weightTotalNums = effectiveWeightHigh + effectiveWeightDormeur;
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
                const proportionDormeur = effectiveWeightDormeur / weightTotalNums;
                
                // Apply proportions to target stars (round, ensuring we don't exceed targetStars)
                effectiveStarHigh = Math.round(proportionHigh * targetStars);
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

            // 1. Define Pools
            // Before: based on visible categories (Top10 / Top4), which caps CHAOS exploration.
            // Now: pools expand with CHAOS using full sorted lists (50 balls / 12 stars).
            // Ensure we handle potential empty stats gracefully by defaulting to the previous visible pools.
            const safeHighStats = highFreqStats || [];
            const safeDormeurStats = dormeurStats || [];

            const safeHighStarStats = highStarStats || [];
            const safeDormeurStarStats = dormeurStarStats || [];

            const chaosCandidateRatio = Math.min(1, Math.max(0, hazardLevel / 10)); // 0..1
            // The user can cap the max candidate pool size per pool in Settings (Top N).
            // CHAOS then expands from a minimum baseline (10 balls / 4 stars) up to that max.
            const highCountNums = Math.max(10, Math.min(50, Math.round(10 + chaosCandidateRatio * (poolSizes.balls.high - 10))));
            const dormeurCountNums = Math.max(10, Math.min(50, Math.round(10 + chaosCandidateRatio * (poolSizes.balls.dormeur - 10))));
            const trendCountNums = Math.max(10, Math.min(50, Math.round(10 + chaosCandidateRatio * (poolSizes.balls.trend - 10))));

            const highCountStars = Math.max(4, Math.min(12, Math.round(4 + chaosCandidateRatio * (poolSizes.stars.high - 4))));
            const dormeurCountStars = Math.max(4, Math.min(12, Math.round(4 + chaosCandidateRatio * (poolSizes.stars.dormeur - 4))));
            const trendCountStars = Math.max(4, Math.min(12, Math.round(4 + chaosCandidateRatio * (poolSizes.stars.trend - 4))));

            const poolHigh = (ballPools?.byFrequency?.slice(0, highCountNums).map(s => s.number)) ?? safeHighStats.slice(0, 10).map(s => s.number);
            const poolDormeur = (ballPools?.byDormeur?.slice(0, dormeurCountNums).map(s => s.number)) ?? safeDormeurStats.slice(0, 10).map(s => s.number);
            const poolTrend = (ballPools?.byTrend?.slice(0, trendCountNums).map(s => s.number)) ?? [];

            // Stars: expand using full 12-star pools when available
            const poolStarHigh = (starPools?.byFrequency?.slice(0, highCountStars).map(s => s.number)) ?? safeHighStarStats.slice(0, 12).map(s => s.number);
            const poolStarDormeur = (starPools?.byDormeur?.slice(0, dormeurCountStars).map(s => s.number)) ?? safeDormeurStarStats.slice(0, 4).map(s => s.number);
            const poolStarTrend = (starPools?.byTrend?.slice(0, trendCountStars).map(s => s.number)) ?? [];

            // Safety check: If pools are empty (stats not loaded), we can't generate statistically
            if (poolHigh.length === 0) {
                console.error("CRITICAL: Stats appear empty during generation");
                // We will NOT use random fallback as requested, but we must alert the user or retry logic
                // For now, let's proceed, maybe lower pools have data?
            }

            // (debug logging removed)

            // HAZARD SORT LOGIC
            const hazardMultipliers = [0, 5, 10, 20, 35, 50, 75, 100, 150, 250];
            const currentMultiplier = hazardMultipliers[hazardLevel] || 0;

            // Leak Probability REMOVED
            // const leakProbability = hazardLevel * 0.1;

            // Combined pools for stat-based selection:
            // IMPORTANT (user rule): the base must always be FREQUENCY (High).
            // TENDANCES must NOT mean "100% pool tendance". It only influences ordering/scoring inside the frequency pool.
            // DORMEUR is a separate pool (exploration or post-processing replacement).
            const includeTrend = tendencyLevel > 0; // used for scoring only
            const includeDormeur = hazardLevel > 0 || dormeurBallLevel > 0 || dormeurStarLevel > 0;
            const combinedNumPool = [
              ...poolHigh,
              ...(includeDormeur ? poolDormeur : []),
            ];
            const combinedStarPool = [
              ...poolStarHigh,
              ...(includeDormeur ? poolStarDormeur : []),
            ];
                
            // Get full stats for scoring (so ANY candidate has real frequency/trend values)
            const allNumStats: DisplayStat[] = (ballPools?.byNumeric || []).map(item => ({
                number: item.number,
                frequency: item.frequency,
                trendScore: item.trend,
                trendDirection: item.trendDirection
            }));
            const allStarStats: DisplayStat[] = (starPools?.byNumeric || []).map(item => ({
                number: item.number,
                frequency: item.frequency,
                trendScore: item.trend,
                trendDirection: item.trendDirection
            }));

            // Helper to pick based on CHAOS, TENDANCES and DORMEUR
            let loggedPickNums = false;
            let loggedPickStars = false;
            // Track "selection score" (finalScore) used during picks for later dormeur replacement.
            const selectionScoreNums: Record<number, number> = {};
            const selectionScoreStars: Record<number, number> = {};
            const pickWithStats = (pool: number[], stats: typeof allNumStats, count: number, exclude: number[] = [], dormeurPool: number[] = []) => {
                const uniquePool = Array.from(new Set(pool)).filter(n => !exclude.includes(n));
                
                // Map pool numbers to their stats
                const poolWithStats = uniquePool.map(num => {
                    const stat = stats.find(s => s.number === num);
                    const isDormeur = dormeurPool.includes(num);
                    return {
                        num,
                        frequency: stat?.frequency || 0,
                        trendScore: stat?.trendScore || 0,
                        isDormeur
                    };
                });
                    
                // Sort based on CHAOS and TENDANCES
                // - Base MUST remain frequency-first.
                // - TENDANCES influences ordering inside close/identical frequencies (tie-break / bonus),
                //   but must not replace frequency as the primary signal even at TENDANCES=10.
                // Chaos réduit de moitié : max 0.5 à Chaos 10 (équilibre stats/hasard)
                const chaosRatio = hazardLevel / 20; // 0..0.5
                const tendanceWeight = tendencyLevel / 10; // 0..1

                const poolFreqs = poolWithStats.map(it => it.frequency);
                const poolMinFreq = poolFreqs.length ? Math.min(...poolFreqs) : 0;
                const poolMaxFreq = poolFreqs.length ? Math.max(...poolFreqs) : 0;
                const poolFreqRange = poolMaxFreq - poolMinFreq || 1;

                const sorted = poolWithStats
                    .map(item => {
                        // Trend bonus bounded to <= 0.5 * freqRange at TENDANCES=10
                        const trendBonus = (tendanceWeight * (item.trendScore / 10)) * (poolFreqRange * 0.5);
                        // Chaos noise bounded to <= 0.5 * freqRange at CHAOS=10 (since chaosRatio max 0.5)
                        const randomFactor = Math.random() * poolFreqRange * chaosRatio;
                        const finalScore = item.frequency + trendBonus + randomFactor;
                        return { ...item, finalScore };
                    })
                    .sort((a, b) =>
                        (b.finalScore - a.finalScore) ||
                        // deterministic fallback to reduce flicker when scores are equal
                        (b.frequency - a.frequency) ||
                        (b.trendScore - a.trendScore) ||
                        (a.num - b.num)
                    );

                const pickedSlice = sorted.slice(0, count);
                const isStarContext = stats === allStarStats;
                pickedSlice.forEach(s => {
                    if (isStarContext) selectionScoreStars[s.num] = s.finalScore;
                    else selectionScoreNums[s.num] = s.finalScore;
                });
                return pickedSlice.map(s => s.num);
            };

            // Check if weights are all zero (pure stats mode)
            // Now only checks ball weights since star weights are derived from balls
            const weightsAreZero = weightTotalNums === 0;

            // Helper: Determine source category for a number based on which pool it came from
            const getSourceCategory = (num: number, isStar: boolean): 'high' | 'dormeur' => {
                if (isStar) {
                    if (poolStarHigh.includes(num)) return 'high';
                    if (poolStarDormeur.includes(num)) return 'dormeur';
                } else {
                    if (poolHigh.includes(num)) return 'high';
                    if (poolDormeur.includes(num)) return 'dormeur';
                }
                return 'high'; // fallback
            };

            if (!isWeightsEnabled || weightsAreZero) {
                // --- PURE STATISTICS MODE ---
                calculatedNums = pickWithStats(combinedNumPool, allNumStats, totalNums, [], poolDormeur).sort((a, b) => a - b);
                calculatedNums.forEach(num => {
                    calcNumSources[num] = getSourceCategory(num, false);
                });
                
                // Stars: always pure stats (no dormeur forcing for stars)
                calculatedStars = pickWithStats(combinedStarPool, allStarStats, totalStars, [], poolStarDormeur).sort((a, b) => a - b);
                calculatedStars.forEach(num => {
                    calcStarSources[num] = getSourceCategory(num, true);
                });
            } else {
                // --- WEIGHTED MODE (PONDÉRÉ) ---
                // When pondérations are enabled and non-zero, we must generate a grid here.

                // 1) Determine how many numbers to pick from each pool.
                // We treat knob values as requested counts; clamp to tariff total.
                let wantHigh = Math.max(0, Math.floor(effectiveWeightHigh));
                let wantDormeur = Math.max(0, Math.floor(effectiveWeightDormeur));

                // Clamp down if the sum exceeds the tariff total.
                // Preference: keep Dormeur and High first, reduce Low -> Mid -> High -> Dormeur.
                let sumWant = wantHigh + wantDormeur;
                while (sumWant > totalNums) {
                    if (wantHigh > 0) wantHigh--;
                    else if (wantDormeur > 0) wantDormeur--;
                    sumWant = wantHigh + wantDormeur;
                }

                // 2) Pick numbers per category, ensuring uniqueness via exclude.
                const pickedNums: number[] = [];
                const pickCategory = (pool: number[], count: number) => {
                    if (count <= 0) return;
                    const chosen = pickWithStats(pool, allNumStats, count, pickedNums, poolDormeur);
                    chosen.forEach(n => {
                        if (!pickedNums.includes(n)) pickedNums.push(n);
                    });
                };

                pickCategory(poolHigh, wantHigh);
                pickCategory(poolDormeur, wantDormeur);

                // 3) Complete remaining numbers with best overall weighted picks.
                const remainingNumsCount = totalNums - pickedNums.length;
                if (remainingNumsCount > 0) {
                    const extra = pickWithStats(combinedNumPool, allNumStats, remainingNumsCount, pickedNums, poolDormeur);
                    extra.forEach(n => {
                        if (!pickedNums.includes(n)) pickedNums.push(n);
                    });
                }

                calculatedNums = pickedNums.slice(0, totalNums).sort((a, b) => a - b);
                calculatedNums.forEach(num => {
                    calcNumSources[num] = getSourceCategory(num, false);
                });

                // 4) Stars: use the already computed effectiveStar* counts; clamp and pick similarly.
                let wantStarHigh = Math.max(0, Math.floor(effectiveStarHigh));
                let wantStarDormeur = Math.max(0, Math.floor(effectiveStarDormeur));

                let sumStarWant = wantStarHigh + wantStarDormeur;
                while (sumStarWant > totalStars) {
                    if (wantStarDormeur > 0) wantStarDormeur--;
                    else if (wantStarHigh > 0) wantStarHigh--;
                    sumStarWant = wantStarHigh + wantStarDormeur;
                }

                const pickedStars: number[] = [];
                const pickStarCategory = (pool: number[], count: number) => {
                    if (count <= 0) return;
                    const chosen = pickWithStats(pool, allStarStats, count, pickedStars, poolStarDormeur);
                    chosen.forEach(n => {
                        if (!pickedStars.includes(n)) pickedStars.push(n);
                    });
                };

                pickStarCategory(poolStarHigh, wantStarHigh);
                pickStarCategory(poolStarDormeur, wantStarDormeur);

                const remainingStarsCount = totalStars - pickedStars.length;
                if (remainingStarsCount > 0) {
                    const extraStars = pickWithStats(combinedStarPool, allStarStats, remainingStarsCount, pickedStars, poolStarDormeur);
                    extraStars.forEach(n => {
                        if (!pickedStars.includes(n)) pickedStars.push(n);
                    });
                }

                calculatedStars = pickedStars.slice(0, totalStars).sort((a, b) => a - b);
                calculatedStars.forEach(num => {
                    calcStarSources[num] = getSourceCategory(num, true);
                });
            }

            // --- DORMEUR % REPLACEMENT (post-processing) ---
            if (effectiveMode === 'auto' && (dormeurBallLevel > 0 || dormeurStarLevel > 0)) {
                // For small totals (ex: 2 stars), floor can yield 0 even if user asked dormeurs > 0.
                // Use rounded percentage with a minimum of 1 when level > 0.
                const k = Math.min(
                    totalNums,
                    dormeurBallLevel > 0 ? Math.max(1, Math.round((totalNums * dormeurBallLevel) / 10)) : 0
                );
                const ks = Math.min(
                    totalStars,
                    dormeurStarLevel > 0 ? Math.max(1, Math.round((totalStars * dormeurStarLevel) / 10)) : 0
                );

                // 1) Numbers
                if (k > 0) {
                    const beforeNums = [...calculatedNums];
                    const scored = calculatedNums.map(n => ({ n, score: selectionScoreNums[n] ?? Number.POSITIVE_INFINITY }));
                    scored.sort((a, b) => a.score - b.score);
                    const toReplace = scored.slice(0, k).map(x => x.n);
                    const remaining = calculatedNums.filter(n => !toReplace.includes(n));
                    const dormeurPoolFull = dormeurStats.map(s => s.number); // sorted by absence desc
                    const injected: number[] = [];
                    for (const cand of dormeurPoolFull) {
                        if (injected.length >= k) break;
                        if (remaining.includes(cand) || injected.includes(cand) || toReplace.includes(cand)) continue;
                        injected.push(cand);
                    }
                    toReplace.forEach(n => { delete calcNumSources[n]; });
                    injected.forEach(n => { calcNumSources[n] = 'dormeur'; });
                    calculatedNums = [...remaining, ...injected].slice(0, totalNums).sort((a, b) => a - b);

                    setLastDormeurProof(prev => ({
                        at: Date.now(),
                        effectiveMode,
                        stars: prev?.stars,
                        nums: {
                            level: dormeurBallLevel,
                            k,
                            before: beforeNums.slice().sort((a, b) => a - b),
                            toReplace,
                            injected,
                            after: calculatedNums,
                        },
                    }));

                    // (debug logging removed)
                }

                // 2) Stars
                if (ks > 0) {
                    const beforeStars = [...calculatedStars];
                    const scoredS = calculatedStars.map(n => ({ n, score: selectionScoreStars[n] ?? Number.POSITIVE_INFINITY }));
                    scoredS.sort((a, b) => a.score - b.score);
                    const toReplaceS = scoredS.slice(0, ks).map(x => x.n);
                    const remainingS = calculatedStars.filter(n => !toReplaceS.includes(n));
                    const dormeurPoolStarsFull = dormeurStarStats.map(s => s.number);
                    const injectedS: number[] = [];
                    for (const cand of dormeurPoolStarsFull) {
                        if (injectedS.length >= ks) break;
                        if (remainingS.includes(cand) || injectedS.includes(cand) || toReplaceS.includes(cand)) continue;
                        injectedS.push(cand);
                    }
                    toReplaceS.forEach(n => { delete calcStarSources[n]; });
                    injectedS.forEach(n => { calcStarSources[n] = 'dormeur'; });
                    calculatedStars = [...remainingS, ...injectedS].slice(0, totalStars).sort((a, b) => a - b);

                    setLastDormeurProof(prev => ({
                        at: Date.now(),
                        effectiveMode,
                        nums: prev?.nums,
                        stars: {
                            level: dormeurStarLevel,
                            ks,
                            before: beforeStars.slice().sort((a, b) => a - b),
                            toReplace: toReplaceS,
                            injected: injectedS,
                            after: calculatedStars,
                        },
                    }));

                    // (debug logging removed)
                }
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
    const timeoutId = window.setTimeout(() => {
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
             // VIP/Admin/Abonné: visible immédiatement, Invite: toujours masqué
             const newDraw = { nums: calculatedNums, stars: calculatedStars, date: new Date(), revealed: isAdminOrVip || isAbonne };
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
    genTimeoutRef.current = timeoutId;
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
      setDormeurBallLevel(0);
      setDormeurStarLevel(0);
      
      // Weights - Étoiles
      setWeightStarHigh(0);
      setWeightStarMid(0);
      setWeightStarLow(0);
      setWeightStarDormeur(0);

      // 3. Reset Tarif (prix de la grille)
      setSelectedTariff(null);
      
      // 4. Reset Chaos et Tendance
      // Chaos à 0 = minimum de chaos (100% statistiques)
      // Tendance à 0 = aucune influence tendance (stat pure)
      setHazardLevel(0);
      setTendencyLevel(0);
      
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
      
      // 9. Reset preset sélectionné
      setSelectedPreset("0");
      
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

      // Pour les invités uniquement : vérifier le mode
      if (isInvite) {
          if (emailModeEnabled) {
              // Mode Email : envoyer par email (sans popup)
              executeEmailSend();
          } else {
              // Mode Direct : afficher popup gratitude
              setShowInviteSendPopup(true);
              setInviteGratitudeAccepted(false);
          }
          return;
      }

      // Pour les abonnés : envoyer par email (comportement actuel)
      if (isAbonne) {
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
          // Récupérer la date du prochain tirage (même logique que saveGridToDB)
          const nextDraw = getProchainTirage();
          const targetDateStr = nextDraw.date.toISOString().split('T')[0]; // Format YYYY-MM-DD
          
          // Préparer les grilles à envoyer avec targetDate
          const drawsToSend = autoDraws.length > 0 
              ? autoDraws.map(d => ({ nums: d.nums, stars: d.stars, targetDate: targetDateStr }))
              : [{ nums: generatedNumbers, stars: generatedStars, targetDate: targetDateStr }];

          // Appeler l'API pour envoyer l'email
          const response = await fetch('/api/draws/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ draws: drawsToSend }),
          });
          
          const data = await response.json();
          
          if (data.success) {
              // Pour les invités : NE PAS sauvegarder en DB ici (sera fait après confirmation email)
              // Pour les abonnés : sauvegarder directement
              if (isAbonne && !isInvite) {
                  for (const draw of drawsToSend) {
                      if (draw.nums.length > 0 && draw.stars.length > 0) {
                          await saveGridToDB(draw.nums, draw.stars);
                      }
                  }
              }
              
              playSound('bling');
              setSendingMessage(`📧 EMAIL ENVOYÉ !`);
              
              if (isInvite) {
                  toast.success(`Un email de confirmation vous a été envoyé. Vérifiez votre boîte mail et confirmez pour recevoir vos numéros !`, {
                      duration: 8000,
                  });
              } else {
                  toast.success(`Un email vous a été envoyé avec ${drawsToSend.length} grille(s). Vérifiez votre boîte mail !`, {
                      duration: 8000,
                  });
              }
              
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

  // Fonction pour valider le popup gratitude invité et envoyer directement
  const handleInviteGratitudeValidate = async () => {
      // Lire directement la valeur de la checkbox au lieu de se fier à l'état (stale closure)
      const checkbox = document.getElementById('gratitude-checkbox') as HTMLInputElement;
      const isAccepted = checkbox?.checked || false;
      
      console.log('[Console] handleInviteGratitudeValidate appelée', { isAccepted, inviteGratitudeAccepted, showInviteSendPopup });
      if (!isAccepted) {
          console.log('[Console] Case non cochée, affichage erreur');
          toast.error('Vous devez accepter en cochant la case');
          return;
      }
      console.log('[Console] Validation OK, poursuite du traitement');

      setShowInviteSendPopup(false);
      
      // Récupérer la date du prochain tirage (même logique que saveGridToDB)
      const nextDraw = getProchainTirage();
      const targetDateStr = nextDraw.date.toISOString().split('T')[0]; // Format YYYY-MM-DD
      
      // Préparer les grilles à sauvegarder et envoyer avec targetDate
      const drawsToSave = autoDraws.length > 0 
          ? autoDraws.map(d => ({ nums: d.nums, stars: d.stars, targetDate: targetDateStr }))
          : [{ nums: generatedNumbers, stars: generatedStars, targetDate: targetDateStr }];
      
      // IMPORTANT: si le toggle EMAIL est OFF, on ne doit envoyer AUCUN email.
      // On ne touche donc pas à /api/draws/send-direct : on sauvegarde seulement les grilles, puis popup2.
      if (!emailModeEnabled) {
          setIsSending(true);
          try {
              let savedCount = 0;
              for (const draw of drawsToSave) {
                  if ((draw.nums?.length || 0) > 0 && (draw.stars?.length || 0) > 0) {
                      const saved = await saveGridToDB(draw.nums, draw.stars);
                      if (saved) savedCount++;
                  }
              }

              playSound('bling');
              toast.success(`${savedCount} grille(s) sauvegardée(s). Aucun email n'a été envoyé.`);

              // Vider les grilles et rester sur la console
              setAutoDraws([]);
              setGeneratedNumbers([]);
              setGeneratedStars([]);
              setSendCount(prev => prev + savedCount);

              // Afficher le popup de consultation
              setShowConsultationPopup(true);
              return;
          } catch (error: any) {
              console.error('Erreur sauvegarde grilles (mode sans email):', error);
              playSound('error');
              toast.error(error?.message || "Erreur lors de la sauvegarde. Réessayez.");
              return;
          } finally {
              setIsSending(false);
          }
      }

      setIsSending(true);
      try {
          // Appeler l'API pour sauvegarder les grilles ET envoyer l'email 2 automatiquement
          const response = await fetch('/api/draws/send-direct', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ draws: drawsToSave }),
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.success) {
              throw new Error(data.error || 'Erreur lors de l\'envoi');
          }
          
          playSound('bling');
          toast.success(`${drawsToSave.length} grille(s) envoyée(s) ! L'email avec vos numéros vous a été envoyé.`);
          
          // Vider les grilles et rester sur la console
          setAutoDraws([]);
          setGeneratedNumbers([]);
          setGeneratedStars([]);
          setSendCount(prev => prev + drawsToSave.length);
          
          // Afficher le popup de consultation
          setShowConsultationPopup(true);
          
          // Pas de redirection - l'utilisateur reste sur la console
          // Il peut aller voir ses grilles manuellement via le menu "Mes Grilles Jouées" s'il le souhaite
      } catch (error: any) {
          console.error('Erreur sauvegarde grilles:', error);
          playSound('error');
          toast.error(error.message || "Erreur lors de la sauvegarde. Réessayez.");
      } finally {
          setIsSending(false);
      }
  };

  // Fonction pour gérer la consultation des grilles (bouton Oui)
  const handleConsultationYes = () => {
      setShowConsultationPopup(false);
      // Simuler l'action Menu : naviguer vers Mes grilles jouées
      setLocation('/my-grids?highlight=1');
      playSound('click');
  };

  // Fonction pour fermer le popup de consultation (bouton Non)
  const handleConsultationNo = () => {
      setShowConsultationPopup(false);
      playSound('click');
  };

  // Fonction d'exécution de l'envoi LOCAL (pour VIP/Admin)
  const executeSend = async () => {
      // Set active sending state
      setIsSending(true);
      
      let grillesToSend = 0;
      
      // Sauvegarder TOUTES les grilles de autoDraws dans la DB
      if (autoDraws.length > 0) {
          for (const draw of autoDraws) {
              if (draw.nums.length > 0 && draw.stars.length > 0) {
                  await saveGridToDB(draw.nums, draw.stars);
                  grillesToSend++;
              }
          }
      } else if (generatedNumbers.length > 0 && generatedStars.length > 0) {
          // Fallback: sauvegarder la grille actuelle si pas d'autoDraws
          await saveGridToDB(generatedNumbers, generatedStars);
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

  const ActionsControls = ({ variant = 'panel' }: { variant?: 'panel' | 'rack' }) => {
    if (variant === 'rack') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-evenly">
          {/* Send / Trash / Envois (au-dessus des boutons Rechercher/Valider) */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
            <div className="rounded-xl overflow-hidden">
              <CasinoButton 
                variant="primary"
                size="md"
                className={cn(
                  // Calqué sur le format des boutons RECHERCHER / VALIDER
                  "rounded-none text-sm px-4 py-[10px] w-[140px] flex items-center justify-center",
                  // Couleur (bleu clair) à la place du jaune
                  "bg-gradient-to-b from-sky-400 to-sky-600 text-white border-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.35)] hover:shadow-[0_0_18px_rgba(56,189,248,0.6)]",
                  autoDraws.length === 0 ? "opacity-50 cursor-not-allowed" : ""
                )}
                onClick={handleSend}
                disabled={autoDraws.length === 0}
              >
                {isSending ? "..." : "ENVOYER"}
              </CasinoButton>
            </div>

            <div className="flex items-center gap-2 ml-1 text-[22px] text-zinc-300 font-bold">
              <span>Envois:</span>
              <span className="text-casino-gold tabular-nums">{sendCount}</span>
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

            {!showClearConfirm ? (
              <button 
                id="trash-actions-rack"
                onClick={() => setShowClearConfirm(true)}
                className="w-11 h-11 flex items-center justify-center bg-red-900/30 border border-red-500/50 rounded-lg text-red-500 hover:bg-red-900/50 hover:text-red-400 hover:border-red-400 transition-all"
                title="Effacer l'historique"
              >
                <Trash2 size={18} />
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-black border border-red-500 rounded-lg p-1 animate-in fade-in duration-200">
                <button 
                  onClick={() => {
                    setAutoDraws([]);
                    setGeneratedNumbers([]);
                    setGeneratedStars([]);
                    setSelectedNumbers([]);
                    setSelectedStars([]);
                    setNumberSources({});
                    setStarSources({});
                    setShowClearConfirm(false);
                    playSound('click');
                    toast.success("Historique effacé");
                  }}
                  className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded"
                >
                  OK
                </button>
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold rounded"
                >
                  NON
                </button>
              </div>
            )}
            </div>
          </div>

          {/* Ligne du bas : dupliquée de la ligne du haut, puis adaptée (Rechercher / Email / Toggle) */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <div className="rounded-xl overflow-hidden">
                <CasinoButton
                  variant="primary"
                  size="md"
                  className={cn(
                    // Même gabarit que ENVOYER (ligne du haut)
                    "rounded-none text-sm px-4 py-[10px] w-[140px] flex items-center justify-center",
                    // Couleurs : rouge si pas de tarif, vert si OK (pas de shadow)
                    !selectedTariff
                      ? "bg-gradient-to-b from-red-600 to-red-900 text-white border-red-500 cursor-not-allowed"
                      : "bg-gradient-to-b from-green-600 to-green-900 border-green-500 text-white hover:from-green-500 hover:to-green-800",
                    isGenerating ? "opacity-60 cursor-not-allowed" : ""
                  )}
                  onClick={() => {
                    if (!selectedTariff || isGenerating) {
                      playSound('error');
                      return;
                    }
                    // En manuel, on lance la recherche auto (même comportement qu'avant)
                    handleGenerate(mode === 'manual' ? 'auto' : undefined);
                  }}
                  disabled={!selectedTariff || isGenerating}
                >
                  {isGenerating ? "..." : (
                    (weightHigh > 0 || dormeurBallLevel > 0 || dormeurStarLevel > 0)
                      ? <span className="text-red-500 font-bold text-center leading-tight text-[10px]">RECHERCHE<br/>PONDÉRÉE</span>
                      : "RECHERCHER"
                  )}
                </CasinoButton>
              </div>

              {/* Invité uniquement : libellé "par Email" */}
              {isInvite && (
                <div className="flex items-center gap-2 ml-1 text-[22px] text-zinc-300 font-bold">
                  <span className="whitespace-nowrap">par Email</span>
                </div>
              )}

              {/* Remplace la corbeille par le toggle Email (invités uniquement) */}
              {isInvite ? (
                <div className="w-11 h-11 flex items-center justify-center ml-[10px]">
                  <ToggleSwitch
                    checked={emailModeEnabled}
                    onChange={setEmailModeEnabled}
                    className="scale-75 -rotate-90"
                  />
                </div>
              ) : (
                // Admin/VIP : on garde la logique "Valider" uniquement en manuel
                mode === 'manual' && (
                  <div className="rounded-xl overflow-hidden">
                    <CasinoButton
                      size="md"
                      variant={(!selectedTariff || selectedNumbers.length !== selectedTariff?.nums || selectedStars.length !== selectedTariff?.stars) ? "danger" : "primary"}
                      className={cn(
                        "rounded-none text-sm px-4 py-[10px] w-[140px] flex items-center justify-center",
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
                )
              )}
            </div>
          </div>
        </div>
      );
    }

    if (isSimplifiedMode && mode === 'manual') {
      return (
        /* Simplified mode: Actions panel with Search/Validate/Email/SMS */
        <div
          className="flex flex-col h-full p-3"
          onClickCapture={(e) => {
          }}
        >
          {/* Row 1: Bouton ENVOYER + Toggle Email (invités) - centered at top, 20px from title */}
          <div className="flex flex-col items-center mt-5">
            <div className="flex items-center gap-3">
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
              
              {/* Toggle Email (invités uniquement) */}
              {isInvite && (
                <div className="flex flex-col items-center gap-1">
                  <span className={cn(
                    "text-xs font-bold transition-colors",
                    emailModeEnabled ? "text-cyan-400" : "text-zinc-600"
                  )}>EMAIL</span>
                  <ToggleSwitch
                    checked={emailModeEnabled}
                    onChange={setEmailModeEnabled}
                    className="scale-75 -rotate-90"
                  />
                </div>
              )}
            </div>
            
            {/* Trash button - below Email/SMS/Send, 50px gap */}
            {!showClearConfirm ? (
              <button 
                id="trash-actions-simplified"
                onClick={() => {
                  setShowClearConfirm(true);
                }}
                className="w-20 h-20 flex items-center justify-center bg-red-900/30 border border-red-500/50 rounded-xl text-red-500 hover:bg-red-900/50 hover:text-red-400 hover:border-red-400 transition-all mt-[50px]"
                title="Effacer l'historique"
              >
                <Trash2 size={40} />
              </button>
            ) : (
              <div className="flex items-center gap-4 bg-black border border-red-500 rounded-xl p-4 animate-in fade-in duration-200 mt-[50px]">
                <button 
                  onClick={() => {
                    setAutoDraws([]);
                    setGeneratedNumbers([]);
                    setGeneratedStars([]);
                    // IMPORTANT: also clear current selection so the 1–50 rack can't look "frozen" after a clear.
                    setSelectedNumbers([]);
                    setSelectedStars([]);
                    setNumberSources({});
                    setStarSources({});
                    setShowClearConfirm(false);
                    playSound('click');
                    toast.success("Historique effacé");
                  }}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white text-lg font-bold rounded-lg"
                >
                  OK
                </button>
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-lg font-bold rounded-lg"
                >
                  NON
                </button>
              </div>
            )}
          </div>
          
          {/* Center group: ProchainTirageSimple + Buttons - moved up 40px toward trash */}
          {/* IMPORTANT: this block was intercepting clicks over the trash icon (invisible overlay area). */}
          <div className="flex-1 flex flex-col items-center justify-center gap-2 -mt-10 pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center justify-center gap-2">
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
                      (weightHigh > 0 || dormeurBallLevel > 0 || dormeurStarLevel > 0)
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
        </div>
      );
    }

    return (
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
              (weightHigh > 0 || dormeurBallLevel > 0 || dormeurStarLevel > 0)
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
        
        {/* Right: Bouton ENVOYER + Toggle Email (invités) */}
        <div className="flex items-center gap-2">
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
          
          {/* Toggle Email (invités uniquement) */}
          {isInvite && (
            <div className="flex flex-col items-center gap-1">
              <span className={cn(
                "text-[10px] font-bold transition-colors",
                emailModeEnabled ? "text-cyan-400" : "text-zinc-600"
              )}>EMAIL</span>
              <ToggleSwitch
                checked={emailModeEnabled}
                onChange={setEmailModeEnabled}
                className="scale-75 -rotate-90"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <CasinoLayout>
      {/* Plus de pop-up gagnant: redirection vers "Mes grilles jouées" */}

      {/* Popup Gratitude (VIP/Abonné uniquement) - Depuis la DB */}
      {showGratitudePopup && popup1Html ? (
        <div dangerouslySetInnerHTML={{ __html: popup1Html }} />
      ) : showGratitudePopup ? (
        <GratitudePopup
          isOpen={showGratitudePopup}
          onOpenConsole={handleClosePopup}
          onDontShowAgain={handleDontShowAgain}
          dontShowAgainChecked={dontShowPopupAgain}
          mode="welcome"
        />
      ) : null}

      {/* Popup Gratitude Invité pour envoi direct - Depuis la DB */}
      {showInviteSendPopup && popup1Html ? (
        <div dangerouslySetInnerHTML={{ __html: popup1Html }} />
      ) : showInviteSendPopup ? (
        <GratitudePopup
          isOpen={showInviteSendPopup}
          mode="invite-send"
          onValidate={handleInviteGratitudeValidate}
          checkboxRequired={true}
          accepted={inviteGratitudeAccepted}
          onAcceptedChange={setInviteGratitudeAccepted}
        />
      ) : null}

      {/* Popup de consultation après envoi (invités uniquement) - Depuis la DB */}
      {showConsultationPopup && popup2Html ? (
        <div dangerouslySetInnerHTML={{ __html: popup2Html }} />
      ) : showConsultationPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay grisé */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          
          {/* Popup */}
          <div className="relative bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border-2 border-casino-gold rounded-xl p-9 max-w-lg mx-4 shadow-2xl shadow-casino-gold/20" style={{ transform: 'scale(1.5)', transformOrigin: 'center' }}>
            {/* Décoration coin */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-casino-gold rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-casino-gold rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-casino-gold rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-casino-gold rounded-br-xl" />

            {/* Titre */}
            <h2 className="text-center font-orbitron text-2xl text-casino-gold mb-6 tracking-widest">
              💬 CONSULTATION
            </h2>

            {/* Message */}
            <div className="bg-black/50 border border-zinc-700 rounded-lg p-6 mb-6">
              <p className="text-zinc-300 text-lg leading-relaxed text-center">
                Voulez-vous consulter vos numéros ?
              </p>
            </div>

            {/* Boutons */}
            <div className="flex gap-4">
              {/* Bouton Non */}
              <button
                onClick={handleConsultationNo}
                className={cn(
                  "flex-1 py-4 px-6 rounded-lg font-orbitron font-bold text-lg tracking-wider transition-all duration-200",
                  "bg-gradient-to-r from-zinc-700 to-zinc-600 text-white",
                  "border-2 border-zinc-500 shadow-lg shadow-zinc-500/30",
                  "hover:from-zinc-600 hover:to-zinc-500 hover:shadow-zinc-500/50",
                  "active:scale-95"
                )}
              >
                NON
              </button>

              {/* Bouton Oui */}
              <button
                onClick={handleConsultationYes}
                className={cn(
                  "flex-1 py-4 px-6 rounded-lg font-orbitron font-bold text-lg tracking-wider transition-all duration-200",
                  "bg-gradient-to-r from-green-600 to-green-500 text-white",
                  "border-2 border-green-400 shadow-lg shadow-green-500/30",
                  "hover:from-green-500 hover:to-green-400 hover:shadow-green-500/50",
                  "active:scale-95 animate-pulse hover:animate-none"
                )}
              >
                OUI
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

                         {/* Alerte AUTO update (si échec) */}
                         {autoUpdateStatus && autoUpdateStatus.success === false && (
                           <div className="mt-1 text-sm font-rajdhani text-red-300 bg-red-950/40 border border-red-700/50 rounded px-2 py-1 max-w-[720px]">
                             <span className="font-bold uppercase tracking-wider">ALERTE MAJ AUTO :</span>{" "}
                             {autoUpdateStatus.drawDate ? <span className="font-mono">{String(autoUpdateStatus.drawDate)}</span> : null}{" "}
                             {autoUpdateStatus.message ? <span className="text-zinc-200">{String(autoUpdateStatus.message).slice(0, 220)}</span> : null}
                           </div>
                         )}

                         {/* Message gagnants à la connexion (sans popup) */}
                         {unseenWins.length > 0 && (
                           <div className="mt-1 text-sm font-rajdhani text-emerald-200 bg-emerald-950/30 border border-emerald-700/50 rounded px-2 py-1 max-w-[720px] flex items-center gap-3">
                             <span className="font-bold uppercase tracking-wider">GAGNÉ :</span>
                             <span className="text-zinc-200">
                               {unseenWins.length} grille{unseenWins.length > 1 ? 's' : ''} gagnante{unseenWins.length > 1 ? 's' : ''} non vue{unseenWins.length > 1 ? 's' : ''}.
                             </span>
                             <button
                               className={cn(
                                 "ml-auto px-3 py-1 rounded-md font-orbitron text-xs tracking-widest border",
                                 winsAcking ? "opacity-50 cursor-not-allowed border-zinc-700 text-zinc-400" : "border-casino-gold/60 text-casino-gold hover:bg-black/40"
                               )}
                               onClick={ackAllWins}
                               disabled={winsAcking}
                               title="Marquer comme vu"
                             >
                               OK
                             </button>
                           </div>
                         )}
                         
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
                                                // IMPORTANT: Do NOT reset DORMEURS here (it's a Statistique control).
                                                setWeightHigh(0);
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
                 
                 {/* CENTER: SOUND */}
                 <div className="flex items-center justify-center gap-[20px] h-full pt-[24px]">

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
                                <span className="flex flex-nowrap items-center justify-start w-full gap-2">
                                    <button
                                        className={cn(
                                            "px-3 py-1 text-sm font-bold rounded transition-colors whitespace-nowrap",
                                            "w-[140px] flex items-center justify-center shrink-0",
                                            simplifiedSortOrder === 'numeric'
                                                ? "bg-white text-black hover:bg-zinc-200"
                                                : "bg-white/20 text-white/80 hover:bg-white/30"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSimplifiedSortOrder('numeric');
                                            playSound('click');
                                        }}
                                        aria-pressed={simplifiedSortOrder === 'numeric'}
                                    >
                                        Boules de 1 à 50
                                    </button>
                                    <div className="flex flex-nowrap items-center gap-2 min-w-0">
                                        <button
                                            className={cn(
                                                "px-3 py-1 text-sm font-bold rounded transition-colors",
                                                simplifiedSortOrder === 'frequency'
                                                    ? "bg-green-600 text-white hover:bg-green-500"
                                                    : "bg-green-600/25 text-white/80 hover:bg-green-600/35"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSimplifiedSortOrder('frequency');
                                                playSound('click');
                                            }}
                                            aria-pressed={simplifiedSortOrder === 'frequency'}
                                        >
                                            Fréquence
                                        </button>
                                        <button
                                            className={cn(
                                                "px-3 py-1 text-sm font-bold rounded transition-colors",
                                                simplifiedSortOrder === 'surrepr'
                                                    ? "bg-violet-600 text-white hover:bg-violet-500"
                                                    : "bg-violet-600/25 text-white/80 hover:bg-violet-600/35"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSimplifiedSortOrder('surrepr');
                                                playSound('click');
                                            }}
                                            aria-pressed={simplifiedSortOrder === 'surrepr'}
                                        >
                                            Surreprés.
                                        </button>
                                        <button
                                            className={cn(
                                                "px-3 py-1 text-sm font-bold rounded transition-colors",
                                                simplifiedSortOrder === 'trend'
                                                    ? "bg-red-600 text-white hover:bg-red-500"
                                                    : "bg-red-600/25 text-white/80 hover:bg-red-600/35"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSimplifiedSortOrder('trend');
                                                playSound('click');
                                            }}
                                            aria-pressed={simplifiedSortOrder === 'trend'}
                                        >
                                            Tendance
                                        </button>
                                        <button
                                            className={cn(
                                                "px-3 py-1 text-sm font-bold rounded transition-colors",
                                                simplifiedSortOrder === 'dormeur'
                                                    ? "bg-blue-600 text-white hover:bg-blue-500"
                                                    : "bg-blue-600/25 text-white/80 hover:bg-blue-600/35"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSimplifiedSortOrder('dormeur');
                                                playSound('click');
                                            }}
                                            aria-pressed={simplifiedSortOrder === 'dormeur'}
                                        >
                                            Dormeur
                                        </button>
                                        <LCDDisplay
                                            value={lcdText}
                                            size="btn"
                                            variant="inline"
                                            color="green"
                                            className="ml-0 shrink-0 w-[150px]"
                                        />
                                    </div>
                                </span>
                            ) : "CONFIGURATION BOULES (1-50)"
                        }
                        disabled={!canUseManual} 
                    className="flex flex-col p-[10px]" 
                    ledActive={true}
                    >
                        <div className="flex-1 flex flex-col justify-start">
                        {/* Row 1: High Freq (classic) or Balls 1-13 (simplified) */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            {mode === 'manual' && (
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
                            {mode === 'manual' && (
                                <div className={cn("flex-1 flex justify-start", !isSimplifiedMode && "ml-2")}>
                                    <BallGrid 
                                        stats={isSimplifiedMode ? getSimplifiedBallStats(simplifiedSortOrder).slice(13, 26) : midFreqStats} 
                                        countLimit={isSimplifiedMode ? 13 : 10} 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category={undefined}
                                        onToggle={toggleSelection}
                                        className={isSimplifiedMode ? "py-0 justify-between w-full" : "py-0 justify-start gap-[4px]"}
                                        resolveCategory={undefined}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Row 3: Low Freq (classic) or Balls 27-39 (simplified) */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            {mode === 'manual' && (
                                <div className={cn("flex-1 flex justify-start", !isSimplifiedMode && "ml-2")}>
                                    <BallGrid 
                                        stats={isSimplifiedMode ? getSimplifiedBallStats(simplifiedSortOrder).slice(26, 39) : lowFreqStats} 
                                        countLimit={isSimplifiedMode ? 13 : 10} 
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category={undefined}
                                        onToggle={toggleSelection}
                                        className={isSimplifiedMode ? "py-0 justify-between w-full" : "py-0 justify-start gap-[4px]"}
                                        resolveCategory={undefined}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Row 4: Dormeur (classic) or Balls 40-50 (simplified) */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
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
                        <span>REALISER LES TIRAGES</span>
                    }
                    disabled={!isWeightsEnabled}
                    headerAction={
                        <div className="flex items-center gap-3 pr-2">
                            <div className="scale-[0.85] origin-right">
                                <ProchainTirageSimple />
                            </div>
                            <LEDIndicator active={true} color="green" />
                        </div>
                    }
                    className="h-[200px] flex flex-col"
                >
                    {isSimplifiedMode ? (
                        /* Mode simplifié : Priorités de tri uniquement */
                        <div className="flex-1 min-h-0 flex items-stretch justify-evenly py-1">
                            {/* Bloc 1: Priorités de tri (centré verticalement, sans étirer le cadre) */}
                            <div className="w-64 h-full flex items-center justify-center">
                              <div className="w-full bg-black/30 rounded-lg border border-zinc-700 p-4">
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
                            </div>

                            {/* Bloc 2: Actions (bloc ENVOYER RECHERCHER VALIDER) */}
                            <div className="w-64 h-full flex items-center justify-center">
                                <ActionsControls variant="rack" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 flex items-center justify-center">
                          <ActionsControls variant="rack" />
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
                        
                        <div className="flex items-start justify-center gap-1 mt-4 w-full px-1">
                            {/* CHAOS Knob (Left) */}
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

                            {/* TENDENCES Knob (Middle) */}
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
                                    />
                                </div>
                            </div>

                            {/* DORMEURS Knob (Right) — 1 bouton, applique Boules + Étoiles */}
                            <div className="flex flex-col items-center gap-4 w-[110px]">
                                <div className="h-6 flex items-center justify-center w-full text-center relative">
                                     <span className="text-white font-rajdhani font-bold text-lg uppercase tracking-wider">
                                        DORMEURS
                                    </span>
                                </div>
                                
                                <div className="h-[60px] flex items-center justify-center">
                                    <RotaryKnob 
                                        label="" 
                                        value={dormeurBallLevel} 
                                        onChange={(v) => { 
                                            setDormeurBallLevel(v);
                                            setDormeurStarLevel(v);
                                            playSound('knob');
                                        }} 
                                        max={10} 
                                        size="xl"
                                        knobColor="border-blue-700 shadow-[0_0_15px_rgba(37,99,235,0.3)] bg-zinc-900"
                                        indicatorColor="bg-blue-600"
                                        labelClassName="hidden"
                                        valueClassName="text-blue-500"
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
                    ledActive={true}
                >
                     <div className="flex flex-col justify-start">
                        {/* Row 1: High Star (classic) or Stars 1-6 (simplified) */}
                        <div className="bg-black/30 p-1.5 rounded border border-zinc-800 flex items-center transition-all duration-300 mb-[6px]">
                            {mode === 'manual' && (
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
                            {mode === 'manual' && (
                                <div className={cn("flex-1 flex justify-start", !isSimplifiedMode && "ml-2")}>
                                    <BallGrid 
                                        stats={isSimplifiedMode ? getSimplifiedStarStats(simplifiedSortOrder).slice(6, 12) : midStarStats} 
                                        countLimit={isSimplifiedMode ? 6 : 12} 
                                        type="star"
                                        selectedNumbers={selectedNumbers}
                                        selectedStars={selectedStars}
                                        numberSources={numberSources}
                                        starSources={starSources}
                                        category={undefined}
                                        onToggle={toggleSelection}
                                        className={isSimplifiedMode ? "py-0 justify-evenly w-full" : "py-0 justify-start gap-[4px]"}
                                        resolveCategory={undefined}
                                    />
                                </div>
                            )}
                        </div>
                     </div>
                </SectionPanel>
                )}

                <SectionPanel 
                    title="PROGRAMMATION DES TIRAGES"
                    disabled={false}
                    showLed={false}
                    className="h-[395px]"
                >
                    <div className="h-full" />
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
                                        (weightHigh > 0 || dormeurBallLevel > 0 || dormeurStarLevel > 0 ||
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
                                        onClick={() => {
                                          setShowClearConfirm(true);
                                        }}
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
                <div ref={autoDrawsContainerRef} className="w-full flex flex-col gap-2 mt-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {autoDraws.length > 0 ? (
                        autoDraws.map((draw, idx) => {
                            // Logique de visibilité :
                            // - Mode manuel : toujours visible (Admin/VIP/Abonné ont le mode manuel)
                            // - Mode auto : Invite masqué, Admin/VIP/Abonné visibles
                            const isRevealed = mode === 'manual' ? true : (isInvite ? false : (draw.revealed !== undefined ? draw.revealed : true));
                            const shouldBlur = !isRevealed;
                            const shouldHideNumbers = isInvite; // Masquer uniquement pour les invités
                            
                            return (
                            <div 
                               key={`draw-${idx}`}
                               className={cn(
                                   "w-full bg-black/50 p-2 rounded-2xl border shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] min-h-[60px] flex items-center justify-center relative z-10 animate-in slide-in-from-top-4 duration-500 fade-in",
                                   isInvite ? "border-zinc-700 opacity-60" : "border-zinc-800 cursor-pointer"
                               )}
                               onClick={() => { 
                                   // Seuls les invités ne peuvent pas révéler (en mode auto)
                                   if (shouldBlur && !isInvite) {
                                       const newDraws = [...autoDraws];
                                       newDraws[idx].revealed = true;
                                       setAutoDraws(newDraws);
                                   }
                               }}
                            >
                                <div className="absolute left-4 text-xs text-zinc-600 font-mono">
                                    #{autoDraws.length - idx} {draw.revealed === true && mode === 'manual' && idx === 0 ? '(MANUEL)' : ''}
                                </div>
                               {mode === 'manual' && !isInvite && (
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
                                   {/* NUMBERS - Masqués uniquement pour Invités */}
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
                                   
                                   {/* STARS - Masquées uniquement pour Invités */}
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
                                
                                {/* Message pour Admin/VIP/Abonné qui peuvent révéler */}
                                {shouldBlur && !isInvite && (
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
                highFreqCount: 0, midFreqCount: 0, lowFreqCount: 0,
                highStarCount: 0, midStarCount: 0, lowStarCount: 0,
                weightHigh, weightMid: 0, weightLow: 0,
                weightDormeur: dormeurBallLevel, // compat debug panel
                weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
                avoidPairExt, balanceHighLow
            }}
            numberSources={numberSources}
            starSources={starSources}
            dormeurProof={lastDormeurProof}
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
