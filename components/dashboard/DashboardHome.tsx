import React, { useState, useEffect } from 'react';
import { BookOpen, GraduationCap, ShieldCheck, Trophy, Calendar, ListChecks, Mail, CheckCircle2, Moon, Sun, Download, Instagram, X, Share, MoreVertical, Monitor, LogOut } from 'lucide-react';
import { CHURCH_NAME, TOTAL_CHAPTERS, APP_VERSION } from '../../constants';
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
    // Se chegou aqui, o navegador NÃO permite instalação via botão direto.
    // Precisamos guiar o usuário.
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    
    if (isIOS) {
        setShowIOSInstructions(true);
    } else {
        // Assume Desktop ou Android sem suporte a prompt direto
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
    { id: 'reader', icon: BookOpen, label: 'Bíblia', color: 'bg-[#8B0000]' },
    { id: 'panorama', icon: GraduationCap, label: 'EBD Panorama', color: 'bg-blue-800' },
    { id: 'devotional', icon: Calendar, label: 'Devocional', color: 'bg-purple-700' },
    { id: 'plans', icon: ListChecks, label: 'Planos', color: 'bg-green-700' },
    { id: 'ranking', icon: Trophy, label: 'Ranking', color: 'bg-amber-600' },
    { id: 'messages', icon: Mail, label: 'Mensagens', color: 'bg-pink-600' },
  ];

  const progressPercent = userProgress ? Math.min(100, (userProgress.total_chapters / TOTAL_CHAPTERS) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg transition-colors duration-300">
        {/* MODAL DE INSTRUÇÕES IOS */}
        <AnimatePresence>
            {showIOSInstructions && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 pointer-events-auto"
                        onClick={() => setShowIOSInstructions(false)}
                    />
                    <motion.div 
                        initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                        className="bg-white dark:bg-[#1E1E1E] w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6 relative z-10 pointer-events-auto pb-10 sm:pb-6"
                    >
                        <button onClick={() => setShowIOSInstructions(false)} className="absolute top-4 right-4"><X className="w-6 h-6 text-gray-500"/></button>
                        <div className="text-center">
                            <Share className="w-12 h-12 mx-auto text-blue-500 mb-4" />
                            <h3 className="font-cinzel font-bold text-xl mb-2 dark:text-white">Instalar no iPhone</h3>
                            <p className="font-montserrat text-sm text-gray-600 dark:text-gray-300 mb-4">A Apple exige instalação manual:</p>
                            <ol className="text-left text-sm space-y-3 bg-gray-50 dark:bg-black/20 p-4 rounded-xl">
                                <li className="flex items-center gap-2 dark:text-gray-200">
                                    <span className="bg-gray-200 dark:bg-gray-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                    Toque em <strong>Compartilhar</strong> <Share className="w-4 h-4 inline" />
                                </li>
                                <li className="flex items-center gap-2 dark:text-gray-200">
                                    <span className="bg-gray-200 dark:bg-gray-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                    Selecione <strong>"Adicionar à Tela de Início"</strong>.
                                </li>
                            </ol>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* MODAL DE INSTRUÇÕES DESKTOP/PC */}
        <AnimatePresence>
            {showDesktopInstructions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 pointer-events-auto"
                        onClick={() => setShowDesktopInstructions(false)}
                    />
                    <motion.div 
                        initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                        className="bg-white dark:bg-[#1E1E1E] w-full max-w-md rounded-2xl p-6 relative z-10 pointer-events-auto"
                    >
                        <button onClick={() => setShowDesktopInstructions(false)} className="absolute top-4 right-4"><X className="w-6 h-6 text-gray-500"/></button>
                        <div className="text-center">
                            <Monitor className="w-12 h-12 mx-auto text-[#8B0000] dark:text-[#ff6b6b] mb-4" />
                            <h3 className="font-cinzel font-bold text-xl mb-2 dark:text-white">Instalar no Computador</h3>
                            <p className="font-montserrat text-sm text-gray-600 dark:text-gray-300 mb-4">Seu navegador bloqueou a instalação automática.</p>
                            
                            <div className="bg-gray-100 dark:bg-black/30 p-4 rounded-xl text-left border-l-4 border-[#C5A059]">
                                <p className="text-sm font-bold mb-2 dark:text-white">Como forçar a instalação:</p>
                                <div className="flex flex-col gap-2 text-sm text-gray-800 dark:text-gray-200">
                                    <div className="flex items-center gap-2">
                                        <Download className="w-4 h-4 text-[#8B0000] dark:text-[#ff6b6b]" />
                                        <span>Procure o ícone de <strong>Download/Instalar</strong> na barra de endereço (onde digita o site).</span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-1 opacity-80 text-xs mt-2">
                                        <span>Ou: Menu (três pontos) &gt; Salvar e Compartilhar &gt; Instalar página como App.</span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowDesktopInstructions(false)}
                                className="mt-6 w-full py-3 bg-[#8B0000] text-white rounded-lg font-bold font-cinzel hover:bg-[#600018]"
                            >
                                Entendi
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* Hero */}
        <div className="bg-gradient-to-b from-[#8B0000] to-[#600018] text-white p-8 rounded-b-[40px] shadow-xl relative overflow-hidden pb-16">
            <div className="absolute top-4 right-4 z-20 flex gap-2">
                <AnimatePresence>
                    {!isStandalone && (
                        <motion.button 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={handleInstallClick} 
                            className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 flex items-center gap-2 px-3 transition-all border border-white/30 group"
                            title="Instalar App"
                        >
                            <Download className="w-5 h-5 group-hover:animate-bounce" />
                            <span className="text-xs font-bold hidden md:inline">Instalar App</span>
                        </motion.button>
                    )}
                </AnimatePresence>
                <button onClick={toggleDarkMode} className="p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all border border-white/30">
                    {darkMode ? <Sun className="w-5 h-5 text-yellow-300" /> : <Moon className="w-5 h-5 text-white" />}
                </button>
                <button onClick={onLogout} className="p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-red-500/50 transition-all border border-white/30" title="Sair / Trocar Conta">
                    <LogOut className="w-5 h-5 text-white" />
                </button>
            </div>
            <div className="relative z-10 text-center">
                <h2 className="font-montserrat text-xs tracking-[0.3em] uppercase opacity-80 mb-2">{CHURCH_NAME}</h2>
                <h1 onClick={handleLogoClick} className="font-cinzel text-4xl font-bold mb-1 cursor-pointer select-none active:scale-95 transition-transform">
                    Bíblia ADMA
                </h1>
                <p className="font-cormorant italic text-lg opacity-90">Prof. Michel Felix</p>
                <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                        <span className="font-montserrat text-xs">Olá, {user?.user_name?.split(' ')[0] || 'Visitante'}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Status Card */}
        <div className="px-6 -mt-10 relative z-20">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-lg border border-[#C5A059]/30 dark:border-[#C5A059]/10"
            >
                <div className="flex justify-between items-end mb-2">
                    <span className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] text-sm">Progresso Geral</span>
                    <span className="font-montserrat font-bold text-2xl dark:text-gray-200">{progressPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className="bg-[#C5A059] h-2.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <p className="text-right text-xs text-gray-400 mt-1 font-montserrat">{userProgress?.total_chapters || 0} / {TOTAL_CHAPTERS} Capítulos</p>
            </motion.div>
        </div>

        {/* Menu Grid */}
        <div className="p-6 grid grid-cols-3 gap-4">
            {menuItems.map((item, idx) => (
                <motion.button 
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => onNavigate(item.id)} 
                    className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-md flex flex-col items-center gap-3 border border-[#C5A059]/20 hover:shadow-xl transition-all active:scale-95"
                >
                    <div className={`w-12 h-12 rounded-2xl ${item.color} bg-opacity-10 dark:bg-opacity-20 flex items-center justify-center`}>
                        <item.icon className={`w-6 h-6 ${item.color.replace('bg-', 'text-')} dark:text-white`} />
                    </div>
                    <span className="font-cinzel font-bold text-[#1a0f0f] dark:text-gray-200 text-xs text-center">{item.label}</span>
                </motion.button>
            ))}
            
            {isAdmin && (
                <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => onNavigate('admin')} 
                    className="col-span-3 bg-[#1a0f0f] dark:bg-black text-white p-4 rounded-xl shadow-lg flex items-center justify-center gap-3 mt-2 border border-[#C5A059]"
                >
                    <ShieldCheck className="w-5 h-5 text-[#C5A059]" />
                    <span className="font-cinzel font-bold text-[#C5A059]">Painel Editor Chefe (Admin)</span>
                </motion.button>
            )}
        </div>

        {/* Instagram Button */}
        <div className="px-6 mt-2">
            <a 
                href="https://www.instagram.com/adma.vilardosteles/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white p-4 rounded-xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-transform"
            >
                <Instagram className="w-6 h-6" />
                <span className="font-cinzel font-bold">Nos Siga no Insta</span>
            </a>
        </div>
        
        <div className="text-center mt-4 opacity-60 pb-10 flex flex-col items-center gap-1">
            <p className="font-cinzel text-xs flex items-center gap-1 text-green-700 dark:text-green-500 font-bold">
                 <CheckCircle2 className="w-3 h-3"/> {APP_VERSION}
            </p>
            <p className="text-[10px] text-gray-400">Sistema Conectado</p>
        </div>
    </div>
  );
}