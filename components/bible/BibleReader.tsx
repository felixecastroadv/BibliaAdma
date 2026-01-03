import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Settings, Type, Play, Pause, CheckCircle, ChevronRight, List, Book, ChevronDown, RefreshCw, WifiOff, Zap, Volume2, X, FastForward, Search, Trash2, Sparkles, Loader2, Clock, Lock, Bookmark } from 'lucide-react';
import VersePanel from './VersePanel';
import { db } from '../../services/database';
import { generateChapterKey, BIBLE_BOOKS } from '../../constants';
import { generateContent } from '../../services/geminiService';
import { ChapterMetadata } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

// --- CATEGORIZAÇÃO DIDÁTICA DA BÍBLIA ---
const BIBLE_CATEGORIES = [
    {
        id: 'ot_law',
        name: 'Pentateuco (Lei)',
        color: 'text-blue-600 dark:text-blue-400',
        books: ['Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio']
    },
    {
        id: 'ot_history',
        name: 'Históricos (AT)',
        color: 'text-green-600 dark:text-green-400',
        books: ['Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel', '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester']
    },
    {
        id: 'ot_poetry',
        name: 'Poéticos & Sabedoria',
        color: 'text-purple-600 dark:text-purple-400',
        books: ['Jó', 'Salmos', 'Provérbios', 'Eclesiastes', 'Cantares']
    },
    {
        id: 'ot_prophets',
        name: 'Profetas',
        color: 'text-orange-600 dark:text-orange-400',
        books: ['Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós', 'Obadias', 'Jonas', 'Miquéias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias']
    },
    {
        id: 'nt_gospels',
        name: 'Evangelhos & Atos',
        color: 'text-red-600 dark:text-red-400',
        books: ['Mateus', 'Marcos', 'Lucas', 'João', 'Atos']
    },
    {
        id: 'nt_paul',
        name: 'Cartas de Paulo',
        color: 'text-indigo-600 dark:text-indigo-400',
        books: ['Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas', 'Efésios', 'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses', '1 Timóteo', '2 Timóteo', 'Tito', 'Filemom']
    },
    {
        id: 'nt_general',
        name: 'Cartas Gerais & Revelação',
        color: 'text-teal-600 dark:text-teal-400',
        books: ['Hebreus', 'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João', '3 João', 'Judas', 'Apocalipse']
    }
];

const PremiumNavigator = ({ isOpen, onClose, currentBook, onSelect }: any) => {
    const [selectedBook, setSelectedBook] = useState<string>(currentBook);
    const [searchTerm, setSearchTerm] = useState('');

    // Rola para o livro selecionado ao abrir
    const bookListRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (isOpen) {
            setSelectedBook(currentBook);
            setSearchTerm('');
        }
    }, [isOpen, currentBook]);

    const activeBookData = BIBLE_BOOKS.find(b => b.name === selectedBook);
    
    // Filtragem de busca
    const filteredCategories = searchTerm.trim() === '' 
        ? BIBLE_CATEGORIES 
        : BIBLE_CATEGORIES.map(cat => ({
            ...cat,
            books: cat.books.filter(b => b.toLowerCase().includes(searchTerm.toLowerCase()))
          })).filter(cat => cat.books.length > 0);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-[#FDFBF7] dark:bg-[#121212] w-full md:w-[90%] md:max-w-5xl h-full md:h-[85vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#C5A059]/30"
                >
                    {/* Header Luxuoso */}
                    <div className="bg-[#1a0f0f] text-white p-5 flex items-center justify-between shrink-0 border-b border-[#C5A059]/50 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                        <div className="relative z-10 flex flex-col">
                            <h2 className="font-cinzel font-bold text-xl md:text-2xl tracking-widest text-[#C5A059]">NAVEGAÇÃO BÍBLICA</h2>
                            <p className="font-montserrat text-[10px] text-gray-400 uppercase tracking-[0.3em]">Selecione Livro & Capítulo</p>
                        </div>
                        <button onClick={onClose} className="relative z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-95 border border-white/10">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row h-full overflow-hidden">
                        {/* COLUNA ESQUERDA: LISTA DE LIVROS (Com Busca e Categorias) */}
                        <div className="w-full md:w-1/3 border-r border-[#C5A059]/20 bg-[#F5F5DC]/50 dark:bg-black/20 flex flex-col h-[50vh] md:h-full">
                            {/* Barra de Busca */}
                            <div className="p-4 border-b border-[#C5A059]/10 bg-white dark:bg-[#1E1E1E]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar livro..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-montserrat focus:ring-2 focus:ring-[#C5A059] focus:bg-white dark:focus:bg-gray-900 transition-all outline-none dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Lista Categorizada */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide" ref={bookListRef}>
                                {filteredCategories.map((cat) => (
                                    <div key={cat.id} className="animate-in slide-in-from-left-5 duration-500">
                                        <h3 className={`font-cinzel font-bold text-xs uppercase tracking-widest mb-3 pl-2 border-l-2 ${cat.color.replace('text', 'border')} ${cat.color} opacity-80`}>
                                            {cat.name}
                                        </h3>
                                        <div className="space-y-1">
                                            {cat.books.map(bookName => {
                                                const isActive = selectedBook === bookName;
                                                return (
                                                    <button
                                                        key={bookName}
                                                        onClick={() => setSelectedBook(bookName)}
                                                        className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-between group ${
                                                            isActive 
                                                            ? 'bg-gradient-to-r from-[#C5A059] to-[#9e8045] text-white shadow-lg shadow-[#C5A059]/30 transform scale-[1.02]' 
                                                            : 'hover:bg-white dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                                        }`}
                                                    >
                                                        <span className={`font-montserrat font-bold text-sm ${isActive ? 'text-white' : ''}`}>
                                                            {bookName}
                                                        </span>
                                                        {isActive && <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                                {filteredCategories.length === 0 && (
                                    <div className="text-center py-10 text-gray-400">
                                        <Book className="w-10 h-10 mx-auto mb-2 opacity-30"/>
                                        <p>Livro não encontrado</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* COLUNA DIREITA: CAPÍTULOS (Visual Premium) */}
                        <div className="w-full md:w-2/3 bg-white dark:bg-[#1E1E1E] flex flex-col h-[50vh] md:h-full relative">
                             {/* Título do Livro Selecionado */}
                             <div className="p-6 md:p-8 text-center border-b border-[#C5A059]/10 bg-gradient-to-b from-[#FDFBF7] to-white dark:from-[#1E1E1E] dark:to-[#151515]">
                                <motion.div 
                                    key={selectedBook}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="inline-block"
                                >
                                    <h2 className="font-cinzel text-3xl md:text-5xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-1">
                                        {selectedBook}
                                    </h2>
                                    <div className="flex items-center justify-center gap-2 opacity-60">
                                        <div className="h-[1px] w-8 bg-[#C5A059]"></div>
                                        <p className="font-montserrat text-xs uppercase tracking-[0.3em] text-[#C5A059]">
                                            {activeBookData?.chapters} Capítulos
                                        </p>
                                        <div className="h-[1px] w-8 bg-[#C5A059]"></div>
                                    </div>
                                </motion.div>
                             </div>

                             {/* Grid de Capítulos */}
                             <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
                                <motion.div 
                                    key={selectedBook + "_grid"}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 md:gap-4"
                                >
                                    {Array.from({ length: activeBookData?.chapters || 0 }, (_, i) => i + 1).map(chap => (
                                        <button 
                                            key={chap} 
                                            onClick={() => { onSelect(selectedBook, chap); onClose(); }}
                                            className="aspect-square rounded-2xl border border-[#C5A059]/20 bg-white dark:bg-[#2A2A2A] shadow-sm hover:shadow-md 
                                            hover:border-[#8B0000] hover:bg-[#8B0000] hover:text-white dark:hover:bg-[#ff6b6b] dark:hover:border-[#ff6b6b]
                                            flex items-center justify-center font-cinzel font-bold text-lg text-gray-700 dark:text-gray-200
                                            transition-all duration-300 group active:scale-90 relative overflow-hidden"
                                        >
                                            <span className="relative z-10">{chap}</span>
                                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        </button>
                                    ))}
                                </motion.div>
                             </div>

                             {/* Botão Flutuante 'Ler Capítulo 1' se não quiser escolher */}
                             <div className="absolute bottom-6 right-6 md:hidden">
                                <button 
                                    onClick={() => { onSelect(selectedBook, 1); onClose(); }}
                                    className="bg-[#8B0000] text-white p-4 rounded-full shadow-xl flex items-center gap-2 font-bold animate-bounce"
                                >
                                    <Play className="w-5 h-5 fill-current" />
                                </button>
                             </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
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
            const cloudData = await db.entities.BibleChapter.getCloud(cacheKey);
            if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
                setSourceMode('cloud');
                const formatted = cloudData.map((t: string, i: number) => ({ number: i + 1, text: t }));
                setVerses(formatted);
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
            fetchChapter();
        }
    };

    const loadMetadata = async () => {
        setMetadata(null);
        try {
            // Tenta pegar local primeiro
            let meta = await db.entities.ChapterMetadata.get(chapterKey);
            
            if (!meta) {
               // Tenta pegar da nuvem
               const cloudMeta = await db.entities.ChapterMetadata.getCloud(chapterKey);
               if (cloudMeta) {
                   meta = cloudMeta;
                   // Sincroniza localmente para o futuro
                   await db.entities.ChapterMetadata.save(meta);
               }
            }
            
            if (meta) {
                setMetadata(meta);
            } 
        } catch (e) { console.error("Metadata Error", e); }
    };

    const generateMetadata = async () => {
        if (isGeneratingMeta) return;
        setIsGeneratingMeta(true);
        const prompt = `ATUE COMO: Teólogo Brasileiro. TAREFA: Gerar metadados para ${book} ${chapter}. IDIOMA DE RESPOSTA: PORTUGUÊS DO BRASIL (pt-BR). FORMATO JSON OBRIGATÓRIO: { "title": "Título Curto (Max 5 palavras)", "subtitle": "Resumo em 1 frase" }. Estilo: Clássico e Conservador.`;
        try {
            const rawText = await generateContent(prompt, null);
            if (rawText) {
                const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                const res = JSON.parse(cleanJson);
                if (res && res.title) {
                    const data = { 
                        chapter_key: chapterKey,
                        title: res.title, 
                        subtitle: res.subtitle 
                    };
                    await db.entities.ChapterMetadata.save(data);
                    setMetadata(data);
                    onShowToast("Epígrafe salva para todos!", "success");
                }
            }
        } catch (e) {
            console.error("Failed to generate metadata", e);
            onShowToast("Erro ao regenerar epígrafe.", "error");
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
            {/* Header com Ultra Glassmorphism - OTIMIZADO PARA iOS (pt-12 no mobile) */}
            <div className="sticky top-0 z-30 bg-[#8B0000]/95 dark:bg-black/80 backdrop-blur-xl text-white pt-12 pb-3 px-3 md:pt-4 md:pb-4 shadow-lg flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90"><ChevronLeft /></button>
                    <div className="flex flex-col cursor-pointer active:opacity-70 transition-opacity p-1 px-2 rounded-lg hover:bg-white/5" onClick={() => setShowSelector(true)}>
                        <h1 className="font-cinzel font-bold text-lg flex items-center gap-2 leading-none drop-shadow-sm tracking-wide">
                            {book} {chapter} <ChevronDown className="w-4 h-4 text-[#C5A059]" />
                        </h1>
                        <span className="text-[9px] uppercase tracking-[0.2em] opacity-70 font-montserrat">Almeida Corrigida</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={togglePlay} className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90">{isPlaying ? <Pause className="w-5 h-5 animate-pulse text-[#C5A059]" /> : <Play className="w-5 h-5" />}</button>
                    
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

            <PremiumNavigator isOpen={showSelector} onClose={() => setShowSelector(false)} currentBook={book} onSelect={(b: string, c: number) => { setBook(b); setChapter(c); }} />

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
                        <div className="text-center mb-12 mt-4 select-none">
                            <h1 className="font-cinzel text-4xl md:text-5xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-4 uppercase tracking-tighter drop-shadow-sm leading-none">
                                {book} <span className="text-[#C5A059]">{chapter}</span>
                            </h1>

                            {isGeneratingMeta ? (
                                <div className="flex flex-col items-center text-[#C5A059] animate-pulse mt-4">
                                    <Sparkles className="w-5 h-5 mb-2" />
                                    <p className="font-cinzel text-[10px] font-bold uppercase tracking-[0.3em]">Contextualizando...</p>
                                </div>
                            ) : metadata ? (
                                <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 relative group">
                                    <h2 className="font-cinzel text-xs md:text-sm font-bold text-[#C5A059] uppercase tracking-[0.3em] mb-2 flex items-center justify-center gap-2">
                                        {metadata.title}
                                        {isAdmin && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); generateMetadata(); }}
                                                className="text-gray-300 hover:text-[#8B0000] transition-colors p-1"
                                                title="Regerar Epígrafe (Admin)"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                            </button>
                                        )}
                                    </h2>
                                    <p className="font-cormorant text-xl text-gray-600 dark:text-gray-400 italic leading-relaxed px-4">
                                        "{metadata.subtitle}"
                                    </p>
                                    <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent mx-auto mt-6 opacity-60"></div>
                                </div>
                            ) : (
                                <div className="h-8 flex justify-center">
                                    {isAdmin && (
                                        <button onClick={generateMetadata} className="text-xs text-[#C5A059] underline hover:text-[#8B0000]">
                                            Gerar Epígrafe
                                        </button>
                                    )}
                                </div>
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
