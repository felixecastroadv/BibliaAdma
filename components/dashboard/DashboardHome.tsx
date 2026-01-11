
import { useState, useEffect } from 'react';
// Added Instagram to lucide-react imports
import { BookOpen, GraduationCap, ShieldCheck, Trophy, Calendar, ListChecks, Mail, Moon, Sun, X, Share, MoreVertical, LogOut, Sparkles, Brain, FileText, Link as LinkIcon, Star, MapPin, Monitor, Smartphone, PlusSquare, Instagram } from 'lucide-react';
import { CHURCH_NAME, TOTAL_CHAPTERS, PASTOR_PRESIDENT } from '../../constants';
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
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
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
    const checkStandalone = () => {
        const isStand = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;
        setIsStandalone(isStand);
    };
    checkStandalone();

    const handleBeforeInstall = (e: any) => {
      console.log('Capturado evento de instalação PWA');
      e.preventDefault(); 
      setDeferredPrompt(e);
      setIsStandalone(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
    else if (/android/.test(ua)) setPlatform('android');
    else setPlatform('desktop');

    return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (platform === 'ios') {
        setShowInstallModal(true);
        return;
    }

    if (deferredPrompt) {
        // DISPARA A INSTALAÇÃO REAL NO PC/ANDROID
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('Resultado da instalação:', outcome);
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsStandalone(true);
        }
    } else {
        // Se já instalou ou o navegador não disparou o evento, mostra o guia
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

  const baseMenuItems = [
    { id: 'reader', icon: BookOpen, label: 'Bíblia Sagrada', desc: 'Leitura & Exegese', color: 'from-red-900 to-red-800' },
    { id: 'panorama', icon: GraduationCap, label: 'EBD Panorama', desc: 'Estudos Profundos', color: 'from-blue-900 to-blue-800' },
  ];

  const features = appConfig?.features || { enableDevotional: true, enablePlans: true, enableRanking: true, enableMessages: true };

  if (features.enableDevotional) baseMenuItems.push({ id: 'devotional', icon: Calendar, label: 'Devocional', desc: 'Palavra Diária', color: 'from-purple-900 to-purple-800' });
  if (features.enablePlans) baseMenuItems.push({ id: 'plans', icon: ListChecks, label: 'Planos', desc: 'Metas de Leitura', color: 'from-green-900 to-green-800' });
  if (features.enableRanking) baseMenuItems.push({ id: 'ranking', icon: Trophy, label: 'Ranking', desc: 'Conquistas', color: 'from-amber-700 to-amber-600' });
  if (features.enableMessages) baseMenuItems.push({ id: 'messages', icon: Mail, label: 'Mensagens', desc: 'Mural da Igreja', color: 'from-pink-800 to-pink-700' });

  const dynamicItems = dynamicModules.map(mod => {
      const IconMap: any = { 'Brain': Brain, 'FileText': FileText, 'Link': LinkIcon, 'Star': Star };
      const Icon = IconMap[mod.iconName] || Star;
      return {
          id: `module_${mod.id}`,
          icon: Icon,
          label: mod.title,
          desc: mod.type === 'quiz' ? 'Desafio Bíblico' : mod.description,
          color: 'from-cyan-700 to-cyan-600',
          module: mod
      };
  });

  const allMenuItems = [...baseMenuItems, ...dynamicItems];
  const progressPercent = userProgress ? Math.min(100, (userProgress.total_chapters / TOTAL_CHAPTERS) * 100) : 0;
  const readCount = userProgress?.total_chapters || 0;
  const primaryColor = appConfig?.theme?.primaryColor || '#8B0000';
  const appName = appConfig?.theme?.appName || 'Bíblia ADMA';

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-500 font-sans">
        <AnimatePresence>
            {showInstallModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowInstallModal(false)} />
                    <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-[#1E1E1E] w-full max-w-sm rounded-[40px] p-8 relative z-10 shadow-2xl border border-[#C5A059]/30" >
                        <button onClick={() => setShowInstallModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 transition-colors"><X /></button>
                        
                        <div className="text-center mb-8">
                            <div className="relative inline-block mb-4">
                                <div className="absolute inset-0 bg-[#C5A059] blur-2xl opacity-20 animate-pulse"></div>
                                <div className="relative w-20 h-20 bg-gradient-to-br from-[#8B0000] to-[#500000] rounded-3xl mx-auto flex items-center justify-center shadow-xl border border-[#C5A059]/30">
                                    <BookOpen className="w-10 h-10 text-[#F5F5DC]" />
                                </div>
                            </div>
                            <h3 className="font-cinzel font-bold text-2xl text-[#1a0f0f] dark:text-white">Instalação Bíblia ADMA</h3>
                            <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-bold">App instalado para uso Offline</p>
                        </div>

                        <div className="space-y-6">
                            {platform === 'ios' ? (
                                <div className="space-y-5">
                                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl">
                                        <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                                            <Share className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <p className="text-sm font-medium dark:text-gray-200">1. Toque no botão <span className="font-bold">Compartilhar</span> no Safari.</p>
                                    </div>
                                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl">
                                        <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                                            <PlusSquare className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                                        </div>
                                        <p className="text-sm font-medium dark:text-gray-200">2. Escolha <span className="font-bold">"Adicionar à Tela de Início"</span>.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-4 bg-gray-50 dark:bg-black/20 rounded-2xl">
                                    <Monitor className="w-8 h-8 mx-auto mb-3 text-[#C5A059]" />
                                    <p className="text-sm font-medium dark:text-gray-200">O App já pode ser instalado pela barra de endereços do Chrome ou clicando no botão "Instalar" no topo.</p>
                                </div>
                            )}
                        </div>
                        
                        <button onClick={() => setShowInstallModal(false)} className="w-full mt-8 bg-[#1a0f0f] dark:bg-white dark:text-black text-white font-cinzel font-bold py-4 rounded-2xl text-sm tracking-widest shadow-lg">ENTENDI</button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
        
        <div className="relative bg-[#0F0505] text-white pb-28 rounded-b-[40px] shadow-2xl overflow-hidden isolate">
             <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(to bottom, ${primaryColor}, #150505)` }}></div>
             <div className="relative z-20 px-6 pt-10 flex justify-between items-center">
                {(!isStandalone || deferredPrompt) && (
                    <motion.button 
                        initial={{ x: -20, opacity: 0 }} 
                        animate={{ x: 0, opacity: 1 }}
                        onClick={handleInstallClick} 
                        className="group flex items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 pl-1.5 pr-5 py-1.5 rounded-full transition-all active:scale-95"
                    >
                        <div className="w-8 h-8 bg-gradient-to-br from-[#C5A059] to-[#9e8045] rounded-full flex items-center justify-center shadow-lg">
                            <PlusSquare className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-[10px] font-black uppercase tracking-tighter leading-none">Instalar</span>
                            <span className="text-[8px] opacity-60 uppercase font-bold tracking-widest">App ADMA</span>
                        </div>
                    </motion.button>
                )}
                <div className={`flex gap-3 ml-auto`}>
                    <button onClick={toggleDarkMode} className="p-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors">{darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
                    <button onClick={onLogout} className="p-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-red-500/20 transition-colors"><LogOut className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="relative z-10 px-6 pt-8 flex flex-col items-center justify-center text-center space-y-5">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-montserrat text-[9px] font-bold tracking-[0.4em] text-[#C5A059] uppercase">{CHURCH_NAME}</h3>
                </motion.div>

                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative group cursor-pointer my-2" onClick={handleLogoClick}>
                    <div className="absolute inset-0 bg-[#C5A059] blur-[50px] opacity-20 rounded-full animate-pulse"></div>
                    <div className="relative w-28 h-28 bg-gradient-to-br from-[#ffffff]/10 to-transparent rounded-[36px] border border-[#C5A059]/40 shadow-[0_0_30px_-5px_rgba(197,160,89,0.3)] backdrop-blur-md flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-[#C5A059]" />
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <h1 className="font-cinzel text-4xl md:text-5xl font-bold text-white tracking-tight">{appName}</h1>
                    <p className="font-cormorant text-xl text-[#C5A059] italic font-medium mt-1">Prof. Michel Felix</p>
                    <p className="font-cinzel text-[10px] uppercase tracking-widest text-gray-300">Presidente: {PASTOR_PRESIDENT}</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-wrap justify-center gap-3 px-4">
                    <a href="https://www.instagram.com/adma.vilardosteles/" target="_blank" rel="noopener noreferrer" className="px-6 py-2.5 rounded-full border border-[#C5A059]/50 text-[#C5A059] font-cinzel text-[10px] font-bold flex items-center gap-2 hover:bg-[#C5A059]/10 transition-colors">
                        <Instagram className="w-3.5 h-3.5" /> <span>Instagram</span>
                    </a>
                    <a href="https://maps.app.goo.gl/cyZBbWNGFaAjEm2aA" target="_blank" rel="noopener noreferrer" className="px-6 py-2.5 rounded-full bg-[#8B0000]/20 border border-[#8B0000]/40 text-white font-cinzel text-[10px] font-bold flex items-center gap-2 hover:bg-[#8B0000]/40 transition-colors">
                        <MapPin className="w-3.5 h-3.5 text-[#C5A059]" /> <span>Localização</span>
                    </a>
                </motion.div>
            </div>
        </div>

        <div className="px-6 -mt-16 relative z-30 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-[#1E1E1E] p-6 rounded-[32px] border border-[#C5A059]/20 shadow-xl">
                <div className="flex justify-between items-end mb-4">
                    <div className="flex flex-col">
                        <span className="font-montserrat text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Sparkles className="w-3 h-3 text-[#C5A059]" /> Progresso</span>
                        <span className="font-cinzel font-bold text-xl" style={{ color: primaryColor }}>Leitura Bíblica</span>
                        <span className="text-[11px] font-bold text-gray-500 mt-1 font-mono">{readCount} / {TOTAL_CHAPTERS} caps</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="font-montserrat font-bold text-4xl dark:text-white">{progressPercent.toFixed(0)}</span>
                        <span className="text-sm text-gray-400 font-bold">%</span>
                    </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-black/40 rounded-full h-2 mb-3">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} className="h-full rounded-full" style={{ background: `linear-gradient(to right, ${primaryColor}, #C5A059)` }}></motion.div>
                </div>
            </motion.div>
        </div>

        <div className="px-6 pb-32 grid grid-cols-2 gap-4">
            {allMenuItems.map((item, idx) => (
                <motion.button key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * idx }} onClick={() => onNavigate(item.id, { module: (item as any).module })} className="bg-white dark:bg-[#1E1E1E] p-6 rounded-[24px] text-left h-40 flex flex-col justify-between border border-gray-200 dark:border-white/15 shadow-lg hover:shadow-xl transition-all active:scale-95 group">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white mb-2 shadow-md group-hover:scale-110 transition-transform`}>
                        <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="font-cinzel font-bold text-[#1a0f0f] dark:text-gray-100 text-base block mb-1">{item.label}</span>
                        <span className="font-montserrat text-[10px] text-gray-400 font-medium block">{item.desc}</span>
                    </div>
                </motion.button>
            ))}
            {isAdmin && (
                <button onClick={() => onNavigate('admin')} className="col-span-2 bg-[#1a0f0f] dark:bg-black text-[#C5A059] p-5 rounded-3xl flex items-center justify-center gap-4 border border-[#C5A059]/30 hover:bg-black transition-colors shadow-lg active:scale-95">
                    <ShieldCheck className="w-6 h-6" />
                    <div className="text-left">
                        <span className="font-cinzel font-bold block text-sm">Painel Editor Chefe</span>
                        <span className="text-[10px] opacity-60 uppercase">Builder & Config</span>
                    </div>
                </button>
            )}
        </div>
    </div>
  );
}
