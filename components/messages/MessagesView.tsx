import React, { useState, useEffect } from 'react';
import { ChevronLeft, Bell, Flame, Plus, Trash2, Send, Megaphone, User, Heart } from 'lucide-react';
import { db } from '../../services/database';
import { Announcement, PrayerRequest } from '../../types';

export default function MessagesView({ onBack, isAdmin = false, user }: any) {
  const [activeTab, setActiveTab] = useState<'avisos' | 'oracao'>('avisos');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'avisos') setAnnouncements(await db.entities.Announcements.list());
    else setPrayers(await db.entities.PrayerRequests.list());
    setLoading(false);
  };

  const handlePray = async (req: any) => {
      await db.entities.PrayerRequests.update(req.id, { prayer_count: (req.prayer_count || 0) + 1 });
      loadData();
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg transition-colors">
        <div className="bg-[#8B0000] text-white p-4 flex items-center justify-between sticky top-0 shadow-lg z-10">
            <div className="flex items-center gap-4">
                <button onClick={onBack}><ChevronLeft /></button>
                <h1 className="font-cinzel font-bold">Comunidade</h1>
            </div>
            <button className="bg-white/20 p-2 rounded-full"><Plus/></button>
        </div>

        <div className="flex bg-white dark:bg-dark-card border-b border-[#C5A059]">
            <button onClick={() => setActiveTab('avisos')} className={`flex-1 py-4 font-bold flex justify-center gap-2 ${activeTab === 'avisos' ? 'bg-[#8B0000] text-white' : 'text-gray-600'}`}><Bell size={18}/> QUADRO</button>
            <button onClick={() => setActiveTab('oracao')} className={`flex-1 py-4 font-bold flex justify-center gap-2 ${activeTab === 'oracao' ? 'bg-[#C5A059] text-white' : 'text-gray-600'}`}><Flame size={18}/> ORAÇÃO</button>
        </div>

        <div className="p-4 space-y-4 pb-20">
            {loading ? <div className="text-center py-10">Carregando...</div> : activeTab === 'avisos' ? announcements.map(ann => (
                <div key={ann.id} className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md border-l-4 border-[#8B0000]">
                    <h3 className="font-cinzel font-bold text-lg dark:text-white">{ann.title}</h3>
                    <p className="font-cormorant text-lg text-gray-700 dark:text-gray-300 mt-2">{ann.message}</p>
                    <p className="text-[10px] text-gray-400 mt-4 uppercase font-bold">{ann.author} • {new Date(ann.date).toLocaleDateString()}</p>
                </div>
            )) : prayers.map(req => (
                <div key={req.id} className="bg-white dark:bg-dark-card p-5 rounded-xl shadow-sm border border-[#C5A059]/20">
                    <div className="flex items-center gap-3 mb-3">
                        <User className="text-gray-400" />
                        <p className="font-bold text-sm dark:text-white">{req.user_name}</p>
                        <span className="text-[10px] bg-gray-100 px-2 rounded font-bold ml-auto">{req.category}</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 font-cormorant italic">"{req.request_text}"</p>
                    <div className="mt-4 pt-3 border-t flex justify-between items-center">
                        <button onClick={() => handlePray(req)} className="text-[#C5A059] font-bold text-sm flex items-center gap-1"><Heart size={16}/> VOU ORAR</button>
                        <span className="text-[10px] font-bold text-gray-400">{req.prayer_count || 0} ORANDO</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
