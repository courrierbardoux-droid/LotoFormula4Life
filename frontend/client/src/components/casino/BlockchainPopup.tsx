import React from 'react';
import { Network, Copy, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface BlockchainPopupProps {
    isOpen: boolean;
    onClose: () => void;
    blockchainData: string;
    onCopySettings: (data: any) => void;
}

export function BlockchainPopup({ isOpen, onClose, blockchainData, onCopySettings }: BlockchainPopupProps) {
    const [showConfirm, setShowConfirm] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    if (!isOpen || !blockchainData) return null;

    let parsedData: any = null;
    try {
        parsedData = JSON.parse(atob(blockchainData));
    } catch (e) {
        console.error("Erreur de decodage blockchain:", e);
        return null;
    }

    const handleCopy = () => {
        if (!showConfirm) {
            setShowConfirm(true);
            return;
        }

        // Dispatch custom event to Console
        const event = new CustomEvent('loto_blockchain_restore', { detail: parsedData });
        window.dispatchEvent(event);

        setCopied(true);
        setTimeout(() => {
            setCopied(false);
            setShowConfirm(false);
            onClose();
        }, 1500);
    };

    return (
        <>
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed z-[105] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-zinc-900 border border-zinc-700/50 shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden font-rajdhani animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-black p-4 flex items-center justify-between border-b border-zinc-800">
                    <div className="flex items-center gap-2 text-casino-gold">
                        <Network size={20} />
                        <h3 className="font-orbitron font-bold tracking-widest text-sm">RÉGLAGES CONSOLE</h3>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">

                    {parsedData.botRDV && parsedData.botRDV.active && (
                        <div className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="text-xs text-zinc-400 mb-2 uppercase font-orbitron">Module R.D.V Actif</div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-zinc-200">
                                <div>Mois: <span className="text-white font-bold">{parsedData.botRDV.m}</span></div>
                                <div>Jour: <span className="text-white font-bold">{parsedData.botRDV.j}</span></div>
                            </div>
                        </div>
                    )}

                    <div className="bg-zinc-800/50 rounded-lg p-3 space-y-3">
                        <div className="text-xs text-zinc-400 uppercase font-orbitron">Vivier Sélectionné</div>

                        {(parsedData.nbElevee > 0 || parsedData.nbMoyenne > 0 || parsedData.nbBasse > 0) && (
                            <div className="flex flex-wrap gap-2 text-sm">
                                <span className="text-zinc-500">Numéros:</span>
                                {parsedData.nbElevee > 0 && <Badge variant="outline" className="text-red-400 border-red-900/50">+{parsedData.nbElevee} Élevée</Badge>}
                                {parsedData.nbMoyenne > 0 && <Badge variant="outline" className="text-orange-400 border-orange-900/50">+{parsedData.nbMoyenne} Moyenne</Badge>}
                                {parsedData.nbBasse > 0 && <Badge variant="outline" className="text-yellow-400 border-yellow-900/50">+{parsedData.nbBasse} Basse</Badge>}
                            </div>
                        )}

                        {(parsedData.nbEtoilesElevee > 0 || parsedData.nbEtoilesMoyenne > 0 || parsedData.nbEtoilesBasse > 0) && (
                            <div className="flex flex-wrap gap-2 text-sm">
                                <span className="text-zinc-500">Étoiles:</span>
                                {parsedData.nbEtoilesElevee > 0 && <Badge variant="outline" className="text-red-400 border-red-900/50">+{parsedData.nbEtoilesElevee} Élevée</Badge>}
                                {parsedData.nbEtoilesMoyenne > 0 && <Badge variant="outline" className="text-orange-400 border-orange-900/50">+{parsedData.nbEtoilesMoyenne} Moyenne</Badge>}
                                {parsedData.nbEtoilesBasse > 0 && <Badge variant="outline" className="text-yellow-400 border-yellow-900/50">+{parsedData.nbEtoilesBasse} Basse</Badge>}
                            </div>
                        )}
                    </div>

                    {(parsedData.nbDormeur > 0 || parsedData.nbEtoilesDormeur > 0 || parsedData.chaosLevel > 0) && (
                        <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
                            <div className="text-xs text-zinc-400 uppercase font-orbitron">Bias & Chaos</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {parsedData.nbDormeur > 0 && <div>Num. Dormeur: <span className="text-white font-bold">{parsedData.nbDormeur}</span></div>}
                                {parsedData.nbEtoilesDormeur > 0 && <div>Étoile Dormeur: <span className="text-white font-bold">{parsedData.nbEtoilesDormeur}</span></div>}
                                {parsedData.chaosLevel > 0 && <div className="col-span-2">Niveau Chaos: <span className="text-red-400 font-bold">{parsedData.chaosLevel}</span></div>}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Action */}
                <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                    <button
                        onClick={handleCopy}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold transition-all",
                            copied
                                ? "bg-green-600/20 text-green-400 border border-green-500/50"
                                : showConfirm
                                    ? "bg-red-900/50 text-red-200 border border-red-500 hover:bg-red-800/60"
                                    : "bg-casino-gold/10 text-casino-gold border border-casino-gold/30 hover:bg-casino-gold/20"
                        )}
                    >
                        {copied ? (
                            <><Check size={18} /> Copié avec succès</>
                        ) : showConfirm ? (
                            "Écraser la configuration de la Console ?"
                        ) : (
                            <><Copy size={18} /> Copier vers la Console</>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
