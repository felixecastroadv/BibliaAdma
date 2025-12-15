
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Settings, Type, Play, Pause, CheckCircle, ChevronRight, List, Book, ChevronDown, RefreshCw, WifiOff, Zap, Volume2, X, FastForward, Search, Trash2, Sparkles, Loader2 } from 'lucide-react';
import VersePanel from './VersePanel';
import { db } from '../../services/database';
import { generateChapterKey, BIBLE_BOOKS } from '../../constants';
import { generateContent } from '../../services/geminiService';
import { Type as GenType } from "@google/genai";
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
        <div className="fixed inset-0 z-50 bg-[#FDFBF7] dark:bg-[#121212] flex flex-col animate-in slide-in-from-bottom-5">
            <div className="bg-[#8B0000] text-white p-4 shadow-lg flex justify-between items-center shrink-0">
                <h2 className="font-cinzel font-bold text-lg">Navegação Bíblica</h2>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex bg-white dark:bg-[#1E1E1E] border-b border-[#C5A059]">
                <button onClick={() => { setTab('AT'); setSelectedBook(null); }} className={`flex-1 py-4 font-cinzel font-bold text-sm transition-colors ${tab === 'AT' ? 'bg-[#C5A059]/20 text-[#8B0000] border-b-4 border-[#8B0000] dark:text-[#C5A059]' : 'text-gray-500'}`}>VELHO TESTAMENTO</button>
                <button onClick={() => { setTab('NT'); setSelectedBook(null); }} className={`flex-1 py-4 font-cinzel font-bold text-sm transition-colors ${tab === 'NT' ? 'bg-[#C5A059]/20 text-[#8B0000] border-b-4 border-[#8B0000] dark:text-[#C5A059]' : 'text-gray-500'}`}>NOVO TESTAMENTO</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                {!selectedBook ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {currentList.map(b => (
                            <button key={b.name} onClick={() => setSelectedBook(b.name)} className={`p-4 rounded-xl border text-left transition-all active:scale-95 ${currentBook === b.name ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-md' : 'bg-white dark:bg-[#1E1E1E] dark:text-gray-200 border-[#C5A059]/30 hover:border-[#8B0000]'}`}>
                                <span className="font-cinzel font-bold block">{b.name}</span>
                                <span className="text-[10px] opacity-70 uppercase tracking-wider">{b.chapters} Capítulos</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-5">
                        <button onClick={() => setSelectedBook(null)} className="mb-4 text-[#8B0000] dark:text-[#ff6b6b] flex items-center gap-1 font-bold text-sm"><ChevronLeft className="w-4 h-4" /> Voltar para Livros</button>
                        <h3 className="font-cinzel text-2xl font-bold text-center mb-6 text-[#1a0f0f] dark:text-white border-b border-[#C5A059]/30 pb-2">{selectedBook}</h3>
                        <div className="grid grid-cols-5 gap-3">
                            {Array.from({ length: activeBookData?.chapters || 0 }, (_, i) => i + 1).map(chap => (
                                <button key={chap} onClick={() => { onSelect(selectedBook, chap); onClose(); }} className="aspect-square flex items-center justify-center rounded-lg bg-white dark:bg-[#1E1E1E] border border-[#C5A059]/30 font-montserrat font-bold text-lg hover:bg-[#8B0000] hover:text-white transition-colors dark:text-gray-200">{chap}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function BibleReader({ onBack, isAdmin, onShowToast, initialBook, initialChapter, userProgress, onProgressUpdate }: any) {
    const [book, setBook] = useState(initialBook || 'Gênesis');
    const [chapter, setChapter] = useState(initialChapter || 1);
    const [verses, setVerses] = useState<{number: number, text: string}[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [sourceMode, setSourceMode] = useState<'offline' | 'online'>('offline');
    
    const [showSelector, setShowSelector] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [fontSize, setFontSize] = useState(18);
    const [selectedVerse, setSelectedVerse] = useState<{text: string, number: number} | null>(null);

    const [metadata, setMetadata] = useState<ChapterMetadata | null>(null);
    const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [playbackRate, setPlaybackRate] = useState(1);
    
    const chapterKey = generateChapterKey(book, chapter);
    const isRead = userProgress?.chapters_read?.includes(chapterKey);

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
        window.scrollTo(0, 0);
        fetchChapter();
        loadMetadata();
    }, [book, chapter]);

    const fetchChapter = async () => {
        setLoading(true);
        setErrorMsg('');
        setVerses([]);
        setSourceMode('offline');
        
        try {
            const bookMeta = BIBLE_BOOKS.find(b => b.name === book);
            if (!bookMeta) throw new Error("Livro não encontrado.");

            // 1. Tenta IndexedDB (Nova Tecnologia)
            const cacheKey = `bible_acf_${bookMeta.abbrev}_${chapter}`;
            const cached = await db.entities.BibleChapter.getOffline(cacheKey);
            
            if (cached && Array.isArray(cached) && cached.length > 0) {
                // Suporte ao formato array de strings ["No principio", "criou Deus"]
                const formatted = cached.map((t: string, i: number) => ({ number: i + 1, text: t }));
                setVerses(formatted);
                setLoading(false);
                return;
            }

            // 2. Fallback: LocalStorage (Legado)
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

            // 3. Fallback: Online
            setSourceMode('online');
            const res = await fetch(`https://www.abibliadigital.com.br/api/verses/acf/${bookMeta.abbrev}/${chapter}`);
            if (!res.ok) throw new Error("Falha ao baixar da internet.");
            
            const data = await res.json();
            
            if (data.verses && data.verses.length > 0) {
                const cleanVerses = data.verses.map((v: any) => ({
                    number: v.number,
                    text: v.text.trim()
                }));
                
                // Tenta salvar no IndexedDB para a próxima vez
                const simpleVerses = cleanVerses.map((v:any) => v.text);
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
            localStorage.removeItem(`bible_acf_${bookMeta.abbrev}_${chapter}`);
            fetchChapter();
        }
    };

    const loadMetadata = async () => {
        setMetadata(null);
        try {
            // Tenta carregar do IndexedDB primeiro (Novo método)
            let meta = await db.entities.ChapterMetadata.get(chapterKey);
            
            // Fallback para API antiga se não achar no IDB
            if (!meta) {
               const apiMetas = await db.entities.ChapterMetadata.filter({ chapter_key: chapterKey });
               if (apiMetas && apiMetas.length > 0) meta = apiMetas[0];
            }

            if (meta) {
                setMetadata(meta);
            } else {
                if (navigator.onLine) {
                    generateMetadata();
                }
            }
        } catch (e) { console.error("Metadata Error", e); }
    };

    const generateMetadata = async () => {
        if (isGeneratingMeta) return;
        setIsGeneratingMeta(true);
        const prompt = `Resuma o tema teológico de ${book} ${chapter} em um Título Curto e Subtítulo. JSON: { "title": "...", "subtitle": "..." }`;
        const schema = { type: GenType.OBJECT, properties: { title: { type: GenType.STRING }, subtitle: { type: GenType.STRING } } };
        try {
            const res = await generateContent(prompt, schema);
            if (res && res.title) {
                const data = { chapter_key: chapterKey, title: res.title, subtitle: res.subtitle };
                // Salva no IndexedDB (Garante persistência)
                await db.entities.ChapterMetadata.save(data);
                setMetadata(data);
            }
        } catch (e) {
            console.error("Failed to generate metadata", e);
        } finally { setIsGeneratingMeta(false); }
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
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#121212] flex flex-col transition-colors duration-300">
            <div className="sticky top-0 z-30 bg-[#8B0000] text-white p-3 shadow-lg flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft /></button>
                    <div className="flex flex-col cursor-pointer" onClick={() => setShowSelector(true)}>
                        <h1 className="font-cinzel font-bold text-lg flex items-center gap-1 leading-none">{book} {chapter} <ChevronDown className="w-4 h-4" /></h1>
                        <span className="text-[10px] uppercase tracking-widest opacity-80 font-montserrat">Almeida Corrigida {sourceMode === 'offline' ? '(Offline)' : '(Online)'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={togglePlay} className="p-2 hover:bg-white/10 rounded-full">{isPlaying ? <Pause className="w-5 h-5 animate-pulse" /> : <Play className="w-5 h-5" />}</button>
                    <button onClick={toggleRead} className={`p-2 rounded-full transition-colors ${isRead ? 'text-green-300' : 'hover:bg-white/10 text-white/70'}`}><CheckCircle className="w-5 h-5" /></button>
                    <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-white/20' : 'hover:bg-white/10'}`}><Settings className="w-5 h-5" /></button>
                </div>
            </div>

            {showSettings && (
                <div className="bg-white dark:bg-[#1E1E1E] border-b border-[#C5A059] p-4 shadow-xl animate-in slide-in-from-top-5 relative z-20">
                    <div className="grid gap-4 max-w-lg mx-auto">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2"><Type className="w-4 h-4"/> Tamanho</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="w-8 h-8 rounded border flex items-center justify-center dark:text-white dark:border-gray-600">-</button>
                                <span className="font-bold w-6 text-center dark:text-white">{fontSize}</span>
                                <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="w-8 h-8 rounded border flex items-center justify-center dark:text-white dark:border-gray-600">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <BookSelector isOpen={showSelector} onClose={() => setShowSelector(false)} currentBook={book} onSelect={(b: string, c: number) => { setBook(b); setChapter(c); }} />

            <div className="flex-1 overflow-y-auto pb-24">
                <div className="max-w-3xl mx-auto p-6 md:p-10">
                    {loading ? (
                        <div className="h-20 flex flex-col items-center justify-center space-y-2 animate-pulse mt-8">
                             <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-800 rounded"></div>
                             <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-800 rounded"></div>
                        </div>
                    ) : (
                        <div className="text-center mb-10 mt-4 cursor-pointer" onClick={() => generateMetadata()} title="Regerar Título">
                            {isGeneratingMeta ? (
                                <div className="flex flex-col items-center text-[#C5A059] animate-pulse">
                                    <Sparkles className="w-6 h-6 mb-1" />
                                    <p className="font-cinzel text-xs font-bold uppercase tracking-widest">Gerando tema teológico...</p>
                                </div>
                            ) : (
                                <>
                                    <h2 className="font-cinzel text-xl md:text-2xl font-bold text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-widest mb-2">
                                        {metadata?.title || `${book} ${chapter}`}
                                    </h2>
                                    {metadata?.subtitle && <p className="font-cormorant text-lg italic text-gray-600 dark:text-gray-400">{metadata.subtitle}</p>}
                                </>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="space-y-6">
                            {[1,2,3].map(i => <div key={i} className="space-y-2 animate-pulse"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div></div>)}
                        </div>
                    ) : errorMsg ? (
                        <div className="text-center py-20">
                            <WifiOff className="w-16 h-16 mx-auto mb-4 text-[#8B0000] opacity-50"/>
                            <p className="text-gray-500 mb-4">{errorMsg}</p>
                            <div className="flex flex-col gap-2 max-w-xs mx-auto">
                                <button onClick={fetchChapter} className="bg-[#8B0000] text-white px-4 py-2 rounded flex items-center justify-center gap-2">
                                    <RefreshCw className="w-4 h-4"/> Tentar Novamente
                                </button>
                                <button onClick={clearCacheAndRetry} className="border border-red-500 text-red-500 px-4 py-2 rounded flex items-center justify-center gap-2 text-xs hover:bg-red-50">
                                    <Trash2 className="w-4 h-4"/> Forçar Download Online
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {verses.map(v => (
                                <div key={v.number} onClick={() => setSelectedVerse(v)} className={`relative pl-8 pr-2 py-2 rounded transition-colors cursor-pointer border-l-2 border-transparent hover:border-[#C5A059] ${selectedVerse?.number === v.number ? 'bg-[#C5A059]/10 border-[#C5A059]' : ''}`}>
                                    <span className="absolute left-0 top-1.5 font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] text-xs w-6 text-center select-none">{v.number}</span>
                                    <p className="font-cormorant leading-relaxed text-[#1a0f0f] dark:text-gray-200 text-justify" style={{ fontSize: `${fontSize}px`, lineHeight: '1.6' }}>{v.text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-[#121212] border-t border-[#C5A059] p-4 flex justify-between items-center z-20 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
                <button onClick={handlePrev} className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-[#8B0000] font-bold text-sm"><ChevronLeft className="w-5 h-5" /> Anterior</button>
                <button onClick={toggleRead} className={`px-6 py-2 rounded-full font-bold shadow-lg transition-all transform active:scale-95 flex items-center gap-2 ${isRead ? 'bg-green-600 text-white' : 'bg-[#8B0000] text-white'}`}>{isRead ? <CheckCircle className="w-4 h-4" /> : null} {isRead ? 'LIDO' : 'CONCLUIR'}</button>
                <button onClick={handleNext} className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-[#8B0000] font-bold text-sm">Próximo <ChevronRight className="w-5 h-5" /></button>
            </div>

            <VersePanel isOpen={!!selectedVerse} onClose={() => setSelectedVerse(null)} verse={selectedVerse?.text || ''} verseNumber={selectedVerse?.number || 1} book={book} chapter={chapter} isAdmin={isAdmin} onShowToast={onShowToast} userProgress={userProgress} />
        </div>
    );
}
