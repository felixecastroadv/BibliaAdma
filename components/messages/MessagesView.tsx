
import React, { useState, useEffect } from 'react';
// Added Sparkles to the import list
import { ChevronLeft, Bell, Flame, Plus, Trash2, Send, Megaphone, User, Heart, Edit, Loader2, X, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { db } from '../../services/database';
import { Announcement, PrayerRequest } from '../../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface MessagesViewProps {
  onBack: () => void;
  isAdmin?: boolean; 
  user?: any;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function MessagesView({ onBack, isAdmin = false, user, onShowToast }: MessagesViewProps) {
  const [activeTab, setActiveTab] = useState<'avisos' | 'oracao'>('avisos');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal / Form States
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [prayerCategory, setPrayerCategory] = useState('espiritual');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
        if (activeTab === 'avisos') {
            const data = await db.entities.Announcements.list();
            setAnnouncements(Array.isArray(data) ? data : []);
        } else {
            const data = await db.entities.PrayerRequests.list();
            setPrayers(Array.isArray(data) ? data : []);
        }
    } catch (e) {
        console.error("Mural Load Error:", e);
        onShowToast("Erro ao sincronizar mural.", "error");
    } finally {
        setLoading(false);
    }
  };

  const handleOpenAdd = () => {
      setEditingId(null);
      setNewTitle('');
      setNewMessage('');
      setPrayerCategory('espiritual');
      setShowModal(true);
  };

  const handleEditClick = (ann: Announcement) => {
      setEditingId(ann.id || null);
      setNewTitle(ann.title);
      setNewMessage(ann.message);
      setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
        if (activeTab === 'avisos') {
            const item: Announcement = {
                id: editingId || Date.now().toString(),
                title: newTitle || 'Comunicado',
                message: newMessage,
                date: new Date().toISOString(),
                author: 'Secretaria ADMA',
                priority: 'normal'
            };
            
            if (editingId) {
                await db.entities.Announcements.update(editingId, item);
                onShowToast("Comunicado atualizado!", "success");
            } else {
                await db.entities.Announcements.create(item);
                onShowToast("Comunicado publicado!", "success");
            }
        } else {
            const item: PrayerRequest = {
                id: Date.now().toString(),
                user_name: user?.user_name || 'Membro ADMA',
                user_email: user?.user_email || 'anon@adma.local',
                request_text: newMessage,
                date: new Date().toISOString(),
                prayer_count: 0,
                category: prayerCategory as any
            };
            await db.entities.PrayerRequests.create(item);
            onShowToast("Pedido de oração enviado!", "success");
        }
        
        setShowModal(false);
        loadData();
    } catch (e) {
        console.error("Save Error:", e);
        onShowToast("Erro ao salvar. Verifique sua conexão.", "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(!window.confirm("Tem certeza que deseja apagar este item definitivamente?")) return;
      
      try {
          onShowToast("Removendo...", "info");
          if(activeTab === 'avisos') {
              await db.entities.Announcements.delete(id);
          } else {
              await db.entities.PrayerRequests.delete(id);
          }
          
          onShowToast("Item removido com sucesso.", "success");
          loadData();
      } catch(e) { 
          console.error("Delete Error:", e); 
          onShowToast("Erro ao excluir item.", "error");
      }
  };

  const handlePrayClick = async (req: PrayerRequest) => {
    if (!req.id) return;
    const newCount = (req.prayer_count || 0) + 1;
    
    // UI Update instantâneo (Optimistic UI)
    setPrayers(prev => prev.map(p => p.id === req.id ? { ...p, prayer_count: newCount } : p));
    
    try {
        await db.entities.PrayerRequests.update(req.id, { prayer_count: newCount });
    } catch (e) {
        console.error("Pray Counter Error:", e);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300">
        
        {/* HEADER */}
        <div className="bg-[#8B0000] text-white p-4 flex items-center justify-between sticky top-0 shadow-lg z-30 safe-top">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft /></button>
                <h1 className="font-cinzel font-bold text-lg tracking-wide uppercase">Mural ADMA</h1>
            </div>
            {((activeTab === 'avisos' && isAdmin) || activeTab === 'oracao') && (
                <button 
                    onClick={handleOpenAdd} 
                    className="bg-[#C5A059] text-white p-2.5 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all"
                    title="Adicionar Novo"
                >
                    <Plus className="w-6 h-6" />
                </button>
            )}
        </div>

        {/* TABS */}
        <div className="flex bg-white dark:bg-dark-card border-b border-[#C5A059]/30 sticky top-[56px] z-20 shadow-sm">
            <button 
                onClick={() => setActiveTab('avisos')}
                className={`flex-1 py-4 font-cinzel font-bold flex justify-center items-center gap-2 border-b-2 transition-all ${activeTab === 'avisos' ? 'border-[#8B0000] text-[#8B0000] bg-[#8B0000]/5' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <Bell className="w-4 h-4" /> Comunicados
            </button>
            <button 
                onClick={() => setActiveTab('oracao')}
                className={`flex-1 py-4 font-cinzel font-bold flex justify-center items-center gap-2 border-b-2 transition-all ${activeTab === 'oracao' ? 'border-[#C5A059] text-[#C5A059] bg-[#C5A059]/5' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <Flame className="w-4 h-4" /> Pedidos
            </button>
        </div>

        {/* LISTAGEM */}
        <div className="p-4 space-y-5 max-w-2xl mx-auto pb-32">
            {loading ? (
                <div className="text-center py-20 flex flex-col items-center gap-3 animate-pulse">
                    <Loader2 className="w-12 h-12 animate-spin text-[#8B0000]" />
                    <p className="font-cinzel text-gray-400 font-bold uppercase tracking-widest text-xs">Sincronizando...</p>
                </div>
            ) : activeTab === 'avisos' ? (
                announcements.length === 0 ? (
                    <div className="text-center py-20 opacity-30">
                        <Megaphone className="w-20 h-20 mx-auto mb-4 text-[#8B0000]" />
                        <p className="font-cinzel font-bold">Nenhum aviso no momento.</p>
                    </div>
                ) : (
                    announcements.map(ann => (
                        <motion.div 
                            layout
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            key={ann.id} 
                            className="bg-white dark:bg-dark-card p-6 rounded-3xl shadow-xl border-l-[8px] border-[#8B0000] relative overflow-hidden group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="font-cinzel font-bold text-xl dark:text-white leading-tight pr-12">{ann.title}</h3>
                                {isAdmin && (
                                    <div className="flex gap-2 absolute top-4 right-4">
                                        <button onClick={() => handleEditClick(ann)} className="p-2 text-gray-400 hover:text-[#C5A059] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all" title="Editar">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(ann.id!)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all" title="Excluir">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p className="font-cormorant text-xl text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed mb-6">{ann.message}</p>
                            
                            <div className="flex justify-between items-center text-[10px] text-gray-400 font-montserrat font-bold uppercase tracking-[0.2em] border-t border-gray-50 dark:border-white/5 pt-4">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-3 h-3 text-[#8B0000]" />
                                    <span>Oficial ADMA</span>
                                </div>
                                <span>{format(new Date(ann.date), "dd/MM/yy - HH:mm")}</span>
                            </div>
                        </motion.div>
                    ))
                )
            ) : (
                prayers.length === 0 ? (
                    <div className="text-center py-20 opacity-30">
                        <Flame className="w-20 h-20 mx-auto mb-4 text-[#C5A059]" />
                        <p className="font-cinzel font-bold">Nenhum pedido hoje.</p>
                    </div>
                ) : (
                    prayers.map(req => (
                        <motion.div 
                            layout
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            key={req.id} 
                            className="bg-white dark:bg-dark-card p-6 rounded-3xl shadow-lg border border-[#C5A059]/20 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 px-4 py-1.5 bg-[#C5A059]/10 text-[#C5A059] text-[9px] font-bold uppercase tracking-[0.2em] rounded-bl-3xl border-l border-b border-[#C5A059]/20">
                                {req.category}
                            </div>

                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F5F5DC] to-[#C5A059]/20 flex items-center justify-center border border-[#C5A059]/20">
                                    <User className="w-6 h-6 text-[#C5A059]" />
                                </div>
                                <div>
                                    <p className="font-cinzel font-bold text-base dark:text-white leading-none mb-1">{req.user_name}</p>
                                    <p className="text-[9px] text-gray-400 font-montserrat uppercase font-bold tracking-widest">{format(new Date(req.date), "dd MMM · HH:mm")}</p>
                                </div>
                                {(isAdmin || user?.user_email === req.user_email) && (
                                    <button onClick={() => handleDelete(req.id!)} className="ml-auto p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            
                            <p className="text-gray-800 dark:text-gray-200 font-cormorant text-xl leading-relaxed italic mb-8 border-l-2 border-[#C5A059]/20 pl-4 py-1">
                                "{req.request_text}"
                            </p>

                            <div className="flex items-center justify-between bg-gray-50 dark:bg-black/20 -mx-6 -mb-6 px-6 py-4 mt-4 border-t border-gray-100 dark:border-white/5">
                                <button 
                                    onClick={() => handlePrayClick(req)}
                                    className="group flex items-center gap-3 text-sm font-bold text-[#C5A059] hover:text-[#8B0000] transition-all active:scale-90"
                                >
                                    <div className={`p-2.5 rounded-full transition-all ${ (req.prayer_count || 0) > 0 ? 'bg-[#8B0000] text-white shadow-lg' : 'bg-[#C5A059]/10 group-hover:bg-[#8B0000]/10' }`}>
                                        <Heart className={`w-5 h-5 ${ (req.prayer_count || 0) > 0 ? 'fill-current' : '' }`} />
                                    </div>
                                    <span className="font-cinzel uppercase tracking-widest text-[10px]">Vou Orar</span>
                                </button>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-montserrat font-black text-[#8B0000] dark:text-[#ff6b6b] leading-none">{req.prayer_count || 0}</span>
                                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Intercessores</span>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )
            )}
        </div>

        {/* MODAL FORMULÁRIO */}
        <AnimatePresence>
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => !isSubmitting && setShowModal(false)}
                    />
                    <motion.div 
                        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-[#1A1A1A] w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-[#C5A059]/40"
                    >
                        {/* Modal Header */}
                        <div className="bg-[#8B0000] text-white p-6 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Sparkles className="w-5 h-5 text-[#C5A059]" />
                                <h2 className="font-cinzel font-bold tracking-widest text-sm uppercase">
                                    {editingId ? 'Editar Conteúdo' : activeTab === 'avisos' ? 'Novo Comunicado' : 'Novo Pedido'}
                                </h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            {activeTab === 'avisos' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Título do Aviso</label>
                                    <input 
                                        autoFocus
                                        type="text" 
                                        placeholder="Ex: Culto Especial de Missões" 
                                        className="w-full p-4 border-2 border-gray-100 dark:border-white/5 rounded-2xl dark:bg-black/30 dark:text-white focus:border-[#8B0000] outline-none font-cinzel font-bold transition-all"
                                        value={newTitle}
                                        onChange={e => setNewTitle(e.target.value)}
                                        required
                                    />
                                </div>
                            )}

                            {activeTab === 'oracao' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Categoria do Pedido</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['saude', 'familia', 'espiritual', 'financeiro', 'outros'].map(cat => (
                                            <button 
                                                key={cat}
                                                type="button"
                                                onClick={() => setPrayerCategory(cat)}
                                                className={`py-2 text-[10px] font-bold uppercase rounded-xl border transition-all ${prayerCategory === cat ? 'bg-[#C5A059] border-[#C5A059] text-white' : 'bg-gray-50 dark:bg-black/20 text-gray-400 border-gray-100 dark:border-white/5'}`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Mensagem Principal</label>
                                <textarea 
                                    placeholder={activeTab === 'avisos' ? "Descreva os detalhes importantes aqui..." : "Pelo que devemos orar? Seja breve e direto."}
                                    className="w-full p-4 border-2 border-gray-100 dark:border-white/5 rounded-2xl h-40 dark:bg-black/30 dark:text-white focus:border-[#8B0000] outline-none font-cormorant text-xl leading-relaxed transition-all"
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting || !newMessage.trim()}
                                    className="w-full bg-[#8B0000] text-white py-4 rounded-2xl font-bold font-cinzel shadow-xl shadow-[#8B0000]/30 flex items-center justify-center gap-3 hover:bg-[#600018] active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Processando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            <span>{editingId ? 'Salvar Alterações' : 'Publicar no Mural'}</span>
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-[9px] text-gray-400 uppercase font-bold tracking-widest flex items-center justify-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Este conteúdo será visível para todos os membros.
                                </p>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
  );
}
