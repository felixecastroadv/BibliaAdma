import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trophy, Medal, Crown, User, Loader2, BookOpen, GraduationCap } from 'lucide-react';
import { db } from '../../services/database';

export default function RankingView({ onBack }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chapters' | 'ebd'>('chapters');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    // Busca os Top 100 usuários ordenados pelo tipo selecionado
    const data = await db.entities.ReadingProgress.list(activeTab, 100);
    setUsers(data);
    setLoading(false);
  };

  const getPositionStyle = (index: number) => {
    switch (index) {
        case 0: return 'bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-900 border-yellow-400 transform scale-105'; // Ouro
        case 1: return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900 border-gray-400'; // Prata
        case 2: return 'bg-gradient-to-r from-orange-300 to-orange-400 text-orange-900 border-orange-400'; // Bronze
        default: return 'bg-white dark:bg-dark-card border-gray-200 dark:border-gray-700';
    }
  };

  const getIcon = (index: number) => {
    switch (index) {
        case 0: return <Crown className="w-6 h-6 text-yellow-800" />;
        case 1: return <Medal className="w-6 h-6 text-gray-800" />;
        case 2: return <Medal className="w-6 h-6 text-orange-900" />;
        default: return <span className="font-cinzel font-bold text-lg w-6 text-center">{index + 1}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg transition-colors duration-300 pb-10">
        <div className="bg-[#8B0000] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg z-10">
            <button onClick={onBack}><ChevronLeft /></button>
            <h1 className="font-cinzel font-bold">Ranking Global</h1>
        </div>

        {/* Tabs */}
        <div className="flex bg-white dark:bg-dark-card border-b border-[#C5A059]">
            <button 
                onClick={() => setActiveTab('chapters')}
                className={`flex-1 py-4 font-cinzel font-bold flex justify-center items-center gap-2 transition-all ${activeTab === 'chapters' ? 'bg-[#8B0000] text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-[#8B0000]/10'}`}
            >
                <BookOpen className="w-5 h-5" /> Leitura Bíblica
            </button>
            <button 
                onClick={() => setActiveTab('ebd')}
                className={`flex-1 py-4 font-cinzel font-bold flex justify-center items-center gap-2 transition-all ${activeTab === 'ebd' ? 'bg-[#C5A059] text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-[#C5A059]/10'}`}
            >
                <GraduationCap className="w-5 h-5" /> Estudos EBD
            </button>
        </div>

        <div className="p-4 max-w-lg mx-auto">
            <div className="bg-[#8B0000]/10 dark:bg-white/5 p-4 rounded-lg mb-6 text-center">
                <p className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] text-sm">
                    {activeTab === 'chapters' 
                        ? '"Lâmpada para os meus pés é a tua palavra..." (Sl 119:105)' 
                        : '"Crescei na graça e no conhecimento..." (2 Pe 3:18)'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {activeTab === 'chapters' ? 'Ranking por Capítulos Lidos' : 'Ranking por Estudos EBD Concluídos'}
                </p>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-[#8B0000] dark:text-[#ff6b6b]" />
                    <p className="mt-2 font-cinzel text-gray-500">Carregando leitores...</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {users.map((u, idx) => (
                        <div 
                            key={idx} 
                            className={`p-4 rounded-xl shadow-md flex items-center gap-4 border transition-all ${getPositionStyle(idx)}`}
                        >
                            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                                {getIcon(idx)}
                            </div>
                            
                            <div className="flex-1">
                                <p className="font-cinzel font-bold truncate text-lg dark:text-black">
                                    {u.user_name}
                                </p>
                                <div className="flex items-center gap-2 text-xs opacity-80 font-bold uppercase tracking-wider dark:text-gray-800">
                                    {activeTab === 'chapters' ? <BookOpen className="w-3 h-3" /> : <GraduationCap className="w-3 h-3" />}
                                    {activeTab === 'chapters' ? `${u.total_chapters || 0} Capítulos` : `${u.total_ebd_read || 0} Estudos`}
                                </div>
                            </div>

                            {idx === 0 && (
                                <div className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full animate-pulse">
                                    LÍDER
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {users.length === 0 && (
                        <div className="text-center py-10 opacity-50 dark:text-gray-400">
                            <User className="w-16 h-16 mx-auto mb-2 text-gray-300" />
                            <p>Nenhum dado registrado ainda.</p>
                            <p className="text-xs">Seja o primeiro a pontuar!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
}