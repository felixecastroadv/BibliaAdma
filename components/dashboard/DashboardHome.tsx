
import React, { useState, useEffect } from 'react';
import { BookOpen, GraduationCap, ShieldCheck, Trophy, Calendar, ListChecks, Mail, CheckCircle2, Moon, Sun, Download, Instagram, X, Share, MoreVertical, Monitor, LogOut, Sparkles } from 'lucide-react';
import { CHURCH_NAME, TOTAL_CHAPTERS, APP_VERSION, PASTOR_PRESIDENT } from '../../constants';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
    onNavigate: (view: string, params?: any) => void;
    isAdmin: boolean;
    onEnableAdmin: () => void;
    user: any;
    userProgress: any;
    darkMode: boolean;
    toggleDarkMode: () => void;
    onShowToast: (msg: string, type: 'info' | 'success' | 'error') => void;
    onLogout: () => void;
}

export default function DashboardHome({ onNavigate, isAdmin, onEnableAdmin, user, userProgress, darkMode, toggleDarkMode, onShowToast, onLogout }: DashboardProps) {
  const [clicks, setClicks] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  
  // Modais de Instrução
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showDesktopInstructions, setShowDesktopInstructions] = useState(false);

  useEffect(() => {
    // 1. Detectar se já está instalado/standalone
    const checkStandalone = () => {
        const isStand = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;
        setIsStandalone(isStand);
    };
    
    checkStandalone();
    window.addEventListener('resize', checkStandalone);

    // 2. Captura o evento de instalação do Chrome (Android/Desktop)
    const handleBeforeInstall = (e: any) => {
      e.preventDefault(); // Impede o banner nativo automático (queremos controlar no botão)
      setDeferredPrompt(e);
      setIsStandalone(false); // Se o evento disparou, o app NÃO está instalado
    };

    // 3. Detecta quando o app foi instalado com sucesso para esconder o botão
    const handleAppInstalled = () => {
        setIsStandalone(true);
        setDeferredPrompt(null);
        setShowDesktopInstructions(false);
        setShowIOSInstructions(false);
        onShowToast("Aplicativo instalado com sucesso!", "success");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('resize', checkStandalone);
        window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // TENTATIVA 1: Instalação Automática Nativa (Android / PC Chrome Novo)
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
        return;
    }

    // TENTATIVA 2: Fallback Manual (iOS ou PC Bloqueado)
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    
    if (isIOS) {
        setShowIOSInstructions(true);
    } else {
        setShowDesktopInstructions(true);
    }
  };

  const handleLogoClick = () => {
    const newClicks = clicks + 1;
    setClicks(newClicks);
    if (newClicks >= 5) {
        onEnableAdmin();
        setClicks(0);
    }
    setTimeout(() => setClicks(0), 3000);
  };

  const menuItems = [
    { id: 'reader', icon: BookOpen, label: 'Bíblia Sagrada', desc: 'Leitura & Exegese', color: 'from-red-900 to-red-800' },
    { id: 'panorama', icon: GraduationCap, label: 'EBD Panorama', desc: 'Estudos Profundos', color: 'from-blue-900 to-blue-800' },
    { id: 'devotional', icon: Calendar, label: 'Devocional', desc: 'Palavra Diária', color: 'from-purple-900 to-purple-800' },
    { id: 'plans', icon: ListChecks, label: 'Planos', desc: 'Metas de Leitura', color: 'from-green-900 to-green-800' },
    { id: 'ranking', icon: Trophy, label: 'Ranking', desc: 'Conquistas', color: 'from-amber-700 to-amber-600' },
    { id: 'messages', icon: Mail, label: 'Mensagens', desc: 'Mural da Igreja', color: 'from-pink-800 to-pink-700' },
  ];

  const progressPercent = userProgress ? Math.min(100, (userProgress.total_chapters / TOTAL_CHAPTERS) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-500 font-sans">
        {/* MODAL DE INSTRUÇÕES IOS */}
        <AnimatePresence>
            {showIOSInstructions && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 pointer-events-auto backdrop-blur-sm"
                        onClick={() => setShowIOSInstructions(false)}
                    />
                    <motion.div 
                        initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                        className="bg-white dark:bg-[#1E1E1E] w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-8 relative z-10 pointer-events-auto pb-12 sm:pb-8 shadow-2xl"
                    >
                        <button onClick={() => setShowIOSInstructions(false)} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-full"><X className="w-5 h-5 text-gray-500"/></button>
                        <div className="text-center">
                            <Share className="w-14 h-14 mx-auto text-blue-500 mb-5" />
                            <h3 className="font-cinzel font-bold text-2xl mb-2 dark:text-white">Instalar no iPhone</h3>
                            <p className="font-montserrat text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">Para a melhor experiência, adicione este aplicativo à sua tela inicial:</p>
                            <ol className="text-left text-sm space-y-4 bg-gray-50 dark:bg-black/20 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <li className="flex items-center gap-3 dark:text-gray-200">
                                    <span className="bg-gray-200 dark:bg-gray-700 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                                    <span>Toque em <strong>Compartilhar</strong> <Share className="w-4 h-4 inline" /></span>
                                </li>
                                <li className="flex items-center gap-3 dark:text-gray-200">
                                    <span className="bg-gray-200 dark:bg-gray-700 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                                    <span>Selecione <strong>"Adicionar à Tela de Início"</strong>.</span>
                                </li>
                            </ol>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* MODAL DE INSTRUÇÕES DESKTOP */}
        <AnimatePresence>
            {showDesktopInstructions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 pointer-events-auto backdrop-blur-sm"
                        onClick={() => setShowDesktopInstructions(false)}
                    />
                    <motion.div 
                        initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                        className="bg-white dark:bg-[#1E1E1E] w-full max-w-md rounded-3xl p-8 relative z-10 pointer-events-auto shadow-2xl"
                    >
                        <button onClick={() => setShowDesktopInstructions(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition"><X className="w-5 h-5 text-gray-500"/></button>
                        <div className="text-center">
                            <Monitor className="w-14 h-14 mx-auto text-[#8B0000] dark:text-[#ff6b6b] mb-5" />
                            <h3 className="font-cinzel font-bold text-2xl mb-2 dark:text-white">Instalar App</h3>
                            <p className="font-montserrat text-sm text-gray-600 dark:text-gray-300 mb-6">Instale para acesso rápido e offline.</p>
                            
                            <div className="bg-gray-50 dark:bg-black/30 p-5 rounded-2xl text-left border border-gray-100 dark:border-gray-800">
                                <p className="text-sm font-bold mb-3 dark:text-white uppercase tracking-wider text-xs">Instruções:</p>
                                <div className="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
                                    <div className="flex items-start gap-3">
                                        <Download className="w-5 h-5 text-[#8B0000] dark:text-[#ff6b6b] shrink-0" />
                                        <span>Busque o ícone de instalação na barra de endereços do navegador.</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <MoreVertical className="w-5 h-5 text-gray-400 shrink-0" />
                                        <span>Ou: Menu &gt; Salvar e Compartilhar &gt; Instalar página como App.</span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowDesktopInstructions(false)}
                                className="mt-6 w-full py-4 bg-[#8B0000] text-white rounded-xl font-bold font-cinzel hover:bg-[#600018] shadow-lg shadow-red-900/20 active:scale-95 transition-all"
                            >
                                Entendi
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* HERO SECTION - REESTRUTURADO E PREMIUM */}
        <div className="relative bg-[#0F0505] text-white pb-24 rounded-b-[50px] shadow-2xl overflow-hidden isolate">
             
             {/* Background Effects */}
             <div className="absolute inset-0 bg-gradient-to-b from-[#600010] via-[#45000A] to-[#250005] z-0"></div>
             <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay z-0"></div>
             
             {/* Glow decorativo no topo */}
             <div className="absolute top-[-50%] left-1/2 -translate-x-1/2 w-[120%] h-[100%] bg-[#8B0000] opacity-30 blur-[100px] rounded-full pointer-events-none z-0"></div>

             {/* Top Bar (Glass) */}
             <div className="relative z-20 px-6 pt-6 flex justify-between items-center">
                <AnimatePresence>
                    {!isStandalone && (
                        <motion.button 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onClick={handleInstallClick} 
                            className="bg-white/5 backdrop-blur-md border border-white/10 text-white/90 px-4 py-2 rounded-full flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95 shadow-lg"
                        >
                            <Download className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Instalar App</span>
                        </motion.button>
                    )}
                </AnimatePresence>
                <div className={`flex gap-3 ${isStandalone ? 'ml-auto' : ''}`}>
                    <button onClick={toggleDarkMode} className="p-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all active:scale-90 shadow-lg">
                        {darkMode ? <Sun className="w-4 h-4 text-[#C5A059]" /> : <Moon className="w-4 h-4 text-white/80" />}
                    </button>
                    <button onClick={onLogout} className="p-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-90 text-white/80 shadow-lg group">
                        <LogOut className="w-4 h-4 group-hover:text-red-400" />
                    </button>
                </div>
            </div>

            {/* Main Content Centered */}
            <div className="relative z-10 px-6 pt-10 flex flex-col items-center justify-center text-center space-y-6">
                
                {/* Header Info (Minimalista) */}
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-center gap-2"
                >
                    <h3 className="font-montserrat text-[10px] font-bold tracking-[0.3em] text-[#C5A059] uppercase opacity-90">
                        {CHURCH_NAME}
                    </h3>
                    <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-[#C5A059]/50 to-transparent"></div>
                    <p className="font-cormorant text-sm italic text-white/60">
                        Presidência: {PASTOR_PRESIDENT}
                    </p>
                </motion.div>

                {/* LOGO PREMIUM (Vidro e Ouro) */}
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                    className="relative group cursor-pointer"
                    onClick={handleLogoClick}
                >
                    {/* Glow Effect */}
                    <div className="absolute inset-0 bg-[#C5A059] blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-700 rounded-full"></div>
                    
                    {/* Container */}
                    <div className="relative w-24 h-24 bg-gradient-to-br from-white/10 to-transparent rounded-[32px] border border-[#C5A059]/40 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md flex items-center justify-center overflow-hidden group-hover:border-[#C5A059]/60 transition-colors duration-500">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#C5A059]/10 to-transparent opacity-50"></div>
                        {/* Reflection */}
                        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent opacity-50"></div>
                        
                        <BookOpen className="w-10 h-10 text-[#C5A059] drop-shadow-[0_2px_10px_rgba(197,160,89,0.5)] z-10" strokeWidth={1.5} />
                    </div>
                </motion.div>

                {/* Title Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h1 className="font-cinzel text-4xl md:text-5xl font-bold text-white mb-1 drop-shadow-lg tracking-tight">
                        Bíblia ADMA
                    </h1>
                    <p className="font-cormorant text-lg text-[#C5A059] italic opacity-80 font-light">
                        Prof. Michel Felix
                    </p>
                </motion.div>

                {/* User Greeting Badge */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center gap-2 bg-[#0F0505]/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5 shadow-inner"
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse box-shadow-green"></div>
                    <span className="font-montserrat text-[10px] font-bold text-white/90 uppercase tracking-wide">
                        Olá, {user?.user_name?.split(' ')[0] || 'Visitante'}
                    </span>
                </motion.div>

            </div>
        </div>

        {/* PROGRESS CARD (Floating Overlap) */}
        <div className="px-6 -mt-16 relative z-30 mb-8">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="bg-white dark:bg-[#1E1E1E] p-6 rounded-[32px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] border border-[#C5A059]/20 backdrop-blur-sm relative overflow-hidden"
            >
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

                <div className="flex justify-between items-end mb-4 relative z-10">
                    <div className="flex flex-col">
                        <span className="font-montserrat text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#C5A059]" /> Seu Progresso
                        </span>
                        <span className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] text-xl">
                             Leitura Bíblica
                        </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="font-montserrat font-bold text-4xl dark:text-white leading-none">{progressPercent.toFixed(0)}</span>
                        <span className="text-sm text-gray-400 font-bold">%</span>
                    </div>
                </div>
                
                <div className="w-full bg-gray-100 dark:bg-black/40 rounded-full h-2 mb-3 overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="bg-gradient-to-r from-[#8B0000] via-[#A00000] to-[#C5A059] h-full rounded-full shadow-[0_0_15px_rgba(197,160,89,0.4)] relative"
                    >
                        <div className="absolute top-0 right-0 h-full w-1 bg-white/50 animate-pulse"></div>
                    </motion.div>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span>Início</span>
                    <span>{userProgress?.total_chapters || 0} de {TOTAL_CHAPTERS}</span>
                    <span>Meta</span>
                </div>
            </motion.div>
        </div>

        {/* MENU GRID (Bento Style Clean) */}
        <div className="px-6 pb-32 grid grid-cols-2 gap-4">
            {menuItems.map((item, idx) => (
                <motion.button 
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + (idx * 0.05) }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onNavigate(item.id)} 
                    className={`relative overflow-hidden group bg-white dark:bg-[#1E1E1E] p-6 rounded-[24px] shadow-sm hover:shadow-xl dark:shadow-none dark:hover:bg-[#252525] border border-gray-100 dark:border-white/5 transition-all duration-300 text-left h-40 flex flex-col justify-between`}
                >
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md text-white mb-2 group-hover:scale-110 transition-transform duration-500`}>
                        <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="font-cinzel font-bold text-[#1a0f0f] dark:text-gray-100 text-base block leading-tight mb-1">{item.label}</span>
                        <span className="font-montserrat text-[10px] text-gray-400 dark:text-gray-500 font-medium block">{item.desc}</span>
                    </div>
                    {/* Subtle Gradient Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </motion.button>
            ))}
            
            {isAdmin && (
                <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onNavigate('admin')} 
                    className="col-span-2 bg-[#1a0f0f] dark:bg-black text-[#C5A059] p-5 rounded-3xl shadow-lg border border-[#C5A059]/30 flex items-center justify-center gap-4 group mt-4 relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-[#C5A059]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <ShieldCheck className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    <div className="text-left relative z-10">
                        <span className="font-cinzel font-bold block text-sm">Painel Editor Chefe</span>
                        <span className="text-[10px] opacity-60 uppercase tracking-widest">Acesso Restrito</span>
                    </div>
                </motion.button>
            )}

            {/* Instagram Button */}
            <motion.a 
                href="https://www.instagram.com/adma.vilardosteles/" 
                target="_blank" 
                rel="noopener noreferrer"
                whileTap={{ scale: 0.98 }}
                className="col-span-2 w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white p-5 rounded-3xl shadow-lg shadow-pink-500/20 flex items-center justify-center gap-3 mt-2"
            >
                <Instagram className="w-5 h-5" />
                <span className="font-cinzel font-bold text-sm">Siga a ADMA no Instagram</span>
            </motion.a>
        </div>
        
        {/* Footer */}
        <div className="text-center pb-8 opacity-40">
            <p className="font-cinzel text-[10px] font-bold flex items-center justify-center gap-1.5 text-gray-500 dark:text-gray-500">
                 <CheckCircle2 className="w-3 h-3"/> Sistema Conectado • {APP_VERSION}
            </p>
        </div>
    </div>
  );
}
