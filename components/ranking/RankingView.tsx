import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trophy, Medal, Crown, User, Loader2, BookOpen, GraduationCap, Star } from 'lucide-react';
import { db } from '../../services/database';

export default function RankingView({ onBack }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chapters' | 'ebd'>('chapters');

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    const data = await db.entities.ReadingProgress.list();
    const sorted = [...data].sort((a, b) => 
        activeTab === 'chapters' ? (b.total_chapters || 0) - (a.total_chapters || 0) : (b.total_ebd_read || 0) - (a.total_ebd_read || 0)
    );
    setUsers(sorted);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg pb-10">
        <div className="bg-[#8B0000] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg">
            <button onClick={onBack}><ChevronLeft /></button>
            <h1 className="font-cinzel font-bold">Ranking Global</h1>
        </div>

        <div className="flex bg-white dark:bg-dark-card border-b border-[#C5A059]">
            <button onClick={() => setActiveTab('chapters')} className={`flex-1 py-4 font-bold flex justify-center gap-2 ${activeTab === 'chapters' ? 'bg-[#8B0000] text-white' : 'text-gray-600'}`}><BookOpen size={18}/> LEITURA</button>
            <button onClick={() => setActiveTab('ebd')} className={`flex-1 py-4 font-bold flex justify-center gap-2 ${activeTab === 'ebd' ? 'bg-[#C5A059] text-white' : 'text-gray-600'}`}><GraduationCap size={18}/> ESTUDOS EBD</button>
        </div>

        <div className="p-4 max-w-lg mx-auto space-y-3">
            {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-[#8B0000]"/></div> : users.map((u, i) => (
                <div key={i} className={`p-4 rounded-xl flex items-center gap-4 border shadow-md transition-all ${i === 0 ? 'bg-yellow-100 border-yellow-400 transform scale-105' : 'bg-white dark:bg-dark-card'}`}>
                    <div className="flex-shrink-0 w-8 text-center font-bold font-cinzel">
                        {i === 0 ? <Crown className="text-yellow-700"/> : i === 1 ? <Medal className="text-gray-500"/> : i === 2 ? <Medal className="text-orange-700"/> : i + 1}
                    </div>
                    <div className="flex-1">
                        <p className="font-bold font-cinzel truncate dark:text-white">{u.user_name}</p>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-tighter">{activeTab === 'chapters' ? `${u.total_chapters || 0} capítulos lidos` : `${u.total_ebd_read || 0} estudos EBD`}</p>
                    </div>
                    {i === 0 && <span className="bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">LÍDER</span>}
                </div>
            ))}
        </div>
    </div>
  );
}
