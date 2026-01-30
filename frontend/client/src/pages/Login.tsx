
import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { CasinoButton } from "@/components/casino/CasinoButton";
import { LottoBall } from "@/components/casino/LottoBall";
import { motion } from "framer-motion";
import { useUser } from "@/lib/UserContext";
import { Eye, EyeOff, Calendar, Clock, Timer, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getDernierTirage, chargerHistorique, Tirage, verifierMiseAJourNecessaire, hasUnseenWins, hasAdminUnseenWins } from "@/lib/lotoService";
import { toast } from "sonner";

// Composant Countdown intégré
const CountdownTimer = () => {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [nextDrawDate, setNextDrawDate] = useState<Date | null>(null);
  const [dayName, setDayName] = useState("");

  const getProchainTirage = () => {
    const now = new Date();
    const jourSemaine = now.getDay();
    const heure = now.getHours();
    const minutes = now.getMinutes();
    
    let prochainTirage = new Date(now);
    
    if (jourSemaine === 1) { prochainTirage.setDate(now.getDate() + 1); }
    else if (jourSemaine === 2) {
      if (heure < 20 || (heure === 20 && minutes < 15)) { prochainTirage.setDate(now.getDate()); }
      else { prochainTirage.setDate(now.getDate() + 3); }
    } else if (jourSemaine === 3) { prochainTirage.setDate(now.getDate() + 2); }
    else if (jourSemaine === 4) { prochainTirage.setDate(now.getDate() + 1); }
    else if (jourSemaine === 5) {
      if (heure < 20 || (heure === 20 && minutes < 15)) { prochainTirage.setDate(now.getDate()); }
      else { prochainTirage.setDate(now.getDate() + 4); }
    } else if (jourSemaine === 6) { prochainTirage.setDate(now.getDate() + 3); }
    else if (jourSemaine === 0) { prochainTirage.setDate(now.getDate() + 2); }
    
    prochainTirage.setHours(20, 15, 0, 0);
    return prochainTirage;
  };

  useEffect(() => {
    const updateCountdown = () => {
      const target = getProchainTirage();
      setNextDrawDate(target);
      const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      setDayName(jours[target.getDay()]);
      
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({ days, hours, minutes, seconds });
      }
    };
    
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatNumber = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Date du tirage */}
      <div className="flex items-center gap-2 text-casino-gold">
        <Calendar size={22} />
        <span className="font-orbitron text-lg tracking-wider">
          {dayName} {nextDrawDate?.getDate()} {nextDrawDate && format(nextDrawDate, 'MMMM yyyy', { locale: fr })}
        </span>
      </div>
      
      {/* Countdown boxes */}
      <div className="flex gap-2">
        {[
          { value: countdown.days, label: 'JOURS' },
          { value: countdown.hours, label: 'HEURES' },
          { value: countdown.minutes, label: 'MIN' },
          { value: countdown.seconds, label: 'SEC' },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="bg-black border border-casino-gold/50 rounded px-3 py-2 min-w-[58px]">
              <span className="font-mono text-2xl font-bold text-red-500 tabular-nums">
                {formatNumber(item.value)}
              </span>
            </div>
            <span className="text-[11px] text-white font-orbitron mt-1">{item.label}</span>
          </div>
        ))}
      </div>
      
      {/* Clôture */}
      <div className="flex items-center gap-2 text-white text-[13px]">
        <Clock size={16} />
        <span className="font-rajdhani">Clôture des jeux : 20h15</span>
      </div>
    </div>
  );
};

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, register, allUsers } = useUser();
  const [username, setUsername] = useState("AntoAbso");
  const [password, setPassword] = useState("AntoAbso");
  const [selectedPresetUser, setSelectedPresetUser] = useState("");

  useEffect(() => {
    if (selectedPresetUser) {
        setUsername(selectedPresetUser);
        if (selectedPresetUser === "Guest123") {
            setPassword("guest");
        } else if (selectedPresetUser === "AntoAbso") {
            setPassword("AntoAbso");
        } else {
            setPassword("");
        }
    }
  }, [selectedPresetUser]);
  
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteCodeError, setInviteCodeError] = useState("");
  const [lastDraw, setLastDraw] = useState<Tirage | null>(null);
  const [updateNeeded, setUpdateNeeded] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");

  useEffect(() => {
    const loadDraw = async () => {
        const history = await chargerHistorique();
        const latest = getDernierTirage(history);
        setLastDraw(latest);
        
        // Vérifier si une mise à jour est nécessaire
        const verif = verifierMiseAJourNecessaire(latest);
        if (verif.necessaire) {
          setUpdateNeeded(true);
          setUpdateMessage(verif.message);
          console.log("[Login] Mise à jour nécessaire:", verif.message);
        }
    };
    loadDraw();
  }, []);

  // Fonction pour rediriger après login
  // Logique de redirection :
  // - Admin avec gains perso → /my-grids?wins=1 (et stocke qu'il y a des gains utilisateurs à voir)
  // - Admin sans gains perso mais gains utilisateurs → /settings/users/history?wins=1
  // - Non-admin avec gains → /my-grids?wins=1
  // - Sinon → /dashboard
  const redirectAfterLogin = async () => {
    // Vérifier les gains personnels
    const myUnseen = await hasUnseenWins();
    
    // Récupérer le rôle de l'utilisateur connecté
    let isAdmin = false;
    try {
      const meRes = await fetch('/api/auth/me', { credentials: 'include' });
      const meData = await meRes.json();
      isAdmin = meData?.user?.role === 'admin';
    } catch {
      // ignore
    }

    if (isAdmin) {
      // Vérifier les gains des utilisateurs (non vus par l'admin)
      const usersUnseen = await hasAdminUnseenWins();
      
      if (myUnseen) {
        // Admin a des gains perso → d'abord ses grilles, puis on stocke qu'il y a des gains utilisateurs
        if (usersUnseen) {
          sessionStorage.setItem('pendingAdminWinsRedirect', '1');
        }
        setLocation("/my-grids?wins=1");
      } else if (usersUnseen) {
        // Admin n'a pas de gains perso mais des gains utilisateurs
        setLocation("/settings/users/history?wins=1");
      } else {
        setLocation("/dashboard");
      }
    } else {
      // Non-admin
      setLocation(myUnseen ? "/my-grids?wins=1" : "/dashboard");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const success = await login(username, password);
      if (success) {
        await redirectAfterLogin();
      } else {
        setError("Identifiant ou mot de passe incorrect");
      }
    } catch (err) {
      setError("Erreur de connexion. Veuillez réessayer.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setInviteCodeError("");
      
      if (password !== confirmPassword) {
          setError("Les mots de passe ne correspondent pas");
          return;
      }
      if (username && email && password) {
          try {
            const result = await register(username, email, password, inviteCode || undefined);
            if (result.success) {
              const roleMsg = inviteCode ? " Votre code a été validé !" : "";
              setSuccessMsg(`Compte créé avec succès !${roleMsg} Vous pouvez vous connecter.`);
              setTimeout(() => { setSuccessMsg(""); }, 10000);
              setIsRegistering(false);
              setUsername("");
              setPassword("");
              setConfirmPassword("");
              setEmail("");
              setInviteCode("");
              setError("");
            } else {
              // Afficher l'erreur sur le bon champ
              if (result.field === 'inviteCode') {
                setInviteCodeError(result.error || "Code invalide");
              } else {
                setError(result.error || "Erreur lors de la création du compte.");
              }
            }
          } catch (err) {
            setError("Erreur lors de la création du compte.");
          }
      }
  };

  return (
    <CasinoLayout>
      <div className="flex flex-col items-center justify-between min-h-screen px-7 pt-20 pb-7">
        
        {/* ═══════════════ HEADER ═══════════════ */}
        <motion.header 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center w-full"
        >
          {/* Titre principal avec effet */}
          <h1 className="text-4xl md:text-5xl font-orbitron font-black tracking-wider mb-1">
            <span className="bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
              LOTOFORMULA4LIFE
            </span>
          </h1>
          <p className="text-sm md:text-base font-orbitron text-zinc-200 tracking-[0.3em] uppercase mb-3">
            Statistiques & Prédictibilités
          </p>
          
          {/* Ligne décorative */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="h-px w-24 bg-gradient-to-r from-transparent to-casino-gold" />
            <div className="w-2.5 h-2.5 rotate-45 bg-casino-gold" />
            <div className="h-px w-24 bg-gradient-to-l from-transparent to-casino-gold" />
          </div>
          
          {/* Citation */}
          <p className="text-base md:text-lg font-rajdhani text-white italic max-w-2xl mx-auto">
            "Il n'y a pas de hasard. Seulement des probabilités qui attendent leur moment."
          </p>
        </motion.header>

        {/* ═══════════════ SECTION CENTRALE ═══════════════ */}
        <motion.main 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="w-full max-w-7xl flex-1 flex flex-col justify-center gap-4 py-4"
        >
          {/* Grid 3 colonnes : Prochain Tirage | Connexion | Dernier Tirage */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            
            {/* ─── PROCHAIN TIRAGE ─── */}
            <div className="relative bg-gradient-to-br from-zinc-900 via-black to-zinc-900 border border-zinc-700 rounded-xl p-6 overflow-hidden group hover:border-casino-gold/50 transition-colors duration-300 min-w-[300px]">
              {/* Accent top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-casino-gold via-yellow-300 to-casino-gold" />
              
              <div className="flex items-center justify-center gap-2 mb-4">
                <Timer size={22} className="text-casino-gold" />
                <h2 className="font-orbitron text-casino-gold text-base tracking-widest uppercase">
                  Prochain Tirage
                </h2>
              </div>
              
              <CountdownTimer />
            </div>

            {/* ─── FORMULAIRE DE CONNEXION ─── */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="relative bg-gradient-to-br from-zinc-900/95 via-black/95 to-zinc-900/95 border border-zinc-700 rounded-xl p-6 backdrop-blur-md overflow-hidden min-w-[300px]"
            >
            {/* Accent décoratif */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-casino-gold/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-casino-gold/50 to-transparent" />
            
            {successMsg && (
              <div className="bg-green-900/50 border border-green-500 text-green-200 p-3 rounded mb-4 text-center font-rajdhani text-sm">
                {successMsg}
              </div>
            )}

            {!isRegistering ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-orbitron text-casino-gold uppercase tracking-widest">Accès Rapide</label>
                  <select 
                    value={selectedPresetUser}
                    onChange={(e) => setSelectedPresetUser(e.target.value)}
                    className="w-full bg-black/80 border border-zinc-600 rounded-lg p-3 text-base text-white font-rajdhani focus:border-casino-gold focus:ring-1 focus:ring-casino-gold outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Choisir un compte --</option>
                    <option value="AntoAbso">AntoAbso (Admin)</option>
                    <option value="Guest123">Guest123 (Invité)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-orbitron text-casino-gold uppercase tracking-widest">Identifiant</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-black/80 border border-zinc-600 rounded-lg p-3 text-base text-white font-rajdhani focus:border-casino-gold focus:ring-1 focus:ring-casino-gold outline-none transition-all"
                    placeholder="Votre identifiant"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-orbitron text-casino-gold uppercase tracking-widest">Mot de passe</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/80 border border-zinc-600 rounded-lg p-3 text-base text-white font-rajdhani focus:border-casino-gold focus:ring-1 focus:ring-casino-gold outline-none transition-all pr-11"
                      placeholder="••••••••"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-casino-gold transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-400 text-sm text-center font-rajdhani">{error}</p>}

                <CasinoButton type="submit" variant="primary" size="lg" className="w-full">
                  CONNEXION
                </CasinoButton>

                <div className="text-center pt-2">
                  <button 
                    type="button"
                    onClick={() => { setIsRegistering(true); setSuccessMsg(""); setError(""); }}
                    className="text-[13px] text-white hover:text-casino-gold underline underline-offset-4 transition-colors font-rajdhani"
                  >
                    Créer un compte
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <h2 className="text-center font-orbitron text-white text-lg mb-2">INSCRIPTION</h2>
                
                <div className="space-y-1">
                  <label className="text-xs font-orbitron text-casino-gold uppercase tracking-widest">Identifiant</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-black/80 border border-zinc-600 rounded-lg p-3 text-base text-white font-rajdhani focus:border-casino-gold focus:ring-1 focus:ring-casino-gold outline-none transition-all"
                    placeholder="Choisissez un pseudo"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-orbitron text-casino-gold uppercase tracking-widest">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/80 border border-zinc-600 rounded-lg p-3 text-base text-white font-rajdhani focus:border-casino-gold focus:ring-1 focus:ring-casino-gold outline-none transition-all"
                    placeholder="votre@email.com"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-orbitron text-casino-gold uppercase tracking-widest">Mot de passe</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/80 border border-zinc-600 rounded-lg p-3 text-base text-white font-rajdhani focus:border-casino-gold focus:ring-1 focus:ring-casino-gold outline-none transition-all pr-11"
                      placeholder="••••••••"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-casino-gold transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-orbitron text-casino-gold uppercase tracking-widest">Confirmer</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-black/80 border border-zinc-600 rounded-lg p-3 text-base text-white font-rajdhani focus:border-casino-gold focus:ring-1 focus:ring-casino-gold outline-none transition-all pr-11"
                      placeholder="••••••••"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-casino-gold transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-orbitron text-casino-gold uppercase tracking-widest">Code d'invitation <span className="text-red-400">*</span></label>
                  <input 
                    type="text" 
                    value={inviteCode}
                    onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setInviteCodeError(""); }}
                    className={`w-full bg-black/80 border rounded-lg p-3 text-2xl text-white font-rajdhani outline-none transition-all tracking-[0.4em] text-center ${
                      inviteCodeError 
                        ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
                        : 'border-zinc-600 focus:border-casino-gold focus:ring-1 focus:ring-casino-gold'
                    }`}
                    placeholder="CODE À 6 CARACTÈRES"
                    maxLength={6}
                    required
                  />
                  {inviteCodeError ? (
                    <p className="text-xs text-red-400 text-center font-rajdhani animate-pulse">{inviteCodeError}</p>
                  ) : (
                    <p className="text-[13px] text-white text-center font-rajdhani">Code reçu par email (VIP ou INVITE)</p>
                  )}
                </div>

                {error && <p className="text-red-400 text-sm text-center font-rajdhani">{error}</p>}

                <CasinoButton type="submit" variant="primary" size="lg" className="w-full">
                  CRÉER MON COMPTE
                </CasinoButton>

                <div className="text-center pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="text-[13px] text-white hover:text-casino-gold underline underline-offset-4 transition-colors font-rajdhani"
                  >
                    Retour à la connexion
                  </button>
                </div>
              </form>
            )}
          </motion.div>

            {/* ─── DERNIER TIRAGE ─── */}
            {lastDraw && (
              <div className="relative bg-gradient-to-br from-zinc-900 via-black to-zinc-900 border border-zinc-700 rounded-xl p-6 overflow-hidden group hover:border-blue-500/50 transition-colors duration-300 min-w-[300px]">
                {/* Accent top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500" />
                
                <h2 className="font-orbitron text-blue-400 text-base tracking-widest uppercase text-center mb-3">
                  Dernier Tirage
                </h2>
                
                {/* Date */}
                <p className="text-center text-white text-[13px] mb-4 font-rajdhani">
                  {lastDraw.date && !isNaN(new Date(lastDraw.date).getTime()) 
                    ? format(new Date(lastDraw.date), 'EEEE d MMMM yyyy', { locale: fr })
                    : lastDraw.date || 'Date inconnue'}
                </p>
                
                {/* Boules */}
                <div className="flex flex-wrap justify-center gap-2">
                  {lastDraw.numeros.map((n) => (
                    <LottoBall key={`n-${n}`} number={n} size="md" />
                  ))}
                  <div className="w-px bg-zinc-600 mx-1" />
                  {lastDraw.etoiles.map((n) => (
                    <LottoBall key={`s-${n}`} number={n} isStar size="md" />
                  ))}
                </div>
                
                {/* Alerte mise à jour nécessaire - informative uniquement */}
                {updateNeeded && (
                  <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg animate-pulse">
                    <div className="flex items-center gap-2 text-red-400 mb-1">
                      <AlertTriangle size={18} />
                      <span className="font-bold text-sm">MISE À JOUR REQUISE</span>
                    </div>
                    <p className="text-xs text-red-300">{updateMessage}</p>
                    <p className="text-xs text-zinc-400 mt-1">Connectez-vous pour procéder à la mise à jour.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.main>

        {/* Spacer pour le footer */}
        <div className="h-2" />
      </div>
    </CasinoLayout>
  );
}
