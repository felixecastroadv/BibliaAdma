import React, { useState } from 'react';
import { ChevronLeft, CheckCircle, ChevronRight, Play, Clock, Trophy } from 'lucide-react';
import { READING_PLANS } from '../../constants';
import { ActivePlan } from '../../types';

export default function PlansView({ onBack, onNavigate, userProgress }: any) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const startPlan = async (plan: any) => {
    // Logic to start plan would be here
    onNavigate('reader', { book: plan.books[0], chapter: 1 });
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg">
        <div className="bg-[#8B0000] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg">
            <button onClick={onBack}><ChevronLeft /></button>
            <h1 className="font-cinzel font-bold">Planos de Leitura</h1>
        </div>
        <div className="p-4 space-y-4 pb-20">
            {READING_PLANS.map(plan => {
                const active = userProgress?.active_plans?.find((p: ActivePlan) => p.planId === plan.id);
                return (
                    <div key={plan.id} onClick={() => startPlan(plan)} className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md border border-[#C5A059]/20 cursor-pointer hover:shadow-lg transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-cinzel font-bold text-lg dark:text-white">{plan.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{plan.description}</p>
                                <div className="flex gap-4 text-xs font-bold text-[#8B0000]">
                                    <span className="flex items-center gap-1"><Clock size={14}/> {plan.estimatedDays} dias</span>
                                    <span className="flex items-center gap-1"><CheckCircle size={14}/> {plan.books.length} livros</span>
                                </div>
                            </div>
                            <ChevronRight className="text-[#C5A059]" />
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
}
