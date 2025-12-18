import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Languages, Loader2, RefreshCw, Send, Sparkles, Volume2, Pause, Play, MessageCircle, Bot, Edit, Command } from 'lucide-react';
import { db } from '../../services/database';
import { generateContent } from '../../services/geminiService';
import { generateVerseKey } from '../../constants';
import { DictionaryEntry, Commentary } from '../../types';
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  const verseKey = generateVerseKey(book, chapter, verseNumber);

  useEffect(() => {
    if (isOpen) {
        loadContent();
        setChatMessages([{ role: 'model', text: `Paz do Senhor! Sou o assistente do Prof. Michel Felix. Como posso ajudar em ${book} ${chapter}:${verseNumber}?` }]);
    }
  }, [isOpen, verseKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
        const prompt = `ATUE COMO: Prof. Michel Felix. Escreva um comentário exegético para "${verse}" (${book} ${chapter}:${verseNumber}). Use tom magistral.`;
        const text = await generateContent(prompt);
        const data = { book, chapter, verse: verseNumber, verse_key: verseKey, commentary_text: text };
        await db.entities.Commentary.create(data);
        setCommentary(data as any);
        onShowToast('Exegese gerada!', 'success');
    } catch (e) { onShowToast('Erro na IA', 'error'); } finally { setLoading(false); }
  };

  const generateDictionary = async () => {
      setLoading(true);
      try {
          const prompt = `Analise as palavras originais de ${book} ${chapter}:${verseNumber}.`;
          const schema = {
              type: Type.OBJECT,
              properties: {
                  original_text: { type: Type.STRING },
                  transliteration: { type: Type.STRING },
                  key_words: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.OBJECT,
                          properties: {
                              original: { type: Type.STRING },
                              transliteration: { type: Type.STRING },
                              portuguese: { type: Type.STRING },
                              polysemy: { type: Type.STRING },
                              etymology: { type: Type.STRING },
                              grammar: { type: Type.STRING }
                          }
                      }
                  }
              }
          };
          const res = await generateContent(prompt, schema);
          const data = { ...res, book, chapter, verse: verseNumber, verse_key: verseKey };
          await db.entities.Dictionary.create(data);
          setDictionary(data as any);
          onShowToast('Dicionário atualizado!', 'success');
      } catch (e) {} finally { setLoading(false); }
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
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full md:w-[500px] h-full bg-[#FDFBF7] dark:bg-dark-card shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="bg-[#8B0000] text-white p-4 flex justify-between items-center shadow-md">
                <div>
                    <h3 className="font-cinzel font-bold">{book} {chapter}:{verseNumber}</h3>
                    <p className="font-cormorant text-xs opacity-70 line-clamp-1">{verse}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X /></button>
            </div>

            <div className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059]">
                <button onClick={() => setActiveTab('professor')} className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 ${activeTab === 'professor' ? 'bg-[#8B0000] text-white' : 'text-[#8B0000]'}`}><BookOpen size={14}/> PROFESSOR</button>
                <button onClick={() => setActiveTab('dicionario')} className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 ${activeTab === 'dicionario' ? 'bg-[#8B0000] text-white' : 'text-[#8B0000]'}`}><Languages size={14}/> DICIONÁRIO</button>
                <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 ${activeTab === 'chat' ? 'bg-[#C5A059] text-white' : 'text-[#C5A059]'}`}><MessageCircle size={14}/> CHAT</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-cormorant text-lg bg-[#FDFBF7] dark:bg-dark-card">
                {loading && activeTab !== 'chat' ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#8B0000] animate-pulse">
                        <Loader2 className="animate-spin mb-2" />
                        <p className="font-cinzel">Consultando as Escrituras...</p>
                    </div>
                ) : (
                    activeTab === 'professor' ? (
                        commentary ? (
                            <div className="space-y-4">
                                <div className="whitespace-pre-wrap leading-relaxed text-justify">{commentary.commentary_text}</div>
                                {isAdmin && <button onClick={generateCommentary} className="text-xs underline text-gray-400">Regerar</button>}
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                <Sparkles className="w-12 h-12 mx-auto mb-4 text-[#C5A059]" />
                                <button onClick={generateCommentary} className="bg-[#8B0000] text-white px-6 py-3 rounded-xl font-bold font-cinzel">GERAR EXEGESE</button>
                            </div>
                        )
                    ) : activeTab === 'dicionario' ? (
                        dictionary ? (
                            <div className="space-y-6">
                                <div className="bg-black text-white p-4 rounded-xl text-center">
                                    <p className="text-2xl font-cinzel">{dictionary.original_text}</p>
                                    <p className="italic text-sm opacity-70">{dictionary.transliteration}</p>
                                </div>
                                <div className="space-y-4">
                                    {dictionary.key_words.map((w, i) => (
                                        <div key={i} className="border-b border-[#C5A059]/30 pb-4">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className="font-bold text-[#8B0000] text-xl">{w.original}</span>
                                                <span className="font-bold bg-[#C5A059]/20 px-2 rounded">{w.portuguese}</span>
                                            </div>
                                            <p className="text-sm opacity-80">{w.polysemy}</p>
                                            <p className="text-xs italic mt-1 text-gray-500">Etimologia: {w.etymology}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                <Languages className="w-12 h-12 mx-auto mb-4 text-[#C5A059]" />
                                <button onClick={generateDictionary} className="bg-[#8B0000] text-white px-6 py-3 rounded-xl font-bold font-cinzel">ANALISAR ORIGINAIS</button>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col h-full bg-[#E5DDD5] dark:bg-[#0b141a] -m-6 p-4">
                            <div className="flex-1 space-y-4 overflow-y-auto">
                                {chatMessages.map((m, i) => (
                                    <div key={i} className={`flex ${m.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-xl shadow-sm text-sm ${m.role === 'model' ? 'bg-white dark:bg-[#1f2c34] text-gray-800 dark:text-white rounded-tl-none' : 'bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 rounded-tr-none'}`}>
                                            {m.role === 'model' && <p className="text-[10px] font-bold text-[#8B0000] mb-1">Prof. Michel Felix</p>}
                                            <p className="whitespace-pre-line">{m.text}</p>
                                        </div>
                                    </div>
                                ))}
                                {isChatLoading && <div className="flex justify-start"><div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm"><Loader2 className="animate-spin text-[#8B0000]"/></div></div>}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="mt-4 flex gap-2 bg-white dark:bg-[#1f2c34] p-2 rounded-full shadow-lg">
                                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendQuestion()} className="flex-1 px-4 py-2 border-none bg-transparent outline-none dark:text-white" placeholder="Sua dúvida..." />
                                <button onClick={handleSendQuestion} className="p-3 bg-[#8B0000] text-white rounded-full transition-transform active:scale-90"><Send size={18}/></button>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    </div>
  );
}
