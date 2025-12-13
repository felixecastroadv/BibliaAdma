
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trophy, Medal, Crown, User, Loader2 } from 'lucide-react';
import { db } from '../../services/database';

export default function RankingView({ onBack }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
        // Busca os Top 100 usuários ordenados por capítulos lidos
        const data = await db.entities.ReadingProgress.list('chapters', 100);
        setUsers(data);
        setLoading(false);
    };
    load();
  }, []);

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
            <h1 className="font-cinzel font-bold">Ranking Global (Top 100)</h1>
        </div>

        <div className="p-4 max-w-lg mx-auto">
            <div className="bg-[#8B0000]/10 dark:bg-white/5 p-4 rounded-lg mb-6 text-center">
                <p className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] text-sm">
                    "Procura apresentar-te a Deus aprovado..." (2 Tm 2:15)
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Quem lê mais capítulos, sobe no ranking.
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
                                    <Trophy className="w-3 h-3" />
                                    {u.total_chapters || 0} Capítulos
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
                            <p>Nenhum leitor registrado ainda.</p>
                            <p className="text-xs">Seja o primeiro a ler um capítulo!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
}
