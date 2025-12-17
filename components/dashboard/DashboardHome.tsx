import React, { useState, useEffect } from 'react';
import { BookOpen, GraduationCap, ShieldCheck, Trophy, Calendar, ListChecks, Mail, CheckCircle2, Moon, Sun, Download, Instagram, X, Share, MoreVertical, Monitor, LogOut, Sparkles, Brain, FileText, Link as LinkIcon, Star, Smartphone, ArrowUpRight } from 'lucide-react';
import { CHURCH_NAME, TOTAL_CHAPTERS, APP_VERSION, PASTOR_PRESIDENT } from '../../constants';
import { motion as motionBase, AnimatePresence } from 'framer-motion';
import { AppConfig, DynamicModule } from '../../types';
import { db } from '../../services/database';

// Fix for TypeScript errors with framer-motion props
const motion = motionBase as any;

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
    appConfig: AppConfig | null;
}

export default function DashboardHome({ onNavigate, isAdmin, onEnableAdmin, user, userProgress, darkMode, toggleDarkMode, onShowToast, onLogout, appConfig }: DashboardProps) {
  const [clicks, setClicks] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  
  // Install Instructions State
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<'ios' | 'android' | 'desktop'>('android');
  
  // Dynamic Modules
  const [dynamicModules, setDynamicModules] = useState<DynamicModule[]>([]);

  useEffect(() => {
    const loadModules = async () => {
        try {
            const modules = await db.entities.DynamicModules.list();
            setDynamicModules(modules);
        } catch(e) {}
    };
    loadModules();
  }, []);

  useEffect(() => {
    // 1. Detectar se já está instalado/standalone
    const checkStandalone = () => {
        const isStand = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;
        setIsStandalone(isStand);
    };
    checkStandalone();
    window.addEventListener('resize', checkStandalone);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault(); 
      setDeferredPrompt(e);
      setIsStandalone(false);
    };

    const handleAppInstalled = () => {
        setIsStandalone(true);
        setDeferredPrompt(null);
        setShowInstallModal(false);
        onShowToast("Aplicativo instalado com sucesso!", "success");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Detect Platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setInstallPlatform('ios');
    else if (/android/.test(ua)) setInstallPlatform('android');
    else setInstallPlatform('desktop');

    return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('resize', checkStandalone);
        window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
        // Chrome/Edge/Android Nativo (Suporte Automático)
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
        // iOS, Firefox, Navegadores Nativos (Instrução Manual)
        setShowInstallModal(true);
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

  // Base Menu Items
  const baseMenuItems = [
    { id: 'reader', icon: BookOpen, label: 'Bíblia Sagrada', desc: 'Leitura & Exegese', color: 'from-red-900 to-red-800' },
    { id: 'panorama', icon: GraduationCap, label: 'EBD Panorama', desc: 'Estudos Profundos', color: 'from-blue-900 to-blue-800' },
  ];

  // Feature Flags from Config
  const features = appConfig?.features || { enableDevotional: true, enablePlans: true, enableRanking: true, enableMessages: true };

  if (features.enableDevotional) baseMenuItems.push({ id: 'devotional', icon: Calendar, label: 'Devocional', desc: 'Palavra Diária', color: 'from-purple-900 to-purple-800' });
  if (features.enablePlans) baseMenuItems.push({ id: 'plans', icon: ListChecks, label: 'Planos', desc: 'Metas de Leitura', color: 'from-green-900 to-green-800' });
  if (features.enableRanking) baseMenuItems.push({ id: 'ranking', icon: Trophy, label: 'Ranking', desc: 'Conquistas', color: 'from-amber-700 to-amber-600' });
  if (features.enableMessages) baseMenuItems.push({ id: 'messages', icon: Mail, label: 'Mensagens', desc: 'Mural da Igreja', color: 'from-pink-800 to-pink-700' });

  // Map dynamic modules to menu items
  const dynamicItems = dynamicModules.map(mod => {
      // Icon mapping
      const IconMap: any = { 'Brain': Brain, 'FileText': FileText, 'Link': LinkIcon, 'Star': Star };
      const Icon = IconMap[mod.iconName] || Star;
      
      return {
          id: `module_${mod.id}`,
          icon: Icon,
          label: mod.title,
          desc: mod.type === 'quiz' ? 'Desafio Bíblico' : mod.description,
          color: 'from-cyan-700 to-cyan-600',
          module: mod // Passar o objeto inteiro
      };
  });

  const allMenuItems = [...baseMenuItems, ...dynamicItems];
  const progressPercent = userProgress ? Math.min(100, (userProgress.total_chapters / TOTAL_CHAPTERS) * 100) : 0;
  const readCount = userProgress?.total_chapters || 0;
  
  // Custom Styles from Config
  const primaryColor = appConfig?.theme?.primaryColor || '#8B0000';
  const appName = appConfig?.theme?.appName || 'Bíblia ADMA';

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-500 font-sans">
        
        {/* MODAL DE INSTRUÇÕES DE INSTALAÇÃO */}
        <AnimatePresence>
            {showInstallModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowInstallModal(false)}
                    />
                    <motion.div 
                        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-[#1E1E1E] w-full max-w-sm rounded-3xl p-6 relative z-10 shadow-2xl border border-[#C5A059]/30"
                    >
                        <button onClick={() => setShowInstallModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><X /></button>
                        
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-[#F5F5DC] dark:bg-gray-800 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-inner">
                                {installPlatform === 'ios' ? <Share className="w-8 h-8 text-[#C5A059]" /> : <MoreVertical className="w-8 h-8 text-[#C5A059]" />}
                            </div>
                            <h3 className="font-cinzel font-bold text-xl text-[#1a0f0f] dark:text-white">Instalar App</h3>
                            <p className="text-xs text-gray-500 mt-2 font-montserrat">Siga os passos para adicionar à tela inicial:</p>
                        </div>

                        <div className="space-y-4 bg-gray-50 dark:bg-black/20 p-4 rounded-xl">
                            {installPlatform === 'ios' && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                        <p className="text-sm dark:text-gray-300">Toque no botão <span className="font-bold text-[#007AFF]">Compartilhar</span> (ícone quadrado com seta) na barra inferior.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                        <p className="text-sm dark:text-gray-300">Role para baixo e selecione <span className="font-bold">"Adicionar à Tela de Início"</span>.</p>
                                    </div>
                                </>
                            )}
                            {(installPlatform === 'android' || installPlatform === 'desktop') && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                        <p className="text-sm dark:text-gray-300">Toque no menu do navegador (três pontos <MoreVertical className="w-3 h-3 inline"/>).</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                        <p className="text-sm dark:text-gray-300">Selecione <span className="font-bold">"Instalar aplicativo"</span> ou "Adicionar à tela inicial".</p>
                                    </div>
                                </>
                            )}
                        </div>

                        <button onClick={() => setShowInstallModal(false)} className="w-full mt-6 bg-[#8B0000] text-white py-3 rounded-xl font-bold font-cinzel text-sm hover:bg-[#600018]">
                            Entendi
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
        
        {/* HERO SECTION - LUXURY EDITION */}
        <div className="relative bg-[#0F0505] text-white pb-28 rounded-b-[40px] shadow-2xl overflow-hidden isolate">
             
             {/* Background Layers */}
             <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(to bottom, ${primaryColor}, #150505)` }}></div>
             <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay z-0"></div>
             
             {/* Top Bar */}
             <div className="relative z-20 px-6 pt-6 flex justify-between items-center">
                <AnimatePresence>
                    {!isStandalone && (
                        <motion.button 
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            onClick={handleInstallClick} 
                            className="bg-white/5 backdrop-blur-md border border-white/10 text-white/90 px-4 py-2 rounded-full flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95 shadow-lg"
                        >
                            <Download className="w-3 h-3" /> <span className="text-[10px] font-bold uppercase">Instalar App</span>
                        </motion.button>
                    )}
                </AnimatePresence>
                <div className={`flex gap-3 ${isStandalone ? 'ml-auto' : ''}`}>
                    <button onClick={toggleDarkMode} className="p-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10"><Sun className="w-4 h-4" /></button>
                    <button onClick={onLogout} className="p-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-red-500/20"><LogOut className="w-4 h-4" /></button>
                </div>
            </div>

            {/* Content Center */}
            <div className="relative z-10 px-6 pt-8 flex flex-col items-center justify-center text-center space-y-5">
                
                {/* Church Name */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h3 className="font-montserrat text-[9px] font-bold tracking-[0.4em] text-[#C5A059] uppercase opacity-90">{CHURCH_NAME}</h3>
                </motion.div>

                {/* Logo with LED Glow Effect */}
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} 
                    className="relative group cursor-pointer my-2" 
                    onClick={handleLogoClick}
                >
                    {/* The LED Glow */}
                    <div className="absolute inset-0 bg-[#C5A059] blur-[50px] opacity-20 rounded-full animate-pulse"></div>
                    
                    <div className="relative w-28 h-28 bg-gradient-to-br from-[#ffffff]/10 to-transparent rounded-[36px] border border-[#C5A059]/40 shadow-[0_0_30px_-5px_rgba(197,160,89,0.3)] backdrop-blur-md flex items-center justify-center ring-1 ring-[#C5A059]/20">
                        <BookOpen className="w-12 h-12 text-[#C5A059] drop-shadow-[0_2px_10px_rgba(197,160,89,0.5)]" />
                    </div>
                </motion.div>

                {/* App Title & Info */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
                    <div>
                        <h1 className="font-cinzel text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">{appName}</h1>
                        <p className="font-cormorant text-xl text-[#C5A059] italic font-medium mt-1">Prof. Michel Felix</p>
                    </div>
                    
                    {/* President Divider */}
                    <div className="flex items-center justify-center gap-3 opacity-80 pt-1">
                        <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-[#C5A059]"></div>
                        <p className="font-cinzel text-[10px] uppercase tracking-widest text-gray-300">Presidente: {PASTOR_PRESIDENT}</p>
                        <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-[#C5A059]"></div>
                    </div>
                </motion.div>

                {/* Instagram Button - Bottom & Elegant */}
                <motion.a 
                    href="https://www.instagram.com/adma.vilardosteles/" 
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="mt-6 px-6 py-2.5 rounded-full border border-[#C5A059]/50 text-[#C5A059] font-cinzel text-xs font-bold flex items-center gap-2 hover:bg-[#C5A059]/10 hover:border-[#C5A059] hover:shadow-[0_0_20px_rgba(197,160,89,0.4)] transition-all active:scale-95 group"
                >
                    <Instagram className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span className="tracking-wide">Nos siga no Instagram</span>
                </motion.a>
            </div>
        </div>

        {/* PROGRESS CARD */}
        <div className="px-6 -mt-16 relative z-30 mb-8">
            <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} 
                className="bg-white dark:bg-[#1E1E1E] p-6 rounded-[32px] border border-[#C5A059]/20 backdrop-blur-sm relative overflow-hidden transition-all duration-300 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_30px_-5px_rgba(197,160,89,0.15)]"
            >
                <div className="flex justify-between items-end mb-4 relative z-10">
                    <div className="flex flex-col">
                        <span className="font-montserrat text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Sparkles className="w-3 h-3 text-[#C5A059]" /> Progresso</span>
                        <span className="font-cinzel font-bold text-xl" style={{ color: primaryColor }}>Leitura Bíblica</span>
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-1 font-mono tracking-tight bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md self-start border border-gray-200 dark:border-white/10">
                            {readCount} <span className="opacity-60">/ {TOTAL_CHAPTERS} caps</span>
                        </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="font-montserrat font-bold text-4xl dark:text-white leading-none">{progressPercent.toFixed(0)}</span>
                        <span className="text-sm text-gray-400 font-bold">%</span>
                    </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-black/40 rounded-full h-2 mb-3 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} className="h-full rounded-full shadow-[0_0_15px_rgba(197,160,89,0.4)]" style={{ background: `linear-gradient(to right, ${primaryColor}, #C5A059)` }}></motion.div>
                </div>
            </motion.div>
        </div>

        {/* MENU GRID (Merged Static + Dynamic) */}
        <div className="px-6 pb-32 grid grid-cols-2 gap-4">
            {allMenuItems.map((item, idx) => (
                <motion.button 
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + (idx * 0.05) }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                    onClick={() => onNavigate(item.id, { module: (item as any).module })} 
                    className="relative overflow-hidden group bg-white dark:bg-[#1E1E1E] p-6 rounded-[24px] text-left h-40 flex flex-col justify-between border transition-all duration-300 
                    border-gray-200 shadow-lg hover:shadow-2xl hover:border-[#8B0000]/30 
                    dark:border-white/15 dark:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] dark:hover:shadow-[0_0_30px_-5px_rgba(197,160,89,0.4)] dark:hover:border-[#C5A059]/60"
                >
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md text-white mb-2`}>
                        <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="font-cinzel font-bold text-[#1a0f0f] dark:text-gray-100 text-base block leading-tight mb-1">{item.label}</span>
                        <span className="font-montserrat text-[10px] text-gray-400 dark:text-gray-500 font-medium block">{item.desc}</span>
                    </div>
                </motion.button>
            ))}
            
            {isAdmin && (
                <motion.button 
                    onClick={() => onNavigate('admin')} 
                    className="col-span-2 bg-[#1a0f0f] dark:bg-black text-[#C5A059] p-5 rounded-3xl flex items-center justify-center gap-4 group mt-4 relative overflow-hidden border border-[#C5A059]/30 
                    shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3)] hover:shadow-[0_0_25px_-5px_rgba(197,160,89,0.3)] hover:border-[#C5A059]/50 transition-all duration-300"
                >
                    <ShieldCheck className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    <div className="text-left relative z-10">
                        <span className="font-cinzel font-bold block text-sm">Painel Editor Chefe</span>
                        <span className="text-[10px] opacity-60 uppercase tracking-widest">Builder & Config</span>
                    </div>
                </motion.button>
            )}
        </div>
    </div>
  );
}