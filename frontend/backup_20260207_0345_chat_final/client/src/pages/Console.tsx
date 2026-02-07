
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
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useChatSocket } from "@/lib/chatSocket";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { Lock, Unlock, ChevronDown, RotateCcw, ArrowUp, ArrowDown, Minus, RefreshCcw, Settings, Sliders, Calendar, Trash2, Wrench, MessageSquare } from "lucide-react";
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
const LS_POOL_WINDOW_PRESET_NUMBERS_KEY = "loto_poolWindowPresetNumbers_v1";
const EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED = "loto:poolWindowPresetNumbersChanged";

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
type SortPriority = 'frequency' | 'surrepr' | 'trend';

type PresetConfig = {
  // Weights
  weightHigh: number;
  // Dormeur is now percentage steppers (Boules/Étoiles)
  weightStarHigh: number;
  weightStarMid: number;
  weightStarLow: number;
  weightStarDormeur: number;

  // Options
  avoidFriday: boolean;

  // Mode console
  mode: 'manual' | 'auto';

  // NOUVEAUX PARAMÈTRES
  hazardLevel: number;        // VIVIER : taille du vivier (0-10)
  tendencyLevel: number;     // STATS : 0 = hasard pur, 10 = stats pures (défaut 0)
  influenceFreq: number;     // Influence Fréquence (0-10) dans le mix F/S/T
  influenceSurrepr: number;  // Influence Surreprésentation (0-10)
  influenceTrend: number;    // Influence Tendance (0-10)
  dormeurBallLevel: number;   // Dormeur Boules (0-10) => 0%..100%
  dormeurStarLevel: number;   // Dormeur Étoiles (0-10) => 0%..100%
  emailNotify: boolean;       // Email activé
  smsNotify: boolean;         // SMS activé
  numCount: number;           // Nombre de numéros (tarif)
  starCount: number;          // Nombre d'étoiles (tarif)
  isSimplifiedMode: boolean;  // Mode simplifié ou classique

  // Priorités de tri (mode simplifié)
  sortPriority1: SortPriority;
  sortPriority2: SortPriority;
  sortPriority3: SortPriority;
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
  const chatSocket = useChatSocket(user?.id ?? null);
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
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number } | null>(null);

  // Manual Mode Selection State
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [selectedStars, setSelectedStars] = useState<number[]>([]);
  const [numberSources, setNumberSources] = useState<Record<number, 'high' | 'dormeur'>>({});
  const [starSources, setStarSources] = useState<Record<number, 'high' | 'dormeur'>>({});

  // NEW: Store selected tariff config directly for price display
  const [selectedTariff, setSelectedTariff] = useState<{ nums: number, stars: number, price: number } | null>(null);

  // Weightings (Knobs)
  const [weightHigh, setWeightHigh] = useState(2);
  // weightDormeur removed - dormeur is now handled via steppers (Boules/Étoiles)

  // Simplified mode toggle for Pondération Boules
  const [isSimplifiedMode, setIsSimplifiedMode] = useState(true);

  // Simplified mode: sort order for balls/stars
  const [simplifiedSortOrder, setSimplifiedSortOrder] = useState<'numeric' | 'frequency' | 'trend' | 'dormeur' | 'surrepr'>('numeric');

  // Simplified mode: priority system for tie-breaking (each must be unique)
  const SORT_PRIORITY_OPTIONS: SortPriority[] = ['frequency', 'surrepr', 'trend'];
  const normalizeSortPriority = (v: any): SortPriority | null => {
    if (v === 'dormeur') return 'surrepr'; // rétro-compat: ancien "Dormeur" => "Surreprés"
    if (v === 'frequency' || v === 'surrepr' || v === 'trend') return v;
    return null;
  };
  const normalizeSortPriorities = (p1: any, p2: any, p3: any): [SortPriority, SortPriority, SortPriority] => {
    const mapped = [normalizeSortPriority(p1), normalizeSortPriority(p2), normalizeSortPriority(p3)];
    const result: SortPriority[] = [];
    for (const v of mapped) {
      if (v && !result.includes(v)) result.push(v);
    }
    for (const v of SORT_PRIORITY_OPTIONS) {
      if (!result.includes(v)) result.push(v);
    }
    return [result[0], result[1], result[2]];
  };

  const [sortPriority1, setSortPriority1] = useState<SortPriority>('frequency');
  const [sortPriority2, setSortPriority2] = useState<SortPriority>('surrepr');
  const [sortPriority3, setSortPriority3] = useState<SortPriority>('trend');

  const [weightStarHigh, setWeightStarHigh] = useState(1);
  const [weightStarMid, setWeightStarMid] = useState(1);
  const [weightStarLow, setWeightStarLow] = useState(0);
  const [weightStarDormeur, setWeightStarDormeur] = useState(0);

  // Options (Toggles)
  const [avoidFriday, setAvoidFriday] = useState(false);
  const [emailNotify, setEmailNotify] = useState(true);
  const [smsNotify, setSmsNotify] = useState(false);
  const [hazardLevel, setHazardLevel] = useState(0); // VIVIER : 0..10 (taille vivier)
  const [tendencyLevel, setTendencyLevel] = useState(0); // STATS : 0 = hasard pur, 10 = stats pures (défaut 0)
  const [influenceFreq, setInfluenceFreq] = useState(10);   // Influence Fréquence (0-10)
  const [influenceSurrepr, setInfluenceSurrepr] = useState(10); // Influence Surreprés (0-10)
  const [influenceTrend, setInfluenceTrend] = useState(10);     // Influence Tendance (0-10)
  const [dormeurBallLevel, setDormeurBallLevel] = useState(0); // 0..10 => 0%..100% de dormeurs (boules)
  const [dormeurStarLevel, setDormeurStarLevel] = useState(0); // 0..10 => 0%..100% de dormeurs (étoiles)
  const [isWeightsEnabled, setIsWeightsEnabled] = useState(true);
  const [koRunCounts, setKoRunCounts] = useState<Record<string, number>>({}); // clé: `${targetDate}|${koGrad}`
  const [dbComboKeysByTargetDate, setDbComboKeysByTargetDate] = useState<Record<string, string[]>>({});

  const KO_GRADUATIONS: Array<{ balls: number; stars: number }> = [
    { balls: 5, stars: 2 },
    { balls: 6, stars: 3 },
    { balls: 7, stars: 4 },
    { balls: 9, stars: 5 },
    { balls: 12, stars: 6 },
    { balls: 16, stars: 7 },
    { balls: 21, stars: 8 },
    { balls: 27, stars: 9 },
    { balls: 34, stars: 10 },
    { balls: 42, stars: 11 },
    { balls: 50, stars: 12 },
  ];
  const clampInt = (x: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(x)));
  const koGrad = clampInt(hazardLevel, 0, 10);
  const chaosLabel = `B=${KO_GRADUATIONS[koGrad].balls} E=${KO_GRADUATIONS[koGrad].stars}`;

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
  const [autoDraws, setAutoDraws] = useState<{ nums: number[], stars: number[], date: Date, revealed?: boolean }[]>([]);
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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatPanelSlideIn, setChatPanelSlideIn] = useState(false);
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

  // Volet chat : à l'ouverture, marquer toutes les conversations comme lues
  useEffect(() => {
    if (isChatOpen && chatSocket.markConversationAsRead && chatSocket.unreadCountByUser) {
      Object.keys(chatSocket.unreadCountByUser).forEach((userId) => {
        chatSocket.markConversationAsRead(Number(userId));
      });
    }
  }, [isChatOpen]);

  // Volet chat : animation d'ouverture (glissement depuis la droite)
  useEffect(() => {
    if (isChatOpen) {
      setChatPanelSlideIn(false);
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setChatPanelSlideIn(true));
      });
      return () => cancelAnimationFrame(t);
    } else {
      setChatPanelSlideIn(false);
    }
  }, [isChatOpen]);

  const handleCloseChat = () => {
    setChatPanelSlideIn(false);
    window.setTimeout(() => setIsChatOpen(false), 350);
  };

  // --- LEGACY “Cycle de calcul des fréquences” ---
  // Ce réglage global (loto_freqConfig_v1) est désormais déprécié au profit des fenêtres par pôle (poolWindows.*).

  // --- POOL WINDOWS (High / Surrepr / Trend / Dormeur) ---
  type PoolKey = "high" | "surrepr" | "trend" | "dormeur";
  type PoolWindowsConfig = { high: FrequencyConfig; surrepr: FrequencyConfig; trend: TrendWindowConfig; dormeur: FrequencyConfig };
  const defaultPoolWindows: PoolWindowsConfig = {
    // IMPORTANT: défaut demandé = "Dynamics" pour les 4 pools
    // (valeurs alignées sur Settings → defaultPresetNumbers.dynamic*)
    high: { type: "custom", customUnit: "draws", customValue: 680 },
    surrepr: { type: "custom", customUnit: "draws", customValue: 420 },
    trend: { type: "custom", customUnit: "draws", customValue: 140, trendPeriodR: 65 },
    dormeur: { type: "custom", customUnit: "draws", customValue: 60 },
  };
  const getPoolWindowsStorageKey = (userId?: number) => `loto_poolWindows_v1_u${userId ?? "unknown"}`;
  const [poolWindows, setPoolWindows] = useState<PoolWindowsConfig>(() => {
    try {
      const key = user?.id ? getPoolWindowsStorageKey(user.id) : LS_POOL_WINDOWS_KEY;
      const raw = localStorage.getItem(key) ?? localStorage.getItem(LS_POOL_WINDOWS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PoolWindowsConfig & { trend?: TrendWindowConfig }>;
        const migrated: Partial<PoolWindowsConfig> = { ...parsed };
        if (!migrated.surrepr && migrated.high) migrated.surrepr = migrated.high;
        const t = migrated.trend as (FrequencyConfig & { trendPeriodR?: number }) | undefined;
        if (t && typeof t.trendPeriodR !== "number") migrated.trend = { ...t, trendPeriodR: 65 } as TrendWindowConfig;
        if (migrated?.high && migrated?.surrepr && migrated?.trend && migrated?.dormeur) return migrated as PoolWindowsConfig;
      }
    } catch { }
    // Migration: si l'ancien réglage global existe encore, on l'utilise uniquement comme fallback initial pour High (et Surrepr = High).
    let legacyHigh: FrequencyConfig | null = null;
    try {
      const rawLegacy = localStorage.getItem(LS_FREQ_CONFIG_KEY);
      if (rawLegacy) {
        const parsed = JSON.parse(rawLegacy) as FrequencyConfig;
        if (parsed?.type === "custom" && (!parsed.customUnit || !parsed.customValue)) {
          legacyHigh = null;
        } else if (parsed?.type === "all" || parsed?.type === "last_20" || parsed?.type === "last_year" || parsed?.type === "custom") {
          legacyHigh = parsed;
        }
      }
    } catch { }
    const high = legacyHigh ?? defaultPoolWindows.high;
    return { ...defaultPoolWindows, high, surrepr: high };
  });

  // Hydratation depuis la DB (source de vérité) au chargement/connexion
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user-settings/windows", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const serverPoolWindows = data?.poolWindows ?? null;
        if (serverPoolWindows) {
          const key = getPoolWindowsStorageKey(user.id);
          localStorage.setItem(key, JSON.stringify(serverPoolWindows));
          localStorage.setItem(LS_POOL_WINDOWS_KEY, JSON.stringify(serverPoolWindows)); // compat
          window.dispatchEvent(new Event(EVENT_POOL_WINDOWS_CHANGED));
          setPoolWindows(serverPoolWindows);
          return;
        }

        // Aucun choix spécifique => Dynamics pour les 4 pools
        const dynamicDefaults: PoolWindowsConfig = { ...defaultPoolWindows };
        const key = getPoolWindowsStorageKey(user.id);
        localStorage.setItem(key, JSON.stringify(dynamicDefaults));
        localStorage.setItem(LS_POOL_WINDOWS_KEY, JSON.stringify(dynamicDefaults)); // compat
        window.dispatchEvent(new Event(EVENT_POOL_WINDOWS_CHANGED));
        setPoolWindows(dynamicDefaults);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const handler = () => {
      try {
        const key = user?.id ? getPoolWindowsStorageKey(user.id) : LS_POOL_WINDOWS_KEY;
        const raw = localStorage.getItem(key) ?? localStorage.getItem(LS_POOL_WINDOWS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<PoolWindowsConfig & { trend?: TrendWindowConfig }>;
        const migrated: Partial<PoolWindowsConfig> = { ...parsed };
        if (!migrated.surrepr && migrated.high) migrated.surrepr = migrated.high;
        const t = migrated.trend as (FrequencyConfig & { trendPeriodR?: number }) | undefined;
        if (t && typeof t.trendPeriodR !== "number") migrated.trend = { ...t, trendPeriodR: 65 } as TrendWindowConfig;
        if (!migrated?.high || !migrated?.surrepr || !migrated?.trend || !migrated?.dormeur) return;

        setPoolWindows(migrated as PoolWindowsConfig);
      } catch { }
    };
    window.addEventListener(EVENT_POOL_WINDOWS_CHANGED, handler as EventListener);
    return () => window.removeEventListener(EVENT_POOL_WINDOWS_CHANGED, handler as EventListener);
  }, [user?.id]);

  // Debug (runtime evidence): generation tokens + mismatch detection
  const genSeqRef = useRef(0);
  const genTokenRef = useRef<string | null>(null);
  const genAppliedTokenRef = useRef<string | null>(null);
  const genTimeoutRef = useRef<number | null>(null);
  const autoDrawsContainerRef = useRef<HTMLDivElement | null>(null);
  const wasScrollableRef = useRef(false);

  const [fullHistory, setFullHistory] = useState<Tirage[]>([]);

  // --- HIGH (Fréquences) : valeur Dynamique (calculée automatiquement) ---
  useEffect(() => {
    if (!fullHistory || fullHistory.length < 800) return;

    const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
    const round10 = (x: number) => Math.round(x / 10) * 10;
    const floor10 = (x: number) => Math.floor(x / 10) * 10;
    const ceil10 = (x: number) => Math.ceil(x / 10) * 10;

    const computeNStarBothStandard = (history: Tirage[]) => {
      // Critères "STANDARD" (cohérents projet) :
      // - DELTA=50, STEP=10, PAS_CONSECUTIFS=3
      // - Top-K: Boules 12, Étoiles 4
      // - Seuils: rho >= 0.95 et overlap >= 0.75
      const DELTA = 50;
      const STEP_N = 10;
      const PAS = 3;
      const K_BALL = 12;
      const K_STAR = 4;
      const SEUIL_RHO = 0.95;
      const SEUIL_OV = 0.75;

      const total = history.length;
      if (total < 200) return null;

      const maxBall = 50;
      const maxStar = 12;

      // Cumul des occurrences (prefixes)
      const cumBalls: number[][] = Array.from({ length: total + 1 }, () => Array(maxBall + 1).fill(0));
      const cumStars: number[][] = Array.from({ length: total + 1 }, () => Array(maxStar + 1).fill(0));
      for (let i = 0; i < total; i++) {
        const prevB = cumBalls[i];
        const prevS = cumStars[i];
        const nextB = cumBalls[i + 1];
        const nextS = cumStars[i + 1];
        for (let n = 1; n <= maxBall; n++) nextB[n] = prevB[n];
        for (let s = 1; s <= maxStar; s++) nextS[s] = prevS[s];
        for (const n of history[i]?.numeros ?? []) if (n >= 1 && n <= maxBall) nextB[n] += 1;
        for (const s of history[i]?.etoiles ?? []) if (s >= 1 && s <= maxStar) nextS[s] += 1;
      }

      const ranksByFreq = (freq: number[], max: number) => {
        const entries = Array.from({ length: max }, (_, idx) => ({ num: idx + 1, f: freq[idx + 1] ?? 0 }));
        entries.sort((a, b) => (b.f - a.f) || (a.num - b.num));
        const rank = new Array(max + 1).fill(0);
        entries.forEach((e, i) => { rank[e.num] = i + 1; });
        return rank;
      };

      const spearmanFromRanks = (r1: number[], r2: number[], max: number) => {
        const n = max;
        let d2 = 0;
        for (let i = 1; i <= max; i++) {
          const a = r1[i] ?? 0;
          const b = r2[i] ?? 0;
          const d = a - b;
          d2 += d * d;
        }
        return 1 - (6 * d2) / (n * (n * n - 1));
      };

      const topKSet = (freq: number[], max: number, K: number) => {
        const entries = Array.from({ length: max }, (_, idx) => ({ num: idx + 1, f: freq[idx + 1] ?? 0 }));
        entries.sort((a, b) => (b.f - a.f) || (a.num - b.num));
        return new Set(entries.slice(0, K).map((e) => e.num));
      };

      const okBothAtN = (N: number) => {
        const N2 = N + DELTA;
        if (N2 > total) return null;

        const fB1 = cumBalls[N];
        const fB2 = cumBalls[N2];
        const rB1 = ranksByFreq(fB1, maxBall);
        const rB2 = ranksByFreq(fB2, maxBall);
        const rhoB = spearmanFromRanks(rB1, rB2, maxBall);
        const tB1 = topKSet(fB1, maxBall, K_BALL);
        const tB2 = topKSet(fB2, maxBall, K_BALL);
        let ovB = 0;
        tB1.forEach((x) => { if (tB2.has(x)) ovB++; });
        const ovBPct = ovB / K_BALL;

        const fS1 = cumStars[N];
        const fS2 = cumStars[N2];
        const rS1 = ranksByFreq(fS1, maxStar);
        const rS2 = ranksByFreq(fS2, maxStar);
        const rhoS = spearmanFromRanks(rS1, rS2, maxStar);
        const tS1 = topKSet(fS1, maxStar, K_STAR);
        const tS2 = topKSet(fS2, maxStar, K_STAR);
        let ovS = 0;
        tS1.forEach((x) => { if (tS2.has(x)) ovS++; });
        const ovSPct = ovS / K_STAR;

        const okB = rhoB >= SEUIL_RHO && ovBPct >= SEUIL_OV;
        const okS = rhoS >= SEUIL_RHO && ovSPct >= SEUIL_OV;
        return okB && okS;
      };

      for (let N = 50; N + DELTA <= total; N += STEP_N) {
        let ok = true;
        for (let j = 0; j < PAS; j++) {
          const v = okBothAtN(N + j * STEP_N);
          if (!v) { ok = false; break; }
          if (v !== true) { ok = false; break; }
        }
        if (ok) return N;
      }

      return null;
    };

    const computeDynamicBounds = (history: Tirage[]) => {
      const SERIES_STEP = 150;
      const MIN_TAIL = 600;
      const values: number[] = [];
      for (let end = 0; end + MIN_TAIL <= history.length; end += SERIES_STEP) {
        const subset = history.slice(end);
        const n = computeNStarBothStandard(subset);
        if (typeof n === "number" && Number.isFinite(n) && n > 0) values.push(n);
      }
      values.sort((a, b) => a - b);
      if (values.length < 3) return { min: 400, max: 800 };
      const q = (p: number) => values[Math.floor(p * (values.length - 1))]!;
      const q20 = q(0.2);
      const q80 = q(0.8);
      // Légère marge, puis arrondi par pas de 10 pour rester “réglage console”.
      const min = clamp(floor10(q20 - 50), 200, 5000);
      const max = clamp(ceil10(q80 + 50), 200, 5000);
      if (min >= max) return { min: 400, max: 800 };
      return { min, max };
    };

    const standardNStar = computeNStarBothStandard(fullHistory);
    if (!standardNStar) return;

    const bounds = computeDynamicBounds(fullHistory);
    const dynamicDraws = clamp(round10(standardNStar), bounds.min, bounds.max);

    // Mettre à jour la valeur "dynamicDraws" dans les presets (utilisé par Settings).
    try {
      const raw = localStorage.getItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY);
      const parsed = raw ? (JSON.parse(raw) as any) : null;
      const next = parsed && typeof parsed === "object" ? { ...parsed } : {};
      next.high = { ...(next.high ?? {}), dynamicDraws };
      localStorage.setItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED));

      // Si la fenêtre High actuelle correspondait à l'ancien "dynamicDraws", on la recolle au nouveau.
      const oldDynamic = typeof parsed?.high?.dynamicDraws === "number" ? parsed.high.dynamicDraws : null;
      const rawW = localStorage.getItem(LS_POOL_WINDOWS_KEY);
      if (rawW) {
        const w = JSON.parse(rawW) as any;
        const high = w?.high;
        if (
          high?.type === "custom" &&
          high?.customUnit === "draws" &&
          typeof high?.customValue === "number" &&
          (oldDynamic != null ? high.customValue === oldDynamic : false)
        ) {
          const updated = {
            ...w,
            high: { ...high, customValue: dynamicDraws },
          };
          localStorage.setItem(LS_POOL_WINDOWS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event(EVENT_POOL_WINDOWS_CHANGED));
        }
      }
    } catch {
      // si localStorage est indisponible, on ne bloque pas la console
    }
  }, [fullHistory]);

  // --- SURRÉPRÉSENTATION (z-score) : valeur Dynamique (calculée automatiquement) ---
  useEffect(() => {
    if (!fullHistory || fullHistory.length < 500) return;

    const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
    const round10 = (x: number) => Math.round(x / 10) * 10;
    const floor10 = (x: number) => Math.floor(x / 10) * 10;
    const ceil10 = (x: number) => Math.ceil(x / 10) * 10;

    const computeSurreprNStarBothStandard = (history: Tirage[]) => {
      // Critères "STANDARD court" pour Surrepr (z-score) :
      // - DELTA=50, STEP=10, PAS_CONSECUTIFS=2, N_MAX=450
      // - Top-K: Boules 12, Étoiles 4
      // - Seuils: rho >= 0.90 et overlap >= 0.70
      const DELTA = 50;
      const STEP_N = 10;
      const PAS = 2;
      const N_MAX = 450;
      const K_BALL = 12;
      const K_STAR = 4;
      const SEUIL_RHO = 0.9;
      const SEUIL_OV = 0.7;

      const total = history.length;
      const nMax = Math.min(N_MAX, total - DELTA);
      if (nMax < 60) return null;

      const maxBall = 50;
      const maxStar = 12;

      const pBall = 0.1;
      const pStar = 1 / 6;
      const zFromCounts = (k: number, N: number, p0: number) => {
        const expected = N * p0;
        const denom = Math.sqrt(N * p0 * (1 - p0));
        if (!Number.isFinite(denom) || denom <= 0) return 0;
        return (k - expected) / denom;
      };

      // Cumul occurrences
      const cumBalls: number[][] = Array.from({ length: total + 1 }, () => Array(maxBall + 1).fill(0));
      const cumStars: number[][] = Array.from({ length: total + 1 }, () => Array(maxStar + 1).fill(0));
      for (let i = 0; i < total; i++) {
        const prevB = cumBalls[i];
        const prevS = cumStars[i];
        const nextB = cumBalls[i + 1];
        const nextS = cumStars[i + 1];
        for (let n = 1; n <= maxBall; n++) nextB[n] = prevB[n];
        for (let s = 1; s <= maxStar; s++) nextS[s] = prevS[s];
        for (const n of history[i]?.numeros ?? []) if (n >= 1 && n <= maxBall) nextB[n] += 1;
        for (const s of history[i]?.etoiles ?? []) if (s >= 1 && s <= maxStar) nextS[s] += 1;
      }

      const ranksByScore = (score: number[], max: number) => {
        const entries = Array.from({ length: max }, (_, idx) => ({ num: idx + 1, s: score[idx + 1] ?? 0 }));
        entries.sort((a, b) => (b.s - a.s) || (a.num - b.num));
        const rank = new Array(max + 1).fill(0);
        entries.forEach((e, i) => { rank[e.num] = i + 1; });
        return rank;
      };

      const spearmanFromRanks = (r1: number[], r2: number[], max: number) => {
        const n = max;
        let d2 = 0;
        for (let i = 1; i <= max; i++) {
          const a = r1[i] ?? 0;
          const b = r2[i] ?? 0;
          const d = a - b;
          d2 += d * d;
        }
        return 1 - (6 * d2) / (n * (n * n - 1));
      };

      const topKSet = (score: number[], max: number, K: number) => {
        const entries = Array.from({ length: max }, (_, idx) => ({ num: idx + 1, s: score[idx + 1] ?? 0 }));
        entries.sort((a, b) => (b.s - a.s) || (a.num - b.num));
        return new Set(entries.slice(0, K).map((e) => e.num));
      };

      const okBothAtN = (N: number) => {
        const N2 = N + DELTA;
        if (N2 > total) return null;

        const zB1 = new Array(maxBall + 1).fill(0);
        const zB2 = new Array(maxBall + 1).fill(0);
        for (let i = 1; i <= maxBall; i++) {
          zB1[i] = zFromCounts(cumBalls[N][i] ?? 0, N, pBall);
          zB2[i] = zFromCounts(cumBalls[N2][i] ?? 0, N2, pBall);
        }
        const rB1 = ranksByScore(zB1, maxBall);
        const rB2 = ranksByScore(zB2, maxBall);
        const rhoB = spearmanFromRanks(rB1, rB2, maxBall);
        const tB1 = topKSet(zB1, maxBall, K_BALL);
        const tB2 = topKSet(zB2, maxBall, K_BALL);
        let ovB = 0;
        tB1.forEach((x) => { if (tB2.has(x)) ovB++; });
        const ovBPct = ovB / K_BALL;

        const zS1 = new Array(maxStar + 1).fill(0);
        const zS2 = new Array(maxStar + 1).fill(0);
        for (let i = 1; i <= maxStar; i++) {
          zS1[i] = zFromCounts(cumStars[N][i] ?? 0, N, pStar);
          zS2[i] = zFromCounts(cumStars[N2][i] ?? 0, N2, pStar);
        }
        const rS1 = ranksByScore(zS1, maxStar);
        const rS2 = ranksByScore(zS2, maxStar);
        const rhoS = spearmanFromRanks(rS1, rS2, maxStar);
        const tS1 = topKSet(zS1, maxStar, K_STAR);
        const tS2 = topKSet(zS2, maxStar, K_STAR);
        let ovS = 0;
        tS1.forEach((x) => { if (tS2.has(x)) ovS++; });
        const ovSPct = ovS / K_STAR;

        const okB = rhoB >= SEUIL_RHO && ovBPct >= SEUIL_OV;
        const okS = rhoS >= SEUIL_RHO && ovSPct >= SEUIL_OV;
        return okB && okS;
      };

      for (let N = 50; N <= nMax; N += STEP_N) {
        let ok = true;
        for (let j = 0; j < PAS; j++) {
          const v = okBothAtN(N + j * STEP_N);
          if (v !== true) { ok = false; break; }
        }
        if (ok) return N;
      }

      return null;
    };

    const computeDynamicBounds = (history: Tirage[]) => {
      const SERIES_STEP = 150;
      const MIN_TAIL = 400;
      const values: number[] = [];
      for (let end = 0; end + MIN_TAIL <= history.length; end += SERIES_STEP) {
        const subset = history.slice(end);
        const n = computeSurreprNStarBothStandard(subset);
        if (typeof n === "number" && Number.isFinite(n) && n > 0) values.push(n);
      }
      values.sort((a, b) => a - b);
      if (values.length < 3) return { min: 80, max: 450 };
      const q = (p: number) => values[Math.floor(p * (values.length - 1))]!;
      const q20 = q(0.2);
      const q80 = q(0.8);
      const min = clamp(floor10(q20 - 30), 50, 450);
      const max = clamp(ceil10(q80 + 30), 50, 450);
      if (min >= max) return { min: 80, max: 450 };

      return { min, max };
    };

    const standardNStar = computeSurreprNStarBothStandard(fullHistory);
    if (!standardNStar) return;

    const bounds = computeDynamicBounds(fullHistory);
    const dynamicDraws = clamp(round10(standardNStar), bounds.min, bounds.max);

    try {
      const raw = localStorage.getItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY);
      const parsed = raw ? (JSON.parse(raw) as any) : null;
      const next = parsed && typeof parsed === "object" ? { ...parsed } : {};
      next.surrepr = { ...(next.surrepr ?? {}), dynamicDraws };
      localStorage.setItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED));

      const oldDynamic = typeof parsed?.surrepr?.dynamicDraws === "number" ? parsed.surrepr.dynamicDraws : null;

      const rawW = localStorage.getItem(LS_POOL_WINDOWS_KEY);
      if (rawW) {
        const w = JSON.parse(rawW) as any;
        const sur = w?.surrepr;
        if (
          sur?.type === "custom" &&
          sur?.customUnit === "draws" &&
          typeof sur?.customValue === "number" &&
          (oldDynamic != null ? sur.customValue === oldDynamic : false)
        ) {
          const updated = {
            ...w,
            surrepr: { ...sur, customValue: dynamicDraws },
          };
          localStorage.setItem(LS_POOL_WINDOWS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event(EVENT_POOL_WINDOWS_CHANGED));
        }
      }
    } catch {
      // no-op
    }
  }, [fullHistory]);

  // --- TENDANCE (W,R) : valeur Dynamique (calculée automatiquement) ---
  useEffect(() => {
    if (!fullHistory || fullHistory.length < 450) return;

    const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
    const round10 = (x: number) => Math.round(x / 10) * 10;
    const floor10 = (x: number) => Math.floor(x / 10) * 10;
    const ceil10 = (x: number) => Math.ceil(x / 10) * 10;
    const round5 = (x: number) => Math.round(x / 5) * 5;

    type Direction = -1 | 0 | 1; // baisse / stable / hausse

    const labelFromRatio = (ratio: number): Direction => {
      if (ratio > 1.2) return 1;
      if (ratio < 0.8) return -1;
      return 0;
    };

    const freqs = (tirages: Tirage[], kind: "balls" | "stars") => {
      const max = kind === "balls" ? 50 : 12;
      const f = new Array(max + 1).fill(0);
      for (const t of tirages) {
        const arr = kind === "balls" ? (t.numeros ?? []) : (t.etoiles ?? []);
        for (const n of arr) if (n >= 1 && n <= max) f[n] += 1;
      }
      return f;
    };

    const tendanceLabels = (tirages: Tirage[], W: number, R: number, kind: "balls" | "stars") => {
      const total = tirages.slice(0, W);
      const recent = tirages.slice(0, R);
      const freqTot = freqs(total, kind);
      const freqRec = freqs(recent, kind);
      const max = kind === "balls" ? 50 : 12;
      const out = new Array<Direction>(max + 1).fill(0);
      for (let num = 1; num <= max; num++) {
        const att = W > 0 ? ((freqTot[num] ?? 0) / W) * R : 0;
        const re = freqRec[num] ?? 0;
        const ratio = att > 0 ? re / att : 0;
        out[num] = labelFromRatio(ratio);
      }
      return out;
    };

    const concordance = (a: Direction[], b: Direction[], max: number) => {
      let same = 0;
      for (let i = 1; i <= max; i++) if ((a[i] ?? 0) === (b[i] ?? 0)) same++;
      return same / max;
    };

    // Critère STANDARD Tendance:
    // - Chercher le plus petit W (50..200 pas 10), puis le plus petit R (15..min(80,W/2) pas 5)
    // - validité = stabilité quand on décale R (+5 puis +10), sur Boules ET Étoiles (min des concordances).
    const computeTrendWRStarStandard = (history: Tirage[]) => {
      const STEP_W = 10;
      const W_MIN = 50;
      const W_MAX = 200;
      const R_MIN = 15;
      const DELTA_R = 5;
      const SEUIL = 0.82;

      const total = history.length;
      for (let W = W_MIN; W <= W_MAX && W <= total - 20; W += STEP_W) {
        const Rmax = Math.min(80, Math.floor(W * 0.5));
        for (let R = R_MIN; R + 10 <= Rmax && R + 10 <= W; R += DELTA_R) {
          const bR = tendanceLabels(history, W, R, "balls");
          const bR5 = tendanceLabels(history, W, R + 5, "balls");
          const bR10 = tendanceLabels(history, W, R + 10, "balls");
          const sR = tendanceLabels(history, W, R, "stars");
          const sR5 = tendanceLabels(history, W, R + 5, "stars");
          const sR10 = tendanceLabels(history, W, R + 10, "stars");
          const concMin = Math.min(
            concordance(bR, bR5, 50),
            concordance(bR5, bR10, 50),
            concordance(sR, sR5, 12),
            concordance(sR5, sR10, 12),
          );
          if (concMin >= SEUIL) {
            // R "milieu" (comme dans le script multi) pour représenter la zone stable
            return { WStar: W, RStar: R + 5 };
          }
        }
      }
      return null;
    };

    const computeDynamicBounds = (history: Tirage[]) => {
      const SERIES_STEP = 150;
      const MIN_TAIL = 400;
      const WVals: number[] = [];
      const RVals: number[] = [];
      for (let end = 0; end + MIN_TAIL <= history.length; end += SERIES_STEP) {
        const subset = history.slice(end);
        const p = computeTrendWRStarStandard(subset);
        if (p?.WStar && p?.RStar) {
          WVals.push(p.WStar);
          RVals.push(p.RStar);
        }
      }
      WVals.sort((a, b) => a - b);
      RVals.sort((a, b) => a - b);
      if (WVals.length < 3 || RVals.length < 3) {
        return { W: { min: 80, max: 200 }, R: { min: 15, max: 80 } };
      }
      const q = (arr: number[], p: number) => arr[Math.floor(p * (arr.length - 1))]!;
      const w20 = q(WVals, 0.2);
      const w80 = q(WVals, 0.8);
      const r20 = q(RVals, 0.2);
      const r80 = q(RVals, 0.8);
      const wMin = clamp(floor10(w20 - 10), 50, 200);
      const wMax = clamp(ceil10(w80 + 10), 50, 200);
      const rMin = clamp(round5(r20 - 5), 15, 80);
      const rMax = clamp(round5(r80 + 5), 15, 80);
      if (wMin >= wMax || rMin >= rMax) return { W: { min: 80, max: 200 }, R: { min: 15, max: 80 } };
      return { W: { min: wMin, max: wMax }, R: { min: rMin, max: rMax } };
    };

    const standard = computeTrendWRStarStandard(fullHistory);
    if (!standard) return;
    const bounds = computeDynamicBounds(fullHistory);
    const dynamicW = clamp(round10(standard.WStar), bounds.W.min, bounds.W.max);
    const dynamicR = clamp(round5(standard.RStar), bounds.R.min, bounds.R.max);

    try {
      const raw = localStorage.getItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY);
      const parsed = raw ? (JSON.parse(raw) as any) : null;
      const next = parsed && typeof parsed === "object" ? { ...parsed } : {};
      const oldW = typeof parsed?.trend?.dynamicDraws === "number" ? parsed.trend.dynamicDraws : null;
      const oldR = typeof parsed?.trend?.dynamicTrendR === "number" ? parsed.trend.dynamicTrendR : null;

      next.trend = { ...(next.trend ?? {}), dynamicDraws: dynamicW, dynamicTrendR: dynamicR };
      localStorage.setItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED));

      // Si la fenêtre Trend actuelle correspondait à l'ancien couple dynamique, on la recolle au nouveau.
      const rawW = localStorage.getItem(LS_POOL_WINDOWS_KEY);
      if (rawW) {
        const w = JSON.parse(rawW) as any;
        const t = w?.trend;
        if (
          t?.type === "custom" &&
          t?.customUnit === "draws" &&
          typeof t?.customValue === "number" &&
          typeof t?.trendPeriodR === "number" &&
          (oldW != null && oldR != null ? (t.customValue === oldW && t.trendPeriodR === oldR) : false)
        ) {
          const updated = {
            ...w,
            trend: { ...t, customValue: dynamicW, trendPeriodR: dynamicR },
          };
          localStorage.setItem(LS_POOL_WINDOWS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event(EVENT_POOL_WINDOWS_CHANGED));
        }
      }
    } catch {
      // no-op
    }
  }, [fullHistory]);

  // --- DORMEUR (absence / retard) : valeur Dynamique (calculée automatiquement) ---
  useEffect(() => {
    if (!fullHistory || fullHistory.length < 200) return;

    const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
    const round10 = (x: number) => Math.round(x / 10) * 10;

    // Pour le Dormeur (absence depuis dernière sortie), la “fenêtre” sert surtout à éviter le cap (=N)
    // quand un numéro/étoile n’a pas été vu dans la fenêtre. Une fenêtre “utile” est donc:
    // - assez grande pour voir chaque élément au moins une fois (Boules + Étoiles),
    // - mais pas inutilement gigantesque (sinon redondant).
    const computeDormeurNStarBothStandard = (history: Tirage[]) => {
      const maxBall = 50;
      const maxStar = 12;
      const seenAllWithin = (N: number) => {
        const seenB = new Array(maxBall + 1).fill(false);
        const seenS = new Array(maxStar + 1).fill(false);
        const w = history.slice(0, N);
        for (const t of w) {
          for (const n of t.numeros ?? []) if (n >= 1 && n <= maxBall) seenB[n] = true;
          for (const s of t.etoiles ?? []) if (s >= 1 && s <= maxStar) seenS[s] = true;
        }
        for (let i = 1; i <= maxBall; i++) if (!seenB[i]) return false;
        for (let i = 1; i <= maxStar; i++) if (!seenS[i]) return false;
        return true;
      };

      // Recherche sur une plage “raisonnable” (dormeur = présent/récent):
      // 20..200 tirages, pas de 5. On arrondit ensuite à 10 pour rester “réglage console”.
      for (let N = 20; N <= 200; N += 5) {
        if (seenAllWithin(N)) return N;
      }
      return null;
    };

    const computeDynamicBounds = (history: Tirage[]) => {
      const SERIES_STEP = 150;
      const MIN_TAIL = 400;
      const values: number[] = [];
      for (let end = 0; end + MIN_TAIL <= history.length; end += SERIES_STEP) {
        const subset = history.slice(end);
        const n = computeDormeurNStarBothStandard(subset);
        if (typeof n === "number" && Number.isFinite(n) && n > 0) values.push(n);
      }
      values.sort((a, b) => a - b);
      if (values.length < 3) return { min: 40, max: 120 };
      const q = (p: number) => values[Math.floor(p * (values.length - 1))]!;
      const q20 = q(0.2);
      const q80 = q(0.8);
      const min = clamp(round10(q20 - 10), 20, 500);
      const max = clamp(round10(q80 + 10), 20, 500);
      if (min >= max) return { min: 40, max: 120 };
      return { min, max };
    };

    const standardNStar = computeDormeurNStarBothStandard(fullHistory);
    if (!standardNStar) return;

    const bounds = computeDynamicBounds(fullHistory);
    const dynamicDraws = clamp(round10(standardNStar), bounds.min, bounds.max);

    try {
      const raw = localStorage.getItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY);
      const parsed = raw ? (JSON.parse(raw) as any) : null;
      const next = parsed && typeof parsed === "object" ? { ...parsed } : {};
      next.dormeur = { ...(next.dormeur ?? {}), dynamicDraws };
      localStorage.setItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED));

      const oldDynamic = typeof parsed?.dormeur?.dynamicDraws === "number" ? parsed.dormeur.dynamicDraws : null;
      const rawW = localStorage.getItem(LS_POOL_WINDOWS_KEY);
      if (rawW) {
        const w = JSON.parse(rawW) as any;
        const d = w?.dormeur;
        if (
          d?.type === "custom" &&
          d?.customUnit === "draws" &&
          typeof d?.customValue === "number" &&
          (oldDynamic != null ? d.customValue === oldDynamic : false)
        ) {
          const updated = { ...w, dormeur: { ...d, customValue: dynamicDraws } };
          localStorage.setItem(LS_POOL_WINDOWS_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event(EVENT_POOL_WINDOWS_CHANGED));
        }
      }
    } catch {
      // no-op
    }
  }, [fullHistory]);

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
        // Ne pas restaurer si le state appartient à un autre utilisateur
        if (state._owner != null && state._owner !== user?.username) {
          // state d'un autre user, déjà vidé au login ; ne rien restaurer
        } else {
          isRestoringRef.current = true; // MARK AS RESTORING

          // Mode is NOT loaded from localStorage - it's always based on user role
          // Set mode based on user role (ignoring any saved value)
          if (user?.role === 'admin' || user?.role === 'vip' || user?.role === 'abonne') {
            setMode('manual');
          } else {
            setMode('auto'); // invite or unknown
          }

          if (state.autoDraws) setAutoDraws(state.autoDraws.map((d: any) => ({ ...d, date: new Date(d.date) })));
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

          if (state.influenceFreq !== undefined) setInfluenceFreq(Math.max(0, Math.min(10, state.influenceFreq)));
          if (state.influenceSurrepr !== undefined) setInfluenceSurrepr(Math.max(0, Math.min(10, state.influenceSurrepr)));
          if (state.influenceTrend !== undefined) setInfluenceTrend(Math.max(0, Math.min(10, state.influenceTrend)));
          if (state.hazardLevel !== undefined) setHazardLevel(Math.max(0, Math.min(10, state.hazardLevel)));
          if (state.tendencyLevel !== undefined) setTendencyLevel(Math.max(0, Math.min(10, state.tendencyLevel)));
          if (state.dormeurBallLevel !== undefined) setDormeurBallLevel(Math.max(0, Math.min(10, state.dormeurBallLevel)));
          if (state.dormeurStarLevel !== undefined) setDormeurStarLevel(Math.max(0, Math.min(10, state.dormeurStarLevel)));

          // Manual selection & SOURCES
          if (state.selectedNumbers) setSelectedNumbers(state.selectedNumbers);
          if (state.selectedStars) setSelectedStars(state.selectedStars);
          if (state.numberSources) setNumberSources(state.numberSources);
          if (state.starSources) setStarSources(state.starSources);

          // Restore simplified mode (default to true if not found)
          if (state.isSimplifiedMode !== undefined) setIsSimplifiedMode(state.isSimplifiedMode);
          else setIsSimplifiedMode(true); // Default to simplified mode

          // Priorité de tri : conserver la mémoire entre sessions (sans reset)
          if (state.sortPriority1 != null || state.sortPriority2 != null || state.sortPriority3 != null) {
            const [p1, p2, p3] = normalizeSortPriorities(state.sortPriority1, state.sortPriority2, state.sortPriority3);
            setSortPriority1(p1);
            setSortPriority2(p2);
            setSortPriority3(p3);
          }
        }
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
    if (isRestoringRef.current) return;

    // SAVE STATE (mode is NOT saved - it's always based on user role)
    const stateToSave = {
      autoDraws,
      generatedNumbers,
      generatedStars,
      selectedPreset,
      selectedWeightPreset,
      weightPresetsData,
      weightHigh,
      weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
      influenceFreq, influenceSurrepr, influenceTrend,
      hazardLevel,
      tendencyLevel,
      dormeurBallLevel,
      dormeurStarLevel,
      selectedNumbers, selectedStars,
      numberSources, starSources,
      isSimplifiedMode,
      sortPriority1,
      sortPriority2,
      sortPriority3,
      _owner: user?.username ?? null, // pour vider console_state au login si autre utilisateur
    };
    localStorage.setItem('console_state', JSON.stringify(stateToSave));
  }, [
    autoDraws, generatedNumbers, generatedStars, selectedPreset,
    selectedWeightPreset, weightPresetsData,
    weightHigh,
    weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
    influenceFreq, influenceSurrepr, influenceTrend,
    hazardLevel,
    tendencyLevel,
    dormeurBallLevel,
    dormeurStarLevel,
    selectedNumbers, selectedStars,
    numberSources, starSources,
    isSimplifiedMode,
    sortPriority1,
    sortPriority2,
    sortPriority3,
    user?.username
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

  useEffect(() => {
    if (!ballPools || !starPools) return;
    const top3 = (arr: { number: number }[] | undefined) => (arr ?? []).slice(0, 3).map((x) => x.number);

    void top3;
  }, [ballPools, starPools]);

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
        } else if (priority === 'surrepr') {
          tieDiff = b.surreprZ - a.surreprZ;
        } else if (priority === 'trend') {
          tieDiff = b.trend - a.trend;
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
        } else if (priority === 'surrepr') {
          tieDiff = b.surreprZ - a.surreprZ;
        } else if (priority === 'trend') {
          tieDiff = b.trend - a.trend;
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
    setSortPriority2('surrepr');
    setSortPriority3('trend');

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

    // Réglage "0" = neutre (aucun préréglage). Aucune action.
    if (selectedPreset === "0") return;

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

          setAvoidFriday(presetData.avoidFriday);

          // Mode is NOT restored from preset - it's always based on user role

          // Restore nouveaux paramètres (avec valeurs par défaut pour rétrocompatibilité)
          if (presetData.hazardLevel !== undefined) setHazardLevel(Math.max(0, Math.min(10, presetData.hazardLevel)));
          if (presetData.tendencyLevel !== undefined) setTendencyLevel(presetData.tendencyLevel);
          if (presetData.influenceFreq !== undefined) setInfluenceFreq(Math.max(0, Math.min(10, presetData.influenceFreq)));
          if (presetData.influenceSurrepr !== undefined) setInfluenceSurrepr(Math.max(0, Math.min(10, presetData.influenceSurrepr)));
          if (presetData.influenceTrend !== undefined) setInfluenceTrend(Math.max(0, Math.min(10, presetData.influenceTrend)));
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

          // Restaurer les priorités de tri (rétro-compat: "dormeur" => "surrepr")
          const [p1, p2, p3] = normalizeSortPriorities(presetData.sortPriority1, presetData.sortPriority2, presetData.sortPriority3);
          setSortPriority1(p1);
          setSortPriority2(p2);
          setSortPriority3(p3);

          // playSound('click'); // Optional: feedback on load
        }
      } catch (e) {
        console.error("Error loading presets", e);
      }
    }
  }, [selectedPreset, user]);

  const handlePresetDoubleClick = () => {
    if (!user) return;

    // Réglage "0" = aucun préréglage, pas de sauvegarde possible
    if (selectedPreset === "0") {
      toast.error("Réglage 0 : aucun préréglage à sauvegarder");
      return;
    }

    // Gather current state - TOUS les paramètres
    const currentConfig: PresetConfig = {
      weightHigh,
      weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
      avoidFriday,
      mode,
      // Nouveaux paramètres
      hazardLevel,
      tendencyLevel,
      influenceFreq,
      influenceSurrepr,
      influenceTrend,
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
    setPresetHasData(prev => ({ ...prev, [selectedPreset]: true }));

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
      setPresetHasData(prev => ({ ...prev, [selectedPreset]: false }));
      playSound('click');
    }
    setContextMenu(null);
  };

  // Save a specific preset from the dropdown
  const handleSavePreset = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    // Réglage "0" = aucun préréglage, pas de sauvegarde possible
    if (presetId === "0") {
      toast.error("Réglage 0 : aucun préréglage à sauvegarder");
      return;
    }

    // Gather current state - TOUS les paramètres
    const currentConfig: PresetConfig = {
      weightHigh,
      weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur,
      avoidFriday,
      mode,
      // Nouveaux paramètres
      hazardLevel,
      tendencyLevel,
      influenceFreq,
      influenceSurrepr,
      influenceTrend,
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
    setPresetHasData(prev => ({ ...prev, [presetId]: true }));

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
      setPresetHasData(prev => ({ ...prev, [presetId]: false }));
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

    // Réglage "0" = neutre (aucun préréglage). Aucune action, pas de chargement.
    if (presetId === "0") return;

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

        // Mode is NOT restored from config - it's always based on user role

        // Restore nouveaux paramètres (avec vérification pour rétrocompatibilité)
        if (config.hazardLevel !== undefined) setHazardLevel(Math.max(0, Math.min(10, config.hazardLevel)));
        if (config.tendencyLevel !== undefined) setTendencyLevel(config.tendencyLevel);
        if (config.influenceFreq !== undefined) setInfluenceFreq(Math.max(0, Math.min(10, config.influenceFreq)));
        if (config.influenceSurrepr !== undefined) setInfluenceSurrepr(Math.max(0, Math.min(10, config.influenceSurrepr)));
        if (config.influenceTrend !== undefined) setInfluenceTrend(Math.max(0, Math.min(10, config.influenceTrend)));
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

        // Restaurer les priorités de tri (rétro-compat: "dormeur" => "surrepr")
        const [p1, p2, p3] = normalizeSortPriorities(config.sortPriority1, config.sortPriority2, config.sortPriority3);
        setSortPriority1(p1);
        setSortPriority2(p2);
        setSortPriority3(p3);

        toast.success(`Réglage ${presetId} chargé`);
      }
    }
  };

  const handleGenerate = async (modeOverride?: 'manual' | 'auto') => {
    const effectiveMode = typeof modeOverride === 'string' ? modeOverride : mode;
    let tokenLocal: string | null = null;
    let seqLocal = 0;

    // Clé d'exploration/anti-doublons par tirage visé + graduation (CHAOS 0..10)
    const nextDrawForKey = getProchainTirage();
    const targetDateKey = nextDrawForKey.date.toISOString().split('T')[0];
    const koKey = `${targetDateKey}|${koGrad}`;
    const koRunIndex = koRunCounts[koKey] ?? 0;

    const comboKey = (nums: number[], stars: number[]) => {
      const n = [...nums].sort((a, b) => a - b).join("-");
      const s = [...stars].sort((a, b) => a - b).join("-");
      return `${n}|${s}`;
    };

    // Charger (et mettre en cache) les grilles déjà jouées en DB pour le tirage visé,
    // afin d'éviter de régénérer une combinaison déjà existante.
    let forbiddenDbKeys: string[] = dbComboKeysByTargetDate[targetDateKey] ?? [];
    if (!dbComboKeysByTargetDate[targetDateKey]) {
      try {
        const res = await fetch("/api/grids", { credentials: "include" });
        if (res.ok) {
          const grids = await res.json();
          const keys: string[] = [];
          for (const g of grids ?? []) {
            const gTarget = typeof g?.targetDate === "string" ? g.targetDate : null;
            if (gTarget !== targetDateKey) continue;
            const nums = Array.isArray(g?.numbers) ? g.numbers : [];
            const stars = Array.isArray(g?.stars) ? g.stars : [];
            if (nums.length === 0 || stars.length === 0) continue;
            keys.push(comboKey(nums, stars));
          }
          forbiddenDbKeys = keys;
          setDbComboKeysByTargetDate(prev => ({ ...prev, [targetDateKey]: keys }));
        }
      } catch {
        // ignore: offline/guest or network issue
      }
    }

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

        // CHAOS (0..10) => taille de vivier (boules/étoiles) selon le tableau de graduation
        // Le vivier doit toujours être >= au tarif (sinon impossible de générer).
        const ko = koGrad; // déjà clampé 0..10
        const targetPoolBalls = Math.max(KO_GRADUATIONS[ko].balls, targetNums); // 5..50
        const targetPoolStars = Math.max(KO_GRADUATIONS[ko].stars, targetStars); // 2..12

        // Viviers Dormeur (utiles pour le potard DORMEUR / remplacements)
        const poolDormeur = (ballPools?.byDormeur?.slice(0, targetPoolBalls).map(s => s.number)) ?? safeDormeurStats.slice(0, 10).map(s => s.number);
        const poolStarDormeur = (starPools?.byDormeur?.slice(0, targetPoolStars).map(s => s.number)) ?? safeDormeurStarStats.slice(0, 4).map(s => s.number);

        // Safety check: If pools are empty (stats not loaded), we can't generate statistically
        if ((ballPools?.byNumeric?.length ?? 0) === 0) {
          console.error("CRITICAL: Stats appear empty during generation");
          // We will NOT use random fallback as requested, but we must alert the user or retry logic
          // For now, let's proceed, maybe lower pools have data?
        }

        // (debug logging removed)

        // --- Vivier & STAT (plan validé) ---
        // Vivier : un seul score par boule. Un seul knob à 10 → ordre = ce critère seul (F, S ou T).
        // Plusieurs > 0 → score = base (critère priorité 1) + influence graduée 2 + 3 (sans cap).
        // Priorité de tri : départage uniquement quand scores très proches/égaux (ne remplace pas le critère à 10).
        // STAT 10 (et 9) : tirage = les k premiers du vivier (pole stricte). STAT 0 : k tirages aléatoires sans remise dans le vivier.
        // STAT 1–8 : panier qu’on gigote (plus STATS haut, plus proche du top).
        // CHAOS/VIVIER : taille du vivier. DORMEUR : remplacement séparé via steppers.

        // Full stats for scoring (so ANY candidate has frequency + tendance + surreprZ)
        const allNumStats: PoolItem[] = ballPools?.byNumeric ?? [];
        const allStarStats: PoolItem[] = starPools?.byNumeric ?? [];

        // Rank maps for Fréquence (used to compute F_score in [0..1])
        const numFreqRank = new Map<number, number>();
        const starFreqRank = new Map<number, number>();
        (ballPools?.byFrequency ?? []).forEach((it, idx) => numFreqRank.set(it.number, idx + 1));
        (starPools?.byFrequency ?? []).forEach((it, idx) => starFreqRank.set(it.number, idx + 1));
        const numFreqCount = Math.max(1, ballPools?.byFrequency?.length ?? 1);
        const starFreqCount = Math.max(1, starPools?.byFrequency?.length ?? 1);

        // Mix F/S/T : poids = influence des 3 knobs (0-10 → 0-1). Priorité de tri pour départager.
        const wF = Math.max(0, Math.min(10, influenceFreq)) / 10;
        const wS = Math.max(0, Math.min(10, influenceSurrepr)) / 10;
        const wT = Math.max(0, Math.min(10, influenceTrend)) / 10;

        // Coefficients d’influence graduée : priorité 1 = base (1), priorité 2 (0.4), priorité 3 (0.25)
        const coefP1 = 1.0;
        const coefP2 = 0.4;
        const coefP3 = 0.25;
        const zCap = 2.5;
        const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

        const scoreFromStat = (stat: PoolItem | undefined, isStar: boolean) => {
          if (!stat) return Number.NEGATIVE_INFINITY;

          const rankMap = isStar ? starFreqRank : numFreqRank;
          const rankCount = isStar ? starFreqCount : numFreqCount;
          const rank = rankMap.get(stat.number) ?? rankCount;
          const denom = Math.max(1, rankCount - 1);
          const F_score = 1 - (rank - 1) / denom;

          const z = stat.surreprZ ?? 0;
          const S_score = Math.tanh(z / zCap);

          const dir = stat.trendDirection === 'hausse' ? 1 : stat.trendDirection === 'baisse' ? -1 : 0;
          const T_score = dir * clamp((stat.trend ?? 0) / 10, 0, 1);

          // Un seul critère actif à 10 → ordre du vivier = ordre de ce critère seul (sans cap ni mélange)
          const onlyF = wF > 0 && wS === 0 && wT === 0;
          const onlyS = wF === 0 && wS > 0 && wT === 0;
          const onlyT = wF === 0 && wS === 0 && wT > 0;
          if (onlyF) return F_score;
          if (onlyS) return S_score;
          if (onlyT) return T_score;

          // Plusieurs > 0 : score = base (critère priorité 1) + influence graduée 2 + 3 (chaîne priorité 1 → 2 → 3), sans cap
          const contributions: Record<'frequency' | 'surrepr' | 'trend', number> = {
            frequency: wF * F_score,
            surrepr: wS * S_score,
            trend: wT * T_score,
          };
          const priorities = [sortPriority1, sortPriority2, sortPriority3];
          const coefs = [coefP1, coefP2, coefP3];
          let score = 0;
          for (let i = 0; i < 3; i++) score += coefs[i] * contributions[priorities[i]];
          return score;
        };

        // Construire les viviers effectifs par score (puis tiebreak via Priorités de tri)
        const makeBasket = (stats: PoolItem[], size: number, isStarCtx: boolean): number[] => {
          if (!stats || stats.length === 0) return [];

          const scored = stats.map(s => ({
            number: s.number,
            score: scoreFromStat(s, isStarCtx),
            frequency: s.frequency,
            surreprZ: s.surreprZ ?? 0,
            trend: s.trend ?? 0,
          }));

          const tiebreak = (a: typeof scored[number], b: typeof scored[number]) => {
            // Appliquer l’ordre Priorités de tri (Fréquence / Surreprés / Tendance)
            const priorities = [sortPriority1, sortPriority2, sortPriority3];
            for (const p of priorities) {
              const d =
                p === 'frequency' ? (b.frequency - a.frequency) :
                  p === 'surrepr' ? (b.surreprZ - a.surreprZ) :
                    (b.trend - a.trend);
              if (d !== 0) return d;
            }
            return a.number - b.number;
          };

          scored.sort((a, b) => (b.score - a.score) || tiebreak(a, b));
          return scored.slice(0, Math.min(size, scored.length)).map(x => x.number);
        };

        const basketBalls = makeBasket(allNumStats, targetPoolBalls, false);
        const basketStars = makeBasket(allStarStats, targetPoolStars, true);

        // Fallback si stats pas prêtes
        const combinedNumPool = basketBalls.length > 0
          ? basketBalls
          : ((ballPools?.byFrequency?.slice(0, Math.min(50, targetPoolBalls)).map(s => s.number)) ?? safeHighStats.slice(0, 10).map(s => s.number));
        const combinedStarPool = basketStars.length > 0
          ? basketStars
          : ((starPools?.byFrequency?.slice(0, Math.min(12, targetPoolStars)).map(s => s.number)) ?? safeHighStarStats.slice(0, 12).map(s => s.number));

        // Compat: le code plus bas attend des pools "High" pour le mode pondéré.
        // Avec le nouveau système, le vivier principal = `combined*Pool`.
        const poolHigh = combinedNumPool;
        const poolStarHigh = combinedStarPool;

        // Helper to pick based on CHAOS (scénario), TENDANCES (capée) et DORMEUR
        // Track "selection score" (finalScore) used during picks for later dormeur replacement.
        const selectionScoreNums: Record<number, number> = {};
        const selectionScoreStars: Record<number, number> = {};
        let forceExplore = false;
        let koLocalAttempt = 0;
        const pickWithStats = (pool: number[], stats: PoolItem[], count: number, exclude: number[] = [], dormeurPool: number[] = [], isStarContext: boolean = false) => {
          const uniquePool = Array.from(new Set(pool)).filter(n => !exclude.includes(n));

          const statByNumber = new Map(stats.map(s => [s.number, s] as const));
          const poolWithStats = uniquePool.map(num => {
            const stat = statByNumber.get(num);
            const isDormeur = dormeurPool.includes(num);
            const finalScore = scoreFromStat(stat, isStarContext);
            return {
              num,
              frequency: stat?.frequency ?? 0,
              trendScore: stat?.trend ?? 0,
              surreprZ: stat?.surreprZ ?? 0,
              isDormeur,
              finalScore
            };
          });

          const priorities = [sortPriority1, sortPriority2, sortPriority3];
          const tieBreak = (a: typeof poolWithStats[number], b: typeof poolWithStats[number]) => {
            for (const p of priorities) {
              const d =
                p === 'frequency' ? (b.frequency - a.frequency) :
                  p === 'surrepr' ? (b.surreprZ - a.surreprZ) :
                    (b.trendScore - a.trendScore);
              if (d !== 0) return d;
            }
            return a.num - b.num;
          };

          const sorted = poolWithStats
            .sort((a, b) =>
              (b.finalScore - a.finalScore) ||
              tieBreak(a, b)
            );

          const maxPool = sorted.length;
          if (maxPool <= count) {
            sorted.forEach(s => {
              if (isStarContext) selectionScoreStars[s.num] = s.finalScore;
              else selectionScoreNums[s.num] = s.finalScore;
            });
            return sorted.map(s => s.num);
          }

          // STATS (tendencyLevel) : 0 = hasard pur, 10 = stats pures (pole stricte). Défaut 0.
          const statsLevel = Math.max(0, Math.min(10, tendencyLevel));

          // STATS 9–10 : application stricte = prendre les « count » premiers (pole position)
          if (statsLevel >= 9) {
            const pickedSlice = sorted.slice(0, count);
            pickedSlice.forEach(s => {
              if (isStarContext) selectionScoreStars[s.num] = s.finalScore;
              else selectionScoreNums[s.num] = s.finalScore;
            });
            return pickedSlice.map(s => s.num);
          }

          // STATS 0 : hasard pur = tirage aléatoire sans remise dans le vivier (panier qu’on gigote)
          if (statsLevel <= 0.5) {
            const shuffled = [...sorted].sort(() => Math.random() - 0.5);
            const pickedSlice = shuffled.slice(0, count);
            pickedSlice.forEach(s => {
              if (isStarContext) selectionScoreStars[s.num] = s.finalScore;
              else selectionScoreNums[s.num] = s.finalScore;
            });
            return pickedSlice.map(s => s.num);
          }

          // STATS entre 1 et 9 : illusion « panier qu’on gigote » — plus STATS est haut, plus on reste proche de la pole
          // Poids par rang : exp(-rang / temp), temp = (10 - statsLevel) * 0.5 + 0.2
          const temp = (10 - statsLevel) * 0.5 + 0.2;
          const indices = Array.from({ length: maxPool }, (_, i) => i);
          const pickedIndices: number[] = [];
          let remainingIndices = [...indices];

          for (let p = 0; p < count; p++) {
            const weights = remainingIndices.map(i => Math.exp(-i / temp));
            const totalW = weights.reduce((a, w) => a + w, 0);
            if (totalW <= 0) {
              const idx = remainingIndices.shift()!;
              pickedIndices.push(idx);
              continue;
            }
            let r = Math.random() * totalW;
            let chosenIdx = 0;
            for (let i = 0; i < remainingIndices.length; i++) {
              r -= weights[i];
              if (r <= 0) {
                chosenIdx = i;
                break;
              }
            }
            const idx = remainingIndices.splice(chosenIdx, 1)[0];
            pickedIndices.push(idx);
          }

          const picked = pickedIndices.map(i => sorted[i]);
          picked.forEach(s => {
            if (isStarContext) selectionScoreStars[s.num] = s.finalScore;
            else selectionScoreNums[s.num] = s.finalScore;
          });
          return picked.map(s => s.num);
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

        // Anti-doublons pour le tirage visé: DB + session (autoDraws)
        const forbiddenKeys = new Set<string>(forbiddenDbKeys);
        autoDraws.forEach(d => {
          if (d?.nums?.length && d?.stars?.length) forbiddenKeys.add(comboKey(d.nums, d.stars));
        });

        const maxUniqAttempts = 180;
        let foundUnique = false;

        for (let attempt = 0; attempt < maxUniqAttempts; attempt++) {
          // Ré-initialiser à chaque tentative
          calculatedNums = [];
          calculatedStars = [];
          calcNumSources = {};
          calcStarSources = {};
          for (const k of Object.keys(selectionScoreNums)) delete selectionScoreNums[Number(k)];
          for (const k of Object.keys(selectionScoreStars)) delete selectionScoreStars[Number(k)];

          forceExplore = attempt > 0;
          koLocalAttempt = attempt;

          if (!isWeightsEnabled || weightsAreZero) {
            // --- PURE STATISTICS MODE ---
            calculatedNums = pickWithStats(combinedNumPool, allNumStats, totalNums, [], poolDormeur, false).sort((a, b) => a - b);
            calculatedNums.forEach(num => {
              calcNumSources[num] = getSourceCategory(num, false);
            });

            // Stars: always pure stats
            calculatedStars = pickWithStats(combinedStarPool, allStarStats, totalStars, [], poolStarDormeur, true).sort((a, b) => a - b);
            calculatedStars.forEach(num => {
              calcStarSources[num] = getSourceCategory(num, true);
            });
          } else {
            // --- WEIGHTED MODE (PONDÉRÉ) ---
            let wantHigh = Math.max(0, Math.floor(effectiveWeightHigh));
            let wantDormeur = Math.max(0, Math.floor(effectiveWeightDormeur));

            let sumWant = wantHigh + wantDormeur;
            while (sumWant > totalNums) {
              if (wantHigh > 0) wantHigh--;
              else if (wantDormeur > 0) wantDormeur--;
              sumWant = wantHigh + wantDormeur;
            }

            const pickedNums: number[] = [];
            const pickCategory = (pool: number[], count: number) => {
              if (count <= 0) return;
              const chosen = pickWithStats(pool, allNumStats, count, pickedNums, poolDormeur, false);
              chosen.forEach(n => {
                if (!pickedNums.includes(n)) pickedNums.push(n);
              });
            };

            pickCategory(poolHigh, wantHigh);
            pickCategory(poolDormeur, wantDormeur);

            const remainingNumsCount = totalNums - pickedNums.length;
            if (remainingNumsCount > 0) {
              const extra = pickWithStats(combinedNumPool, allNumStats, remainingNumsCount, pickedNums, poolDormeur, false);
              extra.forEach(n => {
                if (!pickedNums.includes(n)) pickedNums.push(n);
              });
            }

            calculatedNums = pickedNums.slice(0, totalNums).sort((a, b) => a - b);
            calculatedNums.forEach(num => {
              calcNumSources[num] = getSourceCategory(num, false);
            });

            // Stars
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
              const chosen = pickWithStats(pool, allStarStats, count, pickedStars, poolStarDormeur, true);
              chosen.forEach(n => {
                if (!pickedStars.includes(n)) pickedStars.push(n);
              });
            };

            pickStarCategory(poolStarHigh, wantStarHigh);
            pickStarCategory(poolStarDormeur, wantStarDormeur);

            const remainingStarsCount = totalStars - pickedStars.length;
            if (remainingStarsCount > 0) {
              const extraStars = pickWithStats(combinedStarPool, allStarStats, remainingStarsCount, pickedStars, poolStarDormeur, true);
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
              const dormeurPoolFull = dormeurStats.map(s => s.number);
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
            }
          }

          const key = comboKey(calculatedNums, calculatedStars);
          if (!forbiddenKeys.has(key)) {
            forbiddenKeys.add(key);
            foundUnique = true;
            break;
          }
        }

        if (!foundUnique) {
          throw new Error("Aucune combinaison unique trouvée (vivier épuisé ou contraintes trop fortes).");
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
        setKoRunCounts(prev => ({ ...prev, [koKey]: (prev[koKey] ?? 0) + 1 }));

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

    // 4. Reset Vivier, Stat, Dormeur et influences (Fréquence, Surreprés, Tendance)
    setHazardLevel(0);
    setTendencyLevel(0);
    setInfluenceFreq(0);
    setInfluenceSurrepr(0);
    setInfluenceTrend(0);

    // 5. Reset Email/SMS
    setEmailNotify(false);
    setSmsNotify(false);

    // 6. Reset compteurs d'envoi
    setSendCount(0);
    setIsSending(false);
    setSendingMessage("");

    // 9. Reset preset sélectionné
    setSelectedPreset("0");

    // 10. Reset Priorité de tri (défaut : Fréquence, Surreprésentation, Tendance)
    setSortPriority1('frequency');
    setSortPriority2('surrepr');
    setSortPriority3('trend');

    // 11. Update Limits
    setMaxWeightLimit(10);

    playSound('click');
    toast.success("Réinitialisation complète effectuée");
  };

  const handleSend = () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4faeacba-5ea4-44bf-aa3a-fb609e7f0ec3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'invite-sendlabel', hypothesisId: 'H1', location: 'Console.tsx:handleSend:entry', message: 'handleSend clicked', data: { role: user?.role ?? null, isInvite, emailModeEnabled, autoDrawsCount: autoDraws.length, generatedNumsCount: generatedNumbers.length, generatedStarsCount: generatedStars.length, isSending, sendingMessageLen: sendingMessage.length }, timestamp: Date.now() }) }).catch(() => { });
    // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4faeacba-5ea4-44bf-aa3a-fb609e7f0ec3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'invite-sendlabel', hypothesisId: 'H2', location: 'Console.tsx:executeEmailSend:start', message: 'executeEmailSend start', data: { role: user?.role ?? null, isInvite, isAbonne, autoDrawsCount: autoDraws.length, generatedNumsCount: generatedNumbers.length, emailModeEnabled }, timestamp: Date.now() }) }).catch(() => { });
    // #endregion

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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4faeacba-5ea4-44bf-aa3a-fb609e7f0ec3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'invite-sendlabel', hypothesisId: 'H2', location: 'Console.tsx:executeEmailSend:response', message: 'executeEmailSend got response', data: { ok: response.ok, status: response.status, success: !!data?.success, hasError: !!data?.error, drawsCount: drawsToSend.length }, timestamp: Date.now() }) }).catch(() => { });
      // #endregion

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

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4faeacba-5ea4-44bf-aa3a-fb609e7f0ec3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'invite-sendlabel', hypothesisId: 'H1', location: 'Console.tsx:executeEmailSend:success', message: 'executeEmailSend success; setSendingMessage', data: { sendingMessage: '📧 EMAIL ENVOYÉ !', willClearInMs: 5000 }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4faeacba-5ea4-44bf-aa3a-fb609e7f0ec3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'invite-sendlabel', hypothesisId: 'H3', location: 'Console.tsx:handleInviteGratitudeValidate:entry', message: 'invite gratitude validate clicked', data: { isAccepted, emailModeEnabled, autoDrawsCount: autoDraws.length, generatedNumsCount: generatedNumbers.length }, timestamp: Date.now() }) }).catch(() => { });
    // #endregion

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

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4faeacba-5ea4-44bf-aa3a-fb609e7f0ec3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'invite-sendlabel', hypothesisId: 'H4', location: 'Console.tsx:state:isSending+sendingMessage', message: 'send state changed', data: { isSending, sendingMessageLen: sendingMessage.length, sendingMessagePreview: sendingMessage.slice(0, 16) }, timestamp: Date.now() }) }).catch(() => { });
    // #endregion
  }, [isSending, sendingMessage]);

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
                      ? <span className="text-red-500 font-bold text-center leading-tight text-[10px]">RECHERCHE<br />PONDÉRÉE</span>
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
                        ? <span className="text-red-500 font-bold text-center leading-tight text-sm">RECHERCHE<br />PONDÉRÉE</span>
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
                ? <span className="text-red-500 font-bold text-center leading-tight text-[10px]">RECHERCHE<br />PONDÉRÉE</span>
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

      {/* Wrapper for perfect centering (relative pour positionner le volet chat) */}
      <div className="w-full flex justify-center relative">
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

              {/* CENTER: SOUND + (ADMIN: CLÉ) + CHAT */}
              <div className="flex items-center justify-center gap-[20px] h-full pt-[24px]">

                {/* SOUND TOGGLE */}
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

                {/* ADMIN: CLÉ (Panneau de contrôle) - même format que le bouton Chat */}
                {user?.role === 'admin' && (
                  <button
                    onClick={() => setIsDebugOpen(true)}
                    className="w-11 h-11 rounded-full border-2 border-[#d4af37] bg-[linear-gradient(180deg,#2a2a2a_0%,#1a1a1a_100%)] text-[#d4af37] hover:bg-[linear-gradient(180deg,#3a3a3a_0%,#2a2a2a_100%)] hover:border-[#ffd700] hover:shadow-[0_0_10px_rgba(212,175,55,0.5)] transition-all duration-300 flex items-center justify-center flex-shrink-0"
                    title="Panneau de contrôle"
                  >
                    <Wrench size={20} />
                  </button>
                )}

                {/* CHAT - bulle de parole, style bleu + nombre connectés + badge non lus */}
                <div className="flex flex-col items-center gap-0.5">
                  {!isChatOpen && (chatSocket.totalUnread ?? 0) > 0 && (
                    <span className="text-[11px] text-red-500 font-mono tabular-nums font-bold leading-none">
                      {chatSocket.totalUnread}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsChatOpen(true)}
                      className="w-9 h-9 rounded-full border-2 border-blue-500 bg-[linear-gradient(180deg,#1e3a5f_0%,#0f172a_100%)] text-blue-400 hover:bg-[linear-gradient(180deg,#2563eb_0%,#1e40af_100%)] hover:border-blue-400 hover:text-white hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-300 flex items-center justify-center flex-shrink-0"
                      title="Chat"
                    >
                      <MessageSquare size={18} strokeWidth={2.5} />
                    </button>
                    <span className="text-[15px] text-zinc-500 font-mono tabular-nums leading-none">
                      {chatSocket.connected ? chatSocket.othersConnectedCount : '—'}
                    </span>
                  </div>
                </div>

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
                                Réglage {num} {isPreset0 && "(Aucun préréglage)"}
                              </span>

                              <div className="flex items-center gap-2">
                                {isPreset0 ? (
                                  <span className="text-xs text-zinc-500 italic">Ne fait rien</span>
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
                  /* Mode simplifié : Priorité de tri déplacée dans la colonne Statistique */
                  <div className="flex-1 min-h-0 flex items-center justify-center py-1">
                    <ActionsControls variant="rack" />
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
              <div className="bg-[#111] border-2 border-zinc-800 rounded-xl p-2 flex flex-col items-center justify-start gap-2 shadow-inner relative overflow-hidden min-h-[465px] flex-shrink-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-black to-black pointer-events-none" />

                <div className="w-full space-y-1 relative z-10 pt-1">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1 mb-1">
                    <div className="text-center font-orbitron text-lg text-zinc-500 flex-1">EQUILIBRER</div>
                    <LEDIndicator active={false} color="green" />
                  </div>
                  {/* Espace réservé - toggles supprimés */}
                </div>

                <div className="w-full h-px bg-zinc-800 my-1" />

                {/* HAZARD CONTROL */}
                <div className="w-full space-y-2 relative z-10 flex flex-col items-center h-[198px] flex-shrink-0 justify-center -mt-[10px] pb-3">
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

                  {/* NOUVELLE LIGNE : Knobs 1, 2, 3 (sans action) */}
                  <div className="flex items-start justify-center gap-1 mt-4 w-full px-1">
                    {/* Knob FRÉQUENCE (Left) */}
                    <div className="flex flex-col items-center gap-4 w-[110px]">
                      <div className="h-6 flex items-center justify-center w-full text-center relative">
                        <span className="text-white font-rajdhani font-bold text-lg uppercase tracking-wider">
                          FRÉQUENCE
                        </span>
                      </div>

                      <div className="h-[60px] flex items-center justify-center">
                        <RotaryKnob
                          label=""
                          value={influenceFreq}
                          onChange={(v) => { setInfluenceFreq(v); playSound('knob'); }}
                          max={10}
                          size="xl"
                          knobColor="border-green-700 shadow-[0_0_15px_rgba(22,163,74,0.3)] bg-zinc-900"
                          indicatorColor="bg-green-600"
                          labelClassName="hidden"
                          valueClassName="text-green-500"
                        />
                      </div>
                    </div>

                    {/* Knob SURREPRÉS (Middle) */}
                    <div className="flex flex-col items-center gap-4 w-[110px]">
                      <div className="h-6 flex items-center justify-center w-full text-center relative">
                        <span className="text-white font-rajdhani font-bold text-lg uppercase tracking-wider">
                          SURREPRÉS
                        </span>
                      </div>

                      <div className="h-[60px] flex items-center justify-center">
                        <RotaryKnob
                          label=""
                          value={influenceSurrepr}
                          onChange={(v) => { setInfluenceSurrepr(v); playSound('knob'); }}
                          max={10}
                          size="xl"
                          knobColor="border-violet-700 shadow-[0_0_15px_rgba(124,58,237,0.3)] bg-zinc-900"
                          indicatorColor="bg-violet-600"
                          labelClassName="hidden"
                          valueClassName="text-violet-500"
                        />
                      </div>
                    </div>

                    {/* Knob TENDANCE (Right) */}
                    <div className="flex flex-col items-center gap-4 w-[110px]">
                      <div className="h-6 flex items-center justify-center w-full text-center relative">
                        <span className="text-white font-rajdhani font-bold text-lg uppercase tracking-wider">
                          TENDANCE
                        </span>
                      </div>

                      <div className="h-[60px] flex items-center justify-center">
                        <RotaryKnob
                          label=""
                          value={influenceTrend}
                          onChange={(v) => { setInfluenceTrend(v); playSound('knob'); }}
                          max={10}
                          size="xl"
                          knobColor="border-red-700 shadow-[0_0_15px_rgba(220,38,38,0.3)] bg-zinc-900"
                          indicatorColor="bg-red-600"
                          labelClassName="hidden"
                          valueClassName="text-red-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Padding entre les deux lignes de knobs (26px) */}
                  <div style={{ height: '26px' }} />

                  {/* Ligne du bas : +10px au-dessus pour ne faire descendre que cette ligne */}
                  <div className="w-full flex items-start justify-center" style={{ marginTop: '10px' }}>
                    <div className="flex items-start justify-center gap-1 w-full px-1">
                      {/* VIVIER Knob (Left) */}
                      <div className="flex flex-col items-center gap-4 w-[110px]">
                        <div className="h-6 flex items-center justify-center w-full text-center relative">
                          <span className="text-white font-rajdhani font-bold text-lg uppercase tracking-wider">
                            VIVIER
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
                        <div
                          className="h-4 -mt-3 flex items-center justify-center w-full text-center font-mono text-[11px] tracking-wider text-amber-400/90 select-none"
                          title={`Vivier: ${chaosLabel}`}
                        >
                          {chaosLabel}
                        </div>
                      </div>

                      {/* STATS Knob (Middle) */}
                      <div className="flex flex-col items-center gap-4 w-[110px]">
                        <div className="h-6 flex items-center justify-center w-full text-center relative">
                          <span className="text-white font-rajdhani font-bold text-lg uppercase tracking-wider">
                            STATS
                          </span>
                        </div>

                        <div className="h-[60px] flex items-center justify-center">
                          <RotaryKnob
                            label=""
                            value={tendencyLevel}
                            onChange={(v) => { setTendencyLevel(v); playSound('knob'); }}
                            max={10}
                            size="xl"
                            knobColor="border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] bg-zinc-900"
                            indicatorColor="bg-white"
                            labelClassName="hidden"
                            valueClassName="text-white"
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

                {/* Priorité de tri — déplacé depuis « Réaliser les tirages », zoom +10% */}
                <div className="w-full flex justify-center pt-2 pb-1 relative z-10" style={{ marginTop: '45px' }}>
                  <div className="w-64 origin-center" style={{ transform: 'scale(1.2)' }}>
                    <div className="w-full bg-black/30 rounded-lg border border-zinc-700 p-4">
                      <div className="text-sm font-bold text-zinc-400 mb-3 text-center">PRIORITÉS DE TRI</div>
                      <div className="flex flex-col gap-2">
                        {/* Ligne Fréquence - VERT */}
                        <div className="flex items-center justify-between">
                          <span className="text-base font-semibold text-zinc-300">Fréquence</span>
                          <div className="flex gap-2">
                            {[1, 2, 3].map(priority => (
                              <button
                                key={`col-freq-${priority}`}
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
                        {/* Ligne Surreprés. - VIOLET */}
                        <div className="flex items-center justify-between">
                          <span className="text-base font-semibold text-zinc-300">Surreprés.</span>
                          <div className="flex gap-2">
                            {[1, 2, 3].map(priority => (
                              <button
                                key={`col-surrepr-${priority}`}
                                onClick={() => {
                                  playSound('click');
                                  const oldPriority = sortPriority1 === 'surrepr' ? 1 : sortPriority2 === 'surrepr' ? 2 : 3;
                                  if (priority === 1) {
                                    const current = sortPriority1;
                                    setSortPriority1('surrepr');
                                    if (oldPriority === 2) setSortPriority2(current);
                                    else if (oldPriority === 3) setSortPriority3(current);
                                  } else if (priority === 2) {
                                    const current = sortPriority2;
                                    setSortPriority2('surrepr');
                                    if (oldPriority === 1) setSortPriority1(current);
                                    else if (oldPriority === 3) setSortPriority3(current);
                                  } else {
                                    const current = sortPriority3;
                                    setSortPriority3('surrepr');
                                    if (oldPriority === 1) setSortPriority1(current);
                                    else if (oldPriority === 2) setSortPriority2(current);
                                  }
                                }}
                                className={cn(
                                  "w-7 h-7 rounded-full text-sm font-bold transition-all",
                                  (priority === 1 && sortPriority1 === 'surrepr') ||
                                    (priority === 2 && sortPriority2 === 'surrepr') ||
                                    (priority === 3 && sortPriority3 === 'surrepr')
                                    ? "bg-violet-500 text-white shadow-[0_0_8px_rgba(139,92,246,0.6)]"
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
                                key={`col-trend-${priority}`}
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
                      title="Réinitialiser tous les réglages (y compris priorité de tri)"
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
                            ? <span className="text-red-500 font-bold text-center leading-tight">RECHERCHE<br />PONDÉRÉE</span>
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
                    )
                  })
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
              weightStarHigh, weightStarMid, weightStarLow, weightStarDormeur
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

          {/* Panneau Chat (glisse depuis la droite) */}
          {isChatOpen && (
            <>
              <div
                className="absolute inset-0 bg-black/50 z-40"
                onClick={handleCloseChat}
                aria-hidden="true"
              />
              <div
                className="absolute top-0 right-0 bottom-0 w-full max-w-[498px] bg-zinc-950 border-l-2 border-casino-gold/50 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-50 flex flex-col transition-transform duration-[350ms] ease-out"
                style={{ transform: chatPanelSlideIn ? 'translateX(0)' : 'translateX(100%)' }}
              >




                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {user?.id ? (
                    <ChatPanel
                      onClose={handleCloseChat}
                      isOpen={isChatOpen}
                      currentUserId={user.id}
                      currentUsername={user.username ?? ''}
                      currentUserRole={user.role ?? 'invite'}
                      chatSocket={chatSocket}
                    />
                  ) : (
                    <div className="flex-1 p-4 text-zinc-400 text-lg overflow-auto">
                      Connexion requise pour le chat.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </CasinoLayout>
  );
}
