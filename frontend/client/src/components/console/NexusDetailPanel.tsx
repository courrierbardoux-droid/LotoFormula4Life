import React from 'react';
import type { NexusCombo, NexusCritere, NexusGeneseLine } from '../../lib/lotoService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface NexusDetailPanelProps {
    combo: NexusCombo | null;
    isOpen: boolean;
    onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function critereColor(type: NexusCritere['type']): string {
    switch (type) {
        case 'compensation': return '#e74c3c';  // rouge — Dormeur
        case 'saison': return '#27ae60';  // vert — Saison
        case 'composite': return '#f39c12';  // orange — Composite
        case 'rdv': return '#8e44ad';  // violet — RDV
        case 'symbiose': return '#2980b9';  // bleu — Symbiose
        case 'tandem': return '#f1c40f';  // jaune — Tandem
        case 'quartet': return '#1abc9c';  // turquoise — Quartet
        case 'anguleux': return '#95a5a6';  // gris — Anguleux
        default: return '#bdc3c7';
    }
}

function scoreBarColor(score: number): string {
    if (score >= 75) return '#2ecc71';
    if (score >= 50) return '#f39c12';
    if (score >= 25) return '#e67e22';
    return '#e74c3c';
}

// ─── Sub-composants ───────────────────────────────────────────────────────────

interface NumberCardProps {
    line: NexusGeneseLine;
}

function NumberCard({ line }: NumberCardProps) {
    const [tooltip, setTooltip] = React.useState<string | null>(null);
    const score = line.scorePartiel;
    const barColor = scoreBarColor(score);
    const isEtoile = line.isEtoile;

    return (
        <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${line.isAncre ? '#e74c3c' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 12,
            padding: '12px 14px',
            minWidth: 168,
            maxWidth: 216,
            flex: '1 1 168px',
            position: 'relative',
        }}>
            {/* Badge ancre */}
            {line.isAncre && (
                <div style={{
                    position: 'absolute', top: -12, right: 12,
                    background: '#e74c3c', color: '#fff',
                    fontSize: 14, padding: '3px 10px', borderRadius: 14,
                    fontWeight: 700
                }}>⚓ ANCRE</div>
            )}

            {/* Numéro */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                    width: 52, height: 52,
                    borderRadius: isEtoile ? '0' : '50%',
                    background: isEtoile ? 'transparent' : 'linear-gradient(135deg, #ecf0f1, #bdc3c7)',
                    color: isEtoile ? '#f1c40f' : '#1a1a2e',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: isEtoile ? 26 : 22,
                    boxShadow: (!isEtoile && line.isAncre) ? '0 0 14px rgba(231,76,60,0.6)' : 'none'
                }}>
                    {isEtoile ? `⭐${line.numero}` : line.numero}
                </div>
                <div style={{ fontSize: 16, color: '#aaa' }}>{line.position}</div>
            </div>

            {/* Barre de score (seulement pour numéros) */}
            {!isEtoile && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 16, color: '#ccc', marginBottom: 5 }}>
                        Score : <strong style={{ color: barColor }}>{score.toFixed(2)}/100</strong>
                    </div>
                    <div style={{ height: 7, background: 'rgba(255,255,255,0.1)', borderRadius: 5 }}>
                        <div style={{
                            height: '100%', width: `${score}%`,
                            background: `linear-gradient(90deg, ${barColor}, ${barColor}aa)`,
                            borderRadius: 5, transition: 'width 0.4s ease'
                        }} />
                    </div>
                </div>
            )}

            {/* Critères */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {line.criteres.map((c, i) => (
                    <div
                        key={i}
                        style={{
                            fontSize: 16, color: critereColor(c.type),
                            cursor: 'help', padding: '4px 6px',
                            borderRadius: 6,
                            background: tooltip === `${line.numero}-${i}` ? 'rgba(255,255,255,0.08)' : 'transparent',
                        }}
                        onMouseEnter={() => setTooltip(`${line.numero}-${i}`)}
                        onMouseLeave={() => setTooltip(null)}
                        title={c.detail}
                    >
                        {c.label}
                    </div>
                ))}

                {/* Raison si pas de critères */}
                {line.criteres.length === 0 && (
                    <div style={{ fontSize: 16, color: '#888', fontStyle: 'italic' }}>
                        {line.raison}
                    </div>
                )}
            </div>

            {/* Tooltip flottant */}
            {tooltip && line.criteres.some((_, i) => `${line.numero}-${i}` === tooltip) && (
                <div style={{
                    position: 'absolute', bottom: '110%', left: 0, right: 0,
                    background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 12, padding: '12px 14px', fontSize: 16, color: '#ddd',
                    zIndex: 100, lineHeight: 1.5,
                    boxShadow: '0 6px 28px rgba(0,0,0,0.6)'
                }}>
                    {line.criteres.find((_, i) => `${line.numero}-${i}` === tooltip)?.detail}
                </div>
            )}
        </div>
    );
}

// ─── Glossaire des Algorithmes ──────────────────────────────────────────────────

function AlgorithmGlossary() {
    const definitions = [
        {
            label: 'Symbiose', icon: '🧬', color: '#2980b9',
            text: 'Mesure l\'harmonie historique entre les numéros. Plus elle est élevée, plus ces numéros ont une tendance naturelle à sortir ensemble.',
            example: 'Ex: Le 12 et le 45 sont sortis ensemble 14 fois sur les 20 derniers tirages.'
        },
        {
            label: 'Tandem', icon: '🚲', color: '#f1c40f',
            text: 'Repère les duos "inséparables". Identifie le partenaire idéal pour accompagner une ancre ou un numéro dominant.',
            example: 'Ex: Si le numéro 7 sort, le numéro 42 l\'accompagne dans 85% des cas.'
        },
        {
            label: 'Compensation', icon: '⚖️', color: '#e74c3c',
            text: 'Analyse les "dormeurs". Sélectionne les numéros qui, après une longue absence, atteignent un seuil de probabilité de réapparition critique.',
            example: 'Ex: Le numéro 33 n\'est pas sorti depuis 50 tirages : sa probabilité de réveil est maximale.'
        },
        {
            label: 'Saisonnalité', icon: '📅', color: '#27ae60',
            text: 'Capte les affinités calendaires. Certains numéros présentent des pics de sortie récurrents selon les mois ou les saisons.',
            example: 'Ex: Le numéro 18 a une "forme" exceptionnelle spécifiquement pendant les mois d\'Hiver.'
        },
        {
            label: 'Rendez-vous (RDV)', icon: '📍', color: '#8e44ad',
            text: 'L\'algorithme de précision qui calcule la fenêtre temporelle optimale où un numéro a la plus forte probabilité statistique de sortir.',
            example: 'Ex: Le numéro 5 entre dans sa "fenêtre de tir" optimale d\'ici les 2 prochains tirages.'
        },
        {
            label: 'Quartet', icon: '⚛️', color: '#1abc9c',
            text: 'Analyse de groupe. Assure que la répartition par dizaines suit la norme statistique des tirages gagnants.',
            example: 'Preuve : 88,7% des combinaisons gagnantes historiques sont réparties sur 3 ou 4 dizaines différentes.'
        },
        {
            label: 'Anguleux', icon: '📐', color: '#95a5a6',
            text: 'Optimisation géométrique. Veille à une répartition spatiale équilibrée pour coller à la loi des grands nombres.',
            example: 'Preuve : La distribution uniforme (numéros distants) représente la réalité de 99% des tirages à long terme.'
        }
    ];

    return (
        <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 19, color: '#8e44ad', fontWeight: 900, marginBottom: 17, letterSpacing: 1.5, borderBottom: '1px solid rgba(142,68,173,0.3)', paddingBottom: 8 }}>
                🧬 DÉCRYPTAGE DES ALGORITHMES
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 17 }}>
                {definitions.map((def, i) => (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${def.color}33`,
                        borderRadius: 12, padding: '14px 16px',
                        display: 'flex', gap: 14, alignItems: 'flex-start'
                    }}>
                        <div style={{ fontSize: 24, background: `${def.color}22`, width: 50, height: 50, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {def.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: def.color, marginBottom: 4 }}>{def.label}</div>
                            <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.4, textAlign: 'justify', marginBottom: 6 }}>{def.text}</div>
                            <div style={{ fontSize: 13, color: def.color, fontStyle: 'italic', background: `${def.color}08`, padding: '4px 8px', borderRadius: 4, opacity: 0.9 }}>
                                💡 {def.example}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function NexusDetailPanel({ combo, isOpen, onClose }: NexusDetailPanelProps) {
    if (!combo) return null;

    const numLines = combo.genese.filter(l => !l.isEtoile);
    const starLines = combo.genese.filter(l => l.isEtoile);
    const totalCards = combo.genese.length;

    // Calcul de largeur adaptative : environ 230px par carte en ligne (192 * 1.2), avec un minimum de 720px
    // On limite à 90% de la largeur écran maximum.
    const calculatedWidth = Math.max(720, Math.min(window.innerWidth * 0.9, totalCards * 230));

    const scoreColor = scoreBarColor(combo.scoreTotal);

    return (
        <>
            {/* Overlay de fond pour fermer */}
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 100,
                        backdropFilter: 'blur(4px)',
                    }}
                />
            )}

            {/* Volet latéral */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                height: '745px',
                borderTopLeftRadius: '8px',
                width: calculatedWidth,
                background: 'rgba(10, 10, 30, 0.98)',
                backdropFilter: 'blur(20px)',
                borderLeft: '2px solid rgba(142,68,173,0.5)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 101,
                transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: isOpen ? 'translateX(0)' : 'translateX(120%)',
                boxShadow: isOpen ? '-10px 0 40px rgba(0,0,0,0.8)' : 'none',
            }}>
                {/* Header avec croix à GAUCHE */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    padding: '12px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    background: 'linear-gradient(90deg, rgba(142,68,173,0.15), transparent)',
                    flexShrink: 0,
                    gap: 15
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                            width: 46, height: 46, color: '#fff', cursor: 'pointer', fontSize: 26,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >×</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 17 }}>
                        <span style={{ fontSize: 26, fontWeight: 900, color: '#8e44ad', letterSpacing: 1.8 }}>🔬 DÉTAIL NEXUS</span>
                        <span style={{ fontSize: 19, color: '#aaa', fontFamily: 'monospace' }}>{combo.modeDetail}</span>
                    </div>
                </div>

                {/* Contenu scrollable (vertical seulement) */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '24px 28px' }} className="custom-scrollbar">

                    {/* Cartes numéros - Affichage en ligne pour éviter le scroll vertical si possible */}
                    {numLines.length > 0 && (
                        <div>
                            <div style={{ fontSize: 17, color: '#888', marginBottom: 14, fontWeight: 700, letterSpacing: 0.7 }}>
                                NUMÉROS ({numLines.length})
                            </div>
                            <div style={{
                                display: 'flex', flexWrap: 'wrap',
                                gap: 14,
                            }}>
                                {numLines.map((line, i) => <NumberCard key={i} line={line} />)}
                            </div>
                        </div>
                    )}

                    {/* Cartes étoiles */}
                    {starLines.length > 0 && (
                        <div style={{ marginTop: 28 }}>
                            <div style={{ fontSize: 17, color: '#888', marginBottom: 14, fontWeight: 700, letterSpacing: 0.7 }}>
                                ÉTOILES ({starLines.length})
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                                {starLines.map((line, i) => <NumberCard key={i} line={line} />)}
                            </div>
                        </div>
                    )}

                    {/* Glossaire pédagogique des algorithmes */}
                    <AlgorithmGlossary />

                    {/* Panel synthèse */}
                    <div style={{
                        marginTop: 38,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14,
                        padding: '19px 24px',
                    }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 23, marginBottom: 23 }}>
                            <Stat label="Somme" value={combo.somme} ok={combo.somme >= 98 && combo.somme <= 157} />
                            <Stat label="Parité" value={`${combo.parite.pairs}P/${combo.parite.impairs}I`} ok={!(combo.parite.pairs === 5 || combo.parite.impairs === 5)} />
                            <Stat label="Haut/Bas" value={`${combo.hautBas.hauts}H/${combo.hautBas.bas}B`} ok={!(combo.hautBas.hauts === 5 || combo.hautBas.bas === 5)} />
                            <Stat label="Symbiose" value={combo.hasSymbiose ? 'Active ✅' : 'Absente'} ok={combo.hasSymbiose} />
                            {combo.hasConsecutive && <Stat label="Consécutifs" value="Oui ✨" ok={true} />}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 22, borderTop: '2px solid rgba(255,255,255,0.08)', paddingTop: 24 }}>
                            <div style={{ fontSize: 19, color: '#aaa', fontWeight: 600 }}>SCORE GLOBAL NEXUS :</div>
                            <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 8 }}>
                                <div style={{
                                    height: '100%', width: `${combo.scoreTotal}%`,
                                    background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}cc)`,
                                    borderRadius: 8,
                                    boxShadow: `0 0 16px ${scoreColor}55`
                                }} />
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: scoreColor, width: 110, textAlign: 'right' }}>{combo.scoreTotal.toFixed(2)}/100</div>
                        </div>

                        <div style={{ fontSize: 17, color: '#555', marginTop: 17, fontFamily: 'monospace', textAlign: 'right' }}>
                            {new Date(combo.dateGeneration).toLocaleString('fr-FR')} — {combo.signature}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function Stat({ label, value, ok }: { label: string; value: string | number; ok: boolean }) {
    return (
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 16, color: '#888' }}>{label} :</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: ok ? '#2ecc71' : '#e74c3c' }}>{value}</span>
        </div>
    );
}

export default NexusDetailPanel;
