import React, { useEffect, useState } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { toast } from "sonner";
import type { FrequencyConfig, PeriodUnit } from "@/lib/lotoService";
import { motion } from "framer-motion";

const LS_FREQ_CONFIG_KEY = "loto_freqConfig_v1";
const EVENT_FREQ_CONFIG_CHANGED = "loto:freqConfigChanged";
const LS_POOL_SIZES_KEY = "loto_poolSizes_v1";
const EVENT_POOL_SIZES_CHANGED = "loto:poolSizesChanged";
const LS_POOL_WINDOWS_KEY = "loto_poolWindows_v1";
const EVENT_POOL_WINDOWS_CHANGED = "loto:poolWindowsChanged";
const LS_POOL_WINDOW_PRESET_NUMBERS_KEY = "loto_poolWindowPresetNumbers_v1";

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
  type PoolKey = "high" | "trend" | "dormeur";
  type PoolWindowsConfig = Record<PoolKey, FrequencyConfig>;
  type WindowPreset = "recent25" | "general70" | "years3" | "years10" | "all" | "custom";
  type PresetNumberKey = "recentDraws" | "generalDraws" | "yearsShort" | "yearsLong";
  type PoolWindowPresetNumbers = Record<PoolKey, Record<PresetNumberKey, number>>;
  type SaveStatus = "saved" | "dirty";
  type SavePulseSource = "apply" | "preset" | "change";

  const describeWindow = (cfg: FrequencyConfig) => {
    if (cfg.type === "all") return "Complet (2004 → aujourd'hui)";
    if (cfg.type === "custom") return `${cfg.customValue} ${cfg.customUnit}`;
    return cfg.type;
  };

  const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(n)));
  };

  const defaultPresetNumbers: PoolWindowPresetNumbers = {
    high: { recentDraws: 25, generalDraws: 70, yearsShort: 3, yearsLong: 10 },
    trend: { recentDraws: 25, generalDraws: 70, yearsShort: 3, yearsLong: 10 },
    dormeur: { recentDraws: 25, generalDraws: 70, yearsShort: 3, yearsLong: 10 },
  };

  const safeParsePresetNumbers = (raw: string | null): PoolWindowPresetNumbers | null => {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw) as Partial<PoolWindowPresetNumbers>;
      const keys: PoolKey[] = ["high", "trend", "dormeur"];
      const out: PoolWindowPresetNumbers = { ...defaultPresetNumbers };
      for (const k of keys) {
        const v = obj?.[k] as Partial<Record<PresetNumberKey, unknown>> | undefined;
        out[k] = {
          recentDraws: clampInt(v?.recentDraws, 1, 5000, defaultPresetNumbers[k].recentDraws),
          generalDraws: clampInt(v?.generalDraws, 1, 5000, defaultPresetNumbers[k].generalDraws),
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

  // Save status is now for "Taille des pools" only (Tableau 2).
  // "Fenêtre de calcul" (Tableau 1) is auto-applied on change.
  const [poolSizesSaveStatus, setPoolSizesSaveStatus] = useState<SaveStatus>("saved");
  const [poolSizesSavePulseId, setPoolSizesSavePulseId] = useState(0);
  const [poolSizesSavePulseSource, setPoolSizesSavePulseSource] = useState<SavePulseSource>("apply");

  const defaultPoolWindows: PoolWindowsConfig = {
    high: { type: "custom", customUnit: "draws", customValue: 25 },
    trend: { type: "custom", customUnit: "draws", customValue: 70 },
    dormeur: { type: "custom", customUnit: "years", customValue: 3 },
  };

  const presetToWindow = (k: PoolKey, p: WindowPreset): FrequencyConfig => {
    const nums = presetNumbers[k];
    if (p === "recent25") return { type: "custom", customUnit: "draws", customValue: nums.recentDraws };
    if (p === "general70") return { type: "custom", customUnit: "draws", customValue: nums.generalDraws };
    if (p === "years3") return { type: "custom", customUnit: "years", customValue: nums.yearsShort };
    if (p === "years10") return { type: "custom", customUnit: "years", customValue: nums.yearsLong };
    if (p === "all") return { type: "all" };
    return { type: "custom", customUnit: "draws", customValue: 50 };
  };

  const presetToWindowFromNumbers = (nums: Record<PresetNumberKey, number>, p: WindowPreset): FrequencyConfig => {
    if (p === "recent25") return { type: "custom", customUnit: "draws", customValue: nums.recentDraws };
    if (p === "general70") return { type: "custom", customUnit: "draws", customValue: nums.generalDraws };
    if (p === "years3") return { type: "custom", customUnit: "years", customValue: nums.yearsShort };
    if (p === "years10") return { type: "custom", customUnit: "years", customValue: nums.yearsLong };
    if (p === "all") return { type: "all" };
    return { type: "custom", customUnit: "draws", customValue: 50 };
  };

  const windowToPreset = (k: PoolKey, cfg: FrequencyConfig): WindowPreset => {
    const nums = presetNumbers[k];
    if (cfg.type === "all") return "all";
    if (cfg.type === "custom") {
      if (cfg.customUnit === "draws" && cfg.customValue === nums.recentDraws) return "recent25";
      if (cfg.customUnit === "draws" && cfg.customValue === nums.generalDraws) return "general70";
      if (cfg.customUnit === "years" && cfg.customValue === nums.yearsShort) return "years3";
      if (cfg.customUnit === "years" && cfg.customValue === nums.yearsLong) return "years10";
    }
    return "custom";
  };

  const safeParsePoolWindows = (raw: string | null): PoolWindowsConfig | null => {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw) as Partial<PoolWindowsConfig>;
      const keys: PoolKey[] = ["high", "trend", "dormeur"];
      for (const k of keys) {
        const cfg = obj?.[k];
        if (!cfg) return null;
        if (cfg.type !== "all" && cfg.type !== "last_20" && cfg.type !== "last_year" && cfg.type !== "custom") return null;
        if (cfg.type === "custom" && (!cfg.customUnit || !cfg.customValue)) return null;
      }
      return obj as PoolWindowsConfig;
    } catch {
      return null;
    }
  };

  const [poolWindows, setPoolWindows] = useState<PoolWindowsConfig>(() => {
    const existing = safeParsePoolWindows(localStorage.getItem(LS_POOL_WINDOWS_KEY));
    if (existing) return existing;
    // Compat: si l'ancien réglage unique existe, on l'utilise comme fenêtre High
    const old = safeParseFreqConfig(localStorage.getItem(LS_FREQ_CONFIG_KEY));
    return { ...defaultPoolWindows, high: old ?? defaultPoolWindows.high };
  });

  // AUTO-APPLY (Tableau 1): on persiste et on notifie dès que la fenêtre change.
  useEffect(() => {
    // Fenêtre de calcul "legacy" = fenêtre High (fréquences) pour compat avec la Console
    localStorage.setItem(LS_FREQ_CONFIG_KEY, JSON.stringify(poolWindows.high));
    window.dispatchEvent(new Event(EVENT_FREQ_CONFIG_CHANGED));

    localStorage.setItem(LS_POOL_WINDOWS_KEY, JSON.stringify(poolWindows));
    window.dispatchEvent(new Event(EVENT_POOL_WINDOWS_CHANGED));
  }, [poolWindows]);

  const [poolWindowPresets, setPoolWindowPresets] = useState<Record<PoolKey, WindowPreset>>(() => ({
    high: windowToPreset("high", poolWindows.high),
    trend: windowToPreset("trend", poolWindows.trend),
    dormeur: windowToPreset("dormeur", poolWindows.dormeur),
  }));

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
      trend: windowToPreset("trend", poolWindows.trend),
      dormeur: windowToPreset("dormeur", poolWindows.dormeur),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetNumbers]);

  const persistPresetNumbers = (next: PoolWindowPresetNumbers) => {
    localStorage.setItem(LS_POOL_WINDOW_PRESET_NUMBERS_KEY, JSON.stringify(next));
  };

  const commitPresetNumber = (k: PoolKey, key: PresetNumberKey, nextValue: number) => {
    const sanitized =
      key === "yearsShort" || key === "yearsLong"
        ? clampInt(nextValue, 1, 100, presetNumbers[k][key])
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
      key === "recentDraws" ? "recent25" : key === "generalDraws" ? "general70" : key === "yearsShort" ? "years3" : "years10";
    if (selected === editedPreset) {
      // IMPORTANT: presetNumbers (state) n'est pas encore à jour ici -> on calcule avec la valeur saisie.
      const nextNums: Record<PresetNumberKey, number> = { ...presetNumbers[k], [key]: sanitized };
      const windowComputed = presetToWindowFromNumbers(nextNums, selected);
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
                    Chaque pool peut avoir sa propre fenêtre de calcul: High (fréquences), Tendance, Dormeur (retards).
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-4">
                    {(["high", "trend", "dormeur"] as const).map((k) => {
                      const title = k === "high" ? "High (Fréquences)" : k === "trend" ? "Tendance" : "Dormeur";
                      const p = poolWindowPresets[k];
                      const cfg = poolWindows[k];
                      const nums = presetNumbers[k];
                      return (
                        <div key={`pool-window-${k}`} className="border border-zinc-800 rounded-lg p-4">
                          <div className="text-white font-rajdhani text-lg">{title}</div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {(k === "dormeur"
                              ? [
                                  { id: "years3", label: "ansShort" as const },
                                  { id: "years10", label: "ansLong" as const },
                                  { id: "all", label: "Complet (2004 → aujourd'hui)" },
                                  { id: "custom", label: "Autre / Custom" },
                                ]
                              : [
                                  { id: "recent25", label: "recentDraws" as const },
                                  { id: "general70", label: "generalDraws" as const },
                                  { id: "years3", label: "yearsShort" as const },
                                  { id: "years10", label: "yearsLong" as const },
                                  { id: "all", label: "Complet (2004 → aujourd'hui)" },
                                  { id: "custom", label: "Autre / Custom" },
                                ]
                            ).map((opt) => (
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
                                      setPoolWindows((prev) => ({ ...prev, [k]: presetToWindow(k, nextPreset) }));
                                    } else {
                                      // Keep existing cfg as-is (user edits below)
                                      if (cfg.type !== "custom") {
                                        setPoolWindows((prev) => ({ ...prev, [k]: { type: "custom", customUnit: "draws", customValue: 50 } }));
                                      }
                                    }
                                  }}
                                />
                                <div className="text-zinc-300 text-sm">
                                  {opt.id === "recent25" && (
                                    <>
                                      <EditablePresetNumber pool={k} presetKey="recentDraws" value={nums.recentDraws} /> tirages (forme récente)
                                    </>
                                  )}
                                  {opt.id === "general70" && (
                                    <>
                                      <EditablePresetNumber pool={k} presetKey="generalDraws" value={nums.generalDraws} /> tirages (forme générale)
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
                                <label className="text-zinc-300 text-sm">Valeur</label>
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
                                        type: "custom",
                                        customUnit: e.target.value as PeriodUnit,
                                        customValue: (cfg.type === "custom" ? cfg.customValue : 50) ?? 50,
                                      },
                                    }));
                                  }}
                                >
                                  <option value="draws">tirages</option>
                                  <option value="weeks">semaines</option>
                                  <option value="months">mois</option>
                                  <option value="years">années</option>
                                </select>
                              </div>
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

