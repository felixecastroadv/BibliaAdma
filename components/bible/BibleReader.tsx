import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Settings, Type, Play, Pause, CheckCircle, Sparkles, FastForward } from 'lucide-react';
import VersePanel from './VersePanel';
import { db } from '../../services/database';
import { generateChapterKey, BIBLE_BOOKS } from '../../constants';
import { generateContent } from '../../services/geminiService';
import { Type as GenType } from "@google/genai";
import { ChapterMetadata } from '../../types';

// Skeleton Component para carregamento elegante
const TextSkeleton = () => (
  <div className="space-y-4 animate-pulse mt-4">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="flex gap-2">
        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded mt-1 shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    ))}
  </div>
);

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
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  
  const [timeLeft, setTimeLeft] = useState(40);
  const [canMarkRead, setCanMarkRead] = useState(false);
  const timerRef = useRef<any>(null);

  // Swipe State
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const chapterKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.chapters_read?.includes(chapterKey);
  
  const currentBookMeta = BIBLE_BOOKS.find(b => b.name === book);
  const totalChapters = currentBookMeta ? currentBookMeta.chapters : 50;

  useEffect(() => {
    fetchChapter();
    loadEpigraph();
    resetTimer();
    // Scroll to top on chapter change
    window.scrollTo(0, 0);
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

  useEffect(() => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        speakText();
    }
  }, [playbackRate]);

  // SWIPE LOGIC
  const minSwipeDistance = 50;
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && chapter < totalChapters) {
        setChapter(prev => prev + 1); // Next Chapter
    }
    if (isRightSwipe && chapter > 1) {
        setChapter(prev => prev - 1); // Prev Chapter
    }
  };

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

  const speakText = () => {
    const text = verses.map(v => `${v.number}. ${v.text}`).join(' ');
    const utter = new SpeechSynthesisUtterance(text);
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

  const handleChapterChange = (newChapter: number) => {
      setChapter(newChapter);
      setShowSettings(false);
  };

  return (
    <div 
      className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg pb-24 transition-colors duration-300"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="sticky top-0 bg-[#8B0000] text-white p-4 shadow-lg z-20 flex justify-between items-center safe-top">
        <button onClick={onBack} className="p-1"><ChevronLeft /></button>
        <div className="text-center">
            <h1 className="font-cinzel font-bold text-lg">{book} {chapter}</h1>
            <p className="text-[10px] font-montserrat opacity-70">Deslize para navegar</p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-1"><Settings className="w-5 h-5" /></button>
      </div>

      {showSettings && (
        <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059] sticky top-[60px] z-10 animate-in slide-in-from-top-2 shadow-md">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <span className="font-montserrat text-sm font-bold text-[#1a0f0f] dark:text-gray-200">Ir para Capítulo:</span>
                    <select 
                        value={chapter} 
                        onChange={(e) => handleChapterChange(Number(e.target.value))}
                        className="p-2 border rounded w-full text-sm dark:bg-gray-700 dark:text-white"
                    >
                        {Array.from({ length: totalChapters }, (_, i) => i + 1).map(c => (
                            <option key={c} value={c}>Capítulo {c}</option>
                        ))}
                    </select>
                </div>

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

                <div className="flex flex-col gap-2">
                    <span className="font-montserrat text-sm font-bold text-[#1a0f0f] dark:text-gray-200 flex items-center gap-2">
                        <FastForward className="w-4 h-4" /> Velocidade:
                    </span>
                    <div className="flex gap-2">
                        {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                            <button 
                                key={rate}
                                onClick={() => setPlaybackRate(rate)}
                                className={`flex-1 py-1 text-xs font-bold rounded border ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000]' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'}`}
                            >
                                {rate}x
                            </button>
                        ))}
                    </div>
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

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {loading ? (
             <TextSkeleton />
        ) : (
            verses.map(v => (
                <div
                    key={v.number} 
                    className="relative group"
                    onClick={() => setSelectedVerse(v)}
                >
                    <span className="absolute -left-3 top-1 font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] text-xs opacity-60 select-none">
                        {v.number}
                    </span>
                    <p 
                        className="font-cormorant leading-loose tracking-wide text-[#1a0f0f] dark:text-gray-200 cursor-pointer hover:bg-[#C5A059]/10 rounded px-1 transition-colors text-justify"
                        style={{ fontSize: `${fontSize}px` }}
                    >
                        {v.text}
                    </p>
                </div>
            ))
        )}
      </div>

      {/* Floating Audio Button */}
      <button 
        onClick={togglePlay}
        className="fixed bottom-24 right-4 w-12 h-12 bg-[#C5A059] text-[#1a0f0f] rounded-full shadow-2xl flex items-center justify-center z-30 hover:bg-[#d4b97a] transition-all"
        title={isPlaying ? "Pausar Leitura" : "Ouvir Capítulo"}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
      </button>
      
      {/* Botões de Ação Inferior (Fixos acima da BottomNav) */}
      <div className="fixed bottom-16 left-0 w-full bg-gradient-to-t from-white via-white to-transparent dark:from-[#121212] dark:via-[#121212] p-4 flex justify-center items-end z-20 pb-4 h-24 pointer-events-none">
        <button 
            onClick={handleMarkRead}
            disabled={!canMarkRead && !isRead}
            className={`pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all transform active:scale-95 ${
                isRead 
                ? 'bg-green-600 text-white' 
                : canMarkRead 
                    ? 'bg-[#8B0000] text-white animate-pulse' 
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