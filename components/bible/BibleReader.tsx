
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Settings, Type, Play, Pause, CheckCircle, ChevronRight, List, Book, ChevronDown, RefreshCw, WifiOff, Zap, Volume2, X, FastForward, Search, Trash2, Sparkles, Loader2, Clock, Lock } from 'lucide-react';
import VersePanel from './VersePanel';
import { db } from '../../services/database';
import { generateChapterKey, BIBLE_BOOKS } from '../../constants';
import { generateContent } from '../../services/geminiService';
// REMOVIDO IMPORT LENTO: import { Type as GenType } from "@google/genai";
import { ChapterMetadata } from '../../types';

const BookSelector = ({ isOpen, onClose, currentBook, onSelect }: any) => {
    const [tab, setTab] = useState<'AT' | 'NT'>('AT');
    const [selectedBook, setSelectedBook] = useState<string | null>(null);
    const booksAT = BIBLE_BOOKS.filter(b => b.testament === 'old');
    const booksNT = BIBLE_BOOKS.filter(b => b.testament === 'new');
    const currentList = tab === 'AT' ? booksAT : booksNT;
    const activeBookData = BIBLE_BOOKS.find(b => b.name === (selectedBook || currentBook));

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 bg-[#FDFBF7] dark:bg-[#121212] flex flex-col animate-in slide-in-from-bottom-5 duration-300">
            <div className="bg-[#8B0000] text-white p-4 shadow-lg flex justify-between items-center shrink-0 safe-top">
                <h2 className="font-cinzel font-bold text-lg tracking-wide">Navegação Bíblica</h2>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full active:scale-90 transition-transform"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex bg-white dark:bg-[#1E1E1E] border-b border-[#C5A059]">
                <button onClick={() => { setTab('AT'); setSelectedBook(null); }} className={`flex-1 py-4 font-cinzel font-bold text-sm transition-all duration-300 ${tab === 'AT' ? 'bg-[#C5A059]/10 text-[#8B0000] border-b-4 border-[#8B0000] dark:text-[#C5A059]' : 'text-gray-400 hover:text-gray-600'}`}>VELHO TESTAMENTO</button>
                <button onClick={() => { setTab('NT'); setSelectedBook(null); }} className={`flex-1 py-4 font-cinzel font-bold text-sm transition-all duration-300 ${tab === 'NT' ? 'bg-[#C5A059]/10 text-[#8B0000] border-b-4 border-[#8B0000] dark:text-[#C5A059]' : 'text-gray-400 hover:text-gray-600'}`}>NOVO TESTAMENTO</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-[#F5F5DC] dark:bg-[#121212]">
                {!selectedBook ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {currentList.map(b => (
                            <button key={b.name} onClick={() => setSelectedBook(b.name)} className={`p-4 rounded-2xl border text-left transition-all active:scale-95 duration-200 ${currentBook === b.name ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-lg shadow-red-900/20' : 'bg-white dark:bg-[#1E1E1E] dark:text-gray-200 border-[#C5A059]/20 hover:border-[#8B0000] shadow-sm'}`}>
                                <span className="font-cinzel font-bold block text-sm">{b.name}</span>
                                <span className="text-[10px] opacity-70 uppercase tracking-wider font-montserrat">{b.chapters} Caps</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
                        <button onClick={() => setSelectedBook(null)} className="mb-4 text-[#8B0000] dark:text-[#ff6b6b] flex items-center gap-1 font-bold text-sm active:opacity-60 transition-opacity"><ChevronLeft className="w-4 h-4" /> Voltar para Livros</button>
                        <h3 className="font-cinzel text-3xl font-bold text-center mb-8 text-[#1a0f0f] dark:text-white pb-2">{selectedBook}</h3>
                        <div className="grid grid-cols-5 gap-3">
                            {Array.from({ length: activeBookData?.chapters || 0 }, (_, i) => i + 1).map(chap => (
                                <button key={chap} onClick={() => { onSelect(selectedBook, chap); onClose(); }} className="aspect-square flex items-center justify-center rounded-xl bg-white dark:bg-[#1E1E1E] border border-[#C5A059]/30 font-montserrat font-bold text-lg hover:bg-[#8B0000] hover:text-white hover:border-[#8B0000] active:scale-90 transition-all duration-200 dark:text-gray-200 shadow-sm">{chap}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Componente Skeleton Loading Premium
const BibleSkeleton = () => (
    <div className="space-y-8 animate-pulse mt-8 px-2">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
                <div className="w-8 h-8 bg-[#C5A059]/10 rounded-lg flex-shrink-0 mt-1"></div>
                <div className="flex-1 space-y-3">
                    <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-11/12"></div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-4/6"></div>
                </div>
            </div>
        ))}
    </div>
);

export default function BibleReader({ onBack, isAdmin, onShowToast, initialBook, initialChapter, userProgress, onProgressUpdate }: any) {
    const [book, setBook] = useState(initialBook || 'Gênesis');
    const [chapter, setChapter] = useState(initialChapter || 1);
    const [verses, setVerses] = useState<{number: number, text: string}[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [sourceMode, setSourceMode] = useState<'offline' | 'online' | 'cloud'>('offline');
    
    const [showSelector, setShowSelector] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [fontSize, setFontSize] = useState(20); 
    const [selectedVerse, setSelectedVerse] = useState<{text: string, number: number} | null>(null);

    const [metadata, setMetadata] = useState<ChapterMetadata | null>(null);
    const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [playbackRate, setPlaybackRate] = useState(1);
    
    // --- LÓGICA DO TIMER DE LEITURA (RANKING JUSTO) ---
    const READING_TIME_SEC = 40;
    const [readingTimer, setReadingTimer] = useState(0);

    const chapterKey = generateChapterKey(book, chapter);
    const isRead = userProgress?.chapters_read?.includes(chapterKey);
    const isLocked = !isRead && readingTimer > 0;

    useEffect(() => {
        const load = () => {
            const v = window.speechSynthesis.getVoices().filter(voice => voice.lang.includes('pt'));
            setVoices(v);
            if(v.length > 0 && !selectedVoice) setSelectedVoice(v[0].name);
        };
        load();
        window.speechSynthesis.onvoiceschanged = load;
        return () => window.speechSynthesis.cancel();
    }, []);

    useEffect(() => {
        if (isPlaying) {
            window.speechSynthesis.cancel();
            togglePlay();
        }
    }, [playbackRate, selectedVoice]);

    // Efeito para carregar capítulo e INICIAR TIMER
    useEffect(() => {
        window.scrollTo(0, 0);
        fetchChapter();
        loadMetadata();

        // Se já foi lido, timer é 0. Se não, inicia em 40s.
        if (isRead) {
            setReadingTimer(0);
        } else {
            setReadingTimer(READING_TIME_SEC);
        }

    }, [book, chapter]); // Reinicia sempre que muda o capítulo

    // Efeito para contagem regressiva
    useEffect(() => {
        let interval: any;
        if (readingTimer > 0 && !isRead) {
            interval = setInterval(() => {
                setReadingTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [readingTimer, isRead]);

    const fetchChapter = async () => {
        setLoading(true);
        setErrorMsg('');
        setVerses([]);
        setSourceMode('offline');
        
        try {
            const bookMeta = BIBLE_BOOKS.find(b => b.name === book);
            if (!bookMeta) throw new Error("Livro não encontrado.");

            const cacheKey = `bible_acf_${bookMeta.abbrev}_${chapter}`;
            
            // 1. TENTA OFFLINE (IndexedDB)
            const cached = await db.entities.BibleChapter.getOffline(cacheKey);
            if (cached && Array.isArray(cached) && cached.length > 0) {
                const formatted = cached.map((t: string, i: number) => ({ number: i + 1, text: t }));
                setVerses(formatted);
                setLoading(false);
                return;
            }

            // 2. TENTA LOCAL STORAGE (LEGADO)
            const legacyCache = localStorage.getItem(cacheKey);
            if (legacyCache) {
                try {
                    const parsed = JSON.parse(legacyCache);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        if (typeof parsed[0] === 'string') {
                            const formatted = parsed.map((t: string, i: number) => ({ number: i + 1, text: t }));
                            setVerses(formatted);
                            setLoading(false);
                            return;
                        } else if (typeof parsed[0] === 'object' && parsed[0].text) {
                            setVerses(parsed);
                            setLoading(false);
                            return;
                        }
                    }
                } catch(e) {}
            }

            // 3. TENTA NUVEM (SUPABASE - UNIVERSAL)
            // Se o admin subiu o JSON, vai estar aqui
            const cloudData = await db.entities.BibleChapter.getCloud(cacheKey);
            if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
                setSourceMode('cloud');
                const formatted = cloudData.map((t: string, i: number) => ({ number: i + 1, text: t }));
                setVerses(formatted);
                
                // Salva offline para a próxima vez ser rápido
                await db.entities.BibleChapter.saveOffline(cacheKey, cloudData);
                
                setLoading(false);
                return;
            }

            // 4. FALLBACK FINAL: API EXTERNA
            setSourceMode('online');
            const res = await fetch(`https://www.abibliadigital.com.br/api/verses/acf/${bookMeta.abbrev}/${chapter}`);
            if (!res.ok) throw new Error("Falha ao baixar da internet.");
            
            const data = await res.json();
            
            if (data.verses && data.verses.length > 0) {
                const cleanVerses = data.verses.map((v: any) => ({
                    number: v.number,
                    text: v.text.trim()
                }));
                
                const simpleVerses = cleanVerses.map((v:any) => v.text);
                
                // Salva tanto no Local quanto na Nuvem (se possível/desejado, mas por padrão salvamos local)
                await db.entities.BibleChapter.saveOffline(cacheKey, simpleVerses);
                
                setVerses(cleanVerses);
            } else {
                throw new Error("Capítulo vazio.");
            }

        } catch (e: any) {
            console.error(e);
            setErrorMsg("Não foi possível carregar o texto.");
        } finally {
            setLoading(false);
        }
    };

    const clearCacheAndRetry = async () => {
        const bookMeta = BIBLE_BOOKS.find(b => b.name === book);
        if(bookMeta) {
            const key = `bible_acf_${bookMeta.abbrev}_${chapter}`;
            localStorage.removeItem(key);
            // Também limparíamos do IndexedDB se tivéssemos a ref aqui, mas o fetchChapter sobrescreve
            fetchChapter();
        }
    };

    const loadMetadata = async () => {
        setMetadata(null);
        try {
            // 1. Tenta Local (IndexedDB)
            let meta = await db.entities.ChapterMetadata.get(chapterKey);
            
            if (!meta) {
               // 2. Tenta Nuvem (Supabase - Universal)
               const cloudMeta = await db.entities.ChapterMetadata.getCloud(chapterKey);
               if (cloudMeta) {
                   meta = cloudMeta;
                   // Salva localmente para não precisar baixar de novo
                   await db.entities.ChapterMetadata.save(meta);
               }
            }

            if (meta) {
                setMetadata(meta);
            } else {
                // 3. Se não existe nem local nem na nuvem, gera.
                if (navigator.onLine) {
                    generateMetadata();
                }
            }
        } catch (e) { console.error("Metadata Error", e); }
    };

    const generateMetadata = async () => {
        if (isGeneratingMeta) return;
        setIsGeneratingMeta(true);
        const prompt = `Para o capítulo bíblico de ${book} ${chapter}, responda APENAS um objeto JSON (sem markdown) neste formato: { "title": "Título Curto (Max 5 palavras)", "subtitle": "Resumo em 1 frase" }. Seja clássico e conservador.`;
        try {
            const rawText = await generateContent(prompt, null);
            if (rawText) {
                const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                const res = JSON.parse(cleanJson);
                if (res && res.title) {
                    const data = { chapter_key: chapterKey, title: res.title, subtitle: res.subtitle };
                    // A função .save agora salva tanto no Local quanto na Nuvem (Universal)
                    await db.entities.ChapterMetadata.save(data);
                    setMetadata(data);
                }
            }
        } catch (e) {
            console.error("Failed to generate metadata", e);
        } finally { 
            setIsGeneratingMeta(false); 
        }
    };

    const togglePlay = () => {
        if (isPlaying) { window.speechSynthesis.cancel(); setIsPlaying(false); }
        else {
            if (verses.length === 0) return;
            const text = `${book} ${chapter}. ${verses.map(v => `${v.text}`).join(' ')}`;
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'pt-BR'; utter.rate = playbackRate;
            const v = voices.find(vo => vo.name === selectedVoice);
            if (v) utter.voice = v;
            utter.onend = () => setIsPlaying(false);
            window.speechSynthesis.speak(utter);
            setIsPlaying(true);
        }
    };

    const toggleRead = async () => {
        if (!userProgress) return;
        
        // Bloqueio de Segurança Anti-Fraude
        if (isLocked) {
            onShowToast(`Leia o capítulo por mais ${readingTimer} segundos para confirmar.`, "info");
            return;
        }

        let newRead = isRead ? userProgress.chapters_read.filter((k: string) => k !== chapterKey) : [...(userProgress.chapters_read || []), chapterKey];
        let newTotal = isRead ? Math.max(0, (userProgress.total_chapters || 0) - 1) : (userProgress.total_chapters || 0) + 1;
        onShowToast(isRead ? "Marcado como não lido" : "Capítulo concluído!", isRead ? "info" : "success");
        const updated = await db.entities.ReadingProgress.update(userProgress.id, { chapters_read: newRead, total_chapters: newTotal, last_book: book, last_chapter: chapter });
        if (onProgressUpdate) onProgressUpdate(updated);
    };

    const handleNext = () => {
        const meta = BIBLE_BOOKS.find(b => b.name === book);
        if (!meta) return;
        if (chapter < meta.chapters) setChapter(c => c + 1);
        else {
            const idx = BIBLE_BOOKS.findIndex(b => b.name === book);
            if (idx < BIBLE_BOOKS.length - 1) { setBook(BIBLE_BOOKS[idx + 1].name); setChapter(1); }
        }
    };

    const handlePrev = () => {
        if (chapter > 1) setChapter(c => c - 1);
        else {
            const idx = BIBLE_BOOKS.findIndex(b => b.name === book);
            if (idx > 0) { const prev = BIBLE_BOOKS[idx - 1]; setBook(prev.name); setChapter(prev.chapters); }
        }
    };

    return (
        <div className="min-h-screen bg-transparent flex flex-col transition-colors duration-300">
            {/* Header com Ultra Glassmorphism */}
            <div className="sticky top-0 z-30 bg-[#8B0000]/80 dark:bg-black/60 backdrop-blur-xl text-white p-3 shadow-lg flex justify-between items-center border-b border-white/10 safe-top">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90"><ChevronLeft /></button>
                    <div className="flex flex-col cursor-pointer active:opacity-70 transition-opacity" onClick={() => setShowSelector(true)}>
                        <h1 className="font-cinzel font-bold text-lg flex items-center gap-2 leading-none drop-shadow-sm tracking-wide">
                            {book} {chapter} <ChevronDown className="w-4 h-4 text-[#C5A059]" />
                        </h1>
                        <span className="text-[9px] uppercase tracking-[0.2em] opacity-70 font-montserrat">Almeida Corrigida</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={togglePlay} className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90">{isPlaying ? <Pause className="w-5 h-5 animate-pulse text-[#C5A059]" /> : <Play className="w-5 h-5" />}</button>
                    
                    {/* Botão de Check no Header com Feedback Visual de Bloqueio */}
                    <button 
                        onClick={toggleRead} 
                        disabled={isLocked}
                        className={`p-2 rounded-full transition-all active:scale-90 relative ${
                            isRead 
                            ? 'text-green-400 bg-green-900/20' 
                            : isLocked 
                                ? 'text-gray-400 opacity-50 cursor-not-allowed' 
                                : 'hover:bg-white/10 text-white/70'
                        }`}
                    >
                        {isLocked ? (
                            <div className="relative">
                                <Lock className="w-5 h-5" />
                                <span className="absolute -top-2 -right-2 text-[8px] font-bold bg-[#C5A059] text-black px-1 rounded-full">{readingTimer}</span>
                            </div>
                        ) : (
                            <CheckCircle className="w-5 h-5" />
                        )}
                    </button>
                    
                    <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-all active:scale-90 ${showSettings ? 'bg-white/20 text-[#C5A059]' : 'hover:bg-white/10'}`}><Settings className="w-5 h-5" /></button>
                </div>
            </div>

            {showSettings && (
                <div className="bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-xl border-b border-[#C5A059] p-6 shadow-2xl animate-in slide-in-from-top-5 relative z-20">
                    <div className="grid gap-6 max-w-lg mx-auto">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 font-montserrat"><Type className="w-4 h-4 text-[#C5A059]"/> TAMANHO</span>
                            <div className="flex items-center gap-4 bg-gray-100 dark:bg-black/30 p-1 rounded-full">
                                <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="w-10 h-10 rounded-full bg-white dark:bg-[#2A2A2A] shadow-sm flex items-center justify-center dark:text-white hover:scale-105 transition">-</button>
                                <span className="font-bold w-8 text-center dark:text-white font-cinzel">{fontSize}</span>
                                <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="w-10 h-10 rounded-full bg-white dark:bg-[#2A2A2A] shadow-sm flex items-center justify-center dark:text-white hover:scale-105 transition">+</button>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <span className="font-bold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3 font-montserrat"><Volume2 className="w-4 h-4 text-[#C5A059]"/> ÁUDIO & VOZ</span>
                            <div className="space-y-4">
                                <select 
                                    className="w-full p-3 text-sm border-none bg-gray-100 dark:bg-black/30 rounded-xl dark:text-white font-montserrat focus:ring-2 focus:ring-[#C5A059]"
                                    value={selectedVoice} 
                                    onChange={e => setSelectedVoice(e.target.value)}
                                >
                                    {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                </select>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1 uppercase tracking-wider">
                                        <FastForward className="w-3 h-3" /> Velocidade
                                    </span>
                                    <div className="flex gap-2">
                                        {[0.75, 1, 1.25, 1.5].map(rate => (
                                            <button 
                                                key={rate}
                                                onClick={() => setPlaybackRate(rate)}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${playbackRate === rate ? 'bg-[#8B0000] text-white shadow-lg shadow-red-900/30 scale-105' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200'}`}
                                            >
                                                {rate}x
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <BookSelector isOpen={showSelector} onClose={() => setShowSelector(false)} currentBook={book} onSelect={(b: string, c: number) => { setBook(b); setChapter(c); }} />

            <div className="flex-1 overflow-y-auto pb-24 scroll-smooth">
                <div className="max-w-3xl mx-auto p-6 md:p-12">
                    {loading ? (
                        <>
                            <div className="flex flex-col items-center mb-12 space-y-3">
                                <div className="h-10 w-64 bg-[#C5A059]/10 rounded-lg animate-pulse"></div>
                                <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                            </div>
                            <BibleSkeleton />
                        </>
                    ) : (
                        <div className="text-center mb-12 mt-4 cursor-pointer select-none" onClick={() => generateMetadata()} title="Regerar Epígrafe">
                            <h1 className="font-cinzel text-4xl md:text-5xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-4 uppercase tracking-tighter drop-shadow-sm leading-none">
                                {book} <span className="text-[#C5A059]">{chapter}</span>
                            </h1>

                            {isGeneratingMeta ? (
                                <div className="flex flex-col items-center text-[#C5A059] animate-pulse mt-4">
                                    <Sparkles className="w-5 h-5 mb-2" />
                                    <p className="font-cinzel text-[10px] font-bold uppercase tracking-[0.3em]">Contextualizando...</p>
                                </div>
                            ) : metadata ? (
                                <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <h2 className="font-cinzel text-xs md:text-sm font-bold text-[#C5A059] uppercase tracking-[0.3em] mb-2">
                                        {metadata.title}
                                    </h2>
                                    <p className="font-cormorant text-xl text-gray-600 dark:text-gray-400 italic leading-relaxed px-4">
                                        "{metadata.subtitle}"
                                    </p>
                                    <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent mx-auto mt-6 opacity-60"></div>
                                </div>
                            ) : (
                                <div className="h-8"></div>
                            )}
                        </div>
                    )}

                    {errorMsg ? (
                        <div className="text-center py-20">
                            <WifiOff className="w-16 h-16 mx-auto mb-4 text-[#8B0000] opacity-50"/>
                            <p className="text-gray-500 mb-6 font-cormorant text-lg">{errorMsg}</p>
                            <div className="flex flex-col gap-3 max-w-xs mx-auto">
                                <button onClick={fetchChapter} className="bg-[#8B0000] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 active:scale-95 transition-transform">
                                    <RefreshCw className="w-4 h-4"/> Tentar Novamente
                                </button>
                                <button onClick={clearCacheAndRetry} className="text-red-500 px-4 py-2 rounded flex items-center justify-center gap-2 text-xs hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                                    <Trash2 className="w-3 h-3"/> Forçar Download Online
                                </button>
                            </div>
                        </div>
                    ) : !loading && (
                        <div className="space-y-1">
                            {verses.map(v => (
                                <div 
                                    key={v.number} 
                                    onClick={() => setSelectedVerse(v)} 
                                    className={`relative pl-10 pr-4 py-3 rounded-xl transition-all duration-300 cursor-pointer group ${selectedVerse?.number === v.number ? 'bg-[#C5A059]/10 shadow-sm ring-1 ring-[#C5A059]/30' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                >
                                    <span className={`absolute left-2 top-3.5 font-cinzel font-bold text-xs w-6 text-center select-none transition-colors ${selectedVerse?.number === v.number ? 'text-[#8B0000] scale-110' : 'text-gray-400 group-hover:text-[#8B0000] dark:text-gray-600'}`}>{v.number}</span>
                                    <p 
                                        className="font-cormorant text-[#2D2D2D] dark:text-gray-200 text-justify tracking-wide transition-colors" 
                                        style={{ fontSize: `${fontSize}px`, lineHeight: '1.7' }}
                                    >
                                        {v.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Controls Float */}
            <div className="fixed bottom-6 left-0 w-full px-4 flex justify-between items-center z-20 pointer-events-none pb-safe">
                 <button onClick={handlePrev} className="pointer-events-auto w-12 h-12 bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur shadow-lg rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-[#8B0000] hover:scale-110 active:scale-95 transition-all border border-gray-200 dark:border-gray-700">
                    <ChevronLeft className="w-6 h-6" />
                 </button>

                 <button 
                    onClick={toggleRead}
                    disabled={isLocked}
                    className={`pointer-events-auto px-6 py-3 rounded-full font-cinzel font-bold shadow-xl transition-all transform active:scale-95 flex items-center gap-2 text-sm border backdrop-blur-md ${
                        isRead 
                        ? 'bg-green-600/90 text-white border-green-500 shadow-green-500/30' 
                        : isLocked
                            ? 'bg-gray-400/90 text-gray-100 border-gray-500 cursor-not-allowed grayscale'
                            : 'bg-[#8B0000]/90 text-white border-red-800 shadow-red-900/30 hover:scale-105'
                    }`}
                 >
                    {isRead ? (
                        <CheckCircle className="w-4 h-4" />
                    ) : isLocked ? (
                        <Clock className="w-4 h-4 animate-spin-slow" />
                    ) : null}
                    
                    {isRead 
                        ? 'LIDO' 
                        : isLocked 
                            ? `LENDO (${readingTimer}s)` 
                            : 'MARCAR LIDO'
                    }
                </button>

                 <button onClick={handleNext} className="pointer-events-auto w-12 h-12 bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur shadow-lg rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-[#8B0000] hover:scale-110 active:scale-95 transition-all border border-gray-200 dark:border-gray-700">
                    <ChevronRight className="w-6 h-6" />
                 </button>
            </div>

            <VersePanel isOpen={!!selectedVerse} onClose={() => setSelectedVerse(null)} verse={selectedVerse?.text || ''} verseNumber={selectedVerse?.number || 1} book={book} chapter={chapter} isAdmin={isAdmin} onShowToast={onShowToast} userProgress={userProgress} />
        </div>
    );
}
