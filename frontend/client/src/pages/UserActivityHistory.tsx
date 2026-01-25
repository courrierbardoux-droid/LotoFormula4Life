import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { Link } from "wouter";
import { useUser } from "@/lib/UserContext";

type ActivityPayload = {
  gridId?: number | null;
  numbers?: number[];
  stars?: number[];
  targetDate?: string | null;
  channel?: "email" | "direct";
  [k: string]: unknown;
};

type ActivityEvent = {
  id: number;
  type: string;
  createdAt: string;
  userId: number;
  username: string;
  payload: ActivityPayload;
};

function formatTime(ts: string) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtNumbers(nums?: number[]) {
  if (!nums || nums.length === 0) return "—";
  return nums.join(" ");
}

export default function UserActivityHistory() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const { user } = useUser();
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [sseKey, setSseKey] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const header = useMemo(
    () => ({
      title: "HISTORIQUE DES UTILISATEURS",
      subtitle: "Journal des 200 dernières grilles enregistrées (temps réel)",
    }),
    []
  );

  const load = useCallback(async (reason: "mount" | "manual") => {
    try {
      const res = await fetch("/api/admin/activity?limit=200", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) {
          setAuthHint("Accès admin requis (ta session a probablement été remplacée par une connexion non-admin dans le même navigateur).");
        }
        throw new Error(String(res.status));
      }
      const data = (await res.json()) as ActivityEvent[];
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      setEvents([]);
    }
  }, [user]);

  useEffect(() => {
    load("mount");
  }, [load]);

  useEffect(() => {
    setStatus("connecting");
    // Assure qu'on n'a qu'UNE connexion SSE active.
    if (esRef.current) {
      try {
        esRef.current.close();
      } catch {
        // ignore
      }
      esRef.current = null;
    }

    const es = new EventSource("/api/admin/activity/stream");
    esRef.current = es;

    const onActivity = (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as ActivityEvent;
        if (!ev || typeof ev !== "object") return;
        setEvents((prev) => {
          const rawId = (ev as any)?.id;
          const id = Number(rawId);
          // Évite les doublons (peut arriver en dev si 2 SSE sont ouvertes)
          if (Number.isFinite(id) && prev.some((x) => Number((x as any)?.id) === id)) {
            return prev;
          }
          const next = [ev, ...prev];
          return next.slice(0, 200);
        });
      } catch {
        // ignore
      }
    };

    const onOpen = () => setStatus("live");

    es.addEventListener("activity", onActivity as any);
    es.addEventListener("open", onOpen as any);
    es.addEventListener("error", (async (evt: any) => {
      // SSE peut émettre "error" pendant une reconnexion automatique.
      // On n'affiche "Flux interrompu" QUE si le flux est réellement CLOSED.
      const readyState = Number((es as any).readyState ?? -1);
      const nextStatus: "connecting" | "error" = readyState === 2 ? "error" : "connecting";
      setStatus(nextStatus);

      // Tentative de diagnostic simple: vérifier si on est toujours admin
      try {
        const me = await fetch("/api/auth/me", { credentials: "include" });
        const meJson = await me.json().catch(() => ({}));
        const role = (meJson as any)?.user?.role ?? null;
        if (role && role !== "admin") {
          setAuthHint(`Tu n'es plus connecté en admin (session actuelle: ${role}). Ouvre l'abonné/VIP/invité dans une fenêtre privée séparée.`);
        }
      } catch {
        // ignore
      }
    }) as any);

    es.addEventListener("open", (() => {
      // NOTE: on garde aussi le setStatus via onOpen ci-dessus
    }) as any);

    return () => {
      try {
        es.close();
      } catch {
        // ignore
      }
      if (esRef.current === es) esRef.current = null;
    };
  }, [user, sseKey]);

  return (
    <CasinoLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="text-center my-10">
          <h1 className="text-3xl md:text-4xl font-orbitron font-black text-white tracking-widest mb-2">{header.title}</h1>
          <div className="text-zinc-400 font-rajdhani text-lg">{header.subtitle}</div>
          <div className="mt-2 text-sm font-bold">
            {status === "live" && <span className="text-green-400">● Live</span>}
            {status === "connecting" && <span className="text-amber-400">● Connexion…</span>}
            {status === "error" && <span className="text-red-400">● Flux interrompu (refresh si besoin)</span>}
          </div>
          {authHint && <div className="mt-2 text-sm text-amber-300 font-bold">{authHint}</div>}
        </div>

        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-zinc-700 rounded-lg p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="font-orbitron text-casino-gold tracking-widest text-sm">DERNIÈRES ACTIVITÉS</div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-3 py-2 rounded-md bg-zinc-800 text-zinc-200 text-sm font-bold hover:bg-zinc-700 transition-colors"
                onClick={() => {
                  setAuthHint(null);
                  setSseKey((x) => x + 1);
                }}
              >
                RECONNECTER LE LIVE
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-md bg-zinc-800 text-zinc-200 text-sm font-bold hover:bg-zinc-700 transition-colors"
                onClick={() => {
                  load("manual");
                }}
              >
                RAFRAÎCHIR
              </button>
              <div className="text-zinc-500 text-sm">{events.length} / 200</div>
            </div>
          </div>

          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-2 bg-black/60 text-zinc-400 text-xs md:text-sm font-orbitron uppercase tracking-wider border-b border-zinc-800 px-3 py-2">
              <div className="col-span-2">Heure</div>
              <div className="col-span-3">Identifiant</div>
              <div className="col-span-5">Numéros / Étoiles</div>
              <div className="col-span-2 text-right">Canal</div>
            </div>

            <div className="divide-y divide-zinc-900">
              {events.map((ev) => {
                const nums = ev.payload?.numbers ?? [];
                const stars = ev.payload?.stars ?? [];
                const channelLabel = ev.payload?.channel === "email" ? "avec email" : "sans email";
                const gridId = (ev.payload as any)?.gridId ?? null;
                return (
                  <div key={ev.id ?? `${ev.createdAt}-${ev.userId}`} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm md:text-base font-rajdhani bg-black/30 hover:bg-black/40 transition-colors">
                    <div className="col-span-2 text-zinc-300 font-mono">{formatTime(ev.createdAt)}</div>
                    <div className="col-span-3">
                      <Link href={`/user/${ev.userId}`}>
                        <a className="text-casino-gold hover:underline font-bold">{ev.username}</a>
                      </Link>
                      <div className="text-[11px] text-zinc-500 font-mono leading-tight">
                        #{ev.id}
                        {gridId != null ? ` · g:${gridId}` : ""}
                      </div>
                    </div>
                    <div className="col-span-5 text-zinc-200">
                      <span className="text-zinc-400 mr-2">N:</span>
                      <span className="font-bold">{fmtNumbers(nums)}</span>
                      <span className="text-zinc-500 mx-2">|</span>
                      <span className="text-zinc-400 mr-2">E:</span>
                      <span className="font-bold">{fmtNumbers(stars)}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={ev.payload?.channel === "email" ? "text-blue-300" : "text-zinc-300"}>{channelLabel}</span>
                    </div>
                  </div>
                );
              })}

              {events.length === 0 && (
                <div className="p-6 text-center text-zinc-500">
                  Aucune activité pour le moment.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CasinoLayout>
  );
}

