import React from 'react';
import { Home, BookOpen, Calendar, ListChecks, Trophy } from 'lucide-react';

export default function BottomNav({ currentView, onNavigate }: any) {
  const items = [
    { id: 'dashboard', icon: Home },
    { id: 'reader', icon: BookOpen },
    { id: 'devotional', icon: Calendar },
    { id: 'plans', icon: ListChecks },
    { id: 'ranking', icon: Trophy },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-dark-card/80 backdrop-blur-xl h-16 flex justify-around items-center border-t border-gray-200 dark:border-white/5 z-40">
      {items.map(i => (
        <button key={i.id} onClick={() => onNavigate(i.id)} className={`p-2 transition-all ${currentView === i.id ? 'text-primary' : 'text-gray-400'}`}><i.icon/></button>
      ))}
    </div>
  );
}