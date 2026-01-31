import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trophy, Medal, Crown, User, Loader2, BookOpen, GraduationCap, X, Flame, Star, Shield } from 'lucide-react';
import { db } from '../../services/database';
import { AnimatePresence, motion } from 'framer-motion';

export default function RankingView({ onBack, userProgress }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chapters' | 'ebd'>('chapters');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
        const data = await db.entities.ReadingProgress.list();
        
        // --- ADMA SYNC V2.0: Fusão de Dados Locais ---
        // Garante que o progresso local (mais recente) substitua o dado da nuvem (possivelmente desatualizado)
        // Isso resolve o problema do usuário ler e não ver a pontuação subir na hora.
        let mergedData = [...(data || [])];
        
        if (userProgress && userProgress.user_email) {
            const idx = mergedData.findIndex(u => u.user_email === userProgress.user_email);
            if (idx >= 0) {
                // Atualiza o usuário existente com os dados locais mais frescos
                mergedData[idx] = { ...mergedData[idx], ...userProgress };
            } else {
                // Se o usuário não estiver na lista (ex: offline ou novo), adiciona
                mergedData.push(userProgress);
            }
        }

        if (mergedData && Array.isArray(mergedData)) {
            // Ordenação Decrescente (Maior Pontuação Primeiro)
            const sorted = mergedData.sort((a, b) => {
                if (activeTab === 'chapters') {
                    // Ordena por capítulos lidos
                    const capsA = a.total_chapters || 0;
                    const capsB = b.total_chapters || 0;
                    if (capsB !== capsA) return capsB - capsA;
                    // Desempate por nome
                    return (a.user_name || "").localeCompare(b.user_name || "");
                } else {
                    // Ordena por estudos EBD lidos
                    const ebdsA = a.total_ebd_read || 0;
                    const ebdsB = b.total_ebd_read || 0;
                    if (ebdsB !== ebdsA) return ebdsB - ebdsA;
                    return (a.user_name || "").localeCompare(b.user_name || "");
                }
            });
            setUsers(sorted);
        } else {
            setUsers([]);
        }
    } catch(e) {
        console.error("Erro ranking:", e);
        setUsers([]);
    } finally {
        setLoading(false);
    }
  };

  const formatUserName = (rawName: string) => {
    if (!rawName) return "Anônimo";
    if (rawName.includes('@')) {
        const prefix = rawName.split('@')[0];
        return prefix.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
    }
    return rawName;
  };

  const getPositionStyle = (index: number) => {
    switch (index) {
        case 0: return 'bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-900 border-yellow-400 transform scale-105';
        case 1: return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900 border-gray-400';
        case 2: return 'bg-gradient-to-r from-orange-300 to-orange-400 text-orange-900 border-orange-400';
        default: return 'bg-white dark:bg-dark-card border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-gray-700 dark:text-gray-200';
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

  // Funções de Medalha
  const getBadges = (u: any) => {
      const badges = [];
      const caps = u.total_chapters || 0;
      const ebds = u.total_ebd_read || 0;

      if (caps >= 50) badges.push({ icon: BookOpen, label: "Leitor de Gênesis", color: "text-blue-500" });
      if (caps >= 300) badges.push({ icon: Star, label: "Devoto da Palavra", color: "text-yellow-500" });
      if (caps >= 1189) badges.push({ icon: Crown, label: "Bíblia Completa", color: "text-purple-500" });
      
      if (ebds >= 1) badges.push({ icon: GraduationCap, label: "Estudante EBD", color: "text-green-500" });
      if (ebds >= 10) badges.push({ icon: Shield, label: "Teólogo Jr", color: "text-red-500" });

      if (u.active_plans?.some((p: any) => p.isCompleted)) {
          badges.push({ icon: Trophy, label: "Finalizador de Planos", color: "text-orange-500" });
      }

      return badges;
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg transition-colors duration-300 pb-10">
        {/* User Profile Modal */}
        <AnimatePresence>
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60"
                        onClick={() => setSelectedUser(null)}
                    />
                    <motion.div 
                        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-[#1E1E1E] w-full max-w-sm rounded-2xl p-6 relative z-10 shadow-2xl border-2 border-[#C5A059]"
                    >
                        <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-gray-500"><X /></button>
                        
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-[#8B0000] to-[#600018] rounded-full flex items-center justify-center mb-3 shadow-lg">
                                <span className="font-cinzel font-bold text-3xl text-white">
                                    {formatUserName(selectedUser.user_name).charAt(0)}
                                </span>
                            </div>
                            <h2 className="font-cinzel font-bold text-xl text-[#1a0f0f] dark:text-white text-center">
                                {formatUserName(selectedUser.user_name)}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Membro ADMA</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-gray-100 dark:bg-black/30 p-3 rounded-lg text-center">
                                <BookOpen className="w-5 h-5 mx-auto text-[#8B0000] mb-1" />
                                <span className="block font-bold text-lg dark:text-white">{selectedUser.total_chapters || 0}</span>
                                <span className="text-xs text-gray-500">Capítulos</span>
                            </div>
                            <div className="bg-gray-100 dark:bg-black/30 p-3 rounded-lg text-center">
                                <GraduationCap className="w-5 h-5 mx-auto text-[#C5A059] mb-1" />
                                <span className="block font-bold text-lg dark:text-white">{selectedUser.total_ebd_read || 0}</span>
                                <span className="text-xs text-gray-500">Estudos</span>
                            </div>
                        </div>

                        <h3 className="font-bold text-sm text-gray-500 uppercase mb-3 flex items-center gap-1">
                            <Medal className="w-4 h-4" /> Medalhas & Conquistas
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {getBadges(selectedUser).length > 0 ? (
                                getBadges(selectedUser).map((badge, i) => (
                                    <div key={i} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700">
                                        <badge.icon className={`w-3 h-3 ${badge.color}`} />
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{badge.label}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-400 italic">Nenhuma medalha ainda.</p>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <div className="bg-[#8B0000] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg z-10">
            <button onClick={onBack}><ChevronLeft /></button>
            <h1 className="font-cinzel font-bold">Ranking Global</h1>
        </div>

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
                    Toque em um usuário para ver suas medalhas.
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
                            onClick={() => setSelectedUser(u)}
                            className={`p-4 rounded-xl shadow-md flex items-center gap-4 border transition-all ${getPositionStyle(idx)}`}
                        >
                            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                                {getIcon(idx)}
                            </div>
                            
                            <div className="flex-1">
                                <p className="font-cinzel font-bold truncate text-lg">
                                    {formatUserName(u.user_name)}
                                </p>
                                <div className="flex items-center gap-2 text-xs opacity-80 font-bold uppercase tracking-wider">
                                    {activeTab === 'chapters' ? <BookOpen className="w-3 h-3" /> : <GraduationCap className="w-3 h-3" />}
                                    {activeTab === 'chapters' ? `${u.total_chapters || 0} Capítulos` : `${u.total_ebd_read || 0} Estudos`}
                                </div>
                            </div>

                            {idx === 0 && (
                                <div className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full animate-pulse border border-yellow-200">
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
