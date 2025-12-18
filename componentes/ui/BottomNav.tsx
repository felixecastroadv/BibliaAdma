
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

  if (currentView === 'login') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-t border-white/5 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = currentView === item.id || (item.id === 'reader' && currentView === 'reader');
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex flex-col items-center justify-center w-full h-full relative"
            >
              <item.icon 
                className={`w-6 h-6 transition-all duration-300 ${
                  isActive 
                  ? 'text-[#C5A059] scale-110' 
                  : 'text-gray-500 hover:text-gray-300'
                }`} 
              />
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-[#C5A059] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
