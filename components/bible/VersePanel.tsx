import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Languages, Loader2, RefreshCw, AlertTriangle, Send, Lock, Save, Sparkles, Volume2, Pause, Play, MessageCircle, Bot, Edit, Command } from 'lucide-react';
import { db } from '../../services/database';
import { generateContent } from '../../services/geminiService';
import { generateVerseKey } from '../../constants';
import { DictionaryEntry, Commentary, ContentReport } from '../../types';
import { Type } from "@google/genai";

interface VersePanelProps {
  isOpen: boolean;
  onClose: () => void;
  verse: string;
  verseNumber: number;
  book: string;
  chapter: number;
  isAdmin: boolean;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  userProgress?: any;
}

export default function VersePanel({ isOpen, onClose, verse, verseNumber, book, chapter, isAdmin, onShowToast, userProgress }: VersePanelProps) {
  const [activeTab, setActiveTab] = useState<'professor' | 'dicionario' | 'chat'>('professor');
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [dictionary, setDictionary] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const verseKey = generateVerseKey(book, chapter, verseNumber);

  useEffect(() => {
    if (isOpen) {
        loadContent();
        setChatMessages([{ role: 'model', text: `Paz do Senhor! Sou o assistente do Prof. Michel Felix. Como posso ajudar em ${book} ${chapter}:${verseNumber}?` }]);
    }
  }, [isOpen, verseKey]);

  const loadContent = async () => {
    setLoading(true);
    try {
        const [c, d] = await Promise.all([
            db.entities.Commentary.filter({ verse_key: verseKey }),
            db.entities.Dictionary.filter({ verse_key: verseKey })
        ]);
        setCommentary(c[0] || null);
        setDictionary(d[0] || null);
    } catch (e) {} finally { setLoading(false); }
  };

  const generateCommentary = async () => {
    setLoading(true);
    try {
        const prompt = `ATUE COMO: Prof. Michel Felix. Comentário exegético para "${verse}" (${book} ${chapter}:${verseNumber}). Use parágrafos claros.`;
        const text = await generateContent(prompt);
        const data = { book, chapter, verse: verseNumber, verse_key: verseKey, commentary_text: text };
        await db.entities.Commentary.create(data);
        setCommentary(data as any);
        onShowToast('Comentário gerado!', 'success');
    } catch (e) { onShowToast('Erro na IA', 'error'); } finally { setLoading(false); }
  };

  const handleSendQuestion = async () => {
      if (!chatInput.trim()) return;
      const text = chatInput;
      setChatMessages(p => [...p, { role: 'user', text }]);
      setChatInput('');
      setIsChatLoading(true);
      try {
          const res = await generateContent(`Pergunta sobre ${book} ${chapter}:${verseNumber}: ${text}`);
          setChatMessages(p => [...p, { role: 'model', text: res }]);
      } catch (e) {} finally { setIsChatLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full md:w-[500px] h-full bg-[#FDFBF7] dark:bg-dark-card shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="bg-[#8B0000] text-white p-4 flex justify-between items-center">
                <h3 className="font-cinzel font-bold">{book} {chapter}:{verseNumber}</h3>
                <button onClick={onClose}><X /></button>
            </div>

            <div className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059]">
                <button onClick={() => setActiveTab('professor')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'professor' ? 'bg-[#8B0000] text-white' : ''}`}>PROFESSOR</button>
                <button onClick={() => setActiveTab('dicionario')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'dicionario' ? 'bg-[#8B0000] text-white' : ''}`}>DICIONÁRIO</button>
                <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'chat' ? 'bg-[#C5A059] text-white' : ''}`}>CHAT</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-cormorant text-lg">
                {loading ? <div className="text-center py-20 animate-pulse">Consultando...</div> : (
                    activeTab === 'professor' ? (
                        commentary ? <div className="whitespace-pre-wrap leading-relaxed">{commentary.commentary_text}</div> : (
                            <button onClick={generateCommentary} className="w-full bg-[#8B0000] text-white py-3 rounded-xl font-bold">GERAR EXEGESE</button>
                        )
                    ) : activeTab === 'dicionario' ? (
                        dictionary ? <div>{/* Render lexical analysis */}</div> : <p className="text-center opacity-50">Dicionário não disponível.</p>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 space-y-4 overflow-y-auto">
                                {chatMessages.map((m, i) => (
                                    <div key={i} className={`p-3 rounded-lg ${m.role === 'model' ? 'bg-white dark:bg-gray-800' : 'bg-green-100 ml-10'}`}>{m.text}</div>
                                ))}
                                {isChatLoading && <Loader2 className="animate-spin mx-auto" />}
                            </div>
                            <div className="mt-4 flex gap-2">
                                <input value={chatInput} onChange={e => setChatInput(e.target.value)} className="flex-1 p-2 border rounded dark:bg-gray-900" placeholder="Sua dúvida..." />
                                <button onClick={handleSendQuestion} className="p-2 bg-[#8B0000] text-white rounded-full"><Send /></button>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    </div>
  );
}