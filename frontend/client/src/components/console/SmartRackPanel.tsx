import React, { useState, useCallback } from 'react';
import type { NexusState } from '../../lib/lotoService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailScheduleLine {
    id: string;
    heure: string;
    tarif: string;
    tickets: number;
    reglage: number;
    bot: 'forbo' | 'nexus' | 'roue';
    ancre1?: string;
    ancre2?: string;
    ancre3?: string;
}

export interface EmailScheduleState {
    email: string;
    mardi: { day?: string; on: boolean; lignes: EmailScheduleLine[] };
    vendredi: { day?: string; on: boolean; lignes: EmailScheduleLine[] };
}

interface SmartRackPanelProps {
    nexusState: NexusState | null;
    roueCost: number;
    roueModeLabel: string;
    vivierSize: number;
    roueCombosCount: number;
    tarifOptions: string[];
    onEmailSave: (schedule: EmailScheduleState) => void;
    onNexusClick: () => void;
    onRoueClick: () => void;
    nexusLcdMsg?: string | null;    // message LCD (null = aucun)
    nexusGenerating?: boolean;      // true pendant le calcul NEXUS
    nexusTimer?: number;            // décompte 20s
    disabled?: boolean;             // true si aucun tarif sélectionné
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOT_LOGOS: Record<string, string> = {
    forbo: 'F',
    nexus: 'N',
    roue: 'R',
};

const BOT_COLORS: Record<string, string> = {
    forbo: '#f39c12',
    nexus: '#8e44ad',
    roue: '#2980b9',
};

function uid() {
    return Math.random().toString(36).slice(2);
}

function defaultLine(): EmailScheduleLine {
    return { id: uid(), heure: '12:00', tarif: '2.50€', tickets: 1, reglage: 1, bot: 'forbo', ancre1: 'none', ancre2: 'none', ancre3: 'none' };
}

// ─── Compact summary row ──────────────────────────────────────────────────────

function CompactEmailRow({ state }: { state: { day?: string; on: boolean; lignes: EmailScheduleLine[] } }) {
    const jour = state.day ? state.day.substring(0, 3).toUpperCase() : '---';
    const totalTickets = state.lignes.reduce((s, l) => s + l.tickets, 0);
    const bots = Array.from(new Set(state.lignes.map(l => l.bot)));
    const cost = state.lignes.reduce((s, l) => {
        const tariffNum = parseFloat(l.tarif.match(/([\d.]+)\s*€/)?.[1] || "0");
        return s + tariffNum * l.tickets;
    }, 0);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
            <span style={{
                fontSize: 13, fontWeight: 800,
                color: state.on ? '#2ecc71' : '#e74c3c',
                letterSpacing: 0.5,
                width: 32, display: 'inline-block'
            }}>
                {jour}
            </span>
            <span style={{
                fontSize: 12, padding: '1px 5px', borderRadius: 8,
                background: state.on ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)',
                color: state.on ? '#2ecc71' : '#e74c3c',
                fontWeight: 700
            }}>
                {state.on ? 'ON' : 'OFF'}
            </span>
            {state.on && state.lignes.length > 0 && (
                <>
                    <span style={{ color: '#aaa', fontSize: 12 }}>{state.lignes[0].heure}</span>
                    <span style={{ color: '#888', fontSize: 12 }}>×{totalTickets}</span>
                    <span style={{ display: 'flex', gap: 3 }}>
                        {bots.map(b => (
                            <span key={b} style={{
                                width: 16, height: 16, borderRadius: '50%', fontSize: 10, fontWeight: 900,
                                background: BOT_COLORS[b], color: '#fff',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                            }}>{BOT_LOGOS[b]}</span>
                        ))}
                    </span>
                    <span style={{ color: '#f39c12', fontSize: 12, fontWeight: 700 }}>{cost.toFixed(2)}€</span>
                </>
            )}
        </div>
    );
}

// ─── Editor Row ───────────────────────────────────────────────────────────────

function EditorRow({
    line,
    tarifOptions,
    onUpdate,
    onDelete,
}: {
    line: EmailScheduleLine;
    tarifOptions: string[];
    onUpdate: (l: EmailScheduleLine) => void;
    onDelete: () => void;
}) {
    const sel: React.CSSProperties = {
        background: '#3e2723',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#ddd', borderRadius: 6, fontSize: 13, padding: '3px 6px',
        outline: 'none', cursor: 'pointer',
    };

    // Build anchor options
    const ancreOptions = [
        { value: 'none', label: '⚓ Ancre' },
        { value: 'highfreq', label: '[F] High Fréquence' },
        { value: 'rdv', label: '[RDV] Rendez-vous' },
        { value: 'trend', label: '[T] Tendance' },
        ...Array.from({ length: 50 }, (_, i) => ({ value: String(i + 1), label: `N° ${i + 1}` }))
    ];

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'nowrap', marginBottom: 4 }}>
            {/* Heure */}
            <input
                type="time"
                value={line.heure}
                onChange={e => onUpdate({ ...line, heure: e.target.value })}
                style={{ ...sel, width: 73, background: 'rgba(255,255,255,0.07)' }}
            />

            {/* Tarif */}
            <select value={line.tarif} onChange={e => onUpdate({ ...line, tarif: e.target.value })} style={{ ...sel, width: 80, paddingLeft: 2, paddingRight: 2 }}>
                {tarifOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Tickets */}
            <select
                value={line.tickets}
                onChange={e => {
                    const val = parseInt(e.target.value);
                    if (line.bot === 'roue' && val > 21) {
                        alert("Le vivier maximum autorisé avec la Roue est de 7 numéros (soit 21 tickets max).");
                        onUpdate({ ...line, tickets: 21 });
                    } else {
                        onUpdate({ ...line, tickets: val });
                    }
                }}
                style={{ ...sel, width: 45, paddingLeft: 2, paddingRight: 2 }}
            >
                {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} tic</option>
                ))}
            </select>

            {/* Réglage (Dynamique si Roue) */}
            <select
                value={line.reglage}
                onChange={e => {
                    const newReg = parseInt(e.target.value);
                    if (line.bot === 'roue') {
                        let autoTickets = line.tickets;
                        if (newReg === 0) autoTickets = 1;      // vivier 5
                        else if (newReg === 1) autoTickets = 6; // vivier 6
                        else if (newReg >= 2) autoTickets = 21; // vivier 7 et + (bridé à 21 max)

                        // Bloquer visuellement les sélections > 2
                        const finalReg = newReg > 2 ? 2 : newReg;

                        if (newReg > 2) {
                            alert("Le vivier maximum autorisé avec la Roue est de 7 numéros (soit 21 tickets max).");
                        }
                        onUpdate({ ...line, reglage: finalReg, tickets: autoTickets });
                    } else {
                        onUpdate({ ...line, reglage: newReg });
                    }
                }}
                style={{ ...sel, width: 55, paddingLeft: 2, paddingRight: 2, color: line.bot === 'roue' ? '#aed6f1' : '#ddd', fontWeight: line.bot === 'roue' ? 'bold' : 'normal' }}
            >
                {line.bot === 'roue' ? (
                    <>
                        <option value={0} style={{ color: '#fff' }}>5+2</option>
                        <option value={1} style={{ color: '#fff' }}>6+3</option>
                        <option value={2} style={{ color: '#fff' }}>7+4</option>
                    </>
                ) : (
                    Array.from({ length: 7 }, (_, i) => (
                        <option key={i} value={i} style={{ color: '#fff' }}>{i === 0 ? 'Rég.0' : `Rég.${i}`}</option>
                    ))
                )}
            </select>

            {/* Bot (Icônes uniquement vu de l'extérieur) */}
            <select
                value={line.bot}
                onChange={e => onUpdate({ ...line, bot: e.target.value as 'forbo' | 'nexus' | 'roue', ancre1: 'none', ancre2: 'none', ancre3: 'none' })}
                style={{ ...sel, width: 40, paddingLeft: 4, paddingRight: 0 }}
            >
                <option value="forbo">🟡 Forbo</option>
                <option value="nexus">🟣 Nexus</option>
                <option value="roue">🔵 Roue</option>
            </select>

            {/* Ancres (seulement si Nexus) - 3 petits menus */}
            {line.bot === 'nexus' && (
                <div style={{ display: 'flex', gap: 2 }}>
                    <select value={line.ancre1 ?? 'none'} onChange={e => onUpdate({ ...line, ancre1: e.target.value })} style={{ ...sel, width: 28, paddingLeft: 2, paddingRight: 0, appearance: 'none', textAlign: 'center', ...(line.ancre1?.startsWith('E') ? { backgroundColor: '#f1c40f', color: '#000000', fontWeight: 'bold' } : {}) }}>
                        <option value="none">⚓</option>
                        <option value="highfreq">F</option>
                        <option value="rdv">R</option>
                        <option value="trend">T</option>
                        {Array.from({ length: 50 }, (_, i) => <option key={`n${i + 1}`} value={String(i + 1)}>{i + 1}</option>)}
                        {Array.from({ length: 12 }, (_, i) => <option key={`s${i + 1}`} value={`E${i + 1}`}>{i + 1}</option>)}
                    </select>
                    <select value={line.ancre2 ?? 'none'} onChange={e => onUpdate({ ...line, ancre2: e.target.value })} style={{ ...sel, width: 28, paddingLeft: 2, paddingRight: 0, appearance: 'none', textAlign: 'center', ...(line.ancre2?.startsWith('E') ? { backgroundColor: '#f1c40f', color: '#000000', fontWeight: 'bold' } : {}) }}>
                        <option value="none">⚓</option>
                        <option value="highfreq">F</option>
                        <option value="rdv">R</option>
                        <option value="trend">T</option>
                        {Array.from({ length: 50 }, (_, i) => <option key={`n${i + 1}`} value={String(i + 1)}>{i + 1}</option>)}
                        {Array.from({ length: 12 }, (_, i) => <option key={`s${i + 1}`} value={`E${i + 1}`}>{i + 1}</option>)}
                    </select>
                    <select value={line.ancre3 ?? 'none'} onChange={e => onUpdate({ ...line, ancre3: e.target.value })} style={{ ...sel, width: 28, paddingLeft: 2, paddingRight: 0, appearance: 'none', textAlign: 'center', ...(line.ancre3?.startsWith('E') ? { backgroundColor: '#f1c40f', color: '#000000', fontWeight: 'bold' } : {}) }}>
                        <option value="none">⚓</option>
                        <option value="highfreq">F</option>
                        <option value="rdv">R</option>
                        <option value="trend">T</option>
                        {Array.from({ length: 50 }, (_, i) => <option key={`n${i + 1}`} value={String(i + 1)}>{i + 1}</option>)}
                        {Array.from({ length: 12 }, (_, i) => <option key={`s${i + 1}`} value={`E${i + 1}`}>{i + 1}</option>)}
                    </select>
                </div>
            )}

            {/* Supprimer */}
            <button
                onClick={onDelete}
                style={{
                    background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)',
                    color: '#e74c3c', borderRadius: 6, width: 24, height: 24,
                    cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}
            >×</button>
        </div>
    );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function SmartRackPanel({
    nexusState,
    roueCost,
    roueModeLabel,
    vivierSize,
    roueCombosCount,
    tarifOptions,
    onEmailSave,
    onNexusClick,
    onRoueClick,
    nexusLcdMsg,
    nexusGenerating,
    nexusTimer = 0,
    disabled = false,
}: SmartRackPanelProps) {
    const [emailOpen, setEmailOpen] = useState(false);
    const [validateMsg, setValidateMsg] = useState<string | null>(null);

    const [schedule, setSchedule] = useState<EmailScheduleState>({
        email: '',
        mardi: { day: 'Mardi', on: false, lignes: [] },
        vendredi: { day: 'Vendredi', on: false, lignes: [] },
    });

    // Day helpers
    const updateDay = useCallback((jour: 'mardi' | 'vendredi', patch: Partial<typeof schedule.mardi>) => {
        setSchedule(s => {
            const oldDay = s[jour];
            const newDay = { ...oldDay, ...patch };
            // Auto-création au on
            if (patch.on === true && oldDay.on === false && oldDay.lignes.length === 0) {
                newDay.lignes = [defaultLine()];
            }
            return { ...s, [jour]: newDay };
        });
    }, []);

    const addLine = (jour: 'mardi' | 'vendredi') => {
        updateDay(jour, { lignes: [...schedule[jour].lignes, defaultLine()] });
    };

    const updateLine = (jour: 'mardi' | 'vendredi', id: string, l: EmailScheduleLine) => {
        updateDay(jour, { lignes: schedule[jour].lignes.map(x => x.id === id ? l : x) });
    };

    const deleteLine = (jour: 'mardi' | 'vendredi', id: string) => {
        updateDay(jour, { lignes: schedule[jour].lignes.filter(x => x.id !== id) });
    };

    const handleValidate = () => {
        onEmailSave(schedule);
        setValidateMsg('Remplacer dans le profil ?');
        setTimeout(() => setValidateMsg(null), 5000);
    };

    // Nexus display info
    const nexusCombo = nexusState?.combos[nexusState.currentIndex ?? 0];
    const nexusScore = nexusCombo?.scoreTotal ?? null;
    const nexusIdx = nexusState ? (nexusState.currentIndex + 1) : null;
    const nexusTotal = nexusState?.combos.length ?? null;

    const inputStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#ddd', borderRadius: 6, fontSize: 13, padding: '4px 8px',
        outline: 'none', flex: 1,
    };

    const toggleStyle = (on: boolean): React.CSSProperties => ({
        background: on ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.15)',
        border: `1px solid ${on ? '#2ecc71' : '#e74c3c'}`,
        color: on ? '#2ecc71' : '#e74c3c',
        borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.2s',
    });

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            background: 'rgba(10,10,30,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            overflow: 'hidden',
            fontSize: 14,
            height: '100%',
        }}>

            {/* ══ BLOC A — NEXUS + LA ROUE (fixe) ══ */}
            <div style={{
                padding: '8px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                background: 'linear-gradient(135deg, rgba(142,68,173,0.1), rgba(41,128,185,0.1))',
            }}>
                <div style={{ display: 'flex', gap: 8 }}>

                    {/* Bouton NEXUS */}
                    <button
                        onClick={(e) => { e.stopPropagation(); if (!disabled) onNexusClick(); }}
                        disabled={disabled}
                        style={{
                            flex: 1, cursor: disabled ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, rgba(142,68,173,0.3), rgba(142,68,173,0.15))',
                            border: '1px solid rgba(142,68,173,0.5)',
                            borderRadius: 8, padding: '6px 8px', color: '#fff',
                            textAlign: 'center', transition: 'all 0.2s',
                            opacity: disabled ? 0.3 : 1,
                            filter: disabled ? 'grayscale(100%) blur(1px)' : 'none',
                        }}
                    >
                        <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: 1, color: '#d7bde2' }}>⬡ NEXUS</div>
                        <div style={{ fontSize: 13, color: '#f39c12', marginTop: 2, fontWeight: 800, fontFamily: 'monospace' }}>
                            {nexusTimer > 0 ? `${nexusTimer}s` : 'Prêt'}
                        </div>
                    </button>

                    {/* Bouton LA ROUE */}
                    <button
                        onClick={(e) => { e.stopPropagation(); if (!disabled) onRoueClick(); }}
                        disabled={disabled}
                        style={{
                            flex: 1, cursor: disabled ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, rgba(41,128,185,0.3), rgba(41,128,185,0.15))',
                            border: '1px solid rgba(41,128,185,0.5)',
                            borderRadius: 8, padding: '6px 8px', color: '#fff',
                            textAlign: 'center', transition: 'all 0.2s',
                            opacity: disabled ? 0.3 : 1,
                            filter: disabled ? 'grayscale(100%) blur(1px)' : 'none',
                        }}
                    >
                        <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: 1, color: '#aed6f1' }}>⊙ LA ROUE</div>
                        <div style={{ fontSize: 12, color: '#5dade2', marginTop: 2 }}>
                            {roueCombosCount > 0
                                ? `${roueModeLabel} · ${roueCombosCount} tickets · ${roueCost.toFixed(2)}€`
                                : `Vivier=${vivierSize}`}
                        </div>
                    </button>
                </div>
            </div>

            {/* ══ LCD NEXUS — dans le Bloc A, sous les boutons ══ */}
            {nexusLcdMsg && (
                <div style={{
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    padding: '4px 10px 6px',
                    background: 'rgba(0,0,0,0.6)',
                    borderTop: '1px solid rgba(142,68,173,0.25)',
                    position: 'relative',
                    opacity: disabled ? 0.3 : 1,
                }}>
                    <div style={{
                        display: 'inline-block',
                        fontSize: 12,
                        fontFamily: '"Share Tech Mono", "Courier New", monospace',
                        fontWeight: 700,
                        letterSpacing: 1.5,
                        color: nexusGenerating ? '#f39c12' : '#a855f7',
                        textShadow: nexusGenerating
                            ? '0 0 8px rgba(243,156,18,0.9), 0 0 16px rgba(243,156,18,0.4)'
                            : '0 0 8px rgba(168,85,247,0.9), 0 0 16px rgba(168,85,247,0.4)',
                        animation: 'lcd-check 0.1s step-end',  /* forcer re-render pour taille */
                        /* nécessite CSS pour détection overflow — solution pure CSS */
                    }}>
                        {nexusGenerating ? '⚡ ' : ''}{nexusLcdMsg}
                    </div>
                    <style>{`
                        @keyframes nexus-lcd-scroll {
                            0%   { transform: translateX(0); }
                            10%  { transform: translateX(0); }
                            90%  { transform: translateX(var(--scroll-w, 0px)); }
                            100% { transform: translateX(var(--scroll-w, 0px)); }
                        }
                    `}</style>
                </div>
            )}

            {/* ══ BLOC B — PROGRAMMATION EMAIL ══ */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Header compact — toujours visible, cliquable */}
                <div
                    onClick={() => setEmailOpen(!emailOpen)}
                    style={{
                        padding: '6px 12px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: emailOpen ? 'rgba(255,255,255,0.04)' : 'transparent',
                        transition: 'background 0.2s',
                    }}
                >
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#8e44ad', fontWeight: 700, marginBottom: emailOpen ? 0 : 4 }}>✉ PROGRAMMATION EMAIL</div>
                        {!emailOpen && (
                            /* Vue Compacte */
                            <div>
                                {schedule.email && (
                                    <div style={{ fontSize: 12, color: '#888', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        ✉ {schedule.email}
                                    </div>
                                )}
                                <CompactEmailRow state={schedule.mardi} />
                                <CompactEmailRow state={schedule.vendredi} />
                            </div>
                        )}
                    </div>
                    <span style={{ color: '#888', fontSize: 14, marginLeft: 8, transform: emailOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </div>

                {/* Contenu expandable */}
                {emailOpen && (
                    <div className="custom-scrollbar" style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto', flex: 1 }}>

                        {/* Email */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 13, color: '#888', flexShrink: 0 }}>✉</span>
                            <input
                                style={{ ...inputStyle, fontSize: 15 }}
                                type="email"
                                placeholder="votre@email.com"
                                value={schedule.email}
                                onChange={e => setSchedule(s => ({ ...s, email: e.target.value }))}
                            />
                            <button
                                onClick={handleValidate}
                                style={{
                                    background: validateMsg ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: validateMsg ? '#2ecc71' : '#fff',
                                    borderRadius: 6, padding: '4px 10px', fontSize: 13, cursor: 'pointer',
                                    whiteSpace: 'nowrap', flexShrink: 0,
                                }}
                            >
                                {validateMsg ?? 'Valider'}
                            </button>
                        </div>

                        {/* MARDI */}
                        <DaySection
                            state={schedule.mardi}
                            tarifOptions={tarifOptions}
                            onToggle={() => updateDay('mardi', { on: !schedule.mardi.on })}
                            onDayChange={d => updateDay('mardi', { day: d })}
                            onAdd={() => addLine('mardi')}
                            onUpdate={(id, l) => updateLine('mardi', id, l)}
                            onDelete={id => deleteLine('mardi', id)}
                        />

                        {/* VENDREDI */}
                        <DaySection
                            state={schedule.vendredi}
                            tarifOptions={tarifOptions}
                            onToggle={() => updateDay('vendredi', { on: !schedule.vendredi.on })}
                            onDayChange={d => updateDay('vendredi', { day: d })}
                            onAdd={() => addLine('vendredi')}
                            onUpdate={(id, l) => updateLine('vendredi', id, l)}
                            onDelete={id => deleteLine('vendredi', id)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Section jour (Mardi / Vendredi) ─────────────────────────────────────────

function DaySection({
    state,
    tarifOptions,
    onToggle,
    onDayChange,
    onAdd,
    onUpdate,
    onDelete,
}: {
    state: { day?: string; on: boolean; lignes: EmailScheduleLine[] };
    tarifOptions: string[];
    onToggle: () => void;
    onDayChange: (d: string) => void;
    onAdd: () => void;
    onUpdate: (id: string, l: EmailScheduleLine) => void;
    onDelete: (id: string) => void;
}) {
    const totalCost = state.lignes.reduce((s, l) => {
        const tariffNum = parseFloat(l.tarif.match(/([\d.]+)\s*€/)?.[1] || "0");
        return s + tariffNum * l.tickets;
    }, 0);

    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <select
                    value={state.day || 'Mardi'}
                    onChange={e => onDayChange(e.target.value)}
                    style={{ fontSize: 14, fontWeight: 800, color: '#ccc', letterSpacing: 0.5, flex: 1, background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', appearance: 'none' }}
                >
                    {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(d => (
                        <option key={d} value={d} style={{ background: '#3e2723', color: '#fff' }}>{d}</option>
                    ))}
                </select>
                <button onClick={onToggle} style={{
                    background: state.on ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.15)',
                    border: `1px solid ${state.on ? '#2ecc71' : '#e74c3c'}`,
                    color: state.on ? '#2ecc71' : '#e74c3c',
                    borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer',
                }}>
                    {state.on ? 'ON' : 'OFF'}
                </button>
                <button onClick={onAdd} style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#ddd', borderRadius: 6, padding: '2px 8px', fontSize: 14, cursor: 'pointer',
                }}>+ Ligne</button>
                {state.lignes.length > 0 && (
                    <span style={{ fontSize: 12, color: '#f39c12', fontWeight: 700 }}>Total: {totalCost.toFixed(2)}€</span>
                )}
            </div>

            {state.lignes.map(line => (
                <EditorRow
                    key={line.id}
                    line={line}
                    tarifOptions={tarifOptions}
                    onUpdate={l => onUpdate(line.id, l)}
                    onDelete={() => onDelete(line.id)}
                />
            ))}

            {state.lignes.length === 0 && (
                <div style={{ fontSize: 13, color: '#555', fontStyle: 'italic', padding: '4px 0' }}>
                    Aucune ligne — cliquez "+ Ligne" pour en ajouter
                </div>
            )}
        </div>
    );
}

export default SmartRackPanel;
