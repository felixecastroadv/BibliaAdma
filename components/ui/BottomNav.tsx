
import React from 'react';
import { Home, BookOpen, Calendar, ListChecks, Trophy } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export default function BottomNav({ currentView, onNavigate }: BottomNavProps) {
  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Início' },
    { id: 'reader', icon: BookOpen, label: 'Bíblia' },
    { id: 'devotional', icon: Calendar, label: 'Devocional' },
    { id: 'plans', icon: ListChecks, label: 'Planos' },
    { id: 'ranking', icon: Trophy, label: 'Ranking' },
  ];

  if (currentView === 'admin' || currentView === 'login' || currentView === 'reader') return null;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white/80 dark:bg-[#1E1E1E]/80 backdrop-blur-xl border-t border-[#C5A059]/20 shadow-[0_-5px_30px_rgba(0,0,0,0.05)] z-40 pb-safe transition-all duration-300">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all active:scale-90 group relative ${
                isActive 
                  ? 'text-[#8B0000] dark:text-[#ff6b6b]' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {/* Efeito de Glow no item ativo */}
              {isActive && (
                <div className="absolute top-1 w-8 h-8 bg-[#8B0000]/10 dark:bg-[#ff6b6b]/10 rounded-full blur-sm" />
              )}
              
              <item.icon className={`w-6 h-6 relative z-10 ${isActive ? 'fill-current opacity-100 stroke-[2.5px] drop-shadow-sm' : 'stroke-2'}`} />
              
              <span className={`text-[10px] font-montserrat font-bold relative z-10 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} transition-all duration-300`}>
                {item.label}
              </span>
              
              {/* Indicador de Ponto */}
              {isActive && (
                <span className="absolute -bottom-1 w-1 h-1 bg-[#8B0000] dark:bg-[#ff6b6b] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
