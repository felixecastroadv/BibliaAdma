import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trophy } from 'lucide-react';
import { db } from '../../services/database';

export default function RankingView({ onBack }: any) {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
        const data = await db.entities.ReadingProgress.list('chapters', 10);
        setUsers(data);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg transition-colors duration-300">
        <div className="bg-[#8B0000] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg">
            <button onClick={onBack}><ChevronLeft /></button>
            <h1 className="font-cinzel font-bold">Ranking de Leitura</h1>
        </div>
        <div className="p-4 max-w-md mx-auto">
            {users.map((u, idx) => (
                <div key={idx} className="bg-white dark:bg-dark-card p-4 rounded-xl shadow mb-3 flex items-center gap-4 border border-[#C5A059]/20">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx === 0 ? 'bg-[#C5A059]' : 'bg-gray-400 dark:bg-gray-700'}`}>
                        {idx + 1}
                    </div>
                    <div className="flex-1">
                        <p className="font-cinzel font-bold dark:text-white">{u.user_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{u.total_chapters} Capítulos Lidos</p>
                    </div>
                    {idx === 0 && <Trophy className="text-[#C5A059]" />}
                </div>
            ))}
            {users.length === 0 && <p className="text-center py-10 opacity-50 dark:text-gray-400">Nenhum dado ainda.</p>}
        </div>
    </div>
  );
}