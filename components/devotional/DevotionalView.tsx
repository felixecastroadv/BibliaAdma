import React, { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, Loader2, Volume2, Settings, RefreshCw, ChevronRight, Lock, Sparkles } from 'lucide-react';
import { generateContent } from '../../services/geminiService';
import { db } from '../../services/database';
import { Devotional } from '../../types';
import { format, addDays } from 'date-fns';

export default function DevotionalView({ onBack, onShowToast, isAdmin }: any) {
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  
  const dateStr = format(currentDate, 'yyyy-MM-dd');

  useEffect(() => { loadDevotional(); }, [dateStr]);

  const loadDevotional = async () => {
    setLoading(true);
    try {
        const res = await db.entities.Devotional.filter({ date: dateStr });
        if (res.length > 0) setDevotional(res[0]);
        else if (dateStr === format(new Date(), 'yyyy-MM-dd')) generateToday();
        else setDevotional(null);
    } catch (e) {} finally { setLoading(false); }
  };

  const generateToday = async () => {
    setLoading(true);
    try {
        const prompt = `Crie um devocional diário no estilo Prof. Michel Felix. JSON: { "title": "...", "reference": "...", "verse_text": "...", "body": "...", "prayer": "..." }.`;
        const res = await generateContent(prompt, { 
            properties: { 
                title: { type: 'STRING' }, reference: { type: 'STRING' }, 
                verse_text: { type: 'STRING' }, body: { type: 'STRING' }, 
                prayer: { type: 'STRING' } 
            } 
        });
        const data = { ...res, date: dateStr, is_published: true };
        await db.entities.Devotional.save(data);
        setDevotional(data as any);
    } catch (e) { onShowToast("Erro ao carregar", "error"); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg">
      <div className="bg-[#8B0000] text-white p-4 flex items-center justify-between sticky top-0 shadow-lg">
        <div className="flex items-center gap-4">
            <button onClick={onBack}><ChevronLeft /></button>
            <h1 className="font-cinzel font-bold">Devocional</h1>
        </div>
        <div className="flex gap-2">
            <button onClick={loadDevotional} className="p-2"><RefreshCw size={20}/></button>
        </div>
      </div>

      <div className="bg-[#1a0f0f] text-[#C5A059] p-3 flex items-center justify-between shadow-md">
         <button onClick={() => setCurrentDate(addDays(currentDate, -1))}><ChevronLeft /></button>
         <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider">
            <Calendar size={16} /> {format(currentDate, 'dd/MM/yyyy')}
         </div>
         <button onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight /></button>
      </div>

      <div className="p-6 max-w-2xl mx-auto pb-24">
        {loading ? <div className="text-center py-20 animate-pulse"><Loader2 className="animate-spin mx-auto mb-2"/> Preparando o alimento diário...</div> : devotional ? (
            <div className="bg-white dark:bg-dark-card p-8 rounded-2xl shadow-xl border border-[#C5A059]/30">
                <h2 className="font-cinzel text-3xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-2">{devotional.title}</h2>
                <p className="text-sm text-gray-500 mb-6">{devotional.reference}</p>
                <blockquote className="border-l-4 border-[#8B0000] pl-4 italic text-lg font-cormorant text-gray-700 dark:text-gray-300 mb-8 bg-[#F5F5DC] dark:bg-gray-800 p-4 rounded">
                    "{devotional.verse_text}"
                </blockquote>
                <div className="font-cormorant text-xl leading-loose whitespace-pre-wrap text-justify mb-8">{devotional.body}</div>
                <div className="bg-[#1a0f0f] text-white p-6 rounded-xl border-l-4 border-[#C5A059]">
                    <h3 className="font-cinzel font-bold mb-2 text-[#C5A059]">Oração do Dia</h3>
                    <p className="font-cormorant italic text-lg opacity-90">{devotional.prayer}</p>
                </div>
            </div>
        ) : (
            <div className="text-center py-20 text-gray-400">
                <Lock className="w-16 h-16 mx-auto mb-4" />
                <p className="font-cinzel">Palavra não disponível para esta data.</p>
            </div>
        )}
      </div>
    </div>
  );
}
