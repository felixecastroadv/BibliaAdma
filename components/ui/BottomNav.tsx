
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

  // Não exibir a barra em telas que precisam de imersão total (Leitor), admin ou login
  if (currentView === 'admin' || currentView === 'login' || currentView === 'reader') return null;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-[#1E1E1E] border-t border-[#C5A059]/30 shadow-[0_-5px_15px_rgba(0,0,0,0.1)] z-40 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all active:scale-95 ${
                isActive 
                  ? 'text-[#8B0000] dark:text-[#ff6b6b]' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'fill-current opacity-20 stroke-[2.5px]' : 'stroke-2'}`} />
              <span className={`text-[10px] font-montserrat font-bold ${isActive ? 'opacity-100' : 'opacity-0 scale-0'} transition-all duration-200`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 bg-[#8B0000] dark:bg-[#ff6b6b] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
