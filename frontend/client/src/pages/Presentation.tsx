
import React, { useState } from "react";
import { CasinoLayout } from "@/components/layout/CasinoLayout";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
    ArrowUp,
    ArrowDown,
    Minus,
    Activity,
    Zap,
    TrendingUp,
    Clock,
    Settings,
    Sliders,
    Play,
    Eye,
    Shuffle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LottoBall } from "@/components/casino/LottoBall";

export default function Presentation() {
    const [activeTab, setActiveTab] = useState<'standard' | 'dynamic'>('standard');
    const [, setLocation] = useLocation();

    return (
        <CasinoLayout>
            <div className="min-h-screen text-white p-4 md:p-8 max-w-6xl mx-auto font-rajdhani space-y-24 pb-32">

                {/* HERO */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center space-y-6 pt-12"
                >
                    <h1 className="text-5xl md:text-7xl font-orbitron font-black text-white uppercase tracking-widest text-shadow-glow">
                        LotoFormula<span className="text-casino-gold">4Life</span>
                    </h1>
                    <p className="text-2xl md:text-3xl text-zinc-400 font-light italic max-w-3xl mx-auto">
                        "Il n'y a pas de hasard. Seulement des probabilités qui tendent vers l'équilibre."
                    </p>
                </motion.div>

                {/* SECTION 1: PHILOSOPHIE */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="space-y-6"
                    >
                        <h2 className="text-3xl font-orbitron text-casino-gold border-l-4 border-casino-gold pl-4">
                            LA LOI DE COMPENSATION
                        </h2>
                        <div className="prose prose-invert text-lg text-zinc-300 leading-relaxed space-y-4">
                            <p>
                                L'univers déteste le déséquilibre. Si vous lancez une pièce 1000 fois, vous obtiendrez environ 50% de piles et 50% de faces.
                                C'est inévitable.
                            </p>
                            <p>
                                Au Loto, c'est pareil. Chaque numéro a une probabilité théorique de sortie. Lorsqu'un numéro s'écarte de cette probabilité,
                                une <strong>tension invisible</strong> se crée.
                            </p>
                            <ul className="list-none space-y-4 mt-6">
                                <li className="flex items-start gap-3">
                                    <div className="bg-red-500/20 p-2 rounded-lg text-red-400 mt-1"><TrendingUp size={20} /></div>
                                    <div>
                                        <strong className="text-white block text-lg">La Surchauffe</strong>
                                        Un numéro qui sort trop souvent a "épuisé" son quota temporaire. Il va devoir se calmer.
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400 mt-1"><Clock size={20} /></div>
                                    <div>
                                        <strong className="text-white block text-lg">La Dette (Le Dormeur)</strong>
                                        Un numéro absent depuis longtemps accumule une "dette". Statistique, il <strong>doit</strong> sortir pour rétablir l'équilibre.
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="relative h-[400px] bg-gradient-to-br from-zinc-900 to-black rounded-2xl border border-zinc-800 p-8 flex items-center justify-center overflow-hidden"
                    >
                        {/* Visualisation abstraite de l'équilibre */}
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                        <div className="relative z-10 w-full max-w-sm">
                            <div className="flex justify-between items-end h-40 gap-4 mb-4">
                                <div className="w-1/3 bg-red-500/20 border border-red-500/50 rounded-t-lg h-[80%] relative group">
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-red-400 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">TROP CHAUD</div>
                                </div>
                                <div className="w-1/3 bg-casino-gold/20 border border-casino-gold/50 rounded-t-lg h-[50%] relative group">
                                    <div className="absolute inset-0 flex items-center justify-center text-casino-gold font-bold">ÉQUILIBRE</div>
                                </div>
                                <div className="w-1/3 bg-blue-500/20 border border-blue-500/50 rounded-t-lg h-[20%] relative group">
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-blue-400 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">DETTE DU DORMEUR</div>
                                    {/* Flèche indiquant la remontée nécessaire */}
                                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-blue-400 animate-bounce"><ArrowUp /></div>
                                </div>
                            </div>
                            <div className="h-0.5 w-full bg-zinc-700 relative">
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-px bg-white/20"></div>
                            </div>
                            <p className="text-center text-zinc-500 text-sm mt-4">La ligne de flottaison statistique</p>
                        </div>
                    </motion.div>
                </section>

                {/* SECTION 2: L'INTERFACE CONSOLE */}
                <section className="space-y-12">
                    <div className="text-center space-y-4">
                        <h2 className="text-3xl md:text-4xl font-orbitron text-white">L'EXPÉRIENCE <span className="text-casino-gold">CONSOLE</span></h2>
                        <p className="text-zinc-400 max-w-2xl mx-auto">Une interface immersive conçue pour vous mettre dans la peau du stratège.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 text-center space-y-4 hover:border-casino-gold/50 transition-colors group">
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto group-hover:bg-casino-gold/10 transition-colors">
                                <Zap className="text-casino-gold w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-orbitron text-white">LE LEVIER DE TIRAGE</h3>
                            <p className="text-sm text-zinc-400">
                                Oubliez les boutons "Générer". Ici, vous armez le levier. Un geste physique, engageant, qui lance les algorithmes avec un retour haptique visuel et sonore satisfaisant.
                            </p>
                        </div>

                        <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 text-center space-y-4 hover:border-casino-gold/50 transition-colors group">
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto group-hover:bg-casino-gold/10 transition-colors">
                                <Activity className="text-green-400 w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-orbitron text-white">FEEDBACK EN TEMPS RÉEL</h3>
                            <p className="text-sm text-zinc-400">
                                Des indicateurs LED, des compteurs LCD qui défilent, des sons mécaniques... Chaque action a une réponse. Vous "sentez" le calcul se faire.
                            </p>
                        </div>

                        <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 text-center space-y-4 hover:border-casino-gold/50 transition-colors group">
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto group-hover:bg-casino-gold/10 transition-colors">
                                <Settings className="text-blue-400 w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-orbitron text-white">CONTRÔLE TOTAL</h3>
                            <p className="text-sm text-zinc-400">
                                Ce n'est pas une boîte noire. Vous voyez les paramètres, vous ajustez les rouages. Vous êtes le pilote, l'algorithme est votre copilote.
                            </p>
                        </div>
                    </div>
                </section>

                {/* SECTION 3: LES 4 PILIERS */}
                <section className="space-y-12 bg-zinc-950/50 p-8 md:p-12 rounded-3xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-casino-gold/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                    <div className="text-center max-w-3xl mx-auto space-y-6 relative z-10">
                        <h2 className="text-3xl md:text-5xl font-orbitron text-white uppercase">LES 4 MOTEURS DE PRÉDICTION</h2>
                        <p className="text-lg text-zinc-300">
                            LotoFormula4Life ne se base pas sur une seule approche. Il combine 4 algorithmes distincts pour couvrir toutes les facettes du hasard.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                        {/* PILIER 1 : HIGH */}
                        <div className="bg-gradient-to-b from-zinc-900 to-black p-6 rounded-xl border-t-2 border-red-500 shadow-lg hover:transform hover:-translate-y-1 transition-all duration-300">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-black font-orbitron text-white">HIGH</h3>
                                <Activity className="text-red-500" size={24} />
                            </div>
                            <p className="text-sm text-zinc-400 mb-4 font-bold uppercase tracking-wider">La Fréquence Pure</p>
                            <p className="text-zinc-300 text-sm leading-relaxed">
                                Repère les numéros qui sortent le plus souvent sur une période donnée.
                                <br /><br />
                                <span className="text-red-400 italic">"La forme du moment."</span>
                            </p>
                        </div>

                        {/* PILIER 2 : SURREPRÉSENTATION */}
                        <div className="bg-gradient-to-b from-zinc-900 to-black p-6 rounded-xl border-t-2 border-yellow-400 shadow-lg hover:transform hover:-translate-y-1 transition-all duration-300">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-black font-orbitron text-white">Z-SCORE</h3>
                                <Zap className="text-yellow-400" size={24} />
                            </div>
                            <p className="text-sm text-zinc-400 mb-4 font-bold uppercase tracking-wider">L'Anomalie</p>
                            <p className="text-zinc-300 text-sm leading-relaxed">
                                Utilise le Z-Score (écart-type) pour détecter les numéros qui défient les statistiques normales.
                                <br /><br />
                                <span className="text-yellow-400 italic">"L'exception qui confirme la règle."</span>
                            </p>
                        </div>

                        {/* PILIER 3 : TENDANCE */}
                        <div className="bg-gradient-to-b from-zinc-900 to-black p-6 rounded-xl border-t-2 border-green-500 shadow-lg hover:transform hover:-translate-y-1 transition-all duration-300">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-black font-orbitron text-white">TREND</h3>
                                <TrendingUp className="text-green-500" size={24} />
                            </div>
                            <p className="text-sm text-zinc-400 mb-4 font-bold uppercase tracking-wider">Le Mouvement</p>
                            <p className="text-zinc-300 text-sm leading-relaxed">
                                Analyse la dérivée (la vitesse de changement). Un numéro est-il en train de "monter" ou de "descendre" ?
                                <br /><br />
                                <span className="text-green-400 italic">"Suivre le courant avant qu'il ne change."</span>
                            </p>
                        </div>

                        {/* PILIER 4 : DORMEUR */}
                        <div className="bg-gradient-to-b from-zinc-900 to-black p-6 rounded-xl border-t-2 border-blue-500 shadow-lg hover:transform hover:-translate-y-1 transition-all duration-300">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-black font-orbitron text-white">DORMEUR</h3>
                                <Clock className="text-blue-500" size={24} />
                            </div>
                            <p className="text-sm text-zinc-400 mb-4 font-bold uppercase tracking-wider">La Dette</p>
                            <p className="text-zinc-300 text-sm leading-relaxed">
                                Cible les numéros absents depuis longtemps. Plus l'absence est longue, plus la pression statistique est forte.
                                <br /><br />
                                <span className="text-blue-400 italic">"Tout ce qui monte doit redescendre... et inversement."</span>
                            </p>
                        </div>
                    </div>
                </section>

                {/* SECTION 4: LE CERVEAU (SETTINGS & DYNAMIC) */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <h2 className="text-3xl md:text-5xl font-orbitron text-white">LE CERVEAU : <span className="text-purple-400">FENÊTRES DYNAMIQUES</span></h2>
                        <div className="space-y-6 text-lg text-zinc-300">
                            <p>
                                C'est ici que LotoFormula4Life dépasse les simples générateurs aléatoires.
                                Pour savoir si un numéro est "fréquent" ou "en retard", il faut regarder dans le passé. Mais <strong className="text-white">jusqu'où ?</strong>
                            </p>
                            <p>
                                Regarder les 10 derniers tirages ? Les 100 derniers ? Les 1000 derniers ?
                                La réponse change tout.
                            </p>

                            <div className="bg-zinc-900 p-1 rounded-lg inline-flex border border-zinc-700">
                                <button
                                    onClick={() => setActiveTab('standard')}
                                    className={cn(
                                        "px-6 py-2 rounded font-orbitron transition-all",
                                        activeTab === 'standard' ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-white"
                                    )}
                                >
                                    MODE STANDARD
                                </button>
                                <button
                                    onClick={() => setActiveTab('dynamic')}
                                    className={cn(
                                        "px-6 py-2 rounded font-orbitron transition-all flex items-center gap-2",
                                        activeTab === 'dynamic' ? "bg-purple-600 text-white shadow shadow-purple-500/50" : "text-zinc-500 hover:text-purple-400"
                                    )}
                                >
                                    <Zap size={14} /> MODE DYNAMIQUE
                                </button>
                            </div>

                            <div className="bg-black/50 border border-zinc-800 p-6 rounded-xl min-h-[150px]">
                                {activeTab === 'standard' ? (
                                    <motion.div
                                        key="std"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="space-y-2"
                                    >
                                        <h4 className="font-bold text-white flex items-center gap-2"><Settings size={16} /> Approche Classique</h4>
                                        <p className="text-sm text-zinc-400">
                                            Utilise des fenêtres fixes (ex: les 100 derniers tirages pour tout le monde).
                                            C'est stable, robuste, éprouvé. Idéal pour commencer.
                                        </p>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="dyn"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="space-y-2"
                                    >
                                        <h4 className="font-bold text-purple-400 flex items-center gap-2"><Zap size={16} /> L'Intelligence Adaptative</h4>
                                        <p className="text-sm text-zinc-300">
                                            Le système <strong>calcule lui-même</strong> la fenêtre idéale pour chaque catégorie en cherchant le point de stabilisation statistique.
                                            Si l'histoire récente change, la fenêtre s'adapte. C'est du "Live Tuning".
                                        </p>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        {/* Abstract visualization of a window moving over data */}
                        <div className="absolute inset-0 bg-purple-500/10 blur-3xl rounded-full"></div>
                        <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-4">
                            {/* Fake Timeline */}
                            <div className="flex justify-between text-xs text-zinc-500 font-mono mb-2">
                                <span>2004</span>
                                <span>Aujourd'hui</span>
                            </div>
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden relative">
                                <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-purple-500 to-transparent w-3/4 opacity-50"></div>
                                {/* The Window Indicator */}
                                <motion.div
                                    animate={{
                                        width: activeTab === 'dynamic' ? ["20%", "45%", "30%"] : "30%",
                                        x: activeTab === 'dynamic' ? [0, 50, 20] : 0
                                    }}
                                    transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                                    className="absolute top-0 bottom-0 right-0 bg-purple-500 h-full rounded-l-full shadow-[0_0_15px_rgba(168,85,247,0.8)]"
                                />
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-xs text-purple-300 font-mono">
                                    {activeTab === 'standard' ? "FENÊTRE FIXE : 680 TIRAGES" : "FENÊTRE CALCULÉE : 420... 690... (ADAPTATIF)"}
                                </span>
                                <Settings size={16} className={activeTab === 'dynamic' ? "text-purple-400 animate-spin-slow" : "text-zinc-600"} />
                            </div>

                            <div className="mt-8 grid grid-cols-4 gap-2">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="h-8 bg-zinc-900 rounded border border-zinc-800 flex items-center justify-center">
                                        <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 5: GUIDE DE DÉMARRAGE */}
                <section className="border-t border-zinc-800 pt-16">
                    <h2 className="text-3xl font-orbitron text-white mb-12 text-center">COMMENT <span className="text-casino-gold">GAGNER</span> ? (STRATÉGIE)</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-zinc-700 to-transparent -z-10"></div>

                        {/* STEP 1 */}
                        <div className="relative flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-zinc-900 border-2 border-zinc-700 rounded-full flex items-center justify-center text-2xl font-black font-orbitron text-zinc-500 z-10">1</div>
                            <h3 className="text-xl font-bold text-white">OBSERVEZ</h3>
                            <p className="text-sm text-zinc-400 px-4">
                                Ne jouez pas tout de suite. Lancez la console. Regardez les LEDs. Familiarisez-vous avec les 4 piliers.
                            </p>
                            <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800 mt-2">
                                <Eye className="text-zinc-400" size={20} />
                            </div>
                        </div>

                        {/* STEP 2 */}
                        <div className="relative flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-zinc-900 border-2 border-casino-gold rounded-full flex items-center justify-center text-2xl font-black font-orbitron text-casino-gold shadow-[0_0_20px_rgba(255,215,0,0.3)] z-10">2</div>
                            <h3 className="text-xl font-bold text-white">COMMENCEZ STANDARD</h3>
                            <p className="text-sm text-zinc-400 px-4">
                                Laissez les réglages sur "Standard". C'est l'équilibre parfait pour vos 10 premières grilles.
                            </p>
                            <div className="bg-casino-gold/10 p-2 rounded border border-casino-gold/30 mt-2">
                                <Play className="text-casino-gold" size={20} />
                            </div>
                        </div>

                        {/* STEP 3 */}
                        <div className="relative flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-zinc-900 border-2 border-purple-500 rounded-full flex items-center justify-center text-2xl font-black font-orbitron text-purple-400 z-10">3</div>
                            <h3 className="text-xl font-bold text-white">PASSEZ DYNAMIQUE</h3>
                            <p className="text-sm text-zinc-400 px-4">
                                Une fois confiant, activez le "Mode Dynamique" dans les Réglages. Laissez l'IA affiner les fenêtres pour une précision chirurgicale.
                            </p>
                            <div className="bg-purple-900/20 p-2 rounded border border-purple-500/30 mt-2">
                                <Zap className="text-purple-400" size={20} />
                            </div>
                        </div>
                    </div>

                    <div className="mt-16 text-center">
                        <button
                            onClick={() => setLocation("/dashboard")}
                            className="bg-casino-gold text-black font-bold font-orbitron px-8 py-4 rounded-full text-xl shadow-[0_0_30px_rgba(255,215,0,0.4)] hover:scale-105 hover:shadow-[0_0_50px_rgba(255,215,0,0.6)] transition-all flex items-center gap-3 mx-auto group">
                            <Play className="fill-black group-hover:scale-110 transition-transform" />
                            LANCER LA CONSOLE
                        </button>
                    </div>
                </section>

            </div>
        </CasinoLayout>
    );
}
