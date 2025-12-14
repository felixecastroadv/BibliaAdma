import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Languages, Loader2, RefreshCw, AlertTriangle, Send, Lock, Save, Sparkles, Volume2, Pause, Play, FastForward, MessageCircle, User, Bot, Battery } from 'lucide-react';
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
  userName?: string;
  userProgress?: any;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const OLD_TESTAMENT_BOOKS = ['Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel', '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester', 'Jó', 'Salmos', 'Provérbios', 'Eclesiastes', 'Cantares', 'Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós', 'Obadias', 'Jonas', 'Miquéias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias'];

// --- CONFIGURAÇÃO DE COTAS ---
const BASE_DAILY_LIMIT = 3; // Todo mundo tem 3
const BONUS_CHAPTER_STEP = 10; // A cada 10 caps lidos ganha +1
const MAX_DAILY_LIMIT = 15; // Teto máximo

export default function VersePanel({ isOpen, onClose, verse, verseNumber, book, chapter, isAdmin, onShowToast, userProgress }: VersePanelProps) {
  const [activeTab, setActiveTab] = useState<'professor' | 'dicionario' | 'chat'>('professor');
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [dictionary, setDictionary] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Quota State
  const [dailyQuota, setDailyQuota] = useState(BASE_DAILY_LIMIT);
  const [msgsUsed, setMsgsUsed] = useState(0);

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showAudioSettings, setShowAudioSettings] = useState(false);

  const verseKey = generateVerseKey(book, chapter, verseNumber);
  const isOT = OLD_TESTAMENT_BOOKS.includes(book);
  const lang = isOT ? 'hebraico' : 'grego';

  useEffect(() => {
    if (isOpen && verse) {
        loadContent();
        // Reset chat on open new verse
        setChatMessages([{
            role: 'model',
            text: `Olá! Sou o assistente virtual do Prof. Michel Felix. Qual sua dúvida sobre ${book} ${chapter}:${verseNumber}?`
        }]);
        checkQuota();
    }
    // Stop audio when closing
    if (!isOpen) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    }
  }, [isOpen, verse]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab]);

  useEffect(() => {
    const loadVoices = () => {
        const available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        setVoices(available);
        if(available.length > 0) setSelectedVoice(available[0].name);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        speakText();
    }
  }, [playbackRate]);

  // --- LÓGICA DE COTAS ---
  const checkQuota = () => {
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem('adma_chat_usage');
    let usage = 0;

    if (saved) {
        const data = JSON.parse(saved);
        if (data.date === today) {
            usage = data.count;
        } else {
            // Reset se for outro dia
            localStorage.setItem('adma_chat_usage', JSON.stringify({ date: today, count: 0 }));
        }
    }

    setMsgsUsed(usage);

    // Calcula limite baseado no progresso
    const chaptersRead = userProgress?.total_chapters || 0;
    const bonus = Math.floor(chaptersRead / BONUS_CHAPTER_STEP);
    const totalLimit = Math.min(MAX_DAILY_LIMIT, BASE_DAILY_LIMIT + bonus);
    
    setDailyQuota(totalLimit);
  };

  const incrementUsage = () => {
      const today = new Date().toISOString().split('T')[0];
      const newCount = msgsUsed + 1;
      localStorage.setItem('adma_chat_usage', JSON.stringify({ date: today, count: newCount }));
      setMsgsUsed(newCount);
  };
  // -----------------------

  const loadContent = async () => {
    if (commentary && dictionary) return;

    setLoading(true);
    try {
        const [commRes, dictRes] = await Promise.all([
            db.entities.Commentary.filter({ verse_key: verseKey }),
            db.entities.Dictionary.filter({ verse_key: verseKey })
        ]);

        if (commRes && commRes.length > 0) setCommentary(commRes[0]);
        else setCommentary(null);

        if (dictRes && dictRes.length > 0) setDictionary(dictRes[0]);
        else setDictionary(null);

    } catch (e) {
        console.error("Erro ao carregar", e);
    } finally {
        setLoading(false);
    }
  };

  const handleSendQuestion = async (text: string) => {
      if (!text.trim()) return;

      // Verifica cota
      if (msgsUsed >= dailyQuota && !isAdmin) {
          onShowToast(`Limite diário atingido! Leia mais ${BONUS_CHAPTER_STEP} capítulos para ganhar +1 pergunta.`, 'error');
          return;
      }
      
      const userMsg: ChatMessage = { role: 'user', text };
      setChatMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsChatLoading(true);

      // Incrementa uso ANTES de chamar a API para evitar race conditions
      if (!isAdmin) incrementUsage();

      const prompt = `
        CONTEXTO BÍBLICO: Livro de ${book}, Capítulo ${chapter}, Versículo ${verseNumber}.
        TEXTO: "${verse}"
        
        PERSONA: Você é o Prof. Michel Felix, um teólogo Pentecostal Clássico da Assembleia de Deus (Ministério Ágape).
        ESTILO: Responda de forma curta, direta, pastoral e encorajadora. Use emojis moderados.
        DOUTRINA: Arminiana, Ortodoxa, Bibliocêntrica. Rejeite liberalismo teológico.
        
        PERGUNTA DO ALUNO: "${text}"
        
        RESPOSTA:
      `;

      try {
          const response = await generateContent(prompt);
          setChatMessages(prev => [...prev, { role: 'model', text: response || "Desculpe, não consegui processar sua dúvida agora." }]);
      } catch (error) {
          setChatMessages(prev => [...prev, { role: 'model', text: "Erro de conexão com o Professor. Tente novamente." }]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const generateDictionary = async () => {
    setLoading(true);
    onShowToast(`Analisando texto original em ${lang}...`, 'info');

    const prompt = `
      Você é um HEBRAÍSTA e HELENISTA SÊNIOR com doutorado em línguas bíblicas.
      TAREFA: Análise lexical COMPLETA de ${book} ${chapter}:${verseNumber}
      Texto em português: "${verse}"
      Idioma original: ${lang.toUpperCase()}

      Analise TODAS as palavras principais do versículo.
      Preencha TODOS os campos: original, transliteration, portuguese, polysemy, etymology, grammar.
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        hebrewGreekText: { type: Type.STRING },
        phoneticText: { type: Type.STRING },
        words: {
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
            },
            required: ["original", "transliteration", "portuguese", "polysemy", "etymology", "grammar"]
          }
        }
      },
      required: ["hebrewGreekText", "phoneticText", "words"]
    };

    try {
      const response = await generateContent(prompt, schema);
      
      const data: DictionaryEntry = {
        book, chapter, verse: verseNumber, verse_key: verseKey,
        original_text: response.hebrewGreekText,
        transliteration: response.phoneticText,
        key_words: response.words || []
      };

      setIsSaving(true);
      await db.entities.Dictionary.create(data);
      setDictionary(data);
      onShowToast('Dicionário gerado e salvo para todos!', 'success');
    } catch (e: any) {
      console.error(e);
      onShowToast(`Erro: ${e.message}`, 'error');
    } finally {
      setLoading(false);
      setIsSaving(false);
    }
  };

  const generateCommentary = async () => {
    setLoading(true);

    try {
        const prompt = `
            ATUE COMO: Professor Michel Felix (Teólogo Conservador).
            TAREFA: Comentário bíblico ortodoxo e vibrante sobre ${book} ${chapter}:${verseNumber}.
            TEXTO BÍBLICO: "${verse}"

            --- SEGURANÇA DOUTRINÁRIA (CRÍTICO) ---
            1. ORTODOXIA ESTRITA: Interprete a Bíblia com a Bíblia. Rejeite interpretações baseadas em livros apócrifos.
            2. VIÉS: Arminiano e Pentecostal Clássico.

            --- ESTILO DE ESCRITA ---
            - Vibrante, Pastoral e Acessível.
            - NUNCA use frases de auto-identificação ("Eu como teólogo...", "Nós cremos...").

            ESTRUTURA:
            - 2 a 3 parágrafos fluídos.
            - Comece contextualizando e termine com aplicação prática.
        `;
        const text = await generateContent(prompt);
        const data = { book, chapter, verse: verseNumber, verse_key: verseKey, commentary_text: text };
        
        setIsSaving(true);
        await db.entities.Commentary.create(data);
        setCommentary(data as Commentary);
        onShowToast('Comentário gerado e salvo para todos!', 'success');
    } catch (e: any) {
        onShowToast(`Erro: ${e.message}`, 'error');
    } finally {
        setLoading(false);
        setIsSaving(false);
    }
  };

  const speakText = () => {
    if (!commentary || activeTab !== 'professor') return;
    
    const utter = new SpeechSynthesisUtterance(commentary.commentary_text);
    utter.lang = 'pt-BR';
    utter.rate = playbackRate;
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utter.voice = voice;
    utter.onend = () => setIsPlaying(false);
    window.speechSynthesis.speak(utter);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    } else {
        speakText();
    }
  };

  if (!isOpen) return null;

  const msgsLeft = dailyQuota - msgsUsed;
  const isQuotaFull = msgsLeft <= 0 && !isAdmin;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full md:w-[600px] h-full bg-[#FDFBF7] dark:bg-dark-card shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-[#8B0000] text-white p-4 z-10 flex justify-between items-start shadow-md shrink-0">
                <div>
                    <h3 className="font-cinzel text-xl font-bold">{book} {chapter}:{verseNumber}</h3>
                    <p className="font-cormorant text-sm opacity-90 mt-1 line-clamp-2">{verse}</p>
                </div>
                <div className="flex gap-2">
                    {/* Audio Controls for Commentary */}
                    {activeTab === 'professor' && commentary && (
                        <button onClick={() => setShowAudioSettings(!showAudioSettings)} className="p-1 hover:bg-white/20 rounded-full">
                            <Volume2 className={isPlaying ? "w-6 h-6 animate-pulse" : "w-6 h-6"} />
                        </button>
                    )}
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full"><X className="w-6 h-6" /></button>
                </div>
            </div>

            {/* Audio Settings Panel */}
            {showAudioSettings && activeTab === 'professor' && (
                <div className="bg-white dark:bg-gray-900 p-3 border-b border-[#C5A059] flex flex-col gap-2 animate-in slide-in-from-top-2 shrink-0">
                    <div className="flex items-center justify-between">
                        <button 
                            onClick={togglePlay}
                            className="bg-[#C5A059] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-[#a88645]"
                        >
                            {isPlaying ? <Pause className="w-3 h-3"/> : <Play className="w-3 h-3"/>} 
                            {isPlaying ? 'Pausar' : 'Ouvir Comentário'}
                        </button>
                        <select className="p-1 text-xs border rounded w-1/2 dark:bg-gray-800 dark:text-white" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                            {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        </select>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059] shrink-0 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('professor')}
                    className={`flex-1 min-w-[100px] py-3 font-montserrat font-medium text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 transition-colors ${activeTab === 'professor' ? 'bg-[#8B0000] text-white' : 'text-[#8B0000] dark:text-[#C5A059] hover:bg-[#C5A059]/20'}`}
                >
                    <BookOpen className="w-4 h-4" /> Professor
                </button>
                <button 
                    onClick={() => setActiveTab('dicionario')}
                    className={`flex-1 min-w-[100px] py-3 font-montserrat font-medium text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 transition-colors ${activeTab === 'dicionario' ? 'bg-[#8B0000] text-white' : 'text-[#8B0000] dark:text-[#C5A059] hover:bg-[#C5A059]/20'}`}
                >
                    <Languages className="w-4 h-4" /> Dicionário
                </button>
                <button 
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 min-w-[100px] py-3 font-montserrat font-bold text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 transition-colors ${activeTab === 'chat' ? 'bg-[#C5A059] text-white' : 'text-[#8B0000] dark:text-[#C5A059] hover:bg-[#C5A059]/20'}`}
                >
                    <MessageCircle className="w-4 h-4" /> Tira-Dúvidas
                    {msgsLeft > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 rounded-full">{msgsLeft}</span>}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto dark:text-gray-200 bg-[#FDFBF7] dark:bg-dark-card flex flex-col relative">
                {loading && activeTab !== 'chat' ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#8B0000] dark:text-white absolute inset-0 bg-[#FDFBF7]/90 dark:bg-dark-card/90 z-20">
                        <Loader2 className="w-10 h-10 animate-spin mb-2" />
                        <p className="font-cinzel">Consultando o Mestre...</p>
                        {isSaving && <p className="text-xs mt-2 font-bold animate-pulse">Salvando no Banco de Dados...</p>}
                    </div>
                ) : (
                    <>
                        {activeTab === 'professor' && (
                            <div className="p-5 space-y-4">
                                {commentary ? (
                                    <>
                                        <div className="prose prose-lg font-cormorant text-gray-900 dark:text-gray-200">
                                            <p className="whitespace-pre-line leading-relaxed text-justify">{commentary.commentary_text}</p>
                                        </div>
                                        {isAdmin && (
                                            <button onClick={generateCommentary} className="w-full mt-4 py-2 border border-[#8B0000] text-[#8B0000] dark:text-[#ff6b6b] dark:border-[#ff6b6b] rounded font-cinzel text-sm flex items-center justify-center gap-2 hover:bg-[#8B0000]/5">
                                                <RefreshCw className="w-4 h-4"/> Regenerar e Salvar (Admin)
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-10 text-gray-400">
                                       <Sparkles className="w-12 h-12 mx-auto mb-3 text-[#C5A059]" />
                                       <p className="font-cinzel font-bold text-gray-500">Conteúdo Inédito</p>
                                       <p className="text-sm mt-2 max-w-xs mx-auto">Seja o primeiro a gerar este comentário e disponibilizá-lo para todos.</p>
                                       <button onClick={generateCommentary} className="mt-4 px-6 py-3 bg-[#8B0000] text-white rounded font-bold text-sm shadow-lg hover:bg-[#600018] flex items-center justify-center gap-2 mx-auto animate-pulse">
                                            <Save className="w-4 h-4"/> Gerar Conteúdo (Universal)
                                       </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'dicionario' && (
                            <div className="p-5 space-y-6">
                                {dictionary ? (
                                    <>
                                        <div className="bg-gradient-to-br from-[#8B0000] to-black p-4 rounded-lg text-white text-center shadow-lg">
                                            <p className="font-montserrat text-xs uppercase opacity-70 mb-1">Texto Original</p>
                                            <p className="font-cinzel text-2xl mb-2" dir="auto">{dictionary.original_text}</p>
                                            <div className="border-t border-white/20 pt-2">
                                                <p className="font-cormorant text-lg italic">{dictionary.transliteration}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {dictionary.key_words.map((word, idx) => (
                                                <div key={idx} className="bg-white dark:bg-gray-800 border border-[#C5A059]/30 rounded-lg overflow-hidden shadow-sm">
                                                    <div className="bg-[#FDFBF7] dark:bg-gray-900 p-3 border-b border-[#C5A059]/20 flex justify-between items-center">
                                                        <div>
                                                            <span className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] text-lg">{word.original}</span>
                                                            <span className="text-xs text-gray-500 ml-2 font-montserrat">({word.transliteration})</span>
                                                        </div>
                                                        <span className="font-bold text-gray-900 dark:text-black font-cormorant bg-[#C5A059]/20 dark:bg-[#C5A059] px-2 py-1 rounded">{word.portuguese}</span>
                                                    </div>
                                                    <div className="p-4 space-y-3">
                                                        <div>
                                                            <p className="text-xs font-bold text-[#8B0000] dark:text-[#ff6b6b] uppercase font-montserrat mb-1">Significados & Polissemia</p>
                                                            <p className="font-cormorant text-gray-900 dark:text-gray-300 leading-relaxed">{word.polysemy}</p>
                                                        </div>
                                                        <div className="bg-[#F5F5DC] dark:bg-gray-700 p-2 rounded">
                                                            <p className="text-xs font-bold text-[#C5A059] uppercase font-montserrat mb-1">Etimologia</p>
                                                            <p className="font-cormorant text-gray-900 dark:text-gray-300 italic">{word.etymology}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase font-montserrat mb-1">Gramática</p>
                                                            <p className="font-cormorant text-gray-900 dark:text-gray-300">{word.grammar}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {isAdmin && (
                                            <button onClick={generateDictionary} className="w-full mt-4 py-3 border border-[#8B0000] text-[#8B0000] dark:text-[#ff6b6b] dark:border-[#ff6b6b] hover:bg-[#8B0000]/5 rounded font-cinzel font-bold flex items-center justify-center gap-2">
                                                <RefreshCw className="w-4 h-4" /> Regenerar e Salvar (Admin)
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-10 text-gray-400">
                                       <Sparkles className="w-12 h-12 mx-auto mb-3 text-[#C5A059]" />
                                       <p className="font-cinzel font-bold text-gray-500">Dicionário Inédito</p>
                                       <p className="text-sm mt-2 max-w-xs mx-auto">Gere a primeira análise lexical deste versículo.</p>
                                       <button onClick={generateDictionary} className="mt-4 px-6 py-3 bg-[#8B0000] text-white rounded font-bold text-sm shadow-lg hover:bg-[#600018] flex items-center justify-center gap-2 mx-auto animate-pulse">
                                            <Save className="w-4 h-4"/> Gerar Dicionário (Universal)
                                       </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'chat' && (
                            <div className="flex flex-col h-full bg-[#E5DDD5] dark:bg-[#0b141a]">
                                {/* Chat Header Info */}
                                <div className="bg-white/80 dark:bg-black/40 p-2 text-center text-xs font-bold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800 flex justify-center items-center gap-2 backdrop-blur-sm">
                                    <Battery className={`w-4 h-4 ${isQuotaFull ? 'text-red-500' : 'text-green-500'}`} />
                                    <span>{msgsLeft} perguntas restantes hoje</span>
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {chatMessages.map((msg, idx) => {
                                        const isModel = msg.role === 'model';
                                        return (
                                            <div key={idx} className={`flex ${isModel ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[85%] rounded-lg p-3 shadow-sm text-sm relative ${isModel ? 'bg-white dark:bg-[#1f2c34] text-gray-800 dark:text-gray-100 rounded-tl-none' : 'bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-white rounded-tr-none'}`}>
                                                    {isModel && <p className="text-[10px] font-bold text-[#8B0000] dark:text-[#C5A059] mb-1 font-montserrat">Prof. Michel Felix</p>}
                                                    <p className="font-cormorant text-base leading-snug whitespace-pre-line">{msg.text}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {isChatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-white dark:bg-[#1f2c34] rounded-lg p-3 shadow-sm rounded-tl-none flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-[#8B0000]" />
                                                <span className="text-xs text-gray-500 italic">Digitando...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Quota Reached Warning */}
                                {isQuotaFull && (
                                    <div className="px-4 py-3 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 text-xs font-bold text-center border-t border-red-200">
                                        <Lock className="w-4 h-4 inline mb-1" /> Limite diário atingido! Leia mais capítulos para ganhar perguntas extras amanhã.
                                    </div>
                                )}

                                {/* Suggested Questions */}
                                {!isQuotaFull && chatMessages.length < 2 && (
                                    <div className="px-4 py-2 flex gap-2 overflow-x-auto bg-opacity-10 bg-black/5 shrink-0">
                                        {["Como aplicar na minha vida?", "Contexto Histórico", "Significado no Original"].map(q => (
                                            <button 
                                                key={q}
                                                onClick={() => handleSendQuestion(q)}
                                                className="whitespace-nowrap px-3 py-1 bg-white dark:bg-[#1f2c34] rounded-full text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-[#C5A059] hover:text-white transition-colors"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Input Area */}
                                <div className="p-3 bg-white dark:bg-[#1f2c34] flex gap-2 items-center shrink-0">
                                    <input 
                                        type="text" 
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !isQuotaFull && handleSendQuestion(chatInput)}
                                        placeholder={isQuotaFull ? "Volte amanhã ou leia mais..." : "Tire sua dúvida com o Professor..."}
                                        className="flex-1 p-2 rounded-full bg-gray-100 dark:bg-[#2a3942] border-none focus:ring-1 focus:ring-[#C5A059] dark:text-white text-sm disabled:opacity-50"
                                        disabled={isChatLoading || isQuotaFull}
                                    />
                                    <button 
                                        onClick={() => handleSendQuestion(chatInput)}
                                        disabled={isChatLoading || !chatInput.trim() || isQuotaFull}
                                        className="p-2 bg-[#8B0000] dark:bg-[#00a884] text-white rounded-full disabled:opacity-50 disabled:bg-gray-400"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {!isAdmin && (commentary || dictionary) && activeTab !== 'chat' && (
                            <div className="mt-8 pt-4 border-t border-[#C5A059]/20 p-5">
                                <button onClick={() => setShowReport(!showReport)} className="text-xs text-gray-500 hover:text-[#8B0000] flex items-center gap-1 mx-auto">
                                    <AlertTriangle className="w-3 h-3" /> Reportar erro neste conteúdo
                                </button>
                                {showReport && (
                                    <div className="mt-2 bg-[#F5F5DC] dark:bg-gray-800 p-2 rounded">
                                        <textarea 
                                            value={reportText} 
                                            onChange={e => setReportText(e.target.value)} 
                                            placeholder="Descreva o erro..." 
                                            className="w-full p-2 text-sm border border-[#C5A059] rounded dark:bg-gray-900 dark:text-white"
                                        />
                                        <button className="mt-2 bg-[#8B0000] text-white px-3 py-1 rounded text-xs flex items-center gap-1">
                                            <Send className="w-3 h-3" /> Enviar
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    </div>
  );
}