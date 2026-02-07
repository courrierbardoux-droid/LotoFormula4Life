import React, { useEffect, useRef, useState } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { toast } from "sonner";
import type { FrequencyConfig, PeriodUnit, TrendWindowConfig } from "@/lib/lotoService";
import { motion } from "framer-motion";
import { useUser } from "@/lib/UserContext";

const LS_FREQ_CONFIG_KEY = "loto_freqConfig_v1";
const EVENT_FREQ_CONFIG_CHANGED = "loto:freqConfigChanged";
const LS_POOL_WINDOWS_KEY = "loto_poolWindows_v1";
const EVENT_POOL_WINDOWS_CHANGED = "loto:poolWindowsChanged";
const LS_POOL_WINDOW_PRESET_NUMBERS_KEY = "loto_poolWindowPresetNumbers_v1";
const EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED = "loto:poolWindowPresetNumbersChanged";

function safeParseFreqConfig(raw: string | null): FrequencyConfig | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as FrequencyConfig;
    if (!obj || typeof obj !== "object") return null;
    if (obj.type !== "all" && obj.type !== "last_20" && obj.type !== "last_year" && obj.type !== "custom") return null;
    if (obj.type === "custom") {
      if (!obj.customUnit || !obj.customValue) return null;
      return obj;
    }
    return obj;
  } catch {
    return null;
  }
}

export type SettingsMode = "all" | "windows";

export function SettingsPage({ mode = "all" }: { mode?: SettingsMode }) {
  const { user } = useUser();
  type PoolKey = "high" | "surrepr" | "trend" | "dormeur";
  type PoolWindowsConfig = { high: FrequencyConfig; surrepr: FrequencyConfig; trend: TrendWindowConfig; dormeur: FrequencyConfig };
  type WindowPreset =
    | "strict"
    | "standard"
    | "souple"
    | "dynamic"
    | "all"
    | "custom";
  type PresetNumberKey =
    | "strictDraws"
    | "standardDraws"
    | "soupleDraws"
    | "dynamicDraws"
    // Tendance: période récente R (tirages) associée aux presets Strict/Standard/Souple/Dynamique
    | "strictTrendR"
    | "standardTrendR"
    | "soupleTrendR"
    | "dynamicTrendR"
    | "yearsShort"
    | "yearsLong";
  type PoolWindowPresetNumbers = Record<PoolKey, Record<PresetNumberKey, number>>;
  const hasLoadedUserWindowsRef = useRef(false);

  const getPoolWindowsStorageKey = (userId?: number) => `loto_poolWindows_v1_u${userId ?? "unknown"}`;
  const getPresetNumbersStorageKey = (userId?: number) => `loto_poolWindowPresetNumbers_v1_u${userId ?? "unknown"}`;

  const approxTimeFromDraws = (draws: number) => {
    // EuroMillions: ~2 tirages/semaine => 1 tirage ≈ 3,5 jours.
    // On affiche une estimation lisible uniquement si >= ~1 an.
    const d = Math.max(0, Math.trunc(draws));
    const days = d * 3.5;
    if (days < 365) return null;
    const years = Math.floor(days / 365);
    const remDaysAfterYears = days - years * 365;
    const months = Math.floor(remDaysAfterYears / 30);
    const remDaysAfterMonths = remDaysAfterYears - months * 30;
    const weeks = Math.floor(remDaysAfterMonths / 7);
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} an${years > 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} mois`);
    if (years === 0 && weeks > 0) parts.push(`${weeks} sem`);
    if (parts.length === 0) return null;
    return `≈ ${parts.join(" ")}`;
  };

  const describeWindow = (cfg: FrequencyConfig | TrendWindowConfig) => {
    if (cfg.type === "all") return "Complet (2004 → aujourd'hui)";
    if (cfg.type === "custom") {
      const r = (cfg as TrendWindowConfig).trendPeriodR;
      return r != null ? `${cfg.customValue} ${cfg.customUnit}, R=${r}` : `${cfg.customValue} ${cfg.customUnit}`;
    }
    return cfg.type;
  };

  const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(n)));
  };

  const defaultPresetNumbers: PoolWindowPresetNumbers = {
    // High (Fréquences) — presets dédiés (tirages)
    // Strict / Standard / Souple sont modifiables, Dynamique est calculé automatiquement.
    high: { strictDraws: 1150, standardDraws: 680, soupleDraws: 430, dynamicDraws: 680, strictTrendR: 0, standardTrendR: 0, soupleTrendR: 0, dynamicTrendR: 0, yearsShort: 3, yearsLong: 10 },
    // Surreprésentation (z-score) — "courte utile"
    // - Strict / Standard stabilisent Boules+Étoiles
    // - Souple accepte plus de mouvement (plus réactif)
    // - Dynamique se recalcule après MAJ d'historique
    surrepr: { strictDraws: 430, standardDraws: 420, soupleDraws: 170, dynamicDraws: 420, strictTrendR: 0, standardTrendR: 0, soupleTrendR: 0, dynamicTrendR: 0, yearsShort: 3, yearsLong: 10 },
    // Tendance (W,R) — presets dédiés (tirages)
    // - W = fenêtre totale (référence)
    // - R = période récente comparée à W
    // - Dynamique se recalcule après MAJ d'historique
    trend: { strictDraws: 150, standardDraws: 140, soupleDraws: 100, dynamicDraws: 140, strictTrendR: 70, standardTrendR: 65, soupleTrendR: 45, dynamicTrendR: 65, yearsShort: 3, yearsLong: 10 },
    // Dormeur (retard / absence) — fenêtre "utile" = assez grande pour éviter les caps/ties (tous vus au moins une fois)
    dormeur: { strictDraws: 90, standardDraws: 60, soupleDraws: 40, dynamicDraws: 60, strictTrendR: 0, standardTrendR: 0, soupleTrendR: 0, dynamicTrendR: 0, yearsShort: 3, yearsLong: 10 },
  };

  const safeParsePresetNumbers = (raw: string | null): PoolWindowPresetNumbers | null => {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw) as Partial<PoolWindowPresetNumbers>;
      const keys: PoolKey[] = ["high", "surrepr", "trend", "dormeur"];
      const out: PoolWindowPresetNumbers = { ...defaultPresetNumbers };
      for (const k of keys) {
        const v = obj?.[k] as Partial<Record<PresetNumberKey, unknown>> | undefined;
        out[k] = {
          strictDraws: clampInt(v?.strictDraws, 1, 5000, defaultPresetNumbers[k].strictDraws),
          standardDraws: clampInt(v?.standardDraws, 1, 5000, defaultPresetNumbers[k].standardDraws),
          soupleDraws: clampInt(v?.soupleDraws, 1, 5000, defaultPresetNumbers[k].soupleDraws),
          dynamicDraws: clampInt(v?.dynamicDraws, 1, 5000, defaultPresetNumbers[k].dynamicDraws),
          strictTrendR: clampInt(v?.strictTrendR, 5, 500, defaultPresetNumbers[k].strictTrendR),
          standardTrendR: clampInt(v?.standardTrendR, 5, 500, defaultPresetNumbers[k].standardTrendR),
          soupleTrendR: clampInt(v?.soupleTrendR, 5, 500, defaultPresetNumbers[k].soupleTrendR),
          dynamicTrendR: clampInt(v?.dynamicTrendR, 5, 500, defaultPresetNumbers[k].dynamicTrendR),
          yearsShort: clampInt(v?.yearsShort, 1, 100, defaultPresetNumbers[k].yearsShort),
          yearsLong: clampInt(v?.yearsLong, 1, 100, defaultPresetNumbers[k].yearsLong),
        };
      }
      return out;
    } catch {
      return null;
    }
  };

  const [presetNumbers, setPresetNumbers] = useState<PoolWindowPresetNumbers>(() => {
    const key = user?.id ? getPresetNumbersStorageKey(user.id) : LS_POOL_WINDOW_PRESET_NUMBERS_KEY;
    const existing = safeParsePresetNumbers(localStorage.getItem(key));
    return existing ?? defaultPresetNumbers;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => {
      const key = user?.id ? getPresetNumbersStorageKey(user.id) : LS_POOL_WINDOW_PRESET_NUMBERS_KEY;
      const existing = safeParsePresetNumbers(localStorage.getItem(key));
      if (existing) {
        setPresetNumbers(existing);
      }
    };
    window.addEventListener(EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED, handler as EventListener);
    return () => window.removeEventListener(EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED, handler as EventListener);
  }, [user?.id]);

  const defaultPoolWindows: PoolWindowsConfig = {
    high: { type: "custom", customUnit: "draws", customValue: 680 },
    surrepr: { type: "custom", customUnit: "draws", customValue: 25 },
    trend: { type: "custom", customUnit: "draws", customValue: 140, trendPeriodR: 65 },
    dormeur: { type: "custom", customUnit: "draws", customValue: 60 },
  };

  const presetToWindow = (k: PoolKey, p: WindowPreset): PoolWindowsConfig[PoolKey] => {
    const nums = presetNumbers[k];
    if (k === "high" || k === "surrepr") {
      if (p === "strict") return { type: "custom", customUnit: "draws", customValue: nums.strictDraws };
      if (p === "standard") return { type: "custom", customUnit: "draws", customValue: nums.standardDraws };
      if (p === "souple") return { type: "custom", customUnit: "draws", customValue: nums.soupleDraws };
      if (p === "dynamic") return { type: "custom", customUnit: "draws", customValue: nums.dynamicDraws };
    }
    if (k === "trend") {
      if (p === "strict") return { type: "custom", customUnit: "draws", customValue: nums.strictDraws, trendPeriodR: nums.strictTrendR };
      if (p === "standard") return { type: "custom", customUnit: "draws", customValue: nums.standardDraws, trendPeriodR: nums.standardTrendR };
      if (p === "souple") return { type: "custom", customUnit: "draws", customValue: nums.soupleDraws, trendPeriodR: nums.soupleTrendR };
      if (p === "dynamic") return { type: "custom", customUnit: "draws", customValue: nums.dynamicDraws, trendPeriodR: nums.dynamicTrendR };
    }
    if (k === "dormeur") {
      if (p === "strict") return { type: "custom", customUnit: "draws", customValue: nums.strictDraws };
      if (p === "standard") return { type: "custom", customUnit: "draws", customValue: nums.standardDraws };
      if (p === "souple") return { type: "custom", customUnit: "draws", customValue: nums.soupleDraws };
      if (p === "dynamic") return { type: "custom", customUnit: "draws", customValue: nums.dynamicDraws };
    }
    if (p === "all") return { type: "all" };
    return { type: "custom", customUnit: "draws", customValue: 50 };
  };

  const presetToWindowFromNumbers = (k: PoolKey, nums: Record<PresetNumberKey, number>, p: WindowPreset): PoolWindowsConfig[PoolKey] => {
    // NOTE: cette fonction est utilisée pour recalculer la fenêtre active quand on modifie un chiffre.
    if (k === "trend") {
      if (p === "strict") return { type: "custom", customUnit: "draws", customValue: nums.strictDraws, trendPeriodR: nums.strictTrendR };
      if (p === "standard") return { type: "custom", customUnit: "draws", customValue: nums.standardDraws, trendPeriodR: nums.standardTrendR };
      if (p === "souple") return { type: "custom", customUnit: "draws", customValue: nums.soupleDraws, trendPeriodR: nums.soupleTrendR };
      if (p === "dynamic") return { type: "custom", customUnit: "draws", customValue: nums.dynamicDraws, trendPeriodR: nums.dynamicTrendR };
    }
    if (p === "strict") return { type: "custom", customUnit: "draws", customValue: nums.strictDraws };
    if (p === "standard") return { type: "custom", customUnit: "draws", customValue: nums.standardDraws };
    if (p === "souple") return { type: "custom", customUnit: "draws", customValue: nums.soupleDraws };
    if (p === "dynamic") return { type: "custom", customUnit: "draws", customValue: nums.dynamicDraws };
    if (p === "all") return { type: "all" };
    return { type: "custom", customUnit: "draws", customValue: 50 };
  };

  const windowToPreset = (k: PoolKey, cfg: FrequencyConfig | TrendWindowConfig): WindowPreset => {
    const nums = presetNumbers[k];
    if (cfg.type === "all") return "all";
    if (cfg.type === "custom") {
      if ((k === "high" || k === "surrepr") && cfg.customUnit === "draws") {
        if (cfg.customValue === nums.strictDraws) return "strict";
        if (cfg.customValue === nums.standardDraws) return "standard";
        if (cfg.customValue === nums.soupleDraws) return "souple";
        if (cfg.customValue === nums.dynamicDraws) return "dynamic";
      }
      if (k === "trend" && cfg.customUnit === "draws") {
        const r = (cfg as TrendWindowConfig).trendPeriodR ?? null;
        if (cfg.customValue === nums.strictDraws && r === nums.strictTrendR) return "strict";
        if (cfg.customValue === nums.standardDraws && r === nums.standardTrendR) return "standard";
        if (cfg.customValue === nums.soupleDraws && r === nums.soupleTrendR) return "souple";
        if (cfg.customValue === nums.dynamicDraws && r === nums.dynamicTrendR) return "dynamic";
      }
      if (k === "dormeur" && cfg.customUnit === "draws") {
        if (cfg.customValue === nums.strictDraws) return "strict";
        if (cfg.customValue === nums.standardDraws) return "standard";
        if (cfg.customValue === nums.soupleDraws) return "souple";
        if (cfg.customValue === nums.dynamicDraws) return "dynamic";
      }
    }
    return "custom";
  };

  const safeParsePoolWindows = (raw: string | null): PoolWindowsConfig | null => {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw) as Partial<PoolWindowsConfig & { trend?: TrendWindowConfig }>;
      const migrated: Partial<PoolWindowsConfig> = { ...obj };
      if (!migrated.surrepr && migrated.high) migrated.surrepr = migrated.high;
      const trend = migrated.trend as (FrequencyConfig & { trendPeriodR?: number }) | undefined;
      if (trend && typeof trend.trendPeriodR !== "number") {
        migrated.trend = { ...trend, trendPeriodR: 65 } as TrendWindowConfig;
      }
      const keys: PoolKey[] = ["high", "surrepr", "trend", "dormeur"];
      for (const k of keys) {
        const cfg = migrated?.[k];
        if (!cfg) return null;
        if (cfg.type !== "all" && cfg.type !== "last_20" && cfg.type !== "last_year" && cfg.type !== "custom") return null;
        if (cfg.type === "custom" && (!cfg.customUnit || !cfg.customValue)) return null;
      }
      return migrated as PoolWindowsConfig;
    } catch {
      return null;
    }
  };

  const [poolWindows, setPoolWindows] = useState<PoolWindowsConfig>(() => {
    const key = user?.id ? getPoolWindowsStorageKey(user.id) : LS_POOL_WINDOWS_KEY;
    const existing = safeParsePoolWindows(localStorage.getItem(key));
    if (existing) return existing;
    // Compat: si l'ancien réglage unique existe, on l'utilise comme fenêtre High
    const old = safeParseFreqConfig(localStorage.getItem(LS_FREQ_CONFIG_KEY));
    const high = old ?? defaultPoolWindows.high;
    return { ...defaultPoolWindows, high, surrepr: high };
  });

  // AUTO-APPLY (Tableau 1): on persiste et on notifie dès que la fenêtre change.
  useEffect(() => {
    const key = user?.id ? getPoolWindowsStorageKey(user.id) : LS_POOL_WINDOWS_KEY;
    localStorage.setItem(key, JSON.stringify(poolWindows));
    window.dispatchEvent(new Event(EVENT_POOL_WINDOWS_CHANGED));
  }, [poolWindows, user?.id]);

  // Charger depuis la DB (par utilisateur) au 1er rendu
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user-settings/windows", { credentials: "include" });
        if (!res.ok) {
          hasLoadedUserWindowsRef.current = true;
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        // 1) Presets numériques (valeurs)
        const serverPresetNumbersRaw = data?.poolWindowPresetNumbers ?? null;
        const serverPresetNumbers = serverPresetNumbersRaw
          ? safeParsePresetNumbers(JSON.stringify(serverPresetNumbersRaw))
          : null;
        if (serverPresetNumbers) {
          localStorage.setItem(getPresetNumbersStorageKey(user.id), JSON.stringify(serverPresetNumbers));
          setPresetNumbers(serverPresetNumbers);
        }
        const effectivePresetNumbers =
          serverPresetNumbers ??
          safeParsePresetNumbers(localStorage.getItem(getPresetNumbersStorageKey(user.id))) ??
          defaultPresetNumbers;

        // 2) Fenêtres actives
        const serverPoolWindowsRaw = data?.poolWindows ?? null;
        const serverPoolWindows = serverPoolWindowsRaw ? safeParsePoolWindows(JSON.stringify(serverPoolWindowsRaw)) : null;
        if (serverPoolWindows) {
          localStorage.setItem(getPoolWindowsStorageKey(user.id), JSON.stringify(serverPoolWindows));
          hasLoadedUserWindowsRef.current = true;
          setPoolWindows(serverPoolWindows);
          return;
        }

        // Aucun choix spécifique: Dynamics pour les 4 pools (High / Surrepr / Trend / Dormeur)
        const dynamicDefaults: PoolWindowsConfig = {
          high: presetToWindowFromNumbers("high", effectivePresetNumbers.high, "dynamic"),
          surrepr: presetToWindowFromNumbers("surrepr", effectivePresetNumbers.surrepr, "dynamic"),
          trend: presetToWindowFromNumbers("trend", effectivePresetNumbers.trend, "dynamic"),
          dormeur: presetToWindowFromNumbers("dormeur", effectivePresetNumbers.dormeur, "dynamic"),
        };
        localStorage.setItem(getPoolWindowsStorageKey(user.id), JSON.stringify(dynamicDefaults));
        hasLoadedUserWindowsRef.current = true;
        setPoolWindows(dynamicDefaults);
      } catch {
        hasLoadedUserWindowsRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Auto-save en DB (debounce) dès qu'on change Tableau 1
  useEffect(() => {
    if (!user?.id) return;
    if (!hasLoadedUserWindowsRef.current) return;
    const id = window.setTimeout(async () => {
      try {
        await fetch("/api/user-settings/windows", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poolWindows,
            poolWindowPresetNumbers: presetNumbers,
          }),
        });
      } catch {
        // ignore
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [poolWindows, presetNumbers, user?.id]);

  const [poolWindowPresets, setPoolWindowPresets] = useState<Record<PoolKey, WindowPreset>>(() => ({
    high: windowToPreset("high", poolWindows.high),
    surrepr: windowToPreset("surrepr", poolWindows.surrepr),
    trend: windowToPreset("trend", poolWindows.trend),
    dormeur: windowToPreset("dormeur", poolWindows.dormeur),
  }));

  // Garder les radios en phase si la fenêtre change (reset / chargement / custom)
  useEffect(() => {
    setPoolWindowPresets({
      high: windowToPreset("high", poolWindows.high),
      surrepr: windowToPreset("surrepr", poolWindows.surrepr),
      trend: windowToPreset("trend", poolWindows.trend),
      dormeur: windowToPreset("dormeur", poolWindows.dormeur),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolWindows]);

  useEffect(() => {
  }, [poolWindowPresets.surrepr, presetNumbers.surrepr?.dynamicDraws, presetNumbers.surrepr?.standardDraws]);

  useEffect(() => {
    const existing = safeParseFreqConfig(localStorage.getItem(LS_FREQ_CONFIG_KEY));
    if (!existing) return;
    // Compat: si un ancien réglage high existait, on l'applique à High
    setPoolWindows((prev) => ({ ...prev, high: existing }));
    setPoolWindowPresets((prev) => ({ ...prev, high: windowToPreset("high", existing) }));
  }, []);

  useEffect(() => {
    // Si l'utilisateur change les presets numériques, on recalcule la radio sélectionnée (utile au rechargement / migration)
    setPoolWindowPresets((prev) => ({
      ...prev,
      high: windowToPreset("high", poolWindows.high),
      surrepr: windowToPreset("surrepr", poolWindows.surrepr),
      trend: windowToPreset("trend", poolWindows.trend),
      dormeur: windowToPreset("dormeur", poolWindows.dormeur),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetNumbers]);

  const persistPresetNumbers = (next: PoolWindowPresetNumbers) => {
    const key = user?.id ? getPresetNumbersStorageKey(user.id) : LS_POOL_WINDOW_PRESET_NUMBERS_KEY;
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED));
  };

  const commitPresetNumber = (k: PoolKey, key: PresetNumberKey, nextValue: number) => {
    const sanitized =
      key === "yearsShort" || key === "yearsLong"
        ? clampInt(nextValue, 1, 100, presetNumbers[k][key])
        : key === "strictTrendR" || key === "standardTrendR" || key === "soupleTrendR" || key === "dynamicTrendR"
          ? clampInt(nextValue, 5, 500, presetNumbers[k][key])
        : clampInt(nextValue, 1, 5000, presetNumbers[k][key]);

    setPresetNumbers((prev) => {
      const next: PoolWindowPresetNumbers = {
        ...prev,
        [k]: { ...prev[k], [key]: sanitized },
      };
      persistPresetNumbers(next);
      return next;
    });

    // Si le preset modifié est celui actuellement sélectionné, on met aussi à jour la fenêtre active.
    const selected = poolWindowPresets[k];
    const editedPreset: WindowPreset =
      key === "strictDraws"
        ? "strict"
        : key === "standardDraws"
          ? "standard"
          : key === "soupleDraws"
            ? "souple"
            : key === "dynamicDraws"
              ? "dynamic"
              : key === "strictTrendR"
                ? "strict"
                : key === "standardTrendR"
                  ? "standard"
                  : key === "soupleTrendR"
                    ? "souple"
                    : key === "dynamicTrendR"
                      ? "dynamic"
                      : "custom";
    if (selected === editedPreset) {
      // IMPORTANT: presetNumbers (state) n'est pas encore à jour ici -> on calcule avec la valeur saisie.
      const nextNums: Record<PresetNumberKey, number> = { ...presetNumbers[k], [key]: sanitized };
      const windowComputed = presetToWindowFromNumbers(k, nextNums, selected);
      setPoolWindows((prev) => ({ ...prev, [k]: windowComputed }));
    }

    toast.success("Preset mis à jour.");
  };

  const EditablePresetNumber = ({
    pool,
    presetKey,
    value,
  }: {
    pool: PoolKey;
    presetKey: PresetNumberKey;
    value: number;
  }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value));

    useEffect(() => {
      if (!editing) setDraft(String(value));
    }, [value, editing]);

    const doCommit = () => {
      const n = Number(draft);
      commitPresetNumber(pool, presetKey, Number.isFinite(n) ? n : value);
      setEditing(false);
    };

    if (!editing) {
      return (
        <button
          type="button"
          className="px-1.5 py-0.5 rounded bg-zinc-800/70 text-white font-bold hover:bg-zinc-700 transition-colors"
          onClick={() => {
            setEditing(true);
          }}
          aria-label="Modifier la valeur"
        >
          {value}
        </button>
      );
    }

    return (
      <span className="inline-flex items-center gap-2">
        <input
          className="bg-black/40 border border-zinc-700 rounded-md px-2 py-1 text-white w-20 text-right"
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              doCommit();
            }
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(String(value));
            }
          }}
        />
        <button
          type="button"
          className="px-2 py-1 rounded-md bg-green-700 text-white text-sm font-bold hover:bg-green-600 transition-colors"
          onClick={() => {
            doCommit();
          }}
        >
          Valider
        </button>
      </span>
    );
  };

  return (
    <CasinoLayout>
      <div className="max-w-3xl mx-auto p-6">
        {mode !== "pools" && (
          <>
            {/* TABLEAU 1: Fenêtre de calcul */}
            <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-zinc-700 rounded-lg p-6">
              <div className="mt-6 space-y-4">
                <div className="border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-orbitron text-lg text-casino-gold tracking-widest">Fenêtre de calcul</h2>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md bg-zinc-800 text-white text-sm font-bold border border-zinc-700 hover:bg-zinc-700 transition-colors"
                      onClick={() => {
                        const dynamicDefaults: PoolWindowsConfig = {
                          high: presetToWindow("high", "dynamic"),
                          surrepr: presetToWindow("surrepr", "dynamic"),
                          trend: presetToWindow("trend", "dynamic"),
                          dormeur: presetToWindow("dormeur", "dynamic"),
                        };
                        setPoolWindows(dynamicDefaults);
                        setPoolWindowPresets({
                          high: "dynamic",
                          surrepr: "dynamic",
                          trend: "dynamic",
                          dormeur: "dynamic",
                        });
                        toast.success("Fenêtres remises sur Dynamics.");
                      }}
                      aria-label="Reset fenêtres de calcul"
                    >
                      Reset
                    </button>
                  </div>
                  <p className="text-zinc-400 mt-2 text-sm">
                    Chaque pool peut avoir sa propre fenêtre de calcul: High (fréquences), Surreprésentation, Tendance, Dormeur (retards).
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-4">
                    {(["high", "surrepr", "trend", "dormeur"] as const).map((k) => {
                      const title =
                        k === "high"
                          ? "High (Fréquences)"
                          : k === "surrepr"
                            ? "Surreprésentation (z-score)"
                            : k === "trend"
                              ? "Tendance"
                              : "Dormeur";
                      const p = poolWindowPresets[k];
                      const cfg = poolWindows[k];
                      const nums = presetNumbers[k];
                      return (
                        <div key={`pool-window-${k}`} className="border border-zinc-800 rounded-lg p-4">
                          <div className="text-white font-rajdhani text-lg">{title}</div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {(k === "high"
                              ? [
                                  { id: "strict", presetKey: "strictDraws" as const },
                                  { id: "standard", presetKey: "standardDraws" as const },
                                  { id: "souple", presetKey: "soupleDraws" as const },
                                  { id: "dynamic", presetKey: "dynamicDraws" as const },
                                  { id: "all", presetKey: null },
                                  { id: "custom", presetKey: null },
                                ]
                              : k === "surrepr"
                                ? [
                                    { id: "strict", presetKey: "strictDraws" as const },
                                    { id: "standard", presetKey: "standardDraws" as const },
                                    { id: "souple", presetKey: "soupleDraws" as const },
                                    { id: "dynamic", presetKey: "dynamicDraws" as const },
                                    { id: "all", presetKey: null },
                                    { id: "custom", presetKey: null },
                                  ]
                              : k === "trend"
                                ? [
                                    { id: "strict", presetKey: "strictDraws" as const },
                                    { id: "standard", presetKey: "standardDraws" as const },
                                    { id: "souple", presetKey: "soupleDraws" as const },
                                    { id: "dynamic", presetKey: "dynamicDraws" as const },
                                    { id: "all", presetKey: null },
                                    { id: "custom", presetKey: null },
                                  ]
                              : k === "dormeur"
                                ? [
                                    { id: "strict", presetKey: "strictDraws" as const },
                                    { id: "standard", presetKey: "standardDraws" as const },
                                    { id: "souple", presetKey: "soupleDraws" as const },
                                    { id: "dynamic", presetKey: "dynamicDraws" as const },
                                    { id: "all", presetKey: null },
                                    { id: "custom", presetKey: null },
                                  ]
                                : [
                                    { id: "years3", label: "yearsShort" as const },
                                    { id: "years10", label: "yearsLong" as const },
                                    { id: "all", label: "Complet (2004 → aujourd'hui)" },
                                    { id: "custom", label: "Autre / Custom" },
                                  ]
                            ).map((opt: any) => (
                              <label
                                key={`${k}-${opt.id}`}
                                className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:border-zinc-600 cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  checked={p === (opt.id as WindowPreset)}
                                  onChange={() => {
                                    const nextPreset = opt.id as WindowPreset;
                                    setPoolWindowPresets((prev) => ({ ...prev, [k]: nextPreset }));
                                    if (nextPreset !== "custom") {
                                      const nextCfg = presetToWindow(k, nextPreset);
                                      setPoolWindows((prev) => ({
                                        ...prev,
                                        [k]: nextCfg,
                                      }));
                                    } else {
                                      if (cfg.type !== "custom") {
                                        setPoolWindows((prev) => ({
                                          ...prev,
                                          [k]: k === "trend"
                                            ? { type: "custom" as const, customUnit: "draws" as const, customValue: 140, trendPeriodR: (prev.trend as TrendWindowConfig).trendPeriodR ?? 65 }
                                            : { type: "custom" as const, customUnit: "draws" as const, customValue: 50 },
                                        }));
                                      }
                                    }
                                  }}
                                />
                                <div className="text-zinc-300 text-sm">
                                  {(k === "high" || k === "surrepr") && opt.id === "strict" && (
                                    <>
                                      <span className="font-bold">Strict</span>{" "}
                                      <EditablePresetNumber pool={k} presetKey="strictDraws" value={nums.strictDraws} /> tirages{" "}
                                      {approxTimeFromDraws(nums.strictDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.strictDraws)})</span> : null}
                                    </>
                                  )}
                                  {(k === "high" || k === "surrepr") && opt.id === "standard" && (
                                    <>
                                      <span className="font-bold">Standard</span>{" "}
                                      <EditablePresetNumber pool={k} presetKey="standardDraws" value={nums.standardDraws} /> tirages{" "}
                                      {approxTimeFromDraws(nums.standardDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.standardDraws)})</span> : null}
                                    </>
                                  )}
                                  {(k === "high" || k === "surrepr") && opt.id === "souple" && (
                                    <>
                                      <span className="font-bold">Souple</span>{" "}
                                      <EditablePresetNumber pool={k} presetKey="soupleDraws" value={nums.soupleDraws} /> tirages{" "}
                                      {approxTimeFromDraws(nums.soupleDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.soupleDraws)})</span> : null}
                                    </>
                                  )}
                                  {(k === "high" || k === "surrepr") && opt.id === "dynamic" && (
                                    <>
                                      <span className="font-bold">Dynamique</span>{" "}
                                      <span className="font-bold">{nums.dynamicDraws}</span> tirages{" "}
                                      {approxTimeFromDraws(nums.dynamicDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.dynamicDraws)})</span> : null}
                                    </>
                                  )}
                                  {k === "trend" && opt.id === "strict" && (
                                    <>
                                      <span className="font-bold">Strict</span>{" "}
                                      W=<EditablePresetNumber pool={k} presetKey="strictDraws" value={nums.strictDraws} /> tirages{" "}
                                      {approxTimeFromDraws(nums.strictDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.strictDraws)})</span> : null}
                                      {" "}—{" "}
                                      R=<EditablePresetNumber pool={k} presetKey="strictTrendR" value={nums.strictTrendR} /> tirages{" "}
                                      {approxTimeFromDraws(nums.strictTrendR) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.strictTrendR)})</span> : null}
                                    </>
                                  )}
                                  {k === "trend" && opt.id === "standard" && (
                                    <>
                                      <span className="font-bold">Standard</span>{" "}
                                      W=<EditablePresetNumber pool={k} presetKey="standardDraws" value={nums.standardDraws} /> tirages{" "}
                                      {approxTimeFromDraws(nums.standardDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.standardDraws)})</span> : null}
                                      {" "}—{" "}
                                      R=<EditablePresetNumber pool={k} presetKey="standardTrendR" value={nums.standardTrendR} /> tirages{" "}
                                      {approxTimeFromDraws(nums.standardTrendR) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.standardTrendR)})</span> : null}
                                    </>
                                  )}
                                  {k === "trend" && opt.id === "souple" && (
                                    <>
                                      <span className="font-bold">Souple</span>{" "}
                                      W=<EditablePresetNumber pool={k} presetKey="soupleDraws" value={nums.soupleDraws} /> tirages{" "}
                                      {approxTimeFromDraws(nums.soupleDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.soupleDraws)})</span> : null}
                                      {" "}—{" "}
                                      R=<EditablePresetNumber pool={k} presetKey="soupleTrendR" value={nums.soupleTrendR} /> tirages{" "}
                                      {approxTimeFromDraws(nums.soupleTrendR) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.soupleTrendR)})</span> : null}
                                    </>
                                  )}
                                  {k === "trend" && opt.id === "dynamic" && (
                                    <>
                                      <span className="font-bold">Dynamique</span>{" "}
                                      W=<span className="font-bold">{nums.dynamicDraws}</span> tirages{" "}
                                      {approxTimeFromDraws(nums.dynamicDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.dynamicDraws)})</span> : null}
                                      {" "}—{" "}
                                      R=<span className="font-bold">{nums.dynamicTrendR}</span> tirages{" "}
                                      {approxTimeFromDraws(nums.dynamicTrendR) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.dynamicTrendR)})</span> : null}
                                    </>
                                  )}
                                  {k === "dormeur" && opt.id === "strict" && (
                                    <>
                                      <span className="font-bold">Strict</span>{" "}
                                      <EditablePresetNumber pool={k} presetKey="strictDraws" value={nums.strictDraws} /> tirages{" "}
                                      {approxTimeFromDraws(nums.strictDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.strictDraws)})</span> : null}
                                    </>
                                  )}
                                  {k === "dormeur" && opt.id === "standard" && (
                                    <>
                                      <span className="font-bold">Standard</span>{" "}
                                      <EditablePresetNumber pool={k} presetKey="standardDraws" value={nums.standardDraws} /> tirages{" "}
                                      {approxTimeFromDraws(nums.standardDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.standardDraws)})</span> : null}
                                    </>
                                  )}
                                  {k === "dormeur" && opt.id === "souple" && (
                                    <>
                                      <span className="font-bold">Souple</span>{" "}
                                      <EditablePresetNumber pool={k} presetKey="soupleDraws" value={nums.soupleDraws} /> tirages{" "}
                                      {approxTimeFromDraws(nums.soupleDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.soupleDraws)})</span> : null}
                                    </>
                                  )}
                                  {k === "dormeur" && opt.id === "dynamic" && (
                                    <>
                                      <span className="font-bold">Dynamique</span>{" "}
                                      <span className="font-bold">{nums.dynamicDraws}</span> tirages{" "}
                                      {approxTimeFromDraws(nums.dynamicDraws) ? <span className="text-zinc-500">({approxTimeFromDraws(nums.dynamicDraws)})</span> : null}
                                    </>
                                  )}
                                  {opt.id === "years3" && (
                                    <>
                                      <EditablePresetNumber pool={k} presetKey="yearsShort" value={nums.yearsShort} /> ans
                                    </>
                                  )}
                                  {opt.id === "years10" && (
                                    <>
                                      <EditablePresetNumber pool={k} presetKey="yearsLong" value={nums.yearsLong} /> ans
                                    </>
                                  )}
                                  {opt.id === "all" && <>Complet (2004 → aujourd'hui)</>}
                                  {opt.id === "custom" && <>Autre / Custom</>}
                                </div>
                              </label>
                            ))}
                          </div>

                          {p === "custom" && (
                            <div className="mt-3 flex flex-col md:flex-row gap-3 items-start md:items-end">
                              <div className="flex flex-col gap-1">
                                <label className="text-zinc-300 text-sm">{k === "trend" ? "Fenêtre W (tirages)" : "Valeur"}</label>
                                <input
                                  className="bg-black/40 border border-zinc-700 rounded-md px-3 py-2 text-white w-40"
                                  type="number"
                                  min={1}
                                  value={cfg.type === "custom" ? cfg.customValue ?? 1 : 1}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value) || 1;
                                    setPoolWindows((prev) => ({
                                      ...prev,
                                      [k]: {
                                        ...prev[k],
                                        type: "custom",
                                        customUnit: (cfg.type === "custom" ? cfg.customUnit : "draws") ?? "draws",
                                        customValue: v,
                                      },
                                    }));
                                  }}
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-zinc-300 text-sm">Unité</label>
                                <select
                                  className="bg-black/40 border border-zinc-700 rounded-md px-3 py-2 text-white w-52"
                                  value={cfg.type === "custom" ? cfg.customUnit ?? "draws" : "draws"}
                                  onChange={(e) => {
                                    setPoolWindows((prev) => ({
                                      ...prev,
                                      [k]: {
                                        ...prev[k],
                                        type: "custom",
                                        customUnit: e.target.value as PeriodUnit,
                                        customValue: (cfg.type === "custom" ? cfg.customValue : 50) ?? 50,
                                      },
                                    }));
                                  }}
                                >
                                  <option value="draws">tirages</option>
                                  {k !== "trend" && k !== "dormeur" && <option value="weeks">semaines</option>}
                                  {k !== "trend" && k !== "dormeur" && <option value="months">mois</option>}
                                  {k !== "trend" && k !== "dormeur" && <option value="years">années</option>}
                                </select>
                              </div>
                            </div>
                          )}

                          {k === "trend" && p === "custom" && (
                            <div className="mt-3 pt-3 border-t border-zinc-800">
                              <label className="text-zinc-300 text-sm block mb-2">Période récente R (tirages)</label>
                              <input
                                className="bg-black/40 border border-zinc-700 rounded-md px-3 py-2 text-white w-40"
                                type="number"
                                min={15}
                                max={500}
                                value={(cfg as TrendWindowConfig).trendPeriodR ?? 65}
                                onChange={(e) => {
                                  const v = clampInt(parseInt(e.target.value, 10), 15, 500, 65);
                                  setPoolWindows((prev) => ({
                                    ...prev,
                                    trend: { ...prev.trend, trendPeriodR: v },
                                  }));
                                }}
                              />
                              <p className="text-zinc-500 text-xs mt-1">
                                Nombre de tout derniers tirages comparés à la fenêtre W pour calculer haussier / stable / baissier.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </CasinoLayout>
  );
}

export default function Settings() {
  return <SettingsPage mode="all" />;
}

