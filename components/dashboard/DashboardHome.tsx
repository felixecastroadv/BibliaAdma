
import React, { useRef } from 'react';
import { BookOpen, GraduationCap, Trophy, Calendar, ListChecks, Mail, Moon, Sun, LogOut, ShieldCheck, Sparkles } from 'lucide-react';
import { TOTAL_CHAPTERS } from '../../constants';

export default function DashboardHome({ onNavigate, isAdmin, onEnableAdmin, user, userProgress, darkMode, toggleDarkMode, onShowToast, onLogout }: any) {
  const progressPercent = userProgress ? Math.min(100, (userProgress.total_chapters / TOTAL_CHAPTERS) * 100) : 0;

  // Fix: Use local refs instead of window object to track clicks for the hidden admin toggle
  const clicksRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleAdminTrigger = () => {
    clicksRef.current++;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    if (clicksRef.current >= 5) {
      onEnableAdmin();
      clicksRef.current = 0;
    } else {
      timeoutRef.current = setTimeout(() => {
        clicksRef.current = 0;
      }, 3000);
    }
  };

  const menuItems = [
    { id: 'reader', icon: BookOpen, label: 'Bíblia', color: 'bg-red-700' },
    { id: 'panorama', icon: GraduationCap, label: 'EBD Panorama', color: 'bg-blue-700' },
    { id: 'devotional', icon: Calendar, label: 'Devocional', color: 'bg-purple-700' },
    { id: 'plans', icon: ListChecks, label: 'Planos', color: 'bg-green-700' },
    { id: 'ranking', icon: Trophy, label: 'Ranking', color: 'bg-amber-600' },
    { id: 'messages', icon: Mail, label: 'Mensagens', color: 'bg-pink-700' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        {/* Fixed error: Property 'clicks' does not exist on type 'Window' */}
        <div onClick={handleAdminTrigger} className="cursor-pointer">
          <h1 className="font-cinzel text-2xl font-bold text-primary dark:text-white">Bíblia ADMA</h1>
          <p className="text-sm opacity-60">Prof. Michel Felix</p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleDarkMode} className="p-2 rounded-full bg-gray-200 dark:bg-gray-800">{darkMode ? <Sun size={20}/> : <Moon size={20}/>}</button>
          <button onClick={onLogout} className="p-2 rounded-full bg-red-100 text-red-600"><LogOut size={20}/></button>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-card p-6 rounded-3xl shadow-xl border border-secondary/20">
        <div className="flex justify-between items-end mb-4">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase">Seu Progresso</span>
            <h2 className="font-cinzel text-xl text-primary dark:text-white">Leitura Bíblica</h2>
          </div>
          <span className="font-montserrat font-bold text-3xl">{progressPercent.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-black/40 h-2 rounded-full overflow-hidden">
          <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {menuItems.map(item => (
          <button key={item.id} onClick={() => onNavigate(item.id)} className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg text-left space-y-3">
            <div className={`w-10 h-10 rounded-xl ${item.color} text-white flex items-center justify-center`}><item.icon size={20}/></div>
            <span className="font-cinzel font-bold block">{item.label}</span>
          </button>
        ))}
      </div>

      {isAdmin && (
        <button onClick={() => onNavigate('admin')} className="w-full bg-dark text-secondary p-5 rounded-2xl flex items-center justify-center gap-3 border border-secondary/30">
          <ShieldCheck /> <span>Painel Editor Chefe</span>
        </button>
      )}
    </div>
  );
}
