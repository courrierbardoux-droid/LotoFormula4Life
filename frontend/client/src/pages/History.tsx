
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import { chargerHistorique, Tirage, mettreAJourCache, getGridHistory, checkGridResult, getDernierTirage, PlayedGrid, verifierMiseAJourNecessaire } from '@/lib/lotoService';
import { useUser } from '@/lib/UserContext';
import { Download, Upload, AlertTriangle, RefreshCw, FileText, CheckCircle, Trophy, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LottoBall } from '@/components/casino/LottoBall';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function History() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const [history, setHistory] = useState<Tirage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlinking, setIsBlinking] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateNeeded, setUpdateNeeded] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoUpdateTriggered = useRef(false);
  
  // État pour la modal de victoire
  const [showWinModal, setShowWinModal] = useState(false);
  const [winningGrids, setWinningGrids] = useState<{grid: PlayedGrid, result: {status: string, gain: number, matchNum: number, matchStar: number}}[]>([]);
  
  // État pour le filtre de dates CSV
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Détecter le paramètre autoUpdate dans l'URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoUpdate = params.get('autoUpdate');
    
    if (autoUpdate === 'true' && !autoUpdateTriggered.current) {
      autoUpdateTriggered.current = true;
      // Ouvrir la fenêtre de téléversement automatiquement (sans réouvrir le lien car déjà fait)
      setShowUpdateModal(true);
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 5000);
      
      // Nettoyer l'URL
      window.history.replaceState({}, '', '/history');
      
      toast.info("Veuillez téléverser le fichier CSV téléchargé pour mettre à jour les données.");
    }
  }, []);

  // Load history on mount
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await chargerHistorique();
        setHistory(data);
        
        // Vérifier si une mise à jour est nécessaire
        const dernierTirage = getDernierTirage(data);
        const verif = verifierMiseAJourNecessaire(dernierTirage);
        setUpdateNeeded(verif.necessaire);
      } catch (error) {
        console.error("Failed to load history", error);
        toast.error("Erreur lors du chargement de l'historique");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleUpdateAction = (openWindow = true) => {
    // Start blinking
    setIsBlinking(true);
    setTimeout(() => setIsBlinking(false), 5000);

    // Show modal
    setShowUpdateModal(true);

    // Open URL
    if (openWindow) {
      window.open('https://www.loterie-nationale.be/nos-jeux/euromillions/resultats-tirage/statistiques', '_blank');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Basic CSV parsing validation
    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      toast.error("Format de fichier invalide. Veuillez uploader un fichier CSV.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        try {
          // Parse CSV simply to update state
          const lines = text.trim().split('\n');
          const newTirages: Tirage[] = [];
          
          // Skip header
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(';');
            if (cols.length < 8) continue;
            
            // Flexible date parsing attempt
            let dateStr = cols[0];
            // If date contains full timestamp, keep it or clean it? keeping it simple for now
            
            newTirages.push({
              date: dateStr,
              numeros: [
                parseInt(cols[1]), parseInt(cols[2]), parseInt(cols[3]), parseInt(cols[4]), parseInt(cols[5])
              ].sort((a, b) => a - b),
              etoiles: [
                parseInt(cols[6]), parseInt(cols[7])
              ].sort((a, b) => a - b)
            });
          }
          
          // Sort descending
          newTirages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          mettreAJourCache(newTirages); // Mise à jour globale pour que les stats (Console) en profitent aussi
          setHistory(newTirages);
          setUpdateNeeded(false); // Réinitialiser l'état de mise à jour
          toast.success("Historique mis à jour avec succès !");
          setShowUpdateModal(false);
          
          // Vérifier les grilles jouées pour détecter les gains
          const dernierTirage = getDernierTirage(newTirages);
          const grillesJouees = getGridHistory();
          
          if (dernierTirage && grillesJouees.length > 0) {
            const grillesGagnantes: {grid: PlayedGrid, result: {status: string, gain: number, matchNum: number, matchStar: number}}[] = [];
            
            grillesJouees.forEach(grille => {
              const result = checkGridResult(grille, dernierTirage);
              if (result.gain > 0) {
                grillesGagnantes.push({ grid: grille, result });
              }
            });
            
            if (grillesGagnantes.length > 0) {
              setWinningGrids(grillesGagnantes);
              setShowWinModal(true);
            }
          }
        } catch (err) {
            console.error(err);
            toast.error("Erreur lors de l'analyse du fichier CSV");
        }
      }
    };
    reader.readAsText(file);
  };

  // Fonction helper pour parser une date de l'historique (formats possibles: ISO, DD/MM/YYYY, etc.)
  const parseHistoryDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    
    // Essayer le format ISO standard d'abord
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    
    // Essayer le format DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Mois 0-indexed
      const year = parseInt(parts[2], 10);
      d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    
    // Essayer le format DD-MM-YYYY
    const parts2 = dateStr.split('-');
    if (parts2.length === 3 && parts2[0].length <= 2) {
      const day = parseInt(parts2[0], 10);
      const month = parseInt(parts2[1], 10) - 1;
      const year = parseInt(parts2[2], 10);
      d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    
    return null;
  };

  // Fonction de téléchargement CSV avec filtre de dates
  const handleDownloadCSV = () => {
    if (history.length === 0) {
      toast.error("Aucune donnée à télécharger");
      return;
    }

    // Filtrer par dates si spécifiées
    let filteredHistory = [...history];
    const totalBefore = filteredHistory.length;
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filteredHistory = filteredHistory.filter(t => {
        const tirageDate = parseHistoryDate(t.date);
        if (!tirageDate) {
          console.warn("Date invalide:", t.date);
          return false;
        }
        return tirageDate >= fromDate;
      });
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filteredHistory = filteredHistory.filter(t => {
        const tirageDate = parseHistoryDate(t.date);
        if (!tirageDate) return false;
        return tirageDate <= toDate;
      });
    }
    
    console.log(`Filtre: ${dateFrom} -> ${dateTo}, Résultat: ${filteredHistory.length}/${totalBefore} tirages`);
    
    if (filteredHistory.length === 0) {
      toast.error(`Aucun tirage trouvé entre ${dateFrom || 'le début'} et ${dateTo || 'la fin'}`);
      return;
    }

    try {
      // Créer le contenu CSV
      const header = "Date;N1;N2;N3;N4;N5;E1;E2";
      const rows = filteredHistory.map(tirage => {
        const tirageDate = parseHistoryDate(tirage.date);
        const dateFormatted = tirageDate 
          ? tirageDate.toLocaleDateString('fr-FR') 
          : tirage.date;
        return `${dateFormatted};${tirage.numeros.join(';')};${tirage.etoiles.join(';')}`;
      });
      
      const csvContent = [header, ...rows].join('\n');
      
      // Nom du fichier avec les dates si filtrées
      let filename = 'historique_euromillions';
      if (dateFrom || dateTo) {
        filename += `_${dateFrom || 'debut'}_${dateTo || 'fin'}`;
      } else {
        filename += `_${format(new Date(), 'yyyy-MM-dd')}`;
      }
      filename += '.csv';
      
      // Méthode simple et directe via data URI
      const csvData = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csvContent);
      
      const link = document.createElement('a');
      link.href = csvData;
      link.download = filename;
      
      // Ajouter au DOM, cliquer, et retirer
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`${filteredHistory.length} tirages téléchargés !`);
      
    } catch (error) {
      console.error("Erreur lors du téléchargement:", error);
      toast.error("Erreur lors de la création du fichier CSV");
    }
  };

  // Obtenir le dernier tirage pour l'affichage
  const lastDraw = history.length > 0 ? history[0] : null;

  return (
    <CasinoLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4 pt-20">
        
        {/* TITRE CENTRÉ */}
        <div className="text-center pt-2 pb-4">
            <h1 className="text-3xl md:text-4xl font-orbitron font-black text-white tracking-widest text-shadow-glow mb-2">
                HISTORIQUE EUROMILLIONS
            </h1>
            <div className="h-1 w-48 bg-casino-gold mx-auto rounded-full shadow-[0_0_15px_rgba(255,215,0,0.8)]" />
        </div>
        

        {/* Update Modal */}
        <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
            <DialogContent className="bg-zinc-900 border-zinc-700 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-500 font-orbitron">
                        <AlertTriangle className="h-6 w-6" />
                        MISE À JOUR REQUISE
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 font-rajdhani text-lg">
                        Le téléchargement des données officielles a été initié.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <Alert className="bg-amber-950/30 border-amber-600 text-amber-200">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Action requise</AlertTitle>
                        <AlertDescription>
                            N'oubliez pas de téléverser le fichier <strong>.csv</strong> que vous venez de télécharger pour appliquer la mise à jour.
                        </AlertDescription>
                    </Alert>

                    {/* Drag and Drop Zone */}
                    <div 
                        className={cn(
                            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors gap-3",
                            dragActive ? "border-green-500 bg-green-500/10" : "border-zinc-700 hover:border-zinc-500 bg-black/20"
                        )}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className={cn("h-10 w-10", dragActive ? "text-green-400" : "text-zinc-500")} />
                        <div className="space-y-1">
                            <p className="font-bold text-zinc-300">Cliquez ou glissez le fichier ici</p>
                            <p className="text-sm text-zinc-500">Format CSV uniquement</p>
                        </div>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            className="hidden" 
                            accept=".csv"
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setShowUpdateModal(false)} className="text-zinc-400 hover:text-white">
                        Fermer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* MODAL DE VICTOIRE - Grand écran GAGNÉ */}
        <Dialog open={showWinModal} onOpenChange={setShowWinModal}>
            <DialogContent className="bg-gradient-to-br from-yellow-900 via-amber-900 to-yellow-800 border-4 border-casino-gold text-white sm:max-w-2xl shadow-[0_0_100px_rgba(255,215,0,0.5)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,215,0,0.2)_0%,_transparent_70%)] pointer-events-none" />
                
                <div className="relative z-10 text-center py-8">
                    {/* Icône trophée animée */}
                    <div className="flex justify-center mb-6">
                        <Trophy className="w-24 h-24 text-casino-gold animate-bounce drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]" />
                    </div>
                    
                    {/* Grand titre GAGNÉ */}
                    <h1 className="text-6xl md:text-8xl font-black font-orbitron text-casino-gold mb-4 animate-pulse drop-shadow-[0_0_20px_rgba(255,215,0,1)]">
                        GAGNÉ !
                    </h1>
                    
                    <p className="text-2xl text-yellow-200 mb-8 font-rajdhani">
                        🎉 Félicitations ! Vous avez des grilles gagnantes ! 🎉
                    </p>
                    
                    {/* Liste des grilles gagnantes */}
                    <div className="space-y-4 max-h-[300px] overflow-y-auto px-4">
                        {winningGrids.map((item, index) => (
                            <div key={index} className="bg-black/40 rounded-xl p-4 border border-casino-gold/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-lg font-bold text-white">{item.result.status}</span>
                                    <span className="text-2xl font-black text-casino-gold">
                                        {item.result.gain.toLocaleString()} €
                                    </span>
                                </div>
                                <div className="flex justify-center gap-2">
                                    {item.grid.numeros.map(n => (
                                        <LottoBall key={`win-n-${n}`} number={n} size="sm" />
                                    ))}
                                    <div className="w-px bg-zinc-600 mx-1" />
                                    {item.grid.etoiles.map(n => (
                                        <LottoBall key={`win-s-${n}`} number={n} isStar size="sm" />
                                    ))}
                                </div>
                                <div className="mt-2 text-sm text-yellow-300">
                                    {item.result.matchNum} numéros + {item.result.matchStar} étoiles
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* Total des gains */}
                    {winningGrids.length > 1 && (
                        <div className="mt-6 pt-4 border-t border-casino-gold/50">
                            <span className="text-xl text-yellow-200">Total des gains : </span>
                            <span className="text-3xl font-black text-casino-gold">
                                {winningGrids.reduce((sum, item) => sum + item.result.gain, 0).toLocaleString()} €
                            </span>
                        </div>
                    )}
                    
                    <Button 
                        onClick={() => setShowWinModal(false)}
                        className="mt-8 bg-casino-gold hover:bg-yellow-500 text-black font-bold text-xl px-8 py-6"
                    >
                        🎊 SUPER ! 🎊
                    </Button>
                </div>
            </DialogContent>
        </Dialog>

        {/* TABLEAU AVEC STYLE "MES GRILLES JOUÉES" */}
        <div className="w-full mb-16">
            
            {/* BARRE D'OUTILS : Filtre à gauche, Actualiser à droite - Même largeur que DERNIER TIRAGE */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-zinc-900/50 border border-zinc-700 rounded-xl p-4 mb-6">
                
                {/* FILTRE DE DATES + CSV - À gauche */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-zinc-400 text-sm font-rajdhani font-bold">PÉRIODE :</span>
                    <input 
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-casino-gold"
                    />
                    <span className="text-zinc-500 text-sm">→</span>
                    <input 
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-casino-gold"
                    />
                    {/* Bouton Télécharger CSV */}
                    <button 
                        onClick={handleDownloadCSV}
                        className="bg-green-900/80 hover:bg-green-700 text-green-200 border border-green-500 rounded-lg px-4 py-1.5 shadow-[0_0_10px_rgba(34,197,94,0.3)] transition-all hover:scale-105 flex items-center gap-2 group ml-2"
                        title="Télécharger l'historique filtré en CSV"
                    >
                        <Download size={18} className="group-hover:animate-bounce" />
                        <span className="font-bold font-rajdhani text-sm">
                            TÉLÉCHARGER CSV
                        </span>
                    </button>
                </div>
                
                {/* BOUTON ACTUALISER - À droite */}
                {user?.role === 'admin' && (
                    <button 
                        onClick={() => handleUpdateAction(true)}
                        className={cn(
                            "border rounded-lg px-5 py-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all hover:scale-105 flex items-center gap-2",
                            (isBlinking || updateNeeded)
                                ? "bg-red-600 hover:bg-red-500 border-red-400 text-white animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.7)]" 
                                : "bg-zinc-800/80 hover:bg-zinc-700 border-zinc-600 text-zinc-300"
                        )}
                        title={updateNeeded ? "Mise à jour requise - Cliquez pour mettre à jour" : "Mettre à jour l'historique"}
                    >
                        <RefreshCw className={cn("h-5 w-5", (isBlinking || updateNeeded) && "animate-spin")} />
                        <span className="font-bold font-rajdhani">
                            {updateNeeded ? "MISE À JOUR REQUISE" : "ACTUALISER"}
                        </span>
                    </button>
                )}
            </div>
            
            {/* DERNIER TIRAGE - Centré au-dessus du tableau */}
            {lastDraw && (
                <div className="mb-6 bg-gradient-to-r from-zinc-900 via-black to-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-xl">
                    <div className="text-center">
                        <h2 className="font-orbitron text-blue-400 text-sm tracking-widest uppercase mb-2">
                            DERNIER TIRAGE
                        </h2>
                        <p className="text-zinc-400 text-xs mb-3 font-rajdhani">
                            {lastDraw.date && !isNaN(new Date(lastDraw.date).getTime()) 
                                ? format(new Date(lastDraw.date), 'EEEE d MMMM yyyy', { locale: fr })
                                : lastDraw.date || 'Date inconnue'}
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {lastDraw.numeros.map((n) => (
                                <LottoBall key={`last-n-${n}`} number={n} size="sm" />
                            ))}
                            <div className="w-px bg-zinc-600 mx-1" />
                            {lastDraw.etoiles.map((n) => (
                                <LottoBall key={`last-s-${n}`} number={n} isStar size="sm" />
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black text-zinc-400 text-sm md:text-base uppercase font-orbitron tracking-wider border-b border-zinc-700">
                                <th className="p-3">Date</th>
                                <th className="p-3 text-center">Numéros</th>
                                <th className="p-3 text-center">Étoiles</th>
                            </tr>
                        </thead>
                        <tbody className="font-rajdhani text-base md:text-lg">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={3} className="p-12 text-center text-zinc-500 font-orbitron text-xl">
                                        CHARGEMENT DE L'HISTORIQUE...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-12 text-center text-zinc-500 font-orbitron text-xl">
                                        AUCUNE DONNÉE DISPONIBLE
                                    </td>
                                </tr>
                            ) : (
                                history.map((draw, idx) => (
                                    <tr 
                                        key={`${draw.date}-${idx}`} 
                                        className={`border-b border-zinc-800 transition-colors hover:bg-white/5 ${idx % 2 === 0 ? "bg-zinc-900/50" : "bg-zinc-900/30"}`}
                                    >
                                        <td className="p-3 text-white font-bold whitespace-nowrap text-lg">
                                            {new Date(draw.date).toLocaleDateString('fr-FR', {
                                                weekday: 'short',
                                                day: '2-digit', 
                                                month: '2-digit', 
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-center gap-1 md:gap-2">
                                                {draw.numeros.map((n, i) => (
                                                    <LottoBall key={`num-${idx}-${i}`} number={n} size="sm" />
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-center gap-1 md:gap-2">
                                                {draw.etoiles.map((n, i) => (
                                                    <LottoBall key={`star-${idx}-${i}`} number={n} isStar size="sm" />
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Légende et statistiques */}
            <div className="mt-6 flex justify-center gap-8 text-sm text-zinc-500 font-rajdhani">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_0_5px_rgba(59,130,246,0.8)]" />
                    <span>Numéros (1-50)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-casino-gold shadow-[0_0_5px_rgba(255,215,0,0.8)]" />
                    <span>Étoiles (1-12)</span>
                </div>
                {history.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-400">Total :</span>
                        <span className="text-casino-gold font-bold">{history.length} tirages</span>
                    </div>
                )}
            </div>
        </div>
      </div>
    </CasinoLayout>
  );
}
