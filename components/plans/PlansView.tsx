import React, { useState } from 'react';
import { ChevronLeft, CheckCircle, BookOpen, ChevronRight } from 'lucide-react';
import { READING_PLANS } from '../../constants';

export default function PlansView({ onBack, onNavigate }: any) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  if (selectedPlan) {
    return (
        <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg transition-colors duration-300">
            <div className="bg-[#8B0000] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg z-10">
                <button onClick={() => setSelectedPlan(null)}><ChevronLeft /></button>
                <h1 className="font-cinzel font-bold truncate">{selectedPlan.name}</h1>
            </div>
            <div className="p-4">
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md border border-[#C5A059]/20 mb-6">
                    <p className="font-montserrat text-gray-600 dark:text-gray-300 mb-4">{selectedPlan.description}</p>
                    <div className="flex gap-2">
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">{selectedPlan.estimatedDays} dias</span>
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">{selectedPlan.books.length} Livros</span>
                    </div>
                </div>
                <h3 className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-3 ml-2">Livros do Plano (Toque para ler)</h3>
                <div className="space-y-2">
                    {selectedPlan.books.map((b: string) => (
                        <div 
                            key={b} 
                            onClick={() => onNavigate('reader', { book: b, chapter: 1 })}
                            className="bg-white dark:bg-dark-card p-4 rounded-lg flex justify-between items-center shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.99] transition-all"
                        >
                            <span className="font-cinzel font-bold dark:text-gray-200">{b}</span>
                            <BookOpen className="w-4 h-4 text-[#C5A059]" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg transition-colors duration-300">
        <div className="bg-[#8B0000] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg">
            <button onClick={onBack}><ChevronLeft /></button>
            <h1 className="font-cinzel font-bold">Planos de Leitura</h1>
        </div>
        <div className="p-4 space-y-4">
            {READING_PLANS.map(plan => (
                <div 
                    key={plan.id} 
                    onClick={() => setSelectedPlan(plan)}
                    className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md border border-[#C5A059]/20 cursor-pointer hover:shadow-lg transition-all active:scale-95"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-cinzel font-bold text-lg text-[#1a0f0f] dark:text-white">{plan.name}</h3>
                            <p className="font-montserrat text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{plan.description}</p>
                            <div className="flex items-center gap-2 text-xs font-bold text-[#8B0000] dark:text-[#ff6b6b]">
                                <CheckCircle className="w-4 h-4" /> {plan.estimatedDays} dias
                            </div>
                        </div>
                        <ChevronRight className="text-[#C5A059]" />
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}