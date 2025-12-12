import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Settings, Type, Play, Pause, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import VersePanel from './VersePanel';
import { db } from '../../services/database';
import { generateChapterKey } from '../../constants';
import { generateContent } from '../../services/geminiService';
import { Type as GenType } from "@google/genai";
import { ChapterMetadata } from '../../types';

export default function BibleReader({ userProgress, isAdmin, onProgressUpdate, onShowToast, onBack, initialBook, initialChapter }: any) {
  const [book, setBook] = useState(initialBook || 'Gênesis');
  const [chapter, setChapter] = useState(initialChapter || 1);
  const [verses, setVerses] = useState<{number: number, text: string}[]>([]);
  const [fontSize, setFontSize] = useState(18);
  const [selectedVerse, setSelectedVerse] = useState<{text: string, number: number} | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [epigraph, setEpigraph] = useState<ChapterMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEpigraph, setLoadingEpigraph] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  
  const [timeLeft, setTimeLeft] = useState(40);
  const [canMarkRead, setCanMarkRead] = useState(false);
  const timerRef = useRef<any>(null);

  const chapterKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.chapters_read?.includes(chapterKey);

  useEffect(() => {
    fetchChapter();
    loadEpigraph();
    resetTimer();
    return () => {
        clearInterval(timerRef.current);
        window.speechSynthesis.cancel();
    };
  }, [book, chapter]);

  useEffect(() => {
    const loadVoices = () => {
        const available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        setVoices(available);
        if(available.length > 0) setSelectedVoice(available[0].name);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const resetTimer = () => {
    clearInterval(timerRef.current);
    if (!isRead) {
        setTimeLeft(40);
        setCanMarkRead(false);
        timerRef.current = setInterval(() => {
            setTimeLeft((prev: number) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setCanMarkRead(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    } else {
        setCanMarkRead(true);
        setTimeLeft(0);
    }
  };

  const fetchChapter = async () => {
    setLoading(true);
    try {
        const res = await fetch(`https://bible-api.com/${book}+${chapter}?translation=almeida`);
        const data = await res.json();
        setVerses(data.verses.map((v: any) => ({ number: v.verse, text: v.text })));
    } catch (e) {
        setVerses([{ number: 1, text: "Erro ao carregar texto. Verifique sua conexão." }]);
    } finally {
        setLoading(false);
    }
  };

  const loadEpigraph = async () => {
    setEpigraph(null);
    setLoadingEpigraph(true);
    const key = generateChapterKey(book, chapter);
    try {
        const existing = await db.entities.ChapterMetadata.filter({ chapter_key: key });
        
        if (existing && existing.length > 0) {
            setEpigraph(existing[0]);
        } else {
            // Auto-generate for ANY user (First access creates the content)
            await generateEpigraph(key);
        }
    } catch (e) {
        console.error("Error loading epigraph", e);
    } finally {
        setLoadingEpigraph(false);
    }
  };

  const generateEpigraph = async (key: string) => {
    try {
        const prompt = `
            Contexto: Capítulo ${chapter} do livro de ${book} na Bíblia.
            Tarefa: Gere um Título Curto (Máx 5 palavras) e um Subtítulo (Máx 15 palavras) que resumam o tema teológico deste capítulo.
            Formato JSON: { "title": "...", "subtitle": "..." }
        `;
        const schema = {
            type: GenType.OBJECT,
            properties: {
                title: { type: GenType.STRING },
                subtitle: { type: GenType.STRING }
            },
            required: ["title", "subtitle"]
        };
        
        const res = await generateContent(prompt, schema);
        
        if (res && res.title) {
            const data = { chapter_key: key, title: res.title, subtitle: res.subtitle };
            await db.entities.ChapterMetadata.create(data);
            setEpigraph(data);
        }
    } catch (e) {
        console.error("Failed to generate epigraph", e);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    } else {
        const text = verses.map(v => `${v.number}. ${v.text}`).join(' ');
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'pt-BR';
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utter.voice = voice;
        utter.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utter);
        setIsPlaying(true);
    }
  };

  const handleMarkRead = async () => {
    if (!canMarkRead && !isRead) return;
    
    let newRead = [...(userProgress.chapters_read || [])];
    if (isRead) {
        newRead = newRead.filter(k => k !== chapterKey);
        onShowToast('Capítulo marcado como não lido.', 'info');
    } else {
        newRead.push(chapterKey);
        onShowToast('Capítulo concluído! Glória a Deus!', 'success');
    }

    const updated = await db.entities.ReadingProgress.update(userProgress.id, {
        chapters_read: newRead,
        total_chapters: newRead.length,
        last_book: book,
        last_chapter: chapter
    });
    
    onProgressUpdate(updated);
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg pb-24 transition-colors duration-300">
      <div className="sticky top-0 bg-[#8B0000] text-white p-4 shadow-lg z-20 flex justify-between items-center">
        <button onClick={onBack}><ChevronLeft /></button>
        <div className="text-center">
            <h1 className="font-cinzel font-bold text-lg">{book} {chapter}</h1>
        </div>
        <button onClick={() => setShowSettings(!showSettings)}><Settings className="w-5 h-5" /></button>
      </div>

      {showSettings && (
        <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059] sticky top-[60px] z-10 animate-in slide-in-from-top-2 shadow-md">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <span className="font-montserrat text-sm font-bold text-[#1a0f0f] dark:text-gray-200">Fonte:</span>
                    <div className="flex items-center gap-4 text-black dark:text-white">
                        <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="p-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Type className="w-4 h-4" /></button>
                        <span className="font-bold w-6 text-center">{fontSize}</span>
                        <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="p-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Type className="w-6 h-6" /></button>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <span className="font-montserrat text-sm font-bold text-[#1a0f0f] dark:text-gray-200">Voz de Leitura:</span>
                    <select 
                        value={selectedVoice} 
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="p-2 border rounded w-full text-sm dark:bg-gray-700 dark:text-white"
                    >
                        {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                </div>
            </div>
        </div>
      )}

      {loadingEpigraph ? (
          <div className="max-w-3xl mx-auto mt-6 px-6 text-center">
              <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto mb-2"></div>
              <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto"></div>
          </div>
      ) : epigraph ? (
        <div className="max-w-3xl mx-auto mt-6 px-6 text-center animate-in fade-in zoom-in duration-500">
            <h2 className="font-cinzel text-[#8B0000] dark:text-[#ff6b6b] font-bold text-xl uppercase tracking-widest mb-1">{epigraph.title}</h2>
            <div className="w-16 h-1 bg-[#C5A059] mx-auto mb-2"></div>
            <p className="font-cormorant text-gray-600 dark:text-gray-300 italic text-lg">{epigraph.subtitle}</p>
        </div>
      ) : null}

      <button 
        onClick={togglePlay}
        className="fixed bottom-24 right-6 w-14 h-14 bg-[#C5A059] text-[#1a0f0f] rounded-full shadow-2xl flex items-center justify-center z-30 hover:bg-[#d4b97a] transition-all"
      >
        {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
      </button>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {loading ? (
             <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#8B0000] dark:text-white" /></div>
        ) : (
            verses.map(v => (
                <p 
                    key={v.number} 
                    className="font-cormorant leading-loose text-[#1a0f0f] dark:text-gray-200 cursor-pointer hover:bg-[#C5A059]/10 rounded px-2 transition-colors relative group"
                    style={{ fontSize: `${fontSize}px` }}
                    onClick={() => setSelectedVerse(v)}
                >
                    <span className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] text-xs absolute -left-2 top-1 opacity-50 group-hover:opacity-100">{v.number}</span>
                    {v.text}
                </p>
            ))
        )}
      </div>
      
      <div className="fixed bottom-0 w-full bg-white dark:bg-dark-card border-t border-[#C5A059] p-4 flex justify-between items-center z-30">
        <div className="flex gap-2">
            <button 
                onClick={() => setChapter(Math.max(1, chapter - 1))} 
                className="px-4 py-2 border rounded-lg text-sm font-bold text-[#8B0000] dark:text-[#ff6b6b] border-[#8B0000] dark:border-[#ff6b6b]"
            >
                Anterior
            </button>
        </div>

        <button 
            onClick={handleMarkRead}
            disabled={!canMarkRead && !isRead}
            className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${
                isRead 
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border border-green-300' 
                : canMarkRead 
                    ? 'bg-[#8B0000] text-white shadow-lg animate-pulse' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
        >
            {isRead ? (
                <>Lido <CheckCircle className="w-5 h-5" /></>
            ) : canMarkRead ? (
                <>Concluir Leitura</>
            ) : (
                <span className="font-mono">{timeLeft}s</span>
            )}
        </button>

        <div className="flex gap-2">
             <button 
                onClick={() => setChapter(chapter + 1)} 
                className="px-4 py-2 border rounded-lg text-sm font-bold text-[#8B0000] dark:text-[#ff6b6b] border-[#8B0000] dark:border-[#ff6b6b]"
            >
                Próximo
            </button>
        </div>
      </div>

      <VersePanel 
        isOpen={!!selectedVerse}
        onClose={() => setSelectedVerse(null)}
        verse={selectedVerse?.text || ''}
        verseNumber={selectedVerse?.number || 1}
        book={book}
        chapter={chapter}
        isAdmin={isAdmin}
        onShowToast={onShowToast}
      />
    </div>
  );
}