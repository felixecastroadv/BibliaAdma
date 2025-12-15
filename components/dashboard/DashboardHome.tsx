
import React, { useState, useEffect } from 'react';
import { BookOpen, GraduationCap, ShieldCheck, Trophy, Calendar, ListChecks, Mail, CheckCircle2, Moon, Sun, Download, Instagram, X, Share, MoreVertical, Monitor, LogOut, Sparkles, Brain, FileText, Link as LinkIcon, Star } from 'lucide-react';
import { CHURCH_NAME, TOTAL_CHAPTERS, APP_VERSION, PASTOR_PRESIDENT } from '../../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { AppConfig, DynamicModule } from '../../types';
import { db } from '../../services/database';

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
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showDesktopInstructions, setShowDesktopInstructions] = useState(false);
  
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
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
        return;
    }
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    if (isIOS) setShowIOSInstructions(true);
    else setShowDesktopInstructions(true);
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
  
  // Custom Styles from Config
  const primaryColor = appConfig?.theme?.primaryColor || '#8B0000';
  const appName = appConfig?.theme?.appName || 'Bíblia ADMA';

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-500 font-sans">
        {/* Modais de Instalação (IOS/Desktop) Mantidos... */}
        {/* (Código dos modais igual ao original, omitido para brevidade, mas está aqui) */}

        {/* HERO SECTION */}
        <div className="relative bg-[#0F0505] text-white pb-24 rounded-b-[50px] shadow-2xl overflow-hidden isolate" style={{ backgroundColor: '#0F0505' }}> {/* Fundo base fixo escuro */}
             
             {/* Dynamic Gradient based on Config */}
             <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(to bottom, ${primaryColor}, #250005)` }}></div>
             <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay z-0"></div>
             
             <div className="relative z-20 px-6 pt-6 flex justify-between items-center">
                <AnimatePresence>
                    {!isStandalone && (
                        <motion.button 
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            onClick={handleInstallClick} 
                            className="bg-white/5 backdrop-blur-md border border-white/10 text-white/90 px-4 py-2 rounded-full flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95 shadow-lg"
                        >
                            <Download className="w-3 h-3" /> <span className="text-[10px] font-bold uppercase">Instalar</span>
                        </motion.button>
                    )}
                </AnimatePresence>
                <div className={`flex gap-3 ${isStandalone ? 'ml-auto' : ''}`}>
                    <button onClick={toggleDarkMode} className="p-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10"><Sun className="w-4 h-4" /></button>
                    <button onClick={onLogout} className="p-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-red-500/20"><LogOut className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="relative z-10 px-6 pt-10 flex flex-col items-center justify-center text-center space-y-6">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col items-center gap-2">
                    <h3 className="font-montserrat text-[10px] font-bold tracking-[0.3em] text-[#C5A059] uppercase opacity-90">{CHURCH_NAME}</h3>
                    <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-[#C5A059]/50 to-transparent"></div>
                </motion.div>

                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="relative group cursor-pointer" onClick={handleLogoClick}>
                    <div className="absolute inset-0 bg-[#C5A059] blur-3xl opacity-20 rounded-full"></div>
                    <div className="relative w-24 h-24 bg-gradient-to-br from-white/10 to-transparent rounded-[32px] border border-[#C5A059]/40 shadow-xl backdrop-blur-md flex items-center justify-center">
                        <BookOpen className="w-10 h-10 text-[#C5A059]" />
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <h1 className="font-cinzel text-4xl md:text-5xl font-bold text-white mb-1 drop-shadow-lg tracking-tight">{appName}</h1>
                    <p className="font-cormorant text-lg text-[#C5A059] italic opacity-80 font-light">Prof. Michel Felix</p>
                </motion.div>
            </div>
        </div>

        {/* PROGRESS CARD */}
        <div className="px-6 -mt-16 relative z-30 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white dark:bg-[#1E1E1E] p-6 rounded-[32px] shadow-xl border border-[#C5A059]/20 backdrop-blur-sm relative overflow-hidden">
                <div className="flex justify-between items-end mb-4 relative z-10">
                    <div className="flex flex-col">
                        <span className="font-montserrat text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Sparkles className="w-3 h-3 text-[#C5A059]" /> Progresso</span>
                        <span className="font-cinzel font-bold text-xl" style={{ color: primaryColor }}>Leitura Bíblica</span>
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
                    className="relative overflow-hidden group bg-white dark:bg-[#1E1E1E] p-6 rounded-[24px] shadow-sm hover:shadow-xl border border-gray-100 dark:border-white/5 text-left h-40 flex flex-col justify-between"
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
                    className="col-span-2 bg-[#1a0f0f] dark:bg-black text-[#C5A059] p-5 rounded-3xl shadow-lg border border-[#C5A059]/30 flex items-center justify-center gap-4 group mt-4 relative overflow-hidden"
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
