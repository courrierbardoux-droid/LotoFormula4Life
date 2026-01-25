
import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import { chargerHistorique, Tirage, mettreAJourCache, getDernierTirage, verifierMiseAJourNecessaire, viderCache } from '@/lib/lotoService';
import { useUser } from '@/lib/UserContext';
import { Download, Upload, AlertTriangle, RefreshCw, FileText, CheckCircle, Trash2, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LottoBall } from '@/components/casino/LottoBall';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function History() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [history, setHistory] = useState<Tirage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlinking, setIsBlinking] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateNeeded, setUpdateNeeded] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoUpdateTriggered = useRef(false);

  // Mode de mise à jour (AUTO / MANUEL) — stocké côté serveur (pas dans le navigateur)
  const [historyUpdateMode, setHistoryUpdateMode] = useState<'auto' | 'manual'>('auto');
  const [isAutoUpdating, setIsAutoUpdating] = useState(false);
  const [autoUpdateTime, setAutoUpdateTime] = useState<string>('22:00');
  const [isSavingAutoUpdateTime, setIsSavingAutoUpdateTime] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    (async () => {
      try {
        const res = await fetch('/api/history/update-mode', { credentials: 'include' });
        const data = await res.json().catch(() => ({} as any));
        if (data?.mode === 'manual' || data?.mode === 'auto') setHistoryUpdateMode(data.mode);
      } catch {
        // ignore (fallback auto)
      }
    })();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    (async () => {
      try {
        const res = await fetch('/api/history/auto-update/schedule', { credentials: 'include' });
        const data = await res.json().catch(() => ({} as any));
        if (typeof data?.time === 'string' && /^\d{2}:\d{2}$/.test(data.time)) {
          setAutoUpdateTime(data.time);
        }
      } catch {
        // ignore (fallback 22:00)
      }
    })();
  }, [user?.role]);
  
  // État pour le filtre de dates CSV
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // État pour le nombre de tirages affichés
  const [drawsToShow, setDrawsToShow] = useState<number>(10);

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

  const setUpdateMode = async (mode: 'auto' | 'manual') => {
    setHistoryUpdateMode(mode);
    try {
      await fetch('/api/history/update-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode }),
      });
    } catch {
      // ignore
    }
  };

  const saveAutoUpdateTime = async (time: string) => {
    if (user?.role !== 'admin') return;
    setAutoUpdateTime(time);
    setIsSavingAutoUpdateTime(true);
    try {
      const res = await fetch('/api/history/auto-update/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ time }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.success) {
        toast.error(String(data?.error || 'Heure invalide'));
        return;
      }
      toast.success(`Heure de mise à jour enregistrée : ${time}`);
    } catch {
      toast.error('Erreur sauvegarde heure de mise à jour');
    } finally {
      setIsSavingAutoUpdateTime(false);
    }
  };

  const handleAdminRefreshClick = async () => {
    if (historyUpdateMode === 'manual') {
      handleUpdateAction(true);
      return;
    }
    try {
      setIsAutoUpdating(true);
      setIsBlinking(true);
      const res = await fetch('/api/history/auto-update/run', { method: 'POST', credentials: 'include' });
      const dataText = await res.text().catch(() => '');
      const data = (() => { try { return JSON.parse(dataText || '{}'); } catch { return {} as any; } })();
      if (!res.ok || !data?.success) {
        const msg = String(data?.error || 'Échec mise à jour automatique');
        toast.error(msg);
        return;
      }
      toast.success('Mise à jour automatique effectuée');
      // Recharger l'historique depuis la source habituelle
      const refreshed = await chargerHistorique();
      setHistory(refreshed);
      mettreAJourCache(refreshed);
      const dernierTirage = getDernierTirage(refreshed);
      const verif = verifierMiseAJourNecessaire(dernierTirage);
      setUpdateNeeded(verif.necessaire);
    } catch (e) {
      toast.error("Échec mise à jour automatique");
    } finally {
      setIsAutoUpdating(false);
      setIsBlinking(false);
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
          const normalizeDate = (raw: string): string => {
            const s = (raw || '').trim();
            const base = s.includes('T') ? s.split('T')[0] : s.includes(' ') ? s.split(' ')[0] : s;
            // YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
            // DD/MM/YYYY or DD-MM-YYYY -> YYYY-MM-DD
            const m = base.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
            if (m) {
              const dd = m[1].padStart(2, '0');
              const mm = m[2].padStart(2, '0');
              const yyyy = m[3];
              return `${yyyy}-${mm}-${dd}`;
            }
            return base;
          };

          // Parse CSV simply to update state
          const lines = text.trim().split('\n');
          const newTirages: Tirage[] = [];
          let badRows = 0;
          let nanValues = 0;
          
          // Skip header
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(';');
            if (cols.length < 8) { badRows++; continue; }
            
            // Flexible date parsing attempt
            const dateStr = normalizeDate(cols[0]);
            // If date contains full timestamp, keep it or clean it? keeping it simple for now
            
            const nums = [
              parseInt(cols[1]), parseInt(cols[2]), parseInt(cols[3]), parseInt(cols[4]), parseInt(cols[5])
            ];
            const stars = [parseInt(cols[6]), parseInt(cols[7])];
            if (nums.some(n => Number.isNaN(n)) || stars.some(n => Number.isNaN(n))) nanValues++;

            newTirages.push({
              date: dateStr,
              numeros: nums.sort((a, b) => a - b),
              etoiles: stars.sort((a, b) => a - b)
            });
          }
          
          // Sort descending
          newTirages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          // Merge: le CSV uploadé peut être partiel (ex: uniquement l'année en cours).
          // On fusionne avec l'historique existant (en mémoire) pour éviter de "réduire" l'historique à 5 lignes.
          const baseHistory = history.length > 0 ? history : await chargerHistorique();
          const baseByDate = new Map<string, Tirage>();
          baseHistory.forEach(t => baseByDate.set(normalizeDate(t.date), { ...t, date: normalizeDate(t.date) }));
          const beforeLen = baseByDate.size;
          newTirages.forEach(t => baseByDate.set(normalizeDate(t.date), { ...t, date: normalizeDate(t.date) }));
          const mergedTirages = Array.from(baseByDate.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const mergedLen = mergedTirages.length;
          const addedCount = Math.max(0, mergedLen - beforeLen);

          mettreAJourCache(mergedTirages); // Mise à jour globale pour que les stats (Console) en profitent aussi
          setHistory(mergedTirages);
          setUpdateNeeded(false); // Réinitialiser l'état de mise à jour
          
          // Déterminer le dernier tirage (pour validation / synchro DB)
          const dernierTirage = getDernierTirage(mergedTirages);
          
          // ===== SYNC AVEC BASE DE DONNÉES (Admin uniquement) =====
          if (user?.role === 'admin') {
            try {
              // 1. Mettre à jour la base de données avec les nouveaux tirages
              const baseHistory = history.length > 0 ? history : await chargerHistorique();
              const normalizeDateForDiff = (raw: string) => normalizeDate(raw);
              const baseByDate = new Map<string, { numeros: number[]; etoiles: number[] }>();
              baseHistory.forEach((t) => {
                baseByDate.set(normalizeDateForDiff(t.date), {
                  numeros: Array.isArray((t as any).numeros) ? (t as any).numeros : [],
                  etoiles: Array.isArray((t as any).etoiles) ? (t as any).etoiles : [],
                });
              });

              const sameArr = (a: number[], b: number[]) =>
                a.length === b.length && a.every((v, i) => v === b[i]);

              // IMPORTANT: envoyer aussi les dates existantes si numéros/étoiles changent
              const toSend = newTirages.filter((t) => {
                const key = normalizeDateForDiff(t.date);
                const base = baseByDate.get(key);
                if (!base) return true;
                const nums = Array.isArray((t as any).numeros) ? (t as any).numeros : [];
                const stars = Array.isArray((t as any).etoiles) ? (t as any).etoiles : [];
                return !sameArr(base.numeros, nums) || !sameArr(base.etoiles, stars);
              });

              if (toSend.length === 0) {
                toast.warning("Aucun tirage nouveau/modifié dans ce fichier (rien à écrire en base).");
              }

              const syncRes = await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tirages: toSend }),
              });
              const syncData = await syncRes.json();
              
              if (syncData.success) {
                console.log(`[History] DB sync: ${syncData.processed ?? syncData.inserted ?? 0} traités`);
              }
              
              // Recharger les données depuis la DB pour être sûr d'avoir les dernières
              const refreshRes = await fetch('/api/history', { credentials: 'include' });
              if (refreshRes.ok) {
                const refreshedData = await refreshRes.json();
                setHistory(refreshedData);
                mettreAJourCache(refreshedData);
              }
              
              toast.success("Historique et base de données mis à jour !");
            } catch (syncErr) {
              console.error('[History] Erreur sync DB:', syncErr);
              toast.warning("Historique local mis à jour, mais erreur sync DB");
            }
          } else {
            toast.success("Historique mis à jour avec succès !");
          }
          
          setShowUpdateModal(false);
          
          // IMPORTANT: ne pas recharger la page automatiquement.
          // La validation/fermeture de la modal de victoire doit être manuelle.
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

  // Fonction de téléchargement CSV depuis la base de données
  const handleDownloadCSV = async () => {
    try {
      // Construire l'URL avec les paramètres de dates
      let url = '/api/history/download';
      const params = new URLSearchParams();
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      if (params.toString()) url += '?' + params.toString();
      
      // Télécharger depuis l'API (DB)
      const response = await fetch(url, { credentials: 'include' });
      
      if (!response.ok) {
        // Fallback sur les données locales si l'API échoue
        toast.warning("API indisponible, téléchargement depuis les données locales...");
        downloadFromLocalData();
        return;
      }
      
      // Récupérer le blob et télécharger
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Extraire le nom du fichier depuis le header Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'historique_euromillions.csv';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast.success("Téléchargement depuis la base de données !");
    } catch (error) {
      console.error("Erreur téléchargement:", error);
      toast.warning("Erreur API, téléchargement local...");
      downloadFromLocalData();
    }
  };

  // Téléchargement explicite "complet" (sans filtre) pour vérification / sauvegarde
  const handleDownloadCSVFull = async () => {
    const prevFrom = dateFrom;
    const prevTo = dateTo;
    try {
      setDateFrom('');
      setDateTo('');
      await handleDownloadCSV();
    } finally {
      // Restaurer l'UI (ne pas forcer l'utilisateur à perdre ses filtres)
      setDateFrom(prevFrom);
      setDateTo(prevTo);
    }
  };
  
  // Fallback: téléchargement depuis les données en mémoire
  const downloadFromLocalData = () => {
    if (history.length === 0) {
      toast.error("Aucune donnée à télécharger");
      return;
    }

    let filteredHistory = [...history];
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filteredHistory = filteredHistory.filter(t => {
        const tirageDate = parseHistoryDate(t.date);
        return tirageDate && tirageDate >= fromDate;
      });
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filteredHistory = filteredHistory.filter(t => {
        const tirageDate = parseHistoryDate(t.date);
        return tirageDate && tirageDate <= toDate;
      });
    }
    
    if (filteredHistory.length === 0) {
      toast.error(`Aucun tirage trouvé pour cette période`);
      return;
    }

    const header = "Date;N1;N2;N3;N4;N5;E1;E2";
    const rows = filteredHistory.map(tirage => {
      const tirageDate = parseHistoryDate(tirage.date);
      const dateFormatted = tirageDate ? tirageDate.toLocaleDateString('fr-FR') : tirage.date;
      return `${dateFormatted};${tirage.numeros.join(';')};${tirage.etoiles.join(';')}`;
    });
    
    const csvContent = [header, ...rows].join('\n');
    let filename = `historique_euromillions_${dateFrom || 'debut'}_${dateTo || 'fin'}.csv`;
    
    const csvData = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csvContent);
    const link = document.createElement('a');
    link.href = csvData;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`${filteredHistory.length} tirages téléchargés (local) !`);
  };

  // Obtenir le dernier tirage pour l'affichage
  const lastDraw = history.length > 0 ? history[0] : null;
  const oldestDraw = history.length > 0 ? history[history.length - 1] : null;

  // Verrou de sécurité pour éviter les suppressions accidentelles
  const [isDeleteUnlocked, setIsDeleteUnlocked] = useState(false);

  const handleDeleteDraw = async (rawDate: string) => {
    if (user?.role !== 'admin') return;
    if (!isDeleteUnlocked) {
      toast.error("Suppression verrouillée. Déverrouillez le cadenas d'abord.");
      return;
    }
    const dateIso = String(rawDate).split('T')[0].split(' ')[0];
    const ok = window.confirm(`Supprimer définitivement le tirage du ${dateIso} ?\n\nCette action retire le tirage de la base (et ses gains/infos associées).`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(dateIso)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.success) {
        toast.error(String(data?.error || 'Suppression impossible'));
        return;
      }
      toast.success(`Tirage ${dateIso} supprimé`);
      viderCache();
      const refreshed = await chargerHistorique();
      setHistory(refreshed);
      mettreAJourCache(refreshed);
    } catch (e: any) {
      toast.error(String(e?.message || e || 'Erreur suppression'));
    }
  };

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
        {/* (Gagnants) : toutes les modales/notifications "gagnant" sont supprimées */}

        {/* TABLEAU AVEC STYLE "MES GRILLES JOUÉES" */}
        <div className="w-full mb-16">
            
            {/* BARRE D'OUTILS — 2 lignes pour éviter la largeur inutile */}
            <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-4 mb-6">
                {/* LIGNE 1 : période + export */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
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
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleDownloadCSVFull}
                            className="bg-emerald-900/80 hover:bg-emerald-700 text-emerald-100 border border-emerald-500 rounded-lg px-4 py-1.5 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all hover:scale-105 flex items-center gap-2 group"
                            title="Télécharger l'historique COMPLET en CSV (sauvegarde)"
                        >
                            <Download size={18} className="group-hover:animate-bounce" />
                            <span className="font-bold font-rajdhani text-sm">CSV COMPLET</span>
                        </button>
                        <button
                            onClick={handleDownloadCSV}
                            className="bg-green-900/80 hover:bg-green-700 text-green-200 border border-green-500 rounded-lg px-4 py-1.5 shadow-[0_0_10px_rgba(34,197,94,0.3)] transition-all hover:scale-105 flex items-center gap-2 group"
                            title="Télécharger l'historique filtré (dates) en CSV"
                        >
                            <Download size={18} className="group-hover:animate-bounce" />
                            <span className="font-bold font-rajdhani text-sm">CSV FILTRÉ</span>
                        </button>
                    </div>
                </div>

                {/* LIGNE 2 : résumé + actualiser */}
                <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-zinc-400 text-sm font-rajdhani flex flex-wrap items-center gap-3">
                        <span className="font-bold text-zinc-300">TIRAGES :</span>
                        <span className="font-mono text-zinc-200">{history.length}</span>
                        {oldestDraw?.date && lastDraw?.date && (
                            <span className="text-zinc-500">
                                (de <span className="font-mono text-zinc-300">{String(oldestDraw.date).split('T')[0].split(' ')[0]}</span> à{' '}
                                <span className="font-mono text-zinc-300">{String(lastDraw.date).split('T')[0].split(' ')[0]}</span>)
                            </span>
                        )}
                    </div>
                </div>

                {/* LIGNE 3 : planification + switch + actualiser */}
                {user?.role === 'admin' && (
                  <div className="mt-2 pt-2 border-t border-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-zinc-300 font-rajdhani">
                      <span className="text-zinc-400 text-sm font-bold">Mise à jour mardi et vendredi à :</span>
                      <input
                        type="time"
                        value={autoUpdateTime}
                        onChange={(e) => setAutoUpdateTime(e.target.value)}
                        onBlur={() => saveAutoUpdateTime(autoUpdateTime)}
                        className={cn(
                          "bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-casino-gold",
                          isSavingAutoUpdateTime && "opacity-70"
                        )}
                        title="Heure de démarrage AUTO (fenêtre de retry ~90 minutes)"
                      />
                      <span className="text-zinc-500 text-xs">
                        (retry ~90 min)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Toggle AUTO / MANUEL (à gauche de ACTUALISER) */}
                      <div className="flex items-center gap-2 select-none">
                        <span className={cn(
                          "text-xs font-orbitron tracking-widest",
                          historyUpdateMode === 'manual' ? "text-red-400" : "text-white/40"
                        )}>
                          MANUEL
                        </span>
                        <Switch
                          checked={historyUpdateMode === 'auto'}
                          onCheckedChange={(checked) => setUpdateMode(checked ? 'auto' : 'manual')}
                          className={cn(
                            "data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-red-600/60"
                          )}
                          aria-label="Mode mise à jour historique (AUTO/MANUEL)"
                        />
                        <span className={cn(
                          "text-xs font-orbitron tracking-widest",
                          historyUpdateMode === 'auto' ? "text-green-400" : "text-white/40"
                        )}>
                          AUTO
                        </span>
                      </div>

                      <button
                        onClick={handleAdminRefreshClick}
                        className={cn(
                          "border rounded-lg px-5 py-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all hover:scale-105 flex items-center gap-2",
                          (historyUpdateMode === 'manual' && (isBlinking || updateNeeded))
                            ? "bg-red-600 hover:bg-red-500 border-red-400 text-white animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.7)]"
                            : (historyUpdateMode === 'auto' && isAutoUpdating)
                              ? "bg-green-600 hover:bg-green-500 border-green-400 text-white animate-pulse shadow-[0_0_20px_rgba(34,197,94,0.7)]"
                              : "bg-zinc-800/80 hover:bg-zinc-700 border-zinc-600 text-zinc-300"
                        )}
                        disabled={historyUpdateMode === 'auto' && isAutoUpdating}
                        title={
                          historyUpdateMode === 'manual'
                            ? (updateNeeded ? "Mise à jour requise - Cliquez pour mettre à jour (mode MANUEL)" : "Mettre à jour l'historique (mode MANUEL)")
                            : (isAutoUpdating ? "Mise à jour automatique en cours..." : "Mode AUTO (sans pop-up)")
                        }
                      >
                        <RefreshCw className={cn("h-5 w-5", ((historyUpdateMode === 'manual' && (isBlinking || updateNeeded)) || (historyUpdateMode === 'auto' && isAutoUpdating)) && "animate-spin")} />
                        <span className="font-bold font-rajdhani">
                          {updateNeeded ? "MISE À JOUR REQUISE" : "ACTUALISER"}
                        </span>
                      </button>
                    </div>
                  </div>
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
                                {user?.role === 'admin' && (
                                  <th className="p-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setIsDeleteUnlocked((v) => !v)}
                                      className={cn(
                                        "inline-flex items-center justify-center px-2 py-1 rounded-md border transition-colors",
                                        isDeleteUnlocked
                                          ? "bg-emerald-950/30 border-emerald-700 text-emerald-200 hover:bg-emerald-900/40"
                                          : "bg-zinc-900/40 border-zinc-700 text-zinc-300 hover:bg-zinc-800/50"
                                      )}
                                      title={isDeleteUnlocked ? "Suppression déverrouillée (cliquer pour verrouiller)" : "Suppression verrouillée (cliquer pour déverrouiller)"}
                                    >
                                      {isDeleteUnlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                    </button>
                                  </th>
                                )}
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
                                history.slice(0, drawsToShow).map((draw, idx) => (
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
                                        {user?.role === 'admin' && (
                                          <td className="p-3 text-right">
                                            <button
                                              onClick={() => handleDeleteDraw(draw.date)}
                                              disabled={!isDeleteUnlocked}
                                              className={cn(
                                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
                                                isDeleteUnlocked
                                                  ? "bg-red-950/40 hover:bg-red-900/50 border-red-800 text-red-200"
                                                  : "bg-zinc-900/30 border-zinc-800 text-zinc-600 opacity-60 cursor-not-allowed"
                                              )}
                                              title={isDeleteUnlocked ? "Supprimer ce tirage (test)" : "Déverrouillez le cadenas pour activer la suppression"}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                              <span className="font-bold text-sm">Supprimer</span>
                                            </button>
                                          </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Boutons 10/20/50 tirages */}
            <div className="flex justify-center gap-2 mt-4">
              <span className="text-zinc-500 font-rajdhani self-center mr-2">Afficher :</span>
              {[10, 20, 50].map(num => (
                <button
                  key={num}
                  onClick={() => setDrawsToShow(num)}
                  className={cn(
                    "px-4 py-2 rounded-lg font-rajdhani font-bold transition-all",
                    drawsToShow === num
                      ? "bg-casino-gold text-black shadow-[0_0_10px_rgba(255,215,0,0.5)]"
                      : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-600"
                  )}
                >
                  {num}
                </button>
              ))}
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
                        <span className="text-zinc-400">Affiché :</span>
                        <span className="text-casino-gold font-bold">
                          {Math.min(drawsToShow, history.length)}/{history.length} tirages
                        </span>
                    </div>
                )}
            </div>
        </div>
      </div>
    </CasinoLayout>
  );
}
