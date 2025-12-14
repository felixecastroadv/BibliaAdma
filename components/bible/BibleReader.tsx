import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Settings, Type, Play, Pause, CheckCircle, ChevronRight, List, Book, ChevronDown, RefreshCw, WifiOff, Zap, Globe2 } from 'lucide-react';
import VersePanel from './VersePanel';
import { db } from '../../services/database';
import { generateChapterKey, BIBLE_BOOKS } from '../../constants';
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

// Mapeamento para API Internacional (Bible-API.com)
const PT_TO_EN_BOOKS: Record<string, string> = {
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

interface BibleReaderProps {
    onBack: () => void;
    isAdmin: boolean;
    onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    initialBook?: string;
    initialChapter?: number;
    userProgress: any;
    onProgressUpdate: (newProgress: any) => void;
}

export default function BibleReader({ onBack, isAdmin, onShowToast, initialBook, initialChapter, userProgress, onProgressUpdate }: BibleReaderProps) {
    const [book, setBook] = useState(initialBook || 'Gênesis');
    const [chapter, setChapter] = useState(initialChapter || 1);
    const [verses, setVerses] = useState<{number: number, text: string}[]>([]);
    const [loading, setLoading] = useState(false);
    const [fontSize, setFontSize] = useState(18);
    const [showSettings, setShowSettings] = useState(false);
    const [showBookList, setShowBookList] = useState(false);
    
    // Panel State
    const [selectedVerse, setSelectedVerse] = useState<{text: string, number: number} | null>(null);

    // Metadata (Title/Subtitle)
    const [metadata, setMetadata] = useState<ChapterMetadata | null>(null);
    const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);

    // Audio
    const [isPlaying, setIsPlaying] = useState(false);
    const [speechUtterance, setSpeechUtterance] = useState<SpeechSynthesisUtterance | null>(null);

    // Offline Mode detection logic handled by fetch failure
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    useEffect(() => {
        loadChapter();
        loadMetadata();
        window.scrollTo(0, 0);
        return () => window.speechSynthesis.cancel();
    }, [book, chapter]);

    const loadChapter = async () => {
        setLoading(true);
        setIsOfflineMode(false);
        setVerses([]);
        
        const engBook = PT_TO_EN_BOOKS[book];
        // Usando Almeida (almeida) via bible-api.com
        try {
            const res = await fetch(`https://bible-api.com/${engBook}+${chapter}?translation=almeida`);
            if (!res.ok) throw new Error("Offline or API Error");
            const data = await res.json();
            
            // Process verses
            const cleanVerses = data.verses.map((v: any) => ({
                number: v.verse,
                text: v.text.trim()
            }));
            setVerses(cleanVerses);
        } catch (error) {
            console.warn("API Error, checking cache/offline...", error);
            setIsOfflineMode(true);
            onShowToast("Modo Offline: Não foi possível baixar o texto bíblico.", "error");
        } finally {
            setLoading(false);
        }
    };

    const loadMetadata = async () => {
        const key = generateChapterKey(book, chapter);
        try {
            const metas = await db.entities.ChapterMetadata.filter({ chapter_key: key });
            if (metas && metas.length > 0) {
                setMetadata(metas[0]);
            } else {
                setMetadata(null);
            }
        } catch (e) { console.error(e); }
    };

    const generateMetadata = async () => {
        if (!isAdmin) return;
        setIsGeneratingMeta(true);
        
        const prompt = `
            ATUE COMO: Editor de Bíblia de Estudo.
            TAREFA: Gerar Título e Subtítulo curto para ${book} ${chapter}.
            CONTEXTO: Resuma o tema central deste capítulo.
            SAÍDA JSON: { "title": "string", "subtitle": "string" }
        `;

        const schema = {
            type: GenType.OBJECT,
            properties: {
                title: { type: GenType.STRING },
                subtitle: { type: GenType.STRING }
            },
            required: ["title", "subtitle"]
        };

        try {
            const res = await generateContent(prompt, schema);
            const key = generateChapterKey(book, chapter);
            const newItem = { chapter_key: key, title: res.title, subtitle: res.subtitle };
            
            await db.entities.ChapterMetadata.create(newItem);
            setMetadata(newItem);
            onShowToast("Metadados gerados!", "success");
        } catch (e) {
            console.error(e);
            onShowToast("Erro ao gerar metadados.", "error");
        } finally {
            setIsGeneratingMeta(false);
        }
    };

    const handleNext = () => {
        const currentBookMeta = BIBLE_BOOKS.find(b => b.name === book);
        if (!currentBookMeta) return;

        if (chapter < currentBookMeta.chapters) {
            setChapter(c => c + 1);
        } else {
            // Next book
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
            // Prev book
            const idx = BIBLE_BOOKS.findIndex(b => b.name === book);
            if (idx > 0) {
                const prevBook = BIBLE_BOOKS[idx - 1];
                setBook(prevBook.name);
                setChapter(prevBook.chapters);
            }
        }
    };

    const toggleMarkRead = async () => {
        if (!userProgress) return;
        const key = generateChapterKey(book, chapter);
        const isRead = userProgress.chapters_read.includes(key);
        
        let newChaptersRead;
        let newTotal;

        if (isRead) {
            newChaptersRead = userProgress.chapters_read.filter((k: string) => k !== key);
            newTotal = Math.max(0, (userProgress.total_chapters || 0) - 1);
        } else {
            newChaptersRead = [...userProgress.chapters_read, key];
            newTotal = (userProgress.total_chapters || 0) + 1;
        }

        const updated = await db.entities.ReadingProgress.update(userProgress.id, {
            chapters_read: newChaptersRead,
            total_chapters: newTotal,
            last_book: book,
            last_chapter: chapter
        });

        if (onProgressUpdate) onProgressUpdate(updated);
        
        if (!isRead) onShowToast("Capítulo marcado como lido!", "success");
    };

    const handleAudio = () => {
        if (isPlaying) {
            window.speechSynthesis.cancel();
            setIsPlaying(false);
            return;
        }

        if (verses.length === 0) return;

        const text = `${book} capítulo ${chapter}. ${metadata?.title || ''}. ${verses.map(v => `Versículo ${v.number}. ${v.text}`).join(' ')}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.1;
        utterance.onend = () => setIsPlaying(false);
        
        setSpeechUtterance(utterance);
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
    };

    const isRead = userProgress?.chapters_read?.includes(generateChapterKey(book, chapter));

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300 pb-20">
            {/* Top Bar */}
            <div className="sticky top-0 bg-[#8B0000] text-white p-3 z-30 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-1"><ChevronLeft /></button>
                    <div className="flex flex-col cursor-pointer" onClick={() => setShowBookList(!showBookList)}>
                        <span className="font-cinzel font-bold text-lg leading-tight flex items-center gap-1">
                            {book} {chapter} <ChevronDown className="w-4 h-4" />
                        </span>
                        <span className="text-[10px] font-montserrat opacity-80 uppercase tracking-widest">
                            {metadata?.title || 'Leitura Bíblica'}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button onClick={handleAudio} className="p-2 hover:bg-white/10 rounded-full">
                        {isPlaying ? <Pause className="w-5 h-5 animate-pulse" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/10 rounded-full">
                        <Settings className="w-5 h-5" />
                    </button>
                    <button onClick={toggleMarkRead} className={`p-2 rounded-full transition-colors ${isRead ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}>
                        <CheckCircle className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Book Selector Overlay */}
            {showBookList && (
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowBookList(false)}>
                    <div className="absolute top-16 left-0 right-0 bg-white dark:bg-dark-card max-h-[70vh] overflow-y-auto p-4 rounded-b-xl shadow-2xl animate-in slide-in-from-top-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {BIBLE_BOOKS.map(b => (
                                <button 
                                    key={b.name}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setBook(b.name);
                                        setChapter(1);
                                        setShowBookList(false);
                                    }}
                                    className={`p-3 rounded text-sm font-bold text-left ${book === b.name ? 'bg-[#8B0000] text-white' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                >
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Overlay */}
            {showSettings && (
                <div className="fixed top-16 right-2 z-40 bg-white dark:bg-dark-card p-4 rounded-xl shadow-xl border border-[#C5A059] animate-in zoom-in-95 origin-top-right w-64">
                    <h4 className="font-bold text-sm mb-3 dark:text-white flex items-center gap-2"><Type className="w-4 h-4"/> Aparência</h4>
                    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
                        <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="w-8 h-8 font-bold dark:text-white">-</button>
                        <span className="text-sm font-bold dark:text-white">{fontSize}px</span>
                        <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="w-8 h-8 font-bold dark:text-white">+</button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="max-w-2xl mx-auto p-4 md:p-8">
                {loading ? (
                    <TextSkeleton />
                ) : isOfflineMode ? (
                    <div className="text-center py-20 opacity-50 dark:text-white">
                        <WifiOff className="w-16 h-16 mx-auto mb-4" />
                        <p className="font-cinzel text-xl">Sem conexão</p>
                        <p className="text-sm">Não foi possível carregar o texto bíblico.</p>
                        <button onClick={loadChapter} className="mt-4 text-[#8B0000] underline font-bold">Tentar novamente</button>
                    </div>
                ) : (
                    <>
                        {/* Title Section */}
                        <div className="text-center mb-8 border-b-2 border-[#C5A059]/30 pb-6">
                            <h1 className="font-cinzel font-bold text-3xl text-[#1a0f0f] dark:text-[#ff6b6b] mb-2">{book} {chapter}</h1>
                            {metadata ? (
                                <div>
                                    <h2 className="font-montserrat font-bold text-lg text-[#8B0000] dark:text-[#C5A059] uppercase tracking-wider">{metadata.title}</h2>
                                    <p className="font-cormorant italic text-gray-500 dark:text-gray-400 mt-1">{metadata.subtitle}</p>
                                </div>
                            ) : isAdmin && (
                                <button 
                                    onClick={generateMetadata} 
                                    disabled={isGeneratingMeta}
                                    className="text-xs bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-full text-gray-500 flex items-center gap-1 mx-auto hover:bg-gray-300 dark:hover:bg-gray-700 transition"
                                >
                                    {isGeneratingMeta ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
                                    Gerar Título (Admin)
                                </button>
                            )}
                        </div>

                        {/* Verses */}
                        <div className="space-y-4">
                            {verses.map((v) => {
                                const verseKey = `${book.toLowerCase().replace(/\s/g, '_')}_${chapter}_${v.number}`;
                                // Check if there is content in DB for this verse to show indicator (optional optimization)
                                // For now, we just render
                                return (
                                    <div 
                                        key={v.number} 
                                        onClick={() => setSelectedVerse(v)}
                                        className={`relative pl-4 group cursor-pointer transition-colors rounded hover:bg-[#C5A059]/10 p-1`}
                                    >
                                        <span className="absolute left-0 top-1 text-xs font-bold text-[#C5A059] font-montserrat select-none">{v.number}</span>
                                        <p 
                                            className="font-cormorant text-gray-900 dark:text-gray-200 leading-relaxed text-justify"
                                            style={{ fontSize: `${fontSize}px`, lineHeight: '1.6' }}
                                        >
                                            {v.text}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Navigation Footer */}
                        <div className="flex justify-between mt-12 pt-8 border-t border-[#C5A059]/20">
                            <button onClick={handlePrev} className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 font-bold text-sm dark:text-white transition">
                                <ChevronLeft className="w-4 h-4" /> Anterior
                            </button>
                            <button onClick={handleNext} className="flex items-center gap-2 px-4 py-3 bg-[#8B0000] text-white rounded-lg shadow-md hover:bg-[#600018] font-bold text-sm transition">
                                Próximo <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Verse Panel */}
            <VersePanel 
                isOpen={!!selectedVerse}
                onClose={() => setSelectedVerse(null)}
                verse={selectedVerse?.text || ''}
                verseNumber={selectedVerse?.number || 0}
                book={book}
                chapter={chapter}
                isAdmin={isAdmin}
                onShowToast={onShowToast}
                userProgress={userProgress}
            />
        </div>
    );
}