import React, { useEffect, useState } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { toast } from "sonner";
import type { FrequencyConfig, PeriodUnit, TrendWindowConfig } from "@/lib/lotoService";
import { motion } from "framer-motion";

const LS_FREQ_CONFIG_KEY = "loto_freqConfig_v1";
const EVENT_FREQ_CONFIG_CHANGED = "loto:freqConfigChanged";
const LS_POOL_SIZES_KEY = "loto_poolSizes_v1";
const EVENT_POOL_SIZES_CHANGED = "loto:poolSizesChanged";
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

export type SettingsMode = "all" | "pools" | "windows";

export function SettingsPage({ mode = "all" }: { mode?: SettingsMode }) {
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
  type SaveStatus = "saved" | "dirty";
  type SavePulseSource = "apply" | "preset" | "change";

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
    const existing = safeParsePresetNumbers(localStorage.getItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY));
    return existing ?? defaultPresetNumbers;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => {
      const existing = safeParsePresetNumbers(localStorage.getItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY));
      if (existing) {
        setPresetNumbers(existing);
      }
    };
    window.addEventListener(EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED, handler as EventListener);
    return () => window.removeEventListener(EVENT_POOL_WINDOW_PRESET_NUMBERS_CHANGED, handler as EventListener);
  }, []);

  // Save status is now for "Taille des pools" only (Tableau 2).
  // "Fenêtre de calcul" (Tableau 1) is auto-applied on change.
  const [poolSizesSaveStatus, setPoolSizesSaveStatus] = useState<SaveStatus>("saved");
  const [poolSizesSavePulseId, setPoolSizesSavePulseId] = useState(0);
  const [poolSizesSavePulseSource, setPoolSizesSavePulseSource] = useState<SavePulseSource>("apply");

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
    const existing = safeParsePoolWindows(localStorage.getItem(LS_POOL_WINDOWS_KEY));
    if (existing) return existing;
    // Compat: si l'ancien réglage unique existe, on l'utilise comme fenêtre High
    const old = safeParseFreqConfig(localStorage.getItem(LS_FREQ_CONFIG_KEY));
    const high = old ?? defaultPoolWindows.high;
    return { ...defaultPoolWindows, high, surrepr: high };
  });

  // AUTO-APPLY (Tableau 1): on persiste et on notifie dès que la fenêtre change.
  useEffect(() => {
    localStorage.setItem(LS_POOL_WINDOWS_KEY, JSON.stringify(poolWindows));
    window.dispatchEvent(new Event(EVENT_POOL_WINDOWS_CHANGED));
  }, [poolWindows]);

  const [poolWindowPresets, setPoolWindowPresets] = useState<Record<PoolKey, WindowPreset>>(() => ({
    high: windowToPreset("high", poolWindows.high),
    surrepr: windowToPreset("surrepr", poolWindows.surrepr),
    trend: windowToPreset("trend", poolWindows.trend),
    dormeur: windowToPreset("dormeur", poolWindows.dormeur),
  }));

  useEffect(() => {
  }, [poolWindowPresets.surrepr, presetNumbers.surrepr?.dynamicDraws, presetNumbers.surrepr?.standardDraws]);

  type PoolSizeConfig = {
    balls: { high: number; trend: number; dormeur: number };
    stars: { high: number; trend: number; dormeur: number };
  };

  const defaultPoolSizes: PoolSizeConfig = {
    balls: { high: 25, trend: 25, dormeur: 25 },
    stars: { high: 8, trend: 8, dormeur: 8 },
  };

  const [poolSizes, setPoolSizes] = useState<PoolSizeConfig>(() => {
    try {
      const raw = localStorage.getItem(LS_POOL_SIZES_KEY);
      if (!raw) return defaultPoolSizes;
      const parsed = JSON.parse(raw) as Partial<PoolSizeConfig>;
      const safe = {
        balls: {
          high: Math.min(50, Math.max(10, Number(parsed?.balls?.high ?? defaultPoolSizes.balls.high))),
          trend: Math.min(50, Math.max(10, Number(parsed?.balls?.trend ?? defaultPoolSizes.balls.trend))),
          dormeur: Math.min(50, Math.max(10, Number(parsed?.balls?.dormeur ?? defaultPoolSizes.balls.dormeur))),
        },
        stars: {
          high: Math.min(12, Math.max(4, Number(parsed?.stars?.high ?? defaultPoolSizes.stars.high))),
          trend: Math.min(12, Math.max(4, Number(parsed?.stars?.trend ?? defaultPoolSizes.stars.trend))),
          dormeur: Math.min(12, Math.max(4, Number(parsed?.stars?.dormeur ?? defaultPoolSizes.stars.dormeur))),
        },
      };
      return safe;
    } catch {
      return defaultPoolSizes;
    }
  });

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
    localStorage.setItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY, JSON.stringify(next));
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

  const apply = () => {
    localStorage.setItem(LS_POOL_SIZES_KEY, JSON.stringify(poolSizes));
    window.dispatchEvent(new Event(EVENT_POOL_SIZES_CHANGED));

    toast.success("Taille des pools enregistrée.");
    setPoolSizesSaveStatus("saved");
    setPoolSizesSavePulseSource("apply");
    setPoolSizesSavePulseId((x) => x + 1);
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
                  <h2 className="font-orbitron text-lg text-casino-gold tracking-widest">Fenêtre de calcul</h2>
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

        {mode !== "windows" && (
          <>
            {/* TABLEAU 2: Taille des pools (séparé physiquement) */}
            <div className={["bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-zinc-700 rounded-lg p-6", mode === "all" ? "mt-4" : ""].join(" ")}>
              <div className="mt-6 space-y-4">
                <div className="border border-zinc-800 rounded-lg p-4">
                  <h2 className="font-orbitron text-lg text-casino-gold tracking-widest">Taille des pools</h2>
                  <p className="text-zinc-400 mt-2 text-sm">
                    Ici tu définis combien d'éléments (Top N) sont pris dans chaque pool, du plus “top” vers le moins “top”.
                  </p>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-zinc-800 rounded-lg p-3">
                      <div className="text-white font-rajdhani text-lg mb-2">Boules (1–50)</div>
                      {(["high", "trend", "dormeur"] as const).map((k) => (
                        <div key={`balls-${k}`} className="flex items-center justify-between gap-3 py-2">
                          <div className="text-zinc-300 text-sm">{k === "high" ? "High" : k === "trend" ? "Tendance" : "Dormeur"}</div>
                          <input
                            className="bg-black/40 border border-zinc-700 rounded-md px-3 py-2 text-white w-28 text-right"
                            type="number"
                            min={10}
                            max={50}
                            value={poolSizes.balls[k]}
                            onChange={(e) => {
                              const v = Math.min(50, Math.max(10, parseInt(e.target.value) || 10));
                              setPoolSizes((prev) => ({ ...prev, balls: { ...prev.balls, [k]: v } }));
                              setPoolSizesSaveStatus("dirty");
                              setPoolSizesSavePulseSource("change");
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="border border-zinc-800 rounded-lg p-3">
                      <div className="text-white font-rajdhani text-lg mb-2">Étoiles (1–12)</div>
                      {(["high", "trend", "dormeur"] as const).map((k) => (
                        <div key={`stars-${k}`} className="flex items-center justify-between gap-3 py-2">
                          <div className="text-zinc-300 text-sm">{k === "high" ? "High" : k === "trend" ? "Tendance" : "Dormeur"}</div>
                          <input
                            className="bg-black/40 border border-zinc-700 rounded-md px-3 py-2 text-white w-28 text-right"
                            type="number"
                            min={4}
                            max={12}
                            value={poolSizes.stars[k]}
                            onChange={(e) => {
                              const v = Math.min(12, Math.max(4, parseInt(e.target.value) || 4));
                              setPoolSizes((prev) => ({ ...prev, stars: { ...prev.stars, [k]: v } }));
                              setPoolSizesSaveStatus("dirty");
                              setPoolSizesSavePulseSource("change");
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="px-3 py-2 rounded-md bg-zinc-800 text-zinc-200 text-sm font-bold hover:bg-zinc-700 transition-colors"
                      onClick={() => {
                        setPoolSizes(defaultPoolSizes);
                        setPoolSizesSaveStatus("dirty");
                        setPoolSizesSavePulseSource("change");
                      }}
                    >
                      RESET (25/8)
                    </button>
                    <button
                      className="px-3 py-2 rounded-md bg-zinc-800 text-zinc-200 text-sm font-bold hover:bg-zinc-700 transition-colors"
                      onClick={() => {
                        setPoolSizes({
                          balls: { high: 50, trend: 50, dormeur: 50 },
                          stars: { high: 12, trend: 12, dormeur: 12 },
                        });
                        setPoolSizesSaveStatus("dirty");
                        setPoolSizesSavePulseSource("change");
                      }}
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border border-zinc-800 rounded-lg p-4">
                  <div className="text-zinc-300">
                    <div className="font-rajdhani text-lg">Fenêtres actives</div>
                    <div className="text-zinc-400 text-sm space-y-1 mt-1">
                      <div>High: {describeWindow(poolWindows.high)}</div>
                      <div>Surreprésentation: {describeWindow(poolWindows.surrepr)}</div>
                      <div>Tendance: {describeWindow(poolWindows.trend)}</div>
                      <div>Dormeur: {describeWindow(poolWindows.dormeur)}</div>
                    </div>
                    <div className="mt-2 text-sm font-bold">
                      {poolSizesSaveStatus === "saved" ? (
                        <motion.span
                          key={`saved-${poolSizesSavePulseId}-${poolSizesSavePulseSource}`}
                          className="text-green-400 inline-flex items-center gap-2"
                          initial={{ scale: 1, opacity: 0.85 }}
                          animate={{
                            opacity: [0.85, 1, 1],
                            scale: poolSizesSavePulseSource === "apply" || poolSizesSavePulseSource === "preset" ? [1, 1.08, 1] : 1,
                          }}
                          transition={{ duration: 0.35 }}
                        >
                          ✔ Enregistré
                        </motion.span>
                      ) : (
                        <span className="text-amber-400">● Modifications non enregistrées</span>
                      )}
                    </div>
                  </div>
                  <button
                    className={[
                      "px-5 py-2 rounded-md text-white font-orbitron tracking-widest transition-colors active:scale-[0.98]",
                      poolSizesSaveStatus === "saved"
                        ? "bg-green-700 hover:bg-green-600"
                        : "bg-green-600 hover:bg-green-500 ring-2 ring-amber-400/60",
                    ].join(" ")}
                    onClick={apply}
                  >
                    <motion.span
                      key={`btn-${poolSizesSavePulseId}-${poolSizesSaveStatus}`}
                      className="inline-block"
                      initial={{ scale: 1 }}
                      animate={poolSizesSaveStatus === "saved" ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      {poolSizesSaveStatus === "saved" ? "ENREGISTRÉ" : "ENREGISTRER"}
                    </motion.span>
                  </button>
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

