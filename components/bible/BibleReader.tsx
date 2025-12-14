
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Settings, Type, Play, Pause, CheckCircle, FastForward, ChevronRight, List, Book, ChevronDown, RefreshCw } from 'lucide-react';
import VersePanel from './VersePanel';
import { db } from '../../services/database';
import { generateChapterKey, BIBLE_BOOKS, ONE_CHAPTER_BOOKS } from '../../constants';
import { generateContent } from '../../services/geminiService';
import { Type as GenType } from "@google/genai";
import { ChapterMetadata } from '../../types';

// Skeleton Component para carregamento visual
const TextSkeleton = () => (
  <div className="space-y-8 animate-pulse mt-8 px-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex gap-4">
        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-800 rounded mt-2 shrink-0"></div>
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
        </div>
      </div>
    ))}
  </div>
);

// Mapeamento PT -> EN para API Internacional
const BOOK_NAME_MAPPING: Record<string, string> = {
    "Gênesis": "Genesis", "Êxodo": "Exodus", "Levítico": "Leviticus", "Números": "Numbers", "Deuteronômio": "Deuteronomy",
    "Josué": "Joshua", "Juízes": "Judges", "Rute": "Ruth", "1 Samuel": "1 Samuel", "2 Samuel": "2 Samuel",
    "1 Reis": "1 Kings", "2 Reis": "2 Kings", "1 Crônicas": "1 Chronicles", "2 Crônicas": "2 Chronicles",
    "Esdras": "Ezra", "Neemias": "Nehemiah", "Ester": "Esther", "Jó": "Job", "Salmos": "Psalms",
    "Provérbios": "Proverbs", "Eclesiastes": "Ecclesiastes", "Cantares": "Song of Solomon", "Isaías": "Isaiah",
    "Jeremias": "Jeremiah", "Lamentações": "Lamentations", "Ezequiel": "Ezekiel", "Daniel": "Daniel",
    "Oséias": "Hosea", "Joel": "Joel", "Amós": "Amos", "Obadias": "Obadiah", "Jonas": "Jonah",
    "Miquéias": "Micah", "Naum": "Nahum", "Habacuque": "Habakkuk", "Sofonias": "Zephaniah", "Ageu": "Haggai",
    "Zacarias": "Zechariah", "Malaquias": "Malachi", "Mateus": "Matthew", "Marcos": "Mark", "Lucas": "Luke",
    "João": "John", "Atos": "Acts", "Romanos": "Romans", "1 Coríntios": "1 Corinthians", "2 Coríntios": "2 Corinthians",
    "Gálatas": "Galatians", "Efésios": "Ephesians", "Filipenses": "Philippians", "Colossenses": "Colossians",
    "1 Tessalonicenses": "1 Thessalonians", "2 Tessalonicenses": "2 Thessalonians", "1 Timóteo": "1 Timothy",
    "2 Timóteo": "2 Timothy", "Tito": "Titus", "Filemom": "Philemon", "Hebreus": "Hebrews", "Tiago": "James",
    "1 Pedro": "1 Peter", "2 Pedro": "2 Peter", "1 João": "1 John", "2 João": "2 John", "3 João": "3 John",
    "Judas": "Jude", "Apocalipse": "Revelation"
};

export default function BibleReader({ userProgress, isAdmin, onProgressUpdate, onShowToast, onBack, initialBook, initialChapter }: any) {
  // Estado Principal
  const [book, setBook] = useState(initialBook || 'Gênesis');
  const [chapter, setChapter] = useState(initialChapter || 1);
  const [verses, setVerses] = useState<{number: number, text: string}[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<{text: string, number: number} | null>(null);
  
  // Estado de UI
  const [fontSize, setFontSize] = useState(20);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterSelector, setShowChapterSelector] = useState(false);
  const [selectorTab, setSelectorTab] = useState<'books' | 'chapters'>('chapters');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Epígrafe (IA)
  const [epigraph, setEpigraph] = useState<ChapterMetadata | null>(null);
  const [loadingEpigraph, setLoadingEpigraph] = useState(false);

  // Áudio
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);

  // Timer de Leitura
  const [timeLeft, setTimeLeft] = useState(40);
  const [canMarkRead, setCanMarkRead] = useState(false);
  const timerRef = useRef<any>(null);

  // Swipe logic
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
    window.scrollTo(0, 0);
    return () => {
        clearInterval(timerRef.current);
        window.speechSynthesis.cancel();
    };
  }, [book, chapter]);

  // Carregar vozes do sistema
  useEffect(() => {
    const loadVoices = () => {
        const available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        setVoices(available);
        if(available.length > 0) setSelectedVoice(available[0].name);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Lógica do Timer
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

  // --- FETCHING ROBUSTO DA BÍBLIA ---
  const fetchChapter = async () => {
    setLoading(true);
    setErrorMsg('');
    setVerses([]);
    
    try {
        const engBook = BOOK_NAME_MAPPING[book] || book;
        const isSingleChapter = ONE_CHAPTER_BOOKS.includes(book);
        
        // Estratégia Híbrida:
        // 1. Livros normais: Busca padrão (Book + Chapter)
        // 2. Livros de 1 capítulo: Busca com Range (Book + 1:1-200) para forçar versículos
        
        const standardUrl = `https://bible-api.com/${engBook}+${chapter}?translation=almeida`;
        // Nota: Para livros de 1 cap, a API espera "Book+1:1-200" para retornar corretamente
        const rangeUrl = `https://bible-api.com/${engBook}+${isSingleChapter ? '1' : chapter}:1-200?translation=almeida`;

        let urlToUse = isSingleChapter ? rangeUrl : standardUrl;
        let fallbackUrl = isSingleChapter ? standardUrl : rangeUrl;

        let data;

        try {
            // TENTATIVA 1 (Prioritária)
            const res = await fetch(urlToUse);
            if (!res.ok) throw new Error("Primary fetch failed");
            data = await res.json();
            
            // Validação extra
            if (!data.verses || data.verses.length === 0) throw new Error("Empty verses");
            
        } catch (firstError) {
            // TENTATIVA 2 (Fallback)
            console.warn(`Tentativa 1 falhou para ${book}, tentando fallback...`);
            const res2 = await fetch(fallbackUrl);
            if (!res2.ok) throw new Error("API Indisponível");
            data = await res2.json();
        }

        if (data.verses && Array.isArray(data.verses)) {
             setVerses(data.verses.map((v: any) => ({ 
                 number: v.verse, 
                 text: v.text.replace(/\n/g, ' ').trim() 
             })));
        } else {
             throw new Error("Formato inválido");
        }

    } catch (e: any) {
        console.error("Erro crítico ao carregar bíblia:", e);
        setErrorMsg("Não foi possível carregar o texto sagrado. Verifique sua conexão.");
    } finally {
        setLoading(false);
    }
  };

  // --- EPÍGRAFES ---
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
        console.error(e);
    } finally {
        setLoadingEpigraph(false);
    }
  };

  const generateEpigraph = async (key: string) => {
    try {
        const prompt = `
            Contexto: Capítulo ${chapter} do livro de ${book} na Bíblia.
            Tarefa: Gere um Título Curto (Máx 5 palavras) e um Subtítulo (Máx 15 palavras) que resumam o tema teológico.
            JSON: { "title": "...", "subtitle": "..." }
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
    } catch (e) { console.error(e); }
  };

  // --- NAVEGAÇÃO & SELEÇÃO ---
  const handleNext = () => {
    if (chapter < totalChapters) {
        setChapter(c => c + 1);
    } else {
        const idx = BIBLE_BOOKS.findIndex(b => b.name === book);
        if (idx < BIBLE_BOOKS.length - 1) {
            setBook(BIBLE_BOOKS[idx + 1].name);
            setChapter(1);
        }
    }
  };

  const handlePrev = () => {
    if (chapter > 1) {
        setChapter(c => c - 1);
    } else {
        const idx = BIBLE_BOOKS.findIndex(b => b.name === book);
        if (idx > 0) {
            const prev = BIBLE_BOOKS[idx - 1];
            setBook(prev.name);
            setChapter(prev.chapters);
        }
    }
  };

  const handleBookSelect = (b: string) => {
      setBook(b);
      setChapter(1);
      setSelectorTab('chapters'); 
  };

  const handleMarkRead = async () => {
    if (!canMarkRead && !isRead) return;
    
    let newRead = [...(userProgress.chapters_read || [])];
    if (isRead) {
        newRead = newRead.filter(k => k !== chapterKey);
        onShowToast('Marcado como não lido.', 'info');
    } else {
        newRead.push(chapterKey);
        onShowToast('Capítulo concluído!', 'success');
    }

    const updated = await db.entities.ReadingProgress.update(userProgress.id, {
        chapters_read: newRead,
        total_chapters: newRead.length,
        last_book: book,
        last_chapter: chapter
    });
    onProgressUpdate(updated);
  };

  // --- AUDIO ---
  const togglePlay = () => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    } else {
        const text = verses.map(v => `${v.number}. ${v.text}`).join(' ');
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'pt-BR';
        utter.rate = playbackRate;
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utter.voice = voice;
        utter.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utter);
        setIsPlaying(true);
    }
  };

  // Swipe logic handlers
  const onTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) handleNext();
    if (distance < -50) handlePrev();
  };

  return (
    <div 
        className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300 flex flex-col"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
    >
        {/* HEADER */}
        <div className="sticky top-0 bg-[#8B0000] text-white p-3 shadow-lg z-30 flex justify-between items-center safe-top">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft /></button>
            
            <div 
                className="text-center cursor-pointer hover:bg-white/10 px-4 py-1 rounded-lg transition-colors flex flex-col items-center"
                onClick={() => {
                    setShowChapterSelector(!showChapterSelector);
                    setSelectorTab('chapters');
                }}
            >
                <h1 className="font-cinzel font-bold text-lg flex items-center gap-2 justify-center uppercase">
                    {book} {chapter} <ChevronDown className={`w-4 h-4 transition-transform ${showChapterSelector ? 'rotate-180' : ''}`} />
                </h1>
                <span className="text-[9px] font-montserrat opacity-80 uppercase tracking-widest">Almeida Recebida</span>
            </div>

            <div className="flex gap-1">
                <button onClick={handleMarkRead} className={`p-2 rounded-full transition-colors ${isRead ? 'text-green-300' : 'text-white/50'}`}>
                    <CheckCircle className="w-5 h-5" />
                </button>
                <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/10 rounded-full">
                    <Settings className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* SELETOR */}
        {showChapterSelector && (
          <div className="bg-white dark:bg-dark-card border-b border-[#C5A059] sticky top-[60px] z-20 shadow-xl animate-in slide-in-from-top-2 flex flex-col max-h-[70vh]">
              <div className="flex border-b border-[#C5A059]/30">
                  <button onClick={() => setSelectorTab('books')} className={`flex-1 py-4 font-cinzel font-bold text-sm flex items-center justify-center gap-2 ${selectorTab === 'books' ? 'bg-[#8B0000] text-white' : 'text-gray-600 dark:text-gray-400'}`}><Book className="w-4 h-4"/> Livros</button>
                  <button onClick={() => setSelectorTab('chapters')} className={`flex-1 py-4 font-cinzel font-bold text-sm flex items-center justify-center gap-2 ${selectorTab === 'chapters' ? 'bg-[#8B0000] text-white' : 'text-gray-600 dark:text-gray-400'}`}><List className="w-4 h-4"/> Capítulos</button>
              </div>
              <div className="overflow-y-auto p-2">
                  {selectorTab === 'books' ? (
                      <div className="grid grid-cols-3 gap-2 p-2">
                        {BIBLE_BOOKS.map(b => (
                            <button key={b.name} onClick={() => handleBookSelect(b.name)} className={`p-2 rounded text-xs font-bold truncate ${book === b.name ? 'bg-[#8B0000] text-white' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200'}`}>{b.name}</button>
                        ))}
                      </div>
                  ) : (
                      <div className="grid grid-cols-5 gap-2 p-2">
                        {Array.from({ length: totalChapters }, (_, i) => i + 1).map(c => (
                            <button key={c} onClick={() => { setChapter(c); setShowChapterSelector(false); }} className={`p-2 rounded font-bold text-sm ${chapter === c ? 'bg-[#8B0000] text-white' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200'}`}>{c}</button>
                        ))}
                      </div>
                  )}
              </div>
          </div>
        )}

        {/* SETTINGS */}
        {showSettings && (
            <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059] sticky top-[60px] z-20 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-sm dark:text-white">Tamanho:</span>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="p-2 border rounded dark:text-white"><Type className="w-4 h-4" /></button>
                        <span className="dark:text-white font-bold">{fontSize}</span>
                        <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="p-2 border rounded dark:text-white"><Type className="w-6 h-6" /></button>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className="font-bold text-sm dark:text-white">Velocidade Voz:</span>
                    <div className="flex gap-2">
                        {[1, 1.5, 2].map(r => (
                            <button key={r} onClick={() => setPlaybackRate(r)} className={`px-3 py-1 text-xs rounded border ${playbackRate === r ? 'bg-[#8B0000] text-white' : 'dark:text-white'}`}>{r}x</button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto pb-48">
            {/* Epígrafe */}
            {loadingEpigraph ? (
              <div className="max-w-3xl mx-auto mt-8 px-6 text-center">
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto mb-2"></div>
              </div>
            ) : epigraph && (
                <div className="max-w-3xl mx-auto mt-8 px-6 text-center animate-in fade-in duration-500">
                    <h2 className="font-cinzel text-[#8B0000] dark:text-[#ff6b6b] font-bold text-xl uppercase tracking-widest mb-1">{epigraph.title}</h2>
                    <div className="w-16 h-1 bg-[#C5A059] mx-auto mb-2"></div>
                    <p className="font-cormorant text-gray-600 dark:text-gray-300 italic text-lg">{epigraph.subtitle}</p>
                </div>
            )}

            {loading ? (
                <TextSkeleton />
            ) : errorMsg ? (
                <div className="text-center py-20 px-6">
                    <p className="text-red-500 mb-4">{errorMsg}</p>
                    <button onClick={fetchChapter} className="bg-[#8B0000] text-white px-4 py-2 rounded flex items-center gap-2 mx-auto"><RefreshCw className="w-4 h-4"/> Tentar Novamente</button>
                </div>
            ) : (
                <div className="p-6 max-w-3xl mx-auto space-y-6">
                    {verses.map(v => (
                        <div 
                            key={v.number} 
                            onClick={() => setSelectedVerse(v)}
                            className={`relative pl-8 pr-2 py-2 rounded transition-colors cursor-pointer border-l-2 border-transparent hover:border-[#C5A059] ${selectedVerse?.number === v.number ? 'bg-[#C5A059]/10 border-[#C5A059]' : ''}`}
                        >
                            <span className="absolute left-0 top-2 font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] text-xs w-6 text-center select-none">{v.number}</span>
                            <p 
                                className="font-cormorant leading-relaxed text-[#1a0f0f] dark:text-gray-200 text-justify"
                                style={{ fontSize: `${fontSize}px` }}
                            >
                                {v.text}
                            </p>
                        </div>
                    ))}
                    <div className="h-10"></div>
                </div>
            )}
        </div>

        {/* FAB Audio */}
        <button 
            onClick={togglePlay}
            className="fixed bottom-28 right-4 w-14 h-14 bg-[#C5A059] text-[#1a0f0f] rounded-full shadow-2xl flex items-center justify-center z-[100] hover:bg-[#d4b97a] border-2 border-white dark:border-gray-800"
        >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
        </button>

        {/* Footer Navigation */}
        <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-[#121212] border-t border-[#C5A059] shadow-[0_-5px_20px_rgba(0,0,0,0.2)] pb-6 pt-4 px-4 z-[100] flex justify-between items-center safe-bottom">
            <button onClick={handlePrev} className="flex flex-col items-center p-2 text-gray-600 dark:text-gray-300 hover:text-[#8B0000]">
                <ChevronLeft className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase">Ant.</span>
            </button>

            <button 
                onClick={handleMarkRead}
                disabled={!canMarkRead && !isRead}
                className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold shadow-lg transition-all transform active:scale-95 ${
                    isRead ? 'bg-green-600 text-white' : canMarkRead ? 'bg-[#8B0000] text-white animate-pulse' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                }`}
            >
                {isRead ? 'LIDO' : canMarkRead ? 'CONCLUIR' : `${timeLeft}s`}
            </button>

            <button onClick={handleNext} className="flex flex-col items-center p-2 text-gray-600 dark:text-gray-300 hover:text-[#8B0000]">
                <ChevronRight className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase">Próx.</span>
            </button>
        </div>

        {/* Verse Modal */}
        <VersePanel 
            isOpen={!!selectedVerse}
            onClose={() => setSelectedVerse(null)}
            verse={selectedVerse?.text || ''}
            verseNumber={selectedVerse?.number || 1}
            book={book}
            chapter={chapter}
            isAdmin={isAdmin}
            onShowToast={onShowToast}
            userProgress={userProgress} 
        />
    </div>
  );
}
