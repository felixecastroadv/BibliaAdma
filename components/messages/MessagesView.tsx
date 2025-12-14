
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Bell, Flame, Plus, Trash2, Send, Megaphone, User, Heart } from 'lucide-react';
import { db } from '../../services/database';
import { Announcement, PrayerRequest } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MessagesViewProps {
  onBack: () => void;
  isAdmin?: boolean; // Prop para saber se pode postar aviso
  user?: any; // Dados do usuário logado
}

export default function MessagesView({ onBack, isAdmin = false, user }: MessagesViewProps) {
  const [activeTab, setActiveTab] = useState<'avisos' | 'oracao'>('avisos');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [prayerCategory, setPrayerCategory] = useState('saude');

  // Load Data
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
        if (activeTab === 'avisos') {
            const data = await db.entities.Announcements.list();
            setAnnouncements(data);
        } else {
            const data = await db.entities.PrayerRequests.list();
            setPrayers(data);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
        if (activeTab === 'avisos' && isAdmin) {
            const item: Announcement = {
                title: newTitle || 'Comunicado',
                message: newMessage,
                date: new Date().toISOString(),
                author: 'Secretaria ADMA',
                priority: 'normal'
            };
            await db.entities.Announcements.create(item);
        } else if (activeTab === 'oracao') {
            const item: PrayerRequest = {
                user_name: user?.user_name || 'Anônimo',
                user_email: user?.user_email || 'anon@adma.local',
                request_text: newMessage,
                date: new Date().toISOString(),
                prayer_count: 0,
                category: prayerCategory as any
            };
            await db.entities.PrayerRequests.create(item);
        }
        
        setShowForm(false);
        setNewTitle('');
        setNewMessage('');
        loadData();
    } catch (e) {
        alert("Erro ao enviar.");
    }
  };

  const handleDelete = async (id: string) => {
      if(!window.confirm("Apagar este item?")) return;
      try {
          if(activeTab === 'avisos') await db.entities.Announcements.delete(id);
          else await db.entities.PrayerRequests.delete(id);
          loadData();
      } catch(e) { console.error(e); }
  };

  const handlePrayClick = async (req: PrayerRequest) => {
    // Optimistic Update
    const newCount = (req.prayer_count || 0) + 1;
    setPrayers(prev => prev.map(p => p.id === req.id ? { ...p, prayer_count: newCount } : p));
    
    // Server Update
    if(req.id) {
        await db.entities.PrayerRequests.update(req.id, { prayer_count: newCount });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg transition-colors duration-300 pb-20">
        <div className="bg-[#8B0000] text-white p-4 flex items-center justify-between sticky top-0 shadow-lg z-10">
            <div className="flex items-center gap-4">
                <button onClick={onBack}><ChevronLeft /></button>
                <h1 className="font-cinzel font-bold">Comunidade ADMA</h1>
            </div>
            {/* Botão de Nova Postagem */}
            {((activeTab === 'avisos' && isAdmin) || activeTab === 'oracao') && (
                <button onClick={() => setShowForm(!showForm)} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition">
                    <Plus className="w-6 h-6" />
                </button>
            )}
        </div>

        {/* Tabs */}
        <div className="flex bg-white dark:bg-dark-card border-b border-[#C5A059]">
            <button 
                onClick={() => setActiveTab('avisos')}
                className={`flex-1 py-4 font-cinzel font-bold flex justify-center items-center gap-2 transition-all ${activeTab === 'avisos' ? 'bg-[#8B0000] text-white' : 'text-gray-600 dark:text-gray-400'}`}
            >
                <Bell className="w-5 h-5" /> Quadro de Avisos
            </button>
            <button 
                onClick={() => setActiveTab('oracao')}
                className={`flex-1 py-4 font-cinzel font-bold flex justify-center items-center gap-2 transition-all ${activeTab === 'oracao' ? 'bg-[#C5A059] text-white' : 'text-gray-600 dark:text-gray-400'}`}
            >
                <Flame className="w-5 h-5" /> Pedidos de Oração
            </button>
        </div>

        {/* Form Modal Inline */}
        {showForm && (
            <div className="p-4 bg-white dark:bg-dark-card shadow-md animate-in slide-in-from-top-5">
                <form onSubmit={handleSubmit} className="space-y-3">
                    {activeTab === 'avisos' && (
                        <input 
                            type="text" 
                            placeholder="Título do Aviso" 
                            className="w-full p-3 border rounded dark:bg-gray-800 dark:text-white"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            required
                        />
                    )}
                    {activeTab === 'oracao' && (
                         <select 
                            value={prayerCategory}
                            onChange={e => setPrayerCategory(e.target.value)}
                            className="w-full p-3 border rounded dark:bg-gray-800 dark:text-white"
                         >
                             <option value="saude">Saúde</option>
                             <option value="familia">Família</option>
                             <option value="espiritual">Espiritual</option>
                             <option value="financeiro">Financeiro</option>
                             <option value="outros">Outros</option>
                         </select>
                    )}
                    <textarea 
                        placeholder={activeTab === 'avisos' ? "Digite o comunicado..." : "Descreva seu pedido de oração..."}
                        className="w-full p-3 border rounded h-32 dark:bg-gray-800 dark:text-white"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        required
                    />
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500">Cancelar</button>
                        <button type="submit" className="px-6 py-2 bg-[#8B0000] text-white rounded font-bold flex items-center gap-2">
                            <Send className="w-4 h-4" /> Publicar
                        </button>
                    </div>
                </form>
            </div>
        )}

        {/* Content List */}
        <div className="p-4 space-y-4">
            {loading ? (
                <div className="text-center py-10 opacity-50">Carregando...</div>
            ) : activeTab === 'avisos' ? (
                announcements.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <Megaphone className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p>Nenhum aviso no momento.</p>
                    </div>
                ) : (
                    announcements.map(ann => (
                        <div key={ann.id} className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md border-l-4 border-[#8B0000] relative">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-cinzel font-bold text-lg dark:text-white">{ann.title}</h3>
                                {isAdmin && (
                                    <button onClick={() => handleDelete(ann.id!)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                )}
                            </div>
                            <p className="font-cormorant text-lg text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ann.message}</p>
                            <div className="mt-4 flex justify-between items-center text-xs text-gray-500 font-montserrat">
                                <span>{ann.author}</span>
                                <span>{format(new Date(ann.date), "dd 'de' MMM, HH:mm", { locale: ptBR })}</span>
                            </div>
                        </div>
                    ))
                )
            ) : (
                prayers.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <Flame className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p>Mural de oração vazio.</p>
                        <p className="text-sm">Seja o primeiro a pedir oração.</p>
                    </div>
                ) : (
                    prayers.map(req => (
                        <div key={req.id} className="bg-white dark:bg-dark-card p-5 rounded-xl shadow-sm border border-[#C5A059]/20">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm dark:text-white">{req.user_name}</p>
                                    <p className="text-xs text-gray-500 capitalize">{req.category} • {format(new Date(req.date), "dd/MM", { locale: ptBR })}</p>
                                </div>
                                {(isAdmin || user?.user_email === req.user_email) && (
                                    <button onClick={() => handleDelete(req.id!)} className="ml-auto text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                )}
                            </div>
                            
                            <p className="text-gray-700 dark:text-gray-300 font-cormorant text-lg mb-4 italic">
                                "{req.request_text}"
                            </p>

                            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
                                <button 
                                    onClick={() => handlePrayClick(req)}
                                    className="flex items-center gap-2 text-sm font-bold text-[#C5A059] hover:text-[#8B0000] transition-colors active:scale-95"
                                >
                                    <Heart className={`w-5 h-5 ${(req.prayer_count || 0) > 0 ? 'fill-current' : ''}`} />
                                    <span>Vou orar</span>
                                </button>
                                <span className="text-xs text-gray-400 font-bold">
                                    {req.prayer_count || 0} pessoas orando
                                </span>
                            </div>
                        </div>
                    ))
                )
            )}
        </div>
    </div>
  );
}
