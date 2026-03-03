import React, { useRef, useState } from 'react';
import { Trash2, Search, Network } from 'lucide-react';
import type { NexusCombo } from '@/lib/lotoService';
import { BlockchainPopup } from '@/components/casino/BlockchainPopup';

export interface ComboEntry {
    combo: NexusCombo;
    index: number;
}

interface CombosListPanelProps {
    entries: ComboEntry[];
    isOpen: boolean;
    onToggle: () => void;
    onOpenDetail: (combo: NexusCombo) => void;
    onClear: () => void;
    onDelete: (index: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function modeColor(mode: NexusCombo['mode']): string {
    switch (mode) {
        case 'nexus': return '#3b82f6';
        case 'roue-complete': return '#60a5fa';
        case 'roue-abregee': return '#93c5fd';
        default: return '#94a3b8';
    }
}

function modeLabel(mode: NexusCombo['mode']): string {
    switch (mode) {
        case 'nexus': return 'NEXUS';
        case 'roue-complete': return 'ROUE ✓';
        case 'roue-abregee': return 'ROUE ≈';
        default: return 'MANUEL';
    }
}

function scoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
}

// ── Composant Principal ────────────────────────────────────────────────────────

export function CombosListPanel({ entries, isOpen, onToggle, onOpenDetail, onClear, onDelete }: CombosListPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const count = entries.length;
    const isEmpty = count === 0;

    // État local pour la confirmation globale (OUI/NON dans le bouton)
    const [confirmClear, setConfirmClear] = useState(false);
    const [blockchainPopupData, setBlockchainPopupData] = useState<string | null>(null);

    const handleClearRequest = (e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmClear(true);
    };

    const handleClearConfirm = (e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmClear(false);
        onClear();
    };

    const handleClearCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmClear(false);
    };

    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.4s cubic-bezier(0.22,0.61,0.36,1)',
                transform: isOpen ? 'translateY(0)' : 'translateY(calc(100% - 32px))',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* ── Bouton "poignée" ─── */}
            <button
                onClick={(e) => { e.stopPropagation(); if (!confirmClear) onToggle(); }}
                style={{
                    height: 32,
                    background: 'linear-gradient(90deg, #001f3f 0%, #003366 50%, #001f3f 100%)',
                    border: '1px solid rgba(59,130,246,0.5)',
                    borderBottom: 'none',
                    borderRadius: '10px 10px 0 0',
                    cursor: confirmClear ? 'default' : 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    padding: '0 12px',
                    userSelect: 'none',
                    width: '100%',
                    pointerEvents: 'auto',
                }}
            >
                {/* Zone Gauche — vide ou "annuler" */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                </div>

                {/* Zone Centre */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {!confirmClear ? (
                        <>
                            <span style={{
                                fontSize: 10, color: '#3b82f6',
                                transform: isOpen ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.3s',
                            }}>▲</span>
                            <span style={{
                                fontSize: 12,
                                fontFamily: '"Orbitron", monospace',
                                fontWeight: 700,
                                color: '#dbeafe',
                                letterSpacing: 2.5,
                                textTransform: 'uppercase',
                            }}>
                                {isEmpty ? 'LISTE VIDE' : 'LISTE TIRAGE'}
                            </span>
                            {!isEmpty && (
                                <span style={{
                                    fontSize: 10,
                                    background: 'rgba(59,130,246,0.25)',
                                    border: '1px solid rgba(59,130,246,0.45)',
                                    color: '#93c5fd',
                                    borderRadius: 20,
                                    padding: '1px 7px',
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                }}>
                                    {count}
                                </span>
                            )}
                        </>
                    ) : (
                        <span style={{
                            fontSize: 11,
                            fontFamily: '"Orbitron", monospace',
                            fontWeight: 700,
                            color: '#ef4444',
                            letterSpacing: 1.5,
                        }}>
                            VIDER LA LISTE ?
                        </span>
                    )}
                </div>

                {/* Zone Droite — Corbeille ou OUI */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {!isEmpty && !confirmClear && (
                        <span
                            onClick={handleClearRequest}
                            style={{
                                fontSize: 14, color: '#ef4444',
                                cursor: 'pointer', opacity: 0.5, padding: '2px 6px',
                                borderRadius: 4, display: 'flex', alignItems: 'center',
                                transition: 'opacity 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                            title="Vider toute la liste"
                        >
                            <Trash2 size={14} />
                        </span>
                    )}
                    {confirmClear && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span
                                onClick={handleClearCancel}
                                style={{
                                    fontSize: 11, color: '#94a3b8',
                                    cursor: 'pointer', padding: '2px 8px',
                                    border: '1px solid rgba(148,163,184,0.3)',
                                    borderRadius: 4,
                                    background: 'rgba(148,163,184,0.1)',
                                }}
                            >
                                NON
                            </span>
                            <span
                                onClick={handleClearConfirm}
                                style={{
                                    fontSize: 11, color: '#ef4444',
                                    cursor: 'pointer', padding: '2px 8px',
                                    border: '1px solid rgba(239,68,68,0.5)',
                                    borderRadius: 4,
                                    background: 'rgba(239,68,68,0.15)',
                                    fontWeight: 700,
                                }}
                            >
                                OUI
                            </span>
                        </div>
                    )}
                </div>
            </button>

            {/* ── Corps du volet ────────────────────────── */}
            <div style={{
                backgroundColor: '#0a0807',
                borderLeft: '2px solid #94a3b8',
                borderRight: '2px solid #94a3b8',
                borderTop: '2px solid #3b82f6',
                maxHeight: 480,
                overflow: 'hidden',
                display: (isEmpty || !isOpen) ? 'none' : 'flex',
                flexDirection: 'column',
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.9)',
            }}>
                <div ref={scrollRef} style={{ overflowY: 'auto', maxHeight: 480 }} className="custom-scrollbar">
                    {entries.map(({ combo, index }) => (
                        <ComboRow
                            key={index}
                            combo={combo}
                            index={index}
                            onOpenDetail={onOpenDetail}
                            onDelete={onDelete}
                            onShowBlockchain={(data) => setBlockchainPopupData(data)}
                        />
                    ))}
                </div>
            </div>

            {/* Blockchain Popup */}
            {blockchainPopupData && (
                <BlockchainPopup
                    isOpen={!!blockchainPopupData}
                    onClose={() => setBlockchainPopupData(null)}
                    blockchainData={blockchainPopupData}
                    onCopySettings={() => { }} // Not strictly required as the popup dispatches the event
                />
            )}
        </div>
    );
}

// ── Ligne de combo ────────────────────────────────────────────────────────────

function ComboRow({
    combo,
    index,
    onOpenDetail,
    onDelete,
    onShowBlockchain,
}: {
    combo: NexusCombo;
    index: number;
    onOpenDetail: (c: NexusCombo) => void;
    onDelete: (index: number) => void;
    onShowBlockchain: (data: string) => void;
}) {
    const accentColor = modeColor(combo.mode);
    const label = modeLabel(combo.mode);
    const scoreStr = combo.scoreTotal > 0 ? `${combo.scoreTotal.toFixed(2)}/100` : null;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                borderBottom: '1px solid rgba(148,163,184,0.1)',
                fontFamily: '"Share Tech Mono","Courier New",monospace',
                fontSize: 22,
                transition: 'background 0.15s',
                cursor: 'default',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
            {/* Index */}
            <span style={{ color: '#64748b', fontSize: 18, minWidth: 32, textAlign: 'right', userSelect: 'none' }}>
                {index + 1}.
            </span>


            {/* Numéros avec badge ancre ⚓ */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flex: 1 }}>
                {combo.numeros.map(n => {
                    const isAncre = combo.ancresIncluses?.includes(n);
                    return (
                        <span key={n} style={{
                            position: 'relative',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 40, height: 40, borderRadius: '50%',
                            background: isAncre ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                            border: isAncre ? '2px solid rgba(59,130,246,0.7)' : '1px solid rgba(255,255,255,0.1)',
                            color: isAncre ? '#bfdbfe' : '#f1f5f9',
                            fontSize: 18, fontWeight: isAncre ? 700 : 400,
                        }} title={isAncre ? `${n} — Ancré ⚓` : `${n}`}>
                            {n}
                            {isAncre && (
                                <span style={{
                                    position: 'absolute',
                                    top: -5, right: -5,
                                    fontSize: 8,
                                    background: 'rgba(37,99,235,1)',
                                    borderRadius: '50%',
                                    width: 14, height: 14,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '1px solid #1d4ed8',
                                    lineHeight: 1,
                                }}>⚓</span>
                            )}
                        </span>
                    );
                })}
                <span style={{ color: '#334155', margin: '0 3px', fontSize: 22 }}>│</span>
                {combo.etoiles.map(e => (
                    <span key={`e${e}`} style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(253,224,71,0.08)',
                        border: '1px solid rgba(253,224,71,0.3)',
                        color: '#fef08a', fontSize: 18,
                    }}>{e}</span>
                ))}
            </div>

            {/* Tags mode/saison/score/ancre */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {/* LOUPE DETAIL */}
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenDetail(combo); }}
                    style={{
                        width: 34, height: 34,
                        background: 'rgba(255,255,255,0.05)',
                        border: `1px solid ${accentColor}80`,
                        borderRadius: 6,
                        color: accentColor,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                        marginRight: 4,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = accentColor; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = accentColor; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = accentColor; e.currentTarget.style.borderColor = `${accentColor}80`; }}
                    title="Voir le détail Nexus"
                >
                    <Search size={18} />
                </button>

                {/* BLOCKCHAIN DETAIL (RÉGLAGE CONSOLE) */}
                {(combo as any).blockchain && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onShowBlockchain((combo as any).blockchain); }}
                        style={{
                            width: 34, height: 34,
                            background: 'rgba(255,255,255,0.05)',
                            border: `1px solid #facc15`, // casino-gold
                            borderRadius: 6,
                            color: '#facc15',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                            marginRight: 4,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#facc15'; e.currentTarget.style.color = '#000'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#facc15'; }}
                        title="Réglage console (Blockchain)"
                    >
                        <Network size={18} />
                    </button>
                )}

                <span style={{
                    fontSize: 16, fontFamily: '"Orbitron",sans-serif', fontWeight: 700,
                    color: accentColor, border: `2px solid ${accentColor}`, borderRadius: 6, padding: '1px 6px',
                    background: 'rgba(59,130,246,0.08)',
                }}>{label}</span>
                {combo.saison && <span style={{ fontSize: 16, color: '#94a3b8', fontStyle: 'italic' }}>{combo.saison}</span>}
                {scoreStr && <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: scoreColor(combo.scoreTotal) }}>{scoreStr}</span>}
                {combo.ancresIncluses?.length > 0 && <span style={{ fontSize: 16, color: '#60a5fa' }} title="Ancre(s)">⚓</span>}
            </div>

            {/* Corbeille individuelle */}
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(index); }}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ef4444', opacity: 0.35,
                    padding: '4px 6px', borderRadius: 4, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}
                title={`Supprimer le combo #${index + 1}`}
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
}
